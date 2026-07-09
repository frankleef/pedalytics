import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))

import { getKV } from '@/lib/kv'
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

function req(body, auth = 'Bearer test-secret') {
  return {
    headers: { get: (h) => h === 'authorization' ? auth : null },
    json: async () => body,
  }
}

function bouwAeroBasisKader() {
  // Twee toekomstige weken, foutieve (generieke) waarden zoals de bug ze zou
  // hebben opgeslagen vóór de fix.
  return [
    { week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200, focus: 'Z2 volume', z1z2_doel: 0.80, max_intensiteit: 1, sessietypes: ['z2_duur', 'z1_herstel'] },
    { week: 2, fase: 'sweetspot', weektype: 'opbouw', tss_doel: 210, focus: 'Z2 volume', z1z2_doel: 0.80, max_intensiteit: 1, sessietypes: ['z2_duur', 'z1_herstel'] },
    { week: 3, fase: 'drempel', weektype: 'opbouw', tss_doel: 220, focus: 'Z2 volume', z1z2_doel: 0.80, max_intensiteit: 1, sessietypes: ['z2_duur', 'z1_herstel'] },
  ]
}

describe('POST /api/admin/herstel-fase-kader', () => {
  it('401 zonder correcte auth', async () => {
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await POST(req({ userId: 'u_test' }, 'Bearer verkeerd'))
    expect(resp.status).toBe(401)
  })

  it('dry-run op aerobe_basis-account: toont voorgestelde wijzigingen, schrijft niets', async () => {
    const kader = bouwAeroBasisKader()
    const kv = maakKvMock({
      'u_aero:seizoensplan': {
        startdatum: '2020-01-01', // ver in het verleden -> alle 3 weken tellen als "toekomstig" tov "vandaag" in de test? nee -> zie hieronder
        seizoensdoel: { type: 'aerobe_basis' },
        kader,
      },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req({ userId: 'u_aero' }))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.toegepast).toBe(false)
    expect(body.doel).toBe('aerobe_basis')
    // Geen enkele write naar KV tijdens dry-run
    expect(kv.set).not.toHaveBeenCalled()
  })

  it('daadwerkelijk toegepast: toekomstige weken gecorrigeerd, verleden weken byte-identiek', async () => {
    const morgen = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) // startdatum 30 dagen in de toekomst -> alle weken "toekomstig"
    const kader = bouwAeroBasisKader()
    const kaderKopie = JSON.parse(JSON.stringify(kader))
    const kv = maakKvMock({
      'u_aero:seizoensplan': {
        startdatum: morgen,
        seizoensdoel: { type: 'aerobe_basis' },
        kader,
      },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req({ userId: 'u_aero', toepassen: true }))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.toegepast).toBe(true)
    expect(body.aantalGewijzigd).toBeGreaterThan(0)

    const opgeslagenPlan = kv.store.get('u_aero:seizoensplan')
    const wk1 = opgeslagenPlan.kader.find(w => w.week === 1)
    const wk2 = opgeslagenPlan.kader.find(w => w.week === 2)
    const wk3 = opgeslagenPlan.kader.find(w => w.week === 3)

    // week 3 (drempel) moet nu "Aerobe verdieping"-instellingen hebben, niet de generieke fallback
    expect(wk3.sessietypes).toEqual(['z2_duur', 'sweetspot_intervallen', 'z1_herstel'])
    expect(wk3.z1z2_doel).toBe(0.88)
    // week 1/2 (basis/sweetspot) zijn bij aerobe_basis inhoudelijk gelijk aan de
    // generieke fallback-array (dat is hun daadwerkelijke, bedoelde inhoud —
    // geen restant van de bug), dus die veranderen zelf niet zichtbaar.
    expect(wk1.sessietypes).toEqual(['z2_duur', 'z1_herstel'])
    expect(kaderKopie[0]).toEqual(kader[0]) // input-object niet gemuteerd (defensief)
  })

  it('ftp-account (nooit geraakt door de bug): dry-run toont geen voorgestelde wijzigingen', async () => {
    const morgen = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const kv = maakKvMock({
      'u_ftp:seizoensplan': {
        startdatum: morgen,
        seizoensdoel: { type: 'ftp' },
        kader: [
          { week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200, focus: 'z2_duur, kracht_lage_cadans, z1_herstel', z1z2_doel: 0.90, max_intensiteit: 1, sessietypes: ['z2_duur', 'kracht_lage_cadans', 'z1_herstel'] },
          { week: 2, fase: 'sweetspot', weektype: 'opbouw', tss_doel: 210, focus: 'sweetspot_intervallen, z2_duur, z1_herstel', z1z2_doel: 0.80, max_intensiteit: 2, sessietypes: ['sweetspot_intervallen', 'z2_duur', 'z1_herstel'] },
        ],
      },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req({ userId: 'u_ftp' }))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.doel).toBe('ftp')
    expect(body.aantalGewijzigd).toBe(0)
    expect(body.wijzigingen).toEqual([])
  })

  it('verleden weken worden nooit aangeraakt, ook niet bij toepassen', async () => {
    const gisteren10w = new Date(Date.now() - 10 * 7 * 86400000).toISOString().slice(0, 10) // startdatum 10 weken geleden
    const kader = [
      { week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200, focus: 'Z2 volume', z1z2_doel: 0.80, max_intensiteit: 1, sessietypes: ['z2_duur', 'z1_herstel'] }, // ligt in het verleden
      { week: 12, fase: 'drempel', weektype: 'opbouw', tss_doel: 220, focus: 'Z2 volume', z1z2_doel: 0.80, max_intensiteit: 1, sessietypes: ['z2_duur', 'z1_herstel'] }, // toekomstig
    ]
    const kv = maakKvMock({
      'u_aero:seizoensplan': { startdatum: gisteren10w, seizoensdoel: { type: 'aerobe_basis' }, kader },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req({ userId: 'u_aero', toepassen: true }))
    const body = await resp.json()
    expect(resp.status).toBe(200)

    const opgeslagenPlan = kv.store.get('u_aero:seizoensplan')
    const week1 = opgeslagenPlan.kader.find(w => w.week === 1)
    expect(week1).toEqual({ week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200, focus: 'Z2 volume', z1z2_doel: 0.80, max_intensiteit: 1, sessietypes: ['z2_duur', 'z1_herstel'] })
    expect(body.wijzigingen.some(w => w.week === 1)).toBe(false)
  })
})
