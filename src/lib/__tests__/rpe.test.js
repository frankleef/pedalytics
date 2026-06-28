import { describe, it, expect } from 'vitest'
import { berekenVerwachtRpe } from '../sessie/rpe.js'

// Werkelijke interface: berekenVerwachtRpe(ifWaarde, duurMinuten)
// Let op: functie gebruikt Math.ceil (niet round) → retourneert integer
// IF > 2 wordt als percentage behandeld en gedeeld door 100

describe('berekenVerwachtRpe', () => {
  // IF=0.75, 60min: basis = 10×0.75^2.5 ≈ 4.871, correctie=0 → ceil(4.871) = 5
  it('berekent correct voor IF 0.75, 60 min', () => {
    expect(berekenVerwachtRpe(0.75, 60)).toBe(5)
  })

  // IF als percentage werkt hetzelfde
  it('accepteert IF als percentage (>2 → gedeeld door 100)', () => {
    expect(berekenVerwachtRpe(75, 60)).toBe(berekenVerwachtRpe(0.75, 60))
  })

  // Duurcorrectie positief: IF=0.65, 120min vs 60min
  // 60min: ceil(10×0.65^2.5) = ceil(3.406) = 4
  // 120min: ceil(3.406 + 0.9) = ceil(4.306) = 5
  it('verhoogt RPE voor ritten boven 60 min', () => {
    const basis = berekenVerwachtRpe(0.65, 60)
    const lang  = berekenVerwachtRpe(0.65, 120)
    expect(lang).toBeGreaterThan(basis)
  })

  // Duurcorrectie negatief: IF=0.65, 60min vs 20min
  // 60min: ceil(10×0.65^2.5) = ceil(3.408) = 4
  // 20min: ceil(3.408 + (20-60)×0.015) = ceil(3.408 - 0.6) = ceil(2.808) = 3
  it('verlaagt RPE voor korte ritten onder 60 min', () => {
    const basis = berekenVerwachtRpe(0.65, 60)
    const kort  = berekenVerwachtRpe(0.65, 20)
    expect(kort).toBeLessThan(basis)
  })

  // IF 1.0 → basis = 10×1.0^2.5 = 10 → ceil(10) = 10
  it('IF 1.0 geeft RPE 10 bij 60 min', () => {
    expect(berekenVerwachtRpe(1.0, 60)).toBe(10)
  })

  // Maximum capping
  it('RPE overschrijdt nooit 10', () => {
    expect(berekenVerwachtRpe(1.2, 180)).toBeLessThanOrEqual(10)
    expect(berekenVerwachtRpe(2.0, 300)).toBeLessThanOrEqual(10)
  })

  // Minimum capping
  it('RPE is nooit lager dan 1', () => {
    expect(berekenVerwachtRpe(0.1, 10)).toBeGreaterThanOrEqual(1)
    expect(berekenVerwachtRpe(0.01, 5)).toBeGreaterThanOrEqual(1)
  })

  // Z1 herstelrit: IF=0.52, 45min
  // basis = 10×0.52^2.5 ≈ 1.950, correctie = (45-60)×0.015 = -0.225 → 1.725 → ceil = 2
  it('berekent correct voor Z1 herstelrit (IF 0.52, 45 min)', () => {
    expect(berekenVerwachtRpe(0.52, 45)).toBe(2)
  })

  // Sweetspot: IF=0.9, 90min
  // basis = 10×0.9^2.5 ≈ 7.686, correctie = 0.45 → 8.136 → ceil = 9
  it('sweetspot (IF 0.9, 90 min) geeft hoge RPE', () => {
    const rpe = berekenVerwachtRpe(0.9, 90)
    expect(rpe).toBeGreaterThanOrEqual(8)
    expect(rpe).toBeLessThanOrEqual(10)
  })
})
