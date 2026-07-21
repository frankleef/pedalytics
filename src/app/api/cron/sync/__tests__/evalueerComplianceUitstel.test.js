import { describe, it, expect, vi, beforeEach } from 'vitest'

// Geïsoleerde unit-test van de gedeelde evaluatie-slice (route.js): dedup-
// gate-lezing + evalueerComplianceGate-aanroep + cache-write-bij-uitstel,
// losgetrokken van zowel de vroege-return-tak-helper als het volledige pad
// (die de guard/schrijf-afhandeling apart houden — zie route.js). Eigen
// mock van @/lib/sessie/compliance (i.p.v. de "echte module" die
// route.test.js bewust gebruikt) zodat evalueerComplianceGate's
// retourwaarde hier direct stuurbaar is per scenario.
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/crypto', () => ({ decrypt: vi.fn((v) => v), encrypt: vi.fn((v) => v) }))
vi.mock('@/lib/qstash', () => ({ verifyQStash: vi.fn(async () => false) }))
vi.mock('@/lib/intervals', () => ({ intervalsGet: vi.fn(), intervalsDelete: vi.fn(async () => ({})) }))
vi.mock('@/lib/pushNotify', () => ({ sendPush: vi.fn(async () => {}) }))
vi.mock('@/lib/posthog', () => ({ logEvent: vi.fn() }))
vi.mock('@/lib/cronLog', () => ({ logCronRun: vi.fn(async () => {}) }))
vi.mock('@/lib/meldingen', () => ({ maakMelding: vi.fn(async () => {}) }))
vi.mock('@/lib/sessie/compliance', () => ({
  bepaalComplianceRecord: vi.fn(),
  evalueerComplianceGate: vi.fn(),
}))

import { evalueerComplianceGate } from '@/lib/sessie/compliance'
import { evalueerComplianceUitstel } from '../route.js'

process.env.ADMIN_SECRET = 'test-secret'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

beforeEach(() => {
  vi.mocked(evalueerComplianceGate).mockReset()
})

describe('evalueerComplianceUitstel (gedeelde evaluatie-slice, cron/sync/route.js)', () => {
  it('(a) cached: {uitstel:false}, evalueerComplianceGate wordt niet aangeroepen', async () => {
    const kv = maakKvMock({ 'compliance_check:u1:3': { nietGeleverd: 2, uitstel: true } })
    const plan = { compliance_verlengd_count: 0 }

    const resultaat = await evalueerComplianceUitstel(kv, 'u1', plan, 3)

    expect(resultaat).toEqual({ uitstel: false })
    expect(evalueerComplianceGate).not.toHaveBeenCalled()
    expect(kv.set).not.toHaveBeenCalled()
  })

  it('(b) niet-cached, evalueerComplianceGate geeft geen uitstel: {uitstel:false}, geen kv.set', async () => {
    vi.mocked(evalueerComplianceGate).mockResolvedValue({ uitstel: false, nietGeleverd: 1 })
    const kv = maakKvMock({})
    const plan = { compliance_verlengd_count: 0 }

    const resultaat = await evalueerComplianceUitstel(kv, 'u1', plan, 3)

    expect(resultaat).toEqual({ uitstel: false })
    expect(evalueerComplianceGate).toHaveBeenCalledWith('u1', plan, 0)
    expect(kv.set).not.toHaveBeenCalled()
  })

  it('(c) niet-cached, wél uitstel: {uitstel:true, nietGeleverd}, kv.set correct aangeroepen', async () => {
    vi.mocked(evalueerComplianceGate).mockResolvedValue({ uitstel: true, nietGeleverd: 3 })
    const kv = maakKvMock({})
    const plan = { compliance_verlengd_count: 1 }

    const resultaat = await evalueerComplianceUitstel(kv, 'u1', plan, 3)

    expect(resultaat).toEqual({ uitstel: true, nietGeleverd: 3 })
    expect(evalueerComplianceGate).toHaveBeenCalledWith('u1', plan, 1)
    expect(kv.set).toHaveBeenCalledWith('compliance_check:u1:3', { nietGeleverd: 3, uitstel: true }, { ex: 14 * 86400 })
  })
})
