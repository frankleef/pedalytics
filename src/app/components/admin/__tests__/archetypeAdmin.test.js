import { describe, it, expect } from 'vitest'
import {
  leegBlok, groepeerBlokkenTotSets, blokkenNaarOpslagformaat, opslagformaatNaarBlokken,
  zwoBlokkenNaarBuilderBlokken, berekenPctTotaal, formatDuur,
} from '../archetypeAdmin.js'

describe('blokkenNaarOpslagformaat / opslagformaatNaarBlokken — round-trip', () => {
  it('pct (0-100) <-> duur_pct (0-1) rondtrip', () => {
    const blokken = [
      { _id: 'a', type: 'werk', zone: 'Z3', pct_ftp: 88, pct: 70, reps: 1, maximaal: false, isSpecifiek: false },
      { _id: 'b', type: 'herstel', zone: 'Z2', pct_ftp: 60, pct: 30, reps: 1, maximaal: false, isSpecifiek: false },
    ]
    const opgeslagen = blokkenNaarOpslagformaat(blokken)
    expect(opgeslagen[0].duur_pct).toBeCloseTo(0.7, 5)
    expect(opgeslagen[1].duur_pct).toBeCloseTo(0.3, 5)
    // builder-only velden mogen niet in het opslagformaat lekken
    expect(opgeslagen[0]._id).toBeUndefined()
    expect(opgeslagen[0].pct).toBeUndefined()
    expect(opgeslagen[0].maximaal).toBeUndefined()

    const terug = opslagformaatNaarBlokken(opgeslagen)
    expect(terug[0].pct).toBeCloseTo(70, 5)
    expect(terug[1].pct).toBeCloseTo(30, 5)
  })

  it('reps>1 blijft behouden, en pct is per instantie (niet vermenigvuldigd met reps)', () => {
    const blokken = [
      { _id: 'a', type: 'werk', zone: 'Z4', pct_ftp: 100, pct: 5, reps: 4, maximaal: false, isSpecifiek: false },
      { _id: 'b', type: 'herstel', zone: 'Z2', pct_ftp: 60, pct: 3, reps: 4, maximaal: false, isSpecifiek: false },
      { _id: 'c', type: 'herstel', zone: 'Z2', pct_ftp: 60, pct: 68, reps: 1, maximaal: false, isSpecifiek: false },
    ]
    // totaal = 5*4 + 3*4 + 68 = 20+12+68 = 100
    expect(berekenPctTotaal(blokken)).toBeCloseTo(100, 5)

    const opgeslagen = blokkenNaarOpslagformaat(blokken)
    expect(opgeslagen[0].reps).toBe(4)
    expect(opgeslagen[0].duur_pct).toBeCloseTo(0.05, 5)
    expect(opgeslagen[2].reps).toBeUndefined() // reps:1 wordt niet expliciet opgeslagen
  })

  it('isSpecifiek: alleen expliciet opgeslagen als true, nooit als false', () => {
    const specifiek = blokkenNaarOpslagformaat([{ _id: 'a', type: 'werk', zone: 'Z4', pct_ftp: 100, pct: 100, reps: 1, isSpecifiek: true }])
    expect(specifiek[0].isSpecifiek).toBe(true)

    const nietSpecifiek = blokkenNaarOpslagformaat([{ _id: 'a', type: 'werk', zone: 'Z4', pct_ftp: 100, pct: 100, reps: 1, isSpecifiek: false }])
    expect(nietSpecifiek[0]).not.toHaveProperty('isSpecifiek')
  })

  it('isSpecifiek: true rondt correct terug via opslagformaatNaarBlokken', () => {
    const terug = opslagformaatNaarBlokken([{ type: 'werk', zone: 'Z4', pct_ftp: 100, duur_pct: 1, isSpecifiek: true }])
    expect(terug[0].isSpecifiek).toBe(true)
  })

  it('cadans_rpm blijft behouden bij het rondtrippen (kracht_lage_cadans)', () => {
    const terug = opslagformaatNaarBlokken([{ type: 'werk', zone: 'Z3', pct_ftp: 90, duur_pct: 1, cadans_rpm: 50 }])
    expect(terug[0].cadans_rpm).toBe(50)
    const opgeslagen = blokkenNaarOpslagformaat(terug)
    expect(opgeslagen[0].cadans_rpm).toBe(50)
  })
})

describe('zwoBlokkenNaarBuilderBlokken', () => {
  it('converteert ZWO-parser-output (duurSec-gebaseerd) naar pct-gebaseerde builder-blokken die optellen tot 100', () => {
    const zwoBlokken = [
      { type: 'werk', zone: 'Z2', pct_ftp: 65, duurSec: 600 },
      { type: 'werk', zone: 'Z4', pct_ftp: 105, duurSec: 240, reps: 4 },
      { type: 'herstel', zone: 'Z1', pct_ftp: 55, duurSec: 120, reps: 4 },
    ]
    const blokken = zwoBlokkenNaarBuilderBlokken(zwoBlokken)
    // 1-decimaal afronding per blok kan een kleine drift geven — dezelfde
    // tolerantie als PCT_TOTAAL_TOLERANTIE in de builder-UI.
    expect(Math.abs(berekenPctTotaal(blokken) - 100)).toBeLessThanOrEqual(0.5)
    expect(blokken[0]._id).toBeTruthy()
    expect(blokken[1].reps).toBe(4)
  })
})

describe('berekenPctTotaal', () => {
  it('lege array -> 0', () => {
    expect(berekenPctTotaal([])).toBe(0)
    expect(berekenPctTotaal(undefined)).toBe(0)
  })

  it('een enkel blok van 100% -> 100', () => {
    expect(berekenPctTotaal([{ pct: 100, reps: 1 }])).toBe(100)
  })
})

describe('leegBlok', () => {
  it('heeft een pct-veld (geen duurSec meer) en isSpecifiek: false', () => {
    const b = leegBlok()
    expect(typeof b.pct).toBe('number')
    expect(b.duurSec).toBeUndefined()
    expect(b.isSpecifiek).toBe(false)
  })
})

describe('groepeerBlokkenTotSets', () => {
  it('groepeert een werk+herstel-paar met gelijke reps als één set', () => {
    const blokken = [
      { pct: 5, reps: 4, type: 'werk' },
      { pct: 3, reps: 4, type: 'herstel' },
      { pct: 68, reps: 1, type: 'herstel' },
    ]
    const sets = groepeerBlokkenTotSets(blokken)
    expect(sets).toHaveLength(2)
    expect(sets[0].reps).toBe(4)
    expect(sets[0].blokken).toHaveLength(2)
    expect(sets[1].reps).toBe(1)
  })
})

describe('formatDuur', () => {
  it('rondt en formatteert seconden/minuten leesbaar', () => {
    expect(formatDuur(45)).toBe('45s')
    expect(formatDuur(300)).toBe("5'")
    expect(formatDuur(330)).toBe("5.5'")
  })
})
