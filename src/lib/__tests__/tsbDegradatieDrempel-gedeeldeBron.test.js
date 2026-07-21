// A3 (ontdubbeling): bewijst dat bepaalDoelGewicht (sessie-generatie.js)
// TSB_DEGRADATIE_DREMPEL LIVE importeert uit sessie/weekSolver.js — geen
// eigen rauwe -20-literal meer. Door de constante hier te mocken en te
// bevestigen dat bepaalDoelGewicht's gedrag meebeweegt, tonen we aan dat er
// nu één gedeelde bron is i.p.v. twee onafhankelijke plekken.
//
// LET OP — geen `importOriginal()`: sessie-generatie.js en sessie/weekSolver.js
// zijn onderling circulair (weekSolver.js importeert zelf ook uit
// sessie-generatie.js). `importOriginal()` triggert daardoor een echte
// her-evaluatie van weekSolver.js terwijl sessie-generatie.js nog MIDDEN in
// zijn eigen evaluatie zit — de override ging zo verloren (empirisch
// vastgesteld: eerst geprobeerd, gaf gewicht 2 i.p.v. de verwachte 1). Een
// volledige module-vervanging (geen spread van de echte export) omzeilt dat
// circulaire re-entry-probleem. bepaalDoelGewicht heeft verder niets anders
// uit weekSolver.js nodig, dus dat is hier veilig.
import { describe, it, expect, vi } from 'vitest'

vi.mock('../sessie/weekSolver.js', () => ({ TSB_DEGRADATIE_DREMPEL: -5 }))

import { TSB_DEGRADATIE_DREMPEL } from '../sessie/weekSolver.js'
import { bepaalDoelGewicht } from '../sessie-generatie.js'

describe('TSB_DEGRADATIE_DREMPEL — gedeelde bron tussen weekSolver.js en sessie-generatie.js', () => {
  it('de gemockte waarde (-5, niet de echte -20) komt aan bij bepaalDoelGewicht via de import', () => {
    expect(TSB_DEGRADATIE_DREMPEL).toBe(-5)

    // tsb=-10: bij de ECHTE drempel (-20) is -10 < -20 false -> gewicht 2
    // (valt door naar de tweede tak). Bij de gemockte drempel (-5) is
    // -10 < -5 wel waar -> gewicht 1. Dat het gewicht 1 wordt, bewijst dat de
    // import live is, geen gekopieerde -20.
    const gewicht = bepaalDoelGewicht({ tsb: -10, hrv: 'normaal', rpeDeltaTrend: 0 })
    expect(gewicht).toBe(1)
  })
})
