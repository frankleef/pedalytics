import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { zetWeekVoorzichtig, leesWeekVoorzichtig } from '../weekVoorzichtig.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v, opts) => { store.set(k, v); store.set(`${k}:__opts`, opts) }),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T10:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('zetWeekVoorzichtig', () => {
  it('schrijft { actief: true, laatsteTriggerDatum } naar week_voorzichtig:${userId} met een 8-dagen-TTL', async () => {
    const kv = maakKvMock()
    await zetWeekVoorzichtig(kv, 'u1', '2026-07-15')

    expect(kv.store.get('week_voorzichtig:u1')).toEqual({ actief: true, laatsteTriggerDatum: '2026-07-15' })
    expect(kv.store.get('week_voorzichtig:u1:__opts')).toEqual({ ex: 8 * 86400 })
  })

  it('overschrijft een bestaand record onvoorwaardelijk (geen telling/drempel, i.t.t. compliance_freeze)', async () => {
    const kv = maakKvMock({ 'week_voorzichtig:u1': { actief: true, laatsteTriggerDatum: '2026-07-01' } })
    await zetWeekVoorzichtig(kv, 'u1', '2026-07-15')

    expect(kv.store.get('week_voorzichtig:u1')).toEqual({ actief: true, laatsteTriggerDatum: '2026-07-15' })
  })

  it('is user-scoped: raakt geen andere userId', async () => {
    const kv = maakKvMock()
    await zetWeekVoorzichtig(kv, 'u1', '2026-07-15')
    expect(kv.store.has('week_voorzichtig:u2')).toBe(false)
  })
})

describe('leesWeekVoorzichtig', () => {
  it('retourneert false als er nog geen record bestaat', async () => {
    const kv = maakKvMock()
    expect(await leesWeekVoorzichtig(kv, 'u1')).toBe(false)
  })

  it('retourneert false bij { actief: false }', async () => {
    const kv = maakKvMock({ 'week_voorzichtig:u1': { actief: false, laatsteTriggerDatum: '2026-07-14' } })
    expect(await leesWeekVoorzichtig(kv, 'u1')).toBe(false)
  })

  it('retourneert true bij een actief record binnen de 7-dagen-grens (vandaag = 2026-07-15, trigger = 2026-07-14, 1 dag oud)', async () => {
    const kv = maakKvMock({ 'week_voorzichtig:u1': { actief: true, laatsteTriggerDatum: '2026-07-14' } })
    expect(await leesWeekVoorzichtig(kv, 'u1')).toBe(true)
  })

  it('retourneert false na 7 dagen (exact op de grens, laatsteTriggerDatum = datumOffset(-7)) — dezelfde strikte <=-grensconventie als compliance_freeze (compliance.js:355)', async () => {
    const kv = maakKvMock({ 'week_voorzichtig:u1': { actief: true, laatsteTriggerDatum: '2026-07-08' } })
    expect(await leesWeekVoorzichtig(kv, 'u1')).toBe(false)
  })

  it('retourneert false ruim na 7 dagen', async () => {
    const kv = maakKvMock({ 'week_voorzichtig:u1': { actief: true, laatsteTriggerDatum: '2026-06-01' } })
    expect(await leesWeekVoorzichtig(kv, 'u1')).toBe(false)
  })

  it('7-dagen-afkap herschrijft de KV-waarde NIET — alleen de leesuitkomst verandert, het record zelf blijft { actief: true, ... } staan (i.t.t. compliance_freeze se evalueerComplianceFreeze, die wél altijd terugschrijft)', async () => {
    const kv = maakKvMock({ 'week_voorzichtig:u1': { actief: true, laatsteTriggerDatum: '2026-06-01' } })

    const resultaat = await leesWeekVoorzichtig(kv, 'u1')

    expect(resultaat).toBe(false)
    expect(kv.set).not.toHaveBeenCalled()
    expect(kv.store.get('week_voorzichtig:u1')).toEqual({ actief: true, laatsteTriggerDatum: '2026-06-01' }) // ongewijzigd
  })

  it('is user-scoped: leest geen ander record', async () => {
    const kv = maakKvMock({ 'week_voorzichtig:u2': { actief: true, laatsteTriggerDatum: '2026-07-15' } })
    expect(await leesWeekVoorzichtig(kv, 'u1')).toBe(false)
  })
})
