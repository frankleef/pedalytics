import { describe, it, expect } from 'vitest'
import { rollendGemiddelde, vindAaneengeslotenPeriodes } from '../reeksAnalyse.js'
import { I166071231_WATTS_VENSTER } from './fixtures/i166071231WattsFixture.js'

describe('rollendGemiddelde', () => {
  it('correct rollend gemiddelde op een simpele, handmatig doorgerekende reeks', () => {
    const reeks = [10, 20, 30, 40, 50]
    // venster 3: [10,20,30]->20, [20,30,40]->30, [30,40,50]->40
    expect(rollendGemiddelde(reeks, 3)).toEqual([20, 30, 40])
  })

  it('venster 1: identiek aan de invoer', () => {
    expect(rollendGemiddelde([5, 8, 3], 1)).toEqual([5, 8, 3])
  })

  it('lege array of reeks korter dan het venster: lege output (fail-open, geen crash)', () => {
    expect(rollendGemiddelde([], 5)).toEqual([])
    expect(rollendGemiddelde([1, 2], 5)).toEqual([])
    expect(rollendGemiddelde(null, 5)).toEqual([])
    expect(rollendGemiddelde(undefined, 5)).toEqual([])
  })

  it('reeks exact zo lang als het venster: precies 1 output-punt', () => {
    expect(rollendGemiddelde([1, 2, 3], 3)).toEqual([2])
  })

  it('E1-regressie: rollendGemiddelde(watts, 30) reproduceert byte-voor-byte npClient (VoortgangTab.js) se OORSPRONKELIJKE, niet-geëxtraheerde rollend-gemiddelde-lus — VoortgangTab.js zelf bevat JSX en kan niet rechtstreeks in vitest geïmporteerd worden (geen precedent hiervoor in dit project, geen bestaand .js-component-bestand met JSX wordt elders getest), dus deze equivalentietest bewijst de extractie op het niveau van de geëxtraheerde logica zelf', () => {
    function npClientRollendeLusOrigineel(watts) {
      // Letterlijke kopie van VoortgangTab.js's npClient() VÓÓR de
      // rollendGemiddelde-extractie (regel 74-80 in de oude vorm).
      if (!watts?.length || watts.length < 30) return null
      const rolling = []
      for (let i = 29; i < watts.length; i++) {
        let som = 0
        for (let j = i - 29; j <= i; j++) som += watts[j]
        rolling.push(som / 30)
      }
      return rolling
    }

    const reeksen = [
      Array.from({ length: 150 }, (_, i) => 200 + Math.round(40 * Math.sin(i / 5)) + (i % 11)),
      Array(45).fill(230),
      [1, 2, 3],
      [],
    ]
    for (const watts of reeksen) {
      const oud = npClientRollendeLusOrigineel(watts) ?? []
      expect(rollendGemiddelde(watts, 30)).toEqual(oud)
    }
  })
})

describe('vindAaneengeslotenPeriodes', () => {
  it('vindt één periode die exact de minimale duur haalt', () => {
    const reeks = [10, 10, 10, 5, 5]
    expect(vindAaneengeslotenPeriodes(reeks, 10, 3)).toEqual([{ start: 0, eind: 3, duurSeconden: 3 }])
  })

  it('filtert periodes korter dan de minimale duur eruit', () => {
    const reeks = [10, 10, 5, 10, 10, 10, 10, 5]
    // periode 1: idx 0-2 (lengte 2, te kort bij minDuur=3) -> uitgefilterd
    // periode 2: idx 3-7 (lengte 4) -> behouden
    expect(vindAaneengeslotenPeriodes(reeks, 10, 3)).toEqual([{ start: 3, eind: 7, duurSeconden: 4 }])
  })

  it('een periode die tot het einde van de reeks doorloopt wordt correct afgesloten', () => {
    const reeks = [5, 10, 10, 10, 10]
    expect(vindAaneengeslotenPeriodes(reeks, 10, 4)).toEqual([{ start: 1, eind: 5, duurSeconden: 4 }])
  })

  it('meerdere, gescheiden periodes worden allemaal gevonden', () => {
    const reeks = [10, 10, 10, 0, 0, 10, 10, 10]
    expect(vindAaneengeslotenPeriodes(reeks, 10, 3)).toEqual([
      { start: 0, eind: 3, duurSeconden: 3 },
      { start: 5, eind: 8, duurSeconden: 3 },
    ])
  })

  it('lege reeks: geen periodes, geen crash', () => {
    expect(vindAaneengeslotenPeriodes([], 10, 3)).toEqual([])
    expect(vindAaneengeslotenPeriodes(null, 10, 3)).toEqual([])
  })

  it('drempel === waarde telt mee (>=, niet strikt >)', () => {
    expect(vindAaneengeslotenPeriodes([10, 10, 10], 10, 3)).toEqual([{ start: 0, eind: 3, duurSeconden: 3 }])
  })
})

describe('i166071231-scenario: een lange, aaneengesloten hoge periode die intervals.icu se lap-detectie ten onrechte in stukken knipte', () => {
  // Live geverifieerd venster (seconde 799-1600 van activiteit i166071231):
  // intervals.icu se EIGEN icu_intervals-lap-detectie knipte dit in drie
  // stukken — WORK 799-961 (162s), RECOVERY 961-1026 (65s), WORK 1026-1601
  // (575s) — terwijl de ruwe data geen aanhoudende terugval toont (vermogen
  // blijft grotendeels 190-290W, zie ook de eerdere trace-rapportage).
  it('rollendGemiddelde(venster=60) + vindAaneengeslotenPeriodes(drempel=205 [Z3-ondergrens], minDuur=120) herkent dit als ÉÉN doorlopende periode, niet drie fragmenten die de lap-grenzen volgen', () => {
    const rollend = rollendGemiddelde(I166071231_WATTS_VENSTER, 60)
    expect(rollend).toHaveLength(I166071231_WATTS_VENSTER.length - 59) // 802 - 59 = 743

    const periodes = vindAaneengeslotenPeriodes(rollend, 205, 120)

    // Precies 1 periode -- NIET 3 (wat een lap-grens-volgende fragmentatie
    // zou opleveren: ~162, ~65 losgevallen wegens te kort, ~575).
    expect(periodes).toHaveLength(1)
    expect(periodes[0].duurSeconden).toBeGreaterThan(600) // ruim boven elk van de drie individuele lap-duren
    // De ene periode beslaat het overgrote deel van het venster (682 van de
    // 743 rollend-gemiddelde-punten) -- bevestigt dat de korte dip rond
    // seconde 54-59 (een paar seconden bijna-nul, zie de fixture) door het
    // 60-seconden-rollend-gemiddelde wordt opgevangen en niet als een echte
    // onderbreking wordt gezien.
    expect(periodes[0]).toEqual({ start: 0, eind: 682, duurSeconden: 682 })
  })
})
