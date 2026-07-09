import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))

import { getSessionUser } from '@/lib/auth'
import { getKV } from '@/lib/kv'
import { POST } from '../preview/route.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return { store, get: vi.fn(async (k) => store.get(k) ?? null), set: vi.fn(async () => {}) }
}

function req(body) {
  return { json: async () => body }
}

describe('POST /api/afwezigheid/preview', () => {
  it('401 zonder sessie', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    const resp = await POST(req({ startDatum: '2026-07-10', eindDatum: '2026-07-15' }))
    expect(resp.status).toBe(401)
  })

  it('400 zonder startDatum', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ id: 'u1' })
    const resp = await POST(req({ eindDatum: '2026-07-15' }))
    expect(resp.status).toBe(400)
  })

  it('telt geplande, niet-voltooide sessies in de opgegeven periode', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ id: 'u1' })
    const kv = maakKvMock({
      'u1:seizoensplan': {
        weekSessies: {
          sessies: [
            { datum: '2026-07-11', voltooid: false },
            { datum: '2026-07-12', voltooid: false },
            { datum: '2026-07-13', voltooid: true },
            { datum: '2026-07-20', voltooid: false },
          ],
        },
      },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req({ startDatum: '2026-07-10', eindDatum: '2026-07-15' }))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.data.aantal).toBe(2)
  })
})
