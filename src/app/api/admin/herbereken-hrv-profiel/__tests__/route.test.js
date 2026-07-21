import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn() }))
vi.mock('@/lib/intervals', () => ({ intervalsGet: vi.fn() }))

import { getKV } from '@/lib/kv'
import { getIntervalsCredentials } from '@/lib/users'
import { intervalsGet } from '@/lib/intervals'
import { POST } from '../route.js'

process.env.ADMIN_SECRET = 'test-secret'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

function req(auth = 'Bearer test-secret') {
  return { headers: { get: (h) => h === 'authorization' ? auth : null } }
}

function maakWellnessFixture() {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `2026-06-${String(i + 1).padStart(2, '0')}`,
    hrv: 60,
    restingHR: 50,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/admin/herbereken-hrv-profiel — regressie ná B2-verwijdering van herstelsnelheid', () => {
  it('401 zonder correcte auth', async () => {
    const resp = await POST(req('Bearer verkeerd'))
    expect(resp.status).toBe(401)
  })

  it('404 zonder credentials', async () => {
    vi.mocked(getIntervalsCredentials).mockResolvedValue(null)
    const resp = await POST(req())
    expect(resp.status).toBe(404)
  })

  it('basisprofiel, correlatie en checkin-gewichten blijven werken; herstelsnelheid is volledig verdwenen uit de response en de KV-write', async () => {
    const kv = maakKvMock({ 'hrv-profiel:u_frank_001': null, 'hrv-observaties:u_frank_001': [] })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'test', athleteId: 'a1' })
    vi.mocked(intervalsGet).mockImplementation(async (pad) => {
      if (pad === '/wellness') return maakWellnessFixture()
      if (pad === '/activities') return [] // geen ritten -> hrv_rpe_correlatie blijft {coeff:null, betrouwbaar:false}, geen crash
      return []
    })

    const resp = await POST(req())
    const body = await resp.json()

    expect(resp.status).toBe(200)
    // Basisprofiel: blijft aanwezig en betrouwbaar (20 hrv-punten, >=14).
    expect(body.profiel.basislijn_28d).toBeDefined()
    expect(body.profiel.betrouwbaar).toBe(true)
    // Correlatie en checkin-gewichten: ongewijzigd aanwezig.
    expect(body.profiel.hrv_rpe_correlatie).toEqual({ coeff: null, observaties: 0, betrouwbaar: false })
    expect(body.profiel.hrv_checkin_gewichten).toBeDefined()
    expect(body.profiel.checkin_actief).toBe(true)

    // Herstelsnelheid: volledig verdwenen, zowel uit de response-payload als de KV-write.
    expect(body.profiel.herstelsnelheid).toBeUndefined()
    expect(body.voltooide_sessies).toBeUndefined()
    expect(body.observaties_herstelsnelheid).toBeUndefined()
    expect(body.observaties_correlatie).toBe(0)

    const geschreven = kv.store.get('hrv-profiel:u_frank_001')
    expect(geschreven.herstelsnelheid).toBeUndefined()
  })

  it('regressie: rhr_basislijn_28d (B6) en een bestaande herstelsnelheid (B2, cron-beheerd) blijven intact na deze route', async () => {
    const bestaandProfiel = {
      basislijn_28d: 55, sd_90d: 7, rood_drempel: 41, geel_drempel: 48, modus: 'persoonlijk', betrouwbaar: true,
      rhr_basislijn_28d: 47, // B6 — deze route berekent dit zelf niet
      herstelsnelheid: { sweetspot_intervallen: { dagen: 1.5, observaties: 12 }, versie: 2 }, // B2 — alleen door de cron bijgewerkt
    }
    const kv = maakKvMock({ 'hrv-profiel:u_frank_001': bestaandProfiel, 'hrv-observaties:u_frank_001': [] })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'test', athleteId: 'a1' })
    vi.mocked(intervalsGet).mockImplementation(async (pad) => {
      if (pad === '/wellness') return maakWellnessFixture()
      if (pad === '/activities') return []
      return []
    })

    const resp = await POST(req())
    const body = await resp.json()

    expect(resp.status).toBe(200)
    // De route herberekent basislijn_28d zelf (ongedempt, huidigProfiel: null) -> mag afwijken van de oude 55.
    expect(body.profiel.basislijn_28d).toBeDefined()
    // Maar velden die deze route niet zelf beheert, blijven ongewijzigd staan.
    expect(body.profiel.rhr_basislijn_28d).toBe(47)
    expect(body.profiel.herstelsnelheid).toEqual({ sweetspot_intervallen: { dagen: 1.5, observaties: 12 }, versie: 2 })

    const geschreven = kv.store.get('hrv-profiel:u_frank_001')
    expect(geschreven.rhr_basislijn_28d).toBe(47)
    expect(geschreven.herstelsnelheid).toEqual({ sweetspot_intervallen: { dagen: 1.5, observaties: 12 }, versie: 2 })
  })
})
