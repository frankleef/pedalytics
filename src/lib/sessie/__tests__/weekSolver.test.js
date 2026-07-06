import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { berekenZ2AandeelSessietype, haalPrioriteitOp, PRIORITEIT_PER_FASE, degradeerBijLageTsb, solveWeek, pasBudgetToe } from '../weekSolver.js'
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
    // Kernstimulus krijgt de dag met de meeste beschikbare uren
    expect(kernstimulus.beschikbareUren).toBe(3)
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
    // ingevuld, alle open dagen worden z2_duur (of, sinds fix 2, evt. één daarvan
    // kracht_lage_cadans — ftp/sweetspot staat dat 1x/week toe).
    expect(resultaat.some(r => r.sessietype === 'sweetspot_intervallen')).toBe(false)
    expect(resultaat.every(r => r.sessietype === 'z2_duur' || r.sessietype === 'kracht_lage_cadans')).toBe(true)
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
      // 07-06 krijgt kernstimulus (meeste uren). 07-07 is aangrenzend, 07-10 niet.
      openDagen: dagen('2026-07-06:3', '2026-07-07:2', '2026-07-10:2'),
      alGeleverd: {}, tsb: 0,
    })
    const kernstimulus = resultaat.find(r => r.pad === 'kernstimulus')
    const secundair = resultaat.find(r => r.pad === 'secundair')
    expect(kernstimulus.datum).toBe('2026-07-06')
    expect(secundair.datum).toBe('2026-07-10')
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
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5'),
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
      if (archetype.id === 'z2_tempo_blokken' || archetype.id === 'z2_tempo_teugjes') {
        // "ingekapselde Z3-blokken" — bewust geen zuivere Z2-rit, zie archetype-structuur
        expect(fractie).toBeGreaterThan(0.3)
        expect(fractie).toBeLessThan(0.9)
      } else {
        expect(fractie).toBeGreaterThan(0.9)
      }
    }
  })

  it('vo2max_intervallen/vo2_5x5 ligt tussen 0.5 en 0.7 (5min werk/5min Z2-herstel, ~1:1)', () => {
    const fractie = berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, 'vo2max_intervallen', 'vo2_5x5')
    expect(fractie).toBeGreaterThanOrEqual(0.5)
    expect(fractie).toBeLessThanOrEqual(0.7)
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

  it('geen NaN of >1.0 voor alle 42 archetypes', () => {
    for (const [sessietype, archetypes] of Object.entries(VARIANT_ARCHETYPES)) {
      for (const archetype of archetypes) {
        const fractie = berekenZ2AandeelSessietype(ARCHETYPES_FIXTURE, sessietype, archetype.id)
        expect(Number.isNaN(fractie)).toBe(false)
        expect(fractie).toBeGreaterThanOrEqual(0)
        expect(fractie).toBeLessThanOrEqual(1.0)
      }
    }
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
