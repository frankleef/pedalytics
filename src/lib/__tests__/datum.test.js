import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { laatsteNDagen, datumOffset, vandaagISO } from '../datum.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T10:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('laatsteNDagen', () => {
  it('retourneert exact n datums', () => {
    expect(laatsteNDagen(10)).toHaveLength(10)
    expect(laatsteNDagen(1)).toHaveLength(1)
    expect(laatsteNDagen(3)).toHaveLength(3)
  })

  it('is oplopend (chronologisch) gesorteerd', () => {
    const reeks = laatsteNDagen(10)
    const gesorteerd = [...reeks].sort()
    expect(reeks).toEqual(gesorteerd)
  })

  it('begint bij vandaag - (n-1) en eindigt bij vandaag', () => {
    const reeks = laatsteNDagen(10)
    expect(reeks[0]).toBe(datumOffset(-9))
    expect(reeks[reeks.length - 1]).toBe(vandaagISO())
  })

  it('exacte reeks voor n=3, dagniveau-precisie (systeemtijd gepind op 2026-07-15)', () => {
    expect(laatsteNDagen(3)).toEqual(['2026-07-13', '2026-07-14', '2026-07-15'])
  })

  it('n=1 geeft uitsluitend vandaag terug', () => {
    expect(laatsteNDagen(1)).toEqual(['2026-07-15'])
  })

  it('bevat geen duplicaten', () => {
    const reeks = laatsteNDagen(10)
    expect(new Set(reeks).size).toBe(10)
  })
})
