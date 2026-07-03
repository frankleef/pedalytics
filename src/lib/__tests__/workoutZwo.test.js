import { describe, it, expect } from 'vitest'
import { rampTestNaarZwo, sessieNaarZwo, segmentenNaarZwo } from '../workoutZwo.js'
import { genereerRampTestSessie } from '../sessie/rampTest.js'

function stapWatt(zwo, i) {
  // i-de <SteadyState .../> in de gegenereerde workout
  const matches = [...zwo.matchAll(/<SteadyState Duration="60" Power="([\d.]+)"/g)]
  return matches[i]
}

describe('rampTestNaarZwo — sectie 51-B-I: absolute watt → FTP-fractie', () => {
  it('dezelfde 100W-stap geeft een andere fractie bij FTP 200W vs FTP 300W', () => {
    const protocol = genereerRampTestSessie().protocol

    const zwo200 = rampTestNaarZwo(protocol, 'Ramp Test', 200)
    const zwo300 = rampTestNaarZwo(protocol, 'Ramp Test', 300)

    const eersteStap200 = stapWatt(zwo200, 0)
    const eersteStap300 = stapWatt(zwo300, 0)

    // Eerste stap = start_watt (100W)
    expect(+eersteStap200[1]).toBeCloseTo(100 / 200, 3) // 0.5
    expect(+eersteStap300[1]).toBeCloseTo(100 / 300, 3) // 0.333
    expect(eersteStap200[1]).not.toBe(eersteStap300[1])
  })

  it('rekent opeenvolgende stappen (100W, 120W, 140W...) correct om naar de gegeven FTP', () => {
    const protocol = genereerRampTestSessie().protocol
    const ftp = 265
    const zwo = rampTestNaarZwo(protocol, 'Ramp Test', ftp)

    const tweedeStap = stapWatt(zwo, 1) // 120W
    const derdeStap = stapWatt(zwo, 2)  // 140W
    expect(+tweedeStap[1]).toBeCloseTo(120 / ftp, 3)
    expect(+derdeStap[1]).toBeCloseTo(140 / ftp, 3)
  })

  it('genereert stappen ruim boven een realistisch maximum (workout raakt nooit "voltooid")', () => {
    const protocol = genereerRampTestSessie().protocol
    const zwo = rampTestNaarZwo(protocol, 'Ramp Test', 265)
    const stappen = [...zwo.matchAll(/<SteadyState/g)]
    // start 100W, +20W/min, tot ruim boven 500W → op zijn minst ~20 stappen
    expect(stappen.length).toBeGreaterThanOrEqual(20)
  })

  it('bevat Warmup/Cooldown-elementen op basis van het protocol', () => {
    const protocol = genereerRampTestSessie().protocol
    const zwo = rampTestNaarZwo(protocol, 'Ramp Test', 265)
    expect(zwo).toMatch(/<Warmup Duration="300"/)
    expect(zwo).toMatch(/<Cooldown Duration="300"/)
  })

  it('retourneert null zonder protocol', () => {
    expect(rampTestNaarZwo(null, 'x', 265)).toBeNull()
  })
})

describe('sessieNaarZwo — aparte tak voor ramp_test naast het bestaande segmenten-pad', () => {
  it('routeert een sessie met protocol naar rampTestNaarZwo', () => {
    const sessie = { ...genereerRampTestSessie(), titel: 'Ramp Test' }
    const zwo = sessieNaarZwo(sessie, 250)
    expect(zwo).toContain('<Warmup')
    expect(zwo).not.toBeNull()
  })

  it('bestaand segmenten-pad blijft ongewijzigd voor niet-ramp_test-sessies', () => {
    const segmenten = [
      { type: 'main', vermogenMin: 60, vermogenMax: 70, eenheid: 'pct_ftp', blokDuurSeconden: 600 },
    ]
    const sessie = { segmenten, titel: 'Z2 Duur' }
    expect(sessieNaarZwo(sessie, 265)).toBe(segmentenNaarZwo(segmenten, 'Z2 Duur', 265))
  })

  it('geeft null zonder protocol én zonder segmenten', () => {
    expect(sessieNaarZwo({ titel: 'Leeg' }, 265)).toBeNull()
  })
})
