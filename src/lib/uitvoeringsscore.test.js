import { dimensieScore, berekenUitvoeringsscore, zonedistributieScore } from './uitvoeringsscore.js'

// dimensieScore
const ds = dimensieScore

test('dimensieScore: exact op plan (0% afwijking) → 10', () => {
  expect(ds(3600, 3600)).toBe(10)
})

test('dimensieScore: <5% afwijking → 10', () => {
  expect(ds(104, 100)).toBe(10) // +4%
  expect(ds(97, 100)).toBe(10)  // -3%
})

test('dimensieScore: 30% te kort → onder 3.0', () => {
  // afwijking = 0.30, score = 10 - (0.30 - 0.05)/0.019 ≈ 10 - 13.16 = -3.16 → 0
  const score = ds(70, 100) // 30% te kort
  expect(score).toBeLessThan(3.0)
  expect(score).toBe(0) // geclamped op 0
})

test('dimensieScore: doel = 0 → null', () => {
  expect(ds(100, 0)).toBeNull()
})

test('dimensieScore: doel = null → null', () => {
  expect(ds(100, null)).toBeNull()
})

test('dimensieScore: 10% afwijking → tussen 6 en 9', () => {
  const score = ds(110, 100) // +10%
  expect(score).toBeGreaterThan(6)
  expect(score).toBeLessThan(9)
})

// berekenUitvoeringsscore
const gemeenschappelijkeGegevens = {
  werkelijkDuurrit: {
    moving_time: 5400,
    icu_training_load: 80,
    icu_intensity: 0.65,
    icu_time_in_zone: { Z1: 300, Z2: 4800, Z3: 300 },
  },
  geplandDuurrit: {
    duur_seconden: 5400,
    tss_doel: 80,
  },
  intentieZ2: {
    sessietype: 'z2_duur',
    toegestane_zones: ['Z1', 'Z2'],
  },
}

test('berekenUitvoeringsscore: duurrit exact op plan → score dicht bij 10', () => {
  const { werkelijkDuurrit, geplandDuurrit, intentieZ2 } = gemeenschappelijkeGegevens
  const score = berekenUitvoeringsscore(werkelijkDuurrit, geplandDuurrit, intentieZ2)
  expect(score).not.toBeNull()
  expect(score).toBeGreaterThan(8.0)
})

test('berekenUitvoeringsscore: duurrit 30% te kort → duur-dimensie laag', () => {
  const werkelijk = { moving_time: 3780, icu_training_load: 56, icu_intensity: 0.65, icu_time_in_zone: { Z1: 200, Z2: 3380, Z3: 200 } }
  const gepland = { duur_seconden: 5400, tss_doel: 80 }
  const score = berekenUitvoeringsscore(werkelijk, gepland, gemeenschappelijkeGegevens.intentieZ2)
  expect(score).not.toBeNull()
  expect(score).toBeLessThan(7.0)
})

test('berekenUitvoeringsscore: Z2-sessie met 40% Z4 → lager dan sessie met 5% Z4', () => {
  const gepland = { duur_seconden: 5400, tss_doel: 80 }
  const intentie = { sessietype: 'z2_duur', toegestane_zones: ['Z1', 'Z2'] }

  const scoreVeel = berekenUitvoeringsscore(
    { moving_time: 5400, icu_training_load: 80, icu_intensity: 0.65, icu_time_in_zone: { Z1: 300, Z2: 2940, Z3: 0, Z4: 2160 } },
    gepland, intentie
  )
  const scoreWeinig = berekenUitvoeringsscore(
    { moving_time: 5400, icu_training_load: 80, icu_intensity: 0.65, icu_time_in_zone: { Z1: 300, Z2: 4830, Z3: 0, Z4: 270 } },
    gepland, intentie
  )

  expect(scoreWeinig).toBeGreaterThan(scoreVeel)
})

test('berekenUitvoeringsscore: gewichten 0.23+0.15+0.22+0.40 → score in [0,10]', () => {
  const score = berekenUitvoeringsscore(
    { moving_time: 5400, icu_training_load: 80, icu_intensity: 0.65, icu_time_in_zone: { Z1: 300, Z2: 4800, Z3: 300 } },
    { duur_seconden: 5400, tss_doel: 80 },
    { sessietype: 'z2_duur', toegestane_zones: ['Z1', 'Z2'] }
  )
  expect(score).not.toBeNull()
  expect(score).toBeGreaterThanOrEqual(0)
  expect(score).toBeLessThanOrEqual(10)
})

test('berekenUitvoeringsscore: alle dimensies null → null', () => {
  const score = berekenUitvoeringsscore(
    { moving_time: null, icu_training_load: null, icu_intensity: null, icu_time_in_zone: null },
    { duur_seconden: null, tss_doel: null },
    null
  )
  expect(score).toBeNull()
})
