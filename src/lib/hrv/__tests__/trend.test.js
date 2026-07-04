import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../kv', () => ({ getKV: vi.fn() }))

import { getKV } from '../../kv'
import { berekenHrvBaseline, berekenHrvTrend, verwerkHrvTrend } from '../trend'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    del: vi.fn(async (k) => { store.delete(k) }),
  }
}

describe('berekenHrvBaseline', () => {
  it('geeft null bij minder dan 7 metingen buiten de laatste 3 dagen', () => {
    // 9 metingen totaal, laatste 3 eraf -> 6 over, <7
    const metingen = Array(9).fill(60)
    expect(berekenHrvBaseline(metingen)).toBeNull()
  })

  it('berekent het gemiddelde van alles behalve de laatste 3 dagen', () => {
    const metingen = [60, 60, 60, 60, 60, 60, 60, 100, 100, 100] // 7×60 + 3×100 (laatste 3 uitgesloten)
    expect(berekenHrvBaseline(metingen)).toBe(60)
  })

  it('geeft null bij lege of undefined input', () => {
    expect(berekenHrvBaseline([])).toBeNull()
    expect(berekenHrvBaseline(undefined)).toBeNull()
  })
})

describe('berekenHrvTrend', () => {
  it('geeft null zonder baseline', () => {
    expect(berekenHrvTrend([60, 60, 60, 60, 60], null)).toBeNull()
  })

  it('geeft null bij minder dan 5 metingen in de laatste 7 dagen', () => {
    expect(berekenHrvTrend([60, 60, 60, 60], 60)).toBeNull()
  })

  it('berekent de percentage-afwijking correct', () => {
    // gemiddelde 51 t.o.v. baseline 60 -> -15%
    expect(berekenHrvTrend([51, 51, 51, 51, 51], 60)).toBeCloseTo(-15, 5)
  })

  it('detecteert een positieve afwijking', () => {
    expect(berekenHrvTrend([66, 66, 66, 66, 66], 60)).toBeCloseTo(10, 5)
  })
})

describe('verwerkHrvTrend', () => {
  beforeEach(() => vi.clearAllMocks())

  it('geeft null en doet niets bij trend === null', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const resultaat = await verwerkHrvTrend('u1', null)
    expect(resultaat).toBeNull()
    expect(kv.set).not.toHaveBeenCalled()
  })

  it('zet de hrv_overbelasting-vlag en verlaagt toekomstige TSS-ranges met ×0.88 bij trend < -15', async () => {
    const plan = {
      weekSessies: {
        sessies: [
          { datum: '2099-01-01', voltooid: false, intentie: { tss_range: { min: 100, max: 120 } } },
          { datum: '2000-01-01', voltooid: false, intentie: { tss_range: { min: 100, max: 120 } } }, // verleden, niet aanpassen
        ],
      },
    }
    const kv = maakKvMock({ 'u1:seizoensplan': plan })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await verwerkHrvTrend('u1', -20)

    expect(resultaat).toBe('hrv_overbelasting')
    expect(kv.set).toHaveBeenCalledWith('hrv_overbelasting:u1', true, { ex: 7 * 86400 })
    const opgeslagenPlan = kv.store.get('u1:seizoensplan')
    const toekomstige = opgeslagenPlan.weekSessies.sessies.find(s => s.datum === '2099-01-01')
    const verleden = opgeslagenPlan.weekSessies.sessies.find(s => s.datum === '2000-01-01')
    expect(toekomstige.intentie.tss_range).toEqual({ min: 88, max: 106 })
    expect(verleden.intentie.tss_range).toEqual({ min: 100, max: 120 }) // ongewijzigd
  })

  it('verlaagt de TSS-range niet nogmaals als rpe_overbelasting al actief is (geen dubbele verlaging)', async () => {
    const plan = {
      weekSessies: {
        sessies: [{ datum: '2099-01-01', voltooid: false, intentie: { tss_range: { min: 100, max: 120 } } }],
      },
    }
    const kv = maakKvMock({ 'u1:seizoensplan': plan, 'rpe_overbelasting:u1': true })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await verwerkHrvTrend('u1', -20)

    expect(resultaat).toBe('hrv_overbelasting_gecombineerd')
    expect(kv.set).toHaveBeenCalledWith('hrv_overbelasting:u1', true, { ex: 7 * 86400 })
    const opgeslagenPlan = kv.store.get('u1:seizoensplan')
    expect(opgeslagenPlan.weekSessies.sessies[0].intentie.tss_range).toEqual({ min: 100, max: 120 })
  })

  it('verwijdert de vlag en geeft "normaal" bij trend >= -15', async () => {
    const kv = maakKvMock({ 'hrv_overbelasting:u1': true })
    vi.mocked(getKV).mockReturnValue(kv)

    const resultaat = await verwerkHrvTrend('u1', -5)

    expect(resultaat).toBe('normaal')
    expect(kv.del).toHaveBeenCalledWith('hrv_overbelasting:u1')
  })
})
