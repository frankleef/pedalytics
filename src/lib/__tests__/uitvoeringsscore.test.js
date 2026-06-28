import { describe, it, expect } from 'vitest'
import {
  berekenUitvoeringsscore,
  dimensieScore,
  zonedistributieScore,
} from '../uitvoeringsscore.js'

// Werkelijke interface:
//   berekenUitvoeringsscore(werkelijk, gepland, dagIntentie)
//   werkelijk: { moving_time, icu_training_load, icu_intensity, icu_time_in_zone }
//   gepland:   { duur_seconden, tss_doel }
//   dagIntentie: { sessietype, toegestane_zones }

describe('dimensieScore', () => {
  it('exact op plan (0% afwijking) → 10', () => {
    expect(dimensieScore(3600, 3600)).toBe(10)
  })

  it('<5% afwijking → 10 (plateau)', () => {
    expect(dimensieScore(104, 100)).toBe(10)
    expect(dimensieScore(97, 100)).toBe(10)
  })

  it('30% te kort → 0 (geclamped)', () => {
    expect(dimensieScore(70, 100)).toBe(0)
  })

  it('doel = 0 → null', () => {
    expect(dimensieScore(100, 0)).toBeNull()
  })

  it('doel = null → null', () => {
    expect(dimensieScore(100, null)).toBeNull()
  })

  it('10% afwijking → score tussen 6 en 9', () => {
    const score = dimensieScore(110, 100)
    expect(score).toBeGreaterThan(6)
    expect(score).toBeLessThan(9)
  })
})

describe('zonedistributieScore', () => {
  it('volledig binnen toegestane zones → 10', () => {
    const score = zonedistributieScore({ Z1: 300, Z2: 4800 }, ['Z1', 'Z2'])
    expect(score).toBe(10)
  })

  it('plateau-fix: kleine afwijking (≤15%) → volledige score', () => {
    // 13% in Z3 terwijl alleen Z2 gepland — ≤15% plateau → score 10
    const score = zonedistributieScore(
      { Z2: 3900, Z3: 600 },  // 13% afwijking
      ['Z2']
    )
    expect(score).toBe(10)
  })

  it('grote afwijking buiten zones → lage score', () => {
    // 40% in Z4 terwijl alleen Z2 gepland
    const score = zonedistributieScore(
      { Z2: 3240, Z4: 2160 },  // 40% Z4
      ['Z1', 'Z2']
    )
    expect(score).toBeLessThan(8)
  })

  it('null tijdInZones → null', () => {
    expect(zonedistributieScore(null, ['Z1', 'Z2'])).toBeNull()
  })

  it('lege toegestaneZones → null', () => {
    expect(zonedistributieScore({ Z2: 3600 }, [])).toBeNull()
  })
})

describe('berekenUitvoeringsscore', () => {
  const werkelijkPerfect = {
    moving_time: 5400,
    icu_training_load: 80,
    icu_intensity: 0.65,
    icu_time_in_zone: { Z1: 300, Z2: 4800, Z3: 300 },
  }
  const geplandStandaard = { duur_seconden: 5400, tss_doel: 80 }
  const intentieZ2 = { sessietype: 'z2_duur', toegestane_zones: ['Z1', 'Z2'] }

  it('perfecte uitvoering → score dicht bij 10', () => {
    const score = berekenUitvoeringsscore(werkelijkPerfect, geplandStandaard, intentieZ2)
    expect(score).toBeGreaterThan(8.0)
  })

  it('30% te korte rit → score < 7 (duur + tss = 0, IF + zone intact)', () => {
    const werkelijk = {
      moving_time: 3780,
      icu_training_load: 56,
      icu_intensity: 0.65,
      icu_time_in_zone: { Z1: 200, Z2: 3380, Z3: 200 },
    }
    const score = berekenUitvoeringsscore(werkelijk, geplandStandaard, intentieZ2)
    expect(score).toBeLessThan(7.0)
  })

  it('40% Z4 geeft lagere score dan 5% Z4 bij Z2-intentie', () => {
    const gepland = { duur_seconden: 5400, tss_doel: 80 }
    const intentie = { sessietype: 'z2_duur', toegestane_zones: ['Z1', 'Z2'] }
    const scoreVeel = berekenUitvoeringsscore(
      { moving_time: 5400, icu_training_load: 80, icu_intensity: 0.65, icu_time_in_zone: { Z1: 300, Z2: 2940, Z4: 2160 } },
      gepland, intentie
    )
    const scoreWeinig = berekenUitvoeringsscore(
      { moving_time: 5400, icu_training_load: 80, icu_intensity: 0.65, icu_time_in_zone: { Z1: 300, Z2: 4830, Z4: 270 } },
      gepland, intentie
    )
    expect(scoreWeinig).toBeGreaterThan(scoreVeel)
  })

  it('score altijd in bereik [0, 10]', () => {
    const score = berekenUitvoeringsscore(werkelijkPerfect, geplandStandaard, intentieZ2)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(10)
  })

  it('alle dimensies null → null', () => {
    const score = berekenUitvoeringsscore(
      { moving_time: null, icu_training_load: null, icu_intensity: null, icu_time_in_zone: null },
      { duur_seconden: null, tss_doel: null },
      null
    )
    expect(score).toBeNull()
  })

  it('crasht niet bij ontbrekende dagIntentie', () => {
    expect(() => berekenUitvoeringsscore(werkelijkPerfect, geplandStandaard, null)).not.toThrow()
  })
})
