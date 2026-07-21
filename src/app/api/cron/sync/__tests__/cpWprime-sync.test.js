import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// D4: gerichte integratietest van het CP/W'-opslagblok in cron/sync/route.js
// (direct na regel 197, genest binnen het FTP-sync-blok 191-227) — draait de
// ECHTE POST-handler, mockt alleen de externe-IO-randen (KV, crypto,
// intervals.icu-HTTP, qstash, push/posthog/cronlog/meldingen), zelfde
// mock-conventie als route.test.js in dezelfde map.
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

import { getKV } from '@/lib/kv'
import { intervalsGet } from '@/lib/intervals'
import { POST } from '../route.js'

process.env.ADMIN_SECRET = 'test-secret'

const VANDAAG = '2026-07-15' // moet overeenkomen met vi.setSystemTime hieronder (woensdag: geen HRV-maandagpad)

function kloon(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}

// LET OP: get()/mget() geven een KLOON terug, geen live objectreferentie —
// zoals een echte KV-store (serialisatie over de wire). Zonder dit zou een
// in-place mutatie (bv. ftpUpdate.js:30 "plan.huidige_ftp = nieuweFtp") al
// zichtbaar zijn in de store vóórdat een eventuele daaropvolgende kv.set()
// daadwerkelijk (of juist NIET, bij een gesimuleerde storing) gecommit heeft
// — dat zou de isolatie-tests hieronder een fout-positief resultaat geven.
function maakKvMock(seed = {}, { throwOnSetKey = null } = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => kloon(store.get(k)) ?? null),
    set: vi.fn(async (k, v) => {
      if (throwOnSetKey && k === throwOnSetKey) throw new Error(`gesimuleerde KV-storing op ${k}`)
      store.set(k, kloon(v))
    }),
    mget: vi.fn(async (...keys) => keys.map(k => kloon(store.get(k)) ?? null)),
    del: vi.fn(async (k) => { store.delete(k) }),
  }
}

function req() {
  return { headers: { get: (h) => h === 'authorization' ? 'Bearer test-secret' : null } }
}

function basisPlan(overrides = {}) {
  return {
    huidige_ftp: 265,
    start_profiel: { gemigreerd: true },
    weekSessies: { sessies: [] }, // leeg -> geen sessie-matching, geen kader/startdatum -> geen fase-overgang/volume-eval
    ...overrides,
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
  }
}

function athleteResponse({ ftp = 265, mmpModel = null } = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      sportSettings: [
        { types: ['Ride', 'VirtualRide'], ftp, mmp_model: mmpModel },
      ],
    }),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T10:00:00'))
  vi.mocked(intervalsGet).mockReset()
  vi.mocked(intervalsGet).mockResolvedValue([]) // /activities -> geen ritten -> "no_new"-pad
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CP/W\'-opslag (D4) binnen het FTP-sync-blok', () => {
  it('mmp_model aanwezig, GEEN FTP-afwijking: punt wordt toegevoegd aan cp_wprime_trend:u1, plan.huidige_ftp blijft ongewijzigd', async () => {
    const mmpModel = { type: 'FFT_CURVES', criticalPower: 263, wPrime: 25600, pMax: 973, ftp: 269 }
    const kv = maakKvMock(basisSeed(basisPlan({ huidige_ftp: 265 })))
    vi.mocked(getKV).mockReturnValue(kv)
    vi.stubGlobal('fetch', vi.fn(async () => athleteResponse({ ftp: 265, mmpModel })))

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.success).toBe(true)
    expect(body.results).toContainEqual({ userId: 'u1', status: 'no_new' })
    expect(kv.store.get('cp_wprime_trend:u1')).toEqual([
      { datum: VANDAAG, criticalPower: 263, wPrime: 25600, pMax: 973, modelEftp: 269 },
    ])
    expect(kv.store.get('u1:seizoensplan').huidige_ftp).toBe(265) // ongewijzigd: 265 vs 265, geen afwijking
  })

  it('mmp_model null: geen write naar cp_wprime_trend, geen crash, EN de FTP-update-logica (regel ~220-224) blijft normaal werken', async () => {
    const kv = maakKvMock(basisSeed(basisPlan({ huidige_ftp: 265 })))
    vi.mocked(getKV).mockReturnValue(kv)
    // ftp=280 vs plan.huidige_ftp=265 -> verschil >1W -> FTP-update-if triggert wél
    vi.stubGlobal('fetch', vi.fn(async () => athleteResponse({ ftp: 280, mmpModel: null })))

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.success).toBe(true)
    expect(kv.store.has('cp_wprime_trend:u1')).toBe(false)
    expect(kv.store.get('u1:seizoensplan').huidige_ftp).toBe(280) // FTP-update liep gewoon door
  })

  it('fout in de nieuwe CP/W\'-stap (KV-storing) blokkeert de FTP-update-logica NIET', async () => {
    const mmpModel = { type: 'FFT_CURVES', criticalPower: 263, wPrime: 25600, pMax: 973, ftp: 269 }
    const kv = maakKvMock(basisSeed(basisPlan({ huidige_ftp: 265 })), { throwOnSetKey: 'cp_wprime_trend:u1' })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.stubGlobal('fetch', vi.fn(async () => athleteResponse({ ftp: 280, mmpModel })))

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.success).toBe(true) // geen crash van de hele run
    expect(kv.store.has('cp_wprime_trend:u1')).toBe(false) // write faalde, gevangen door [cp-wprime-sync]-catch
    expect(kv.store.get('u1:seizoensplan').huidige_ftp).toBe(280) // FTP-update liep alsnog door
  })

  it('vice versa: fout in de FTP-update-logica (verwerkFtpTest se KV-write) blokkeert de CP/W\'-write NIET', async () => {
    const mmpModel = { type: 'FFT_CURVES', criticalPower: 263, wPrime: 25600, pMax: 973, ftp: 269 }
    const kv = maakKvMock(basisSeed(basisPlan({ huidige_ftp: 265 })), { throwOnSetKey: 'u1:seizoensplan' })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.stubGlobal('fetch', vi.fn(async () => athleteResponse({ ftp: 280, mmpModel })))

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.success).toBe(true) // geen crash van de hele run
    expect(kv.store.get('cp_wprime_trend:u1')).toEqual([
      { datum: VANDAAG, criticalPower: 263, wPrime: 25600, pMax: 973, modelEftp: 269 },
    ]) // CP/W'-write is ongehinderd gelukt
    expect(kv.store.get('u1:seizoensplan').huidige_ftp).toBe(265) // FTP-update's eigen write faalde -> ongewijzigd gebleven
  })
})
