import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn() }))
vi.mock('@/lib/intervals', () => ({ intervalsPost: vi.fn(), intervalsDelete: vi.fn() }))

import { getSessionUser } from '@/lib/auth'
import { getKV } from '@/lib/kv'
import { getIntervalsCredentials } from '@/lib/users'
import { intervalsPost, intervalsDelete } from '@/lib/intervals'
import { _wisArchetypeCacheVoorTests } from '@/lib/sessie-archetypes'

import { GET as GET_categorieen } from '../categorieen/route.js'
import { GET as GET_varianten } from '../varianten/route.js'
import { PUT as PUT_kies } from '../kies/route.js'

const USER = { id: 'u_test' }

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

function req(url) {
  return { url: `http://localhost${url}` }
}

function putReq(body) {
  return { json: async () => body }
}

const Z2_DUUR_ARCHETYPES = [
  {
    id: 'z2_kort_archetype',
    naam: 'Kort',
    tss_range: [40, 60],
    fase_beschikbaar: ['basis', 'sweetspot'],
    varianten: [
      { id: 'z2_kort_v1', naam: '2 blokken', blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.5 },
        { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.5 },
      ] },
    ],
  },
  {
    id: 'z2_lang_archetype',
    naam: 'Lang',
    tss_range: [80, 120],
    fase_beschikbaar: ['basis', 'sweetspot'],
    min_duur_min: 150, // langer dan de 90 min beschikbare tijd in de test-plan-fixture
    varianten: [
      { id: 'z2_lang_v1', naam: '6 blokken', blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.166 },
        { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.166 },
        { type: 'werk', zone: 'Z2', pct_ftp: 72, duur_pct: 0.166 },
        { type: 'werk', zone: 'Z2', pct_ftp: 74, duur_pct: 0.166 },
        { type: 'werk', zone: 'Z2', pct_ftp: 76, duur_pct: 0.168 },
        { type: 'werk', zone: 'Z2', pct_ftp: 79, duur_pct: 0.168 },
      ] },
    ],
  },
]

function bouwPlan(overrides = {}) {
  return {
    startdatum: '2026-01-05', // maandag, week 1
    huidige_ftp: 265,
    seizoensdoel: { type: 'ftp' },
    urenPerDag: { Woensdag: 1.5 }, // 90 min beschikbaar
    beschikbaarheid: { Woensdag: true },
    kader: [
      { week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200, sessietypes: ['z2_duur', 'kracht_lage_cadans', 'z1_herstel'] },
    ],
    weekSessies: { sessies: [] },
    ...overrides,
  }
}

beforeEach(() => {
  _wisArchetypeCacheVoorTests()
  vi.clearAllMocks()
  vi.mocked(getSessionUser).mockResolvedValue(USER)
  vi.mocked(getIntervalsCredentials).mockResolvedValue(null)
  vi.mocked(intervalsPost).mockResolvedValue({ id: 'evt_1' })
  vi.mocked(intervalsDelete).mockResolvedValue({})
})

describe('GET /api/sessie/categorieen', () => {
  it('retourneert de fase-passende sessietypes (alleen die met archetypedata) plus altijd tests', async () => {
    const kv = maakKvMock({ 'u_test:seizoensplan': bouwPlan() })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await GET_categorieen(req('/api/sessie/categorieen?datum=2026-01-07'))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    const ids = body.data.categorieen.map(c => c.categorie)
    // z1_herstel zit in kaderWeek.sessietypes maar heeft geen archetypedata -> uitgesloten
    expect(ids).toEqual(['z2_duur', 'kracht_lage_cadans', 'tests'])
  })

  it('"tests" is altijd aanwezig, ook als de fase geen enkel geldig sessietype oplevert', async () => {
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan({
        kader: [{ week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200, sessietypes: ['z1_herstel'] }],
      }),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await GET_categorieen(req('/api/sessie/categorieen?datum=2026-01-07'))
    const body = await resp.json()
    expect(body.data.categorieen.map(c => c.categorie)).toEqual(['tests'])
  })

  it('400 zonder datum', async () => {
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await GET_categorieen(req('/api/sessie/categorieen'))
    expect(resp.status).toBe(400)
  })

  it('migreert verouderde sessietype-namen in een oude plan-snapshot (bv. "z2_vlak" -> "z2_duur") i.p.v. ze stil te laten vallen', async () => {
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan({
        // Simuleert een plan aangemaakt vóórdat z2_vlak -> z2_duur werd
        // gemigreerd (zie SESSIETYPE_MIGRATIE) — kaderWeek.sessietypes is een
        // snapshot en is nooit met terugwerkende kracht bijgewerkt.
        kader: [{ week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200, sessietypes: ['z2_vlak', 'kracht_lage_cadans', 'z1_herstel'] }],
      }),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await GET_categorieen(req('/api/sessie/categorieen?datum=2026-01-07'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.categorieen.map(c => c.categorie)).toEqual(['z2_duur', 'kracht_lage_cadans', 'tests'])
  })

  it('valt terug op faseInstellingen() als kaderWeek.sessietypes ontbreekt (oudere/andere plan-opslag)', async () => {
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan({
        // Geen sessietypes-veld op de kaderweek — simuleert een plan dat niet
        // (meer) via bouwKader() is opgeslagen, of een ouder schema.
        kader: [{ week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200 }],
      }),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await GET_categorieen(req('/api/sessie/categorieen?datum=2026-01-07'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    // doelprofielen.ftp.basis.sessietypes = ["z2_duur","kracht_lage_cadans","z1_herstel"] -> z1_herstel gefilterd
    expect(body.data.categorieen.map(c => c.categorie)).toEqual(['z2_duur', 'kracht_lage_cadans', 'tests'])
  })

  it('valt terug op ["z2_duur","z1_herstel"] als zelfs faseInstellingen() niets oplevert (geen plan.kader)', async () => {
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan({ kader: [] }),
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await GET_categorieen(req('/api/sessie/categorieen?datum=2026-01-07'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    // Nooit volledig leeg, zelfs niet zonder enige kaderdata.
    expect(body.data.categorieen.map(c => c.categorie)).toEqual(['z2_duur', 'tests'])
  })
})

describe('GET /api/sessie/varianten', () => {
  it('duur-fit-filter: te lange variant blijft zichtbaar maar uitgeschakeld, korte blijft normaal', async () => {
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan(),
      'archetypes:z2_duur': Z2_DUUR_ARCHETYPES,
    })
    vi.mocked(getKV).mockReturnValue(kv)

    // Woensdag 2026-01-07 heeft 1.5u (90 min) beschikbaar; z2_lang_archetype vereist min_duur_min 150
    const resp = await GET_varianten(req('/api/sessie/varianten?datum=2026-01-07&categorie=z2_duur'))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.data.varianten).toHaveLength(2)

    const kort = body.data.varianten.find(v => v.archetype_id === 'z2_kort_archetype')
    const lang = body.data.varianten.find(v => v.archetype_id === 'z2_lang_archetype')

    expect(kort.past_binnen_tijd).toBe(true)
    expect(kort.reden_uitgeschakeld).toBeNull()

    expect(lang.past_binnen_tijd).toBe(false)
    expect(lang.reden_uitgeschakeld).toBe('Past niet binnen beschikbare tijd')
    // Blijft zichtbaar met volledige data, niet uit de lijst verwijderd
    expect(lang.blokken).toBeDefined()
    expect(lang.blokken.length).toBeGreaterThan(0)
  })

  it('categorie "tests" geeft een vaste ramp_test-entry zonder duur-filter', async () => {
    const kv = maakKvMock({ 'u_test:seizoensplan': bouwPlan() })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await GET_varianten(req('/api/sessie/varianten?datum=2026-01-07&categorie=tests'))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.data.varianten).toHaveLength(1)
    expect(body.data.varianten[0].sessietype).toBe('ramp_test')
    expect(body.data.varianten[0].past_binnen_tijd).toBe(true)
    expect(body.data.varianten[0].protocol.ramp.start_watt).toBe(100)
  })

  it('400 zonder categorie', async () => {
    vi.mocked(getKV).mockReturnValue(maakKvMock({ 'u_test:seizoensplan': bouwPlan() }))
    const resp = await GET_varianten(req('/api/sessie/varianten?datum=2026-01-07'))
    expect(resp.status).toBe(400)
  })
})

describe('PUT /api/sessie/kies', () => {
  it('normaal pad: overschrijft dag-intentie en genereert de gekozen archetype/variant, triggert ZWO-sync', async () => {
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan(),
      'archetypes:z2_duur': Z2_DUUR_ARCHETYPES,
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await PUT_kies(putReq({
      datum: '2026-01-07', sessietype: 'z2_duur',
      archetype_id: 'z2_kort_archetype', variant_id: 'z2_kort_v1',
    }))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.data.intentie.sessietype).toBe('z2_duur')
    expect(body.data.archetype_id).toBe('z2_kort_archetype')
    expect(body.data.variant_id).toBe('z2_kort_v1')
    expect(body.data.datum).toBe('2026-01-07')
    expect(body.data.gegenereerd_door).toBe('handmatige_keuze')

    // Opgeslagen in het plan
    const opgeslagenPlan = kv.store.get('u_test:seizoensplan')
    expect(opgeslagenPlan.weekSessies.sessies).toHaveLength(1)
    expect(opgeslagenPlan.weekSessies.sessies[0].datum).toBe('2026-01-07')

    // ZWO-export getriggerd
    expect(intervalsPost).toHaveBeenCalledTimes(1)
    const [pad, eventBody] = intervalsPost.mock.calls[0]
    expect(pad).toBe('/events')
    expect(eventBody.file_type).toBe('zwo')
    expect(eventBody.file_contents).toContain('<workout_file>')
  })

  it('ramp_test-pad: genereert het vaste protocol i.p.v. archetype/variant', async () => {
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    const kv = maakKvMock({ 'u_test:seizoensplan': bouwPlan() })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await PUT_kies(putReq({ datum: '2026-01-07', sessietype: 'ramp_test' }))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.data.intentie.rol).toBe('ftp_test')
    expect(body.data.intentie.sessietype).toBe('ramp_test')
    expect(body.data.protocol.ramp.increment_watt_per_min).toBe(20)
    expect(body.data.archetype_id).toBeNull()

    // ZWO-export ook getriggerd voor ramp_test (via sessieNaarZwo's protocol-tak)
    expect(intervalsPost).toHaveBeenCalledTimes(1)
    const [, eventBody] = intervalsPost.mock.calls[0]
    expect(eventBody.file_contents).toContain('<Warmup')
  })

  it('vervangt een bestaande sessie op dezelfde datum en ruimt het oude intervals-event op', async () => {
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan({
        weekSessies: { sessies: [{ datum: '2026-01-07', type: 'z2_duur', intervalsEventId: 'oud_evt', intentie: { sessietype: 'z2_duur' } }] },
      }),
      'archetypes:z2_duur': Z2_DUUR_ARCHETYPES,
    })
    vi.mocked(getKV).mockReturnValue(kv)

    await PUT_kies(putReq({
      datum: '2026-01-07', sessietype: 'z2_duur',
      archetype_id: 'z2_kort_archetype', variant_id: 'z2_kort_v1',
    }))

    expect(intervalsDelete).toHaveBeenCalledWith('/events/oud_evt', expect.anything())
    const opgeslagenPlan = kv.store.get('u_test:seizoensplan')
    expect(opgeslagenPlan.weekSessies.sessies).toHaveLength(1) // vervangen, niet toegevoegd
  })

  it('400 bij onbekend archetype_id/variant_id', async () => {
    const kv = maakKvMock({
      'u_test:seizoensplan': bouwPlan(),
      'archetypes:z2_duur': Z2_DUUR_ARCHETYPES,
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await PUT_kies(putReq({ datum: '2026-01-07', sessietype: 'z2_duur', archetype_id: 'onbekend', variant_id: 'x' }))
    expect(resp.status).toBe(400)
  })

  it('400 zonder datum/sessietype', async () => {
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await PUT_kies(putReq({}))
    expect(resp.status).toBe(400)
  })
})
