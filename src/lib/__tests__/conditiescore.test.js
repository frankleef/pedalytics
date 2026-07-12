import { describe, it, expect } from 'vitest'
import { berekenConditieScore, normaliseerDecoupling, bepaalDecouplingMedianen } from '../conditie.js'

// Score-bereik: [-1, 1] (genormaliseerd)
// Positief = groeiende conditie, negatief = dalend
// rpe_delta_trend === 0 of null → signaal genegeerd (niet-informatief)
// decoupling_huidig/decoupling_vorig zijn procentpunten (dezelfde schaal als berekenDecoupling()
// in decoupling.js, die al ×100 toepast) — dus bv. 3 = 3% decoupling, niet 0.03.

describe('berekenConditieScore', () => {
  it('geeft positieve score als alle signalen positief zijn', () => {
    const score = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,       // CTL +15 → max score
      rpe_delta_trend: -2.0,                  // RPE lager dan verwacht → goed
      decoupling_huidig: 3, decoupling_vorig: 6, // verbetering (6% → 3%)
    })
    expect(score).toBeCloseTo(0.8233333333333333, 10)
    expect(score).toBeGreaterThan(0.5)
  })

  it('geeft negatieve score als alle signalen negatief zijn', () => {
    const score = berekenConditieScore({
      ctl_nu: 40, ctl_4w_geleden: 60,        // CTL -20 → min score
      rpe_delta_trend: 2.5,                   // RPE hoger dan verwacht → slecht
      decoupling_huidig: 10, decoupling_vorig: 4, // verslechtering (4% → 10%), ruim boven de 5pp-clamp
    })
    expect(score).toBeCloseTo(-0.9416666666666668, 10)
    expect(score).toBeLessThan(0)
  })

  it('rpe_delta_trend === 0 wordt behandeld als null (niet-informatief)', () => {
    const metNul = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,
      rpe_delta_trend: 0,
      decoupling_huidig: 5, decoupling_vorig: 5,
    })
    const metNull = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,
      rpe_delta_trend: null,
      decoupling_huidig: 5, decoupling_vorig: 5,
    })
    expect(metNul).toBeCloseTo(metNull, 5)
  })

  it('herverdeelt gewichten correct als rpe_delta_trend null is', () => {
    const score = berekenConditieScore({
      ctl_nu: 60, ctl_4w_geleden: 45,
      rpe_delta_trend: null,
      decoupling_huidig: 3, decoupling_vorig: 6,
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

describe('normaliseerDecoupling', () => {
  it('blijft stabiel bij mediaan_vorig dicht bij nul (regressietest voor de relatieve-formule-instabiliteit)', () => {
    // De oude relatieve formule ((vorig-huidig)/vorig×4) liet dit exploderen naar de volle
    // clamp (-1,0) bij een klein, fysiologisch bescheiden absoluut verschil — zie
    // decoupling-clamp-verificatie.md (12 juli: mediaan_vorig 0,38% → mediaan_huidig 2,85% gaf
    // met de oude formule -1,0; hier geverifieerd dat de nieuwe absolute formule dat niet meer doet).
    const score = normaliseerDecoupling(2.85, 0.38)
    expect(score).toBeCloseTo((0.38 - 2.85) / 5, 10)
    expect(score).toBeGreaterThan(-1)
  })

  it('clamped nog steeds op -1/+1 bij een groot absoluut verschil', () => {
    expect(normaliseerDecoupling(10, 2)).toBeCloseTo(-1, 10) // (2-10)/5 = -1.6 → clamp -1
    expect(normaliseerDecoupling(0, 8)).toBeCloseTo(1, 10)   // (8-0)/5 = 1.6 → clamp 1
  })

  it('geeft 0 alleen bij mediaan_vorig === null (geen bijvangst-fallback, geen deling door nul meer nodig)', () => {
    expect(normaliseerDecoupling(20, null)).toBe(0)
    // mediaan_vorig = 0 (geen ontbrekende data, maar een gemeten 0%-decoupling) wordt WEL
    // doorgerekend — geen deling door nul meer sinds de formule absoluut is:
    expect(normaliseerDecoupling(20, 0)).toBeCloseTo(-1, 10) // (0-20)/5 = -4 → clamp -1
  })
})

describe('bepaalDecouplingMedianen', () => {
  it('geeft null/null bij minder dan 10 kwalificerende ritten', () => {
    const negen = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(bepaalDecouplingMedianen(negen)).toEqual({ huidig: null, vorig: null })
    expect(bepaalDecouplingMedianen([])).toEqual({ huidig: null, vorig: null })
    expect(bepaalDecouplingMedianen(null)).toEqual({ huidig: null, vorig: null })
  })

  it('splitst bij exact 10 ritten correct in eerste 5 ("vorig") en laatste 5 ("huidig"), mediaan = index 2 na sorteren', () => {
    // chronologisch (oudste eerst): eerste 5 vormen "vorig", laatste 5 vormen "huidig"
    const tien = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50]
    const { huidig, vorig } = bepaalDecouplingMedianen(tien)
    expect(vorig).toBe(3)   // mediaan van [1,2,3,4,5]
    expect(huidig).toBe(30) // mediaan van [10,20,30,40,50]
  })

  it('negeert de oudste ritten zodra de pool groter is dan 10 — alleen de meest recente 10 tellen mee', () => {
    // Zelfde 10 als hierboven, met een extreme uitschieter (999) er vóór geplakt. Als die
    // meetelde zou de "vorig"-mediaan drastisch veranderen — dat mag niet gebeuren.
    const elf = [999, 1, 2, 3, 4, 5, 10, 20, 30, 40, 50]
    const { huidig, vorig } = bepaalDecouplingMedianen(elf)
    expect(vorig).toBe(3)
    expect(huidig).toBe(30)
  })
})
