import { describe, it, expect, vi } from 'vitest'
import { leesFitnessprogressie } from '../fitnessprogressieIO.js'

describe('leesFitnessprogressie (Blok F, fase 1)', () => {
  it('leest een bestaand fitnessprogressie:${userId}-record ongewijzigd terug', async () => {
    const resultaat = { ctlTrend: { status: 'ok', hellingPerWeek: 1.2 }, decouplingTrend: { status: 'ok' } }
    const kv = { get: vi.fn(async (k) => (k === 'fitnessprogressie:u1' ? resultaat : null)) }
    expect(await leesFitnessprogressie(kv, 'u1')).toEqual(resultaat)
    expect(kv.get).toHaveBeenCalledWith('fitnessprogressie:u1')
  })

  it('geeft null terug bij een ontbrekend record', async () => {
    const kv = { get: vi.fn(async () => null) }
    expect(await leesFitnessprogressie(kv, 'u1')).toBeNull()
  })
})
