import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bepaalAlGeleverd } from '../context.js'

vi.mock('../../users.js', () => ({
  getIntervalsCredentials: vi.fn(),
}))
vi.mock('../../intervals.js', () => ({
  intervalsGet: vi.fn(),
}))

import { getIntervalsCredentials } from '../../users.js'
import { intervalsGet } from '../../intervals.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('bepaalAlGeleverd', () => {
  it('telt tss en Z2-minuten op uit gereden ritten deze week', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'test' })
    intervalsGet.mockResolvedValue([
      {
        id: 1, type: 'Ride', icu_training_load: 60, moving_time: 3600,
        icu_zone_times: [{ id: 'Z1', secs: 300 }, { id: 'Z2', secs: 3000 }, { id: 'Z3', secs: 300 }],
      },
      {
        id: 2, type: 'VirtualRide', icu_training_load: 40, moving_time: 1800,
        icu_zone_times: [{ id: 'Z2', secs: 1800 }],
      },
      { id: 3, type: 'Run', icu_training_load: 999, moving_time: 3600 }, // geen fietsrit, telt niet mee
    ])

    const result = await bepaalAlGeleverd('u1', '2026-07-06')
    expect(result.tss).toBe(100)
    expect(result.z2Minuten).toBe(80) // (3000+1800)/60
    expect(result.totaalMinuten).toBe(90) // (3600+1800)/60
  })

  it('geeft lege waarden terug zonder credentials, geen crash', async () => {
    getIntervalsCredentials.mockResolvedValue(null)
    const result = await bepaalAlGeleverd('u1', '2026-07-06')
    expect(result).toEqual({ tss: 0, z2Minuten: 0, totaalMinuten: 0 })
    expect(intervalsGet).not.toHaveBeenCalled()
  })

  it('geeft lege waarden terug bij een mislukte intervals.icu-aanroep, geen crash', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'test' })
    intervalsGet.mockRejectedValue(new Error('intervals.icu 500'))
    const result = await bepaalAlGeleverd('u1', '2026-07-06')
    expect(result).toEqual({ tss: 0, z2Minuten: 0, totaalMinuten: 0 })
  })

  it('geeft lege waarden terug als er geen ritten zijn deze week', async () => {
    getIntervalsCredentials.mockResolvedValue({ apiKey: 'test' })
    intervalsGet.mockResolvedValue([])
    const result = await bepaalAlGeleverd('u1', '2026-07-06')
    expect(result).toEqual({ tss: 0, z2Minuten: 0, totaalMinuten: 0 })
  })
})
