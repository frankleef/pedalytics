import { describe, it, expect } from 'vitest'
import { berekenDecoupling } from '../decoupling.js'

// Werkelijke interface: berekenDecoupling(rawWatts[], rawHr[])
// Drempel: 2700 niet-nul samples na filtering (geen tijdsdrempel van 60 min)
// Formule: ((ef1 - ef2) / ef1) * 100, ef = NP / gemHR
// Positief = cardiac drift (slechter); Negatief = efficiëntere tweede helft (beter)

function herhaal(waarde, n) {
  return Array(n).fill(waarde)
}

describe('berekenDecoupling', () => {
  it('retourneert null bij lege arrays', () => {
    expect(berekenDecoupling([], [])).toBeNull()
    expect(berekenDecoupling(null, null)).toBeNull()
  })

  it('retourneert null bij minder dan 2700 niet-nul samples', () => {
    const result = berekenDecoupling(herhaal(200, 2699), herhaal(140, 2699))
    expect(result).toBeNull()
  })

  it('berekent wél voor 2700+ niet-nul samples', () => {
    const result = berekenDecoupling(herhaal(200, 5400), herhaal(140, 5400))
    expect(result).not.toBeNull()
  })

  it('stabiele rit (constant W + constant HR) → ~0%', () => {
    const result = berekenDecoupling(herhaal(200, 7200), herhaal(140, 7200))
    expect(result).toBeCloseTo(0, 1)
  })

  it('negatieve decoupling: tweede helft efficiënter (lagere HR) → result < 0', () => {
    // Eerste helft: hoge HR (155) — minder efficiënt
    // Tweede helft: lage HR (130) — efficiënter
    const watts = herhaal(200, 7200)
    const hr = [...herhaal(155, 3600), ...herhaal(130, 3600)]
    const result = berekenDecoupling(watts, hr)
    expect(result).toBeLessThan(0)
  })

  it('positieve decoupling: tweede helft hogere HR (cardiac drift) → result > 0', () => {
    // Eerste helft: lage HR (130) — efficiënt
    // Tweede helft: hoge HR (155) — vermoeidheid/drift
    const watts = herhaal(200, 7200)
    const hr = [...herhaal(130, 3600), ...herhaal(155, 3600)]
    const result = berekenDecoupling(watts, hr)
    expect(result).toBeGreaterThan(0)
  })

  it('NP van constante stroom ≈ vermogen zelf (geen NaN)', () => {
    const result = berekenDecoupling(herhaal(200, 7200), herhaal(140, 7200))
    expect(typeof result).toBe('number')
    expect(isNaN(result)).toBe(false)
  })

  it('nul-watt samples worden gefilterd: alleen rit met genoeg actieve samples telt', () => {
    // 2600 actieve samples + 3000 nul-samples = 5600 totaal, maar slechts 2600 actief
    const watts = [...herhaal(200, 2600), ...herhaal(0, 3000)]
    const hr = [...herhaal(140, 2600), ...herhaal(0, 3000)]
    const result = berekenDecoupling(watts, hr)
    expect(result).toBeNull() // 2600 < 2700 → null
  })

  it('retourneert een getal (geen null) voor representatieve Z2-rit', () => {
    // 2 uur stabiele rit
    const result = berekenDecoupling(herhaal(180, 7200), herhaal(138, 7200))
    expect(result).not.toBeNull()
    expect(typeof result).toBe('number')
  })
})
