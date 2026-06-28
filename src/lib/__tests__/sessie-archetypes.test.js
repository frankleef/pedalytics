import { describe, it, expect } from 'vitest'
import { getArchetypesVoorSessietype, SESSIE_ARCHETYPES } from '../sessie-archetypes.js'

// getArchetypesVoorSessietype(sessietype, fase, weekInFase = 1, seizoensdoel = null)
// Filtert op: fase_beschikbaar, week_in_fase_min, doel_beperking

describe('getArchetypesVoorSessietype', () => {
  it('onbekend sessietype → lege array', () => {
    expect(getArchetypesVoorSessietype('onbekend', 'basis')).toEqual([])
  })

  it('z2_duur in fase basis → alle archetypes zonder week_in_fase_min beperking', () => {
    const resultaten = getArchetypesVoorSessietype('z2_duur', 'basis', 1)
    // z2_tempo_blokken heeft week_in_fase_min: 3 → valt weg bij weekInFase=1
    expect(resultaten.some(a => a.id === 'z2_progressief')).toBe(true)
    expect(resultaten.some(a => a.id === 'z2_tempo_blokken')).toBe(false)
  })

  it('z2_duur week 3 → ook z2_tempo_blokken beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype('z2_duur', 'basis', 3)
    expect(resultaten.some(a => a.id === 'z2_tempo_blokken')).toBe(true)
  })

  it('ou_* in drempel_intervallen, sweetspot week 4 → niet beschikbaar (< week 5)', () => {
    const resultaten = getArchetypesVoorSessietype('drempel_intervallen', 'sweetspot', 4)
    expect(resultaten.some(a => a.id === 'ou_standaard')).toBe(false)
    expect(resultaten.some(a => a.id === 'ou_lang')).toBe(false)
  })

  it('ou_* in drempel_intervallen, sweetspot week 5 → beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype('drempel_intervallen', 'sweetspot', 5)
    expect(resultaten.some(a => a.id === 'ou_standaard')).toBe(true)
    expect(resultaten.some(a => a.id === 'ou_lang')).toBe(true)
  })

  it('ou_* in drempel_intervallen, drempel week 1 → beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype('drempel_intervallen', 'drempel', 1)
    expect(resultaten.some(a => a.id === 'ou_standaard')).toBe(true)
    expect(resultaten.some(a => a.id === 'ou_lang')).toBe(true)
  })

  it('kracht_lage_cadans seizoensdoel klimmen → ook kracht_standaard beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype('kracht_lage_cadans', 'basis', 1, 'klimmen')
    expect(resultaten.some(a => a.id === 'kracht_standaard')).toBe(true)
  })

  it('kracht_lage_cadans seizoensdoel tijdrijden → leeg (doel_beperking match mislukt)', () => {
    const resultaten = getArchetypesVoorSessietype('kracht_lage_cadans', 'basis', 1, 'tijdrijden')
    expect(resultaten).toEqual([])
  })

  it('kracht_lage_cadans zonder seizoensdoel → beide beschikbaar', () => {
    // Geen seizoensdoel → doel_beperking-filter wordt niet toegepast
    const resultaten = getArchetypesVoorSessietype('kracht_lage_cadans', 'basis', 1, null)
    expect(resultaten.some(a => a.id === 'kracht_standaard')).toBe(true)
    expect(resultaten.some(a => a.id === 'kracht_lang')).toBe(false) // week_in_fase_min: 2
  })

  it('vo2_klim met klimmen als doel → beschikbaar', () => {
    const resultaten = getArchetypesVoorSessietype('vo2max_intervallen', 'vo2max', 2, 'klimmen')
    expect(resultaten.some(a => a.id === 'vo2_klim')).toBe(true)
  })

  it('vo2_klim met sprint als doel → niet beschikbaar (doel_beperking: ["klimmen"])', () => {
    const resultaten = getArchetypesVoorSessietype('vo2max_intervallen', 'vo2max', 2, 'sprint')
    expect(resultaten.some(a => a.id === 'vo2_klim')).toBe(false)
  })

  it('sprint_neuraal in alle fasen beschikbaar (ook week 1)', () => {
    const basis = getArchetypesVoorSessietype('sprint_neuraal', 'basis', 1)
    const vo2 = getArchetypesVoorSessietype('sprint_neuraal', 'vo2max', 1)
    expect(basis.some(a => a.id === 'sprint_kort')).toBe(true)
    expect(vo2.some(a => a.id === 'sprint_kort')).toBe(true)
  })

  it('gemengd archetypes alleen beschikbaar in sweetspot/drempel/vo2max', () => {
    const basis = getArchetypesVoorSessietype('gemengd', 'basis', 1)
    const ss = getArchetypesVoorSessietype('gemengd', 'sweetspot', 1)
    expect(basis).toHaveLength(0)
    expect(ss.length).toBeGreaterThan(0)
  })

  it('alle teruggegeven archetypes zijn object met id en naam', () => {
    const resultaten = getArchetypesVoorSessietype('drempel_intervallen', 'drempel', 1)
    for (const a of resultaten) {
      expect(typeof a.id).toBe('string')
      expect(typeof a.naam).toBe('string')
    }
  })

  // Spec validatiescenario's
  it('tempo_continu/tempo_intervallen zitten in sweetspot_intervallen (sweetspot, week 1)', () => {
    const resultaten = getArchetypesVoorSessietype('sweetspot_intervallen', 'sweetspot', 1)
    expect(resultaten.some(a => a.id === 'tempo_continu')).toBe(true)
    expect(resultaten.some(a => a.id === 'tempo_intervallen')).toBe(true)
  })

  it('z2_cadans zit in z2_duur archetypes (basis, week 1)', () => {
    const resultaten = getArchetypesVoorSessietype('z2_duur', 'basis', 1)
    expect(resultaten.some(a => a.id === 'z2_cadans')).toBe(true)
  })

  it('pyr_* niet beschikbaar in sweetspot (fase onbeschikbaar)', () => {
    const resultaten = getArchetypesVoorSessietype('drempel_intervallen', 'sweetspot', 5)
    expect(resultaten.some(a => a.id === 'pyr_oplopend')).toBe(false)
    expect(resultaten.some(a => a.id === 'pyr_volledig')).toBe(false)
  })

  it('pyr_oplopend beschikbaar in drempel week 1', () => {
    const resultaten = getArchetypesVoorSessietype('drempel_intervallen', 'drempel', 1)
    expect(resultaten.some(a => a.id === 'pyr_oplopend')).toBe(true)
  })

  it('drempel archetypes (drempel_standaard etc.) NIET in sweetspot', () => {
    const resultaten = getArchetypesVoorSessietype('drempel_intervallen', 'sweetspot', 5)
    expect(resultaten.some(a => a.id === 'drempel_standaard')).toBe(false)
  })
})
