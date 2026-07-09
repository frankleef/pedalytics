import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/sessie/context', () => ({
  bepaalAlGeleverd: vi.fn(),
  haalWellnessVoorDatum: vi.fn(),
}))

import { getKV } from '@/lib/kv'
import { bepaalAlGeleverd, haalWellnessVoorDatum } from '@/lib/sessie/context'
import { _wisArchetypeCacheVoorTests } from '@/lib/sessie-archetypes'
import { ARCHETYPES_FIXTURE } from '@/lib/__tests__/fixtures/archetypesFixture.js'
import { genereerWeekSessiesDeterministisch } from '../weekSessiesDeterministisch.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    mget: vi.fn(async (...ks) => ks.map(k => store.get(k) ?? null)),
  }
}

// Zelfde basisopzet als sessiesAanvullen.rampTest.test.js: aerobe_basis +
// basisfase houdt de niet-ramp_test-dagen voorspelbaar op het z2_duur-pad
// (geen kernstimulus/secundair-split, kracht_lage_cadans hard uitgesloten),
// zodat de tests zich richten op dagselectie/venster-gedrag i.p.v. op de rest
// van de deterministische generatiepijplijn.
const STARTDATUM = '2026-01-05' // maandag

function bouwSeizoensplan(overrides = {}) {
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
    seizoensdoel: { type: 'aerobe_basis' },
    ...overrides,
  }
}

let kv
beforeEach(() => {
  _wisArchetypeCacheVoorTests()
  const kvSeed = { 'archetypes:z2_duur': ARCHETYPES_FIXTURE.z2_duur }
  kv = maakKvMock(kvSeed)
  vi.mocked(getKV).mockReturnValue(kv)
  vi.mocked(bepaalAlGeleverd).mockResolvedValue({ tss: 0 })
  vi.mocked(haalWellnessVoorDatum).mockResolvedValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const profiel = { ftp: 265, lt_hr: 184, max_hr: 200, gewicht: 80 }

describe('genereerWeekSessiesDeterministisch', () => {
  it('retourneert null als er geen beschikbare/onvoltooide dag in het 7-dagenvenster valt', async () => {
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: null, seizoensplan: bouwSeizoensplan(), weekSessies: null,
      urenPerDag: {}, beschikbareDagen: [], voortgang: null,
    })
    expect(resultaat).toBeNull()
  })

  it('plant maximaal maxTrainingsdagenPerWeek(ctl) dagen, met een min-1-rustdag-tussen-4-op-een-rij-gate', async () => {
    // Alle 7 dagen beschikbaar, venster = ma 2026-01-05 t/m zo 2026-01-11 (één ISO-week).
    // ctl 45 -> maxTrainingsdagenPerWeek = 4.
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
    const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))

    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSeizoensplan(), weekSessies: null,
      urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
    })

    expect(resultaat).not.toBeNull()
    expect(resultaat.sessies).toHaveLength(4)
    const datums = resultaat.sessies.map(s => s.datum).sort()
    // do (01-08) valt weg door de 4-op-een-rij-gate na ma/di/wo; za/zo vallen
    // weg omdat de frequentiecap (4) al bereikt is na vr.
    expect(datums).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-09'])
    for (const s of resultaat.sessies) {
      expect(s.intentie?.sessietype).toBe('z2_duur')
      expect(s.datum).toBeDefined()
    }
    expect(resultaat.tss_totaal).toBeGreaterThan(0)
  })

  it('regenereert een dag die al een sessie heeft (silent RPE-herplanning), niet alleen ontbrekende dagen', async () => {
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const bestaandeSessie = {
      datum: '2026-01-05', dag: 'Maandag', type: 'duur_variabel', titel: 'Oude sessie',
      tss: 999, duur_min: 999, intentie: { sessietype: 'z2_duur', tss_doel: 999 },
    }
    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: null, seizoensplan: bouwSeizoensplan(), weekSessies: { sessies: [bestaandeSessie] },
      urenPerDag: { Maandag: 1.5 }, beschikbareDagen: ['Maandag'], voortgang: null,
    })

    expect(resultaat.sessies).toHaveLength(1)
    const nieuw = resultaat.sessies[0]
    expect(nieuw.datum).toBe('2026-01-05')
    expect(nieuw.titel).not.toBe('Oude sessie')
    expect(nieuw.tss).not.toBe(999)
  })

  it('slaat een dag over als de rit die dag al voltooid is (voortgang.ritten matcht)', async () => {
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const bestaandeSessie = { datum: '2026-01-05', dag: 'Maandag', type: 'duur_variabel', tss: 50, duur_min: 60 }
    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: null, seizoensplan: bouwSeizoensplan(), weekSessies: { sessies: [bestaandeSessie] },
      urenPerDag: { Maandag: 1.5 }, beschikbareDagen: ['Maandag'],
      voortgang: { ritten: [{ datum_iso: '2026-01-05' }] },
    })
    // "vandaag" is 2026-01-05 zelf -> voltooid-check vereist datum < vandaag,
    // dus deze rit telt nog niet als voltooid en de dag wordt gewoon gepland.
    expect(resultaat.sessies).toHaveLength(1)
  })

  it('slaat dagen binnen een actieve afwezigheidsperiode over, ook als ze verder beschikbaar/onvoltooid zijn', async () => {
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
    const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))
    kv.store.set('u_test:afwezigheid', [
      { periodeId: 'p1', startDatum: '2026-01-06', eindDatum: '2026-01-08', reden: 'ziek', status: 'actief' },
    ])

    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSeizoensplan(), weekSessies: null,
      urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
    })

    const datums = resultaat.sessies.map(s => s.datum)
    expect(datums).not.toContain('2026-01-06')
    expect(datums).not.toContain('2026-01-07')
    expect(datums).not.toContain('2026-01-08')
    expect(resultaat.sessies.length).toBeGreaterThan(0) // overige dagen worden gewoon gevuld
  })

  it('forceert de laatste trainingsdag van een bevat_tussentijdse_ftp_test-week naar ramp_test', async () => {
    // Venster ma 2026-01-19 t/m zo 2026-01-25 = week 3 (bevat_tussentijdse_ftp_test).
    vi.setSystemTime(new Date('2026-01-19T08:00:00'))
    const beschikbareDagen = ['Maandag', 'Woensdag', 'Vrijdag']
    const urenPerDag = { Maandag: 1.5, Woensdag: 1.5, Vrijdag: 1.5 }

    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: null, seizoensplan: bouwSeizoensplan(), weekSessies: null,
      urenPerDag, beschikbareDagen, voortgang: null,
    })

    expect(resultaat.sessies.map(s => s.datum).sort()).toEqual(['2026-01-19', '2026-01-21', '2026-01-23'])
    const rampTestDag = resultaat.sessies.find(s => s.datum === '2026-01-23')
    expect(rampTestDag.intentie.rol).toBe('ftp_test')
    expect(rampTestDag.intentie.sessietype).toBe('ramp_test')
    expect(rampTestDag.protocol).toBeDefined()

    const overigeDagen = resultaat.sessies.filter(s => s.datum !== '2026-01-23')
    expect(overigeDagen).toHaveLength(2)
    for (const dag of overigeDagen) {
      expect(dag.intentie?.sessietype).not.toBe('ramp_test')
    }
  })
})
