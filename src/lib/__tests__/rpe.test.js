import { describe, it, expect, vi } from 'vitest'
import { berekenVerwachtRpe } from '../sessie/rpe.js'

// Lucia TRIMP (Lucia et al., 2003): Coggan Z1-Z7 tijdsverdeling gegroepeerd naar
// 3 fysiologische zones (gewicht 1/2/3), gewogen naar tijdsaandeel.
// Interface: berekenVerwachtRpe(tijdInZones, duurMinuten)
// tijdInZones mag fracties (som = 1.0) of seconden zijn — wordt intern genormaliseerd.

describe('berekenVerwachtRpe', () => {
  it('berekent correct voor puur Z2, 60 min', () => {
    const rpe = berekenVerwachtRpe({ Z1: 0, Z2: 1, Z3: 0, Z4: 0, Z5: 0, Z6: 0, Z7: 0 }, 60)
    expect(rpe).toBe(3.5)
  })

  it('berekent correct voor gemengde rit (Z2 60%/Z3 30%/Z5 10%, 90 min)', () => {
    const rpe = berekenVerwachtRpe({ Z1: 0, Z2: 0.6, Z3: 0.3, Z4: 0, Z5: 0.1, Z6: 0, Z7: 0 }, 90)
    expect(rpe).toBeCloseTo(5.5, 1)
  })

  it('berekent correct voor sweetspot (Z3 40%/Z4 60%, 90 min)', () => {
    const rpe = berekenVerwachtRpe({ Z1: 0, Z2: 0, Z3: 0.4, Z4: 0.6, Z5: 0, Z6: 0, Z7: 0 }, 90)
    expect(rpe).toBeCloseTo(7.0, 1)
  })

  it('berekent correct voor drempel (Z4 80%/Z5 20%, 60 min)', () => {
    const rpe = berekenVerwachtRpe({ Z1: 0, Z2: 0, Z3: 0, Z4: 0.8, Z5: 0.2, Z6: 0, Z7: 0 }, 60)
    expect(rpe).toBeCloseTo(7.5, 1)
  })

  it('accepteert seconden i.p.v. fracties (wordt intern genormaliseerd)', () => {
    const fracties = berekenVerwachtRpe({ Z2: 0.6, Z3: 0.3, Z5: 0.1 }, 90)
    const seconden = berekenVerwachtRpe({ Z2: 3240, Z3: 1620, Z5: 540 }, 90)
    expect(seconden).toBe(fracties)
  })

  it('verhoogt RPE voor ritten boven 60 min', () => {
    const basis = berekenVerwachtRpe({ Z3: 1 }, 60)
    const lang = berekenVerwachtRpe({ Z3: 1 }, 120)
    expect(lang).toBeGreaterThan(basis)
  })

  it('verlaagt RPE voor korte ritten onder 60 min', () => {
    const basis = berekenVerwachtRpe({ Z2: 1 }, 60)
    const kort = berekenVerwachtRpe({ Z2: 1 }, 20)
    expect(kort).toBeLessThan(basis)
  })

  it('geeft null bij lege of ontbrekende zonedistributie', () => {
    expect(berekenVerwachtRpe({}, 60)).toBeNull()
    expect(berekenVerwachtRpe(undefined, 60)).toBeNull()
  })

  it('RPE overschrijdt nooit 10', () => {
    expect(berekenVerwachtRpe({ Z7: 1 }, 240)).toBeLessThanOrEqual(10)
  })

  it('RPE is nooit lager dan 1', () => {
    expect(berekenVerwachtRpe({ Z1: 1 }, 10)).toBeGreaterThanOrEqual(1)
  })

  it('backward-compat: getal als eerste argument geeft deprecation-warning en IF^2.5-fallback', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rpe = berekenVerwachtRpe(0.7, 60)
    expect(warnSpy).toHaveBeenCalled()
    expect(rpe).toBeCloseTo(4.0, 1)
    warnSpy.mockRestore()
  })
})
