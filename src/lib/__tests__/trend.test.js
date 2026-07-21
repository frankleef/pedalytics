import { describe, it, expect } from 'vitest'
import { berekenLineaireTrendPerWeek } from '../trend.js'

describe('berekenLineaireTrendPerWeek', () => {
  it('correcte helling op een handmatig doorgerekend voorbeeld', () => {
    // Perfect lineair: +1 per dag, 4 punten op opeenvolgende dagen.
    const punten = [
      { datum: '2026-05-01', waarde: 10 },
      { datum: '2026-05-02', waarde: 11 },
      { datum: '2026-05-03', waarde: 12 },
      { datum: '2026-05-04', waarde: 13 },
    ]
    const resultaat = berekenLineaireTrendPerWeek(punten)
    expect(resultaat.hellingPerDag).toBeCloseTo(1, 10)
    expect(resultaat.hellingPerWeek).toBeCloseTo(7, 10)
    expect(resultaat.laatsteWaarde).toBe(13)
  })

  it('robuust tegen een ontbrekende week (datum-gebaseerd, niet index-gebaseerd)', () => {
    // Zelfde onderliggende lineaire trend (+1/dag) als hierboven, maar met een
    // gat van 14 dagen tussen het 2e en 3e punt (index-gebaseerde regressie
    // zou dit gat NEGEREN en een andere — te steile — helling teruggeven).
    const punten = [
      { datum: '2026-05-01', waarde: 10 },
      { datum: '2026-05-02', waarde: 11 },
      { datum: '2026-05-16', waarde: 25 }, // 14 dagen later, +14 t.o.v. vorige punt: consistent met +1/dag
      { datum: '2026-05-17', waarde: 26 },
    ]
    const resultaat = berekenLineaireTrendPerWeek(punten)
    expect(resultaat.hellingPerDag).toBeCloseTo(1, 6)
    expect(resultaat.hellingPerWeek).toBeCloseTo(7, 6)
  })

  it('null bij minder dan 4 punten', () => {
    const punten = [
      { datum: '2026-05-01', waarde: 10 },
      { datum: '2026-05-02', waarde: 11 },
      { datum: '2026-05-03', waarde: 12 },
    ]
    expect(berekenLineaireTrendPerWeek(punten)).toBeNull()
  })

  it('null bij lege of ontbrekende input', () => {
    expect(berekenLineaireTrendPerWeek([])).toBeNull()
    expect(berekenLineaireTrendPerWeek(null)).toBeNull()
  })

  it('null als alle punten op dezelfde dag liggen (geen tijdsspreiding)', () => {
    const punten = [
      { datum: '2026-05-01', waarde: 10 },
      { datum: '2026-05-01', waarde: 11 },
      { datum: '2026-05-01', waarde: 12 },
      { datum: '2026-05-01', waarde: 13 },
    ]
    expect(berekenLineaireTrendPerWeek(punten)).toBeNull()
  })
})
