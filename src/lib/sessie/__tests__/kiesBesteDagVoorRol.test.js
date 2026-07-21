// kiesBesteDagVoorRol had tot nu toe GEEN enkele testdekking. Karakteriserende
// tests VOOR de Fix-3b-wijziging (weekpatroon.js: classificatie/48u-berekening
// consolideren naar isBinnen48uVanAndereZwareSessie, compliance.js).
//
// De test 'HUIDIG GEDRAG' legt vast dat een variabele_dag/z2_duur-
// correctiesessie vandaag nog als zwaar telt voor de 48u-uitsluiting van
// andere kandidaatdagen — dat is precies de regel die bewust gaat veranderen
// (de enige gedragswijziging in deze hele taak). Na de fix wordt die ene test
// aangepast naar het nieuwe gedrag; alle overige tests hier blijven
// ongewijzigd geldig (echte intensiteitsdagen blijven zwaar).
import { describe, it, expect } from 'vitest'
import { kiesBesteDagVoorRol } from '../weekpatroon.js'

describe('kiesBesteDagVoorRol', () => {
  it('NIEUW GEDRAG (ná Fix 3b, de enige bewuste gedragswijziging in deze taak): een variabele_dag/z2_duur-correctiesessie telt niet meer als zwaar — een aangrenzende kandidaatdag blijft beschikbaar', () => {
    // Vóór de fix (zie git-historie/verificatierapport) gaf dit exact dezelfde
    // sessies null terug: ZWAAR_ROLLEN.includes("variabele_dag") classificeerde
    // de maandagsessie als "zwaar", ook al is het sessietype (z2_duur) zelf
    // niet fysiologisch zwaar. Na consolidatie naar isBinnen48uVanAndereZwareSessie
    // (uitsluitend sessietype-classificatie, isZwareSessieVoorHerstel) telt
    // z2_duur niet meer mee, dus dinsdag blijft een geldige kandidaat.
    const sessies = [
      { datum: '2026-07-06', voltooid: false, intentie: { rol: 'variabele_dag', sessietype: 'z2_duur' } }, // maandag
      { datum: '2026-07-07', voltooid: false, intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur' } }, // dinsdag, 24u later, kandidaat
    ]
    const resultaat = kiesBesteDagVoorRol(sessies, 'variabele_dag', {})
    expect(resultaat?.datum).toBe('2026-07-07')
  })

  it('echte intensiteitsdag (vo2max_intervallen) sluit een aangrenzende kandidaatdag nog steeds uit, een verre kandidaat blijft wel beschikbaar', () => {
    const sessies = [
      { datum: '2026-07-07', voltooid: false, intentie: { rol: 'intensiteitsdag', sessietype: 'vo2max_intervallen' } }, // dinsdag
      { datum: '2026-07-08', voltooid: false, intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur' } }, // woensdag, 24u later -> uitgesloten
      { datum: '2026-07-11', voltooid: false, intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur' } }, // zaterdag, ver genoeg -> beschikbaar
    ]
    const resultaat = kiesBesteDagVoorRol(sessies, 'intensiteitsdag', {})
    expect(resultaat?.datum).toBe('2026-07-11')
  })

  it('een kandidaat met rol intensiteitsdag/variabele_dag/kracht_dag komt zelf nooit in aanmerking (los van de 48u-check)', () => {
    const sessies = [
      { datum: '2026-07-06', voltooid: false, intentie: { rol: 'kracht_dag', sessietype: 'kracht_lage_cadans' } },
    ]
    const resultaat = kiesBesteDagVoorRol(sessies, 'variabele_dag', {})
    expect(resultaat).toBeNull()
  })

  it('voltooide sessies tellen niet mee als kandidaat', () => {
    const sessies = [
      { datum: '2026-07-06', voltooid: true, intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur' } },
    ]
    const resultaat = kiesBesteDagVoorRol(sessies, 'variabele_dag', {})
    expect(resultaat).toBeNull()
  })

  it('kiest bij meerdere geldige kandidaten de dag met de meeste beschikbare uren', () => {
    const sessies = [
      { datum: '2026-07-06', dag: 'Maandag', voltooid: false, intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur' } },
      { datum: '2026-07-07', dag: 'Dinsdag', voltooid: false, intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur' } },
    ]
    const urenPerDag = { Maandag: 1, Dinsdag: 3 }
    const resultaat = kiesBesteDagVoorRol(sessies, 'variabele_dag', urenPerDag)
    expect(resultaat?.datum).toBe('2026-07-07')
  })
})
