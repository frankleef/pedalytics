import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn() }))
vi.mock('@/lib/intervals', () => ({ intervalsGet: vi.fn(), intervalsPost: vi.fn() }))
vi.mock('@/lib/sessie/context', () => ({ bepaalAlGeleverd: vi.fn() }))

import { getKV } from '@/lib/kv'
import { getIntervalsCredentials } from '@/lib/users'
import { intervalsGet, intervalsPost } from '@/lib/intervals'
import { bepaalAlGeleverd } from '@/lib/sessie/context'
import { _wisArchetypeCacheVoorTests } from '@/lib/sessie-archetypes'
import { ARCHETYPES_FIXTURE } from '@/lib/__tests__/fixtures/archetypesFixture.js'
import { vulSessiesAanVoorGebruiker } from '../sessiesAanvullen.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    mget: vi.fn(async (...ks) => ks.map(k => store.get(k) ?? null)),
  }
}

// Startdatum maandag 2026-01-05 -> week 3 = 2026-01-19 t/m 2026-01-25 (ma-zo).
// Beschikbaarheid ma/wo/vr -> trainingsdagen die week: 01-19 (ma), 01-21 (wo), 01-23 (vr).
// "Vandaag" op 2026-01-18 (zo) zodat het 7-dagenvenster (i=1..7) alle drie dekt.
const STARTDATUM = '2026-01-05'

function bouwPlan() {
  const kader = []
  for (let week = 1; week <= 4; week++) {
    kader.push({
      week, fase: 'basis', weektype: 'opbouw', tss_doel: 200,
      ...(week === 3 ? { bevat_tussentijdse_ftp_test: true } : {}),
    })
  }
  return {
    kader,
    startdatum: STARTDATUM,
    huidige_ctl: 45,
    huidige_ftp: 265,
    // aerobe_basis: kracht_lage_cadans is hier hard uitgesloten (KRACHT_LAGE_CADANS_VERBODEN_DOELEN)
    // en de basisfase kent geen kernstimulus/secundair — houdt de niet-ramp_test-dagen
    // in dit scenario voorspelbaar op het z2-pad, zodat de test zich puur richt op de
    // ramp_test-forcering (niet op de rest van de deterministische generatiepijplijn).
    seizoensdoel: { type: 'aerobe_basis' },
    beschikbaarheid: { Maandag: true, Dinsdag: false, Woensdag: true, Donderdag: false, Vrijdag: true, Zaterdag: false, Zondag: false },
    urenPerDag: { Maandag: 1.5, Woensdag: 1.5, Vrijdag: 1.5 },
    weekSessies: { sessies: [] },
  }
}

beforeEach(() => {
  _wisArchetypeCacheVoorTests()
  vi.setSystemTime(new Date('2026-01-18T10:00:00'))

  const kvSeed = {
    'archetypes:z2_duur': ARCHETYPES_FIXTURE.z2_duur,
  }
  const kv = maakKvMock(kvSeed)
  vi.mocked(getKV).mockReturnValue(kv)
  vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'k', athleteId: 'a' })
  vi.mocked(bepaalAlGeleverd).mockResolvedValue({ tss: 0 })
  vi.mocked(intervalsGet).mockImplementation(async (pad) => {
    if (pad === '/') return { sportSettings: [{ types: ['Ride'], ftp: 265, lthr: 184, max_hr: 200, power_zones: null }], icu_weight: 80 }
    return null
  })
  vi.mocked(intervalsPost).mockResolvedValue({ id: 'evt_1' })

  // Plan bijwerken in de gemockte KV zodra de functie 'm opslaat
  kv.store.set(`u_test:seizoensplan`, bouwPlan())
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('vulSessiesAanVoorGebruiker — sectie 51-C: forceren laatste trainingsdag van week 3', () => {
  it('forceert 2026-01-23 (vrijdag, laatste trainingsdag van week 3) naar ramp_test; overige dagen ongewijzigd (z2_duur)', async () => {
    const resultaat = await vulSessiesAanVoorGebruiker('u_test', {})
    expect(resultaat.status).toBe('aangevuld')

    const kv = getKV()
    const plan = kv.store.get('u_test:seizoensplan')
    const sessies = plan.weekSessies.sessies
    expect(sessies.map(s => s.datum).sort()).toEqual(['2026-01-19', '2026-01-21', '2026-01-23'])

    const rampTestDag = sessies.find(s => s.datum === '2026-01-23')
    expect(rampTestDag.intentie.rol).toBe('ftp_test')
    expect(rampTestDag.intentie.sessietype).toBe('ramp_test')
    expect(rampTestDag.protocol).toBeDefined()
    expect(rampTestDag.protocol.ramp.start_watt).toBe(100)

    const overigeDagen = sessies.filter(s => s.datum !== '2026-01-23')
    expect(overigeDagen).toHaveLength(2)
    for (const dag of overigeDagen) {
      expect(dag.intentie?.sessietype).not.toBe('ramp_test')
      expect(dag.protocol).toBeUndefined()
    }
  })
})
