import { describe, it, expect, vi, afterEach } from 'vitest'
import { berekenSchoneReferentie, berekenHerstelDagen, bepaalHerstelsnelheidTrigger, getHerstelDagen, HERSTEL_PLAFOND_DAGEN } from '../herstelsnelheid.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('berekenSchoneReferentie', () => {
  it('sluit dagen op/na zwareSessieDatum uit, gemiddelde over de laatste 14 dagen ervoor', () => {
    const wellnessData = [
      { datum: '2026-06-20', hrv: 60 },
      { datum: '2026-06-21', hrv: 62 },
      { datum: '2026-06-22', hrv: 58 }, // dag van de zware sessie zelf -> uitgesloten
      { datum: '2026-06-23', hrv: 30 }, // ná de sessie -> uitgesloten (zou anders de referentie verlagen)
    ]
    const referentie = berekenSchoneReferentie(wellnessData, '2026-06-22')
    // Alleen 06-20/06-21 tellen mee (< '2026-06-22'): maar dat zijn er maar 2, <7 -> null
    expect(referentie).toBeNull()
  })

  it('correcte gemiddelde-berekening met precies 7 kwalificerende punten vóór de sessiedatum', () => {
    const wellnessData = [
      { datum: '2026-06-10', hrv: 50 },
      { datum: '2026-06-11', hrv: 52 },
      { datum: '2026-06-12', hrv: 54 },
      { datum: '2026-06-13', hrv: 56 },
      { datum: '2026-06-14', hrv: 58 },
      { datum: '2026-06-15', hrv: 60 },
      { datum: '2026-06-16', hrv: 62 },
      { datum: '2026-06-17', hrv: 10 }, // dag van de zware sessie -> uitgesloten
    ]
    const referentie = berekenSchoneReferentie(wellnessData, '2026-06-17')
    expect(referentie).toBe((50 + 52 + 54 + 56 + 58 + 60 + 62) / 7)
  })

  it('fail-open (null) bij minder dan 7 bruikbare punten vóór de sessiedatum', () => {
    const wellnessData = [
      { datum: '2026-06-15', hrv: 60 },
      { datum: '2026-06-16', hrv: null }, // telt niet mee
      { datum: '2026-06-17', hrv: 0 }, // telt niet mee (>0 vereist)
    ]
    expect(berekenSchoneReferentie(wellnessData, '2026-06-18')).toBeNull()
  })

  it('neemt alleen de laatste 14 kwalificerende punten vóór de sessiedatum (niet meer)', () => {
    // 20 punten vóór de sessiedatum, allemaal met een oplopende waarde —
    // alleen de laatste 14 (dus de hoogste 14 waarden, 7..20) horen mee te tellen.
    const wellnessData = Array.from({ length: 20 }, (_, i) => ({
      datum: `2026-05-${String(i + 1).padStart(2, '0')}`,
      hrv: i + 1, // 1..20
    }))
    const referentie = berekenSchoneReferentie(wellnessData, '2026-06-01')
    const verwacht = Array.from({ length: 14 }, (_, i) => i + 7).reduce((s, v) => s + v, 0) / 14 // 7..20
    expect(referentie).toBe(verwacht)
  })
})

describe('berekenHerstelDagen (gerepareerde signature: schoneReferentie i.p.v. hrvProfiel)', () => {
  it('geeft het aantal dagen tot HRV terugveert naar/boven de schone referentie', () => {
    const wellnessData = [
      { datum: '2026-06-17', hrv: 30 }, // sessiedag zelf, niet meegenomen (filter is > sessieDatum)
      { datum: '2026-06-18', hrv: 40 }, // dag 1: nog onder referentie (55)
      { datum: '2026-06-19', hrv: 56 }, // dag 2: terug op/boven referentie
    ]
    const dagen = berekenHerstelDagen('sweetspot_intervallen', '2026-06-17', wellnessData, 55)
    expect(dagen).toBe(2)
  })

  it('fail-open (null) als schoneReferentie null is', () => {
    const wellnessData = [{ datum: '2026-06-18', hrv: 60 }]
    expect(berekenHerstelDagen('sweetspot_intervallen', '2026-06-17', wellnessData, null)).toBeNull()
  })

  it('null als HRV niet binnen 5 dagen terugveert', () => {
    const wellnessData = [
      { datum: '2026-06-18', hrv: 40 },
      { datum: '2026-06-19', hrv: 41 },
      { datum: '2026-06-20', hrv: 42 },
      { datum: '2026-06-21', hrv: 43 },
      { datum: '2026-06-22', hrv: 44 },
    ]
    expect(berekenHerstelDagen('sweetspot_intervallen', '2026-06-17', wellnessData, 55)).toBeNull()
  })
})

describe('bepaalHerstelsnelheidTrigger', () => {
  it('trigger binnen het venster, HRV >10% onder de schone referentie', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-18T10:00:00')) // 1 dag na de sessie
    const resultaat = bepaalHerstelsnelheidTrigger({
      zwareSessieDatum: '2026-06-17', huidigeHrv: 44, schoneReferentie: 50, // 44 = 88% van 50, dus >10% onder
      sessietype: 'sweetspot_intervallen', hrvProfiel: null,
    })
    expect(resultaat).toBe(true)
  })

  it('geen trigger buiten het venster, zelfs met een lage HRV', () => {
    vi.useFakeTimers()
    // sweetspot_intervallen heeft een populatienorm van 1.5 dagen -> venster = min(1.5, 3) = 1.5.
    // 6 dagen na de sessie (ruime marge t.o.v. het venster, tijdzone-onafhankelijk
    // veilig) valt sowieso buiten "dagenSindsSessie > venster".
    vi.setSystemTime(new Date('2026-06-23T10:00:00'))
    const resultaat = bepaalHerstelsnelheidTrigger({
      zwareSessieDatum: '2026-06-17', huidigeHrv: 30, schoneReferentie: 50, // ruim onder de referentie
      sessietype: 'sweetspot_intervallen', hrvProfiel: null,
    })
    expect(resultaat).toBe(false)
  })

  it('geen trigger op precies de 90%-drempel (strikte ongelijkheid)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-18T10:00:00'))
    const resultaat = bepaalHerstelsnelheidTrigger({
      zwareSessieDatum: '2026-06-17', huidigeHrv: 45, schoneReferentie: 50, // exact 90% van 50
      sessietype: 'sweetspot_intervallen', hrvProfiel: null,
    })
    expect(resultaat).toBe(false)
  })

  it('fail-open: ontbrekende zwareSessieDatum/huidigeHrv/schoneReferentie -> false, geen crash', () => {
    expect(bepaalHerstelsnelheidTrigger({ zwareSessieDatum: null, huidigeHrv: 40, schoneReferentie: 50, sessietype: 'sweetspot_intervallen' })).toBe(false)
    expect(bepaalHerstelsnelheidTrigger({ zwareSessieDatum: '2026-06-17', huidigeHrv: null, schoneReferentie: 50, sessietype: 'sweetspot_intervallen' })).toBe(false)
    expect(bepaalHerstelsnelheidTrigger({ zwareSessieDatum: '2026-06-17', huidigeHrv: 40, schoneReferentie: null, sessietype: 'sweetspot_intervallen' })).toBe(false)
  })

  it('gebruikt HERSTEL_PLAFOND_DAGEN als plafond boven een hoge gepersonaliseerde/populatienorm', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T10:00:00')) // 7 dagen na de sessie -> ruim buiten het 3-dagenplafond (tijdzone-onafhankelijk veilig)
    const resultaat = bepaalHerstelsnelheidTrigger({
      zwareSessieDatum: '2026-06-17', huidigeHrv: 30, schoneReferentie: 50,
      sessietype: 'vo2max_intervallen', // populatienorm 2.5, maar plafond is 3
      hrvProfiel: { herstelsnelheid: { vo2max_intervallen: { dagen: 10, observaties: 20 } } }, // corrupte/opgeblazen waarde
    })
    expect(resultaat).toBe(false)
    expect(HERSTEL_PLAFOND_DAGEN).toBe(3)
  })
})
