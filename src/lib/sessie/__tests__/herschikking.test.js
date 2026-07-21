import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))

import { getKV } from '@/lib/kv'
import { _wisArchetypeCacheVoorTests } from '@/lib/sessie-archetypes'
import { ARCHETYPES_FIXTURE } from '@/lib/__tests__/fixtures/archetypesFixture.js'
import { probeerHerschikking } from '../herschikking.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

const KADER_DREMPEL = [{ week: 1, fase: 'drempel', weektype: 'opbouw' }]
const STARTDATUM = '2026-07-13' // maandag

function bouwPlan({ sessies, kader = KADER_DREMPEL } = {}) {
  return {
    kader,
    startdatum: STARTDATUM,
    huidige_ftp: 265,
    seizoensdoel: { type: 'ftp' },
    urenPerDag: { Woensdag: 1.5, Donderdag: 1.5, Vrijdag: 1.5 },
    weekSessies: { sessies },
  }
}

let kv
beforeEach(() => {
  _wisArchetypeCacheVoorTests()
  kv = maakKvMock({
    'archetypes:drempel_intervallen': ARCHETYPES_FIXTURE.drempel_intervallen,
    'archetypes:z2_duur': ARCHETYPES_FIXTURE.z2_duur,
  })
  vi.mocked(getKV).mockReturnValue(kv)
})

describe('probeerHerschikking (B5)', () => {
  it('null zonder sessies of zonder gemisteSessietype', async () => {
    expect(await probeerHerschikking('u1', { weekSessies: null }, '2026-07-14', 'drempel_intervallen')).toBeNull()
    expect(await probeerHerschikking('u1', bouwPlan({ sessies: [] }), '2026-07-14', null)).toBeNull()
  })

  it('null als er geen geldige herschikkingskandidaat is (vindHerschikkingsKandidaat geeft null)', async () => {
    const plan = bouwPlan({
      sessies: [
        { datum: '2026-07-14', dag: 'Dinsdag' }, // gedowngradeerde dag, geen andere dagen deze week
      ],
    })
    expect(await probeerHerschikking('u1', plan, '2026-07-14', 'drempel_intervallen')).toBeNull()
  })

  it('verzwakte variant vóór volledige typewissel: gemiste sessietype past nog (archetype gevonden) -> zelfde sessietype, gewicht 2', async () => {
    const plan = bouwPlan({
      sessies: [
        { datum: '2026-07-14', dag: 'Dinsdag' }, // gedowngradeerde dag
        { datum: '2026-07-15', dag: 'Woensdag', voltooid: false, intentie: { sessietype: 'z2_duur' } }, // kandidaat
      ],
    })

    const resultaat = await probeerHerschikking('u1', plan, '2026-07-14', 'drempel_intervallen')

    expect(resultaat).toEqual({ kandidaatDatum: '2026-07-15', effectiefSessietype: 'drempel_intervallen' })
    const kandidaatSessie = plan.weekSessies.sessies.find(s => s.datum === '2026-07-15')
    expect(kandidaatSessie.intentie.sessietype).toBe('drempel_intervallen') // geen typewissel — het gemiste type paste nog
  })

  it('volledige typewissel naar z2_duur als er geen geldig archetype/budget is voor het gemiste sessietype op de kandidaatdag', async () => {
    // Kader-fase 'basis' bevat geen enkel drempel_intervallen-archetype
    // (fase_beschikbaar sluit 'basis' overal uit) -> bouwArchetypeKeuze geeft
    // null -> fallback naar z2_duur.
    const kaderBasis = [{ week: 1, fase: 'basis', weektype: 'opbouw' }]
    const plan = bouwPlan({
      kader: kaderBasis,
      sessies: [
        { datum: '2026-07-14', dag: 'Dinsdag' },
        { datum: '2026-07-15', dag: 'Woensdag', voltooid: false, intentie: { sessietype: 'z2_duur' } },
      ],
    })

    const resultaat = await probeerHerschikking('u1', plan, '2026-07-14', 'drempel_intervallen')

    expect(resultaat).toEqual({ kandidaatDatum: '2026-07-15', effectiefSessietype: 'z2_duur' })
    const kandidaatSessie = plan.weekSessies.sessies.find(s => s.datum === '2026-07-15')
    expect(kandidaatSessie.intentie.sessietype).toBe('z2_duur')
  })

  it('markeert de nieuwe kandidaatsessie als beschermd_herschikking en zet verplaatst_van naar de gedowngradeerde datum', async () => {
    const plan = bouwPlan({
      sessies: [
        { datum: '2026-07-14', dag: 'Dinsdag' },
        { datum: '2026-07-15', dag: 'Woensdag', voltooid: false, intentie: { sessietype: 'z2_duur' } },
      ],
    })

    await probeerHerschikking('u1', plan, '2026-07-14', 'drempel_intervallen')

    const kandidaatSessie = plan.weekSessies.sessies.find(s => s.datum === '2026-07-15')
    expect(kandidaatSessie.beschermd_herschikking).toBe(true)
    expect(kandidaatSessie.verplaatst_van).toBe('2026-07-14')
  })

  it('zet verplaatst_naar op de oorspronkelijke (gedowngradeerde) sessie', async () => {
    const plan = bouwPlan({
      sessies: [
        { datum: '2026-07-14', dag: 'Dinsdag' },
        { datum: '2026-07-15', dag: 'Woensdag', voltooid: false, intentie: { sessietype: 'z2_duur' } },
      ],
    })

    await probeerHerschikking('u1', plan, '2026-07-14', 'drempel_intervallen')

    const gedowngradeSessie = plan.weekSessies.sessies.find(s => s.datum === '2026-07-14')
    expect(gedowngradeSessie.verplaatst_naar).toBe('2026-07-15')
  })

  it('nooit over de weekgrens heen: geen kandidaat in de volgende week ondanks een verder passende dag', async () => {
    const plan = bouwPlan({
      sessies: [
        { datum: '2026-07-18', dag: 'Zaterdag' }, // gedowngradeerd, week van 13-19 juli
        { datum: '2026-07-20', dag: 'Maandag', voltooid: false, intentie: { sessietype: 'z2_duur' } }, // volgende week
      ],
    })

    const resultaat = await probeerHerschikking('u1', plan, '2026-07-18', 'drempel_intervallen')

    expect(resultaat).toBeNull()
  })
})
