import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/qstash', () => ({ verifyQStash: vi.fn(async () => false) }))
vi.mock('@/lib/posthog', () => ({ logEvent: vi.fn() }))
vi.mock('@/lib/meldingen', () => ({ maakMelding: vi.fn(async () => {}) }))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn(async () => ({ apiKey: 'k', athleteId: 'a' })) }))
vi.mock('@/lib/intervals', () => ({ intervalsGet: vi.fn(async () => []) }))

import { getKV } from '@/lib/kv'
import { logEvent } from '@/lib/posthog'
import { maakMelding } from '@/lib/meldingen'
import { getIntervalsCredentials } from '@/lib/users'
import { intervalsGet } from '@/lib/intervals'
import { datumOffset } from '@/lib/datum'
import { POST } from '../route.js'

process.env.ADMIN_SECRET = 'test-secret'

beforeEach(() => {
  vi.mocked(logEvent).mockClear()
  vi.mocked(maakMelding).mockClear()
  vi.mocked(getIntervalsCredentials).mockClear()
  vi.mocked(intervalsGet).mockReset()
  vi.mocked(intervalsGet).mockResolvedValue([])
})

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

function req(auth = `Bearer test-secret`) {
  return { headers: { get: (h) => h === 'authorization' ? auth : null } }
}

function kernsessie(datum, overrides = {}) {
  return { datum, intentie: { sessietype: 'z2_duur', toegestane_zones: ['Z2'] }, ...overrides }
}

describe('POST /api/cron/compliance-check', () => {
  it('401 zonder correcte auth (en zonder geldige QStash-signature)', async () => {
    vi.mocked(getKV).mockReturnValue(maakKvMock())
    const resp = await POST(req('Bearer verkeerd'))
    expect(resp.status).toBe(401)
  })

  // De 48u-grace is dagniveau-granulair (datumOffset(-2), zie route.js), niet
  // minuutniveau-precies — sessie.datum heeft zelf geen tijdcomponent. Een
  // letterlijke 47u59m-vs-48u01m-test is dus niet representeerbaar door deze
  // implementatie; onderstaande drie tests dekken de daadwerkelijk
  // geïmplementeerde grens (datumOffset(-2), kalenderdag-inclusief).
  it('kernsessie exact op de grens (datumOffset(-2)) wordt als niet_geleverd gedetecteerd', async () => {
    const grensDatum = datumOffset(-2)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(grensDatum)] } },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.results[0]).toMatchObject({ userId: 'u1', status: 'ok', gedetecteerd: 1 })

    const record = kv.store.get(`sessie_compliance:u1:${grensDatum}`)
    expect(record).toMatchObject({ tier: 'niet_geleverd', percentageOfScore: 0, sessietype: 'z2_duur', isKernsessie: true })
    expect(logEvent).toHaveBeenCalledWith('sessie_overgeslagen', 'u1', { datum: grensDatum, sessietype: 'z2_duur' })
    expect(maakMelding).toHaveBeenCalledWith('u1', 'sessie_gemist', expect.objectContaining({ datum: grensDatum, sessietype: 'z2_duur' }))
  })

  it('kernsessie van gisteren (binnen de grace-periode) wordt NIET gedetecteerd', async () => {
    const gisteren = datumOffset(-1)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(gisteren)] } },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 0 })
    expect(kv.store.has(`sessie_compliance:u1:${gisteren}`)).toBe(false)
    expect(logEvent).not.toHaveBeenCalled()
  })

  it('kernsessie ruim voorbij de grens (3 dagen geleden) wordt gedetecteerd', async () => {
    const driedgn = datumOffset(-3)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(driedgn)] } },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()
    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 1 })
  })

  it('niet-kernsessie (bv. z1_herstel) voorbij de grens wordt genegeerd', async () => {
    const driedgn = datumOffset(-3)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': {
        weekSessies: {
          sessies: [kernsessie(driedgn, { intentie: { sessietype: 'z1_herstel', toegestane_zones: ['Z1'] } })],
        },
      },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 0 })
    expect(kv.store.has(`sessie_compliance:u1:${driedgn}`)).toBe(false)
    expect(logEvent).not.toHaveBeenCalled()
  })

  it('discrete-effort-sessie (sprint_neuraal) voorbij de grens wordt genegeerd', async () => {
    const driedgn = datumOffset(-3)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': {
        weekSessies: {
          sessies: [kernsessie(driedgn, { intentie: { sessietype: 'sprint_neuraal', toegestane_zones: ['Z1'] } })],
        },
      },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()
    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 0 })
  })

  it('een al-voltooide kernsessie voorbij de grens wordt niet gedetecteerd', async () => {
    const driedgn = datumOffset(-3)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(driedgn, { voltooid: true })] } },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()
    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 0 })
  })

  it('een kernsessie met een al-bestaand compliance-record wordt niet opnieuw gedetecteerd (geen dubbele write/melding)', async () => {
    const driedgn = datumOffset(-3)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(driedgn)] } },
      [`sessie_compliance:u1:${driedgn}`]: { tier: 'volledig', percentageOfScore: 92, sessietype: 'z2_duur', isKernsessie: true, datum: driedgn },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 0 })
    expect(logEvent).not.toHaveBeenCalled()
    expect(maakMelding).not.toHaveBeenCalled()
  })
})

describe('POST /api/cron/compliance-check — C7: verplaatste (hrv_verplaatst_naar) sessies', () => {
  it('bron-datum met hrv_verplaatst_naar krijgt geen niet_geleverd/sessie_gemist, de nieuwe datum telt correct mee zodra ZIJ voorbij de grens is', async () => {
    const bronDatum = datumOffset(-5)
    const nieuweDatum = datumOffset(-3)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': {
        weekSessies: {
          sessies: [
            kernsessie(bronDatum, { mode: 'geschrapt_hrv', hrv_keuze_gemaakt: true, hrv_keuze: 'verplaatsen', hrv_verplaatst_naar: nieuweDatum }),
            kernsessie(nieuweDatum, { hrv_verplaatst_van: bronDatum, voltooid: true }),
          ],
        },
      },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 0 })
    expect(kv.store.has(`sessie_compliance:u1:${bronDatum}`)).toBe(false)
    expect(kv.store.has(`sessie_compliance:u1:${nieuweDatum}`)).toBe(false) // al voltooid -> geen kernsessie-compliance-write hier nodig
    expect(logEvent).not.toHaveBeenCalled()
    expect(maakMelding).not.toHaveBeenCalled()
  })

  it('regressie: een sessie zonder hrv_verplaatst_naar die echt gemist is blijft gewoon niet_geleverd', async () => {
    const driedgn = datumOffset(-3)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(driedgn)] } },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 1 })
    const record = kv.store.get(`sessie_compliance:u1:${driedgn}`)
    expect(record).toMatchObject({ tier: 'niet_geleverd', sessietype: 'z2_duur' })
    expect(maakMelding).toHaveBeenCalledWith('u1', 'sessie_gemist', expect.objectContaining({ datum: driedgn }))
  })

  it('een verplaatste sessie die ALSNOG niet gereden is op de nieuwe datum geldt daar wél als gemist (verdwijnt niet stilzwijgend)', async () => {
    const bronDatum = datumOffset(-5)
    const nieuweDatum = datumOffset(-3)
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': {
        weekSessies: {
          sessies: [
            kernsessie(bronDatum, { mode: 'geschrapt_hrv', hrv_keuze_gemaakt: true, hrv_keuze: 'verplaatsen', hrv_verplaatst_naar: nieuweDatum }),
            kernsessie(nieuweDatum, { hrv_verplaatst_van: bronDatum }), // niet voltooid
          ],
        },
      },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 1 })
    expect(kv.store.has(`sessie_compliance:u1:${bronDatum}`)).toBe(false)
    const nieuwRecord = kv.store.get(`sessie_compliance:u1:${nieuweDatum}`)
    expect(nieuwRecord).toMatchObject({ tier: 'niet_geleverd', verplaatst_van: bronDatum })
    expect(maakMelding).toHaveBeenCalledWith('u1', 'sessie_gemist', expect.objectContaining({ datum: nieuweDatum }))
  })
})

describe('POST /api/cron/compliance-check — C8 reconciliatie', () => {
  it('sluit een niet_geleverd-record MET activiteitId uit van reconciliatie (echte, matige match — met rust laten)', async () => {
    const datum = datumOffset(-5)
    const bestaandRecord = {
      tier: 'niet_geleverd', percentageOfScore: 20, sessietype: 'z2_duur', isKernsessie: true,
      verplaatst_van: null, verplaatst_naar: null, activiteitId: 'echt-matig-id', datum,
      berekendOp: '2026-01-01T00:00:00.000Z',
    }
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(datum)] } },
      [`sessie_compliance:u1:${datum}`]: bestaandRecord,
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 0, gereconcilieerd: 0 })
    // Geen kandidaat verzameld -> geen intervals.icu-call nodig
    expect(intervalsGet).not.toHaveBeenCalled()
    // Record volledig ongewijzigd
    expect(kv.store.get(`sessie_compliance:u1:${datum}`)).toEqual(bestaandRecord)
  })

  it('shadowing-scenario: een late activiteit gevolgd door een nieuwere rit wordt via de datum-map alsnog gevonden (niet via "nieuwste")', async () => {
    const lateDatum = datumOffset(-5)
    const nieuwereDatum = datumOffset(-1)
    const bestaandRecord = {
      tier: 'niet_geleverd', percentageOfScore: 0, sessietype: 'z2_duur', isKernsessie: true,
      verplaatst_van: null, verplaatst_naar: null, activiteitId: null, datum: lateDatum,
      berekendOp: '2026-01-01T00:00:00.000Z',
    }
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(lateDatum)] } },
      [`sessie_compliance:u1:${lateDatum}`]: bestaandRecord,
    })
    vi.mocked(getKV).mockReturnValue(kv)

    // "nieuwste" (cron/sync/route.js:203) zou hier de nieuwereDatum-rit kiezen en
    // de lateDatum-rit nooit meer zien — reconciliatie moet 'm via de datum-map
    // toch vinden, ongeacht dat er een latere rit tussen zit.
    vi.mocked(intervalsGet).mockResolvedValue([
      { id: 'late-rit', type: 'Ride', start_date_local: `${lateDatum}T08:00:00`, icu_training_load: 80, icu_zone_times: [{ id: 'Z2', secs: 3600 }] },
      { id: 'nieuwere-rit', type: 'Ride', start_date_local: `${nieuwereDatum}T08:00:00`, icu_training_load: 50, icu_zone_times: [] },
    ])

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gedetecteerd: 0, gereconcilieerd: 1 })

    const record = kv.store.get(`sessie_compliance:u1:${lateDatum}`)
    expect(record.activiteitId).toBe('late-rit')
    expect(record.tier).toBe('volledig') // 100% tijd in Z2 (toegestane_zones: ['Z2'])
    expect(record.percentageOfScore).toBe(100)

    const plan = kv.store.get('u1:seizoensplan')
    const versSessie = plan.weekSessies.sessies.find(s => s.datum === lateDatum)
    expect(versSessie.voltooid).toBe(true)

    // Geen dubbele/nieuwe melding of event bij een correctie (buiten scope, zie plan)
    expect(logEvent).not.toHaveBeenCalled()
    expect(maakMelding).not.toHaveBeenCalled()
  })

  it('geen match gevonden in het venster: record blijft niet_geleverd, geen voltooid-vlag gezet', async () => {
    const datum = datumOffset(-5)
    const bestaandRecord = {
      tier: 'niet_geleverd', percentageOfScore: 0, sessietype: 'z2_duur', isKernsessie: true,
      verplaatst_van: null, verplaatst_naar: null, activiteitId: null, datum,
      berekendOp: '2026-01-01T00:00:00.000Z',
    }
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(datum)] } },
      [`sessie_compliance:u1:${datum}`]: bestaandRecord,
    })
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValue([]) // geen ritten gevonden

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ status: 'ok', gereconcilieerd: 0 })
    expect(kv.store.get(`sessie_compliance:u1:${datum}`)).toEqual(bestaandRecord)
    const plan = kv.store.get('u1:seizoensplan')
    expect(plan.weekSessies.sessies.find(s => s.datum === datum).voltooid).toBeFalsy()
  })

  it('een niet_geleverd-record buiten het reconciliatievenster (ouder dan COMPLIANCE_VENSTER_DAGEN) wordt niet herchecked', async () => {
    const teOud = datumOffset(-15)
    const bestaandRecord = {
      tier: 'niet_geleverd', percentageOfScore: 0, sessietype: 'z2_duur', isKernsessie: true,
      verplaatst_van: null, verplaatst_naar: null, activiteitId: null, datum: teOud,
      berekendOp: '2026-01-01T00:00:00.000Z',
    }
    const kv = maakKvMock({
      'users:active': ['u1'],
      'u1:seizoensplan': { weekSessies: { sessies: [kernsessie(teOud)] } },
      [`sessie_compliance:u1:${teOud}`]: bestaandRecord,
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const resp = await POST(req())
    const body = await resp.json()

    expect(body.results[0]).toMatchObject({ gereconcilieerd: 0 })
    expect(intervalsGet).not.toHaveBeenCalled()
  })
})
