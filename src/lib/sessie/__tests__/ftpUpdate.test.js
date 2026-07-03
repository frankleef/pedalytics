import { describe, it, expect } from 'vitest'
import { isEindtest } from '../ftpUpdate.js'

describe('isEindtest — sectie 51-C: eindtest vs. tussentijdse FTP-test', () => {
  it('week gelijk aan tijdshorizon_weken is de eindtest', () => {
    expect(isEindtest(16, 16)).toBe(true)
  })

  it('week 3 (tussentest) is nooit de eindtest, ongeacht tijdshorizon', () => {
    expect(isEindtest(3, 16)).toBe(false)
    expect(isEindtest(3, 13)).toBe(false)
    expect(isEindtest(3, 24)).toBe(false)
  })

  it('valt terug op 13 weken als tijdshorizon_weken ontbreekt (zelfde default als vóór de wijziging)', () => {
    expect(isEindtest(13, undefined)).toBe(true)
    expect(isEindtest(3, undefined)).toBe(false)
    expect(isEindtest(13, null)).toBe(true)
  })

  it('behoudt de historische >=-grens (ongewijzigd eindtest-gedrag t.o.v. vóór deze wijziging)', () => {
    expect(isEindtest(17, 16)).toBe(true)
  })
})
