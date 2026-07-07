import { describe, it, expect } from 'vitest'
import { getArchetypesVoorSessietype } from '../sessie-archetypes.js'
import { ARCHETYPES_FIXTURE } from './fixtures/archetypesFixture.js'

// getArchetypesVoorSessietype(archetypes, fase, weekInFase = 1, seizoensdoel = null)
// archetypes = de al-opgehaalde array voor één sessietype (KV of fixture).
// Filtert op: fase_beschikbaar, week_in_fase_min, doel_beperking

function voor(sessietype) {
  return ARCHETYPES_FIXTURE[sessietype] ?? []
}

describe('getArchetypesVoorSessietype', () => {
  it('lege/ontbrekende archetype-array → lege array', () => {
    expect(getArchetypesVoorSessietype(undefined, 'basis')).toEqual([])
    expect(getArchetypesVoorSessietype([], 'basis')).toEqual([])
  })

  it('z2_duur in fase basis → alle archetypes zonder week_in_fase_min beperking', () => {
    const resultaten = getArchetypesVoorSessietype(voor('z2_duur'), 'basis', 1)
    // z2_tempo_blokken heeft week_in_fase_min: 3 → valt weg bij weekInFase=1
    expect(resultaten.some(a => a.id === 'z2_progressief')).toBe(true)
    expect(resultaten.some(a => a.id === 'z2_tempo_blokken')).toBe(false)
  })

  it('z2_duur week 3 → ook z2_tempo_blokken beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype(voor('z2_duur'), 'basis', 3)
    expect(resultaten.some(a => a.id === 'z2_tempo_blokken')).toBe(true)
  })

  it('ou_* in drempel_intervallen, sweetspot week 4 → niet beschikbaar (< week 5)', () => {
    const resultaten = getArchetypesVoorSessietype(voor('drempel_intervallen'), 'sweetspot', 4)
    expect(resultaten.some(a => a.id === 'ou_standaard')).toBe(false)
    expect(resultaten.some(a => a.id === 'ou_lang')).toBe(false)
  })

  it('ou_* in drempel_intervallen, sweetspot week 5 → beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype(voor('drempel_intervallen'), 'sweetspot', 5)
    expect(resultaten.some(a => a.id === 'ou_standaard')).toBe(true)
    expect(resultaten.some(a => a.id === 'ou_lang')).toBe(true)
  })

  it('ou_* in drempel_intervallen, drempel week 1 → beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype(voor('drempel_intervallen'), 'drempel', 1)
    expect(resultaten.some(a => a.id === 'ou_standaard')).toBe(true)
    expect(resultaten.some(a => a.id === 'ou_lang')).toBe(true)
  })

  it('kracht_lage_cadans seizoensdoel klimmen → ook kracht_standaard beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype(voor('kracht_lage_cadans'), 'basis', 1, 'klimmen')
    expect(resultaten.some(a => a.id === 'kracht_standaard')).toBe(true)
  })

  it('kracht_lage_cadans seizoensdoel tijdrijden → leeg (doel_beperking match mislukt)', () => {
    const resultaten = getArchetypesVoorSessietype(voor('kracht_lage_cadans'), 'basis', 1, 'tijdrijden')
    expect(resultaten).toEqual([])
  })

  it('kracht_lage_cadans zonder seizoensdoel → beide beschikbaar', () => {
    // Geen seizoensdoel → doel_beperking-filter wordt niet toegepast
    const resultaten = getArchetypesVoorSessietype(voor('kracht_lage_cadans'), 'basis', 1, null)
    expect(resultaten.some(a => a.id === 'kracht_standaard')).toBe(true)
    expect(resultaten.some(a => a.id === 'kracht_lang')).toBe(false) // week_in_fase_min: 2
  })

  it('vo2_klim met klimmen als doel → beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype(voor('vo2max_intervallen'), 'vo2max', 2, 'klimmen')
    expect(resultaten.some(a => a.id === 'vo2_klim')).toBe(true)
  })

  it('vo2_klim met sprint als doel → niet beschikbaar (doel_beperking: ["klimmen"])', () => {
    const resultaten = getArchetypesVoorSessietype(voor('vo2max_intervallen'), 'vo2max', 2, 'sprint')
    expect(resultaten.some(a => a.id === 'vo2_klim')).toBe(false)
  })

  it('sprint_neuraal in alle fasen beschikbaar (ook week 1)', () => {
    const basis = getArchetypesVoorSessietype(voor('sprint_neuraal'), 'basis', 1)
    const vo2 = getArchetypesVoorSessietype(voor('sprint_neuraal'), 'vo2max', 1)
    expect(basis.some(a => a.id === 'sprint_kort')).toBe(true)
    expect(vo2.some(a => a.id === 'sprint_kort')).toBe(true)
  })

  it('gemengd archetypes alleen beschikbaar in sweetspot/drempel/vo2max', () => {
    const basis = getArchetypesVoorSessietype(voor('gemengd'), 'basis', 1)
    const ss = getArchetypesVoorSessietype(voor('gemengd'), 'sweetspot', 1)
    expect(basis).toHaveLength(0)
    expect(ss.length).toBeGreaterThan(0)
  })

  it('alle teruggegeven archetypes zijn object met id en naam', () => {
    const resultaten = getArchetypesVoorSessietype(voor('drempel_intervallen'), 'drempel', 1)
    for (const a of resultaten) {
      expect(typeof a.id).toBe('string')
      expect(typeof a.naam).toBe('string')
    }
  })

  // Spec validatiescenario's
  it('tempo_continu/tempo_intervallen zitten in sweetspot_intervallen (sweetspot, week 1)', () => {
    const resultaten = getArchetypesVoorSessietype(voor('sweetspot_intervallen'), 'sweetspot', 1)
    expect(resultaten.some(a => a.id === 'tempo_continu')).toBe(true)
    expect(resultaten.some(a => a.id === 'tempo_intervallen')).toBe(true)
  })

  it('z2_cadans zit in z2_duur archetypes (basis, week 1)', () => {
    const resultaten = getArchetypesVoorSessietype(voor('z2_duur'), 'basis', 1)
    expect(resultaten.some(a => a.id === 'z2_cadans')).toBe(true)
  })

  it('pyr_* niet beschikbaar in sweetspot (fase onbeschikbaar)', () => {
    const resultaten = getArchetypesVoorSessietype(voor('drempel_intervallen'), 'sweetspot', 5)
    expect(resultaten.some(a => a.id === 'pyr_oplopend')).toBe(false)
    expect(resultaten.some(a => a.id === 'pyr_volledig')).toBe(false)
  })

  it('pyr_oplopend beschikbaar in drempel week 1', () => {
    const resultaten = getArchetypesVoorSessietype(voor('drempel_intervallen'), 'drempel', 1)
    expect(resultaten.some(a => a.id === 'pyr_oplopend')).toBe(true)
  })

  it('drempel archetypes (drempel_standaard etc.) NIET in sweetspot', () => {
    const resultaten = getArchetypesVoorSessietype(voor('drempel_intervallen'), 'sweetspot', 5)
    expect(resultaten.some(a => a.id === 'drempel_standaard')).toBe(false)
  })
})

describe('getArchetypesVoorSessietype — weektype (bugfix: z2_tempo_blokken in herstelweek)', () => {
  // Bugreport: week 4 van de basisfase (een herstelweek) telt gewoon mee als
  // "week 4" voor week_in_fase_min, dus z2_tempo_blokken (week_in_fase_min: 3,
  // ingekapselde Z3-blokken) verscheen ten onrechte in een herstelweek.
  it('z2_tempo_blokken/z2_tempo_teugjes vallen weg in een herstelweek, ook als week_in_fase_min gehaald wordt', () => {
    const resultaten = getArchetypesVoorSessietype(voor('z2_duur'), 'basis', 4, 'ftp', null, 'herstel')
    expect(resultaten.some(a => a.id === 'z2_tempo_blokken')).toBe(false)
    expect(resultaten.some(a => a.id === 'z2_tempo_teugjes')).toBe(false)
    // De overige z2_duur-archetypes (pure Z2-variatie, geen ingekapselde intensiteit)
    // blijven gewoon beschikbaar in een herstelweek.
    expect(resultaten.some(a => a.id === 'z2_progressief')).toBe(true)
  })

  it('z2_tempo_blokken blijft gewoon beschikbaar in een opbouwweek (geen regressie)', () => {
    const resultaten = getArchetypesVoorSessietype(voor('z2_duur'), 'basis', 4, 'ftp', null, 'opbouw')
    expect(resultaten.some(a => a.id === 'z2_tempo_blokken')).toBe(true)
  })

  it('geen weektype meegegeven -> geen herstelweek-filter, backward-compatible', () => {
    const resultaten = getArchetypesVoorSessietype(voor('z2_duur'), 'basis', 4)
    expect(resultaten.some(a => a.id === 'z2_tempo_blokken')).toBe(true)
  })
})

describe('getArchetypesVoorSessietype — min_duur_min (feature: "deze sessie kan alleen vanaf 1u30")', () => {
  const archetypes = [
    { id: 'kort', naam: 'Kort', fase_beschikbaar: ['basis'], min_duur_min: 30 },
    { id: 'lang', naam: 'Lang', fase_beschikbaar: ['basis'], min_duur_min: 90 },
    { id: 'zonder_grens', naam: 'Zonder grens', fase_beschikbaar: ['basis'] },
  ]

  it('geen beschikbareDuurMin meegegeven -> geen duurfilter, backward-compatible', () => {
    const resultaten = getArchetypesVoorSessietype(archetypes, 'basis', 1, null)
    expect(resultaten.map(a => a.id)).toEqual(['kort', 'lang', 'zonder_grens'])
  })

  it('beschikbareDuurMin onder het minimum van een archetype -> valt weg', () => {
    const resultaten = getArchetypesVoorSessietype(archetypes, 'basis', 1, null, 45)
    expect(resultaten.map(a => a.id)).toEqual(['kort', 'zonder_grens'])
  })

  it('beschikbareDuurMin exact op het minimum -> archetype blijft beschikbaar (>=, niet >)', () => {
    const resultaten = getArchetypesVoorSessietype(archetypes, 'basis', 1, null, 90)
    expect(resultaten.map(a => a.id)).toContain('lang')
  })

  it('archetypes zonder min_duur_min zijn nooit onderhevig aan de duurfilter', () => {
    const resultaten = getArchetypesVoorSessietype(archetypes, 'basis', 1, null, 1)
    expect(resultaten.map(a => a.id)).toEqual(['zonder_grens'])
  })

  it('ou_standaard/ou_lang (die de generieke week_in_fase_min/doel_beperking-check overslaan) respecteren de duurfilter wél', () => {
    const ouArchetype = [{ id: 'ou_standaard', naam: 'OU', fase_beschikbaar: ['drempel'], min_duur_min: 60 }]
    const resultaten = getArchetypesVoorSessietype(ouArchetype, 'drempel', 1, null, 30)
    expect(resultaten).toEqual([])
  })
})
