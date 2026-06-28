import { describe, it, expect, beforeEach } from 'vitest'
import { slaArchetypeOp, getRecenteArchetypes } from '../sessie-archetypes.js'

// KV-mock: retourneert null voor onbekende sleutels (geen throw — slaArchetypeOp
// vangt uitzonderingen en zou anders nooit opslaan).
function maakKvMock() {
  const store = new Map()
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, val) => { store.set(key, val) },
    _store: store,
  }
}

describe('getRecenteArchetypes', () => {
  it('geeft lege array terug als sleutel niet bestaat', async () => {
    const kv = maakKvMock()
    const result = await getRecenteArchetypes(kv, 'user1', 'z2_duur')
    expect(result).toEqual([])
  })

  it('geeft eerder opgeslagen array terug', async () => {
    const kv = maakKvMock()
    kv._store.set('sessie_archetypes:user1:z2_duur', ['z2_progressief', 'z2_golf'])
    const result = await getRecenteArchetypes(kv, 'user1', 'z2_duur')
    expect(result).toEqual(['z2_progressief', 'z2_golf'])
  })

  it('geeft lege array bij KV-fout', async () => {
    const kvKapot = { get: async () => { throw new Error('KV kapot') } }
    const result = await getRecenteArchetypes(kvKapot, 'user1', 'z2_duur')
    expect(result).toEqual([])
  })
})

describe('slaArchetypeOp', () => {
  let kv

  beforeEach(() => {
    kv = maakKvMock()
  })

  it('slaat eerste archetype op als array met één element', async () => {
    await slaArchetypeOp(kv, 'user1', 'z2_duur', 'z2_progressief')
    const opgeslagen = kv._store.get('sessie_archetypes:user1:z2_duur')
    expect(opgeslagen).toEqual(['z2_progressief'])
  })

  it('prepend nieuw archetype vóór bestaande', async () => {
    kv._store.set('sessie_archetypes:user1:z2_duur', ['z2_progressief', 'z2_golf'])
    await slaArchetypeOp(kv, 'user1', 'z2_duur', 'z2_negatief_split')
    const opgeslagen = kv._store.get('sessie_archetypes:user1:z2_duur')
    expect(opgeslagen[0]).toBe('z2_negatief_split')
    expect(opgeslagen[1]).toBe('z2_progressief')
    expect(opgeslagen[2]).toBe('z2_golf')
  })

  it('FIFO max 3: oudste valt weg bij vierde opslag', async () => {
    kv._store.set('sessie_archetypes:user1:z2_duur', ['a', 'b', 'c'])
    await slaArchetypeOp(kv, 'user1', 'z2_duur', 'd')
    const opgeslagen = kv._store.get('sessie_archetypes:user1:z2_duur')
    expect(opgeslagen).toHaveLength(3)
    expect(opgeslagen).toEqual(['d', 'a', 'b'])
  })

  it('sleutel bevat userId en sessietype', async () => {
    await slaArchetypeOp(kv, 'frank', 'sweetspot_intervallen', 'ss_standaard')
    const sleutels = [...kv._store.keys()]
    expect(sleutels).toContain('sessie_archetypes:frank:sweetspot_intervallen')
  })

  it('slaat ook op bij lege KV (null-return veilig)', async () => {
    await slaArchetypeOp(kv, 'user2', 'drempel_intervallen', 'drempel_standaard')
    const opgeslagen = kv._store.get('sessie_archetypes:user2:drempel_intervallen')
    expect(opgeslagen).toEqual(['drempel_standaard'])
  })

  it('gooit niet bij KV-fout (swallowed)', async () => {
    const kvKapot = {
      get: async () => { throw new Error('KV kapot') },
      set: async () => { throw new Error('KV kapot') },
    }
    await expect(slaArchetypeOp(kvKapot, 'user1', 'z2_duur', 'z2_golf')).resolves.toBeUndefined()
  })
})
