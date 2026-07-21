import { describe, it, expect, vi } from 'vitest'
import { voegCpWprimeDatapuntToe, haalCpWprimeTrendOp } from '../cpWprime.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

describe('haalCpWprimeTrendOp', () => {
  it('lege array als er nog geen reeks bestaat', async () => {
    const kv = maakKvMock()
    expect(await haalCpWprimeTrendOp(kv, 'u1')).toEqual([])
  })

  it('leest de opgeslagen reeks terug onder de juiste key', async () => {
    const reeks = [{ datum: '2026-07-01', criticalPower: 260, wPrime: 24000, pMax: 950, modelEftp: 265 }]
    const kv = maakKvMock({ 'cp_wprime_trend:u1': reeks })
    expect(await haalCpWprimeTrendOp(kv, 'u1')).toEqual(reeks)
  })
})

describe('voegCpWprimeDatapuntToe — normale toevoeging', () => {
  it('voegt een eerste punt toe aan een lege reeks en schrijft naar cp_wprime_trend:${userId}', async () => {
    const kv = maakKvMock()
    const punt = { datum: '2026-07-01', criticalPower: 263, wPrime: 25600, pMax: 973, modelEftp: 269 }

    const resultaat = await voegCpWprimeDatapuntToe(kv, 'u1', punt)

    expect(resultaat).toEqual([punt])
    expect(kv.store.get('cp_wprime_trend:u1')).toEqual([punt])
    expect(kv.set).toHaveBeenCalledTimes(1)
  })

  it('voegt een punt toe op een NIEUWE datum aan een bestaande reeks (blijft gesorteerd)', async () => {
    const kv = maakKvMock({
      'cp_wprime_trend:u1': [{ datum: '2026-07-01', criticalPower: 260, wPrime: 24000, pMax: 950, modelEftp: 265 }],
    })
    const nieuwPunt = { datum: '2026-07-02', criticalPower: 262, wPrime: 24200, pMax: 955, modelEftp: 266 }

    const resultaat = await voegCpWprimeDatapuntToe(kv, 'u1', nieuwPunt)

    expect(resultaat.map(p => p.datum)).toEqual(['2026-07-01', '2026-07-02'])
    expect(resultaat[1]).toEqual(nieuwPunt)
  })

  it('geen enkele kv.set-aanroep beïnvloedt een andere userId (key is user-scoped)', async () => {
    const kv = maakKvMock()
    await voegCpWprimeDatapuntToe(kv, 'u1', { datum: '2026-07-01', criticalPower: 260, wPrime: 24000, pMax: 950, modelEftp: 265 })
    expect(kv.store.has('cp_wprime_trend:u2')).toBe(false)
  })
})

describe('voegCpWprimeDatapuntToe — cap-gedrag bij >20 punten', () => {
  it('cap op de laatste 20 punten (oudste vallen eraf)', async () => {
    const bestaande = Array.from({ length: 20 }, (_, i) => ({
      datum: `2026-01-${String(i + 1).padStart(2, '0')}`,
      criticalPower: 250 + i,
      wPrime: 24000,
      pMax: 950,
      modelEftp: 260,
    }))
    const kv = maakKvMock({ 'cp_wprime_trend:u1': bestaande })
    const nieuwPunt = { datum: '2026-02-01', criticalPower: 999, wPrime: 24000, pMax: 950, modelEftp: 260 }

    const resultaat = await voegCpWprimeDatapuntToe(kv, 'u1', nieuwPunt)

    expect(resultaat).toHaveLength(20)
    expect(resultaat[0].datum).toBe('2026-01-02') // oudste (2026-01-01) is eraf gevallen
    expect(resultaat[resultaat.length - 1]).toEqual(nieuwPunt)
  })
})

describe('voegCpWprimeDatapuntToe — skip bij bestaand datumpunt (D4-toevoeging, i.t.t. hrv_trend se overschrijf-patroon)', () => {
  it('twee aanroepen op dezelfde dag met verschillende waarden: de TWEEDE schrijft niet, de EERSTE waarde blijft staan', async () => {
    const kv = maakKvMock()
    const eerstePunt = { datum: '2026-07-01', criticalPower: 260, wPrime: 24000, pMax: 950, modelEftp: 265 }
    const tweedePunt = { datum: '2026-07-01', criticalPower: 999, wPrime: 99999, pMax: 999, modelEftp: 999 }

    await voegCpWprimeDatapuntToe(kv, 'u1', eerstePunt)
    kv.set.mockClear()
    const resultaatNaTweede = await voegCpWprimeDatapuntToe(kv, 'u1', tweedePunt)

    expect(kv.set).not.toHaveBeenCalled() // geen KV-write bij de tweede aanroep
    expect(resultaatNaTweede).toEqual([eerstePunt]) // eerste waarde blijft ongewijzigd staan
    expect(await haalCpWprimeTrendOp(kv, 'u1')).toEqual([eerstePunt])
  })

  it('een punt op een ANDERE datum wordt wél toegevoegd, ook binnen dezelfde reeks', async () => {
    const kv = maakKvMock()
    await voegCpWprimeDatapuntToe(kv, 'u1', { datum: '2026-07-01', criticalPower: 260, wPrime: 24000, pMax: 950, modelEftp: 265 })
    await voegCpWprimeDatapuntToe(kv, 'u1', { datum: '2026-07-02', criticalPower: 261, wPrime: 24100, pMax: 951, modelEftp: 266 })

    const reeks = await haalCpWprimeTrendOp(kv, 'u1')
    expect(reeks).toHaveLength(2)
    expect(reeks.map(p => p.datum)).toEqual(['2026-07-01', '2026-07-02'])
  })
})
