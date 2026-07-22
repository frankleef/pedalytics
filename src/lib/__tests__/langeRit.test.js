import { describe, it, expect } from 'vitest'
import { moetLangeRitDezeWeek, berekenLangeRitMinimumMin, LANGE_RIT_MINIMUM, LANGE_RIT_CADANS } from '../langeRit.js'

const DOELEN = ['uithoudingsvermogen', 'aerobe_basis', 'klimmen', 'ftp', 'sprint']

describe('moetLangeRitDezeWeek', () => {
  it('herstelweek: altijd false, voor alle 5 seizoensdoelen', () => {
    for (const doel of DOELEN) {
      for (const weekVolgnummer of [1, 2, 3, 4, 10, 11]) {
        expect(moetLangeRitDezeWeek(doel, 'herstel', weekVolgnummer)).toBe(false)
      }
    }
  })

  it('4 van de 5 doelen (cadans 1): elke opbouwweek true, ongeacht weeknummer', () => {
    const elkWeekDoelen = ['uithoudingsvermogen', 'aerobe_basis', 'klimmen', 'ftp']
    for (const doel of elkWeekDoelen) {
      for (const weekVolgnummer of [1, 2, 3, 4, 5, 6, 7]) {
        expect(moetLangeRitDezeWeek(doel, 'opbouw', weekVolgnummer)).toBe(true)
      }
    }
  })

  it('sprint (cadans 2): alleen op even weeknummers true', () => {
    expect(moetLangeRitDezeWeek('sprint', 'opbouw', 1)).toBe(false)
    expect(moetLangeRitDezeWeek('sprint', 'opbouw', 2)).toBe(true)
    expect(moetLangeRitDezeWeek('sprint', 'opbouw', 3)).toBe(false)
    expect(moetLangeRitDezeWeek('sprint', 'opbouw', 4)).toBe(true)
    expect(moetLangeRitDezeWeek('sprint', 'opbouw', 11)).toBe(false)
    expect(moetLangeRitDezeWeek('sprint', 'opbouw', 12)).toBe(true)
  })

  it('LANGE_RIT_CADANS bevat exact de 5 doelen met de afgesproken waarden', () => {
    expect(LANGE_RIT_CADANS).toEqual({
      uithoudingsvermogen: 1, aerobe_basis: 1, klimmen: 1, ftp: 1, sprint: 2,
    })
  })
})

describe('berekenLangeRitMinimumMin', () => {
  it('consolidatie/test/taper: altijd null, ongeacht doel/niveau', () => {
    for (const fase of ['consolidatie', 'test', 'taper']) {
      for (const doel of DOELEN) {
        expect(berekenLangeRitMinimumMin(doel, fase, 'recreatief')).toBeNull()
        expect(berekenLangeRitMinimumMin(doel, fase, 'getraind')).toBeNull()
      }
    }
  })

  it('basisfase: gebruikt altijd de aerobe_basis-rij, ongeacht seizoensdoel', () => {
    for (const doel of DOELEN) {
      expect(berekenLangeRitMinimumMin(doel, 'basis', 'recreatief')).toBe(LANGE_RIT_MINIMUM.aerobe_basis.recreatief)
      expect(berekenLangeRitMinimumMin(doel, 'basis', 'getraind')).toBe(LANGE_RIT_MINIMUM.aerobe_basis.getraind)
    }
  })

  it('overige fases: gebruikt de doel-specifieke rij', () => {
    for (const doel of DOELEN) {
      expect(berekenLangeRitMinimumMin(doel, 'sweetspot', 'recreatief')).toBe(LANGE_RIT_MINIMUM[doel].recreatief)
      expect(berekenLangeRitMinimumMin(doel, 'sweetspot', 'getraind')).toBe(LANGE_RIT_MINIMUM[doel].getraind)
    }
  })

  it('onbekend/ontbrekend ervaringsniveau (bv. "starter") valt terug op recreatief', () => {
    expect(berekenLangeRitMinimumMin('ftp', 'sweetspot', 'starter')).toBe(LANGE_RIT_MINIMUM.ftp.recreatief)
    expect(berekenLangeRitMinimumMin('ftp', 'sweetspot', null)).toBe(LANGE_RIT_MINIMUM.ftp.recreatief)
    expect(berekenLangeRitMinimumMin('ftp', 'sweetspot', undefined)).toBe(LANGE_RIT_MINIMUM.ftp.recreatief)
  })
})
