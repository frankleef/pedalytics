import { describe, it, expect } from 'vitest'
import { bepaalVrijheidsdag } from '../vrijheidsdag.js'

// Vrijheidsdag = week 3 van een intensieve fase (sweetspot/drempel/vo2max),
// specifiek op de tweede_intensiteit-dag van de week.

describe('bepaalVrijheidsdag', () => {
  it('week 3, tweede_intensiteit, sweetspot → true', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 3, dagRol: 'tweede_intensiteit', fase: 'sweetspot' })).toBe(true)
  })

  it('week 3, tweede_intensiteit, drempel → true', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 3, dagRol: 'tweede_intensiteit', fase: 'drempel' })).toBe(true)
  })

  it('week 3, tweede_intensiteit, vo2max → true', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 3, dagRol: 'tweede_intensiteit', fase: 'vo2max' })).toBe(true)
  })

  it('week 3, tweede_intensiteit, basis → false (fase niet intensief genoeg)', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 3, dagRol: 'tweede_intensiteit', fase: 'basis' })).toBe(false)
  })

  it('week 2, tweede_intensiteit, sweetspot → false (niet week 3)', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 2, dagRol: 'tweede_intensiteit', fase: 'sweetspot' })).toBe(false)
  })

  it('week 1, tweede_intensiteit, sweetspot → false', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 1, dagRol: 'tweede_intensiteit', fase: 'sweetspot' })).toBe(false)
  })

  it('week 3, eerste_intensiteit, sweetspot → false (verkeerde dagRol)', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 3, dagRol: 'eerste_intensiteit', fase: 'sweetspot' })).toBe(false)
  })

  it('week 3, herstel, sweetspot → false (dagRol klopt niet)', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 3, dagRol: 'herstel', fase: 'sweetspot' })).toBe(false)
  })

  it('lege aanroep → false (geen crash)', () => {
    expect(bepaalVrijheidsdag({})).toBe(false)
  })

  it('geen argument → false (geen crash)', () => {
    expect(bepaalVrijheidsdag()).toBe(false)
  })

  it('week 3, tweede_intensiteit, consolidatie → false (niet in VRIJHEID_FASEN)', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 3, dagRol: 'tweede_intensiteit', fase: 'consolidatie' })).toBe(false)
  })

  it('week 3, tweede_intensiteit, taper → false', () => {
    expect(bepaalVrijheidsdag({ weekInFase: 3, dagRol: 'tweede_intensiteit', fase: 'taper' })).toBe(false)
  })
})
