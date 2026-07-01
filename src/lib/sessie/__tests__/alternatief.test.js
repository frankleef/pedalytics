import { describe, it, expect } from 'vitest'
import { bepaalNieuweIntentie } from '../alternatief.js'
import { GELDIGE_SESSIETYPES } from '../../sessie-archetypes.js'

describe('bepaalNieuweIntentie', () => {
  it('retourneert null zonder originele intentie', () => {
    expect(bepaalNieuweIntentie(null, 'motivatie', 'basis', null)).toBeNull()
  })

  it('hitte/vermoeid op een intensiteitsdag -> altijd z2_duur (herstelgericht)', () => {
    const origineel = { rol: 'intensiteitsdag', sessietype: 'sweetspot_intervallen', tss_range: { min: 70, max: 95 } }
    const resultaat = bepaalNieuweIntentie(origineel, 'hitte', 'sweetspot', null, 3, 'ftp')
    expect(resultaat.sessietype).toBe('z2_duur')
    expect(resultaat.rol).toBe('aerobe_dag')
    expect(resultaat.toegestane_zones).toEqual(['Z1', 'Z2'])
  })

  it('HRV rood zonder expliciete reden gedraagt zich als "vermoeid" op een intensiteitsdag', () => {
    const origineel = { rol: 'intensiteitsdag', sessietype: 'drempel_intervallen', tss_range: { min: 80, max: 100 } }
    const resultaat = bepaalNieuweIntentie(origineel, null, 'drempel', 'rood', 2, 'ftp')
    expect(resultaat.sessietype).toBe('z2_duur')
  })

  it('motivatie/weinig_tijd op een aerobe_dag (z2_duur) -> blijft binnen geldige sessietypes, nooit dezelfde', () => {
    const origineel = { rol: 'aerobe_dag', sessietype: 'z2_duur', toegestane_zones: ['Z2'] }
    const resultaat = bepaalNieuweIntentie(origineel, 'motivatie', 'basis', null, 2, 'ftp')
    expect(resultaat).not.toBeNull()
    expect(GELDIGE_SESSIETYPES.has(resultaat.sessietype)).toBe(true)
  })

  it('geeft nooit een archetype-id, legacy naam, of niet-gemigreerd type terug (de oude bug)', () => {
    const ONGELDIGE_NAMEN = [
      'progressief', 'sweetspot_lang', 'vo2max_lang', 'vo2max_kort', 'microbursts',
      'z2_lang', 'z2_heuvel', 'race_simulatie', 'herstel_actief', 'herstel_mobiliteit',
    ]
    const rollen = ['intensiteitsdag', 'variabele_dag', 'aerobe_dag', 'hersteldag']
    const doelen = ['ftp', 'klimmen', 'aerobe_basis', 'uithoudingsvermogen', 'sprint']
    const fases = ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test']

    for (const rol of rollen) {
      for (const doel of doelen) {
        for (const fase of fases) {
          const origineel = { rol, sessietype: 'kracht_lage_cadans', toegestane_zones: ['Z2'] }
          const resultaat = bepaalNieuweIntentie(origineel, 'motivatie', fase, null, 3, doel)
          expect(resultaat).not.toBeNull()
          expect(ONGELDIGE_NAMEN).not.toContain(resultaat.sessietype)
          expect(GELDIGE_SESSIETYPES.has(resultaat.sessietype)).toBe(true)
        }
      }
    }
  })

  it('valt terug op z2_duur als geen enkele rol-kandidaat bereikbaar is in de gevraagde fase/week', () => {
    // vo2max_intervallen-achtige rol (intensiteitsdag) in 'basis'-fase, week 1: de meeste
    // kandidaten (sweetspot/drempel/vo2max/gemengd) zijn daar niet bereikbaar (zie fase-
    // dekkingsfix), sprint_neuraal en kracht_lage_cadans wel — dus geen throw, geen crash.
    const origineel = { rol: 'intensiteitsdag', sessietype: 'sprint_neuraal', toegestane_zones: ['Z7'] }
    const resultaat = bepaalNieuweIntentie(origineel, 'motivatie', 'basis', null, 1, 'aerobe_basis')
    expect(resultaat).not.toBeNull()
    expect(GELDIGE_SESSIETYPES.has(resultaat.sessietype)).toBe(true)
  })
})
