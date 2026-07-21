import { describe, it, expect } from 'vitest'
import { berekenWbalKalibratie, pasWbalKalibratieToe, WBAL_KALIBRATIE_SESSIETYPES } from '../wbalSimulatie.js'

describe('berekenWbalKalibratie — Skiba-differentiaalmodel', () => {
  it('komt overeen met een handmatige closed-form berekening voor een bekend CP/W-scenario', () => {
    // CP=230, W'=20000J, werk 110% van FTP 260 (=286W), rust Z2 63% (=163.8W),
    // depletiePct=60 (drempel 8000J), herstelPct=75 (drempel 15000J).
    // Interval (lineaire depletie): (20000-8000)/(286-230) = 214.29 -> 215s (per-seconde-afronding naar boven)
    // Rust (closed-form exponentieel): tau=20000/(230-163.8)=302.11, t=-tau*ln(5000/12000)=264.4 -> 265s
    const r = berekenWbalKalibratie({
      cp: 230, wPrime: 20000, werkVermogen: 286, rustVermogen: 163.8,
      depletiePct: 60, herstelPct: 75,
    })
    expect(r).toEqual({ intervalDuurSec: 215, rustDuurSec: 265 })
  })

  it('fail-open: werkVermogen op of onder CP levert geen resultaat op (geen depletie mogelijk)', () => {
    expect(berekenWbalKalibratie({ cp: 230, wPrime: 20000, werkVermogen: 230, rustVermogen: 100, depletiePct: 60, herstelPct: 75 })).toBeNull()
    expect(berekenWbalKalibratie({ cp: 230, wPrime: 20000, werkVermogen: 200, rustVermogen: 100, depletiePct: 60, herstelPct: 75 })).toBeNull()
  })

  it('fail-open: rustVermogen op of boven CP levert geen resultaat op (geen reconstitutie mogelijk)', () => {
    expect(berekenWbalKalibratie({ cp: 230, wPrime: 20000, werkVermogen: 280, rustVermogen: 230, depletiePct: 60, herstelPct: 75 })).toBeNull()
    expect(berekenWbalKalibratie({ cp: 230, wPrime: 20000, werkVermogen: 280, rustVermogen: 250, depletiePct: 60, herstelPct: 75 })).toBeNull()
  })

  it('fail-open: ontbrekende cp/wPrime levert geen resultaat op', () => {
    expect(berekenWbalKalibratie({ cp: null, wPrime: 20000, werkVermogen: 280, rustVermogen: 150, depletiePct: 60, herstelPct: 75 })).toBeNull()
    expect(berekenWbalKalibratie({ cp: 230, wPrime: null, werkVermogen: 280, rustVermogen: 150, depletiePct: 60, herstelPct: 75 })).toBeNull()
  })

  it('een hogere depletiePct levert een langere intervalduur op (dieper putten voor het stopt)', () => {
    const basis = { cp: 230, wPrime: 20000, werkVermogen: 286, rustVermogen: 163.8, herstelPct: 75 }
    const kort = berekenWbalKalibratie({ ...basis, depletiePct: 40 })
    const lang = berekenWbalKalibratie({ ...basis, depletiePct: 80 })
    expect(lang.intervalDuurSec).toBeGreaterThan(kort.intervalDuurSec)
  })
})

describe('pasWbalKalibratieToe — toepassing op een geschaalde blokkenlijst', () => {
  const CP_WPRIME = { criticalPower: 230, wPrime: 20000 }
  const DREMPELS = { depletiePct: 60, herstelPct: 75 }
  const FTP = 260

  function maakBlokken() {
    return [
      { type: 'werk', zone: 'Z2', pct_ftp: 60, blokDuurSeconden: 300 }, // warm-up, geen reps-paar
      { type: 'werk', zone: 'Z5', pct_ftp: 110, blokDuurSeconden: 40, reps: 5 },
      { type: 'herstel', zone: 'Z2', pct_ftp: 63, blokDuurSeconden: 40, reps: 5 },
      { type: 'herstel', zone: 'Z2', pct_ftp: 63, blokDuurSeconden: 600 }, // losse afsluitende rust, geen reps-paar
    ]
  }

  it('overschrijft alleen het werk/herstel-reps-paar, bewaart de standaardduur, laat overige blokken ongewijzigd', () => {
    const resultaat = pasWbalKalibratieToe(maakBlokken(), 'vo2max_intervallen', FTP, CP_WPRIME, DREMPELS)

    expect(resultaat[0]).toEqual(maakBlokken()[0]) // warm-up ongewijzigd
    expect(resultaat[1].blokDuurSeconden).toBe(215)
    expect(resultaat[1].standaardBlokDuurSeconden).toBe(40)
    expect(resultaat[2].blokDuurSeconden).toBe(265)
    expect(resultaat[2].standaardBlokDuurSeconden).toBe(40)
    expect(resultaat[3]).toEqual(maakBlokken()[3]) // losse afsluitende rust ongewijzigd
  })

  it('regressie: niet-VO2max/anaerobe sessietypes blijven volledig ongewijzigd', () => {
    const blokken = maakBlokken()
    const resultaat = pasWbalKalibratieToe(blokken, 'sweetspot_intervallen', FTP, CP_WPRIME, DREMPELS)
    expect(resultaat).toBe(blokken) // zelfde referentie, geen kopie/mutatie
  })

  it('fail-open: ontbrekende cpWprime laat de blokken ongewijzigd', () => {
    const blokken = maakBlokken()
    const resultaat = pasWbalKalibratieToe(blokken, 'vo2max_intervallen', FTP, null, DREMPELS)
    expect(resultaat).toBe(blokken)
  })

  it('z6_anaeroob zit in de kalibratie-scope, sprint_neuraal niet', () => {
    expect(WBAL_KALIBRATIE_SESSIETYPES.has('vo2max_intervallen')).toBe(true)
    expect(WBAL_KALIBRATIE_SESSIETYPES.has('z6_anaeroob')).toBe(true)
    expect(WBAL_KALIBRATIE_SESSIETYPES.has('sprint_neuraal')).toBe(false)
  })
})
