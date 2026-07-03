import { describe, it, expect } from 'vitest'
import { genereerRampTestSessie } from '../rampTest.js'

describe('genereerRampTestSessie', () => {
  it('retourneert de vaste protocolstructuur uit sectie 51-B', () => {
    const sessie = genereerRampTestSessie()

    expect(sessie.sessietype).toBe('ramp_test')
    expect(sessie.archetype_id).toBeNull()
    expect(sessie.gegenereerd_door).toBe('vast_protocol')
    expect(sessie.tss_doel).toBeNull()
    expect(sessie.verwacht_rpe).toBe(9)
    expect(sessie.duur_min_geschat).toBe(25)

    expect(sessie.protocol.warmup).toEqual({ duur_min: 5, omschrijving: expect.any(String) })
    expect(sessie.protocol.cooldown).toEqual({ duur_min: 5, omschrijving: expect.any(String) })
    expect(sessie.protocol.ramp).toEqual({
      start_watt: 100,
      increment_watt_per_min: 20,
      omschrijving: expect.any(String),
    })
  })

  it('heeft geen blokken-array — dit sessietype gebruikt het protocol-pad, niet duur_pct-schaling', () => {
    const sessie = genereerRampTestSessie()
    expect(sessie.blokken).toBeUndefined()
    expect(sessie.duur_pct).toBeUndefined()
  })

  it('is puur — twee aanroepen geven equivalente, onafhankelijke objecten', () => {
    const a = genereerRampTestSessie()
    const b = genereerRampTestSessie()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.protocol).not.toBe(b.protocol)
  })
})
