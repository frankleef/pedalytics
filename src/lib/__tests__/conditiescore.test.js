import { describe, it, expect } from 'vitest'
import { berekenConditieScore } from '../conditie.js'

// Score-bereik: [-1, 1] (genormaliseerd)
// Positief = groeiende conditie, negatief = dalend
// rpe_delta_trend === 0 of null → signaal genegeerd (niet-informatief)

describe('berekenConditieScore', () => {
  it('geeft positieve score als alle signalen positief zijn', () => {
    const score = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,       // CTL +15 → max score
      rpe_delta_trend: -2.0,                  // RPE lager dan verwacht → goed
      decoupling_huidig: 0.03, decoupling_vorig: 0.06, // verbetering
    })
    expect(score).toBeGreaterThan(0.5)
  })

  it('geeft negatieve score als alle signalen negatief zijn', () => {
    const score = berekenConditieScore({
      ctl_nu: 40, ctl_4w_geleden: 60,        // CTL -20 → min score
      rpe_delta_trend: 2.5,                   // RPE hoger dan verwacht → slecht
      decoupling_huidig: 0.10, decoupling_vorig: 0.04, // verslechtering
    })
    expect(score).toBeLessThan(0)
  })

  it('rpe_delta_trend === 0 wordt behandeld als null (niet-informatief)', () => {
    const metNul = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,
      rpe_delta_trend: 0,
      decoupling_huidig: 0.05, decoupling_vorig: 0.05,
    })
    const metNull = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,
      rpe_delta_trend: null,
      decoupling_huidig: 0.05, decoupling_vorig: 0.05,
    })
    expect(metNul).toBeCloseTo(metNull, 5)
  })

  it('herverdeelt gewichten correct als rpe_delta_trend null is', () => {
    const score = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,
      rpe_delta_trend: null,
      decoupling_huidig: 0.03, decoupling_vorig: 0.06,
    })
    expect(typeof score).toBe('number')
    expect(isNaN(score)).toBe(false)
  })

  it('werkt met alleen CTL-signaal (rest null)', () => {
    const score = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,
      rpe_delta_trend: null,
      decoupling_huidig: null, decoupling_vorig: null,
    })
    expect(typeof score).toBe('number')
    expect(isNaN(score)).toBe(false)
    // Enkel CTL → genormaliseerde CTL-richting = min(1, (60-45)/10) = 1
    expect(score).toBeCloseTo(1, 5)
  })

  it('retourneert null als geen enkel signaal beschikbaar is', () => {
    const score = berekenConditieScore({
      ctl_nu: null, ctl_4w_geleden: null,
      rpe_delta_trend: null,
      decoupling_huidig: null, decoupling_vorig: null,
    })
    expect(score).toBeNull()
  })

  it('stabiele CTL (0 delta) geeft score dicht bij 0', () => {
    const score = berekenConditieScore({
      ctl_nu: 50, ctl_4w_geleden: 50,
      rpe_delta_trend: null,
      decoupling_huidig: null, decoupling_vorig: null,
    })
    expect(score).toBeCloseTo(0, 5)
  })
})
