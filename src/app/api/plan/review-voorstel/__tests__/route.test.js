import { describe, it, expect, vi, beforeEach } from 'vitest'

// Zelfde patroon als sessie/__tests__/routes.test.js en cron/review/__tests__/route.test.js:
// alleen externe-IO-randen gemockt (auth, KV, genereerSessieDag — zelf al los
// getest — en credentials/wellness-ophalen). De route-eigen logica (KV-mutatie,
// lijst-filtering) draait ECHT.
vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn(async () => null) }))
vi.mock('@/lib/sessie/genereren', () => ({
  genereerSessieDag: vi.fn(),
  logSessieGegenereerd: vi.fn(),
}))

import { getSessionUser } from '@/lib/auth'
import { getKV } from '@/lib/kv'
import { genereerSessieDag } from '@/lib/sessie/genereren'
import { GET, POST } from '../route.js'

const USER = { id: 'u_test' }

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    del: vi.fn(async (k) => { store.delete(k) }),
  }
}

function postReq(body) {
  return { json: async () => body }
}

function maakPlan(overrides = {}) {
  return {
    startdatum: '2026-01-05',
    kader: [{ week: 1, tss_doel: 300, fase: 'basis', weektype: 'opbouw' }],
    huidige_ftp: 265,
    urenPerDag: { maandag: 1.5 },
    weekSessies: {
      sessies: [
        { datum: '2026-07-20', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'vo2max_intervallen' } },
        { datum: '2026-07-21', voltooid: false, duur_min: 45, tss: 60, intentie: { sessietype: 'z2_duur' } },
      ],
    },
    ...overrides,
  }
}

const VOORSTEL_ITEM = {
  datum: '2026-07-20',
  huidigSessietype: 'vo2max_intervallen',
  nieuwSessietype: 'z2_duur',
  voorgesteldeAanpassing: 'Verlicht naar Z2',
  reden: 'Monotonie hoog',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/plan/review-voorstel', () => {
  it('weigert een niet-ingelogde gebruiker', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    const resp = await GET()
    expect(resp.status).toBe(401)
  })

  it('geeft de gepersisteerde lijst terug', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const kv = maakKvMock({ 'review_voorstel:u_test': [VOORSTEL_ITEM] })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await GET()
    const data = await resp.json()
    expect(data).toEqual({ success: true, data: [VOORSTEL_ITEM] })
  })

  it('geeft een lege array terug bij een lege/verlopen key', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const kv = maakKvMock({})
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await GET()
    const data = await resp.json()
    expect(data).toEqual({ success: true, data: [] })
  })
})

describe('POST /api/plan/review-voorstel — negeren', () => {
  it('verwijdert alleen het genegeerde item, laat het plan ongewijzigd', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const tweedeItem = { ...VOORSTEL_ITEM, datum: '2026-07-21', nieuwSessietype: 'rust' }
    const kv = maakKvMock({
      'review_voorstel:u_test': [VOORSTEL_ITEM, tweedeItem],
      'u_test:seizoensplan': maakPlan(),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(postReq({ datum: '2026-07-20', actie: 'negeren' }))
    const data = await resp.json()

    expect(data).toEqual({ success: true })
    expect(genereerSessieDag).not.toHaveBeenCalled()
    expect(kv.store.get('review_voorstel:u_test')).toEqual([tweedeItem])
    expect(kv.store.get('u_test:seizoensplan')).toEqual(maakPlan())
  })

  it('verwijdert de key volledig als het het laatste item was', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const kv = maakKvMock({
      'review_voorstel:u_test': [VOORSTEL_ITEM],
      'u_test:seizoensplan': maakPlan(),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await POST(postReq({ datum: '2026-07-20', actie: 'negeren' }))

    expect(kv.del).toHaveBeenCalledWith('review_voorstel:u_test')
    expect(kv.store.has('review_voorstel:u_test')).toBe(false)
  })
})

describe('POST /api/plan/review-voorstel — toepassen', () => {
  it('muteert alleen de sessie van de opgegeven datum, laat de rest van het plan intact, verwijdert alleen dat ene voorstel', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const tweedeItem = { ...VOORSTEL_ITEM, datum: '2026-07-21', nieuwSessietype: 'rust' }
    const plan = maakPlan()
    const kv = maakKvMock({
      'review_voorstel:u_test': [VOORSTEL_ITEM, tweedeItem],
      'u_test:seizoensplan': plan,
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const nieuweSessie = { datum: '2026-07-20', duur_min: 45, tss: 55, intentie: { sessietype: 'z2_duur' } }
    vi.mocked(genereerSessieDag).mockResolvedValue(nieuweSessie)

    const resp = await POST(postReq({ datum: '2026-07-20', actie: 'toepassen', nieuwSessietype: 'z2_duur' }))
    const data = await resp.json()

    expect(data).toEqual({ success: true })
    expect(genereerSessieDag).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u_test', datum: '2026-07-20', effectiefSessietype: 'z2_duur',
    }))

    const opgeslagenPlan = kv.store.get('u_test:seizoensplan')
    expect(opgeslagenPlan.weekSessies.sessies[0]).toEqual(nieuweSessie)
    expect(opgeslagenPlan.weekSessies.sessies[1]).toEqual(plan.weekSessies.sessies[1]) // ongewijzigd

    expect(kv.store.get('review_voorstel:u_test')).toEqual([tweedeItem])
  })

  it('behoudt een bestaand intervalsEventId op de nieuwe sessie', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const plan = maakPlan({
      weekSessies: { sessies: [
        { datum: '2026-07-20', voltooid: false, intentie: { sessietype: 'vo2max_intervallen' }, intervalsEventId: 'evt123' },
      ] },
    })
    const kv = maakKvMock({ 'review_voorstel:u_test': [VOORSTEL_ITEM], 'u_test:seizoensplan': plan })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(genereerSessieDag).mockResolvedValue({ datum: '2026-07-20', intentie: { sessietype: 'z2_duur' } })

    await POST(postReq({ datum: '2026-07-20', actie: 'toepassen', nieuwSessietype: 'z2_duur' }))

    const opgeslagenPlan = kv.store.get('u_test:seizoensplan')
    expect(opgeslagenPlan.weekSessies.sessies[0].intervalsEventId).toBe('evt123')
  })

  it('weigert toepassen op een al-voltooide sessie', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const plan = maakPlan({
      weekSessies: { sessies: [
        { datum: '2026-07-20', voltooid: true, intentie: { sessietype: 'vo2max_intervallen' } },
      ] },
    })
    const kv = maakKvMock({ 'review_voorstel:u_test': [VOORSTEL_ITEM], 'u_test:seizoensplan': plan })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(postReq({ datum: '2026-07-20', actie: 'toepassen', nieuwSessietype: 'z2_duur' }))
    expect(resp.status).toBe(400)
    expect(genereerSessieDag).not.toHaveBeenCalled()
    expect(kv.store.get('review_voorstel:u_test')).toEqual([VOORSTEL_ITEM]) // niets verwijderd bij fout
  })

  it('faalt netjes als genereerSessieDag _geenSessie teruggeeft', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const kv = maakKvMock({ 'review_voorstel:u_test': [VOORSTEL_ITEM], 'u_test:seizoensplan': maakPlan() })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(genereerSessieDag).mockResolvedValue({ _geenSessie: true, reden: 'geen budget' })

    const resp = await POST(postReq({ datum: '2026-07-20', actie: 'toepassen', nieuwSessietype: 'z2_duur' }))
    const data = await resp.json()
    expect(resp.status).toBe(400)
    expect(data.error).toBe('geen budget')
    expect(kv.store.get('review_voorstel:u_test')).toEqual([VOORSTEL_ITEM])
  })

  it('vereist nieuwSessietype', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const kv = maakKvMock({ 'review_voorstel:u_test': [VOORSTEL_ITEM], 'u_test:seizoensplan': maakPlan() })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(postReq({ datum: '2026-07-20', actie: 'toepassen' }))
    expect(resp.status).toBe(400)
  })
})

describe('POST /api/plan/review-voorstel — algemene validatie', () => {
  it('weigert een niet-ingelogde gebruiker', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    const resp = await POST(postReq({ datum: '2026-07-20', actie: 'negeren' }))
    expect(resp.status).toBe(401)
  })

  it('weigert een ongeldige actie', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const kv = maakKvMock({})
    vi.mocked(getKV).mockReturnValue(kv)
    const resp = await POST(postReq({ datum: '2026-07-20', actie: 'iets-anders' }))
    expect(resp.status).toBe(400)
  })

  it('geeft 404 als het voorstel niet (meer) bestaat', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(USER)
    const kv = maakKvMock({ 'review_voorstel:u_test': [] })
    vi.mocked(getKV).mockReturnValue(kv)
    const resp = await POST(postReq({ datum: '2026-07-20', actie: 'negeren' }))
    expect(resp.status).toBe(404)
  })
})
