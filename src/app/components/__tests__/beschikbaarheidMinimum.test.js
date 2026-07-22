import { describe, it, expect } from 'vitest'
import { berekenMinimumUren, bepaalMinimumUrenVariant, IF_PER_FASE } from '../beschikbaarheidMinimum.js'

describe('berekenMinimumUren', () => {
  it('rekent het weekdoel-TSS terug naar minimum-uren via de fase-specifieke IF', () => {
    // basis: IF = GEMIDDELDE_IF_BASIS (0.65) -> uren = tss / (0.65^2 * 100)
    expect(berekenMinimumUren(300, 'basis')).toBeCloseTo(300 / (0.65 ** 2 * 100), 6)
    expect(berekenMinimumUren(300, 'sweetspot')).toBeCloseTo(300 / (IF_PER_FASE.sweetspot ** 2 * 100), 6)
  })

  it('onbekende fase valt terug op IF 0.70', () => {
    expect(berekenMinimumUren(300, 'onbekende_fase')).toBeCloseTo(300 / (0.70 ** 2 * 100), 6)
  })
})

describe('bepaalMinimumUrenVariant', () => {
  it('geeft null als er geen weekTssDoel/minimumUren bekend is (bv. de wizard)', () => {
    expect(bepaalMinimumUrenVariant(5, null)).toBeNull()
  })

  it('total < minimumUren -> "waarschuwing" (bestaand gedrag behouden)', () => {
    expect(bepaalMinimumUrenVariant(3, 5)).toBe('waarschuwing')
  })

  it('total >= minimumUren -> "richtlijn" (nieuw: permanente regel i.p.v. niets tonen)', () => {
    expect(bepaalMinimumUrenVariant(6, 5)).toBe('richtlijn')
  })

  it('total exact gelijk aan minimumUren -> "richtlijn", niet "waarschuwing" (grensgeval)', () => {
    expect(bepaalMinimumUrenVariant(5, 5)).toBe('richtlijn')
  })
})
