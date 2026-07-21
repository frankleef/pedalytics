import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/meldingen', () => ({ maakMelding: vi.fn(async () => {}) }))

import { getKV } from '@/lib/kv'
import { maakMelding } from '@/lib/meldingen'
import {
  berekenTijdInZonePercentage,
  bepaalComplianceTier,
  isKernsessieVoorCompliance,
  isDiscreteEffortType,
  bepaalComplianceRecord,
  haalComplianceVenster,
  COMPLIANCE_VENSTER_DAGEN,
  evalueerComplianceFreeze,
  haalBevrorenWeekInFase,
  evalueerComplianceGate,
  isZwareSessieVoorHerstel,
  haalLaatsteZwareSessieDatum,
  isBinnen48uVanAndereZwareSessie,
  vindHerschikkingsKandidaat,
} from '../compliance.js'

describe('berekenTijdInZonePercentage', () => {
  it('berekent het percentage tijd binnen de toegestane zones op 0-100-schaal', () => {
    const tijdInZones = { Z1: 300, Z2: 2700 } // 3000s totaal, 2700s in Z2
    expect(berekenTijdInZonePercentage(tijdInZones, ['Z2'])).toBe(90)
  })

  it('telt tijd in meerdere toegestane zones op', () => {
    const tijdInZones = { Z1: 1000, Z2: 1000, Z3: 1000 }
    expect(berekenTijdInZonePercentage(tijdInZones, ['Z1', 'Z2'])).toBeCloseTo(66.7, 1)
  })

  it('retourneert null zonder tijdInZones', () => {
    expect(berekenTijdInZonePercentage(null, ['Z2'])).toBeNull()
    expect(berekenTijdInZonePercentage(undefined, ['Z2'])).toBeNull()
  })

  it('retourneert null zonder toegestaneZones', () => {
    expect(berekenTijdInZonePercentage({ Z1: 100 }, null)).toBeNull()
    expect(berekenTijdInZonePercentage({ Z1: 100 }, [])).toBeNull()
  })

  it('retourneert null als totaalSeconden 0 is (voorkomt delen door nul)', () => {
    expect(berekenTijdInZonePercentage({ Z1: 0, Z2: 0 }, ['Z2'])).toBeNull()
  })

  it('0% als geen enkele seconde in de toegestane zone valt', () => {
    const tijdInZones = { Z1: 500, Z5: 500 }
    expect(berekenTijdInZonePercentage(tijdInZones, ['Z2'])).toBe(0)
  })

  it('100% als alle tijd binnen de toegestane zone valt', () => {
    const tijdInZones = { Z2: 1800 }
    expect(berekenTijdInZonePercentage(tijdInZones, ['Z2'])).toBe(100)
  })

  it('exact 85% — de "volledig"-tiergrens van bepaalComplianceTier', () => {
    const tijdInZones = { Z1: 150, Z2: 850 } // 1000s totaal, 850s in Z2
    expect(berekenTijdInZonePercentage(tijdInZones, ['Z2'])).toBe(85)
  })

  it('exact 50% — de "verzwakt"-ondergrens van bepaalComplianceTier', () => {
    const tijdInZones = { Z1: 500, Z2: 500 } // 1000s totaal, 500s in Z2
    expect(berekenTijdInZonePercentage(tijdInZones, ['Z2'])).toBe(50)
  })
})

describe('bepaalComplianceTier — continue types (0-100-schaal, drempels 85/50)', () => {
  it('exact op 85 is "volledig" (grens inclusief)', () => {
    expect(bepaalComplianceTier(85, 'z2_duur')).toBe('volledig')
  })

  it('net onder 85 (84.9) is "verzwakt"', () => {
    expect(bepaalComplianceTier(84.9, 'z2_duur')).toBe('verzwakt')
  })

  it('exact op 50 is "verzwakt" (grens inclusief)', () => {
    expect(bepaalComplianceTier(50, 'sweetspot_intervallen')).toBe('verzwakt')
  })

  it('net onder 50 (49.9) is "niet_geleverd"', () => {
    expect(bepaalComplianceTier(49.9, 'sweetspot_intervallen')).toBe('niet_geleverd')
  })

  it('100 is "volledig", 0 is "niet_geleverd"', () => {
    expect(bepaalComplianceTier(100, 'drempel_intervallen')).toBe('volledig')
    expect(bepaalComplianceTier(0, 'drempel_intervallen')).toBe('niet_geleverd')
  })
})

describe('bepaalComplianceTier — discrete-effort-types (0-10-schaal, drempels 8.5/5)', () => {
  it('exact op 8.5 is "volledig" (grens inclusief)', () => {
    expect(bepaalComplianceTier(8.5, 'sprint_neuraal')).toBe('volledig')
  })

  it('net onder 8.5 (8.4) is "verzwakt"', () => {
    expect(bepaalComplianceTier(8.4, 'sprint_neuraal')).toBe('verzwakt')
  })

  it('exact op 5 is "verzwakt" (grens inclusief)', () => {
    expect(bepaalComplianceTier(5, 'kracht_lage_cadans')).toBe('verzwakt')
  })

  it('net onder 5 (4.9) is "niet_geleverd"', () => {
    expect(bepaalComplianceTier(4.9, 'kracht_lage_cadans')).toBe('niet_geleverd')
  })

  it('gebruikt de 0-10-schaal, niet de 0-100-schaal — 50 zou op de continue-schaal "verzwakt" zijn, hier is het "volledig"', () => {
    expect(bepaalComplianceTier(50, 'sprint_neuraal')).toBe('volledig')
  })
})

describe('bepaalComplianceTier — randgevallen', () => {
  it('retourneert null als percentageOfScore null is', () => {
    expect(bepaalComplianceTier(null, 'z2_duur')).toBeNull()
  })
})

describe('isKernsessieVoorCompliance', () => {
  it('true voor alle zeven kernsessietypes', () => {
    for (const t of [
      'sweetspot_intervallen', 'drempel_intervallen', 'vo2max_intervallen',
      'z2_steady', 'z2_heuvel', 'z2_duur', 'z2_tempo_teugjes',
    ]) {
      expect(isKernsessieVoorCompliance(t)).toBe(true)
    }
  })

  it('false voor hersteldag, ramp_test, discrete-effort-types, onbekend en null', () => {
    for (const t of ['z1_herstel', 'ramp_test', 'sprint_neuraal', 'kracht_lage_cadans', 'onbekend_type', null, undefined]) {
      expect(isKernsessieVoorCompliance(t)).toBe(false)
    }
  })
})

describe('isZwareSessieVoorHerstel (B2)', () => {
  it('true voor de vijf zware sessietypes', () => {
    for (const t of ['sweetspot_intervallen', 'drempel_intervallen', 'vo2max_intervallen', 'sprint_neuraal', 'kracht_lage_cadans']) {
      expect(isZwareSessieVoorHerstel(t)).toBe(true)
    }
  })

  it('false voor lichte Z2-typen (i.t.t. isKernsessieVoorCompliance, die deze WEL meetelt), hersteldag, onbekend en null', () => {
    for (const t of ['z2_steady', 'z2_heuvel', 'z2_duur', 'z2_tempo_teugjes', 'z1_herstel', 'ramp_test', 'onbekend_type', null, undefined]) {
      expect(isZwareSessieVoorHerstel(t)).toBe(false)
    }
  })
})

describe('haalLaatsteZwareSessieDatum (B2)', () => {
  it('vindt de meest recente voltooide zware sessie', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-01', voltooid: true, intentie: { sessietype: 'sweetspot_intervallen' } },
        { datum: '2026-07-10', voltooid: true, intentie: { sessietype: 'drempel_intervallen' } },
        { datum: '2026-07-05', voltooid: true, intentie: { sessietype: 'vo2max_intervallen' } },
      ] },
    }
    expect(haalLaatsteZwareSessieDatum(plan)).toBe('2026-07-10')
  })

  it('negeert niet-voltooide sessies, lichte sessietypes en sessies zonder datum', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-12', voltooid: false, intentie: { sessietype: 'drempel_intervallen' } }, // niet voltooid
        { datum: '2026-07-11', voltooid: true, intentie: { sessietype: 'z2_duur' } }, // te licht
        { voltooid: true, intentie: { sessietype: 'sweetspot_intervallen' } }, // geen datum
        { datum: '2026-07-03', voltooid: true, intentie: { sessietype: 'sprint_neuraal' } }, // enige geldige
      ] },
    }
    expect(haalLaatsteZwareSessieDatum(plan)).toBe('2026-07-03')
  })

  it('een door B1 vervangen zware sessie (ander sessietype na hrv-ingreep) telt niet mee', () => {
    // Simuleert verwerkSchrappen/verwerkVerlichten (hrv/verwerking.js,
    // sessie-generatie.js): het sessietype zelf is al gewijzigd naar een
    // lichte variant (z1_herstel resp. z2_duur) — geen aparte
    // sessie.mode/hrv_keuze-check nodig, de sessietype-filter sluit dit
    // vanzelf uit.
    const plan = {
      weekSessies: { sessies: [
        // Was ooit sweetspot_intervallen, maar B1 (HRV-rood) heeft 'm vervangen:
        { datum: '2026-07-14', voltooid: true, mode: 'geschrapt_hrv', hrv_keuze: 'schrappen', intentie: { sessietype: 'z1_herstel' } },
        { datum: '2026-07-08', voltooid: true, intentie: { sessietype: 'drempel_intervallen' } }, // ongewijzigde, echte zware sessie
      ] },
    }
    expect(haalLaatsteZwareSessieDatum(plan)).toBe('2026-07-08')
  })

  it('null zonder sessies/plan', () => {
    expect(haalLaatsteZwareSessieDatum({ weekSessies: { sessies: [] } })).toBeNull()
    expect(haalLaatsteZwareSessieDatum(null)).toBeNull()
    expect(haalLaatsteZwareSessieDatum({})).toBeNull()
  })
})

describe('isBinnen48uVanAndereZwareSessie (B5)', () => {
  it('true als een andere zware sessie minder dan 48u verwijderd is (36u)', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-06', intentie: { sessietype: 'drempel_intervallen' } },
        { datum: '2026-07-07T12:00:00', intentie: { sessietype: 'z2_duur' } }, // kandidaat, 36u later
      ] },
    }
    expect(isBinnen48uVanAndereZwareSessie(plan, '2026-07-07T12:00:00')).toBe(true)
  })

  it('false als de dichtstbijzijnde andere zware sessie precies 48u of meer verwijderd is', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-05T00:00:00', intentie: { sessietype: 'sweetspot_intervallen' } },
        { datum: '2026-07-07T00:00:00', intentie: { sessietype: 'z2_duur' } }, // kandidaat, exact 48u later
      ] },
    }
    expect(isBinnen48uVanAndereZwareSessie(plan, '2026-07-07T00:00:00')).toBe(false)
  })

  it('negeert lichte sessietypes (geen "zware" sessie) ongeacht de datumafstand', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-07T06:00:00', intentie: { sessietype: 'z2_duur' } }, // licht, telt niet mee
        { datum: '2026-07-07T12:00:00', intentie: { sessietype: 'z2_duur' } }, // kandidaat
      ] },
    }
    expect(isBinnen48uVanAndereZwareSessie(plan, '2026-07-07T12:00:00')).toBe(false)
  })

  it('negeert de sessie op kandidaatDatum zelf (vergelijkt niet met zichzelf)', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-07', intentie: { sessietype: 'drempel_intervallen' } },
      ] },
    }
    expect(isBinnen48uVanAndereZwareSessie(plan, '2026-07-07')).toBe(false)
  })
})

describe('vindHerschikkingsKandidaat (B5)', () => {
  const WEEK_MAANDAG = '2026-07-13' // maandag

  it('vindt de eerste (vroegste) geldige kandidaat ná de gedowngradeerde datum', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-13', voltooid: false }, // gedegradeerde dag zelf
        { datum: '2026-07-16', voltooid: false, intentie: { sessietype: 'z2_duur' } },
        { datum: '2026-07-15', voltooid: false, intentie: { sessietype: 'z2_duur' } },
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBe('2026-07-15')
  })

  it('sluit dagen vóór of op de gedowngradeerde datum uit', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-12', voltooid: false, intentie: { sessietype: 'z2_duur' } }, // vóór
        { datum: WEEK_MAANDAG, voltooid: false, intentie: { sessietype: 'z2_duur' } }, // op dezelfde dag
        { datum: '2026-07-14', voltooid: false, intentie: { sessietype: 'z2_duur' } }, // enige geldige
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBe('2026-07-14')
  })

  it('sluit dagen voorbij de zondag van diezelfde week uit (nooit over de weekgrens)', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-20', voltooid: false, intentie: { sessietype: 'z2_duur' } }, // volgende week (maandag)
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBeNull()
  })

  it('accepteert de zondag van dezelfde week zelf (grens inclusief)', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-19', voltooid: false, intentie: { sessietype: 'z2_duur' } }, // zondag
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBe('2026-07-19')
  })

  it('sluit al voltooide dagen uit', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-14', voltooid: true, intentie: { sessietype: 'z2_duur' } },
        { datum: '2026-07-15', voltooid: false, intentie: { sessietype: 'z2_duur' } },
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBe('2026-07-15')
  })

  it('sluit neurale sessies uit', () => {
    // Bewust een niet-zware sessietype (z2_duur) met een kunstmatige neuraal-vlag,
    // om de neuraal-filter geïsoleerd te toetsen zonder de 48u-zware-sessie-
    // filter (zie de aparte test hieronder) in de weg te laten zitten.
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-14', voltooid: false, intentie: { sessietype: 'z2_duur', neuraal: true } },
        { datum: '2026-07-15', voltooid: false, intentie: { sessietype: 'z2_duur' } },
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBe('2026-07-15')
  })

  it('sluit al beschermde dagen (beschermd_herschikking) uit', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-14', voltooid: false, beschermd_herschikking: true, intentie: { sessietype: 'z2_duur' } },
        { datum: '2026-07-15', voltooid: false, intentie: { sessietype: 'z2_duur' } },
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBe('2026-07-15')
  })

  it('sluit dagen <48u van een andere zware sessie uit', () => {
    const plan = {
      weekSessies: { sessies: [
        // Voltooid -> zelf geen kandidaat, maar telt WEL mee als zware referentie
        // voor isBinnen48uVanAndereZwareSessie (die filtert niet op voltooid).
        { datum: '2026-07-14T06:00:00', voltooid: true, intentie: { sessietype: 'sweetspot_intervallen' } },
        { datum: '2026-07-15T00:00:00', voltooid: false, intentie: { sessietype: 'z2_duur' } }, // <48u van 07-14 zwaar -> uitgesloten
        { datum: '2026-07-16T06:00:00', voltooid: false, intentie: { sessietype: 'z2_duur' } }, // >=48u -> geldig
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBe('2026-07-16T06:00:00')
  })

  it('null zonder plan/sessies of zonder gedowngradeDatum', () => {
    expect(vindHerschikkingsKandidaat(null, WEEK_MAANDAG)).toBeNull()
    expect(vindHerschikkingsKandidaat({ weekSessies: { sessies: [] } }, WEEK_MAANDAG)).toBeNull()
    expect(vindHerschikkingsKandidaat({ weekSessies: { sessies: [{ datum: '2026-07-15' }] } }, null)).toBeNull()
  })

  it('null als er geen enkele geldige kandidaat is', () => {
    const plan = {
      weekSessies: { sessies: [
        { datum: '2026-07-14', voltooid: true, intentie: { sessietype: 'z2_duur' } }, // al voltooid
        { datum: '2026-07-15', beschermd_herschikking: true, intentie: { sessietype: 'z2_duur' } }, // beschermd
      ] },
    }
    expect(vindHerschikkingsKandidaat(plan, WEEK_MAANDAG)).toBeNull()
  })
})

describe('isDiscreteEffortType', () => {
  it('true voor sprint_neuraal en kracht_lage_cadans', () => {
    expect(isDiscreteEffortType('sprint_neuraal')).toBe(true)
    expect(isDiscreteEffortType('kracht_lage_cadans')).toBe(true)
  })

  it('false voor kernsessietypes, z1_herstel, ramp_test en onbekend', () => {
    for (const t of ['z2_duur', 'sweetspot_intervallen', 'z1_herstel', 'ramp_test', 'onbekend_type', null]) {
      expect(isDiscreteEffortType(t)).toBe(false)
    }
  })
})

describe('bepaalComplianceRecord (A0-refactor uit cron/sync/route.js)', () => {
  it('bouwt een volledig record met tijd-in-zone-percentage voor continue types', () => {
    const record = bepaalComplianceRecord({
      sessietype: 'z2_duur',
      tssDoel: 80,
      toegestaneZones: ['Z2'],
      icuTrainingLoad: 78,
      icuZoneTimes: [{ id: 'Z2', secs: 2700 }],
      activiteitId: 'act-1',
      verplaatstVan: null,
      verplaatstNaar: null,
      datum: '2026-07-10',
    })

    expect(record).toMatchObject({
      tier: 'volledig',
      percentageOfScore: 100,
      sessietype: 'z2_duur',
      isKernsessie: true,
      verplaatst_van: null,
      verplaatst_naar: null,
      activiteitId: 'act-1',
      datum: '2026-07-10',
    })
    expect(record.berekendOp).toEqual(expect.any(String))
  })

  it('gebruikt de dimensieScore-tak voor discrete-effort-types', () => {
    const record = bepaalComplianceRecord({
      sessietype: 'sprint_neuraal',
      tssDoel: 40,
      toegestaneZones: ['Z1'],
      icuTrainingLoad: 40,
      icuZoneTimes: [],
      activiteitId: 'act-2',
      verplaatstVan: 'vorigedatum',
      verplaatstNaar: null,
      datum: '2026-07-10',
    })

    expect(record.tier).toBe('volledig') // exacte tss-match -> dimensieScore 10
    expect(record.sessietype).toBe('sprint_neuraal')
    expect(record.isKernsessie).toBe(false) // discrete-effort telt niet als kernsessie
    expect(record.verplaatst_van).toBe('vorigedatum')
  })
})

describe('haalComplianceVenster', () => {
  function maakKvMock(seed = {}) {
    const store = new Map(Object.entries(seed))
    return {
      store,
      mget: vi.fn(async (...keys) => keys.map(k => store.get(k) ?? null)),
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T10:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('telt volledig/verzwakt/niet_geleverd correct, filtert op isKernsessie, venster = laatste 10 dagen (2026-07-06 t/m 2026-07-15)', async () => {
    const seed = {
      // Precies op de venstergrens (oudste dag, i=0) — moet meetellen.
      'sessie_compliance:u1:2026-07-06': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-06' },
      'sessie_compliance:u1:2026-07-07': { tier: 'volledig', isKernsessie: true, datum: '2026-07-07' },
      'sessie_compliance:u1:2026-07-08': { tier: 'verzwakt', isKernsessie: true, datum: '2026-07-08' },
      // isKernsessie: false -> moet genegeerd worden ondanks een geldige tier.
      'sessie_compliance:u1:2026-07-09': { tier: 'volledig', isKernsessie: false, datum: '2026-07-09' },
      // 2026-07-10: geen record (mget geeft null terug) -> genegeerd.
      'sessie_compliance:u1:2026-07-11': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-11' },
      // Eén dag VOOR de venstergrens — mag structureel nooit meetellen (key wordt niet eens opgevraagd).
      'sessie_compliance:u1:2026-07-05': { tier: 'volledig', isKernsessie: true, datum: '2026-07-05' },
    }
    const kv = maakKvMock(seed)
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await haalComplianceVenster('u1')

    expect(resultaat).toEqual({
      vensterDagen: COMPLIANCE_VENSTER_DAGEN,
      totaalKernsessies: 4,
      volledig: 1,
      verzwakt: 1,
      nietGeleverd: 2,
      nietGeleverdDatums: ['2026-07-06', '2026-07-11'],
    })

    // De venstergrens zelf: 2026-07-05 (dag te vroeg) mag niet in de mget-aanroep zitten.
    const opgevraagdeKeys = kv.mget.mock.calls[0]
    expect(opgevraagdeKeys).not.toContain('sessie_compliance:u1:2026-07-05')
    expect(opgevraagdeKeys).toContain('sessie_compliance:u1:2026-07-06')
    expect(opgevraagdeKeys).toHaveLength(10)
  })

  it('leeg venster (geen enkel record) geeft nulwaarden terug', async () => {
    const kv = maakKvMock({})
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await haalComplianceVenster('u1')

    expect(resultaat).toEqual({
      vensterDagen: COMPLIANCE_VENSTER_DAGEN,
      totaalKernsessies: 0,
      volledig: 0,
      verzwakt: 0,
      nietGeleverd: 0,
      nietGeleverdDatums: [],
    })
  })

  it('respecteert een aangepaste vensterlengte', async () => {
    const kv = maakKvMock({
      'sessie_compliance:u1:2026-07-15': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-15' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await haalComplianceVenster('u1', 3)

    expect(resultaat.vensterDagen).toBe(3)
    expect(resultaat.nietGeleverd).toBe(1)
    expect(kv.mget.mock.calls[0]).toHaveLength(3)
  })
})

describe('evalueerComplianceFreeze', () => {
  function maakVolledigeKvMock(seed = {}) {
    const store = new Map(Object.entries(seed))
    return {
      store,
      get: vi.fn(async (k) => store.get(k) ?? null),
      set: vi.fn(async (k, v) => { store.set(k, v) }),
      mget: vi.fn(async (...keys) => keys.map(k => store.get(k) ?? null)),
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T10:00:00')) // "vandaag" gepind; venster = 2026-07-06 t/m 2026-07-15
    vi.mocked(maakMelding).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('eerste misser in het venster: lichte melding, freeze blijft inactief, geen nadrukkelijke melding', async () => {
    const kv = maakVolledigeKvMock({
      'sessie_compliance:u1:2026-07-14': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-14' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceFreeze('u1')

    expect(resultaat).toEqual({ actief: false, laatsteTriggerDatum: '2026-07-14' })
    expect(maakMelding).toHaveBeenCalledTimes(1)
    expect(maakMelding).toHaveBeenCalledWith('u1', 'compliance_eerste_misser', expect.objectContaining({ datum: '2026-07-14' }))
    expect(kv.store.get('compliance_freeze:u1')).toEqual({ actief: false, laatsteTriggerDatum: '2026-07-14' })
  })

  it('tweede misser binnen het venster: freeze wordt actief + nadrukkelijke melding (false->true-overgang)', async () => {
    const kv = maakVolledigeKvMock({
      'sessie_compliance:u1:2026-07-12': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-12' },
      'sessie_compliance:u1:2026-07-14': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-14' },
      // eerste misser (07-12) al in een vorige run verwerkt, freeze nog niet actief
      'compliance_freeze:u1': { actief: false, laatsteTriggerDatum: '2026-07-12' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceFreeze('u1')

    expect(resultaat).toEqual({ actief: true, laatsteTriggerDatum: '2026-07-14' })
    expect(maakMelding).toHaveBeenCalledTimes(1)
    expect(maakMelding).toHaveBeenCalledWith('u1', 'compliance_freeze_geactiveerd', expect.objectContaining({ datum: '2026-07-14', aantalMissers: 2 }))
  })

  it('freeze al actief en geen nieuwe misser: geen herhaalde melding', async () => {
    const kv = maakVolledigeKvMock({
      'sessie_compliance:u1:2026-07-12': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-12' },
      'sessie_compliance:u1:2026-07-14': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-14' },
      'compliance_freeze:u1': { actief: true, laatsteTriggerDatum: '2026-07-14' }, // al verwerkt in een vorige run
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceFreeze('u1')

    expect(resultaat).toEqual({ actief: true, laatsteTriggerDatum: '2026-07-14' })
    expect(maakMelding).not.toHaveBeenCalled()
  })

  it('freeze blijft actief ondanks nietGeleverd>=2 in het venster, zolang laatsteTriggerDatum < 7 dagen geleden is', async () => {
    // laatsteTriggerDatum 2026-07-10 = 5 dagen vóór de gepinde "vandaag" (2026-07-15)
    const kv = maakVolledigeKvMock({
      'sessie_compliance:u1:2026-07-08': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' },
      'sessie_compliance:u1:2026-07-10': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-10' },
      'compliance_freeze:u1': { actief: true, laatsteTriggerDatum: '2026-07-10' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceFreeze('u1')

    expect(resultaat.actief).toBe(true)
  })

  it('freeze heft op na 7 dagen zonder nieuwe trigger, ONGEACHT of een oudere misser toevallig nog in het venster zit', async () => {
    // laatsteTriggerDatum 2026-07-08 = exact 7 dagen vóór de gepinde "vandaag" (2026-07-15)
    const kv = maakVolledigeKvMock({
      'sessie_compliance:u1:2026-07-06': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-06' }, // oudere misser, nog net binnen het 10-dagenvenster
      'sessie_compliance:u1:2026-07-08': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' },
      'compliance_freeze:u1': { actief: true, laatsteTriggerDatum: '2026-07-08' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    // Ruwe venstertelling hier is 2 (07-06 én 07-08 vallen nog binnen het venster) —
    // zonder stap d zou dat "actief" laten staan, maar de 7-dagenregel wint.
    const resultaat = await evalueerComplianceFreeze('u1')

    expect(resultaat.actief).toBe(false)
    expect(resultaat.laatsteTriggerDatum).toBe('2026-07-08') // laatsteTriggerDatum zelf verandert niet door de auto-unfreeze
    expect(maakMelding).not.toHaveBeenCalled()
  })

  it('gebruikt default { actief: false, laatsteTriggerDatum: null } als er nog geen record bestaat en er geen missers zijn', async () => {
    const kv = maakVolledigeKvMock({})
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceFreeze('u1')

    expect(resultaat).toEqual({ actief: false, laatsteTriggerDatum: null })
    expect(maakMelding).not.toHaveBeenCalled()
  })
})

describe('haalBevrorenWeekInFase (STAP 0 — gedeelde leesfunctie, geëxtraheerd uit genereren.js, nu ook gebruikt door weekSessiesDeterministisch.js)', () => {
  function maakKvMock(seed = {}) {
    const store = new Map(Object.entries(seed))
    return { store, get: vi.fn(async (k) => store.get(k) ?? null) }
  }

  const plan = {
    startdatum: '2026-07-06', // maandag, week 1
    kader: [
      { week: 1, fase: 'sweetspot' },
      { week: 2, fase: 'sweetspot' },
      { week: 3, fase: 'sweetspot' },
      { week: 4, fase: 'herstel' },
    ],
  }

  it('geen record: null', async () => {
    const kv = maakKvMock()
    expect(await haalBevrorenWeekInFase(kv, 'u1', plan)).toBeNull()
  })

  it('record met actief: false: null (ongeacht laatsteTriggerDatum)', async () => {
    const kv = maakKvMock({ 'compliance_freeze:u1': { actief: false, laatsteTriggerDatum: '2026-07-06' } })
    expect(await haalBevrorenWeekInFase(kv, 'u1', plan)).toBeNull()
  })

  it('actief: true: retourneert weekInFaseVoorDatum(laatsteTriggerDatum, plan.kader, plan.startdatum)', async () => {
    const kv = maakKvMock({ 'compliance_freeze:u1': { actief: true, laatsteTriggerDatum: '2026-07-06' } })
    expect(await haalBevrorenWeekInFase(kv, 'u1', plan)).toBe(1) // week 1 van de fase

    const kvWeek3 = maakKvMock({ 'compliance_freeze:u1': { actief: true, laatsteTriggerDatum: '2026-07-20' } })
    expect(await haalBevrorenWeekInFase(kvWeek3, 'u1', plan)).toBe(3) // week 3 van de fase
  })

  it('gegateerd op record.actief === true, niet op de loutere aanwezigheid van laatsteTriggerDatum (laatsteTriggerDatum blijft bewust bestaan ná een unfreeze)', async () => {
    const kv = maakKvMock({ 'compliance_freeze:u1': { actief: false, laatsteTriggerDatum: '2026-07-20' } })
    expect(await haalBevrorenWeekInFase(kv, 'u1', plan)).toBeNull()
  })

  it('fail-open: een kv.get-leesfout levert null op, geen throw', async () => {
    const kv = { get: vi.fn(async () => { throw new Error('kv onbereikbaar') }) }
    await expect(haalBevrorenWeekInFase(kv, 'u1', plan)).resolves.toBeNull()
  })
})

describe('evalueerComplianceGate (D1)', () => {
  function maakVolledigeKvMock(seed = {}) {
    const store = new Map(Object.entries(seed))
    return {
      store,
      mget: vi.fn(async (...keys) => keys.map(k => store.get(k) ?? null)),
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T10:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fail-open naar { uitstel: false, nietGeleverd: 0 } als faseStartdatum(plan) null teruggeeft (geen kader)', async () => {
    const kv = maakVolledigeKvMock({})
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceGate('u1', { startdatum: '2026-05-25' /* geen kader */ })

    expect(resultaat).toEqual({ uitstel: false, nietGeleverd: 0 })
    // Echt fail-open: haalComplianceVenster (en dus kv.mget) wordt niet eens aangeroepen.
    expect(kv.mget).not.toHaveBeenCalled()
  })

  it('fail-open als faseStartdatum(plan) null teruggeeft (geen startdatum)', async () => {
    const kv = maakVolledigeKvMock({})
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceGate('u1', { kader: [{ week: 1, fase: 'basis' }] /* geen startdatum */ })

    expect(resultaat).toEqual({ uitstel: false, nietGeleverd: 0 })
    expect(kv.mget).not.toHaveBeenCalled()
  })

  it('>= 2 niet_geleverd binnen de faseperiode en complianceVerlengdCount < 2 -> uitstel: true', async () => {
    // startdatum ma 2026-05-25, "vandaag" gepind op 2026-06-24 (week 5, fase sweetspot,
    // eerste sweetspot-week = week 5 = ma 2026-06-22) -> faseDuurInDagen = 3 (22,23,24)
    const plan = {
      startdatum: '2026-05-25',
      kader: [
        { week: 4, fase: 'test' },
        { week: 5, fase: 'sweetspot' },
      ],
    }
    const kv = maakVolledigeKvMock({
      'sessie_compliance:u1:2026-06-22': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-06-22' },
      'sessie_compliance:u1:2026-06-23': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-06-23' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceGate('u1', plan, 0)

    expect(resultaat).toEqual({ uitstel: true, nietGeleverd: 2 })
    expect(kv.mget.mock.calls[0]).toHaveLength(3) // faseDuurInDagen = 22,23,24 juni = 3 dagen
  })

  it('>= 2 niet_geleverd maar complianceVerlengdCount al op de limiet van 2 -> uitstel: false', async () => {
    const plan = {
      startdatum: '2026-05-25',
      kader: [{ week: 5, fase: 'sweetspot' }],
    }
    const kv = maakVolledigeKvMock({
      'sessie_compliance:u1:2026-06-22': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-06-22' },
      'sessie_compliance:u1:2026-06-23': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-06-23' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceGate('u1', plan, 2)

    expect(resultaat).toEqual({ uitstel: false, nietGeleverd: 2 })
  })

  it('minder dan 2 niet_geleverd -> uitstel: false', async () => {
    const plan = {
      startdatum: '2026-05-25',
      kader: [{ week: 5, fase: 'sweetspot' }],
    }
    const kv = maakVolledigeKvMock({
      'sessie_compliance:u1:2026-06-22': { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-06-22' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await evalueerComplianceGate('u1', plan, 0)

    expect(resultaat).toEqual({ uitstel: false, nietGeleverd: 1 })
  })
})
