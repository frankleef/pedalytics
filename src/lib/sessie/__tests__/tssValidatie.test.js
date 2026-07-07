import { describe, it, expect } from 'vitest'
import { corrigeerSessieTss, corrigeerSessieTssTovDagbudget } from '../tssValidatie.js'

describe('corrigeerSessieTssTovDagbudget (bugfix: archetype-TSS losgeraakt van dagbudget)', () => {
  // Bugreport: z2_tempo_blokken (tss_range 70-105) in een herstelweek met
  // tss_doel 54 leverde een sessie van tss=101 op — bijna het dubbele van het
  // dagbudget, en corrigeerSessieTss() (generiek IF-bereik per sessietype)
  // greep niet in omdat 101 TSS op 120 min een volkomen normale "duur_variabel"-IF is.
  it('schaalt een sessie die > 115% van tss_doel zit terug, inclusief duur en segmenten', () => {
    const sessie = {
      type: 'duur_variabel',
      tss: 101,
      duur_min: 120,
      intentie: { tss_doel: 54 },
      segmenten: [
        { type: 'werk', zone: 'Z2', blokDuurSeconden: 3600 },
        { type: 'werk', zone: 'Z3', blokDuurSeconden: 1800 },
        { type: 'herstel', zone: 'Z2', blokDuurSeconden: 1800 },
      ],
    }
    corrigeerSessieTssTovDagbudget(sessie)
    expect(sessie.tss).toBeLessThan(101)
    expect(sessie.duur_min).toBeLessThan(120)
    // Segmenten blijven consistent met de nieuwe duur_min (binnen afrondingsmarge)
    const totaalSec = sessie.segmenten.reduce((s, seg) => s + seg.blokDuurSeconden, 0)
    expect(Math.round(totaalSec / 60)).toBe(sessie.duur_min)
  })

  it('laat een sessie binnen 115% van tss_doel volledig met rust', () => {
    const sessie = {
      type: 'duur_variabel', tss: 60, duur_min: 90,
      intentie: { tss_doel: 54 },
      segmenten: [{ type: 'werk', zone: 'Z2', blokDuurSeconden: 5400 }],
    }
    corrigeerSessieTssTovDagbudget(sessie)
    expect(sessie.tss).toBe(60)
    expect(sessie.duur_min).toBe(90)
  })

  it('schaalt nooit omhoog bij ondershoot van tss_doel (geen probleem, normale dagvorm-variatie)', () => {
    const sessie = {
      type: 'duur_variabel', tss: 40, duur_min: 60,
      intentie: { tss_doel: 54 },
      segmenten: [{ type: 'werk', zone: 'Z2', blokDuurSeconden: 3600 }],
    }
    corrigeerSessieTssTovDagbudget(sessie)
    expect(sessie.tss).toBe(40)
    expect(sessie.duur_min).toBe(60)
  })

  it('doet niets zonder tss_doel (bv. ramp_test of handmatige keuze zonder dagbudget)', () => {
    const sessie = {
      type: 'duur_variabel', tss: 200, duur_min: 120,
      intentie: {},
      segmenten: [{ type: 'werk', zone: 'Z2', blokDuurSeconden: 7200 }],
    }
    corrigeerSessieTssTovDagbudget(sessie)
    expect(sessie.tss).toBe(200)
    expect(sessie.duur_min).toBe(120)
  })

  it('doet niets zonder segmenten (bv. ramp_test met protocol i.p.v. segmenten)', () => {
    const sessie = { type: 'duur_variabel', tss: 200, duur_min: 120, intentie: { tss_doel: 54 } }
    expect(() => corrigeerSessieTssTovDagbudget(sessie)).not.toThrow()
    expect(sessie.tss).toBe(200)
  })
})

describe('corrigeerSessieTss (bestaand gedrag, regressie-check)', () => {
  it('blijft ongewijzigd werken los van de nieuwe dagbudget-correctie', () => {
    const sessie = { type: 'duur_variabel', duur_min: 120, tss: 30 }
    corrigeerSessieTss(sessie)
    expect(sessie.tss).toBeGreaterThan(30)
  })
})
