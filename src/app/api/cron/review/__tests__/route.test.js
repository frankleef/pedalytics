import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Zelfde patroon als cron/sync/__tests__/route.test.js: alleen externe-IO-
// randen gemockt (KV, qstash, cronLog, verzamelReviewContext — die zelf weer
// intervals.icu aanroept). bouwReviewPrompt en valideerReviewVoorstel draaien
// ECHT (pure, deterministisch, al los getest) zodat dit de daadwerkelijke
// code path test, geen herimplementatie ervan.
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/qstash', () => ({ verifyQStash: vi.fn(async () => false) }))
vi.mock('@/lib/cronLog', () => ({ logCronRun: vi.fn(async () => {}) }))
vi.mock('@/lib/review/context', () => ({ verzamelReviewContext: vi.fn() }))

import { getKV } from '@/lib/kv'
import { verzamelReviewContext } from '@/lib/review/context'
import { POST } from '../route.js'

process.env.ADMIN_SECRET = 'test-secret'
process.env.ANTHROPIC_API_KEY = 'test-key'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v, opts) => { store.set(k, { waarde: v, opts }) }),
    mget: vi.fn(async (...keys) => keys.map(k => store.get(k) ?? null)),
  }
}

function req() {
  return { headers: { get: (h) => h === 'authorization' ? 'Bearer test-secret' : null } }
}

function maakPlan(overrides = {}) {
  return {
    startdatum: '2026-01-05',
    kader: [{ week: 1, tss_doel: 300, fase: 'basis', weektype: 'opbouw' }],
    urenPerDag: {},
    weekSessies: {
      sessies: [
        { datum: '2026-07-07', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'vo2max_intervallen' } },
      ],
    },
    ...overrides,
  }
}

function legeReviewContext() {
  return { korteTermijn: {}, middenTermijn: {}, langeTermijn: {} }
}

function chronischGetriggerdeReviewContext() {
  return { korteTermijn: { monotonieStrain: { trigger: true } }, middenTermijn: {}, langeTermijn: {} }
}

function claudeResponse(tekst) {
  return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: tekst }] }) }
}

const GELDIG_VOORSTEL_JSON = JSON.stringify([
  { datum: '2026-07-07', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht naar Z2', reden: 'Monotonie hoog' },
])

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-07T10:00:00')) // dinsdag; week = 2026-07-06 t/m 2026-07-12
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('POST /api/cron/review — happy path', () => {
  it('een gebruiker met een getriggerd (chronisch) signaal krijgt een geaccepteerd voorstel gepersisteerd onder review_voorstel:${userId}', async () => {
    const kv = maakKvMock({ 'users:active': ['u1'], 'u1:seizoensplan': maakPlan() })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(verzamelReviewContext).mockResolvedValue(chronischGetriggerdeReviewContext())
    global.fetch.mockResolvedValue(claudeResponse(GELDIG_VOORSTEL_JSON))

    const resp = await POST(req())
    const data = await resp.json()

    expect(data.success).toBe(true)
    expect(data.results).toEqual([{ userId: 'u1', status: 'voorstel_gepersisteerd', aantal: 1 }])

    const opgeslagen = kv.store.get('review_voorstel:u1')
    expect(opgeslagen).toBeDefined()
    expect(opgeslagen.waarde).toHaveLength(1)
    expect(opgeslagen.waarde[0]).toMatchObject({ datum: '2026-07-07', geaccepteerd: true, redenVanAfwijzing: null })
    expect(opgeslagen.opts).toEqual({ ex: 18 * 3600 })
  })
})

describe('POST /api/cron/review — ongeldige JSON van Claude', () => {
  it('een gebruiker met ongeldige JSON wordt overgeslagen, de andere gebruiker in dezelfde run wordt wel verwerkt', async () => {
    const kv = maakKvMock({
      'users:active': ['u_fout', 'u_ok'],
      'u_fout:seizoensplan': maakPlan(),
      'u_ok:seizoensplan': maakPlan(),
    })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(verzamelReviewContext).mockResolvedValue(chronischGetriggerdeReviewContext())
    global.fetch
      .mockResolvedValueOnce(claudeResponse('dit is geen geldige JSON {{{'))
      .mockResolvedValueOnce(claudeResponse(GELDIG_VOORSTEL_JSON))

    const resp = await POST(req())
    const data = await resp.json()

    expect(data.results).toEqual([
      { userId: 'u_fout', status: 'error', fase: 'parse', error: 'ongeldige JSON' },
      { userId: 'u_ok', status: 'voorstel_gepersisteerd', aantal: 1 },
    ])
    expect(kv.store.has('review_voorstel:u_fout')).toBe(false)
    expect(kv.store.has('review_voorstel:u_ok')).toBe(true)
  })
})

describe('POST /api/cron/review — alle voorstellen afgewezen door F3', () => {
  it('bij een volledig leeg/ongetriggerd reviewContext wordt niets gepersisteerd, geen crash', async () => {
    const kv = maakKvMock({ 'users:active': ['u1'], 'u1:seizoensplan': maakPlan() })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(verzamelReviewContext).mockResolvedValue(legeReviewContext())
    global.fetch.mockResolvedValue(claudeResponse(GELDIG_VOORSTEL_JSON))

    const resp = await POST(req())
    const data = await resp.json()

    expect(data.success).toBe(true)
    expect(data.results).toEqual([{ userId: 'u1', status: 'geen_geaccepteerd_voorstel' }])
    expect(kv.store.has('review_voorstel:u1')).toBe(false)
    expect(kv.set).not.toHaveBeenCalledWith('review_voorstel:u1', expect.anything(), expect.anything())
  })
})

describe('POST /api/cron/review — Claude API-timeout/netwerkfout', () => {
  it('een netwerkfout bij Claude faalt fail-open voor die gebruiker, de cron-run gaat door voor overige gebruikers', async () => {
    const kv = maakKvMock({
      'users:active': ['u_timeout', 'u_ok'],
      'u_timeout:seizoensplan': maakPlan(),
      'u_ok:seizoensplan': maakPlan(),
    })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(verzamelReviewContext).mockResolvedValue(chronischGetriggerdeReviewContext())
    global.fetch
      .mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
      .mockResolvedValueOnce(claudeResponse(GELDIG_VOORSTEL_JSON))

    const resp = await POST(req())
    const data = await resp.json()

    expect(data.results[0]).toMatchObject({ userId: 'u_timeout', status: 'error', fase: 'claude' })
    expect(data.results[1]).toEqual({ userId: 'u_ok', status: 'voorstel_gepersisteerd', aantal: 1 })
    expect(kv.store.has('review_voorstel:u_timeout')).toBe(false)
    expect(kv.store.has('review_voorstel:u_ok')).toBe(true)
  })

  it('een niet-2xx-respons van Claude faalt eveneens fail-open', async () => {
    const kv = maakKvMock({ 'users:active': ['u1'], 'u1:seizoensplan': maakPlan() })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(verzamelReviewContext).mockResolvedValue(chronischGetriggerdeReviewContext())
    global.fetch.mockResolvedValue({ ok: false, status: 529, text: async () => 'overloaded' })

    const resp = await POST(req())
    const data = await resp.json()

    expect(data.results).toEqual([{ userId: 'u1', status: 'error', fase: 'claude', error: expect.stringContaining('529') }])
    expect(kv.store.has('review_voorstel:u1')).toBe(false)
  })

  it('een respons met een "thinking"-blok vóór het tekstblok (bv. claude-sonnet-5, adaptive thinking) wordt correct geparsed — niet content[0] blind gebruiken', async () => {
    const kv = maakKvMock({ 'users:active': ['u1'], 'u1:seizoensplan': maakPlan() })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(verzamelReviewContext).mockResolvedValue(chronischGetriggerdeReviewContext())
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        content: [
          { type: 'thinking', thinking: '', signature: 'abc' }, // content[0] — GEEN .text-veld
          { type: 'text', text: GELDIG_VOORSTEL_JSON },
        ],
      }),
    })

    const resp = await POST(req())
    const data = await resp.json()

    expect(data.results).toEqual([{ userId: 'u1', status: 'voorstel_gepersisteerd', aantal: 1 }])
    expect(kv.store.has('review_voorstel:u1')).toBe(true)
  })
})

describe('POST /api/cron/review — overige fail-open paden', () => {
  it('een gebruiker zonder bruikbaar plan wordt overgeslagen zonder de run te blokkeren', async () => {
    const kv = maakKvMock({ 'users:active': ['u_geen_plan', 'u_ok'], 'u_geen_plan:seizoensplan': null, 'u_ok:seizoensplan': maakPlan() })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(verzamelReviewContext).mockResolvedValue(chronischGetriggerdeReviewContext())
    global.fetch.mockResolvedValue(claudeResponse(GELDIG_VOORSTEL_JSON))

    const resp = await POST(req())
    const data = await resp.json()

    expect(data.results).toEqual([
      { userId: 'u_geen_plan', status: 'geen_plan' },
      { userId: 'u_ok', status: 'voorstel_gepersisteerd', aantal: 1 },
    ])
  })

  it('een falende contextverzameling faalt fail-open voor die gebruiker', async () => {
    const kv = maakKvMock({ 'users:active': ['u1'], 'u1:seizoensplan': maakPlan() })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(verzamelReviewContext).mockRejectedValue(new Error('kv onbereikbaar'))

    const resp = await POST(req())
    const data = await resp.json()

    expect(data.results).toEqual([{ userId: 'u1', status: 'error', fase: 'context', error: 'kv onbereikbaar' }])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('weigert een request zonder geldige authenticatie', async () => {
    const badReq = { headers: { get: () => null } }
    const resp = await POST(badReq)
    expect(resp.status).toBe(401)
  })
})
