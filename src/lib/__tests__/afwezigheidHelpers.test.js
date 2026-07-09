import { describe, it, expect } from 'vitest'
import { valtBinnenAfwezigheid, vindActievePeriode, effectiefEind } from '../afwezigheidHelpers.js'

describe('afwezigheidHelpers — pure, client-veilig', () => {
  it('effectiefEind: geeft eindDatum terug, of een verre toekomstdatum bij open eind', () => {
    expect(effectiefEind({ eindDatum: '2026-07-20' })).toBe('2026-07-20')
    expect(effectiefEind({ eindDatum: null })).toBe('9999-12-31')
  })

  describe('vindActievePeriode', () => {
    it('vindt de actieve periode die een datum overspant', () => {
      const periodes = [
        { periodeId: 'p1', startDatum: '2026-07-10', eindDatum: '2026-07-15', status: 'actief' },
      ]
      expect(vindActievePeriode('2026-07-12', periodes)?.periodeId).toBe('p1')
      expect(vindActievePeriode('2026-07-16', periodes)).toBeNull()
    })

    it('negeert geannuleerde/afgeronde periodes', () => {
      const periodes = [
        { periodeId: 'p1', startDatum: '2026-07-10', eindDatum: '2026-07-15', status: 'geannuleerd' },
        { periodeId: 'p2', startDatum: '2026-07-10', eindDatum: '2026-07-15', status: 'afgerond' },
      ]
      expect(vindActievePeriode('2026-07-12', periodes)).toBeNull()
    })

    it('behandelt een open-eind-periode als doorlopend tot in de verre toekomst', () => {
      const periodes = [{ periodeId: 'p1', startDatum: '2026-07-01', eindDatum: null, status: 'actief' }]
      expect(vindActievePeriode('2027-01-01', periodes)?.periodeId).toBe('p1')
    })

    it('geeft null bij een lege of ontbrekende lijst', () => {
      expect(vindActievePeriode('2026-07-12', [])).toBeNull()
      expect(vindActievePeriode('2026-07-12', undefined)).toBeNull()
    })
  })

  describe('valtBinnenAfwezigheid', () => {
    it('spiegelt vindActievePeriode als boolean', () => {
      const periodes = [{ startDatum: '2026-07-10', eindDatum: '2026-07-15', status: 'actief' }]
      expect(valtBinnenAfwezigheid('2026-07-12', periodes)).toBe(true)
      expect(valtBinnenAfwezigheid('2026-07-16', periodes)).toBe(false)
    })
  })
})
