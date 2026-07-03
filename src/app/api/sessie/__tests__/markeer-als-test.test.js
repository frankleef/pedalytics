import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn() }))
vi.mock('@/lib/intervals', () => ({ intervalsGet: vi.fn() }))
vi.mock('@/lib/sessie/ftpUpdate', () => ({ verwerkFtpTest: vi.fn() }))

import { getSessionUser } from '@/lib/auth'
import { getKV } from '@/lib/kv'
import { getIntervalsCredentials } from '@/lib/users'
import { intervalsGet } from '@/lib/intervals'
import { verwerkFtpTest } from '@/lib/sessie/ftpUpdate'

import { PUT as PUT_markeerAlsTest } from '../markeer-als-test/route.js'

const USER = { id: 'u_test' }

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

function putReq(body) {
  return { json: async () => body }
}

function bouwPlan(overrides = {}) {
  return {
    huidige_ftp: 265,
    weekSessies: { sessies: [] },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSessionUser).mockResolvedValue(USER)
  vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
  vi.mocked(intervalsGet).mockResolvedValue({
    id: 'act_1', name: 'Ochtendrit', moving_time: 1980, icu_training_load: 88, icu_ftp: 290,
  })
  vi.mocked(verwerkFtpTest).mockResolvedValue({ updated: true, oldFtp: 265, newFtp: 290 })
})

describe('PUT /api/sessie/markeer-als-test', () => {
  it('labelt de rit als ramp_test en roept verwerkFtpTest aan wanneer verwerkFtp niet expliciet uitgezet is', async () => {
    const kv = maakKvMock({ 'u_test:seizoensplan': bouwPlan() })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await PUT_markeerAlsTest(putReq({ datum: '2026-01-07', activiteitId: 'act_1' }))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.data.intentie.rol).toBe('ftp_test')
    expect(body.data.intentie.sessietype).toBe('ramp_test')
    expect(body.data.voltooid).toBe(true)
    expect(body.data.duur_min).toBe(33) // 1980s / 60
    expect(body.data.tss).toBe(88)
    expect(body.data.intervalsActiviteitId).toBe('act_1')

    expect(verwerkFtpTest).toHaveBeenCalledTimes(1)
    expect(verwerkFtpTest).toHaveBeenCalledWith('u_test', expect.objectContaining({ id: 'act_1' }))
    expect(body.ftpUpdate).toEqual({ updated: true, oldFtp: 265, newFtp: 290 })

    const opgeslagenPlan = kv.store.get('u_test:seizoensplan')
    expect(opgeslagenPlan.weekSessies.sessies).toHaveLength(1)
    expect(opgeslagenPlan.weekSessies.sessies[0].datum).toBe('2026-01-07')
  })

  it('slaat verwerkFtpTest expliciet over wanneer verwerkFtp:false (FTP al handmatig bijgewerkt)', async () => {
    const kv = maakKvMock({ 'u_test:seizoensplan': bouwPlan() })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await PUT_markeerAlsTest(putReq({ datum: '2026-01-07', activiteitId: 'act_1', verwerkFtp: false }))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(verwerkFtpTest).not.toHaveBeenCalled()
    expect(body.ftpUpdate).toBeNull()
    // De sessie is nog steeds correct gelabeld, ondanks dat FTP niet verwerkt is
    expect(body.data.intentie.rol).toBe('ftp_test')
    expect(body.data.voltooid).toBe(true)
  })

  it('vervangt een bestaande sessie op dezelfde datum i.p.v. te dupliceren', async () => {
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan({
        weekSessies: { sessies: [{ datum: '2026-01-07', type: 'sweetspot', intentie: { sessietype: 'sweetspot_intervallen' } }] },
      }),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await PUT_markeerAlsTest(putReq({ datum: '2026-01-07', activiteitId: 'act_1', verwerkFtp: false }))

    const opgeslagenPlan = kv.store.get('u_test:seizoensplan')
    expect(opgeslagenPlan.weekSessies.sessies).toHaveLength(1)
    expect(opgeslagenPlan.weekSessies.sessies[0].intentie.sessietype).toBe('ramp_test')
  })

  it('post geen intervals.icu-event (geen ZWO nodig voor een al gereden rit) — de route slaagt zonder intervalsPost te gebruiken', async () => {
    // @/lib/intervals is hierboven gemockt met alléén intervalsGet — als de
    // route ook intervalsPost zou aanroepen (bestaand ZWO-event-pad, bedoeld
    // voor toekomstige planning) zou dat een TypeError geven (undefined is
    // geen functie) en de request laten falen op 500 i.p.v. 200.
    const kv = maakKvMock({ 'u_test:seizoensplan': bouwPlan() })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await PUT_markeerAlsTest(putReq({ datum: '2026-01-07', activiteitId: 'act_1', verwerkFtp: false }))
    expect(resp.status).toBe(200)
  })

  it('400 zonder datum/activiteitId', async () => {
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await PUT_markeerAlsTest(putReq({}))
    expect(resp.status).toBe(400)
  })

  it('400 bij een sessietype zonder generator', async () => {
    vi.mocked(getKV).mockReturnValue(maakKvMock({ 'u_test:seizoensplan': bouwPlan() }))
    const resp = await PUT_markeerAlsTest(putReq({ datum: '2026-01-07', activiteitId: 'act_1', sessietype: 'sprint_peak_test' }))
    expect(resp.status).toBe(400)
  })

  it('400 als de gebruiker niet gekoppeld is aan intervals.icu', async () => {
    vi.mocked(getIntervalsCredentials).mockResolvedValue(null)
    vi.mocked(getKV).mockReturnValue(maakKvMock({ 'u_test:seizoensplan': bouwPlan() }))
    const resp = await PUT_markeerAlsTest(putReq({ datum: '2026-01-07', activiteitId: 'act_1' }))
    expect(resp.status).toBe(400)
  })
})
