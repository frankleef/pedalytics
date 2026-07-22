import { describe, it, expect } from 'vitest'
import { bepaalMinimumUrenVariant, berekenStreefUrenSuggestie, STREEF_UREN_MARGE } from '../beschikbaarheidMinimum.js'

describe('bepaalMinimumUrenVariant', () => {
  it('geeft null als er nog geen streefUrenPerWeek is ingesteld', () => {
    expect(bepaalMinimumUrenVariant(5, null)).toBeNull()
    expect(bepaalMinimumUrenVariant(5, undefined)).toBeNull()
  })

  it('total < streefUrenPerWeek -> "waarschuwing" (bestaand gedrag behouden)', () => {
    expect(bepaalMinimumUrenVariant(3, 5)).toBe('waarschuwing')
  })

  it('total >= streefUrenPerWeek -> "richtlijn"', () => {
    expect(bepaalMinimumUrenVariant(6, 5)).toBe('richtlijn')
  })

  it('total exact gelijk aan streefUrenPerWeek -> "richtlijn", niet "waarschuwing" (grensgeval)', () => {
    expect(bepaalMinimumUrenVariant(5, 5)).toBe('richtlijn')
  })

  it('geen IF/fase-berekening meer nodig — puur directe vergelijking met het opgegeven getal', () => {
    expect(bepaalMinimumUrenVariant(10, 7)).toBe('richtlijn')
    expect(bepaalMinimumUrenVariant(2, 7)).toBe('waarschuwing')
  })
})

describe('berekenStreefUrenSuggestie', () => {
  it('past de Friel-marge (1,125x) toe en rondt af op een half uur', () => {
    expect(STREEF_UREN_MARGE).toBe(1.125)
    expect(berekenStreefUrenSuggestie(5.53)).toBe(6) // 5.53*1.125=6.22 -> 6
    expect(berekenStreefUrenSuggestie(4)).toBe(4.5) // 4*1.125=4.5 -> 4.5
    expect(berekenStreefUrenSuggestie(6.4)).toBe(7) // 6.4*1.125=7.2 -> 7
  })

  it('geeft null bij ontbrekend historisch gemiddelde (geen activiteiten in de periode)', () => {
    expect(berekenStreefUrenSuggestie(null)).toBeNull()
    expect(berekenStreefUrenSuggestie(undefined)).toBeNull()
  })

  it('0 uur historisch gemiddelde geeft een geldige suggestie van 0, geen null', () => {
    expect(berekenStreefUrenSuggestie(0)).toBe(0)
  })
})
