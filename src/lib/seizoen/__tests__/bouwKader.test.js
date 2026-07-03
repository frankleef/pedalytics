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
