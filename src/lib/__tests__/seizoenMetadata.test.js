import { describe, it, expect } from 'vitest'
import { berekenStreefwaarde, bouwSamenvatting, genereerSeizoensMetadata } from '../seizoen/metadata.js'

describe('berekenStreefwaarde', () => {
  it('ftp × recreatief × 265W', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'ftp' }, ervaringsniveau: 'recreatief', ftp: 265 })
    expect(r).toEqual({ type: 'ftp_range', min: 278, max: 286, label: '278–286W' })
  })

  it('ftp × starter × 265W', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'ftp' }, ervaringsniveau: 'starter', ftp: 265 })
    expect(r.min).toBe(286)
    expect(r.max).toBe(297)
  })

  it('ftp × getraind × 265W', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'ftp' }, ervaringsniveau: 'getraind', ftp: 265 })
    expect(r.min).toBe(273)
    expect(r.max).toBe(278)
  })

  it('ftp met doel_ftp boven de berekende range (recreatief)', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'ftp', doel_ftp: 290 }, ervaringsniveau: 'recreatief', ftp: 265 })
    expect(r.min).toBe(278)
    expect(r.max).toBe(290)
  })

  it('ftp met doel_ftp onder de berekende min → enkelvoudig doel', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'ftp', doel_ftp: 270 }, ervaringsniveau: 'recreatief', ftp: 265 })
    expect(r.min).toBe(270)
    expect(r.max).toBe(270)
    expect(r.label).toBe('270W')
  })

  it('klimmen × recreatief × 265W × 74kg', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'klimmen' }, ervaringsniveau: 'recreatief', ftp: 265, gewichtKg: 74 })
    expect(r.type).toBe('wkg_range')
    expect(r.label).toBe('3,8–3,9 W/kg')
  })

  it('klimmen zonder gewichtKg valt terug op ftp_range', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'klimmen' }, ervaringsniveau: 'recreatief', ftp: 265 })
    expect(r.type).toBe('ftp_range')
  })

  it('aerobe_basis geeft decoupling-label', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'aerobe_basis' }, ervaringsniveau: 'recreatief', ftp: 265 })
    expect(r.label).toBe('Decoupling < 5%')
  })

  it('uithoudingsvermogen met urenPerDag waarvan max 4', () => {
    const r = berekenStreefwaarde({
      seizoensdoel: { type: 'uithoudingsvermogen' }, ervaringsniveau: 'recreatief', ftp: 265,
      urenPerDag: { Maandag: 1.5, Zaterdag: 4, Zondag: 2 },
    })
    expect(r.label).toBe('Langste rit: 4 uur')
  })

  it('uithoudingsvermogen zonder urenPerDag geeft kwalitatief label, samenvatting bevat geen "null"', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'uithoudingsvermogen' }, ervaringsniveau: 'recreatief', ftp: 265 })
    expect(r.label).toBe('Lange duurritten')

    const samenvatting = bouwSamenvatting({ seizoensdoel: { type: 'uithoudingsvermogen' }, kader: Array(13), streefwaarde: r, ftp: 265, langsteRitUren: null, eventDatum: null })
    expect(samenvatting).not.toContain('null')
  })

  it('sprint zonder piekVermogen geeft kwalitatief label', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'sprint' }, ervaringsniveau: 'recreatief', ftp: 265 })
    expect(r.label).toBe('Piekvermogen +5–10%')
  })

  it('sprint met piekVermogen 900', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'sprint' }, ervaringsniveau: 'recreatief', ftp: 265, piekVermogen: 900 })
    expect(r.min).toBe(945)
    expect(r.max).toBe(990)
  })

  it('onbekend ervaringsniveau gedraagt zich als recreatief', () => {
    const r = berekenStreefwaarde({ seizoensdoel: { type: 'ftp' }, ervaringsniveau: 'onbekend-niveau', ftp: 265 })
    expect(r.min).toBe(278)
    expect(r.max).toBe(286)
  })

  it('ftp 0 of ontbrekend throwt', () => {
    expect(() => berekenStreefwaarde({ seizoensdoel: { type: 'ftp' }, ervaringsniveau: 'recreatief', ftp: 0 })).toThrow()
    expect(() => berekenStreefwaarde({ seizoensdoel: { type: 'ftp' }, ervaringsniveau: 'recreatief' })).toThrow()
  })
})

describe('bouwSamenvatting', () => {
  it('ftp-samenvatting bevat weken, ftp en streeflabel', () => {
    const streefwaarde = berekenStreefwaarde({ seizoensdoel: { type: 'ftp' }, ervaringsniveau: 'recreatief', ftp: 265 })
    const samenvatting = bouwSamenvatting({ seizoensdoel: { type: 'ftp' }, kader: Array(13), streefwaarde, ftp: 265, langsteRitUren: null, eventDatum: null })
    expect(samenvatting).toContain('13 weken')
    expect(samenvatting).toContain('265W')
    expect(samenvatting).toContain(streefwaarde.label)
  })

  it('uithoudingsvermogen-samenvatting met evenementdatum eindigt op de leesbare datum', () => {
    const streefwaarde = berekenStreefwaarde({ seizoensdoel: { type: 'uithoudingsvermogen' }, ervaringsniveau: 'recreatief', ftp: 265, urenPerDag: { Zaterdag: 4 } })
    const samenvatting = bouwSamenvatting({
      seizoensdoel: { type: 'uithoudingsvermogen', event_datum: '2026-09-14' }, kader: Array(13), streefwaarde, ftp: 265, langsteRitUren: 4, eventDatum: '2026-09-14',
    })
    expect(samenvatting.endsWith('op 14 september.')).toBe(true)
  })
})

describe('genereerSeizoensMetadata', () => {
  it('geeft consistent { samenvatting, streefwaarde } terug', () => {
    const r = genereerSeizoensMetadata({ seizoensdoel: { type: 'ftp' }, kader: Array(13), ervaringsniveau: 'recreatief', ftp: 265 })
    expect(r.streefwaarde.label).toBe('278–286W')
    expect(r.samenvatting.startsWith('Dit plan bouwt in 13 weken')).toBe(true)
  })
})
