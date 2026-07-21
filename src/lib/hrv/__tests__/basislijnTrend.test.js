import { describe, it, expect } from 'vitest'
import { bepaalHrvTrendTrigger, bepaalRhrTrendTrigger } from '../basislijnTrend.js'

describe('bepaalHrvTrendTrigger', () => {
  it('trigger bij een dalende helling die >5% geëxtrapoleerd (21 dagen) uitkomt', () => {
    // Perfect lineair -1/dag, wekelijkse punten (dag 0/7/14/21): laatsteWaarde=85,
    // hellingPerDag*21=-15 -> pct=-15/85*100=-17,6% -> ruim over de -5%-drempel.
    const punten = [
      { datum: '2026-04-01', basislijn: 100 },
      { datum: '2026-04-08', basislijn: 95 },
      { datum: '2026-04-15', basislijn: 90 },
      { datum: '2026-04-22', basislijn: 85 },
    ]
    expect(bepaalHrvTrendTrigger(punten)).toBe(true)
  })

  it('geen trigger bij precies -5% geëxtrapoleerd (grenswaarde, strikte ongelijkheid)', () => {
    // Lineair -1/dag: laatsteWaarde=420, hellingPerDag*21=-21 -> pct=-21/420*100=-5,0 exact.
    const punten = [
      { datum: '2026-04-01', basislijn: 441 },
      { datum: '2026-04-08', basislijn: 434 },
      { datum: '2026-04-15', basislijn: 427 },
      { datum: '2026-04-22', basislijn: 420 },
    ]
    expect(bepaalHrvTrendTrigger(punten)).toBe(false)
  })

  it('fail-open: minder dan 4 punten -> false, geen crash', () => {
    const punten = [
      { datum: '2026-04-01', basislijn: 100 },
      { datum: '2026-04-08', basislijn: 90 },
      { datum: '2026-04-15', basislijn: 80 },
    ]
    expect(() => bepaalHrvTrendTrigger(punten)).not.toThrow()
    expect(bepaalHrvTrendTrigger(punten)).toBe(false)
    expect(bepaalHrvTrendTrigger([])).toBe(false)
    expect(bepaalHrvTrendTrigger(null)).toBe(false)
  })

  it('blijft correct (datum-gebaseerd, niet index-gebaseerd) ondanks een ontbrekende weekmeting in de reeks', () => {
    // Perfect lineair -2/dag, maar met een gat van 23 dagen tussen het 2e en
    // 3e punt (7 -> 30) i.p.v. de gebruikelijke 7 dagen — een index-gebaseerde
    // regressie zou dit gat negeren en een andere helling teruggeven.
    // laatsteWaarde=400, hellingPerDag*21=-42 -> pct=-42/400*100=-10,5%.
    const punten = [
      { datum: '2026-04-01', basislijn: 474 },
      { datum: '2026-04-08', basislijn: 460 },
      { datum: '2026-05-01', basislijn: 414 },
      { datum: '2026-05-08', basislijn: 400 },
    ]
    expect(bepaalHrvTrendTrigger(punten)).toBe(true)
  })
})

describe('bepaalRhrTrendTrigger', () => {
  it('trigger bij een stijgende helling die >5% geëxtrapoleerd uitkomt', () => {
    // Lineair +1/dag: laatsteWaarde=100, hellingPerDag*21=15 -> pct=15/100*100=15%.
    const punten = [
      { datum: '2026-04-01', basislijn: 85 },
      { datum: '2026-04-08', basislijn: 90 },
      { datum: '2026-04-15', basislijn: 95 },
      { datum: '2026-04-22', basislijn: 100 },
    ]
    expect(bepaalRhrTrendTrigger(punten)).toBe(true)
  })

  it('geen trigger bij precies +5% geëxtrapoleerd (grenswaarde, strikte ongelijkheid)', () => {
    // Lineair +1/dag: laatsteWaarde=420, hellingPerDag*21=21 -> pct=21/420*100=5,0 exact.
    const punten = [
      { datum: '2026-04-01', basislijn: 399 },
      { datum: '2026-04-08', basislijn: 406 },
      { datum: '2026-04-15', basislijn: 413 },
      { datum: '2026-04-22', basislijn: 420 },
    ]
    expect(bepaalRhrTrendTrigger(punten)).toBe(false)
  })

  it('fail-open: minder dan 4 punten -> false, geen crash', () => {
    const punten = [
      { datum: '2026-04-01', basislijn: 50 },
      { datum: '2026-04-08', basislijn: 55 },
    ]
    expect(() => bepaalRhrTrendTrigger(punten)).not.toThrow()
    expect(bepaalRhrTrendTrigger(punten)).toBe(false)
  })

  it('een dalende RHR (verbetering) triggert nooit, ongeacht de omvang', () => {
    const punten = [
      { datum: '2026-04-01', basislijn: 100 },
      { datum: '2026-04-08', basislijn: 90 },
      { datum: '2026-04-15', basislijn: 80 },
      { datum: '2026-04-22', basislijn: 70 },
    ]
    expect(bepaalRhrTrendTrigger(punten)).toBe(false)
  })
})
