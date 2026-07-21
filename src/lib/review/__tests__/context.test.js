import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../kv.js', () => ({ getKV: vi.fn() }))
vi.mock('../../users.js', () => ({ getIntervalsCredentials: vi.fn() }))
vi.mock('../../intervals.js', () => ({ intervalsGet: vi.fn() }))

import { getKV } from '../../kv.js'
import { getIntervalsCredentials } from '../../users.js'
import { intervalsGet } from '../../intervals.js'
import { haalIsoWeeknummer, berekenBlokIndex } from '../../volumeCorrectie.js'
import { haalHerstelsnelheidSignaal, verzamelReviewContext } from '../context.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    mget: vi.fn(async (...keys) => keys.map(k => store.get(k) ?? null)),
  }
}

function maakPlan(overrides = {}) {
  return {
    startdatum: '2026-01-05',
    kader: [],
    weekSessies: {
      sessies: [
        { datum: '2026-07-18', voltooid: true, intentie: { sessietype: 'drempel_intervallen' }, intervalsEventId: 'act1' },
        { datum: '2026-07-10', voltooid: true, intentie: { sessietype: 'z2_duur' }, intervalsEventId: 'act2' },
      ],
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-20T10:00:00'))
})

describe('haalHerstelsnelheidSignaal (signaal 6 — geen persistentie, live wellness-fetch, FAIL-OPEN VERPLICHT)', () => {
  it('geen (recente) zware sessie in plan: trigger false, geen enkele externe call', async () => {
    const kv = maakKvMock()
    const resultaat = await haalHerstelsnelheidSignaal(kv, 'u1', { weekSessies: { sessies: [] } })
    expect(resultaat).toEqual({ trigger: false, zwareSessieDatum: null })
    expect(getIntervalsCredentials).not.toHaveBeenCalled()
  })

  it('geen intervals.icu-credentials: trigger false, zwareSessieDatum blijft bekend, geen wellness-fetch', async () => {
    getIntervalsCredentials.mockResolvedValue(null)
    const kv = maakKvMock()
    const resultaat = await haalHerstelsnelheidSignaal(kv, 'u1', maakPlan())
    expect(resultaat).toEqual({ trigger: false, zwareSessieDatum: '2026-07-18' })
    expect(intervalsGet).not.toHaveBeenCalled()
  })

  it('FAIL-OPEN: wellness-fetch faalt (intervals.icu 500) -> {trigger:false, zwareSessieDatum:null}, geen crash', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    intervalsGet.mockRejectedValue(new Error('intervals.icu 500'))
    const kv = maakKvMock()
    const resultaat = await haalHerstelsnelheidSignaal(kv, 'u1', maakPlan())
    expect(resultaat).toEqual({ trigger: false, zwareSessieDatum: null })
  })

  it('happy path: HRV < 90% van de schone referentie -> trigger true', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    const wellnessData = [
      { id: '2026-07-01', hrv: 50 }, { id: '2026-07-02', hrv: 50 }, { id: '2026-07-03', hrv: 50 },
      { id: '2026-07-04', hrv: 50 }, { id: '2026-07-05', hrv: 50 }, { id: '2026-07-06', hrv: 50 },
      { id: '2026-07-07', hrv: 50 }, // 7 punten vóór de zware sessie (07-18) -> schoneReferentie = 50
      { id: '2026-07-20', hrv: 40 }, // vandaag, na de sessie -> huidigeHrv = 40 < 50*0.90=45
    ]
    intervalsGet.mockResolvedValue(wellnessData)
    const kv = maakKvMock({ 'hrv-profiel:u1': null })
    const resultaat = await haalHerstelsnelheidSignaal(kv, 'u1', maakPlan())
    expect(resultaat).toEqual({ trigger: true, zwareSessieDatum: '2026-07-18' })
  })
})

describe('verzamelReviewContext (Blok F, fase 1)', () => {
  function seedAlleSignalen(plan) {
    const blokIndex = berekenBlokIndex(plan)
    const huidigeWeek = haalIsoWeeknummer(new Date())
    return maakKvMock({
      'hrv-profiel:u1': null,
      'compliance_freeze:u1': { actief: false, laatsteTriggerDatum: null },
      'week_voorzichtig:u1': { actief: true, laatsteTriggerDatum: '2026-07-19' },
      'hrv_trend:u1': [
        { datum: '2026-07-01', basislijn: 60 }, { datum: '2026-07-08', basislijn: 58 },
        { datum: '2026-07-15', basislijn: 56 }, { datum: '2026-07-20', basislijn: 54 },
      ],
      'rhr_trend:u1': [
        { datum: '2026-07-01', basislijn: 50 }, { datum: '2026-07-08', basislijn: 51 },
        { datum: '2026-07-15', basislijn: 52 }, { datum: '2026-07-20', basislijn: 53 },
      ],
      'rpe_trend:u1': 0.4,
      [`volumecorrectie_log:u1:${huidigeWeek}`]: { weeknummer: huidigeWeek, richting: 'geen', pct: 0 },
      'decoupling_baseline:u1': { mediaan: 4.1, trend: -0.2, aantalMetingen: 8, bijgewerkt: '2026-07-19T08:00:00.000Z' },
      'ef_trend:u1:z2': [{ datum: '2026-07-10', ef: 1.5 }],
      'ef_trend:u1:sweetspot': [{ datum: '2026-07-12', ef: 1.6 }],
      'ef_trend:u1:drempel': [],
      'ef_trend:u1:vo2max': [],
      [`blokcheck_log:u1:${blokIndex}`]: { blokIndex, richting: 'omhoog', pct: 0.07 },
      'cp_wprime_trend:u1': [{ datum: '2026-07-01', criticalPower: 250, wPrime: 20000, pMax: 900, modelEftp: 245 }],
      'fitnessprogressie:u1': { ctlTrend: { status: 'ok' }, decouplingTrend: { status: 'ok' } },
      // segment-instorting: act1 aanwezig, act2 BEWUST ontbrekend (niet-geanalyseerde duurrit).
      'segment_instorting:u1:act1': { mogelijkIngestort: true, waarschijnlijkIngestort: false },
    })
  }

  it('alle 15 signalen (conditiescore uitgesloten) zijn aanwezig in de juiste tijdschaal-groep, EF-trend gemarkeerd als monitoring-only', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    intervalsGet.mockImplementation(async (pad) => (pad === '/wellness'
      ? [{ id: '2026-07-01', hrv: 50 }, { id: '2026-07-02', hrv: 50 }, { id: '2026-07-03', hrv: 50 },
         { id: '2026-07-04', hrv: 50 }, { id: '2026-07-05', hrv: 50 }, { id: '2026-07-06', hrv: 50 },
         { id: '2026-07-07', hrv: 50 }, { id: '2026-07-20', hrv: 48 }]
      : []))

    const plan = maakPlan()
    const kv = seedAlleSignalen(plan)
    vi.mocked(getKV).mockReturnValue(kv)

    const context = await verzamelReviewContext(kv, 'u1', plan)

    // korteTermijn: freeze-status, week_voorzichtig, monotonie/strain, herstelsnelheid, segment-instorting
    expect(context.korteTermijn.freezeStatus).toEqual({ actief: false })
    expect(context.korteTermijn.weekVoorzichtig).toBe(true)
    expect(context.korteTermijn.monotonieStrain).toEqual(expect.objectContaining({ trigger: expect.any(Boolean) }))
    expect(context.korteTermijn.herstelsnelheid).toEqual(expect.objectContaining({ trigger: expect.any(Boolean) }))
    expect(context.korteTermijn.segmentInstorting).toEqual([
      { activiteitId: 'act1', instorting: { mogelijkIngestort: true, waarschijnlijkIngestort: false } },
    ]) // act2 ontbreekt fail-open, geen crash

    // middenTermijn: compliance-venster, HRV-trend, RHR-trend, RPE-trend, blok-basis-log[week], decoupling-baseline, EF-trend
    expect(context.middenTermijn.complianceVenster).toEqual(expect.objectContaining({ vensterDagen: 10 }))
    expect(context.middenTermijn.hrvTrend.punten).toHaveLength(4)
    expect(context.middenTermijn.rhrTrend.punten).toHaveLength(4)
    expect(context.middenTermijn.rpeTrend).toBe(0.4)
    expect(context.middenTermijn.blokBasisLogWeek).toEqual(expect.objectContaining({ richting: 'geen' }))
    expect(context.middenTermijn.decouplingBaseline).toEqual(expect.objectContaining({ mediaan: 4.1 }))
    expect(context.middenTermijn.efTrend).toEqual({
      z2: [{ datum: '2026-07-10', ef: 1.5 }],
      sweetspot: [{ datum: '2026-07-12', ef: 1.6 }],
      drempel: [],
      vo2max: [],
      monitoringOnly: true,
    })

    // langeTermijn: blok-basis-log[blok], CP/W'-trend, fitnessprogressie
    expect(context.langeTermijn.blokBasisLogBlok).toEqual(expect.objectContaining({ richting: 'omhoog' }))
    expect(context.langeTermijn.cpWprimeTrend).toHaveLength(1)
    expect(context.langeTermijn.fitnessprogressie).toEqual(expect.objectContaining({ ctlTrend: { status: 'ok' } }))

    // conditiescore mag nergens in voorkomen
    const platteJson = JSON.stringify(context)
    expect(platteJson).not.toMatch(/conditieScore|conditie_score/)
  })

  it('FAIL-OPEN: falende wellness-fetch (signaal 6) blokkeert de overige signalen niet', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    intervalsGet.mockImplementation(async (pad) => {
      if (pad === '/wellness') throw new Error('intervals.icu 500')
      return []
    })

    const plan = maakPlan()
    const kv = seedAlleSignalen(plan)
    vi.mocked(getKV).mockReturnValue(kv)

    const context = await verzamelReviewContext(kv, 'u1', plan)

    expect(context.korteTermijn.herstelsnelheid).toEqual({ trigger: false, zwareSessieDatum: null })
    // de rest van de context blijft gewoon gevuld, geen cascade-failure
    expect(context.middenTermijn.decouplingBaseline).toEqual(expect.objectContaining({ mediaan: 4.1 }))
    expect(context.langeTermijn.fitnessprogressie).toEqual(expect.objectContaining({ ctlTrend: { status: 'ok' } }))
  })

  it('FAIL-OPEN: ontbrekende segment_instorting-keys (signaal 16) geven een lege/gefilterde lijst, geen crash', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    intervalsGet.mockResolvedValue([])

    const plan = maakPlan()
    // Geen enkele segment_instorting-key geseed -> beide activiteitIds missen.
    const kv = maakKvMock({ 'hrv-profiel:u1': null })
    vi.mocked(getKV).mockReturnValue(kv)

    const context = await verzamelReviewContext(kv, 'u1', plan)

    expect(context.korteTermijn.segmentInstorting).toEqual([])
  })

  it('FAIL-OPEN: een kv.get die throwt voor een individueel signaal blokkeert de andere signalen niet', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    intervalsGet.mockResolvedValue([])

    const plan = maakPlan()
    const kv = seedAlleSignalen(plan)
    // decoupling_baseline-lezing laten falen (bv. netwerkfout) — de rest van kv blijft werken.
    const origineleGet = kv.get
    kv.get = vi.fn(async (k) => {
      if (k === 'decoupling_baseline:u1') throw new Error('kv timeout')
      return origineleGet(k)
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const context = await verzamelReviewContext(kv, 'u1', plan)

    expect(context.middenTermijn.decouplingBaseline).toBeNull()
    expect(context.langeTermijn.fitnessprogressie).toEqual(expect.objectContaining({ ctlTrend: { status: 'ok' } }))
  })
})
