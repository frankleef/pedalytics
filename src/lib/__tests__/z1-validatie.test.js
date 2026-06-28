import { describe, it, expect } from 'vitest'
import { valideerZ1Gebruik } from '../sessie-archetypes.js'

// Z1 alleen toegestaan bij: sprint_neuraal, z6_anaeroob, kracht_lage_cadans
// + gemengd met: alles_mag, raketstart, klim_simulator

const blokZonder = [
  { zone: 'Z2', duur: 1200 },
  { zone: 'Z3', duur: 600 },
]
const blokMet = [
  { zone: 'Z2', duur: 1000 },
  { zone: 'Z1', duur: 300 },
]

describe('valideerZ1Gebruik', () => {
  it('geen Z1-blokken → altijd true', () => {
    expect(valideerZ1Gebruik(blokZonder, 'z2_duur')).toBe(true)
    expect(valideerZ1Gebruik(blokZonder, 'sweetspot_intervallen')).toBe(true)
  })

  it('Z1 toegestaan bij sprint_neuraal', () => {
    expect(valideerZ1Gebruik(blokMet, 'sprint_neuraal')).toBe(true)
  })

  it('Z1 toegestaan bij z6_anaeroob', () => {
    expect(valideerZ1Gebruik(blokMet, 'z6_anaeroob')).toBe(true)
  })

  it('Z1 toegestaan bij kracht_lage_cadans', () => {
    expect(valideerZ1Gebruik(blokMet, 'kracht_lage_cadans')).toBe(true)
  })

  it('Z1 in gemengd + alles_mag → true', () => {
    expect(valideerZ1Gebruik(blokMet, 'gemengd', 'alles_mag')).toBe(true)
  })

  it('Z1 in gemengd + raketstart → true', () => {
    expect(valideerZ1Gebruik(blokMet, 'gemengd', 'raketstart')).toBe(true)
  })

  it('Z1 in gemengd + klim_simulator → true', () => {
    expect(valideerZ1Gebruik(blokMet, 'gemengd', 'klim_simulator')).toBe(true)
  })

  it('Z1 in gemengd + pieken_en_dalen → false (niet toegestaan archetype)', () => {
    expect(valideerZ1Gebruik(blokMet, 'gemengd', 'pieken_en_dalen')).toBe(false)
  })

  it('Z1 in gemengd zonder archetypeId → false', () => {
    expect(valideerZ1Gebruik(blokMet, 'gemengd', null)).toBe(false)
  })

  it('Z1 in z2_duur → false', () => {
    expect(valideerZ1Gebruik(blokMet, 'z2_duur')).toBe(false)
  })

  it('Z1 in drempel_intervallen → false', () => {
    expect(valideerZ1Gebruik(blokMet, 'drempel_intervallen')).toBe(false)
  })

  it('lege blokken-array → true (geen overtreding)', () => {
    expect(valideerZ1Gebruik([], 'z2_duur')).toBe(true)
  })

  it('null blokken → true (geen overtreding)', () => {
    expect(valideerZ1Gebruik(null, 'z2_duur')).toBe(true)
  })
})
