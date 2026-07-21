import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// E1: gerichte integratietest van het aanroeppunt in cron/sync/route.js
// (binnen het uitvoeringsscore-blok, regel ~476-515) — bevestigt het
// kostenprofiel (beslissing H): de streams-fetch gebeurt uitsluitend voor
// een gematchte, geplande sessie MET minstens één werk-segment. Zelfde
// mock-conventie als route.test.js/cpWprime-sync.test.js in dezelfde map —
// alleen de externe-IO-randen worden gemockt, de echte route-logica draait.
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/crypto', () => ({ decrypt: vi.fn((v) => v), encrypt: vi.fn((v) => v) }))
vi.mock('@/lib/qstash', () => ({ verifyQStash: vi.fn(async () => false) }))
vi.mock('@/lib/intervals', () => ({
  intervalsGet: vi.fn(),
  intervalsDelete: vi.fn(async () => ({})),
}))
vi.mock('@/lib/pushNotify', () => ({ sendPush: vi.fn(async () => {}) }))
vi.mock('@/lib/posthog', () => ({ logEvent: vi.fn() }))
vi.mock('@/lib/cronLog', () => ({ logCronRun: vi.fn(async () => {}) }))
vi.mock('@/lib/meldingen', () => ({ maakMelding: vi.fn(async () => {}) }))
vi.mock('@/lib/instorting', () => ({
  haalWattsStream: vi.fn(),
  detecteerMogelijkeInstorting: vi.fn(),
}))

import { getKV } from '@/lib/kv'
import { intervalsGet } from '@/lib/intervals'
import { haalWattsStream, detecteerMogelijkeInstorting } from '@/lib/instorting'
import { POST } from '../route.js'

process.env.ADMIN_SECRET = 'test-secret'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    mget: vi.fn(async (...keys) => keys.map(k => store.get(k) ?? null)),
    del: vi.fn(async (k) => { store.delete(k) }),
  }
}

function req() {
  return { headers: { get: (h) => h === 'authorization' ? 'Bearer test-secret' : null } }
}

const RITDATUM = '2026-07-14'

function basisPlan(sessie) {
  return {
    huidige_ftp: 265,
    start_profiel: { gemigreerd: true },
    weekSessies: { sessies: sessie ? [sessie] : [] },
  }
}

function basisSeed(plan) {
  return {
    'users:active': ['u1'],
    'user:u1:intervals_key': 'enc-key',
    'user:u1:athlete_id': 'athlete-1',
    'u1:seizoensplan': plan,
    'ef_backfill_voltooid:u1': true,
    'migratie:tss-bron:u1': true,
    'decoupling_backfill_voltooid:u1': true,
    'vo2max_suggestie_status:u1': 'getoond',
  }
}

function basisRit(overrides = {}) {
  return {
    id: 'rit-1',
    type: 'Ride',
    start_date_local: `${RITDATUM}T08:00:00`,
    moving_time: 3600,
    icu_training_load: 100,
    icu_weighted_avg_watts: 200,
    icu_intensity: 0.75,
    decoupling: 3.2,
    icu_zone_times: [{ id: 'Z2', secs: 3600 }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T10:00:00'))
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => '' })))
  vi.mocked(intervalsGet).mockReset()
  vi.mocked(haalWattsStream).mockReset().mockResolvedValue(null)
  vi.mocked(detecteerMogelijkeInstorting).mockReset().mockReturnValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('E1-kostenprofiel: streams-fetch alleen bij gematchte, geplande sessie MET werk-segment(en)', () => {
  it('sessie met minstens één werk-segment: haalWattsStream WORDT aangeroepen', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 80,
      duur_min: 60,
      intentie: { rol: 'intensiteitsdag', sessietype: 'sweetspot_intervallen', toegestane_zones: ['Z3'] },
      segmenten: [
        { type: 'werk', blokDuurSeconden: 1200, vermogenMin: 220, vermogenMax: 240 },
        { type: 'herstel', blokDuurSeconden: 300, vermogenMin: 150, vermogenMax: 170 },
      ],
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    const rit = basisRit()
    vi.mocked(intervalsGet).mockResolvedValueOnce([rit]).mockResolvedValue([])
    vi.mocked(haalWattsStream).mockResolvedValue([200, 210, 220])
    vi.mocked(detecteerMogelijkeInstorting).mockReturnValue({ mogelijkIngestort: false, waarschijnlijkIngestort: false, totaleTijdInZoneSeconden: 500, totaalGeplandSeconden: 1200 })

    await POST(req())

    expect(haalWattsStream).toHaveBeenCalledTimes(1)
    expect(haalWattsStream).toHaveBeenCalledWith('enc-key', 'athlete-1', 'rit-1')
    expect(detecteerMogelijkeInstorting).toHaveBeenCalledWith([200, 210, 220], sessie.segmenten, 3.2)
    expect(kv.store.get('segment_instorting:u1:rit-1')).toEqual({ mogelijkIngestort: false, waarschijnlijkIngestort: false, totaleTijdInZoneSeconden: 500, totaalGeplandSeconden: 1200 })
  })

  it('sessie ZONDER segmenten-veld (bv. een simpele duurrit): haalWattsStream wordt NIET aangeroepen', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 80,
      duur_min: 60,
      intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur', toegestane_zones: ['Z2'] },
      // geen segmenten-veld
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValueOnce([basisRit()]).mockResolvedValue([])

    await POST(req())

    expect(haalWattsStream).not.toHaveBeenCalled()
    expect(kv.store.has('segment_instorting:u1:rit-1')).toBe(false)
  })

  it('sessie met segmenten maar UITSLUITEND herstel-type (geen werk): haalWattsStream wordt NIET aangeroepen', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 30,
      duur_min: 30,
      intentie: { rol: 'hersteldag', sessietype: 'z1_herstel', toegestane_zones: ['Z1'] },
      segmenten: [{ type: 'herstel', blokDuurSeconden: 1800, vermogenMin: 100, vermogenMax: 120 }],
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValueOnce([basisRit()]).mockResolvedValue([])

    await POST(req())

    expect(haalWattsStream).not.toHaveBeenCalled()
  })

  it('geen gematchte, geplande sessie (ongeplande rit): haalWattsStream wordt NIET aangeroepen', async () => {
    const kv = maakKvMock(basisSeed(basisPlan(null))) // leeg weekSessies.sessies -> geen match
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValueOnce([basisRit()]).mockResolvedValue([])

    await POST(req())

    expect(haalWattsStream).not.toHaveBeenCalled()
  })

  it('haalWattsStream retourneert null (streams-fetch mislukt/leeg): detecteerMogelijkeInstorting wordt NIET aangeroepen, geen KV-write, geen crash', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 80,
      duur_min: 60,
      intentie: { rol: 'intensiteitsdag', sessietype: 'sweetspot_intervallen', toegestane_zones: ['Z3'] },
      segmenten: [{ type: 'werk', blokDuurSeconden: 1200, vermogenMin: 220, vermogenMax: 240 }],
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValueOnce([basisRit()]).mockResolvedValue([])
    vi.mocked(haalWattsStream).mockResolvedValue(null)

    const resp = await POST(req())

    expect(resp.status).toBe(200)
    expect(detecteerMogelijkeInstorting).not.toHaveBeenCalled()
    expect(kv.store.has('segment_instorting:u1:rit-1')).toBe(false)
  })
})

describe('E1: boost-check gebruikt nieuwste.decoupling (deze rit se eigen waarde), niet een baseline-mediaan', () => {
  it('i166071231-scenario: decoupling=28.533434 wordt rechtstreeks doorgegeven aan detecteerMogelijkeInstorting', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 132,
      duur_min: 120,
      intentie: { rol: 'intensiteitsdag', sessietype: 'sweetspot_intervallen', toegestane_zones: ['Z3'] },
      segmenten: [{ type: 'werk', blokDuurSeconden: 1380, vermogenMin: 220, vermogenMax: 240 }],
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    const rit = basisRit({ decoupling: 28.533434 })
    vi.mocked(intervalsGet).mockResolvedValueOnce([rit]).mockResolvedValue([])
    vi.mocked(haalWattsStream).mockResolvedValue([230, 230, 150])

    await POST(req())

    expect(detecteerMogelijkeInstorting).toHaveBeenCalledWith([230, 230, 150], sessie.segmenten, 28.533434)
  })

  it('nieuwste.decoupling ontbreekt (undefined/null in de respons): null wordt doorgegeven, geen crash', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 132,
      duur_min: 120,
      intentie: { rol: 'intensiteitsdag', sessietype: 'sweetspot_intervallen', toegestane_zones: ['Z3'] },
      segmenten: [{ type: 'werk', blokDuurSeconden: 1380, vermogenMin: 220, vermogenMax: 240 }],
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    const rit = basisRit({ decoupling: undefined })
    vi.mocked(intervalsGet).mockResolvedValueOnce([rit]).mockResolvedValue([])
    vi.mocked(haalWattsStream).mockResolvedValue([230, 230, 150])

    const resp = await POST(req())

    expect(resp.status).toBe(200)
    expect(detecteerMogelijkeInstorting).toHaveBeenCalledWith([230, 230, 150], sessie.segmenten, null)
  })
})
