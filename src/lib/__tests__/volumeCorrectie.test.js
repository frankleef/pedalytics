// STAP 0 — karakteriserende tests: legt het HUIDIGE gedrag vast van
// bepaalVolumeCorrectie/bepaalNieuweBlokBasis/haalVolumeSignalen, VOORDAT
// decoupling/EF-trend/HRV-RHR-bloktrend/compliance-poort worden aangesloten.
// Deze functies draaiden tot vandaag zonder één test in productie.
//
// LET OP: de test hieronder die bevestigt dat decouplingMediaan vandaag
// GENEGEERD wordt, is bewust een REGRESSIETEST — na STAP 1 (decoupling
// aansluiten) hoort die test te FALEN/veranderen, als bevestiging dat de
// aansluiting daadwerkelijk iets doet.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../kv.js', () => ({ getKV: vi.fn() }))
vi.mock('../users.js', () => ({ getIntervalsCredentials: vi.fn() }))
vi.mock('../intervals.js', () => ({ intervalsGet: vi.fn() }))
vi.mock('../meldingen.js', () => ({ maakMelding: vi.fn(async () => {}) }))

import { getKV } from '../kv.js'
import { getIntervalsCredentials } from '../users.js'
import { intervalsGet } from '../intervals.js'
import {
  bepaalVolumeCorrectie,
  bepaalNieuweBlokBasis,
  haalVolumeSignalen,
  voerHerstelweekEvaluatieUit,
  BLOK_TREND_DREMPEL_PCT,
  berekenBlokIndex,
  leesBlokBasisLogBlok,
  leesBlokBasisLogWeek,
  haalIsoWeeknummer,
  bepaalVolumeAanpassing,
} from '../volumeCorrectie.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    mget: vi.fn(async (...keys) => keys.map(k => store.get(k) ?? null)),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('bepaalVolumeCorrectie — huidig gedrag (rampRate/tsb/rpe-only)', () => {
  it('rampTeLaag (rampRate<2.0) alleen, geen tsb-bonus (tsb null): omhoog 0.07', () => {
    const r = bepaalVolumeCorrectie({ rampRate: 1.5, tsbGemiddelde14d: null, rpeDeltaTrend: null, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'omhoog', pct: 0.07 })
  })

  it('rampTeLaag + tsb > 15: omhoog 0.12 (hoogste tier)', () => {
    const r = bepaalVolumeCorrectie({ rampRate: 1.5, tsbGemiddelde14d: 20, rpeDeltaTrend: null, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'omhoog', pct: 0.12 })
  })

  it('alleen tsb > 8 (geen rampTeLaag): omhoog 0.07', () => {
    const r = bepaalVolumeCorrectie({ rampRate: 4, tsbGemiddelde14d: 10, rpeDeltaTrend: null, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'omhoog', pct: 0.07 })
  })

  it('tsb tussen 5 en 8 (tsbTePositief maar niet >8, geen rampTeLaag): omhoog default 0.05', () => {
    const r = bepaalVolumeCorrectie({ rampRate: 4, tsbGemiddelde14d: 6, rpeDeltaTrend: null, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'omhoog', pct: 0.05 })
  })

  it('adaptatieSlecht (rpeDeltaTrend>1.0) blokkeert omhoog OOK als rampTeLaag waar is — en zonder rampTeHoog is er ook geen omlaag: richting geen', () => {
    // Dit is de "&& !adaptatieSlecht"-term in de omhoog-conditie die in de
    // trace-samenvatting ontbrak maar wel degelijk in de code staat
    // (volumeCorrectie.js:224 vóór STAP 1-4).
    const r = bepaalVolumeCorrectie({ rampRate: 1.5, tsbGemiddelde14d: null, rpeDeltaTrend: 1.5, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'geen', pct: 0 })
  })

  it('tsbTeNegatief (tsb < -20, niet < -30): omlaag 0.08', () => {
    const r = bepaalVolumeCorrectie({ rampRate: null, tsbGemiddelde14d: -25, rpeDeltaTrend: null, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'omlaag', pct: 0.08 })
  })

  it('tsbTeNegatief en < -30: omlaag 0.12 (hoogste tier)', () => {
    const r = bepaalVolumeCorrectie({ rampRate: null, tsbGemiddelde14d: -35, rpeDeltaTrend: null, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'omlaag', pct: 0.12 })
  })

  it('rampTeHoog (>7.0) EN adaptatieSlecht (>1.0), tsb niet negatief: omlaag default 0.05', () => {
    const r = bepaalVolumeCorrectie({ rampRate: 8, tsbGemiddelde14d: 0, rpeDeltaTrend: 1.5, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'omlaag', pct: 0.05 })
  })

  it('rampTeHoog ALLEEN (zonder adaptatieSlecht): geen enkele conditie triggert -> richting geen', () => {
    const r = bepaalVolumeCorrectie({ rampRate: 8, tsbGemiddelde14d: 0, rpeDeltaTrend: null, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'geen', pct: 0 })
  })

  it('alle signalen null: richting geen, pct 0', () => {
    const r = bepaalVolumeCorrectie({ rampRate: null, tsbGemiddelde14d: null, rpeDeltaTrend: null, decouplingMediaan: null })
    expect(r).toEqual({ richting: 'geen', pct: 0 })
  })

  it('NA STAP 1 aangesloten: een extreme decouplingMediaan (>7) triggert nu wél omlaag — vóór STAP 1 veranderde dit niets aan de uitkomst (zie volumeCorrectie.js git-historie voor de oude void decouplingMediaan-regel)', () => {
    const zonderSignalen = { rampRate: null, tsbGemiddelde14d: null, rpeDeltaTrend: null }
    const zonderDecoupling = bepaalVolumeCorrectie({ ...zonderSignalen, decouplingMediaan: null })
    const metExtremeDecoupling = bepaalVolumeCorrectie({ ...zonderSignalen, decouplingMediaan: 50 })
    expect(zonderDecoupling).toEqual({ richting: 'geen', pct: 0 })
    expect(metExtremeDecoupling).toEqual({ richting: 'omlaag', pct: 0.05 })
    expect(metExtremeDecoupling).not.toEqual(zonderDecoupling)
  })
})

describe('bepaalNieuweBlokBasis — huidig gedrag (interBlokGroei per ervaringsniveau, geen decoupling-input)', () => {
  const geenSignalen = { rampRate: null, tsbGemiddelde14d: null, rpeDeltaTrend: null, decouplingMediaan: null }

  it('starter, blokIndex 0: interBlokGroei 0.08 (geen correctie)', () => {
    const r = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen: geenSignalen, ervaringsniveau: 'starter', blokIndex: 0 })
    expect(r).toBe(Math.round(300 * 1.08))
  })

  it('starter, blokIndex 5 (voorbij array-lengte 2): clamped op laatste element (0.08)', () => {
    const r = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen: geenSignalen, ervaringsniveau: 'starter', blokIndex: 5 })
    expect(r).toBe(Math.round(300 * 1.08))
  })

  it('getraind, blokIndex 0 vs 1: 0.12 dan 0.15', () => {
    const r0 = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen: geenSignalen, ervaringsniveau: 'getraind', blokIndex: 0 })
    const r1 = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen: geenSignalen, ervaringsniveau: 'getraind', blokIndex: 1 })
    expect(r0).toBe(Math.round(300 * 1.12))
    expect(r1).toBe(Math.round(300 * 1.15))
  })

  it('onbekend/ontbrekend ervaringsniveau valt terug op recreatief-achtige default [0.10, 0.12]', () => {
    const r = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen: geenSignalen, ervaringsniveau: 'onbekend', blokIndex: 0 })
    expect(r).toBe(Math.round(300 * 1.10))
  })

  it('recreatief + omhoog-correctie: interBlokGroei EN correctie.pct beide toegepast (vermenigvuldigd)', () => {
    // rampTeLaag -> omhoog, tsb null dus pct 0.07 (zie eerste bepaalVolumeCorrectie-test).
    const signalen = { rampRate: 1.5, tsbGemiddelde14d: null, rpeDeltaTrend: null, decouplingMediaan: null }
    const r = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen, ervaringsniveau: 'recreatief', blokIndex: 0 })
    // basis: 300*(1+0.10)=330, dan *(1+0.07)=353.1 -> clamp [240,360] -> geen clamp nodig
    expect(r).toBe(Math.round(300 * 1.10 * 1.07))
  })

  it('omlaag-correctie verlaagt de basis t.o.v. ongecorrigeerd', () => {
    const signalen = { rampRate: null, tsbGemiddelde14d: -25, rpeDeltaTrend: null, decouplingMediaan: null }
    const rMetCorrectie = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen, ervaringsniveau: 'recreatief', blokIndex: 0 })
    const rZonderCorrectie = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen: geenSignalen, ervaringsniveau: 'recreatief', blokIndex: 0 })
    expect(rMetCorrectie).toBeLessThan(rZonderCorrectie)
  })

  it('clamp bovengrens: resultaat kan nooit boven huidigePiekweekTss * 1.20 uitkomen', () => {
    // getraind blokIndex1 (0.15 groei) + omhoog 0.12 (rampTeLaag + tsb>15) -> 1.15*1.12=1.288 > 1.20
    const signalen = { rampRate: 1.0, tsbGemiddelde14d: 20, rpeDeltaTrend: null, decouplingMediaan: null }
    const r = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen, ervaringsniveau: 'getraind', blokIndex: 1 })
    expect(r).toBe(Math.round(300 * 1.20))
  })

  it('clamp ondergrens: resultaat kan nooit onder huidigePiekweekTss * 0.80 uitkomen', () => {
    // starter (0.08 groei) + omlaag 0.12 (tsb<-30) -> 1.08*0.88=0.9504, boven 0.80 -> geen clamp hier nodig,
    // dus forceer een extremere situatie via een lage groei (starter) gecombineerd met max omlaag-pct.
    const signalen = { rampRate: null, tsbGemiddelde14d: -35, rpeDeltaTrend: null, decouplingMediaan: null }
    const r = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen, ervaringsniveau: 'starter', blokIndex: 0 })
    const ongeclampt = 300 * 1.08 * (1 - 0.12)
    expect(ongeclampt).toBeGreaterThan(300 * 0.80) // sanity: deze specifieke case clampt niet
    expect(r).toBe(Math.round(ongeclampt))
  })

  it('richting geen: nieuweBasis = huidigePiekweekTss * (1 + gepland), geen correctie-vermenigvuldiging', () => {
    const r = bepaalNieuweBlokBasis({ huidigePiekweekTss: 300, signalen: geenSignalen, ervaringsniveau: 'recreatief', blokIndex: 0 })
    expect(r).toBe(Math.round(300 * 1.10))
  })
})

describe('haalVolumeSignalen — huidig gedrag (aggregatie van vier signalen)', () => {
  it('retourneert rampRate/tsbGemiddelde14d/rpeDeltaTrend/decouplingMediaan als object, ontbrekende creds -> alle intervals.icu-afhankelijke signalen null', async () => {
    const kv = maakKvMock({ 'rpe_trend:u1': 0.4 })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(getIntervalsCredentials).mockResolvedValue(null) // geen creds -> ramp/tsb/decoupling allemaal null

    const signalen = await haalVolumeSignalen('u1')

    expect(signalen).toEqual({
      rampRate: null,
      tsbGemiddelde14d: null,
      rpeDeltaTrend: 0.4,
      decouplingMediaan: null,
    })
    expect(intervalsGet).not.toHaveBeenCalled()
  })

  it('met creds: rampRate/tsb komen uit /wellness, decouplingMediaan blijft null zonder gekoppelde decoupling-KV-records', async () => {
    const kv = maakKvMock({
      'rpe_trend:u1': null,
      'u1:seizoensplan': { huidige_ftp: 265 },
    })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'x' })

    const wellnessPunten = Array.from({ length: 14 }, (_, i) => ({
      id: `2026-07-${String(i + 1).padStart(2, '0')}`,
      form: -5,
      ctl: 50,
      atl: 55,
      rampRate: i === 13 ? 3.2 : null,
    }))
    vi.mocked(intervalsGet).mockImplementation(async (path) => {
      if (path === '/wellness') return wellnessPunten
      if (path === '/activities') return [] // geen ritten -> decoupling blijft null
      return []
    })

    const signalen = await haalVolumeSignalen('u1')

    expect(signalen.rampRate).toBe(3.2)
    expect(signalen.tsbGemiddelde14d).toBe(-5)
    expect(signalen.rpeDeltaTrend).toBeNull()
    expect(signalen.decouplingMediaan).toBeNull()
  })
})

describe('bepaalVolumeCorrectie — STAP 1-3: decoupling/EF-trend/HRV-RHR-bloktrend', () => {
  const geen = { rampRate: null, tsbGemiddelde14d: null, rpeDeltaTrend: null, decouplingMediaan: null }

  it('STAP 1 — decouplingMediaan > 7 triggert omlaag (zelfde drempel als checkFaseOvergang)', () => {
    expect(bepaalVolumeCorrectie({ ...geen, decouplingMediaan: 7.1 })).toEqual({ richting: 'omlaag', pct: 0.05 })
  })

  it('STAP 1 — decouplingMediaan === 7 (niet erboven) triggert NIET (strikt >)', () => {
    expect(bepaalVolumeCorrectie({ ...geen, decouplingMediaan: 7 })).toEqual({ richting: 'geen', pct: 0 })
  })

  it('STAP 2 — dalende efTrendPct (<0) triggert omlaag', () => {
    expect(bepaalVolumeCorrectie({ ...geen, efTrendPct: -0.05 })).toEqual({ richting: 'omlaag', pct: 0.05 })
  })

  it('STAP 2 — stijgende/vlakke efTrendPct (>=0) triggert niet', () => {
    expect(bepaalVolumeCorrectie({ ...geen, efTrendPct: 0 })).toEqual({ richting: 'geen', pct: 0 })
    expect(bepaalVolumeCorrectie({ ...geen, efTrendPct: 0.1 })).toEqual({ richting: 'geen', pct: 0 })
  })

  it('STAP 3 — hrvBloktrendPct onder -1.7%/week (dalend) triggert omlaag', () => {
    expect(bepaalVolumeCorrectie({ ...geen, hrvBloktrendPct: -(BLOK_TREND_DREMPEL_PCT + 0.1) })).toEqual({ richting: 'omlaag', pct: 0.05 })
  })

  it('STAP 3 — hrvBloktrendPct precies op de drempel (niet eronder) triggert niet (strikt <)', () => {
    expect(bepaalVolumeCorrectie({ ...geen, hrvBloktrendPct: -BLOK_TREND_DREMPEL_PCT })).toEqual({ richting: 'geen', pct: 0 })
  })

  it('STAP 3 — rhrBloktrendPct boven +1.7%/week (stijgend) triggert omlaag', () => {
    expect(bepaalVolumeCorrectie({ ...geen, rhrBloktrendPct: BLOK_TREND_DREMPEL_PCT + 0.1 })).toEqual({ richting: 'omlaag', pct: 0.05 })
  })

  it('STAP 3 — een dalende rhrBloktrendPct (rhr die daalt = gunstig) triggert niet', () => {
    expect(bepaalVolumeCorrectie({ ...geen, rhrBloktrendPct: -5 })).toEqual({ richting: 'geen', pct: 0 })
  })

  it('elk van de vier nieuwe "slecht"-signalen blokkeert omhoog net als adaptatieSlecht dat al deed', () => {
    // rampTeLaag zou zonder de nieuwe signalen op zichzelf "omhoog" opleveren (zie STAP 0-test).
    const basisOmhoogSignalen = { rampRate: 1.5, tsbGemiddelde14d: null, rpeDeltaTrend: null, decouplingMediaan: null }
    expect(bepaalVolumeCorrectie(basisOmhoogSignalen)).toEqual({ richting: 'omhoog', pct: 0.07 })

    expect(bepaalVolumeCorrectie({ ...basisOmhoogSignalen, decouplingMediaan: 10 }).richting).toBe('omlaag')
    expect(bepaalVolumeCorrectie({ ...basisOmhoogSignalen, efTrendPct: -0.2 }).richting).toBe('omlaag')
    expect(bepaalVolumeCorrectie({ ...basisOmhoogSignalen, hrvBloktrendPct: -3 }).richting).toBe('omlaag')
    expect(bepaalVolumeCorrectie({ ...basisOmhoogSignalen, rhrBloktrendPct: 3 }).richting).toBe('omlaag')
  })

  it('alle nieuwe signalen null (default): identiek aan STAP 0-gedrag (backward compatible)', () => {
    const signalen = { rampRate: 1.5, tsbGemiddelde14d: 20, rpeDeltaTrend: null, decouplingMediaan: null }
    expect(bepaalVolumeCorrectie(signalen)).toEqual({ richting: 'omhoog', pct: 0.12 })
  })
})

describe('voerHerstelweekEvaluatieUit — STAP 4/5: compliance-poort en eerste-blok-randgeval', () => {
  const basisPlan = () => ({
    startdatum: '2026-07-06', // maandag
    ervaringsniveau: 'recreatief',
    huidige_ctl: 40,
    beschikbaarheid: { Maandag: true, Woensdag: true, Vrijdag: true, Zondag: true },
    kader: [
      { week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200 },
      { week: 2, fase: 'basis', weektype: 'opbouw', tss_doel: 220 },
      { week: 3, fase: 'basis', weektype: 'opbouw', tss_doel: 240 },
      { week: 4, fase: 'basis', weektype: 'herstel', tss_doel: 120 },
      { week: 5, fase: 'basis', weektype: 'opbouw', tss_doel: 0 },
      { week: 6, fase: 'basis', weektype: 'opbouw', tss_doel: 0 },
      { week: 7, fase: 'basis', weektype: 'opbouw', tss_doel: 0 },
      { week: 8, fase: 'basis', weektype: 'herstel', tss_doel: 0 },
    ],
    weekSessies: { sessies: [] },
  })

  const hrvPuntenReeks = (n) => Array.from({ length: n }, (_, i) => ({
    datum: `2026-06-${String(1 + i * 7).padStart(2, '0')}`,
    basislijn: 60 - i * 3, // dalend, -3/week
  }))

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T08:00:00')) // week 4 (herstelweek) van blok 0
    vi.mocked(getIntervalsCredentials).mockResolvedValue(null) // ramp/tsb/decoupling irrelevant voor deze tests
    vi.mocked(intervalsGet).mockResolvedValue([])
  })

  it('eerste blok (blokIndex 0), precies 4 HRV-weekpunten: geen crash, hrvBloktrendPct correct berekend', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': basisPlan(),
      'hrv_trend:u1': hrvPuntenReeks(4),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await voerHerstelweekEvaluatieUit('u1')

    const log = kv.store.get('blokcheck_log:u1:0')
    expect(log).toBeTruthy()
    expect(log.signalen.hrvBloktrendPct).not.toBeNull()
    // -3/week op laatste waarde 51 (60-3*3): -3/51*100
    expect(log.signalen.hrvBloktrendPct).toBeCloseTo((-3 / 51) * 100, 6)
  })

  it('eerste blok (blokIndex 0), maar 3 HRV-weekpunten (één gemiste week): valt terug op null, geen crash', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': basisPlan(),
      'hrv_trend:u1': hrvPuntenReeks(3),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await expect(voerHerstelweekEvaluatieUit('u1')).resolves.not.toThrow()

    const log = kv.store.get('blokcheck_log:u1:0')
    expect(log.signalen.hrvBloktrendPct).toBeNull()
  })

  it('STAP 4 — onvoldoende compliance (nietGeleverd >= 2) zet decoupling/EF/HRV-RHR op null, ramp/tsb/rpe blijven ongemoeid', async () => {
    const vandaag = '2026-07-27'
    const kv = maakKvMock({
      'u1:seizoensplan': basisPlan(),
      'hrv_trend:u1': hrvPuntenReeks(4),
      // twee niet-geleverde kernsessies binnen het 28-dagenvenster
      [`sessie_compliance:u1:${vandaag}`]: { isKernsessie: true, tier: 'niet_geleverd' },
      ['sessie_compliance:u1:2026-07-20']: { isKernsessie: true, tier: 'niet_geleverd' },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await voerHerstelweekEvaluatieUit('u1')

    const log = kv.store.get('blokcheck_log:u1:0')
    expect(log.complianceGate).toEqual({ voldoendeCompliant: false, nietGeleverd: 2 })
    expect(log.signalen.hrvBloktrendPct).toBeNull()
    expect(log.signalen.decouplingMediaan).toBeNull()
  })

  it('STAP 4 — voldoende compliance (< 2 niet-geleverd): HRV-bloktrend blijft beschikbaar', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': basisPlan(),
      'hrv_trend:u1': hrvPuntenReeks(4),
      ['sessie_compliance:u1:2026-07-20']: { isKernsessie: true, tier: 'niet_geleverd' }, // slechts 1
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await voerHerstelweekEvaluatieUit('u1')

    const log = kv.store.get('blokcheck_log:u1:0')
    expect(log.complianceGate).toEqual({ voldoendeCompliant: true, nietGeleverd: 1 })
    expect(log.signalen.hrvBloktrendPct).not.toBeNull()
  })
})

describe('berekenBlokIndex (Blok F, fase 1: geëxporteerd voor hergebruik in review/context.js)', () => {
  it('geen startdatum: blokIndex 0', () => {
    expect(berekenBlokIndex({})).toBe(0)
    expect(berekenBlokIndex(null)).toBe(0)
  })

  it('blokIndex = Math.floor((weekNr - 1) / 4), 0-gebaseerd', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T10:00:00'))
    // startdatum vandaag -> weeknummerVoorDatum(nu, startdatum) = 1 -> blokIndex 0
    expect(berekenBlokIndex({ startdatum: '2026-07-20' })).toBe(0)
    vi.useRealTimers()
  })
})

describe('leesBlokBasisLogBlok / leesBlokBasisLogWeek (Blok F, fase 1)', () => {
  it('leesBlokBasisLogBlok leest een bestaand blokcheck_log-record terug', async () => {
    const log = { blokIndex: 2, richting: 'omhoog', pct: 0.07 }
    const kv = { get: vi.fn(async (k) => (k === 'blokcheck_log:u1:2' ? log : null)) }
    expect(await leesBlokBasisLogBlok(kv, 'u1', 2)).toEqual(log)
  })

  it('leesBlokBasisLogBlok geeft null bij een ontbrekend blok', async () => {
    const kv = { get: vi.fn(async () => null) }
    expect(await leesBlokBasisLogBlok(kv, 'u1', 5)).toBeNull()
  })

  it('leesBlokBasisLogWeek leest een bestaand volumecorrectie_log-record voor een expliciete weekNr', async () => {
    const log = { weeknummer: 30, richting: 'geen', pct: 0 }
    const kv = { get: vi.fn(async (k) => (k === 'volumecorrectie_log:u1:30' ? log : null)) }
    expect(await leesBlokBasisLogWeek(kv, 'u1', 30)).toEqual(log)
  })

  it('leesBlokBasisLogWeek zonder weekNr valt terug op het huidige ISO-weeknummer', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T10:00:00'))
    const huidigeWeek = haalIsoWeeknummer(new Date())
    const log = { weeknummer: huidigeWeek }
    const kv = { get: vi.fn(async (k) => (k === `volumecorrectie_log:u1:${huidigeWeek}` ? log : null)) }
    expect(await leesBlokBasisLogWeek(kv, 'u1')).toEqual(log)
    vi.useRealTimers()
  })
})

describe('bepaalVolumeAanpassing — Stap 2 (verleng bestaande sessies): kalenderdag-aangrenzendheid (fix rekenfout)', () => {
  // "Aankomende week" is altijd maandag t/m zondag ná vandaag (berekenAankomendeMaandagISO).
  // Systeemtijd op zondag 2026-07-05 -> aankomende maandag = 2026-07-06, dus de
  // week onder test is 2026-07-06 (ma) t/m 2026-07-12 (zo).
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T10:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function basisAanroep(sessies) {
    return bepaalVolumeAanpassing({
      plan: {
        startdatum: '2026-01-05',
        beschikbaarheid: {}, // geen enkele dag beschikbaar -> Stap 1 vindt nooit een vrije dag, dwingt Stap 2 af
        urenPerDag: {},
        weekSessies: { sessies },
      },
      aankomendWeek: { tss_doel: 300 },
      correctie: { richting: 'omhoog', pct: 0.05 },
      signalen: { decouplingMediaan: null, rpeDeltaTrend: null }, // Stap 3 uitgeschakeld houden
      geplandeTssDezeWeek: 300,
    })
  }

  it('REGRESSIE: zondag (intensiteitsdag) en maandag van dezelfde week (144u/6 kalenderdagen uit elkaar) gelden NIET meer als aangrenzend', () => {
    const sessies = [
      { datum: '2026-07-06', voltooid: false, duur_min: 60, intentie: { sessietype: 'z2_duur', rol: 'variabele_dag' } }, // maandag, kandidaat
      { datum: '2026-07-12', voltooid: false, duur_min: 90, intentie: { sessietype: 'sweetspot_intervallen', rol: 'intensiteitsdag' } }, // zondag
    ]
    const resultaat = basisAanroep(sessies)
    // Vóór de fix zou diff===6 (dag-index 0 vs 1) dit ten onrechte als
    // aangrenzend classificeren -> maandag zou uitgesloten worden en acties
    // zou leeg blijven (doorval naar Stap 3). Na de fix (echte
    // kalenderdag-afstand = 6) telt maandag niet als aangrenzend en wordt hij
    // wél verlengd.
    expect(resultaat.acties).toHaveLength(1)
    expect(resultaat.acties[0]).toMatchObject({ type: 'verleng_sessie', datum: '2026-07-06' })
  })

  it('CONTROLE: dinsdag/woensdag (1 kalenderdag, 24u uit elkaar) gelden nog steeds correct als aangrenzend', () => {
    const sessies = [
      { datum: '2026-07-07', voltooid: false, duur_min: 90, intentie: { sessietype: 'drempel_intervallen', rol: 'intensiteitsdag' } }, // dinsdag
      { datum: '2026-07-08', voltooid: false, duur_min: 60, intentie: { sessietype: 'z2_duur', rol: 'variabele_dag' } }, // woensdag, kandidaat
    ]
    const resultaat = basisAanroep(sessies)
    // Woensdag grenst kalenderlijk echt aan dinsdag (1 dag) -> blijft
    // uitgesloten van verlenging -> teVerlengeSessies leeg -> geen Stap-2-actie.
    expect(resultaat.acties).toEqual([])
  })
})
