import { describe, it, expect } from 'vitest'
import {
  valideerSessietype,
  getArchetypesVoorSessietype,
  SESSIE_ARCHETYPES,
} from '../sessie-archetypes.js'
import { ARCHETYPES_FIXTURE } from './fixtures/archetypesFixture.js'

const GELDIGE_KERN_TYPES = [
  'z2_duur',
  'sweetspot_intervallen',
  'kracht_lage_cadans',
  'drempel_intervallen',
  'vo2max_intervallen',
  'sprint_neuraal',
  'z6_anaeroob',
  'gemengd',
]

const VERVALLEN_TYPES = [
  'over_under',
  'pyramide',
  'tempo_intervallen',
  'z2_vlak',
  'z2_cadans',
]

describe('valideerSessietype — allowlist', () => {
  it.each(GELDIGE_KERN_TYPES)('%s → true', (type) => {
    expect(valideerSessietype(type)).toBe(true)
  })

  it.each(VERVALLEN_TYPES)('%s → false (vervallen)', (type) => {
    expect(valideerSessietype(type)).toBe(false)
  })

  it('null → false', () => {
    expect(valideerSessietype(null)).toBe(false)
  })

  it('lege string → false', () => {
    expect(valideerSessietype('')).toBe(false)
  })

  it('onbekend type → false', () => {
    expect(valideerSessietype('maak_dit_maar_op')).toBe(false)
  })

  it('uitgebreide types (z2_heuvel, z1_herstel) zijn geen kern → false', () => {
    expect(valideerSessietype('z2_heuvel')).toBe(false)
    expect(valideerSessietype('z1_herstel')).toBe(false)
    expect(valideerSessietype('progressief')).toBe(false)
  })
})

describe('deprecated types zijn nu archetypes in hun ouder-sessietype', () => {
  it('z2_cadans bestaat als archetype in z2_duur', () => {
    const archetypes = SESSIE_ARCHETYPES['z2_duur'] ?? []
    const ids = archetypes.map(a => a.id)
    expect(ids).toContain('z2_cadans')
  })

  it('tempo_continu en tempo_intervallen bestaan als archetypes in sweetspot_intervallen', () => {
    const archetypes = SESSIE_ARCHETYPES['sweetspot_intervallen'] ?? []
    const ids = archetypes.map(a => a.id)
    expect(ids).toContain('tempo_continu')
    expect(ids).toContain('tempo_intervallen')
  })

  it('over_under archetypes bestaan in drempel_intervallen', () => {
    const archetypes = SESSIE_ARCHETYPES['drempel_intervallen'] ?? []
    const ids = archetypes.map(a => a.id)
    expect(ids).toContain('ou_standaard')
    expect(ids).toContain('ou_lang')
  })

  it('pyramide archetypes bestaan in drempel_intervallen', () => {
    const archetypes = SESSIE_ARCHETYPES['drempel_intervallen'] ?? []
    const ids = archetypes.map(a => a.id)
    expect(ids).toContain('pyr_oplopend')
    expect(ids).toContain('pyr_volledig')
  })

  it('SESSIE_ARCHETYPES heeft geen top-level sleutel voor vervallen types', () => {
    for (const type of VERVALLEN_TYPES) {
      expect(SESSIE_ARCHETYPES).not.toHaveProperty(type)
    }
  })
})

describe('over_under beschikbaarheid per fase en week', () => {
  it('sweetspot week 1-4: ou_standaard niet beschikbaar', () => {
    for (let w = 1; w <= 4; w++) {
      const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE['drempel_intervallen'], 'sweetspot', w)
      const ids = archetypes.map(a => a.id)
      expect(ids).not.toContain('ou_standaard')
      expect(ids).not.toContain('ou_lang')
    }
  })

  it('sweetspot week 5+: ou_standaard beschikbaar (in drempel_intervallen met sweetspot-fase)', () => {
    // ou_standaard zit in drempel_intervallen, beschikbaar in sweetspot-fase vanaf week 5
    const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE['drempel_intervallen'], 'sweetspot', 5)
    const ids = archetypes.map(a => a.id)
    expect(ids).toContain('ou_standaard')
  })

  it('drempel week 1: ou_standaard beschikbaar', () => {
    const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE['drempel_intervallen'], 'drempel', 1)
    const ids = archetypes.map(a => a.id)
    expect(ids).toContain('ou_standaard')
  })

  it('consolidatie week 1: ou_standaard beschikbaar', () => {
    const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE['drempel_intervallen'], 'consolidatie', 1)
    const ids = archetypes.map(a => a.id)
    expect(ids).toContain('ou_standaard')
  })
})

describe('alle kern-sessietypes hebben minstens 1 archetype in elke relevante fase', () => {
  const typesMetFasen = {
    z2_duur: ['basis', 'sweetspot', 'drempel', 'consolidatie'],
    sweetspot_intervallen: ['sweetspot', 'drempel', 'consolidatie'],
    drempel_intervallen: ['drempel', 'consolidatie'],
    vo2max_intervallen: ['vo2max', 'consolidatie'],
    sprint_neuraal: ['sweetspot', 'drempel', 'consolidatie'],
    kracht_lage_cadans: ['sweetspot', 'drempel'],
    z6_anaeroob: ['sweetspot', 'drempel', 'consolidatie'],
    gemengd: ['sweetspot', 'drempel', 'vo2max'],
  }

  for (const [type, fasen] of Object.entries(typesMetFasen)) {
    for (const fase of fasen) {
      it(`${type} × ${fase} → minstens 1 archetype`, () => {
        const archetypes = getArchetypesVoorSessietype(ARCHETYPES_FIXTURE[type], fase, 1)
        expect(archetypes.length).toBeGreaterThan(0)
      })
    }
  }
})
