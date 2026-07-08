import { describe, it, expect } from 'vitest'
import { bouwKader } from '../bouwKader.js'

function doelConfig(overrides = {}) {
  return {
    tijdshorizon_weken: 16,
    huidige_ctl: 45,
    ervaringsniveau: 'recreatief',
    startdatum: '2026-01-05', // maandag
    seizoensdoel: { type: 'ftp' },
    ...overrides,
  }
}

describe('bouwKader — sectie 51-C tussentijdse-FTP-test-vlag', () => {
  it('alleen week 3 krijgt bevat_tussentijdse_ftp_test, geen enkele andere week', () => {
    const kader = bouwKader(doelConfig())

    const week3 = kader.find(w => w.week === 3)
    expect(week3.bevat_tussentijdse_ftp_test).toBe(true)

    const overigeWeken = kader.filter(w => w.week !== 3)
    expect(overigeWeken.length).toBeGreaterThan(0)
    for (const w of overigeWeken) {
      expect(w.bevat_tussentijdse_ftp_test).toBeUndefined()
    }
  })

  it('niet herhaald op week 7 of 11 (analoog aan het 4-weken-ritme)', () => {
    const kader = bouwKader(doelConfig())
    const week7 = kader.find(w => w.week === 7)
    const week11 = kader.find(w => w.week === 11)
    expect(week7?.bevat_tussentijdse_ftp_test).toBeUndefined()
    expect(week11?.bevat_tussentijdse_ftp_test).toBeUndefined()
  })

  it('geldt voor alle seizoensdoelen', () => {
    for (const type of ['ftp', 'klimmen', 'aerobe_basis', 'uithoudingsvermogen', 'sprint']) {
      const kader = bouwKader(doelConfig({ seizoensdoel: { type } }))
      const week3 = kader.find(w => w.week === 3)
      expect(week3?.bevat_tussentijdse_ftp_test, `doel=${type}`).toBe(true)
    }
  })

  it('werkt ook bij het kortst mogelijke plan (13 weken, geclampt)', () => {
    const kader = bouwKader(doelConfig({ tijdshorizon_weken: 13 }))
    const week3 = kader.find(w => w.week === 3)
    expect(week3?.bevat_tussentijdse_ftp_test).toBe(true)
    expect(kader.filter(w => w.bevat_tussentijdse_ftp_test)).toHaveLength(1)
  })
})

describe('bouwKader — TSS-groei-cap afgeleid van seizoensstructuur (i.p.v. vaste 1.8x)', () => {
  it('de cap bindt niet meer midden in een gezond 16-wekenseizoen (ctl=53, ftp, recreatief)', () => {
    // Regressiescenario: met de oude vaste cap (baseTss * 1.8 = 477) sloeg de
    // cap al in week 10 toe en bleven weken 10 t/m 14 plat op 477 — precies
    // tijdens de bedoeld zwaarste drempelfase. Met de nieuwe, van de
    // seizoensstructuur afgeleide cap mag dat niet meer gebeuren: elke
    // opbouwweek moet strikt hoger zijn dan de vorige, tot aan de taper.
    const kader = bouwKader(doelConfig({ huidige_ctl: 53, startdatum: '2026-01-10' }))
    const opbouwWeken = kader.filter(w => w.weektype === 'opbouw' && w.week !== 1)

    for (let i = 1; i < opbouwWeken.length; i++) {
      expect(
        opbouwWeken[i].tss_doel,
        `week ${opbouwWeken[i].week} moet hoger zijn dan week ${opbouwWeken[i - 1].week}`
      ).toBeGreaterThan(opbouwWeken[i - 1].tss_doel)
    }
  })

  it('de cap komt overeen met baseTss * (1 + opbouwPct)^aantalOpbouwWeken', () => {
    // ctl=53 → baseTss = round(53*5) = 265. Doel "ftp" heeft tss_opbouw_pct
    // 0.10. De weekvolgorde voor 16 weken/ftp/recreatief heeft 12 weken met
    // weektype "opbouw" (basis 1-3, sweetspot 5-7 + 9, overgangsfase 10,
    // drempel 11-14). Verwachte cap: round(265 * 1.1^12) = 832.
    const kader = bouwKader(doelConfig({ huidige_ctl: 53, startdatum: '2026-01-10' }))
    const verwachteCap = Math.round(265 * Math.pow(1.10, 12))
    expect(verwachteCap).toBe(832)

    // Geen enkele week mag boven de cap uitkomen, en de piekweek (14) moet er
    // net onder blijven (niet eraan vastgeplakt zoals bij de oude bug).
    const maxTss = Math.max(...kader.map(w => w.tss_doel))
    expect(maxTss).toBeLessThan(verwachteCap)
    expect(kader.find(w => w.week === 14).tss_doel).toBe(758)
  })
})
