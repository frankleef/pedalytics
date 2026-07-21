import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))

import { getSessionUser } from '@/lib/auth'
import { getKV } from '@/lib/kv'
import { _wisWbalDrempelsCacheVoorTests, STANDAARD_WBAL_DREMPELS, WBAL_DREMPELS_KV_KEY } from '@/lib/wbalDrempels'
import { GET, PUT } from '../route.js'

const ADMIN = { id: 'u_frank_001' }
const NIET_ADMIN = { id: 'iemand_anders' }

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

function req(body) {
  return { json: async () => body }
}

beforeEach(() => {
  _wisWbalDrempelsCacheVoorTests()
  vi.mocked(getSessionUser).mockReset()
})

describe('GET /api/admin/wbal-drempels', () => {
  it('403 zonder admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(NIET_ADMIN)
    const resp = await GET()
    expect(resp.status).toBe(403)
  })

  it('geeft de standaardwaarden terug als er nog niets in KV staat', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await GET()
    const data = await resp.json()
    expect(data).toEqual({ success: true, data: STANDAARD_WBAL_DREMPELS })
  })

  it('geeft de opgeslagen waarden terug', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    const kv = maakKvMock({ [WBAL_DREMPELS_KV_KEY]: { depletiePct: 55, herstelPct: 80 } })
    vi.mocked(getKV).mockReturnValue(kv)
    const resp = await GET()
    const data = await resp.json()
    expect(data).toEqual({ success: true, data: { depletiePct: 55, herstelPct: 80 } })
  })
})

describe('PUT /api/admin/wbal-drempels', () => {
  it('403 zonder admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(NIET_ADMIN)
    const resp = await PUT(req({ depletiePct: 55, herstelPct: 80 }))
    expect(resp.status).toBe(403)
  })

  it('weigert een ongeldige depletiePct/herstelPct', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())

    const respTeHoog = await PUT(req({ depletiePct: 150, herstelPct: 75 }))
    expect(respTeHoog.status).toBe(400)

    const respGeenGetal = await PUT(req({ depletiePct: 60, herstelPct: 'veel' }))
    expect(respGeenGetal.status).toBe(400)

    const respNul = await PUT(req({ depletiePct: 0, herstelPct: 75 }))
    expect(respNul.status).toBe(400)
  })

  it('schrijft naar KV en de cache-invalidatie zorgt dat de wijziging direct zichtbaar is (niet pas na 5 min)', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)

    // Eerst ophalen (vult de cache met de standaardwaarden)
    const eersteGet = await GET()
    expect((await eersteGet.json()).data).toEqual(STANDAARD_WBAL_DREMPELS)

    const putResp = await PUT(req({ depletiePct: 55, herstelPct: 80 }))
    const putData = await putResp.json()
    expect(putData).toEqual({ success: true, data: { depletiePct: 55, herstelPct: 80 } })
    expect(kv.store.get(WBAL_DREMPELS_KV_KEY)).toEqual({ depletiePct: 55, herstelPct: 80 })

    // Zonder cache-invalidatie zou dit binnen de TTL nog de oude waarde tonen
    const tweedeGet = await GET()
    const tweedeData = await tweedeGet.json()
    expect(tweedeData.data).toEqual({ depletiePct: 55, herstelPct: 80 })
  })
})
