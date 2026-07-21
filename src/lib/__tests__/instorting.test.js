import { describe, it, expect, vi } from 'vitest'
import { detecteerMogelijkeInstorting, leesRecenteInstortingen } from '../instorting.js'

describe('detecteerMogelijkeInstorting — fail-open randgevallen (beslissing 12)', () => {
  it('geen werk-segmenten: null, geen crash', () => {
    const segmenten = [{ type: 'herstel', blokDuurSeconden: 300, vermogenMin: 100, vermogenMax: 120 }]
    expect(detecteerMogelijkeInstorting([1, 2, 3], segmenten)).toBeNull()
  })

  it('lege/ontbrekende watts-reeks: null, geen crash', () => {
    const segmenten = [{ type: 'werk', blokDuurSeconden: 300, vermogenMin: 200, vermogenMax: 220 }]
    expect(detecteerMogelijkeInstorting([], segmenten)).toBeNull()
    expect(detecteerMogelijkeInstorting(null, segmenten)).toBeNull()
  })

  it('ontbrekende segmenten: null, geen crash', () => {
    expect(detecteerMogelijkeInstorting([1, 2, 3], null)).toBeNull()
    expect(detecteerMogelijkeInstorting([1, 2, 3], [])).toBeNull()
  })
})

describe('detecteerMogelijkeInstorting — per-werk-segment-doelzone (ss_oplopend-achtig: verschillend vermogenMin per segment)', () => {
  // Twee werk-segmenten met VERSCHILLEND vermogenMin (180 vs. 220), gescheiden
  // door een herstelblok — exact het ss_oplopend/ss_afdalend-patroon
  // (sessie-varianten.js) waarbij één ritbrede doelzone fout zou zijn.
  const segmenten = [
    { type: 'werk', blokDuurSeconden: 300, vermogenMin: 180, vermogenMax: 200 },
    { type: 'herstel', blokDuurSeconden: 60, vermogenMin: 100, vermogenMax: 120 },
    { type: 'werk', blokDuurSeconden: 300, vermogenMin: 220, vermogenMax: 240 },
  ]

  it('190W gehouden: haalt het EERSTE segment se doel (180) maar NIET het TWEEDE se (hogere) doel (220) — telt alleen mee voor het eerste', () => {
    const watts = [
      ...Array(300).fill(190), // segment 1 (doel 180): 190 >= 180 -> voldoet
      ...Array(60).fill(100),  // herstelblok, buiten de werk-analyse
      ...Array(300).fill(200), // segment 2 (doel 220): 200 < 220 -> voldoet NIET
    ]
    const resultaat = detecteerMogelijkeInstorting(watts, segmenten)
    // Handmatig doorgerekend (rollend gemiddelde venster 60, min. periode 120s):
    // segment 1 levert 241s tijd-in-zone op, segment 2 levert 0s op.
    expect(resultaat.totaleTijdInZoneSeconden).toBe(241)
    expect(resultaat.totaalGeplandSeconden).toBe(600)
  })

  it('ter vergelijking: dezelfde 200W in segment 2 zou WEL voldoen als het (foutief) tegen segment 1 se lagere doel (180) getoetst was — bevestigt dat de per-segment-zone daadwerkelijk het verschil maakt', () => {
    const eenRitbredeZone = [{ type: 'werk', blokDuurSeconden: 300, vermogenMin: 180, vermogenMax: 200 }]
    const watts200 = Array(300).fill(200)
    const metLageZone = detecteerMogelijkeInstorting(watts200, eenRitbredeZone)
    expect(metLageZone.totaleTijdInZoneSeconden).toBeGreaterThan(0) // 200 >= 180, zou hier WEL tellen
  })
})

describe('detecteerMogelijkeInstorting — beslissing 6: vroege-geslaagde-periode-vereiste (Frank se eigen scenario: bewust een duurrit vanaf het begin, geen vroege zware poging)', () => {
  const segmenten = [
    { type: 'werk', blokDuurSeconden: 300, vermogenMin: 220, vermogenMax: 240 },
    { type: 'herstel', blokDuurSeconden: 60, vermogenMin: 100, vermogenMax: 120 },
    { type: 'werk', blokDuurSeconden: 300, vermogenMin: 220, vermogenMax: 240 },
  ]

  it('constant, laag vermogen vanaf seconde 0 (nooit het doel gehaald, ook niet vroeg): mogelijkIngestort blijft FALSE ondanks 0% tijd-in-zone', () => {
    const watts = Array(660).fill(150) // nooit >= 220, ook niet in segment 1
    const resultaat = detecteerMogelijkeInstorting(watts, segmenten)
    expect(resultaat.totaleTijdInZoneSeconden).toBe(0)
    expect(resultaat.totaalGeplandSeconden).toBe(600)
    // Kern van deze test: LAAG tijd-in-zone-percentage (0%, ruim onder de
    // 50%-drempel) triggert NIET automatisch mogelijkIngestort — zonder een
    // bewezen vroege, serieuze poging is een laag percentage net zo goed
    // verklaarbaar als "dit was altijd al een rustige rit", niet als
    // instorting.
    expect(resultaat.mogelijkIngestort).toBe(false)
    expect(resultaat.waarschijnlijkIngestort).toBe(false)
  })

  it('ter vergelijking: WEL een vroege geslaagde periode + laag totaal -> mogelijkIngestort WORDT true', () => {
    const watts = [
      ...Array(300).fill(230), // segment 1: WEL geslaagd (230 >= 220)
      ...Array(60).fill(100),
      ...Array(300).fill(150), // segment 2: ingestort (150 < 220)
    ]
    const resultaat = detecteerMogelijkeInstorting(watts, segmenten)
    expect(resultaat.mogelijkIngestort).toBe(true)
  })
})

describe('detecteerMogelijkeInstorting — beslissing 7: decoupling-boost (i166071231-scenario)', () => {
  const segmenten = [
    { type: 'werk', blokDuurSeconden: 300, vermogenMin: 220, vermogenMax: 240 },
    { type: 'herstel', blokDuurSeconden: 60, vermogenMin: 100, vermogenMax: 120 },
    { type: 'werk', blokDuurSeconden: 300, vermogenMin: 220, vermogenMax: 240 },
  ]
  // Zelfde ingestort-patroon als hierboven: vroege succesvolle periode
  // (230W), daarna instorting (150W) — mogelijkIngestort is hier al true.
  const wattsIngestort = [...Array(300).fill(230), ...Array(60).fill(100), ...Array(300).fill(150)]

  it('decouplingWaarde = 28.533434 (i166071231 se daadwerkelijke, live opgehaalde whole-ride decoupling): boost naar waarschijnlijkIngestort', () => {
    const resultaat = detecteerMogelijkeInstorting(wattsIngestort, segmenten, 28.533434)
    expect(resultaat.mogelijkIngestort).toBe(true)
    expect(resultaat.waarschijnlijkIngestort).toBe(true)
  })

  it('decouplingWaarde = 7 (exact op de drempel, niet erboven): GEEN boost (strikte >, zelfde grensconventie als checkFaseOvergang)', () => {
    const resultaat = detecteerMogelijkeInstorting(wattsIngestort, segmenten, 7)
    expect(resultaat.mogelijkIngestort).toBe(true)
    expect(resultaat.waarschijnlijkIngestort).toBe(false)
  })

  it('decouplingWaarde = null (onbekend/niet beschikbaar): geen boost, geen crash — mogelijkIngestort blijft wel staan', () => {
    const resultaat = detecteerMogelijkeInstorting(wattsIngestort, segmenten, null)
    expect(resultaat.mogelijkIngestort).toBe(true)
    expect(resultaat.waarschijnlijkIngestort).toBe(false)
  })

  it('decouplingWaarde hoog, maar mogelijkIngestort was al false: waarschijnlijkIngestort blijft ook false (geen boost zonder basispatroon)', () => {
    const wattsGoedeRit = Array(660).fill(230) // consistent op doel, geen instorting
    const resultaat = detecteerMogelijkeInstorting(wattsGoedeRit, segmenten, 28.5)
    expect(resultaat.mogelijkIngestort).toBe(false)
    expect(resultaat.waarschijnlijkIngestort).toBe(false)
  })
})

describe('leesRecenteInstortingen (Blok F, fase 1: batch-lezer via kv.mget)', () => {
  it('lege activiteitIds: geeft [] terug zonder kv.mget aan te roepen', async () => {
    const kv = { mget: vi.fn() }
    const resultaat = await leesRecenteInstortingen(kv, 'u1', [])
    expect(resultaat).toEqual([])
    expect(kv.mget).not.toHaveBeenCalled()
  })

  it('fail-open: één of meer ontbrekende keys (kv.mget geeft null op die positie) worden gefilterd, geen crash', async () => {
    const instortingA = { mogelijkIngestort: true, waarschijnlijkIngestort: false }
    // 'act2' is een niet-geanalyseerde duurrit -> kv.mget geeft null op die positie.
    const kv = { mget: vi.fn(async (...keys) => keys.map(k => (k === 'segment_instorting:u1:act1' ? instortingA : null))) }

    const resultaat = await leesRecenteInstortingen(kv, 'u1', ['act1', 'act2'])

    expect(kv.mget).toHaveBeenCalledWith('segment_instorting:u1:act1', 'segment_instorting:u1:act2')
    expect(resultaat).toEqual([{ activiteitId: 'act1', instorting: instortingA }])
  })

  it('fail-open: een falende kv.mget (bv. netwerkfout) geeft [] terug i.p.v. te crashen', async () => {
    const kv = { mget: vi.fn(async () => { throw new Error('kv onbereikbaar') }) }
    const resultaat = await leesRecenteInstortingen(kv, 'u1', ['act1', 'act2'])
    expect(resultaat).toEqual([])
  })

  it('alle keys aanwezig: geeft alle instortingen terug, in dezelfde volgorde als activiteitIds', async () => {
    const instortingA = { mogelijkIngestort: false, waarschijnlijkIngestort: false }
    const instortingB = { mogelijkIngestort: true, waarschijnlijkIngestort: true }
    const kv = {
      mget: vi.fn(async (...keys) => keys.map(k => {
        if (k === 'segment_instorting:u1:act1') return instortingA
        if (k === 'segment_instorting:u1:act2') return instortingB
        return null
      })),
    }
    const resultaat = await leesRecenteInstortingen(kv, 'u1', ['act1', 'act2'])
    expect(resultaat).toEqual([
      { activiteitId: 'act1', instorting: instortingA },
      { activiteitId: 'act2', instorting: instortingB },
    ])
  })
})
