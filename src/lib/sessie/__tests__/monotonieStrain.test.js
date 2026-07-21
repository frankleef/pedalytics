import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../users.js', () => ({
  getIntervalsCredentials: vi.fn(),
}))
vi.mock('../../intervals.js', () => ({
  intervalsGet: vi.fn(),
}))

import { getIntervalsCredentials } from '../../users.js'
import { intervalsGet } from '../../intervals.js'
import { haalDagelijkseTssReeks, berekenMonotonieEnStrain } from '../monotonieStrain.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('berekenMonotonieEnStrain', () => {
  it('grenswaarde: monotonie exact 2.0 -> trigger false (net niet-triggerend)', () => {
    // [30, 10]: gemiddelde=20, populatie-stdev=10 (afwijkingen ±10, kwadraten
    // 100+100=200, /2=100, wortel=10) -> monotonie = 20/10 = 2.0 exact.
    const resultaat = berekenMonotonieEnStrain([30, 10])
    expect(resultaat.gemiddelde).toBe(20)
    expect(resultaat.standaarddeviatie).toBe(10)
    expect(resultaat.monotonie).toBe(2.0)
    expect(resultaat.trigger).toBe(false)
  })

  it('net boven de grens: monotonie ≈2,053 -> trigger true', () => {
    // [29, 10]: gemiddelde=19.5, afwijkingen ±9.5, kwadraten 90.25+90.25=180.5,
    // /2=90.25, wortel=9.5 (9.5^2=90.25 exact) -> monotonie = 19.5/9.5.
    const resultaat = berekenMonotonieEnStrain([29, 10])
    expect(resultaat.gemiddelde).toBe(19.5)
    expect(resultaat.standaarddeviatie).toBe(9.5)
    expect(resultaat.monotonie).toBeCloseTo(2.0526315789, 9)
    expect(resultaat.trigger).toBe(true)
  })

  it('standaarddeviatie === 0 met positief gemiddelde (elke dag exact dezelfde, niet-nul TSS) -> monotonie Infinity, trigger true', () => {
    const resultaat = berekenMonotonieEnStrain([50, 50, 50, 50, 50, 50, 50])
    expect(resultaat.standaarddeviatie).toBe(0)
    expect(resultaat.monotonie).toBe(Infinity)
    expect(resultaat.trigger).toBe(true)
  })

  it('standaarddeviatie === 0 MET gemiddelde === 0 (volledige rustweek, geen training) -> geen trigger', () => {
    const resultaat = berekenMonotonieEnStrain([0, 0, 0, 0, 0, 0, 0])
    expect(resultaat.gemiddelde).toBe(0)
    expect(resultaat.standaarddeviatie).toBe(0)
    expect(resultaat.monotonie).toBe(0)
    expect(resultaat.trigger).toBe(false)
  })

  it('strain = som(dagelijkseTss) * monotonie (Foster-vorm: weekbelasting × monotonie)', () => {
    const dagelijkseTss = [10, 20, 30, 40] // som=100, gemiddelde=25, populatie-stdev=sqrt(125)
    const resultaat = berekenMonotonieEnStrain(dagelijkseTss)
    const verwachteMonotonie = 25 / Math.sqrt(125)
    expect(resultaat.monotonie).toBeCloseTo(verwachteMonotonie, 10)
    expect(resultaat.strain).toBeCloseTo(100 * verwachteMonotonie, 6)
  })
})

describe('haalDagelijkseTssReeks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T10:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('0-fill voor dagen zonder activiteit + correcte groepering (incl. som van meerdere ritten op dezelfde dag)', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'test' })
    intervalsGet.mockResolvedValue([
      { type: 'Ride', icu_training_load: 60, start_date_local: '2026-07-10T08:00:00' },
      { type: 'VirtualRide', icu_training_load: 20, start_date_local: '2026-07-13T07:00:00' },
      { type: 'Ride', icu_training_load: 15, start_date_local: '2026-07-13T18:00:00' }, // zelfde dag, moet optellen
      { type: 'Run', icu_training_load: 999, start_date_local: '2026-07-14T08:00:00' }, // geen fietsrit, telt niet mee
    ])

    const reeks = await haalDagelijkseTssReeks('u1', 7)

    // Venster 2026-07-09 t/m 2026-07-15 (7 dagen, chronologisch)
    expect(reeks).toEqual([0, 60, 0, 0, 35, 0, 0])
    expect(reeks).toHaveLength(7)
  })

  it('fail-open: geen credentials -> null, intervalsGet niet aangeroepen', async () => {
    getIntervalsCredentials.mockResolvedValue(null)
    const reeks = await haalDagelijkseTssReeks('u1', 7)
    expect(reeks).toBeNull()
    expect(intervalsGet).not.toHaveBeenCalled()
  })

  it('fail-open: mislukte intervals.icu-aanroep -> null, geen crash', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'test' })
    intervalsGet.mockRejectedValue(new Error('intervals.icu 500'))
    const reeks = await haalDagelijkseTssReeks('u1', 7)
    expect(reeks).toBeNull()
  })

  it('geen activiteiten deze week -> volledige 0-reeks, niet null', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'test' })
    intervalsGet.mockResolvedValue([])
    const reeks = await haalDagelijkseTssReeks('u1', 7)
    expect(reeks).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})
