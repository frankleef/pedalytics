import { describe, it, expect } from 'vitest'
import {
  selecteerArchetype,
  getArchetypesVoorSessietype,
  getRecenteArchetypes,
  slaArchetypeOp,
} from '../sessie-archetypes.js'
import { ARCHETYPES_FIXTURE } from './fixtures/archetypesFixture.js'

function maakKvMock() {
  const store = new Map()
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => { store.set(key, value) },
    delete: async (key) => { store.delete(key) },
    _store: store,
  }
}

const USER_ID = 'test-user'

describe('selecteerArchetype — pure rotatielogica', () => {
  const archetypes = [
    { id: 'a', naam: 'Archetype A' },
    { id: 'b', naam: 'Archetype B' },
    { id: 'c', naam: 'Archetype C' },
  ]

  it('lege lijst → null', () => {
    expect(selecteerArchetype([], [])).toBeNull()
  })

  it('null lijst → null', () => {
    expect(selecteerArchetype(null, [])).toBeNull()
  })

  it('geen recente history → kiest willekeurig uit alle', () => {
    const gekozen = selecteerArchetype(archetypes, [])
    expect(gekozen).not.toBeNull()
    expect(['a', 'b', 'c']).toContain(gekozen.id)
  })

  it('kiest nooit hetzelfde als recenteArchetypes[0]', () => {
    for (let i = 0; i < 20; i++) {
      const gekozen = selecteerArchetype(archetypes, ['a'])
      expect(gekozen.id).not.toBe('a')
    }
  })

  it('geeft voorkeur aan archetypes die niet in recent staan', () => {
    // recent = ['a', 'b'] → 'c' is enige nieuwe kandidaat
    const counts = { a: 0, b: 0, c: 0 }
    for (let i = 0; i < 30; i++) {
      const gekozen = selecteerArchetype(archetypes, ['a', 'b'])
      counts[gekozen.id]++
    }
    expect(counts.c).toBe(30)
    expect(counts.a).toBe(0)
    expect(counts.b).toBe(0)
  })

  it('als alle archetypes recent zijn: kiest de minst recente (niet de meest recente)', () => {
    // recent = ['a', 'b', 'c'] → meestRecent = 'a' → kandidaten = [b, c]
    // b staat op index 1, c op index 2 → sort desc op index → kandidaten[0] = c (minst recent = hoogste index)
    const gekozen = selecteerArchetype(archetypes, ['a', 'b', 'c'])
    expect(gekozen.id).not.toBe('a')
    expect(gekozen.id).toBe('c')
  })

  it('één archetype, ook al is het recent: geeft het altijd terug', () => {
    const enkel = [{ id: 'solo', naam: 'Solo' }]
    const gekozen = selecteerArchetype(enkel, ['solo'])
    expect(gekozen.id).toBe('solo')
  })
})

describe('selecteerArchetype — rotatie over meerdere sessies', () => {
  it('over 5 sessies sweetspot week 1: minstens 3 verschillende archetypes gekozen', () => {
    const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE['sweetspot_intervallen'], 'sweetspot', 1)
    expect(archetypes.length).toBeGreaterThanOrEqual(3)

    const recent = []
    const gekozenIds = new Set()

    for (let i = 0; i < 5; i++) {
      const gekozen = selecteerArchetype(archetypes, recent)
      expect(gekozen).not.toBeNull()
      gekozenIds.add(gekozen.id)
      recent.unshift(gekozen.id)
      if (recent.length > 3) recent.pop()
    }

    expect(gekozenIds.size).toBeGreaterThanOrEqual(3)
  })

  it('over 5 drempel-sessies: nooit twee keer hetzelfde achter elkaar', () => {
    const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE['drempel_intervallen'], 'drempel', 2)
    expect(archetypes.length).toBeGreaterThanOrEqual(2)

    const recent = []
    const volgorde = []

    for (let i = 0; i < 5; i++) {
      const gekozen = selecteerArchetype(archetypes, recent)
      volgorde.push(gekozen.id)
      recent.unshift(gekozen.id)
      if (recent.length > 3) recent.pop()
    }

    for (let i = 1; i < volgorde.length; i++) {
      expect(volgorde[i]).not.toBe(volgorde[i - 1])
    }
  })

  it('6 gemengd-sessies in vrijheidsfase: minstens 4 unieke archetypes', () => {
    const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE['gemengd'], 'drempel', 3)
    expect(archetypes.length).toBeGreaterThanOrEqual(4)

    const recent = []
    const gekozenIds = new Set()

    for (let i = 0; i < 6; i++) {
      const gekozen = selecteerArchetype(archetypes, recent)
      gekozenIds.add(gekozen.id)
      recent.unshift(gekozen.id)
      if (recent.length > 3) recent.pop()
    }

    expect(gekozenIds.size).toBeGreaterThanOrEqual(4)
  })
})

describe('KV-rotatiestroom — slaArchetypeOp + getRecenteArchetypes', () => {
  it('leeg KV: getRecenteArchetypes geeft []', async () => {
    const kv = maakKvMock()
    const result = await getRecenteArchetypes(kv, USER_ID, 'z2_duur')
    expect(result).toEqual([])
  })

  it('eerste opslag: archetype staat in lijst als meest recent', async () => {
    const kv = maakKvMock()
    await slaArchetypeOp(kv, USER_ID, 'z2_duur', 'z2_cadans')
    const result = await getRecenteArchetypes(kv, USER_ID, 'z2_duur')
    expect(result[0]).toBe('z2_cadans')
  })

  it('tweede sessie: kiest nooit hetzelfde als de eerste (via KV)', async () => {
    const kv = maakKvMock()
    const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE['z2_duur'], 'basis', 1)
    expect(archetypes.length).toBeGreaterThanOrEqual(2)

    const recent1 = await getRecenteArchetypes(kv, USER_ID, 'z2_duur')
    const gekozen1 = selecteerArchetype(archetypes, recent1)
    await slaArchetypeOp(kv, USER_ID, 'z2_duur', gekozen1.id)

    const recent2 = await getRecenteArchetypes(kv, USER_ID, 'z2_duur')
    const gekozen2 = selecteerArchetype(archetypes, recent2)

    expect(gekozen2.id).not.toBe(gekozen1.id)
  })

  it('FIFO: na 4 opslagen staan er max 3 in de lijst', async () => {
    const kv = maakKvMock()
    const ids = ['a', 'b', 'c', 'd']
    for (const id of ids) {
      await slaArchetypeOp(kv, USER_ID, 'z2_duur', id)
    }
    const result = await getRecenteArchetypes(kv, USER_ID, 'z2_duur')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('d')
    expect(result).not.toContain('a')
  })

  it('FIFO: meest recente staat altijd op index 0', async () => {
    const kv = maakKvMock()
    await slaArchetypeOp(kv, USER_ID, 'sweetspot_intervallen', 'ss_standaard')
    await slaArchetypeOp(kv, USER_ID, 'sweetspot_intervallen', 'tempo_continu')
    await slaArchetypeOp(kv, USER_ID, 'sweetspot_intervallen', 'ss_oplopend')

    const result = await getRecenteArchetypes(kv, USER_ID, 'sweetspot_intervallen')
    expect(result[0]).toBe('ss_oplopend')
    expect(result[1]).toBe('tempo_continu')
    expect(result[2]).toBe('ss_standaard')
  })

  it('verschillende sessietypes bewaren onafhankelijke KV-sleutels', async () => {
    const kv = maakKvMock()
    await slaArchetypeOp(kv, USER_ID, 'z2_duur', 'z2_cadans')
    await slaArchetypeOp(kv, USER_ID, 'drempel_intervallen', 'drempel_standaard')

    const z2Recent = await getRecenteArchetypes(kv, USER_ID, 'z2_duur')
    const drempelRecent = await getRecenteArchetypes(kv, USER_ID, 'drempel_intervallen')

    expect(z2Recent[0]).toBe('z2_cadans')
    expect(drempelRecent[0]).toBe('drempel_standaard')
    expect(z2Recent).not.toContain('drempel_standaard')
  })
})
