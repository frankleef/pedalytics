import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/pushNotify', () => ({ sendPush: vi.fn(async () => {}) }))
vi.mock('@/lib/qstash', () => ({ verifyQStash: vi.fn(async () => false) }))
vi.mock('@/lib/hrv/verwerking', () => ({ verwerkSchrappen: vi.fn(async () => {}) }))
vi.mock('@/lib/hrv/opportunistisch', () => ({ bepaalOpportunistischeTraining: vi.fn(() => null) }))
vi.mock('@/lib/hrv/trend', () => ({
  berekenHrvBaseline: vi.fn(() => null),
  berekenHrvTrend: vi.fn(() => null),
  verwerkHrvTrend: vi.fn(async () => null),
}))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn(async () => ({ apiKey: 'k', athleteId: 'a' })) }))
vi.mock('@/lib/intervals', () => ({ intervalsGet: vi.fn(async () => []) }))
vi.mock('@/lib/posthog', () => ({ logEvent: vi.fn() }))
vi.mock('@/lib/cronLog', () => ({ logCronRun: vi.fn(async () => {}) }))
vi.mock('@/lib/meldingen', () => ({ maakMelding: vi.fn(async () => {}) }))
vi.mock('@/lib/afwezigheid', () => ({ verwerkTerugkeerDetectie: vi.fn(async () => null) }))
vi.mock('@/lib/hrv/notificatie', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    checkNotificatieLimiet: vi.fn(),
    verhoogNotificatieTeller: vi.fn(async () => {}),
  }
})

import { getKV } from '@/lib/kv'
import { sendPush } from '@/lib/pushNotify'
import { verwerkSchrappen } from '@/lib/hrv/verwerking'
import { intervalsGet } from '@/lib/intervals'
import { checkNotificatieLimiet, verhoogNotificatieTeller } from '@/lib/hrv/notificatie'
import { vandaagISO } from '@/lib/datum'
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

function hrvProfiel({ rood_drempel = 40, geel_drempel = 50, basislijn_28d = 60, sd_90d = 8 } = {}) {
  return { betrouwbaar: true, rood_drempel, geel_drempel, basislijn_28d, sd_90d }
}

const VANDAAG = vandaagISO()

function seedPlan(sessietype) {
  return {
    weekSessies: { sessies: [{ datum: VANDAAG, tss: 80, intentie: { sessietype } }] },
  }
}

beforeEach(() => {
  vi.mocked(sendPush).mockClear()
  vi.mocked(verwerkSchrappen).mockClear()
  vi.mocked(checkNotificatieLimiet).mockReset()
  vi.mocked(verhoogNotificatieTeller).mockClear()
  vi.mocked(intervalsGet).mockReset()
})

describe('checkNotificatieLimiet-ontkoppeling voor rood (B1)', () => {
  it('rood: push wordt verstuurd én verwerkSchrappen aangeroepen, ook als checkNotificatieLimiet false teruggeeft', async () => {
    vi.mocked(intervalsGet).mockResolvedValue([{ hrv: 35 }]) // < rood_drempel(40) -> rood
    vi.mocked(checkNotificatieLimiet).mockResolvedValue(false) // limiet al bereikt

    const kv = maakKvMock({
      'users:active': ['u1'],
      [`u1:checkin:${VANDAAG}`]: { score: 3 }, // voorkomt de "Goedemorgen"-push, ruist anders assertions
      'hrv-profiel:u1': hrvProfiel(),
      'u1:seizoensplan': seedPlan('z2_duur'), // aerobe dag -> rood_aeroob, sturen:true
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await POST(req())

    expect(verwerkSchrappen).toHaveBeenCalledTimes(1)
    expect(sendPush).toHaveBeenCalledWith('u1', expect.objectContaining({ tag: 'hrv-advies' }))
    expect(verhoogNotificatieTeller).toHaveBeenCalledWith('u1')
  })

  it('geel: bestaande limiet blijft van kracht — bij checkNotificatieLimiet=false wordt geen hrv-advies-push verstuurd en verwerkSchrappen niet aangeroepen', async () => {
    vi.mocked(intervalsGet).mockResolvedValue([{ hrv: 45 }]) // tussen geel(50) en rood(40) -> geel
    vi.mocked(checkNotificatieLimiet).mockResolvedValue(false)

    const kv = maakKvMock({
      'users:active': ['u1'],
      [`u1:checkin:${VANDAAG}`]: { score: 3 },
      'hrv-profiel:u1': hrvProfiel(),
      'u1:seizoensplan': seedPlan('sweetspot_intervallen'), // intensiteitsdag -> geel_intensiteit, sturen:true
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await POST(req())

    expect(verwerkSchrappen).not.toHaveBeenCalled()
    const hrvAdviesCalls = vi.mocked(sendPush).mock.calls.filter(([, payload]) => payload?.tag === 'hrv-advies')
    expect(hrvAdviesCalls).toHaveLength(0)
  })

  it('geel: bestaand gedrag ongewijzigd — bij checkNotificatieLimiet=true wordt de push wél verstuurd', async () => {
    vi.mocked(intervalsGet).mockResolvedValue([{ hrv: 45 }])
    vi.mocked(checkNotificatieLimiet).mockResolvedValue(true)

    const kv = maakKvMock({
      'users:active': ['u1'],
      [`u1:checkin:${VANDAAG}`]: { score: 3 },
      'hrv-profiel:u1': hrvProfiel(),
      'u1:seizoensplan': seedPlan('sweetspot_intervallen'),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await POST(req())

    expect(verwerkSchrappen).not.toHaveBeenCalled()
    expect(sendPush).toHaveBeenCalledWith('u1', expect.objectContaining({ tag: 'hrv-advies' }))
    expect(checkNotificatieLimiet).toHaveBeenCalledWith('u1')
  })

  it('rood: checkNotificatieLimiet wordt voor het rood-pad niet eens aangeroepen', async () => {
    vi.mocked(intervalsGet).mockResolvedValue([{ hrv: 35 }])

    const kv = maakKvMock({
      'users:active': ['u1'],
      [`u1:checkin:${VANDAAG}`]: { score: 3 },
      'hrv-profiel:u1': hrvProfiel(),
      'u1:seizoensplan': seedPlan('z2_duur'),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await POST(req())

    expect(checkNotificatieLimiet).not.toHaveBeenCalled()
  })
})
