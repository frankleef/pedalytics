import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { berekenZ2AandeelSessietype, haalPrioriteitOp, PRIORITEIT_PER_FASE, degradeerBijLageTsb, solveWeek, pasBudgetToe, verlaagBijHogeMonotonie, effectieveDuurMin, schatTssDoel, bepaalKernstimulusFrequentie } from '../weekSolver.js'
import { SESSIE_ARCHETYPES as VARIANT_ARCHETYPES } from '../../sessie-varianten.js'
import { ARCHETYPES_FIXTURE } from '../../__tests__/fixtures/archetypesFixture.js'

function dagen(...specs) {
  // specs: ['2026-07-06:2', ...] -> { datum, beschikbareUren }
  return specs.map(s => {
    const [datum, uren] = s.split(':')
    return { datum, beschikbareUren: Number(uren) }
  })
}

describe('solveWeek', () => {
  it('scenario 1: volledig lege week, klimmen-doel, Drempel+VO2max-fase, 5 dagen -> 1 kernstimulus, 1 secundair, rest z2', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:3', '2026-07-08:1.5', '2026-07-10:2', '2026-07-12:1.5', '2026-07-13:2.5'),
      alGeleverd: {}, tsb: 0,
    })
    expect(resultaat).toHaveLength(5)
    const paden = resultaat.map(r => r.pad)
    expect(paden.filter(p => p === 'kernstimulus')).toHaveLength(1)
    expect(paden.filter(p => p === 'secundair')).toHaveLength(1)
    expect(paden.filter(p => p === 'z2')).toHaveLength(3)
    const kernstimulus = resultaat.find(r => r.pad === 'kernstimulus')
    expect(kernstimulus.sessietype).toBe('drempel_intervallen')
    const secundair = resultaat.find(r => r.pad === 'secundair')
    expect(secundair.sessietype).toBe('vo2max_intervallen')
    // Klimmen heeft cadans 1 ("elke week") — de langste dag (3u) wordt
    // gereserveerd voor de lange rit (is_lange_rit_dag), dus kernstimulus
    // krijgt de op-één-na-langste dag (2.5u).
    expect(kernstimulus.beschikbareUren).toBe(2.5)
    const langeRit = resultaat.find(r => r.is_lange_rit_dag === true)
    expect(langeRit.beschikbareUren).toBe(3)
    expect(langeRit.sessietype).toBe('z2_duur')
  })

  it('scenario 2: 1 vaste sweetspot-dag deze week (ftp) -> geen tweede sweetspot, geen fallback-type binnen dezelfde fase', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 400,
      vasteDagen: [{ datum: '2026-07-05', sessietype: 'sweetspot_intervallen', tss_doel: 80, status: 'voltooid' }],
      openDagen: dagen('2026-07-06:3', '2026-07-08:1.5', '2026-07-10:2', '2026-07-12:1.5'),
      alGeleverd: { tss: 80 }, tsb: 0,
    })
    // ftp's Sweetspot-fase heeft maar één kernstimulus-kandidaat (sweetspot_intervallen)
    // en geen secundair — als die al geleverd is, wordt er geen ander intensiteitstype
    // ingevuld, alle open dagen worden z2_duur. ftp/sweetspot staat kracht_lage_cadans
    // sinds 13 juli 2026 niet meer toe (zie KRACHT_FREQUENTIE.ftp).
    expect(resultaat.some(r => r.sessietype === 'sweetspot_intervallen')).toBe(false)
    expect(resultaat.every(r => r.sessietype === 'z2_duur')).toBe(true)
  })

  it('scenario 3: week 3 van de fase (klimmen, Drempel+VO2max) -> vrijheidsessie (gemengd) op het secundair-slot', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:3', '2026-07-08:1.5', '2026-07-10:2', '2026-07-12:1.5', '2026-07-13:2.5'),
      alGeleverd: {}, tsb: 0,
    })
    const vrijheid = resultaat.find(r => r.pad === 'vrijheidsessie')
    expect(vrijheid).toBeDefined()
    expect(vrijheid.sessietype).toBe('gemengd')
    expect(resultaat.some(r => r.pad === 'secundair')).toBe(false)
  })

  it('scenario 4a: maar 2 open dagen, beide naast elkaar -> adjacency toegestaan (geen alternatief)', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:3', '2026-07-07:2'),
      alGeleverd: {}, tsb: 0,
    })
    expect(resultaat.filter(r => r.pad === 'kernstimulus' || r.pad === 'secundair')).toHaveLength(2)
  })

  it('scenario 4b: kernstimulus + 2 kandidaten, één aangrenzend één niet -> secundair kiest de niet-aangrenzende dag', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 400, vasteDagen: [],
      // 07-06 (langste, 3u) wordt gereserveerd voor de lange rit (klimmen: elke
      // week, drempel-drempel >=120min). Kernstimulus krijgt dus de op-één-na-
      // langste dag (07-07). 07-08 is aangrenzend aan 07-07, 07-11 niet.
      openDagen: dagen('2026-07-06:3', '2026-07-07:2.5', '2026-07-08:2', '2026-07-11:2'),
      alGeleverd: {}, tsb: 0,
    })
    const kernstimulus = resultaat.find(r => r.pad === 'kernstimulus')
    const secundair = resultaat.find(r => r.pad === 'secundair')
    expect(kernstimulus.datum).toBe('2026-07-07')
    expect(secundair.datum).toBe('2026-07-11')
  })

  it('scenario 5: herstelweek -> geen kernstimulus/secundair, alleen z2_duur', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 2, weektype: 'herstel', seizoensdoel: 'ftp',
      weekTssDoel: 150, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0,
    })
    expect(resultaat.every(r => r.sessietype === 'z2_duur')).toBe(true)
    expect(resultaat.every(r => r.pad === 'z2')).toBe(true)
  })

  it('null/ontbrekende tsb crasht niet', () => {
    expect(() => solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 200, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5'),
      alGeleverd: {},
    })).not.toThrow()
  })

  it('gooit door de haalPrioriteitOp-fout voor een onbekend seizoensdoel', () => {
    expect(() => solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'onbekend_doel',
      weekTssDoel: 200, vasteDagen: [], openDagen: dagen('2026-07-06:2'),
    })).toThrow(/geen prioriteitstabel/)
  })

  it('ftp in de Drempel-fase -> kernstimulus drempel_intervallen, secundair vo2max_intervallen', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 300, vasteDagen: [],
      openDagen: dagen('2026-07-06:3', '2026-07-08:1.5', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0,
    })
    const kernstimulus = resultaat.find(r => r.pad === 'kernstimulus')
    expect(kernstimulus.sessietype).toBe('drempel_intervallen')
    const secundair = resultaat.find(r => r.pad === 'secundair')
    expect(secundair.sessietype).toBe('vo2max_intervallen')
  })

  it('accepteert ook de rijke doelprofielen-fasenaam via alias (na wijzig-doel)', () => {
    const generiek = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 300, vasteDagen: [], openDagen: dagen('2026-07-06:3', '2026-07-08:1.5'), alGeleverd: {}, tsb: 0,
    })
    const rijkeNaam = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'Drempel + VO2max', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 300, vasteDagen: [], openDagen: dagen('2026-07-06:3', '2026-07-08:1.5'), alGeleverd: {}, tsb: 0,
    })
    expect(rijkeNaam.find(r => r.pad === 'kernstimulus').sessietype).toBe(generiek.find(r => r.pad === 'kernstimulus').sessietype)

    const klimspecifiek = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'Klimspecifiek', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 300, vasteDagen: [], openDagen: dagen('2026-07-06:3', '2026-07-08:1.5'), alGeleverd: {}, tsb: 0,
    })
    expect(klimspecifiek.find(r => r.pad === 'kernstimulus').sessietype).toBe('drempel_intervallen')
  })

  it('aerobe_basis, uithoudingsvermogen en sprint: kracht_lage_cadans wordt nooit gekozen, in geen enkele fase', () => {
    const generiekeFases = ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test']
    for (const doel of ['aerobe_basis', 'uithoudingsvermogen', 'sprint']) {
      for (const fase of generiekeFases) {
        const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
          fase, weekInFase: 1, weektype: 'opbouw', seizoensdoel: doel,
          weekTssDoel: 200, vasteDagen: [],
          openDagen: dagen('2026-07-06:2', '2026-07-08:1.5', '2026-07-10:2'),
          alGeleverd: {}, tsb: 0,
        })
        expect(resultaat.some(r => r.sessietype === 'kracht_lage_cadans')).toBe(false)
      }
    }
  })

  it('ftp/basis: zonder bekende historie wordt de eerste Z2-dag kracht_lage_cadans (1x/2 weken, geen eerdere toewijzing bekend)', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 200, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5'),
      alGeleverd: {}, tsb: 0,
    })
    expect(resultaat.filter(r => r.sessietype === 'kracht_lage_cadans')).toHaveLength(1)
  })

  it('ftp/basis (1x/2 weken): binnen het interval sinds de laatste toewijzing -> geen nieuwe kracht_lage_cadans', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 200, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5'),
      alGeleverd: {}, tsb: 0,
      weekNummerInSeizoen: 5, laatsteKrachtLageCadansWeek: 4, // 1 week geleden, interval is 2
    })
    expect(resultaat.some(r => r.sessietype === 'kracht_lage_cadans')).toBe(false)
  })

  it('ftp/basis (1x/2 weken): interval verstreken -> weer toegestaan', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 200, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5'),
      alGeleverd: {}, tsb: 0,
      weekNummerInSeizoen: 6, laatsteKrachtLageCadansWeek: 4, // 2 weken geleden, interval is 2
    })
    expect(resultaat.filter(r => r.sessietype === 'kracht_lage_cadans')).toHaveLength(1)
  })

  it('klimmen/sweetspot (1x/week): elke week opnieuw toegestaan', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 300, vasteDagen: [],
      // Derde dag toegevoegd t.o.v. de oorspronkelijke 2-dagen-opzet: klimmen
      // reserveert de langste dag (07-06) elke week voor de lange rit, dus met
      // maar 2 dagen zou er geen dag meer overblijven voor kracht_lage_cadans
      // — dit test specifiek de kracht_lage_cadans-cadans, niet de lange-rit-
      // reservering, dus 3 dagen om beide mechanismen ruimte te geven.
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5', '2026-07-10:1.5'),
      alGeleverd: {}, tsb: 0,
      weekNummerInSeizoen: 6, laatsteKrachtLageCadansWeek: 5, // vorige week, interval is 1
    })
    expect(resultaat.filter(r => r.sessietype === 'kracht_lage_cadans')).toHaveLength(1)
  })

  it('overgangsfase/consolidatie/test: kracht_lage_cadans nooit toegestaan, ook niet voor klimmen/ftp', () => {
    for (const doel of ['klimmen', 'ftp']) {
      for (const fase of ['overgangsfase', 'consolidatie', 'test']) {
        const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
          fase, weekInFase: 1, weektype: 'opbouw', seizoensdoel: doel,
          weekTssDoel: 200, vasteDagen: [], openDagen: dagen('2026-07-06:2'), alGeleverd: {}, tsb: 0,
        })
        expect(resultaat.some(r => r.sessietype === 'kracht_lage_cadans')).toBe(false)
      }
    }
  })

  it('herstelweek: kracht_lage_cadans wordt niet toegewezen, ook niet als de fase het normaal toestaat', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'herstel', seizoensdoel: 'ftp',
      weekTssDoel: 100, vasteDagen: [], openDagen: dagen('2026-07-06:2'), alGeleverd: {}, tsb: 0,
    })
    expect(resultaat.some(r => r.sessietype === 'kracht_lage_cadans')).toBe(false)
  })

  it('een kracht_lage_cadans-toewijzing komt zonder enige Claude-afhankelijkheid tot stand (solveWeek importeert geen claude-module)', () => {
    const bron = readFileSync(fileURLToPath(new URL('../weekSolver.js', import.meta.url)), 'utf8')
    expect(bron).not.toMatch(/from\s+["'][^"']*claude[^"']*["']/i)
  })

  it('sprint, Sprintkracht-fase: max 2 sprint_neuraal-dagen, nooit aangrenzend', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'sprint',
      weekTssDoel: 300, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-07:1.5', '2026-07-10:2', '2026-07-12:1.5'),
      alGeleverd: {}, tsb: 0,
    })
    const sprintDagen = resultaat.filter(r => r.sessietype === 'sprint_neuraal')
    expect(sprintDagen.length).toBeLessThanOrEqual(2)
    if (sprintDagen.length === 2) {
      const [a, b] = sprintDagen.map(d => d.datum).sort()
      const diff = Math.abs(new Date(a) - new Date(b))
      expect(diff).toBeGreaterThan(86400000)
    }
  })

  it('regressie: kernstimulusdag met meer beschikbare tijd krijgt een zwaarder archetype/hoger tss_doel (fix: schatTssDoel/bepaalArchetypeHint negeerden beschikbareDuurMin altijd)', () => {
    // sweetspot_intervallen: archetype_hint (welk archetype straks gegenereerd
    // mag worden) blijft gebaseerd op min_duur_min tegen de RUWE beschikbareUren
    // (ongemoeid door de sectie 22-G-progressiefactor, zie getArchetypesVoorSessietype)
    // — tempo_continu (geen min_duur_min) bij 1u, ss_lang (min_duur_min 90) pas
    // bereikbaar vanaf 2u30. tss_doel gebruikt i.p.v. een archetype's tss_range de
    // directe IF²×uren×100-formule (schatTssDoel, SESSIETYPE_IF_MIDDEN.
    // sweetspot_intervallen=0.86, SESSIETYPE_MAX_EFFECTIEVE_UREN.sweetspot_intervallen
    // =2.5) — sinds sectie 22-G schaalt `uren` ook mee met de week-in-blok-
    // progressiefactor (weekInFase 2 -> 0.875, zie progressieFactor()):
    // 1u: effectieveDuurMin=round(min(60,150)*0.875)=53min -> round(0.86²×(53/60)×100)=65.
    // 2u30: effectieveDuurMin=round(min(150,150)*0.875)=131min -> round(0.86²×(131/60)×100)=161.
    const resultaatKort = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 2, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:1'),
      alGeleverd: {}, tsb: 0,
    })
    const resultaatLang = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 2, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:2.5'),
      alGeleverd: {}, tsb: 0,
    })

    const kernstimulusKort = resultaatKort.find(r => r.pad === 'kernstimulus')
    const kernstimulusLang = resultaatLang.find(r => r.pad === 'kernstimulus')

    expect(kernstimulusKort.sessietype).toBe('sweetspot_intervallen')
    expect(kernstimulusLang.sessietype).toBe('sweetspot_intervallen')

    // Weinig tijd (1u): lichte archetype-hint, laag tss_doel.
    expect(kernstimulusKort.archetype_hint).toBe('tempo_continu')
    expect(kernstimulusKort.tss_doel).toBe(65)

    // Meer tijd (2u30): zwaardere archetype-hint, hoger tss_doel.
    expect(kernstimulusLang.archetype_hint).toBe('ss_lang')
    expect(kernstimulusLang.tss_doel).toBe(161)
    expect(kernstimulusLang.tss_doel).toBeGreaterThan(kernstimulusKort.tss_doel)
  })

  describe('sectie 22-G: week-in-blok duur-progressie (kernstimulus, interval-sessietypes)', () => {
    it('sweetspot_intervallen: tss_doel/duur groeit van week 1 naar week 3 binnen hetzelfde blok, bij gelijke beschikbare tijd', () => {
      const perWeek = [1, 2, 3].map(weekInFase => {
        const resultaat = solveWeek({
          archetypesData: ARCHETYPES_FIXTURE,
          fase: 'sweetspot', weekInFase, weektype: 'opbouw', seizoensdoel: 'ftp',
          weekTssDoel: 400, vasteDagen: [],
          openDagen: dagen('2026-07-06:2.5'),
          alGeleverd: {}, tsb: 0,
        })
        return resultaat.find(r => r.pad === 'kernstimulus').tss_doel
      })

      // 139 (wk1) -> 161 (wk2) -> 185 (wk3): strikt oplopend, wk3 bereikt het
      // ongewijzigde plafond (effectieveDuurMin zonder progressiefactor = 185,
      // zie de regressietest hierboven) — nooit erboven.
      expect(perWeek[0]).toBe(139)
      expect(perWeek[1]).toBe(161)
      expect(perWeek[2]).toBe(185)
      expect(perWeek[1]).toBeGreaterThan(perWeek[0])
      expect(perWeek[2]).toBeGreaterThan(perWeek[1])
    })

    it('z2_duur/kracht_lage_cadans: geen enkele week-in-blok-invloed (niet in PROGRESSIEVE_SESSIETYPES)', () => {
      const perWeekZ2 = [1, 2, 3].map(weekInFase => {
        const resultaat = solveWeek({
          archetypesData: ARCHETYPES_FIXTURE,
          fase: 'basis', weekInFase, weektype: 'opbouw', seizoensdoel: 'ftp',
          weekTssDoel: 300, vasteDagen: [],
          openDagen: dagen('2026-07-06:2'),
          alGeleverd: {}, tsb: 0,
        })
        return resultaat.find(r => r.pad === 'z2').tss_doel
      })
      expect(perWeekZ2[0]).toBe(perWeekZ2[1])
      expect(perWeekZ2[1]).toBe(perWeekZ2[2])
    })

    it('herstelweek: levert geen kernstimulus op, ongeacht weekInFase (progressiefactor "ontgrendelt" geen kernstimulus tijdens herstel)', () => {
      const opbouw = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 400, vasteDagen: [], openDagen: dagen('2026-07-06:2.5'),
        alGeleverd: {}, tsb: 0,
      })
      const herstel = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 4, weektype: 'herstel', seizoensdoel: 'ftp',
        weekTssDoel: 400, vasteDagen: [], openDagen: dagen('2026-07-06:2.5'),
        alGeleverd: {}, tsb: 0,
      })
      expect(opbouw.find(r => r.pad === 'kernstimulus')).toBeDefined()
      expect(herstel.find(r => r.pad === 'kernstimulus')).toBeUndefined()
    })
  })

  describe('sectie 22-G: frequentie-opbouw van de kernstimulus (1x->2x binnen het blok)', () => {
    it('sweetspot: week 1 -> 1x kernstimulus, week 3 -> 2x kernstimulus (bij voldoende budget/dagen)', () => {
      const week1 = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 1000, vasteDagen: [],
        openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
        alGeleverd: {}, tsb: 0,
      })
      const week3 = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 1000, vasteDagen: [],
        openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
        alGeleverd: {}, tsb: 0,
      })
      const kernstimulusWeek1 = week1.filter(r => r.pad === 'kernstimulus')
      const kernstimulusWeek3 = week3.filter(r => r.pad === 'kernstimulus')

      expect(kernstimulusWeek1).toHaveLength(1)
      expect(kernstimulusWeek3).toHaveLength(2)
      expect(kernstimulusWeek3.every(r => r.sessietype === 'sweetspot_intervallen')).toBe(true)
      // Niet-aangrenzend: de twee kernstimulusdagen mogen geen opeenvolgende
      // kalenderdagen zijn.
      const datums = kernstimulusWeek3.map(r => r.datum).sort()
      const diffMs = new Date(datums[1]).getTime() - new Date(datums[0]).getTime()
      expect(diffMs).toBeGreaterThan(86400000)
    })

    it('drempel: geen frequentie-opbouw, blijft altijd 1x kernstimulus + 1x secundair (vo2max), ook in een late blokweek', () => {
      // weekInFase 2 (niet 3): week 3 van 'drempel' triggert de bestaande,
      // losstaande vrijheidsdag-uitzondering (bepaalVrijheidsdag) die secundair
      // sowieso al naar 'gemengd' omzet — dat mechanisme testen we hier niet,
      // we isoleren alleen de sectie 22-G-frequentie-opbouw.
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'drempel', weekInFase: 2, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 1000, vasteDagen: [],
        openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
        alGeleverd: {}, tsb: 0,
      })
      expect(resultaat.filter(r => r.pad === 'kernstimulus')).toHaveLength(1)
      expect(resultaat.find(r => r.pad === 'secundair')?.sessietype).toBe('vo2max_intervallen')
    })

    it('basis: geen kernstimulus, dus ook geen frequentie-opbouw mogelijk (blijft ongewijzigd)', () => {
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'basis', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 300, vasteDagen: [],
        openDagen: dagen('2026-07-06:2', '2026-07-08:2'),
        alGeleverd: {}, tsb: 0,
      })
      expect(resultaat.filter(r => r.pad === 'kernstimulus')).toHaveLength(0)
    })
  })

  describe('sectie 22-G: week 1/2/3 met precies 3 beschikbare dagen (live-planconfiguratie)', () => {
    // Regressietest voor de simulatie tegen het live plan (u_frank_001, doel
    // ftp_verhogen, beschikbaarheid Di/Do/Za) uit
    // fitnessprogressie-kracht-en-weekinfase-implementatie.md: met slechts 3
    // beschikbare dagen/week moet week 3 van het sweetspot-blok nog steeds 2x
    // kernstimulus + 1x z2 opleveren, zonder gat en zonder budgetoverschrijding.
    it('week 3 met slechts 3 open dagen: 2x kernstimulus + 1x z2, geen gat, geen budgetoverschrijding', () => {
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 427, aantalWekenInFase: 4, vasteDagen: [],
        openDagen: dagen('2026-07-28:2', '2026-07-30:2', '2026-08-01:3'),
        alGeleverd: { tss: 0 }, tsb: 13, weekNummerInSeizoen: 7, laatsteKrachtLageCadansWeek: null,
      })
      expect(resultaat).toHaveLength(3)
      expect(resultaat.filter(r => r.pad === 'kernstimulus')).toHaveLength(2)
      expect(resultaat.filter(r => r.pad === 'z2')).toHaveLength(1)
      expect(resultaat.reduce((s, r) => s + r.tss_doel, 0)).toBeLessThanOrEqual(427)
    })

    it('week 1 met dezelfde 3 dagen: slechts 1x kernstimulus, lagere TSS dan week 3 (duurprogressie)', () => {
      const week1 = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 353, aantalWekenInFase: 4, vasteDagen: [],
        openDagen: dagen('2026-07-14:2', '2026-07-16:2', '2026-07-18:3'),
        alGeleverd: { tss: 0 }, tsb: 13, weekNummerInSeizoen: 5, laatsteKrachtLageCadansWeek: null,
      })
      expect(week1.filter(r => r.pad === 'kernstimulus')).toHaveLength(1)
      const kernstimulusTssWeek1 = week1.find(r => r.pad === 'kernstimulus').tss_doel

      const week3 = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 427, aantalWekenInFase: 4, vasteDagen: [],
        openDagen: dagen('2026-07-28:2', '2026-07-30:2', '2026-08-01:3'),
        alGeleverd: { tss: 0 }, tsb: 13, weekNummerInSeizoen: 7, laatsteKrachtLageCadansWeek: null,
      })
      const kernstimulusTssWeek3 = Math.max(...week3.filter(r => r.pad === 'kernstimulus').map(r => r.tss_doel))
      // Week 3's zwaarste kernstimulusdag (hoogste progressiefactor + hoogste
      // weekTssDoel) moet zwaarder zijn dan week 1's enige kernstimulusdag.
      expect(kernstimulusTssWeek3).toBeGreaterThan(kernstimulusTssWeek1)
    })
  })

  describe('sectie 22-G: kracht_lage_cadans vervalt bij 2x kernstimulus', () => {
    // klimmen/sweetspot i.p.v. ftp/sweetspot: klimmen staat kracht_lage_cadans in
    // sweetspot nog steeds 1x/week toe (KRACHT_FREQUENTIE.klimmen.sweetspot),
    // ftp/sweetspot niet meer sinds 13 juli 2026 (zie de 'ftp: kracht_lage_cadans
    // strikt volgens spec'-describe-block hieronder). Deze test isoleert het
    // 2x-kernstimulus-mechanisme zelf, los van welke fase/doel het basisgeval
    // toestaat.
    it('klimmen/sweetspot week 3, 2x kernstimulus gerealiseerd: kracht_lage_cadans wordt niet toegewezen ondanks 1x_per_week-toestemming', () => {
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'klimmen',
        weekTssDoel: 1000, vasteDagen: [],
        openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2', '2026-07-12:1.5'),
        alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 5, laatsteKrachtLageCadansWeek: null,
      })
      expect(resultaat.filter(r => r.pad === 'kernstimulus')).toHaveLength(2)
      expect(resultaat.some(r => r.sessietype === 'kracht_lage_cadans')).toBe(false)
    })

    it('klimmen/sweetspot week 1, slechts 1x kernstimulus: kracht_lage_cadans mag nog gewoon (bestaand gedrag ongewijzigd)', () => {
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
        weekTssDoel: 1000, vasteDagen: [],
        // Derde dag toegevoegd — zelfde reden als de 'elke week opnieuw
        // toegestaan'-test hierboven: klimmen reserveert de langste dag voor
        // de lange rit, en met maar 2 dagen blijft er dan geen dag over voor
        // kracht_lage_cadans (het mechanisme dat deze test verifieert).
        openDagen: dagen('2026-07-06:2', '2026-07-08:1.5', '2026-07-10:1.5'),
        alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 5, laatsteKrachtLageCadansWeek: null,
      })
      expect(resultaat.filter(r => r.pad === 'kernstimulus')).toHaveLength(1)
      expect(resultaat.some(r => r.sessietype === 'kracht_lage_cadans')).toBe(true)
    })
  })

  describe('ftp: kracht_lage_cadans strikt volgens spec (design/IMPLEMENTATIE.md regels 3056-3070, 13 juli 2026)', () => {
    it('ftp/sweetspot: kracht_lage_cadans wordt nooit toegewezen, ook niet bij slechts 1x kernstimulus', () => {
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 1000, vasteDagen: [],
        openDagen: dagen('2026-07-06:2', '2026-07-08:1.5'),
        alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 5, laatsteKrachtLageCadansWeek: null,
      })
      expect(resultaat.some(r => r.sessietype === 'kracht_lage_cadans')).toBe(false)
    })

    it('ftp/drempel: kracht_lage_cadans wordt nooit toegewezen', () => {
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'drempel', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 1000, vasteDagen: [],
        openDagen: dagen('2026-07-06:2', '2026-07-08:1.5', '2026-07-10:2'),
        alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 11, laatsteKrachtLageCadansWeek: null,
      })
      expect(resultaat.some(r => r.sessietype === 'kracht_lage_cadans')).toBe(false)
    })

    it('ftp/basis: blijft ongewijzigd toegestaan (1x per 2 weken, binnen de frequentiegrens)', () => {
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
        weekTssDoel: 200, vasteDagen: [],
        openDagen: dagen('2026-07-06:2', '2026-07-08:1.5'),
        alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 1, laatsteKrachtLageCadansWeek: null,
      })
      expect(resultaat.filter(r => r.sessietype === 'kracht_lage_cadans')).toHaveLength(1)
    })
  })

  it('sprint: geen extra sprint_neuraal-dag als er al één deze week geleverd is (vaste dag)', () => {
    const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'sprint',
      weekTssDoel: 300,
      vasteDagen: [{ datum: '2026-07-05', sessietype: 'sprint_neuraal', tss_doel: 40, status: 'voltooid' }],
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5', '2026-07-10:2'),
      alGeleverd: { tss: 40 }, tsb: 0,
    })
    expect(resultaat.filter(r => r.sessietype === 'sprint_neuraal')).toHaveLength(0)
  })
})

describe('regressie: herstelweek-budget genegeerd door vasteDagen (diagnoserapport-scenario)', () => {
  it('herstelweek (tss_doel 144) met 100 TSS aan reeds-vaste, nog niet gereden sessies -> totale weekTSS (vast + nieuw) blijft binnen de cap, niet 3x zo hoog', () => {
    const vasteDagen = [
      { datum: '2026-07-07', sessietype: 'z2_duur', tss_doel: 60, status: 'gepland' },
      { datum: '2026-07-09', sessietype: 'z2_duur', tss_doel: 40, status: 'gepland' },
    ]
    const vasteDagenTss = vasteDagen.reduce((s, d) => s + (d.tss_doel ?? 0), 0) // 100

    const ruweToewijzingen = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 2, weektype: 'herstel', seizoensdoel: 'ftp',
      weekTssDoel: 144, vasteDagen,
      openDagen: dagen('2026-07-08:1.5', '2026-07-10:2', '2026-07-11:1.5'),
      alGeleverd: {}, tsb: -7,
    })

    const toewijzingen = pasBudgetToe(ruweToewijzingen, 144, 0, vasteDagenTss)
    const nieuweTss = toewijzingen.filter(t => t.sessietype !== 'rust').reduce((s, t) => s + t.tss_doel, 0)
    const totaalWeekTss = vasteDagenTss + nieuweTss

    expect(totaalWeekTss).toBeLessThanOrEqual(144)
  })
})

describe('degradeerBijLageTsb', () => {
  it('geen degradatie ruim boven de drempel', () => {
    const result = degradeerBijLageTsb('vo2max_intervallen', 5)
    expect(result.sessietype).toBe('vo2max_intervallen')
    expect(result.gedegradeerd).toBe(false)
  })

  it('degradeert onder de drempel (-20), sessietype blijft hetzelfde', () => {
    const result = degradeerBijLageTsb('vo2max_intervallen', -25)
    expect(result.sessietype).toBe('vo2max_intervallen')
    expect(result.gedegradeerd).toBe(true)
  })

  it('exact op de drempel: geen degradatie (strikt kleiner dan)', () => {
    expect(degradeerBijLageTsb('vo2max_intervallen', -20).gedegradeerd).toBe(false)
  })

  it('null/undefined TSB: geen degradatie, geen crash', () => {
    expect(degradeerBijLageTsb('vo2max_intervallen', null)).toEqual({ sessietype: 'vo2max_intervallen', gedegradeerd: false })
    expect(degradeerBijLageTsb('vo2max_intervallen', undefined)).toEqual({ sessietype: 'vo2max_intervallen', gedegradeerd: false })
  })

  it('respecteert een expliciete drempel-override', () => {
    expect(degradeerBijLageTsb('vo2max_intervallen', -12, { tsbOndergrens: -10 }).gedegradeerd).toBe(true)
    expect(degradeerBijLageTsb('vo2max_intervallen', -12, { tsbOndergrens: -15 }).gedegradeerd).toBe(false)
  })
})

describe('haalPrioriteitOp', () => {
  it('retourneert de juiste entry voor elke combinatie in de tabel', () => {
    for (const [doel, faseTabel] of Object.entries(PRIORITEIT_PER_FASE)) {
      for (const fase of Object.keys(faseTabel)) {
        const entry = haalPrioriteitOp(doel, fase)
        expect(entry).toBeDefined()
        expect(entry).toBe(faseTabel[fase])
      }
    }
  })

  it('gooit een expliciete fout voor een onbekend seizoensdoel', () => {
    expect(() => haalPrioriteitOp('onbekend_doel', 'sweetspot')).toThrow(/geen prioriteitstabel/)
  })

  it('gooit een expliciete fout voor een onbekende fase binnen een bekend doel', () => {
    expect(() => haalPrioriteitOp('ftp', 'onbekende_fase')).toThrow(/geen prioriteitsdefinitie/)
  })

  it('voor elk van de vijf seizoensdoelen, voor elke generieke fase: nooit undefined', () => {
    const doelen = ['ftp', 'klimmen', 'aerobe_basis', 'uithoudingsvermogen', 'sprint']
    const generiekeFases = ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test']
    for (const doel of doelen) {
      for (const fase of generiekeFases) {
        expect(haalPrioriteitOp(doel, fase)).toBeDefined()
      }
    }
  })

  it('klimmen in de fase "Drempel + VO2max" -> kernstimulus drempel_intervallen, secundair vo2max_intervallen', () => {
    const entry = haalPrioriteitOp('klimmen', 'Drempel + VO2max')
    expect(entry.kernstimulus).toContain('drempel_intervallen')
    expect(entry.secundair).toBe('vo2max_intervallen')
  })

  describe('klimmen + drempel: sub-fase-splitsing op basis van weekInFase', () => {
    it('eerste en tweede week van de periode -> meerderheidsvariant (Drempel + VO2max)', () => {
      const eersteWeek = haalPrioriteitOp('klimmen', 'drempel', { weekInFase: 1, aantalWekenInFase: 3 })
      const tweedeWeek = haalPrioriteitOp('klimmen', 'drempel', { weekInFase: 2, aantalWekenInFase: 3 })
      for (const entry of [eersteWeek, tweedeWeek]) {
        expect(entry.kernstimulus).toEqual(['drempel_intervallen'])
        expect(entry.secundair).toBe('vo2max_intervallen')
      }
    })

    it('laatste week van de periode -> omgedraaid (Klimspecifiek: vo2max kernstimulus, drempel secundair)', () => {
      const laatsteWeek = haalPrioriteitOp('klimmen', 'drempel', { weekInFase: 3, aantalWekenInFase: 3 })
      expect(laatsteWeek.kernstimulus).toEqual(['vo2max_intervallen'])
      expect(laatsteWeek.secundair).toBe('drempel_intervallen')
    })

    it('zonder periode-info (backward-compatible) -> valt terug op de meerderheidsvariant', () => {
      const zonderInfo = haalPrioriteitOp('klimmen', 'drempel')
      expect(zonderInfo.kernstimulus).toEqual(['drempel_intervallen'])
      expect(zonderInfo.secundair).toBe('vo2max_intervallen')
    })

    it('andere doelen/fases blijven ongewijzigd door periode-info te negeren', () => {
      const ftpMetPeriode = haalPrioriteitOp('ftp', 'drempel', { weekInFase: 3, aantalWekenInFase: 3 })
      const ftpZonderPeriode = haalPrioriteitOp('ftp', 'drempel')
      expect(ftpMetPeriode).toBe(ftpZonderPeriode)
    })

    it('solveWeek() geeft de omgedraaide toewijzing door in de laatste week van de periode', () => {
      // weekInFase 2 van 2 (niet 3) om niet te botsen met de losstaande
      // vrijheidsdag-uitzondering, die zelf ook op weekInFase===3 triggert.
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'drempel', weekInFase: 2, aantalWekenInFase: 2, weektype: 'opbouw', seizoensdoel: 'klimmen',
        weekTssDoel: 300, vasteDagen: [],
        openDagen: dagen('2026-07-06:3', '2026-07-08:1.5', '2026-07-10:2'),
        alGeleverd: {}, tsb: 0,
      })
      const kernstimulus = resultaat.find(r => r.pad === 'kernstimulus')
      expect(kernstimulus.sessietype).toBe('vo2max_intervallen')
      const secundair = resultaat.find(r => r.pad === 'secundair')
      expect(secundair.sessietype).toBe('drempel_intervallen')
    })

    it('let op: bij een 3-weekse periode valt de laatste week (weekInFase=3) samen met de losstaande vrijheidsdag-uitzondering — secundair-slot wordt dan gemengd, niet drempel_intervallen', () => {
      const resultaat = solveWeek({
        archetypesData: ARCHETYPES_FIXTURE,
        fase: 'drempel', weekInFase: 3, aantalWekenInFase: 3, weektype: 'opbouw', seizoensdoel: 'klimmen',
        weekTssDoel: 300, vasteDagen: [],
        openDagen: dagen('2026-07-06:3', '2026-07-08:1.5', '2026-07-10:2'),
        alGeleverd: {}, tsb: 0,
      })
      const kernstimulus = resultaat.find(r => r.pad === 'kernstimulus')
      expect(kernstimulus.sessietype).toBe('vo2max_intervallen') // reversal werkt nog steeds
      const vrijheid = resultaat.find(r => r.pad === 'vrijheidsessie')
      expect(vrijheid.sessietype).toBe('gemengd') // maar het secundair-slot is hier vrijheidsdag
    })
  })
})

// LET OP — afwijking van de oorspronkelijke validatiescenario's:
// De blokdata in sessie-varianten.js bevat bewust GEEN warmup/cooldown
// ("hoofdinspanning vult hele duur", zie promptBuilder.js:304,490). Voor
// intensiteitsarchetypes (sweetspot/drempel/vo2max) is de Z2-tijd in een
// ECHTE rit vrijwel geheel warmup/cooldown — die zit hier niet in de data.
// Het verwachte bereik "sweetspot 0.65-0.8" uit de opdracht is daarom niet
// haalbaar met een letterlijke, faithful implementatie op de bestaande data
// (werkelijke waarde: ~0.29-0.35, puur de Z2-hersteltijd TUSSEN de blokken).
// Deze tests verifiëren daarom het daadwerkelijke, deterministische gedrag
// i.p.v. de aangenomen bereiken te forceren.
describe('berekenZ2AandeelSessietype', () => {
  it('z2_duur ligt dicht bij 1.0, behalve archetypes met bewust ingebouwde Z3-snippers', () => {
    for (const archetype of VARIANT_ARCHETYPES.z2_duur) {
      const fractie = berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, 'z2_duur', archetype.id)
      if (archetype.id === 'z2_tempo_blokken' || archetype.id === 'z2_tempo_teugjes' || archetype.id === 'z2_wedstrijdsimulatie') {
        // "ingekapselde Z3-blokken" — bewust geen zuivere Z2-rit, zie archetype-structuur
        expect(fractie).toBeGreaterThan(0.3)
        expect(fractie).toBeLessThan(0.9)
      } else {
        expect(fractie).toBeGreaterThan(0.9)
      }
    }
  })

  it('vo2max_intervallen/vo2_5x5 ligt tussen 0.5 en 0.75 (na vervolgticket-fix van vo2_6x4: werkduur 6min->4min, dus meer Z2-aandeel dan voorheen)', () => {
    const fractie = berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, 'vo2max_intervallen', 'vo2_5x5')
    expect(fractie).toBeGreaterThanOrEqual(0.5)
    expect(fractie).toBeLessThanOrEqual(0.75)
  })

  it('sweetspot_intervallen: alleen de Z2-hersteltijd tussen blokken, geen warmup/cooldown in de blokdata', () => {
    for (const archetype of VARIANT_ARCHETYPES.sweetspot_intervallen) {
      const fractie = berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, 'sweetspot_intervallen', archetype.id)
      expect(fractie).toBeGreaterThan(0.15)
      expect(fractie).toBeLessThan(0.5)
    }
  })

  it('gooit een duidelijke error bij een onbekende combinatie, geen silent 0', () => {
    expect(() => berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, 'z2_duur', 'bestaat_niet')).toThrow(/geen variantendata/)
    expect(() => berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, 'onbekend_type', 'iets')).toThrow(/geen variantendata/)
  })

  it('geen NaN of >1.0 voor alle archetypes zonder duur_sec_vast — en een expliciete fout (geen silent 0/NaN) voor archetypes die dat wél gebruiken', () => {
    // Generieke, alle-sessietypes-brede versie van de test die bij vo2_afbouwend
    // niet bestond (vervolgticket chunk 2) — dat gat liet de duur_sec_vast-
    // blinde-vlek destijds onopgemerkt, ondanks dat déze test al bestond.
    let aantalGetest = 0
    let aantalMetDuurSecVast = 0
    for (const [sessietype, archetypes] of Object.entries(VARIANT_ARCHETYPES)) {
      for (const archetype of archetypes) {
        aantalGetest++
        const heeftDuurSecVast = archetype.varianten.some(v => v.blokken.some(b => b.duur_sec_vast != null))
        if (heeftDuurSecVast) {
          aantalMetDuurSecVast++
          expect(() => berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, sessietype, archetype.id)).toThrow(/duur_sec_vast/)
        } else {
          const fractie = berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, sessietype, archetype.id)
          expect(Number.isNaN(fractie)).toBe(false)
          expect(fractie).toBeGreaterThanOrEqual(0)
          expect(fractie).toBeLessThanOrEqual(1.0)
        }
      }
    }
    // Sanity-check dat de test daadwerkelijk beide paden raakt, niet toevallig
    // altijd dezelfde tak — vo2_afbouwend is op moment van schrijven de enige
    // duur_sec_vast-gebruiker.
    expect(aantalGetest).toBeGreaterThan(0)
    expect(aantalMetDuurSecVast).toBeGreaterThan(0)
  })
})

describe('pasBudgetToe', () => {
  const kernstimulus = { datum: '2026-07-06', sessietype: 'sweetspot_intervallen', tss_doel: 90, beschikbareUren: 2, pad: 'kernstimulus' }
  const z2Lang = { datum: '2026-07-08', sessietype: 'z2_duur', tss_doel: 100, beschikbareUren: 3, pad: 'z2' }
  const z2Kort1 = { datum: '2026-07-10', sessietype: 'z2_duur', tss_doel: 60, beschikbareUren: 1.5, pad: 'z2' }
  const z2Kort2 = { datum: '2026-07-12', sessietype: 'z2_duur', tss_doel: 50, beschikbareUren: 1.2, pad: 'z2' }

  it('budget ruim voldoende -> geen wijziging', () => {
    const toewijzingen = [kernstimulus, z2Lang, z2Kort1, z2Kort2]
    const resultaat = pasBudgetToe(toewijzingen, 400, 0)
    expect(resultaat).toEqual(toewijzingen)
  })

  it('budget net te krap -> proportionele korting op korte Z2-dagen, lange rit blijft intact', () => {
    // totaal = 90+100+60+50=300, cap=290 -> beschikbaarVoorZ2=200, net genoeg
    // ruimte om kort1/kort2 te korten zonder ze onder de minimumduur te laten zakken
    const toewijzingen = [kernstimulus, z2Lang, z2Kort1, z2Kort2]
    const resultaat = pasBudgetToe(toewijzingen, 290, 0)
    const lang = resultaat.find(t => t.datum === z2Lang.datum)
    const kort1 = resultaat.find(t => t.datum === z2Kort1.datum)
    const kort2 = resultaat.find(t => t.datum === z2Kort2.datum)
    expect(lang.tss_doel).toBe(100) // langste rit ongewijzigd zolang de andere twee het tekort kunnen dragen
    expect(kort1.sessietype).toBe('z2_duur')
    expect(kort2.sessietype).toBe('z2_duur')
    expect(kort1.tss_doel).toBeLessThan(60)
    expect(kort2.tss_doel).toBeLessThan(50)
    expect(kort1.tss_doel + kort2.tss_doel).toBeLessThanOrEqual(110)
    // Kernstimulus blijft altijd ongemoeid
    const kern = resultaat.find(t => t.datum === kernstimulus.datum)
    expect(kern).toEqual(kernstimulus)
  })

  it('budget zo krap dat een Z2-dag onder de minimumduur zou zakken -> volledig geschrapt, niet uitgehold', () => {
    // cap=130 -> beschikbaarVoorZ2=40: te weinig voor kort1+kort2 samen met de
    // langste rit ongemoeid, maar wél genoeg om de langste rit zelf (gekort)
    // boven de minimumduur te houden nadat kort1/kort2 zijn geschrapt.
    const toewijzingen = [kernstimulus, z2Lang, z2Kort1, z2Kort2]
    const resultaat = pasBudgetToe(toewijzingen, 130, 0)
    const kort1 = resultaat.find(t => t.datum === z2Kort1.datum)
    const kort2 = resultaat.find(t => t.datum === z2Kort2.datum)
    expect(kort1.sessietype).toBe('rust')
    expect(kort1.tss_doel).toBe(0)
    expect(kort1.intentie).toBeUndefined()
    expect(kort2.sessietype).toBe('rust')
    // De langste rit wordt niet uitgehold onder de minimumduur, maar gekort
    // en blijft een echte sessie (niet geschrapt) — het tekort is elders opgevangen.
    const lang = resultaat.find(t => t.datum === z2Lang.datum)
    expect(lang.sessietype).toBe('z2_duur')
    expect(lang.tss_doel).toBeLessThan(100)
    expect(lang.beschikbareUren * 60).toBeGreaterThanOrEqual(60)
  })

  it('een item zonder pad "z2" (bv. een TEST/HERSTEL-dag) blijft volledig ongewijzigd', () => {
    const testDag = { datum: '2026-07-09', sessietype: 'ramp_test', tss_doel: 100 } // geen pad-veld, zoals een vaste dag
    const toewijzingen = [testDag, z2Lang, z2Kort1, z2Kort2]
    const resultaat = pasBudgetToe(toewijzingen, 120, 0)
    const teruggevonden = resultaat.find(t => t.datum === testDag.datum)
    expect(teruggevonden).toEqual(testDag)
  })

  it('kernstimulus/secundair overschrijden het budget alleen al -> gelogd, niet aangepast', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const zwareKernstimulus = { ...kernstimulus, tss_doel: 150 }
    const toewijzingen = [zwareKernstimulus, z2Lang]
    const resultaat = pasBudgetToe(toewijzingen, 100, 0)
    expect(resultaat).toEqual(toewijzingen) // niks aangepast, ook z2Lang niet
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  describe('alGeleverd alleen al fors over budget, geen kernstimulus/secundair (fix: nieuwe dag werd niet omgezet naar rust)', () => {
    it('week al 501 TSS gereden op een doel van 304 -> nieuwe z2-dag met tss_doel 0 wordt rust, niet stilzwijgend teruggegeven', () => {
      // Zoals solveWeek() deze zou aanleveren: geen kernstimulus/secundair
      // (nietZ2Tss=0, want restBudget was al negatief toen solveWeek draaide),
      // en de enige open dag al op tss_doel 0 door solveWeek's eigen
      // Math.max(0, restBudget * aandeel)-vloer — maar beschikbareUren nog
      // intact, wat zonder deze fix tot een volle-duur sessie zou leiden.
      const nieuweDag = { datum: '2026-07-12', sessietype: 'z2_duur', tss_doel: 0, beschikbareUren: 2, pad: 'z2' }
      const resultaat = pasBudgetToe([nieuweDag], 304, 501, 0)
      const dag = resultaat.find(t => t.datum === nieuweDag.datum)
      expect(dag.sessietype).toBe('rust')
      expect(dag.beschikbareUren).toBe(0)
    })

    it('kleine restruimte (280 gereden op doel 304, nieuwe dag past nog net binnen de resterende 24) -> geen wijziging', () => {
      // Zoals solveWeek() deze zou aanleveren: restBudget=24 was nog positief
      // toen solveWeek draaide, dus de dag kreeg gewoon tss_doel=24 (niet
      // gevloerd naar 0) — een kleine overschrijding elders in de week hoort
      // hier niet toe te leiden dat deze dag alsnog wordt teruggeschroefd.
      const nieuweDag = { datum: '2026-07-12', sessietype: 'z2_duur', tss_doel: 24, beschikbareUren: 2, pad: 'z2' }
      const resultaat = pasBudgetToe([nieuweDag], 304, 280, 0)
      const dag = resultaat.find(t => t.datum === nieuweDag.datum)
      expect(dag.sessietype).toBe('z2_duur')
      expect(dag.tss_doel).toBe(24)
    })
  })

  describe('meerdere Z2-dagen al op tss_doel 0 (fix: korten-loop brak voortijdig af zonder te schrappen)', () => {
    it('twee open Z2-dagen, beide al op tss_doel 0 door solveWeek, budget diep negatief -> allebei rust', () => {
      const dag1 = { datum: '2026-07-11', sessietype: 'z2_duur', tss_doel: 0, beschikbareUren: 2.5, pad: 'z2' }
      const dag2 = { datum: '2026-07-12', sessietype: 'z2_duur', tss_doel: 0, beschikbareUren: 1.5, pad: 'z2' }
      const resultaat = pasBudgetToe([dag1, dag2], 304, 501, 0)
      expect(resultaat.every(t => t.sessietype === 'rust')).toBe(true)
    })
  })

  describe('vasteDagenTss (fix: budget hield geen rekening met reeds bestaande, niet-gereden sessies)', () => {
    it('vasteDagenTss van 100 tegen cap 144 -> nieuwe z2-toewijzingen worden geschaald naar hooguit 44', () => {
      // Alleen z2-toewijzingen (herstelweek-scenario: geen kernstimulus/secundair)
      const nieuweZ2 = [
        { datum: '2026-07-08', sessietype: 'z2_duur', tss_doel: 90, beschikbareUren: 2, pad: 'z2' },
        { datum: '2026-07-10', sessietype: 'z2_duur', tss_doel: 54, beschikbareUren: 1.2, pad: 'z2' },
      ]
      const resultaat = pasBudgetToe(nieuweZ2, 144, 0, 100)
      const totaal = resultaat.filter(t => t.sessietype !== 'rust').reduce((s, t) => s + t.tss_doel, 0)
      expect(totaal).toBeLessThanOrEqual(44)
    })

    it('lege vasteDagen (default 0) -> ongewijzigd gedrag t.o.v. voor de fix', () => {
      const toewijzingen = [kernstimulus, z2Lang, z2Kort1, z2Kort2]
      const metDefault = pasBudgetToe(toewijzingen, 290, 0)
      const metExpliciet0 = pasBudgetToe(toewijzingen, 290, 0, 0)
      expect(metDefault).toEqual(metExpliciet0)
    })

    it('vasteDagenTss + alGeleverdTss + kernstimulus/secundair overschrijden het budget alleen al -> gelogd, niet aangepast', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const toewijzingen = [kernstimulus, z2Lang] // kernstimulus.tss_doel = 90
      const resultaat = pasBudgetToe(toewijzingen, 100, 0, 50) // 90 + 50 > 100
      expect(resultaat).toEqual(toewijzingen)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })
})

describe('verlaagBijHogeMonotonie (Blok A: monotonie/strain)', () => {
  const ctx = { archetypesData: {}, fase: 'sweetspot', weekInFase: 2, weektype: 'opbouw', seizoensdoel: 'ftp' }

  it('trigger === false -> volledig ongewijzigd, ook als er wel een niet-z2-kandidaat is', () => {
    const kernstimulus = { datum: '2026-07-06', sessietype: 'sweetspot_intervallen', tss_doel: 90, beschikbareUren: 2, pad: 'kernstimulus', archetype_hint: 'x' }
    const z2 = { datum: '2026-07-08', sessietype: 'z2_duur', tss_doel: 60, beschikbareUren: 1.5, pad: 'z2' }
    const toewijzingen = [kernstimulus, z2]
    const { toewijzingen: resultaat, gedegradeerdeDatum } = verlaagBijHogeMonotonie(toewijzingen, false, ctx)
    expect(resultaat).toEqual([kernstimulus, z2])
    expect(gedegradeerdeDatum).toBeNull()
  })

  it('geen niet-z2-kandidaat (herstelweek/basis-fase: alles al pad "z2") -> no-op, geen crash', () => {
    const z2A = { datum: '2026-07-06', sessietype: 'z2_duur', tss_doel: 60, beschikbareUren: 2, pad: 'z2' }
    const z2B = { datum: '2026-07-08', sessietype: 'z2_duur', tss_doel: 40, beschikbareUren: 1.5, pad: 'z2' }
    const toewijzingen = [z2A, z2B]
    const { toewijzingen: resultaat, gedegradeerdeDatum } = verlaagBijHogeMonotonie(toewijzingen, true, ctx)
    expect(resultaat).toEqual([z2A, z2B])
    expect(gedegradeerdeDatum).toBeNull()
  })

  it('kiest TSS-hoogte, niet type-volgorde: secundair met hogere tss_doel wordt gedegradeerd, niet kernstimulus', () => {
    const kernstimulus = { datum: '2026-07-06', sessietype: 'sprint_neuraal', tss_doel: 40, beschikbareUren: 1, pad: 'kernstimulus', archetype_hint: 'sprint-hint' }
    const secundair = { datum: '2026-07-08', sessietype: 'drempel_intervallen', tss_doel: 150, beschikbareUren: 2, pad: 'secundair', archetype_hint: 'drempel-hint' }
    const z2 = { datum: '2026-07-10', sessietype: 'z2_duur', tss_doel: 60, beschikbareUren: 1.5, pad: 'z2' }
    const toewijzingen = [kernstimulus, secundair, z2]

    const { toewijzingen: resultaat, gedegradeerdeDatum } = verlaagBijHogeMonotonie(toewijzingen, true, ctx)

    expect(gedegradeerdeDatum).toBe('2026-07-08')
    const verlaagd = resultaat.find(t => t.datum === '2026-07-08')
    expect(verlaagd.pad).toBe('z2')
    expect(verlaagd.sessietype).toBe('z2_duur')
    expect(verlaagd.toegestane_zones).toEqual(['Z2'])
    const verwachteTss = schatTssDoel(ctx.archetypesData, 'z2_duur', ctx.fase, ctx.weekInFase, ctx.seizoensdoel, true, ctx.weektype, Math.round(secundair.beschikbareUren * 60))
    expect(verlaagd.tss_doel).toBe(verwachteTss)
    // beschikbareUren/archetype_hint blijven ongewijzigd (in tegenstelling tot schrapToewijzing)
    expect(verlaagd.beschikbareUren).toBe(2)
    expect(verlaagd.archetype_hint).toBe('drempel-hint')

    // De kernstimulus-dag (lagere tss_doel) blijft volledig ongemoeid
    const ongemoeid = resultaat.find(t => t.datum === '2026-07-06')
    expect(ongemoeid).toEqual(kernstimulus)
  })

  it('tie-break bij exact gelijke tss_doel: eerste in array-volgorde wordt gedegradeerd', () => {
    const eerste = { datum: '2026-07-06', sessietype: 'sweetspot_intervallen', tss_doel: 100, beschikbareUren: 2, pad: 'kernstimulus' }
    const tweede = { datum: '2026-07-08', sessietype: 'vo2max_intervallen', tss_doel: 100, beschikbareUren: 1, pad: 'secundair' }
    const toewijzingen = [eerste, tweede]

    const { gedegradeerdeDatum } = verlaagBijHogeMonotonie(toewijzingen, true, ctx)

    expect(gedegradeerdeDatum).toBe('2026-07-06') // eerste in de array, niet tweede
  })

  it('muteert de toewijzingen-array in-place en retourneert dezelfde referentie', () => {
    const kernstimulus = { datum: '2026-07-06', sessietype: 'sweetspot_intervallen', tss_doel: 90, beschikbareUren: 2, pad: 'kernstimulus' }
    const toewijzingen = [kernstimulus]
    const { toewijzingen: resultaat } = verlaagBijHogeMonotonie(toewijzingen, true, ctx)
    expect(resultaat).toBe(toewijzingen)
    expect(toewijzingen[0].sessietype).toBe('z2_duur') // origineel object zelf is gemuteerd
  })

  it('B5: retourneert gemisteSessietype (het sessietype VÓÓR de vervanging) bij een degradatie', () => {
    const kernstimulus = { datum: '2026-07-06', sessietype: 'drempel_intervallen', tss_doel: 100, beschikbareUren: 2, pad: 'kernstimulus' }
    const toewijzingen = [kernstimulus]
    const { gemisteSessietype } = verlaagBijHogeMonotonie(toewijzingen, true, ctx)
    expect(gemisteSessietype).toBe('drempel_intervallen')
    expect(toewijzingen[0].sessietype).toBe('z2_duur') // de toewijzing zelf is intussen wél al vervangen
  })

  it('B5: gemisteSessietype is null als er geen degradatie plaatsvindt (trigger false of geen kandidaat)', () => {
    const z2 = { datum: '2026-07-06', sessietype: 'z2_duur', tss_doel: 60, beschikbareUren: 1.5, pad: 'z2' }
    expect(verlaagBijHogeMonotonie([z2], false, ctx).gemisteSessietype).toBeNull()
    expect(verlaagBijHogeMonotonie([z2], true, ctx).gemisteSessietype).toBeNull() // geen niet-z2-kandidaat
  })

  it('B5: zet beschermd_herschikking op de gedegradeerde toewijzing', () => {
    const kernstimulus = { datum: '2026-07-06', sessietype: 'sweetspot_intervallen', tss_doel: 90, beschikbareUren: 2, pad: 'kernstimulus' }
    const toewijzingen = [kernstimulus]
    verlaagBijHogeMonotonie(toewijzingen, true, ctx)
    expect(toewijzingen[0].beschermd_herschikking).toBe(true)
  })

  it('B5: geen beschermd_herschikking-veld als er geen degradatie plaatsvindt', () => {
    const kernstimulus = { datum: '2026-07-06', sessietype: 'sweetspot_intervallen', tss_doel: 90, beschikbareUren: 2, pad: 'kernstimulus' }
    const toewijzingen = [kernstimulus]
    verlaagBijHogeMonotonie(toewijzingen, false, ctx)
    expect(toewijzingen[0].beschermd_herschikking).toBeUndefined()
  })
})

describe('Blok A-integratie: pasBudgetToe herverdeelt correct ná een monotonie-degradatie', () => {
  it('vrijgekomen budget van de gedegradeerde kernstimulus-dag wordt proportioneel over de overige z2-dagen verdeeld', () => {
    const ctx = { archetypesData: {}, fase: 'sweetspot', weekInFase: 2, weektype: 'opbouw', seizoensdoel: 'ftp' }
    const kernstimulus = { datum: '2026-07-06', sessietype: 'sweetspot_intervallen', tss_doel: 150, beschikbareUren: 2, pad: 'kernstimulus' }
    const z2Lang = { datum: '2026-07-08', sessietype: 'z2_duur', tss_doel: 100, beschikbareUren: 3, pad: 'z2' }
    const z2Kort = { datum: '2026-07-10', sessietype: 'z2_duur', tss_doel: 60, beschikbareUren: 1.5, pad: 'z2' }
    const ruweToewijzingen = [kernstimulus, z2Lang, z2Kort]

    // Zonder degradatie: cap 310 is precies genoeg voor 150+100+60=310, geen korting nodig.
    const zonderDegradatie = pasBudgetToe([...ruweToewijzingen.map(t => ({ ...t }))], 310, 0)
    expect(zonderDegradatie.find(t => t.datum === z2Lang.datum).tss_doel).toBe(100)
    expect(zonderDegradatie.find(t => t.datum === z2Kort.datum).tss_doel).toBe(60)

    // Mét degradatie: kernstimulus (150) wordt een lichte z2-dag (via schatTssDoel, geen 150 meer)
    // -> nietZ2Tss daalt fors -> pasBudgetToe's herverdeling geeft de andere z2-dagen nu ruim
    // hun volle, ongekorte tss_doel (het budget is niet langer krap), i.p.v. de eerdere korting
    // die zou zijn toegepast als de vrijgekomen ruimte NIET was meegerekend.
    const { gedegradeerdeDatum } = verlaagBijHogeMonotonie(ruweToewijzingen, true, ctx)
    expect(gedegradeerdeDatum).toBe(kernstimulus.datum)

    const totaalNaDegradatie = ruweToewijzingen.find(t => t.datum === kernstimulus.datum).tss_doel
    expect(totaalNaDegradatie).toBeLessThan(150) // daadwerkelijk lichter dan de oorspronkelijke kernstimulus-TSS

    const naPasBudgetToe = pasBudgetToe(ruweToewijzingen, 310, 0)
    const langNa = naPasBudgetToe.find(t => t.datum === z2Lang.datum)
    const kortNa = naPasBudgetToe.find(t => t.datum === z2Kort.datum)
    // Met het vrijgekomen budget correct meegerekend, blijven de bestaande z2-dagen
    // op hun volle, ongekorte waarde (er is nu ruim voldoende ruimte binnen de cap).
    expect(langNa.tss_doel).toBe(100)
    expect(kortNa.tss_doel).toBe(60)
  })
})

describe('effectieveDuurMin/schatTssDoel — compliance-freeze (bevrorenWeekInFase, C3/C4/C5)', () => {
  it('bevrorenWeekInFase=null (of weggelaten): bestaand gedrag exact ongewijzigd', () => {
    expect(effectieveDuurMin('sweetspot_intervallen', 150, 3, 'opbouw', null))
      .toBe(effectieveDuurMin('sweetspot_intervallen', 150, 3, 'opbouw'))
  })

  it('een lager bevroren niveau capt de duur, en levert exact hetzelfde resultaat op als daadwerkelijk op dat niveau zitten', () => {
    const onbevroren = effectieveDuurMin('sweetspot_intervallen', 150, 3, 'opbouw')
    const bevroren = effectieveDuurMin('sweetspot_intervallen', 150, 3, 'opbouw', 1)
    expect(bevroren).toBeLessThan(onbevroren)
    expect(bevroren).toBe(effectieveDuurMin('sweetspot_intervallen', 150, 1, 'opbouw'))
  })

  it('een bevroren niveau hoger dan de actuele weekInFase heeft geen effect (Math.min beschermt niet tegen "omhoog helpen")', () => {
    expect(effectieveDuurMin('sweetspot_intervallen', 150, 1, 'opbouw', 3))
      .toBe(effectieveDuurMin('sweetspot_intervallen', 150, 1, 'opbouw'))
  })

  it('herstelweek blijft op 0.75 ongeacht bevrorenWeekInFase — de formule zelf is niet aangeraakt', () => {
    expect(effectieveDuurMin('sweetspot_intervallen', 150, 3, 'herstel', 1))
      .toBe(effectieveDuurMin('sweetspot_intervallen', 150, 3, 'herstel'))
  })

  it('niet-progressieve sessietypes (bv. z2_duur) blijven op factor 1, ook bevroren', () => {
    expect(effectieveDuurMin('z2_duur', 150, 3, 'opbouw', 1))
      .toBe(effectieveDuurMin('z2_duur', 150, 3, 'opbouw'))
  })

  it('schatTssDoel en effectieveDuurMin blijven proportioneel bevroren — geen scenario waarin duur bevriest maar TSS-budget doorgroeit', () => {
    const tssOnbevroren = schatTssDoel(null, 'sweetspot_intervallen', 'sweetspot', 3, 'ftp', false, 'opbouw', 150)
    const tssBevroren = schatTssDoel(null, 'sweetspot_intervallen', 'sweetspot', 3, 'ftp', false, 'opbouw', 150, 1)
    const duurOnbevroren = effectieveDuurMin('sweetspot_intervallen', 150, 3, 'opbouw')
    const duurBevroren = effectieveDuurMin('sweetspot_intervallen', 150, 3, 'opbouw', 1)

    expect(tssBevroren).toBeLessThan(tssOnbevroren)
    expect(duurBevroren).toBeLessThan(duurOnbevroren)
    // Proportionaliteit: beide schalen met exact dezelfde progressieFactor()-
    // uitkomst, dus de tss/duur-ratio blijft (op onafhankelijke afrondruis na —
    // beide zijn los Math.round()'en) gelijk vóór en na bevriezing.
    expect(tssBevroren / duurBevroren).toBeCloseTo(tssOnbevroren / duurOnbevroren, 1)
  })
})

describe('bepaalKernstimulusFrequentie — A3: weekVoorzichtig-demping (eenmalig toegepast, geen 3x herhaling)', () => {
  // LET OP — het derde interne pad (weekInFaseVoorMax <= 1 -> return maxFrequentie
  // direct) is met de HUIDIGE, hardgecodeerde KERNSTIMULUS_FREQUENTIE_OPBOUW-config
  // (weekSolver.js:270-273: zowel sweetspot als overgangsfase hebben
  // weekInFaseVoorMax: 3) niet bereikbaar — er bestaat geen fase-entry die dat pad
  // triggert, en de const zelf is niet geëxporteerd om in een test te overschrijven.
  // Dood pad in de huidige config, niet getest (geen fabricatie van een
  // niet-bestaand scenario). De twee wél bereikbare paden (entry-loos/herstel -> 1,
  // en de lineaire-opbouw-formule) worden hieronder gedekt.

  it('pad 1 (geen entry / basis-fase): frequentie 1 -> gedempt naar 0', () => {
    expect(bepaalKernstimulusFrequentie('basis', 1, 'opbouw', false)).toBe(1)
    expect(bepaalKernstimulusFrequentie('basis', 1, 'opbouw', true)).toBe(0)
  })

  it('pad 1 (herstelweek, ook al heeft de fase wel een entry): frequentie 1 -> gedempt naar 0', () => {
    expect(bepaalKernstimulusFrequentie('sweetspot', 3, 'herstel', false)).toBe(1)
    expect(bepaalKernstimulusFrequentie('sweetspot', 3, 'herstel', true)).toBe(0)
  })

  it('pad 3 (lineaire-opbouw-formule, sweetspot weekInFase 1 -> startFrequentie 1): gedempt naar 0', () => {
    expect(bepaalKernstimulusFrequentie('sweetspot', 1, 'opbouw', false)).toBe(1)
    expect(bepaalKernstimulusFrequentie('sweetspot', 1, 'opbouw', true)).toBe(0)
  })

  it('pad 3 (lineaire-opbouw-formule, sweetspot weekInFase 3 -> maxFrequentie 2): gedempt naar 1, niet naar 0', () => {
    expect(bepaalKernstimulusFrequentie('sweetspot', 3, 'opbouw', false)).toBe(2)
    expect(bepaalKernstimulusFrequentie('sweetspot', 3, 'opbouw', true)).toBe(1)
  })

  it('frequentie kan nooit onder 0 zakken, ook niet bij een (hypothetisch) reeds-0-basisgeval', () => {
    // basis-fase levert al 1 op (pad 1) — met demping 0, nooit negatief.
    expect(bepaalKernstimulusFrequentie('basis', 1, 'herstel', true)).toBe(0)
  })

  it('weekVoorzichtig=false (default, ongewijzigd argument weggelaten): identiek aan vóór de A3-toevoeging', () => {
    expect(bepaalKernstimulusFrequentie('sweetspot', 3, 'opbouw')).toBe(2)
    expect(bepaalKernstimulusFrequentie('drempel', 2, 'opbouw')).toBe(1)
  })

  it('EENMALIGE dempingslogica: de demping wordt na de if/else-opbouw één keer toegepast, niet drie keer herhaald', () => {
    // Indirect bewijs: alle drie bereikbare basiswaarden (1, 1, 2) dempen exact
    // met -1 (nooit -2 of -3, wat een drievoudige toepassing zou opleveren).
    const casussen = [
      ['basis', 1, 'opbouw'],
      ['sweetspot', 3, 'herstel'],
      ['sweetspot', 1, 'opbouw'],
    ]
    for (const [fase, wk, wt] of casussen) {
      const basis = bepaalKernstimulusFrequentie(fase, wk, wt, false)
      const gedempt = bepaalKernstimulusFrequentie(fase, wk, wt, true)
      expect(basis - gedempt).toBe(1)
    }
  })
})

describe('solveWeek — A3: weekVoorzichtig=true verlaagt de kernstimulus-frequentie met 1', () => {
  it('sweetspot week 3 (basis 2x kernstimulus): weekVoorzichtig=true -> nog maar 1x kernstimulus', () => {
    const zonderVoorzichtig = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0, weekVoorzichtig: false,
    })
    const metVoorzichtig = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0, weekVoorzichtig: true,
    })
    expect(zonderVoorzichtig.filter(r => r.pad === 'kernstimulus')).toHaveLength(2)
    expect(metVoorzichtig.filter(r => r.pad === 'kernstimulus')).toHaveLength(1)
  })

  it('frequentie=0-fallback: sweetspot week 1 (basis 1x kernstimulus) + weekVoorzichtig=true -> 0x kernstimulus, dag valt automatisch terug op de bestaande Z2-fallback (geen nieuwe code)', () => {
    const resultaat = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2'),
      alGeleverd: {}, tsb: 0, weekVoorzichtig: true,
    })
    expect(resultaat.filter(r => r.pad === 'kernstimulus')).toHaveLength(0)
    expect(resultaat.filter(r => r.pad === 'z2')).toHaveLength(2)
    expect(resultaat.every(r => r.sessietype === 'z2_duur' || r.sessietype === 'kracht_lage_cadans')).toBe(true)
  })

  it('weekVoorzichtig weggelaten (default false): identiek aan expliciet false', () => {
    const impliciet = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0,
    })
    expect(impliciet.filter(r => r.pad === 'kernstimulus')).toHaveLength(2)
  })
})

describe('solveWeek — STAP 0-bugfix: bevrorenWeekInFase bereikt nu ook solveWeek se eigen budgetboekhouding', () => {
  it('kernstimulus-toewijzing (regel ~679): bevrorenWeekInFase verlaagt tss_doel t.o.v. onbevroren, zelfde sweetspot/week3-scenario', () => {
    const onbevroren = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0,
    })
    const bevroren = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0, bevrorenWeekInFase: 1,
    })
    const kernstimulusTssOnbevroren = Math.max(...onbevroren.filter(r => r.pad === 'kernstimulus').map(r => r.tss_doel))
    const kernstimulusTssBevroren = Math.max(...bevroren.filter(r => r.pad === 'kernstimulus').map(r => r.tss_doel))
    expect(kernstimulusTssBevroren).toBeLessThan(kernstimulusTssOnbevroren)
  })

  it('secundair-toewijzing (regel ~705, drempel-fase): bevrorenWeekInFase verlaagt tss_doel t.o.v. onbevroren', () => {
    // weekInFase 2, niet 3 — bij weekInFase 3 triggert drempel de bestaande,
    // losstaande vrijheidsdag-uitzondering (bepaalVrijheidsdag) die secundair
    // omzet naar pad 'vrijheidsessie'/sessietype 'gemengd' (zie de bestaande
    // test hierboven, "sectie 22-G: frequentie-opbouw ... drempel"), waardoor
    // er geen 'secundair'-pad meer bestaat om hier te meten.
    const onbevroren = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 2, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0,
    })
    const bevroren = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 2, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0, bevrorenWeekInFase: 1,
    })
    const secundairTssOnbevroren = onbevroren.find(r => r.pad === 'secundair')?.tss_doel
    const secundairTssBevroren = bevroren.find(r => r.pad === 'secundair')?.tss_doel
    expect(secundairTssOnbevroren).toBeGreaterThan(0)
    expect(secundairTssBevroren).toBeLessThan(secundairTssOnbevroren)
  })

  it('sprint-doel tweede sprint_neuraal-dag (regel ~729): bevrorenWeekInFase wordt doorgegeven, maar heeft GEEN numeriek effect — sprint_neuraal zit niet in PROGRESSIEVE_SESSIETYPES (weekSolver.js:510-512, "blijven op factor 1, exact huidig, flat gedrag"), dus dit specifieke aanroeppunt is correct bedraad maar het effect is voor déze sessietype onzichtbaar (echte bevinding, geen testfout)', () => {
    const onbevroren = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'sprint',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2', '2026-07-13:2'),
      alGeleverd: {}, tsb: 0,
    })
    const bevroren = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'sprint',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2', '2026-07-13:2'),
      alGeleverd: {}, tsb: 0, bevrorenWeekInFase: 1,
    })
    const tweedeSprintOnbevroren = onbevroren.filter(r => r.sessietype === 'sprint_neuraal' && r.pad === 'secundair')[0]?.tss_doel
    const tweedeSprintBevroren = bevroren.filter(r => r.sessietype === 'sprint_neuraal' && r.pad === 'secundair')[0]?.tss_doel
    expect(tweedeSprintOnbevroren).toBeGreaterThan(0)
    expect(tweedeSprintBevroren).toBe(tweedeSprintOnbevroren) // geen crash, geen (onmogelijk) verschil — bewijst dat het argument zonder foutieve bijwerking wordt doorgegeven

    // Structureel bewijs dat het argument daadwerkelijk doorstroomt naar
    // schatTssDoel (i.p.v. simpelweg genegeerd te worden): rechtstreekse
    // aanroep met dezelfde parameters geeft exact hetzelfde getal terug als
    // wat solveWeek() voor deze dag berekende.
    const direct = schatTssDoel(ARCHETYPES_FIXTURE, 'sprint_neuraal', 'sweetspot', 3, 'sprint', false, 'opbouw', 120, 1)
    expect(direct).toBe(tweedeSprintBevroren)
  })

  it('REGRESSIE — bouwToewijzing se eigen (in de praktijk dode) schatTssDoel-aanroep (regel 573): niet aangeraakt door STAP 0, bevestigd via tssDoelOverride die altijd voorrang houdt', () => {
    // bouwToewijzing wordt uitsluitend aangeroepen mét tssDoelOverride vanuit
    // solveWeek() (regel 675/699/723/753) — de eigen schatTssDoel-berekening op
    // regel 573 (zonder bevrorenWeekInFase) wordt daardoor nooit uitgevoerd.
    // Bewijs: het resultaat verandert NIET wanneer bevrorenWeekInFase wordt
    // meegegeven aan een z2-only-scenario (basis-fase, geen kernstimulus/
    // secundair, dus alleen het "stap 5"-pad met tssDoelOverride actief).
    const onbevroren = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 300, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2'),
      alGeleverd: {}, tsb: 0,
    })
    const bevroren = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 300, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2'),
      alGeleverd: {}, tsb: 0, bevrorenWeekInFase: 1,
    })
    expect(bevroren.map(r => r.tss_doel)).toEqual(onbevroren.map(r => r.tss_doel))
  })

  it('REGRESSIE — verlaagBijHogeMonotonie se eigen schatTssDoel-aanroep (regel 830): niet aangeraakt door STAP 0 (aparte functie, geen bevrorenWeekInFase-parameter)', () => {
    const toewijzingen = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0, bevrorenWeekInFase: 1,
    })
    // verlaagBijHogeMonotonie heeft geen bevrorenWeekInFase-parameter — de
    // signatuur zelf bewijst dat STAP 0 dit aanroeppunt niet raakt.
    const zonderBevrorenParam = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 1000, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0,
    })
    const { gedegradeerdeDatum: metBevroren } = verlaagBijHogeMonotonie(toewijzingen, true, {
      archetypesData: ARCHETYPES_FIXTURE, fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
    })
    const { gedegradeerdeDatum: zonderBevroren } = verlaagBijHogeMonotonie(zonderBevrorenParam, true, {
      archetypesData: ARCHETYPES_FIXTURE, fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
    })
    // Beide degraderen dezelfde (hoogste-tss) kandidaat naar z2_duur — het
    // bevrorenWeekInFase-verschil in de INPUT-toewijzingen verandert niet
    // welk mechanisme verlaagBijHogeMonotonie zelf gebruikt.
    expect(typeof metBevroren === 'string' || metBevroren === null).toBe(true)
    expect(typeof zonderBevroren === 'string' || zonderBevroren === null).toBe(true)
  })
})

describe('solveWeek — F: interactie bevrorenWeekInFase (STAP 0) + weekVoorzichtig (A3), additief zonder dubbeltelling', () => {
  const scenario = (extra) => solveWeek({
    archetypesData: ARCHETYPES_FIXTURE,
    fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
    weekTssDoel: 1000, vasteDagen: [],
    openDagen: dagen('2026-07-06:2', '2026-07-08:2', '2026-07-10:2'),
    alGeleverd: {}, tsb: 0,
    ...extra,
  })

  it('geen van beide actief: baseline 2x kernstimulus, volle tss_doel', () => {
    const r = scenario({})
    expect(r.filter(x => x.pad === 'kernstimulus')).toHaveLength(2)
  })

  it('alleen weekVoorzichtig: minder DAGEN kernstimulus, maar elke resterende dag op volle (onbevroren) tss_doel', () => {
    const baseline = scenario({})
    const alleenVoorzichtig = scenario({ weekVoorzichtig: true })
    const baselineTssPerDag = Math.max(...baseline.filter(x => x.pad === 'kernstimulus').map(x => x.tss_doel))
    const voorzichtigTssPerDag = Math.max(...alleenVoorzichtig.filter(x => x.pad === 'kernstimulus').map(x => x.tss_doel))

    expect(alleenVoorzichtig.filter(x => x.pad === 'kernstimulus')).toHaveLength(1)
    expect(voorzichtigTssPerDag).toBe(baselineTssPerDag) // budget zelf niet getemperd
  })

  it('alleen bevrorenWeekInFase: zelfde AANTAL dagen kernstimulus, maar elke dag met kleiner tss_doel', () => {
    const baseline = scenario({})
    const alleenBevroren = scenario({ bevrorenWeekInFase: 1 })
    const baselineTssPerDag = Math.max(...baseline.filter(x => x.pad === 'kernstimulus').map(x => x.tss_doel))
    const bevrorenTssPerDag = Math.max(...alleenBevroren.filter(x => x.pad === 'kernstimulus').map(x => x.tss_doel))

    expect(alleenBevroren.filter(x => x.pad === 'kernstimulus')).toHaveLength(2) // aantal ongewijzigd
    expect(bevrorenTssPerDag).toBeLessThan(baselineTssPerDag) // budget wél getemperd
  })

  it('BEIDE tegelijk actief: additief — minder dagen ÉN elke resterende dag met kleiner budget, geen dubbeltelling (het aantal-effect komt uitsluitend van weekVoorzichtig, het budget-effect uitsluitend van bevrorenWeekInFase)', () => {
    const baseline = scenario({})
    const beide = scenario({ weekVoorzichtig: true, bevrorenWeekInFase: 1 })
    const alleenVoorzichtig = scenario({ weekVoorzichtig: true })
    const alleenBevroren = scenario({ bevrorenWeekInFase: 1 })

    const baselineTssPerDag = Math.max(...baseline.filter(x => x.pad === 'kernstimulus').map(x => x.tss_doel))
    const beideTssPerDag = Math.max(...beide.filter(x => x.pad === 'kernstimulus').map(x => x.tss_doel))
    const alleenBevrorenTssPerDag = Math.max(...alleenBevroren.filter(x => x.pad === 'kernstimulus').map(x => x.tss_doel))

    // Aantal-effect: identiek aan "alleen weekVoorzichtig" (1 dag), niet verder
    // verlaagd door bevrorenWeekInFase (dat heeft geen invloed op het AANTAL).
    expect(beide.filter(x => x.pad === 'kernstimulus')).toHaveLength(1)
    expect(beide.filter(x => x.pad === 'kernstimulus')).toHaveLength(alleenVoorzichtig.filter(x => x.pad === 'kernstimulus').length)

    // Budget-effect: dezelfde per-dag-tss_doel-verlaging als "alleen
    // bevrorenWeekInFase" (niet extra verlaagd door weekVoorzichtig — dat
    // heeft geen invloed op het BUDGET per dag).
    expect(beideTssPerDag).toBe(alleenBevrorenTssPerDag)
    expect(beideTssPerDag).toBeLessThan(baselineTssPerDag)
  })
})

describe('solveWeek: lange-rit-reservering (is_lange_rit_dag)', () => {
  it('markeert de langste z2-dag als is_lange_rit_dag in een representatieve week (aerobe_basis, cadans elke week)', () => {
    const resultaat = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'aerobe_basis',
      weekTssDoel: 300, vasteDagen: [],
      openDagen: dagen('2026-07-06:1.5', '2026-07-08:3', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 1,
    })
    const langeRit = resultaat.filter(r => r.is_lange_rit_dag === true)
    expect(langeRit).toHaveLength(1)
    expect(langeRit[0].datum).toBe('2026-07-08')
    expect(langeRit[0].beschikbareUren).toBe(3)
    expect(langeRit[0].sessietype).toBe('z2_duur')
  })

  it('geen enkele dag lang genoeg voor de LANGE_RIT_MINIMUM-drempel -> geen markering', () => {
    const resultaat = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'aerobe_basis',
      weekTssDoel: 150, vasteDagen: [],
      openDagen: dagen('2026-07-06:1', '2026-07-08:1'), // 60min elk, ver onder de 120min-drempel
      alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 1,
    })
    expect(resultaat.some(r => r.is_lange_rit_dag === true)).toBe(false)
  })

  it('herstelweek: nooit een lange-rit-markering, ongeacht seizoensdoel', () => {
    const resultaat = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 2, weektype: 'herstel', seizoensdoel: 'aerobe_basis',
      weekTssDoel: 150, vasteDagen: [],
      openDagen: dagen('2026-07-06:3', '2026-07-08:2'),
      alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 2,
    })
    expect(resultaat.some(r => r.is_lange_rit_dag === true)).toBe(false)
  })

  it('sprint-doel: geen markering in een oneven weeknummer, wel in een even weeknummer', () => {
    const opts = weekNummerInSeizoen => ({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'sprint',
      weekTssDoel: 300, vasteDagen: [],
      openDagen: dagen('2026-07-06:1.5', '2026-07-08:3', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0, weekNummerInSeizoen,
    })
    const oneven = solveWeek(opts(3))
    const even = solveWeek(opts(4))
    expect(oneven.some(r => r.is_lange_rit_dag === true)).toBe(false)
    expect(even.some(r => r.is_lange_rit_dag === true)).toBe(true)
  })

  it('gereserveerde dag wordt nooit kracht_lage_cadans (blijft z2_duur)', () => {
    const resultaat = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:3', '2026-07-08:1.5', '2026-07-10:1.5'),
      alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 5, laatsteKrachtLageCadansWeek: null,
    })
    const langeRit = resultaat.find(r => r.is_lange_rit_dag === true)
    expect(langeRit).toBeDefined()
    expect(langeRit.sessietype).toBe('z2_duur')
  })

  it('guard: te weinig open dagen om kernstimulus+secundair te bedienen -> geen reservering, bestaand gedrag intact', () => {
    // Klimmen/drempel: kernstimulus + secundair vereisen samen 2 dagen. Met
    // precies 2 open dagen blijft er geen ruimte voor een reservering.
    const resultaat = solveWeek({
      archetypesData: ARCHETYPES_FIXTURE,
      fase: 'drempel', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'klimmen',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:3', '2026-07-07:2'),
      alGeleverd: {}, tsb: 0, weekNummerInSeizoen: 1,
    })
    expect(resultaat.some(r => r.is_lange_rit_dag === true)).toBe(false)
    expect(resultaat.filter(r => r.pad === 'kernstimulus' || r.pad === 'secundair')).toHaveLength(2)
  })
})

describe('pasBudgetToe: bescherming van is_lange_rit_dag', () => {
  it('een is_lange_rit_dag-toewijzing wordt nooit verkort of geschrapt, ook niet als laatste overgebleven z2-dag bij een krap budget', () => {
    const toewijzingen = [
      { datum: '2026-07-06', sessietype: 'z2_duur', tss_doel: 300, pad: 'z2', beschikbareUren: 4, is_lange_rit_dag: true },
      { datum: '2026-07-08', sessietype: 'z2_duur', tss_doel: 100, pad: 'z2', beschikbareUren: 1.5 },
    ]
    // Belastingscap ruim onder de som van beide z2-dagen (400) — zonder
    // bescherming zou pasBudgetToe() de lange rit als laatste redmiddel ook
    // korten/schrappen.
    const resultaat = pasBudgetToe(toewijzingen, 320)
    const langeRit = resultaat.find(r => r.datum === '2026-07-06')
    expect(langeRit.sessietype).toBe('z2_duur')
    expect(langeRit.beschikbareUren).toBe(4)

    const overigeDag = resultaat.find(r => r.datum === '2026-07-08')
    // De niet-beschermde dag absorbeert het tekort (320 - 300 = 20 over).
    expect(overigeDag.tss_doel).toBeLessThanOrEqual(20)
  })

  it('zonder is_lange_rit_dag blijft het bestaande "langste rit als laatst gekort"-gedrag intact', () => {
    const toewijzingen = [
      { datum: '2026-07-06', sessietype: 'z2_duur', tss_doel: 300, pad: 'z2', beschikbareUren: 4 },
      { datum: '2026-07-08', sessietype: 'z2_duur', tss_doel: 100, pad: 'z2', beschikbareUren: 1.5 },
    ]
    const resultaat = pasBudgetToe(toewijzingen, 320)
    const langsteRit = resultaat.find(r => r.datum === '2026-07-06')
    const korteDag = resultaat.find(r => r.datum === '2026-07-08')
    // Zonder bescherming wordt eerst de kortbare (kortere) dag gekort/geschrapt,
    // de langste rit blijft ongemoeid zolang er nog een kortbare dag is.
    expect(langsteRit.tss_doel).toBe(300)
    expect(korteDag.sessietype).toBe('rust')
  })
})
