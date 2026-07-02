import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))

import { getSessionUser } from '@/lib/auth'
import { getKV } from '@/lib/kv'
import { _wisArchetypeCacheVoorTests } from '@/lib/sessie-archetypes'
import { ARCHETYPES_FIXTURE } from '@/lib/__tests__/fixtures/archetypesFixture.js'

import { GET as GET_archetypes } from '../route.js'
import { PUT as PUT_sessietype } from '../[sessietype]/route.js'
import { DELETE as DELETE_archetype } from '../[sessietype]/[archetypeId]/route.js'
import { POST as POST_preview } from '../preview/route.js'
import { POST as POST_zwoParse } from '@/app/api/admin/zwo/parse/route.js'
import { genereerSessieDeterministisch } from '@/lib/sessie-generatie'

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
  _wisArchetypeCacheVoorTests()
  vi.mocked(getSessionUser).mockReset()
})

describe('GET /api/admin/archetypes', () => {
  it('403 zonder admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(NIET_ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await GET_archetypes()
    expect(resp.status).toBe(403)
  })

  it('200 met alle 8 sessietypes voor admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    const seed = Object.fromEntries(Object.entries(ARCHETYPES_FIXTURE).map(([t, a]) => [`archetypes:${t}`, a]))
    vi.mocked(getKV).mockReturnValue(maakKvMock(seed))
    const resp = await GET_archetypes()
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Object.keys(body.data)).toHaveLength(8)
    expect(body.data.z2_duur.length).toBeGreaterThan(0)
  })
})

describe('PUT /api/admin/archetypes/[sessietype]', () => {
  it('403 zonder admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(NIET_ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await PUT_sessietype(req([]), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    expect(resp.status).toBe(403)
  })

  it('400 bij onbekend sessietype', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await PUT_sessietype(req([]), { params: Promise.resolve({ sessietype: 'onbekend' }) })
    expect(resp.status).toBe(400)
  })

  it('400 bij een ongeldig blok (Z1 niet toegestaan voor dit sessietype)', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype',
      naam: 'Test',
      structuur: 'Een test-archetype',
      tss_range: [50, 70],
      fase_beschikbaar: ['basis'],
      varianten: [{ id: 'v1', naam: 'V1', blokken: [{ type: 'werk', zone: 'Z1', pct_ftp: 50, duur_pct: 1.0 }] }],
    }]
    // z2_duur staat geen Z1-blokken toe (zie Z1_TOEGESTANE_SESSIETYPES)
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error).toMatch(/Z1/)
  })

  it('400 bij een leeg structuur-veld', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype', naam: 'Test', structuur: '', tss_range: [50, 70],
      fase_beschikbaar: ['basis'],
      varianten: [{ id: 'v1', naam: 'V1', blokken: [{ type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 1.0 }] }],
    }]
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    expect(resp.status).toBe(400)
  })

  it('200 ook als duur_pct van een variant niet optelt tot 100% (schaalVariant normaliseert dit altijd — geen harde eis, zie ook 45/125 bestaande varianten die hiervan afwijken)', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype', naam: 'Test', structuur: 'x', tss_range: [50, 70],
      fase_beschikbaar: ['basis'],
      varianten: [{ id: 'v1', naam: 'V1', blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.6 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 60, duur_pct: 0.3 },
      ] }],
    }]
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    expect(resp.status).toBe(200)
  })

  it('400 bij een ongeldige max_blokduur_sec (niet-positief)', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype', naam: 'Test', structuur: 'x', tss_range: [50, 70],
      fase_beschikbaar: ['basis'], max_blokduur_sec: -10,
      varianten: [{ id: 'v1', naam: 'V1', blokken: [{ type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 1.0 }] }],
    }]
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error).toMatch(/max_blokduur_sec/)
  })

  it('200 met een geldige max_blokduur_sec', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype', naam: 'Test', structuur: 'x', tss_range: [50, 70],
      fase_beschikbaar: ['basis'], max_blokduur_sec: 300,
      varianten: [{ id: 'v1', naam: 'V1', blokken: [{ type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 1.0 }] }],
    }]
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data[0].max_blokduur_sec).toBe(300)
  })

  it('400 bij een ongeldige min_duur_min (niet-positief)', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype', naam: 'Test', structuur: 'x', tss_range: [50, 70],
      fase_beschikbaar: ['basis'], min_duur_min: 0,
      varianten: [{ id: 'v1', naam: 'V1', blokken: [{ type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 1.0 }] }],
    }]
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error).toMatch(/min_duur_min/)
  })

  it('200 met een geldige min_duur_min en een blok met duur_sec_vast', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype', naam: 'Test', structuur: 'x', tss_range: [50, 70],
      fase_beschikbaar: ['basis'], min_duur_min: 90,
      varianten: [{ id: 'v1', naam: 'V1', blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_sec_vast: 1800 },
        { type: 'werk', zone: 'Z3', pct_ftp: 85, duur_pct: 1.0 },
      ] }],
    }]
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data[0].min_duur_min).toBe(90)
    expect(body.data[0].varianten[0].blokken[0].duur_sec_vast).toBe(1800)
  })

  it('400 als een blok zowel duur_sec_vast als duur_pct heeft', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype', naam: 'Test', structuur: 'x', tss_range: [50, 70],
      fase_beschikbaar: ['basis'],
      varianten: [{ id: 'v1', naam: 'V1', blokken: [{ type: 'werk', zone: 'Z2', pct_ftp: 65, duur_sec_vast: 1800, duur_pct: 0.5 }] }],
    }]
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error).toMatch(/duur_sec_vast.*duur_pct/)
  })

  it('400 als een blok geen duur_pct of duur_sec_vast heeft', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const kandidaat = [{
      id: 'test_archetype', naam: 'Test', structuur: 'x', tss_range: [50, 70],
      fase_beschikbaar: ['basis'],
      varianten: [{ id: 'v1', naam: 'V1', blokken: [{ type: 'werk', zone: 'Z2', pct_ftp: 65 }] }],
    }]
    const resp = await PUT_sessietype(req(kandidaat), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    expect(resp.status).toBe(400)
  })

  it('200 happy path: slaat op, invalideert de cache (directe GET erna toont nieuwe data, niet gecachet oud)', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    const oudeData = [{ id: 'oud_archetype', naam: 'Oud', structuur: 'x', tss_range: [1, 2], fase_beschikbaar: ['basis'], varianten: [{ id: 'v1', blokken: [{ type: 'werk', zone: 'Z2', pct_ftp: 60, duur_pct: 1 }] }] }]
    const kv = maakKvMock({ 'archetypes:z2_duur': oudeData })
    vi.mocked(getKV).mockReturnValue(kv)

    // Warm de cache met de oude data (zoals een eerdere GET zou doen)
    const eersteGet = await GET_archetypes()
    const eersteBody = await eersteGet.json()
    expect(eersteBody.data.z2_duur[0].id).toBe('oud_archetype')

    const nieuweData = [{
      id: 'nieuw_archetype', naam: 'Nieuw', structuur: 'y', tss_range: [1, 2], fase_beschikbaar: ['basis'],
      varianten: [{ id: 'v1', blokken: [{ type: 'werk', zone: 'Z2', pct_ftp: 60, duur_pct: 1 }] }],
    }]
    const putResp = await PUT_sessietype(req(nieuweData), { params: Promise.resolve({ sessietype: 'z2_duur' }) })
    expect(putResp.status).toBe(200)

    const tweedeGet = await GET_archetypes()
    const tweedeBody = await tweedeGet.json()
    expect(tweedeBody.data.z2_duur).toHaveLength(1)
    expect(tweedeBody.data.z2_duur[0].id).toBe('nieuw_archetype')
    expect(tweedeBody.data.z2_duur[0].laatst_gewijzigd).toBeTruthy()
  })
})

describe('DELETE /api/admin/archetypes/[sessietype]/[archetypeId]', () => {
  it('403 zonder admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(NIET_ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await DELETE_archetype(req(), { params: Promise.resolve({ sessietype: 'z2_duur', archetypeId: 'x' }) })
    expect(resp.status).toBe(403)
  })

  it('404 bij niet-bestaand archetype-id', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    vi.mocked(getKV).mockReturnValue(maakKvMock({ 'archetypes:z2_duur': [] }))
    const resp = await DELETE_archetype(req(), { params: Promise.resolve({ sessietype: 'z2_duur', archetypeId: 'bestaat_niet' }) })
    expect(resp.status).toBe(404)
  })

  it('200 happy path: verwijdert het archetype', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    const data = [{ id: 'a' }, { id: 'b' }]
    vi.mocked(getKV).mockReturnValue(maakKvMock({ 'archetypes:z2_duur': data }))
    const resp = await DELETE_archetype(req(), { params: Promise.resolve({ sessietype: 'z2_duur', archetypeId: 'a' }) })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.map(a => a.id)).toEqual(['b'])
  })
})

describe('POST /api/admin/archetypes/preview', () => {
  it('403 zonder admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(NIET_ADMIN)
    const resp = await POST_preview(req({}))
    expect(resp.status).toBe(403)
  })

  it('400 zonder archetype.id', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    const resp = await POST_preview(req({ sessietype: 'z2_duur', archetype: {} }))
    expect(resp.status).toBe(400)
  })

  it('200 happy path: geeft blokkenMetWattages/tss/verwachtRpe/duurMin terug, identiek aan directe genereerSessieDeterministisch-aanroep', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    const archetype = ARCHETYPES_FIXTURE.gemengd.find(a => a.id === 'alles_mag')
    const resp = await POST_preview(req({ sessietype: 'gemengd', archetype, ftp: 265, doelDuurMin: 75 }))
    const body = await resp.json()
    expect(resp.status).toBe(200)

    const referentie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant: archetype.varianten[0],
      doelDuurMin: 75, ftp: 265, sessietype: 'gemengd',
    })
    expect(body.data.tss).toBe(referentie.tss)
    expect(body.data.verwachtRpe).toBe(referentie.verwacht_rpe)
    expect(body.data.duurMin).toBe(referentie.duur_min)
  })
})

describe('POST /api/admin/zwo/parse', () => {
  it('403 zonder admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(NIET_ADMIN)
    const resp = await POST_zwoParse(req({ xml: '' }))
    expect(resp.status).toBe(403)
  })

  it('200 happy path: parseert een geldig ZWO-bestand', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(ADMIN)
    const xml = '<workout_file><name>Test</name><workout><SteadyState Duration="600" Power="0.65"/></workout></workout_file>'
    const resp = await POST_zwoParse(req({ xml }))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.blokken).toHaveLength(1)
    expect(body.data.naam).toBe('Test')
  })
})
