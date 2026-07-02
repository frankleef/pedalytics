import { describe, it, expect } from 'vitest'
import { parseZwo } from '../parseZwo.js'

function zwo(workoutBody, naam = 'Test workout') {
  return `<workout_file><author>test</author><name>${naam}</name><workout>${workoutBody}</workout></workout_file>`
}

describe('parseZwo', () => {
  it('leeg/ontbrekend bestand geeft nette fout, geen crash', () => {
    expect(parseZwo('')).toEqual({ naam: null, blokken: [], waarschuwingen: ['Leeg of ontbrekend ZWO-bestand'] })
    expect(parseZwo(null)).toEqual({ naam: null, blokken: [], waarschuwingen: ['Leeg of ontbrekend ZWO-bestand'] })
    expect(parseZwo(undefined)).toEqual({ naam: null, blokken: [], waarschuwingen: ['Leeg of ontbrekend ZWO-bestand'] })
  })

  it('malformed XML zonder <workout>-element geeft nette fout', () => {
    const result = parseZwo('<workout_file><name>Kapot</name></workout_file>')
    expect(result.blokken).toEqual([])
    expect(result.waarschuwingen.length).toBeGreaterThan(0)
    expect(result.naam).toBe('Kapot')
  })

  it('SteadyState-only: werk-blok boven de herstel-drempel', () => {
    const xml = zwo('<SteadyState Duration="600" Power="0.65"/>')
    const result = parseZwo(xml)
    expect(result.naam).toBe('Test workout')
    expect(result.waarschuwingen).toEqual([])
    expect(result.blokken).toHaveLength(1)
    expect(result.blokken[0]).toMatchObject({ type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 1 })
  })

  it('SteadyState onder de herstel-drempel classificeert als herstel', () => {
    const xml = zwo('<SteadyState Duration="300" Power="0.5"/>')
    const result = parseZwo(xml)
    expect(result.blokken[0].type).toBe('herstel')
  })

  it('SteadyState op FTP (Power=1.0) valt in Z4', () => {
    const xml = zwo('<SteadyState Duration="1200" Power="1.0"/>')
    const result = parseZwo(xml)
    expect(result.blokken[0]).toMatchObject({ type: 'werk', zone: 'Z4', pct_ftp: 100 })
  })

  it('IntervalsT: twee blokken (werk + herstel), beide met reps', () => {
    const xml = zwo('<IntervalsT Repeat="6" OnDuration="240" OnPower="1.00" OffDuration="60" OffPower="0.5"/>')
    const result = parseZwo(xml)
    expect(result.waarschuwingen).toEqual([])
    expect(result.blokken).toHaveLength(2)
    expect(result.blokken[0]).toMatchObject({ type: 'werk', zone: 'Z4', pct_ftp: 100, reps: 6, duurSec: 240 })
    expect(result.blokken[1]).toMatchObject({ type: 'herstel', zone: 'Z1', pct_ftp: 50, reps: 6, duurSec: 60 })
  })

  it('FreeRide wordt overgeslagen met waarschuwing, rest blijft correct', () => {
    const xml = zwo('<SteadyState Duration="600" Power="0.65"/><FreeRide Duration="300"/><SteadyState Duration="300" Power="0.9"/>')
    const result = parseZwo(xml)
    expect(result.blokken).toHaveLength(2)
    expect(result.waarschuwingen.some(w => w.includes('FreeRide'))).toBe(true)
  })

  it('Ramp wordt overgeslagen met waarschuwing (geen vast vermogen)', () => {
    const xml = zwo('<Ramp Duration="300" PowerLow="0.5" PowerHigh="0.75"/><SteadyState Duration="600" Power="0.65"/>')
    const result = parseZwo(xml)
    expect(result.blokken).toHaveLength(1)
    expect(result.waarschuwingen.some(w => w.includes('Ramp'))).toBe(true)
  })

  it('Warmup/Cooldown benaderd als vlak blok op gemiddeld vermogen, met waarschuwing', () => {
    const xml = zwo('<Warmup Duration="600" PowerLow="0.4" PowerHigh="0.7"/><SteadyState Duration="600" Power="0.65"/>')
    const result = parseZwo(xml)
    expect(result.blokken).toHaveLength(2)
    expect(result.blokken[0]).toMatchObject({ pct_ftp: 55, duurSec: 600 })
    expect(result.waarschuwingen.some(w => w.includes('Warmup'))).toBe(true)
  })

  it('onbekend element overgeslagen met waarschuwing, geen crash', () => {
    const xml = zwo('<SteadyState Duration="600" Power="0.65"/><TextEvent timeoffset="0" message="Ga!"/>')
    const result = parseZwo(xml)
    expect(result.blokken).toHaveLength(1)
    expect(result.waarschuwingen.some(w => w.includes('TextEvent'))).toBe(true)
  })

  it('duur_pct-som over alle blokken (incl. reps) is ongeveer 1.0', () => {
    const xml = zwo('<SteadyState Duration="600" Power="0.55"/><IntervalsT Repeat="4" OnDuration="240" OnPower="1.05" OffDuration="120" OffPower="0.55"/><SteadyState Duration="300" Power="0.5"/>')
    const result = parseZwo(xml)
    const totaalPct = result.blokken.reduce((s, b) => s + b.duur_pct * (b.reps ?? 1), 0)
    expect(totaalPct).toBeCloseTo(1.0, 5)
  })

  it('geen bruikbare blokken → lege blokken-array met waarschuwing', () => {
    const xml = zwo('<FreeRide Duration="300"/>')
    const result = parseZwo(xml)
    expect(result.blokken).toEqual([])
    expect(result.waarschuwingen.some(w => w.includes('Geen bruikbare blokken'))).toBe(true)
  })

  it('ontbrekend <name>-element geeft naam: null zonder crash', () => {
    const xml = '<workout_file><workout><SteadyState Duration="600" Power="0.65"/></workout></workout_file>'
    const result = parseZwo(xml)
    expect(result.naam).toBeNull()
    expect(result.blokken).toHaveLength(1)
  })
})
