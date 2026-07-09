import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn() }))
vi.mock('@/lib/intervals', () => ({ intervalsGet: vi.fn(), intervalsDelete: vi.fn() }))
vi.mock('@/lib/meldingen', () => ({ maakMelding: vi.fn() }))

import { getKV } from '@/lib/kv'
import { getIntervalsCredentials } from '@/lib/users'
import { intervalsGet, intervalsDelete } from '@/lib/intervals'
import { maakMelding } from '@/lib/meldingen'
import {
  maakAfwezigheidsperiode,
  sluitOpenPeriode,
  annuleerPeriode,
  verwijderSessiesInPeriode,
  valtBinnenAfwezigheid,
  bepaalHeropbouwActie,
  verwerkTerugkeerDetectie,
  telSessiesInPeriode,
  HEROPBOUW_CONSTANTEN,
} from '../afwezigheid.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

// Vast "vandaag" voor deterministische duur-/dagen-terug-berekeningen.
const VANDAAG = '2026-07-09'
function dagenTerug(n) {
  const d = new Date(VANDAAG); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function dagenVooruit(n) {
  const d = new Date(VANDAAG); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${VANDAAG}T10:00:00`))
  vi.mocked(maakMelding).mockClear()
  vi.mocked(intervalsDelete).mockClear()
  vi.mocked(intervalsGet).mockReset()
  vi.mocked(getIntervalsCredentials).mockReset()
})

describe('maakAfwezigheidsperiode — onderdeel 1', () => {
  it('weigert een periode die overlapt met een bestaande actieve periode', async () => {
    const kv = maakKvMock({
      'u1:afwezigheid': [
        { periodeId: 'p1', startDatum: dagenVooruit(5), eindDatum: dagenVooruit(10), reden: 'vakantie', status: 'actief' },
      ],
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await maakAfwezigheidsperiode('u1', { startDatum: dagenVooruit(8), eindDatum: dagenVooruit(12), reden: 'ziek' })
    expect(resultaat.error).toBeDefined()
    expect(resultaat.conflict.periodeId).toBe('p1')
    expect(kv.set).not.toHaveBeenCalled()
  })

  it('weigert een startDatum die meer dan 14 dagen in het verleden ligt', async () => {
    const kv = maakKvMock({ 'u1:afwezigheid': [] })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await maakAfwezigheidsperiode('u1', { startDatum: dagenTerug(20), eindDatum: dagenTerug(15), reden: 'ziek' })
    expect(resultaat.error).toMatch(/verleden/)
    expect(kv.set).not.toHaveBeenCalled()
  })

  it('weigert een open einde (eindDatum: null) bij reden "vakantie"', async () => {
    const kv = maakKvMock({ 'u1:afwezigheid': [] })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await maakAfwezigheidsperiode('u1', { startDatum: dagenVooruit(1), eindDatum: null, reden: 'vakantie' })
    expect(resultaat.error).toMatch(/ziek/)
  })

  it('staat een open einde toe bij reden "ziek"', async () => {
    const kv = maakKvMock({ 'u1:afwezigheid': [] })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await maakAfwezigheidsperiode('u1', { startDatum: VANDAAG, eindDatum: null, reden: 'ziek' })
    expect(resultaat.periode).toBeDefined()
    expect(resultaat.periode.eindDatum).toBeNull()
    expect(resultaat.periode.status).toBe('actief')
  })
})

describe('sluitOpenPeriode — onderdeel 1', () => {
  it('zet eindDatum van een open-eind-ziek-periode op vandaag', async () => {
    const kv = maakKvMock({
      'u1:afwezigheid': [{ periodeId: 'p1', startDatum: dagenTerug(3), eindDatum: null, reden: 'ziek', status: 'actief', heropbouwToegepast: false }],
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await sluitOpenPeriode('u1', 'p1')
    expect(resultaat.periode.eindDatum).toBe(VANDAAG)
    expect(kv.store.get('u1:afwezigheid')[0].eindDatum).toBe(VANDAAG)
  })
})

describe('verwijderSessiesInPeriode — onderdeel 2', () => {
  it('verwijdert niet-voltooide sessies binnen de periode, laat voltooide sessies binnen dezelfde periode ongemoeid', async () => {
    const periode = { startDatum: dagenTerug(2), eindDatum: dagenVooruit(2) }
    const sessies = [
      { datum: dagenTerug(2), voltooid: true, intervalsEventId: 'evt-voltooid' },   // binnen periode, al gereden -> nooit aanraken
      { datum: dagenTerug(1), voltooid: false, intervalsEventId: 'evt-1' },          // binnen periode, geplande -> verwijderen
      { datum: VANDAAG, voltooid: false, intervalsEventId: null },                    // binnen periode, geplande, geen event
      { datum: dagenVooruit(1), voltooid: false, intervalsEventId: 'evt-2' },        // binnen periode -> verwijderen
      { datum: dagenVooruit(10), voltooid: false, intervalsEventId: 'evt-buiten' },  // buiten periode -> ongemoeid
    ]
    const kv = maakKvMock({ 'u1:seizoensplan': { weekSessies: { sessies } } })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    vi.mocked(intervalsDelete).mockResolvedValue({})

    const { verwijderd } = await verwijderSessiesInPeriode('u1', periode)

    expect(verwijderd.sort()).toEqual([dagenTerug(1), VANDAAG, dagenVooruit(1)].sort())
    const overgebleven = kv.store.get('u1:seizoensplan').weekSessies.sessies.map(s => s.datum)
    expect(overgebleven).toContain(dagenTerug(2))   // voltooide dag blijft
    expect(overgebleven).toContain(dagenVooruit(10)) // buiten periode blijft
    expect(overgebleven).not.toContain(dagenTerug(1))
    expect(overgebleven).not.toContain(dagenVooruit(1))
    expect(intervalsDelete).toHaveBeenCalledWith('/events/evt-1', { apiKey: 'k', athleteId: 'a' })
    expect(intervalsDelete).toHaveBeenCalledWith('/events/evt-2', { apiKey: 'k', athleteId: 'a' })
    expect(intervalsDelete).not.toHaveBeenCalledWith('/events/evt-voltooid', expect.anything())
  })

  it('doet niets destructiefs als er nog geen sessies gegenereerd zijn voor de periode', async () => {
    const periode = { startDatum: dagenVooruit(30), eindDatum: dagenVooruit(35) }
    const kv = maakKvMock({ 'u1:seizoensplan': { weekSessies: { sessies: [] } } })
    vi.mocked(getKV).mockReturnValue(kv)

    const { verwijderd } = await verwijderSessiesInPeriode('u1', periode)
    expect(verwijderd).toEqual([])
    // bijwerkPlanVeilig schrijft altijd terug (ook zonder inhoudelijke wijziging) —
    // relevante check is dat de inhoud ongewijzigd is, niet dat kv.set nooit valt.
    expect(kv.store.get('u1:seizoensplan').weekSessies.sessies).toEqual([])
  })
})

describe('valtBinnenAfwezigheid — onderdeel 5', () => {
  it('herkent een datum binnen een actieve periode, negeert geannuleerde/afgeronde periodes', () => {
    const periodes = [
      { startDatum: '2026-07-10', eindDatum: '2026-07-15', status: 'actief' },
      { startDatum: '2026-08-01', eindDatum: '2026-08-05', status: 'geannuleerd' },
    ]
    expect(valtBinnenAfwezigheid('2026-07-12', periodes)).toBe(true)
    expect(valtBinnenAfwezigheid('2026-07-16', periodes)).toBe(false)
    expect(valtBinnenAfwezigheid('2026-08-02', periodes)).toBe(false) // geannuleerd telt niet
  })

  it('behandelt een open-eind-periode (eindDatum: null) als doorlopend', () => {
    const periodes = [{ startDatum: '2026-07-01', eindDatum: null, status: 'actief' }]
    expect(valtBinnenAfwezigheid('2027-01-01', periodes)).toBe(true)
  })
})

describe('bepaalHeropbouwActie — onderdeel 4 (duur-tabel)', () => {
  const planMetWeekTss = (tssDoel) => ({
    startdatum: dagenTerug(30),
    kader: Array.from({ length: 20 }, (_, i) => ({ week: i + 1, tss_doel: tssDoel, weektype: 'opbouw' })),
  })

  it('1-3 dagen: geen ingreep, ongeacht reden', async () => {
    const periode = { startDatum: dagenTerug(2), eindDatum: VANDAAG, reden: 'ziek' }
    const resultaat = await bepaalHeropbouwActie(planMetWeekTss(300), 'u1', periode)
    expect(resultaat.actie).toBe('geen')
  })

  it('4-7 dagen, ziek: lichte week op TSS_PCT_HERSTEL', async () => {
    const periode = { startDatum: dagenTerug(5), eindDatum: VANDAAG, reden: 'ziek' }
    const resultaat = await bepaalHeropbouwActie(planMetWeekTss(300), 'u1', periode)
    expect(resultaat.actie).toBe('lichte_week')
    expect(resultaat.tssPct).toBe(HEROPBOUW_CONSTANTEN.TSS_PCT_HERSTEL)
  })

  it('8+ dagen, ziek: opbouwweek op TSS_PCT_OPBOUW_VERLAAGD', async () => {
    const periode = { startDatum: dagenTerug(9), eindDatum: VANDAAG, reden: 'ziek' }
    const resultaat = await bepaalHeropbouwActie(planMetWeekTss(300), 'u1', periode)
    expect(resultaat.actie).toBe('opbouwweek')
    expect(resultaat.tssPct).toBe(HEROPBOUW_CONSTANTEN.TSS_PCT_OPBOUW_VERLAAGD)
  })

  it('4-7 dagen, vakantie, ratio >= drempel (veel gereden): geen ingreep', async () => {
    const periode = { startDatum: dagenTerug(6), eindDatum: VANDAAG, reden: 'vakantie' }
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    // verwachte TSS over 7 kalenderdagen (incl. beide grenzen) van een week met tss_doel=300 -> 7*(300/7)=300
    vi.mocked(intervalsGet).mockResolvedValue([
      { type: 'Ride', icu_training_load: 200 },
    ])
    const resultaat = await bepaalHeropbouwActie(planMetWeekTss(300), 'u1', periode)
    expect(resultaat.ratio).toBeGreaterThanOrEqual(HEROPBOUW_CONSTANTEN.RATIO_DREMPEL_OVERIG)
    expect(resultaat.actie).toBe('geen')
  })

  it('4-7 dagen, vakantie, ratio < drempel (nauwelijks gereden): lichte week, zelfde als ziek', async () => {
    const periode = { startDatum: dagenTerug(6), eindDatum: VANDAAG, reden: 'vakantie' }
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    vi.mocked(intervalsGet).mockResolvedValue([{ type: 'Ride', icu_training_load: 20 }])
    const resultaat = await bepaalHeropbouwActie(planMetWeekTss(300), 'u1', periode)
    expect(resultaat.ratio).toBeLessThan(HEROPBOUW_CONSTANTEN.RATIO_DREMPEL_OVERIG)
    expect(resultaat.actie).toBe('lichte_week')
    expect(resultaat.tssPct).toBe(HEROPBOUW_CONSTANTEN.TSS_PCT_HERSTEL)
  })

  it('8+ dagen, vakantie, ratio >= drempel: valt terug naar het 4-7-dagen-pad (herstel, 0.6)', async () => {
    const periode = { startDatum: dagenTerug(9), eindDatum: VANDAAG, reden: 'vakantie' }
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    vi.mocked(intervalsGet).mockResolvedValue([{ type: 'Ride', icu_training_load: 300 }])
    const resultaat = await bepaalHeropbouwActie(planMetWeekTss(300), 'u1', periode)
    expect(resultaat.ratio).toBeGreaterThanOrEqual(HEROPBOUW_CONSTANTEN.RATIO_DREMPEL_OVERIG)
    expect(resultaat.actie).toBe('lichte_week')
    expect(resultaat.tssPct).toBe(HEROPBOUW_CONSTANTEN.TSS_PCT_HERSTEL)
  })

  it('8+ dagen, vakantie, ratio < drempel: zelfde als ziek (opbouwweek, 0.75)', async () => {
    const periode = { startDatum: dagenTerug(9), eindDatum: VANDAAG, reden: 'vakantie' }
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    vi.mocked(intervalsGet).mockResolvedValue([{ type: 'Ride', icu_training_load: 10 }])
    const resultaat = await bepaalHeropbouwActie(planMetWeekTss(300), 'u1', periode)
    expect(resultaat.ratio).toBeLessThan(HEROPBOUW_CONSTANTEN.RATIO_DREMPEL_OVERIG)
    expect(resultaat.actie).toBe('opbouwweek')
    expect(resultaat.tssPct).toBe(HEROPBOUW_CONSTANTEN.TSS_PCT_OPBOUW_VERLAAGD)
  })
})

describe('verwerkTerugkeerDetectie — onderdeel 4 (idempotentie + orkestratie)', () => {
  function bouwPlan(overrides = {}) {
    return {
      // Startdatum zo gekozen dat "vandaag" in week 1-3 van het kader valt
      // (weekNr blijft dus binnen de array-bounds voor de herstelweek-zoektocht).
      startdatum: dagenTerug(7),
      kader: [
        { week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200 },
        { week: 2, fase: 'basis', weektype: 'opbouw', tss_doel: 210 },
        { week: 3, fase: 'basis', weektype: 'opbouw', tss_doel: 220 },
        { week: 4, fase: 'basis', weektype: 'herstel', tss_doel: 100 },
        { week: 5, fase: 'sweetspot', weektype: 'opbouw', tss_doel: 230 },
      ],
      weekSessies: { sessies: [] },
      ...overrides,
    }
  }

  it('periode van 2 dagen (ziek), afgelopen: geen kader-insertie, periode toch op afgerond gezet', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': bouwPlan(),
      'u1:afwezigheid': [{ periodeId: 'p1', startDatum: dagenTerug(4), eindDatum: dagenTerug(2), reden: 'ziek', status: 'actief', heropbouwToegepast: false }],
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const { verwerkt } = await verwerkTerugkeerDetectie('u1', VANDAAG)
    expect(verwerkt).toBe(1)

    const plan = kv.store.get('u1:seizoensplan')
    expect(plan.kader.length).toBe(5) // geen extra week ingevoegd

    const periode = kv.store.get('u1:afwezigheid')[0]
    expect(periode.status).toBe('afgerond')
    expect(periode.heropbouwToegepast).toBe(true)
    expect(maakMelding).toHaveBeenCalledWith('u1', 'afwezigheid_afgerond', expect.objectContaining({ actie: 'geen' }))
  })

  it('periode van 5 dagen (ziek): 1 lichte week ingevoegd, melding verstuurd, heropbouwToegepast: true', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': bouwPlan(),
      'u1:afwezigheid': [{ periodeId: 'p1', startDatum: dagenTerug(7), eindDatum: dagenTerug(2), reden: 'ziek', status: 'actief', heropbouwToegepast: false }],
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const { verwerkt } = await verwerkTerugkeerDetectie('u1', VANDAAG)
    expect(verwerkt).toBe(1)

    const plan = kv.store.get('u1:seizoensplan')
    expect(plan.kader.length).toBe(6) // extra week ingevoegd
    const ingevoegd = plan.kader.find(w => w.weektype === 'herstel' && w.tss_doel !== 100)
    expect(ingevoegd).toBeDefined()
    expect(plan.afwezigheid_heropbouw_toegepast_op).toContain('p1')

    const periode = kv.store.get('u1:afwezigheid')[0]
    expect(periode.heropbouwToegepast).toBe(true)
    expect(maakMelding).toHaveBeenCalledWith('u1', 'afwezigheid_afgerond', expect.objectContaining({ actie: 'lichte_week' }))
  })

  it('periode met heropbouwToegepast: true wordt genegeerd (geen dubbele insertie)', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': bouwPlan(),
      'u1:afwezigheid': [{ periodeId: 'p1', startDatum: dagenTerug(7), eindDatum: dagenTerug(2), reden: 'ziek', status: 'afgerond', heropbouwToegepast: true }],
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const { verwerkt } = await verwerkTerugkeerDetectie('u1', VANDAAG)
    expect(verwerkt).toBe(0)
    expect(kv.store.get('u1:seizoensplan').kader.length).toBe(5)
    expect(maakMelding).not.toHaveBeenCalled()
  })
})

describe('telSessiesInPeriode — zij-effect-vrije preview (onderdeel A/chunk 0, punt 2)', () => {
  it('telt niet-voltooide sessies binnen de periode, zonder te schrijven of intervals.icu aan te roepen', async () => {
    const sessies = [
      { datum: dagenTerug(2), voltooid: true },
      { datum: dagenTerug(1), voltooid: false },
      { datum: VANDAAG, voltooid: false },
      { datum: dagenVooruit(10), voltooid: false },
    ]
    const kv = maakKvMock({ 'u1:seizoensplan': { weekSessies: { sessies } } })
    vi.mocked(getKV).mockReturnValue(kv)

    const aantal = await telSessiesInPeriode('u1', dagenTerug(2), dagenVooruit(2))

    expect(aantal).toBe(2) // dagenTerug(1) en VANDAAG; voltooide dag en buiten-periode-dag tellen niet mee
    expect(kv.set).not.toHaveBeenCalled()
    expect(intervalsDelete).not.toHaveBeenCalled()
  })

  it('behandelt eindDatum: null (open eind) als doorlopend tot in de toekomst', async () => {
    const sessies = [{ datum: dagenVooruit(30), voltooid: false }]
    const kv = maakKvMock({ 'u1:seizoensplan': { weekSessies: { sessies } } })
    vi.mocked(getKV).mockReturnValue(kv)

    const aantal = await telSessiesInPeriode('u1', VANDAAG, null)
    expect(aantal).toBe(1)
  })

  it('geeft 0 zonder fout als er geen plan/sessies zijn', async () => {
    const kv = maakKvMock({})
    vi.mocked(getKV).mockReturnValue(kv)
    const aantal = await telSessiesInPeriode('u1', VANDAAG, dagenVooruit(5))
    expect(aantal).toBe(0)
  })
})
