import { describe, it, expect } from 'vitest'
import { voegSprintStaartjesToe, voegTempoAfsluiterToe } from '../segmentStaart.js'

function maakSessie(totaalMin, sessietype = 'z2_duur') {
  const totaalSec = totaalMin * 60
  return {
    type: 'duur_variabel',
    intentie: { sessietype, toegestane_zones: ['Z2'] },
    segmenten: [
      { zone: 'Z2', positie: 'onder', blokDuurSeconden: totaalSec * 0.5, isSpecifiek: false, sessietype },
      { zone: 'Z2', positie: 'boven', blokDuurSeconden: totaalSec * 0.5, isSpecifiek: false, sessietype },
    ],
    duur_min: totaalMin,
  }
}

describe('voegSprintStaartjesToe', () => {
  it('behoudt de totale sessieduur (kern krimpt exact met de staart-duur)', () => {
    const sessie = maakSessie(90)
    voegSprintStaartjesToe(sessie, 265)
    const totaalSec = sessie.segmenten.reduce((s, seg) => s + seg.blokDuurSeconden, 0)
    expect(Math.round(totaalSec / 60)).toBe(90)
    expect(sessie.duur_min).toBe(90)
  })

  it('voegt 4 sprint-reps (Z7) toe, geinterleaved met Z2-herstel', () => {
    const sessie = maakSessie(90)
    voegSprintStaartjesToe(sessie, 265)
    const staart = sessie.segmenten.slice(-8) // 4x [werk+herstel]
    const types = staart.map(s => s.zone)
    expect(types).toEqual(['Z7', 'Z2', 'Z7', 'Z2', 'Z7', 'Z2', 'Z7', 'Z2'])
  })

  it('zet heeft_sprint_staartjes en voegt Z7 toe aan toegestane_zones', () => {
    const sessie = maakSessie(90)
    voegSprintStaartjesToe(sessie, 265)
    expect(sessie.intentie.heeft_sprint_staartjes).toBe(true)
    expect(sessie.intentie.toegestane_zones).toContain('Z7')
  })

  it('sprint-vermogen ligt rond 200% FTP', () => {
    const sessie = maakSessie(90)
    voegSprintStaartjesToe(sessie, 265)
    const sprintBlok = sessie.segmenten.find(s => s.zone === 'Z7')
    expect(sprintBlok.vermogenMin).toBeGreaterThan(265 * 1.8)
  })
})

describe('voegTempoAfsluiterToe', () => {
  it('behoudt de totale sessieduur en voegt een enkel Z3-blok toe', () => {
    const sessie = maakSessie(120)
    voegTempoAfsluiterToe(sessie, 265, 18)
    const totaalSec = sessie.segmenten.reduce((s, seg) => s + seg.blokDuurSeconden, 0)
    expect(Math.round(totaalSec / 60)).toBe(120)
    const afsluiter = sessie.segmenten[sessie.segmenten.length - 1]
    expect(afsluiter.zone).toBe('Z3')
    expect(Math.round(afsluiter.blokDuurSeconden / 60)).toBe(18)
  })

  it('gebruikt de default duur (18 min) als er geen duurMin wordt opgegeven', () => {
    const sessie = maakSessie(90)
    voegTempoAfsluiterToe(sessie, 265)
    const afsluiter = sessie.segmenten[sessie.segmenten.length - 1]
    expect(Math.round(afsluiter.blokDuurSeconden / 60)).toBe(18)
  })
})
