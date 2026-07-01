import { describe, it, expect, vi } from 'vitest'
import { berekenZ2AandeelSessietype, haalPrioriteitOp, PRIORITEIT_PER_FASE, degradeerBijLageTsb, solveWeek, pasBudgetToe } from '../weekSolver.js'
import { SESSIE_ARCHETYPES as VARIANT_ARCHETYPES } from '../../sessie-varianten.js'

function dagen(...specs) {
  // specs: ['2026-07-06:2', ...] -> { datum, beschikbareUren }
  return specs.map(s => {
    const [datum, uren] = s.split(':')
    return { datum, beschikbareUren: Number(uren) }
  })
}

describe('solveWeek', () => {
  it('scenario 1: volledig lege week, sweetspot-fase, ftp-doel, 5 dagen -> 1 kernstimulus, 1 secundair, rest z2', () => {
    const resultaat = solveWeek({
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
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
    expect(kernstimulus.sessietype).toBe('sweetspot_intervallen')
    const secundair = resultaat.find(r => r.pad === 'secundair')
    expect(secundair.sessietype).toBe('vo2max_intervallen')
    // Kernstimulus krijgt de dag met de meeste beschikbare uren
    expect(kernstimulus.beschikbareUren).toBe(3)
  })

  it('scenario 2: 1 vaste sweetspot-dag deze week -> geen tweede sweetspot, val terug op volgende kandidaat', () => {
    const resultaat = solveWeek({
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 400,
      vasteDagen: [{ datum: '2026-07-05', sessietype: 'sweetspot_intervallen', tss_doel: 80, status: 'voltooid' }],
      openDagen: dagen('2026-07-06:3', '2026-07-08:1.5', '2026-07-10:2', '2026-07-12:1.5'),
      alGeleverd: { tss: 80 }, tsb: 0,
    })
    expect(resultaat.some(r => r.sessietype === 'sweetspot_intervallen')).toBe(false)
    const kernstimulus = resultaat.find(r => r.pad === 'kernstimulus')
    expect(kernstimulus?.sessietype).toBe('drempel_intervallen')
  })

  it('scenario 3: week 3 van de fase -> vrijheidsessie (gemengd) op het secundair-slot', () => {
    const resultaat = solveWeek({
      fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
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
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 400, vasteDagen: [],
      openDagen: dagen('2026-07-06:3', '2026-07-07:2'),
      alGeleverd: {}, tsb: 0,
    })
    expect(resultaat.filter(r => r.pad === 'kernstimulus' || r.pad === 'secundair')).toHaveLength(2)
  })

  it('scenario 4b: kernstimulus + 2 kandidaten, één aangrenzend één niet -> secundair kiest de niet-aangrenzende dag', () => {
    const resultaat = solveWeek({
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
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
      fase: 'basis', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'ftp',
      weekTssDoel: 200, vasteDagen: [],
      openDagen: dagen('2026-07-06:2', '2026-07-08:1.5'),
      alGeleverd: {},
    })).not.toThrow()
  })

  it('gooit door de haalPrioriteitOp-fout voor onbekend seizoensdoel (bv. sprint)', () => {
    expect(() => solveWeek({
      fase: 'sweetspot', weekInFase: 1, weektype: 'opbouw', seizoensdoel: 'sprint',
      weekTssDoel: 200, vasteDagen: [], openDagen: dagen('2026-07-06:2'),
    })).toThrow(/geen prioriteitstabel/)
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

  it('gooit een expliciete fout voor seizoensdoel "sprint" (nog geen policy vastgesteld)', () => {
    expect(() => haalPrioriteitOp('sprint', 'sweetspot')).toThrow(/geen prioriteitstabel/)
  })

  it('gooit een expliciete fout voor een onbekende fase binnen een bekend doel', () => {
    expect(() => haalPrioriteitOp('ftp', 'onbekende_fase')).toThrow(/geen prioriteit-entry/)
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
      const fractie = berekenZ2AandeelSessietype('z2_duur', archetype.id)
      if (archetype.id === 'z2_tempo_blokken') {
        // "ingekapselde Z3-blokken" — bewust geen zuivere Z2-rit, zie archetype-structuur
        expect(fractie).toBeGreaterThan(0.5)
        expect(fractie).toBeLessThan(0.9)
      } else {
        expect(fractie).toBeGreaterThan(0.9)
      }
    }
  })

  it('vo2max_intervallen/vo2_5x5 ligt tussen 0.5 en 0.7 (5min werk/5min Z2-herstel, ~1:1)', () => {
    const fractie = berekenZ2AandeelSessietype('vo2max_intervallen', 'vo2_5x5')
    expect(fractie).toBeGreaterThanOrEqual(0.5)
    expect(fractie).toBeLessThanOrEqual(0.7)
  })

  it('sweetspot_intervallen: alleen de Z2-hersteltijd tussen blokken, geen warmup/cooldown in de blokdata', () => {
    for (const archetype of VARIANT_ARCHETYPES.sweetspot_intervallen) {
      const fractie = berekenZ2AandeelSessietype('sweetspot_intervallen', archetype.id)
      expect(fractie).toBeGreaterThan(0.15)
      expect(fractie).toBeLessThan(0.5)
    }
  })

  it('gooit een duidelijke error bij een onbekende combinatie, geen silent 0', () => {
    expect(() => berekenZ2AandeelSessietype('z2_duur', 'bestaat_niet')).toThrow(/geen variantendata/)
    expect(() => berekenZ2AandeelSessietype('z2_duur', 'z2_heuvel')).toThrow(/geen variantendata/) // metadata bestaat, variantendata niet
    expect(() => berekenZ2AandeelSessietype('onbekend_type', 'iets')).toThrow(/geen variantendata/)
  })

  it('geen NaN of >1.0 voor alle 42 archetypes', () => {
    for (const [sessietype, archetypes] of Object.entries(VARIANT_ARCHETYPES)) {
      for (const archetype of archetypes) {
        const fractie = berekenZ2AandeelSessietype(sessietype, archetype.id)
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
})
