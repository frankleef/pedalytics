// A2 (ontdubbeling): bewijst dat bepaalVolumeCorrectie (volumeCorrectie.js)
// DECOUPLING_BLOKTREND_DREMPEL LIVE importeert uit decoupling.js — geen eigen
// kopie van de waarde 7 meer. Door de constante hier te mocken en te
// bevestigen dat bepaalVolumeCorrectie's gedrag meebeweegt, tonen we aan dat
// er nu één gedeelde bron is i.p.v. twee onafhankelijke literals.
import { describe, it, expect, vi } from 'vitest'

vi.mock('../decoupling.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, DECOUPLING_BLOKTREND_DREMPEL: 3 }
})

import { DECOUPLING_BLOKTREND_DREMPEL } from '../decoupling.js'
import { bepaalVolumeCorrectie } from '../volumeCorrectie.js'

describe('DECOUPLING_BLOKTREND_DREMPEL — gedeelde bron tussen decoupling.js en volumeCorrectie.js', () => {
  it('de gemockte waarde (3, niet de echte 7) komt aan bij bepaalVolumeCorrectie via de import', () => {
    expect(DECOUPLING_BLOKTREND_DREMPEL).toBe(3)

    // decouplingMediaan=4: bij de ECHTE drempel (7) zou dit NIET "slecht" zijn
    // (4 > 7 is false). Bij de gemockte drempel (3) is 4 > 3 wel waar -> als
    // bepaalVolumeCorrectie nog een eigen literal 7 had, zou dit "geen"
    // opleveren i.p.v. "omlaag". Dat het WEL "omlaag" wordt, bewijst dat de
    // import live is, geen gekopieerde waarde.
    const resultaat = bepaalVolumeCorrectie({
      rampRate: null, tsbGemiddelde14d: null, rpeDeltaTrend: null, decouplingMediaan: 4,
    })
    expect(resultaat.richting).toBe('omlaag')
  })
})
