import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../kv.js', () => ({ getKV: vi.fn() }))
vi.mock('../../users.js', () => ({ getIntervalsCredentials: vi.fn() }))
vi.mock('../../intervals.js', () => ({ intervalsGet: vi.fn(), intervalsPut: vi.fn() }))
vi.mock('../../meldingen.js', () => ({ maakMelding: vi.fn(async () => {}) }))

import { getKV } from '../../kv.js'
import { getIntervalsCredentials } from '../../users.js'
import { intervalsGet } from '../../intervals.js'
import { berekenObjectieveScore, bepaalStatus, checkInSessieAanpassing } from '../checkinAanpassing.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('berekenObjectieveScore (B4) — tsb/hrv/rhr, GEEN checkin', () => {
  it('een RHR ver boven de basislijn verlaagt de score t.o.v. een RHR op de basislijn (alle andere velden gelijk)', () => {
    const basis = { tsb: 0, hrv: 60, hrvBasislijn: 60 }
    const scoreOpBasislijn = berekenObjectieveScore({ ...basis, rhr: 50, rhrBasislijn: 50 })
    const scoreVerhoogd = berekenObjectieveScore({ ...basis, rhr: 60, rhrBasislijn: 50 }) // +20% t.o.v. basislijn
    expect(scoreVerhoogd).toBeLessThan(scoreOpBasislijn)
  })

  it('rhrBasislijn === null (geen echte rhr_basislijn_28d): RHR-component volledig afwezig, gewichtTotaal 0.65 — tsb+hrv-only', () => {
    // tsb=-7.5 (midden -30..15) -> sub=0.5; hrv op basislijn -> sub=1.
    // Zonder RHR: gewogenSom = 0.5*0.40 + 1*0.25 = 0.45, gewichtTotaal = 0.65.
    // score = 0.45/0.65*100 = 69.230...
    const zonderRhrHelemaal = berekenObjectieveScore({ tsb: -7.5, hrv: 58, hrvBasislijn: 58, rhr: null, rhrBasislijn: null })
    const metRhrMaarGeenBasislijn = berekenObjectieveScore({ tsb: -7.5, hrv: 58, hrvBasislijn: 58, rhr: 50, rhrBasislijn: null })
    expect(zonderRhrHelemaal).toBeCloseTo(69.2307, 3)
    expect(metRhrMaarGeenBasislijn).toBeCloseTo(69.2307, 3) // rhrBasislijn ontbreekt -> component valt weg, ook al is rhr zelf bekend
  })

  it('rhrBasislijn aanwezig (echte basislijn): RHR-component telt mee, gewichtTotaal 0.80 (handmatig doorgerekend)', () => {
    // Zelfde tsb/hrv als hierboven (0.45 t.o.v. 0.65), nu MET rhr op zijn
    // basislijn (sub=1): gewogenSom = 0.45 + 1*0.15 = 0.60, gewichtTotaal = 0.80.
    // score = 0.60/0.80*100 = 75.
    const score = berekenObjectieveScore({ tsb: -7.5, hrv: 58, hrvBasislijn: 58, rhr: 50, rhrBasislijn: 50 })
    expect(score).toBeCloseTo(75, 6)
  })

  it('retourneert een ONAFGERONDE waarde (geen Math.round meer, i.t.t. de vroegere berekenBalansscore)', () => {
    // tsb=-7.5 -> sub=0.5; hrv op basislijn -> sub=1; geen rhr-basislijn.
    // 0.45/0.65*100 = 69.23076923... — geen geheel getal.
    const score = berekenObjectieveScore({ tsb: -7.5, hrv: 58, hrvBasislijn: 58, rhr: null, rhrBasislijn: null })
    expect(Number.isInteger(score)).toBe(false)
  })
})

describe('checkInSessieAanpassing — RHR-component alleen bij een echte rhr_basislijn_28d', () => {
  const basisPlan = {
    weekSessies: { sessies: [{ datum: '2026-07-15', voltooid: false, intentie: { sessietype: 'z2_duur', tss_range: { min: 50, max: 70 } } }] },
    profiel: { hrv_basislijn: 58, hr_basislijn: 45 },
    huidige_ftp: 265,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T08:00:00'))
    vi.mocked(getIntervalsCredentials).mockResolvedValue({ apiKey: 'test' })
    vi.mocked(intervalsGet).mockResolvedValue([{ ctl: 50, atl: 45, hrv: 60, restingHR: 48 }])
  })

  it('gebruikt hrv-profiel.rhr_basislijn_28d wanneer aanwezig — RHR-component telt mee', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': basisPlan,
      'hrv-profiel:u1': { betrouwbaar: true, rhr_basislijn_28d: 52 },
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const verwachtRuw = berekenObjectieveScore({ tsb: 5, hrv: 60, hrvBasislijn: 58, rhr: 48, rhrBasislijn: 52 })
    const logSpy = vi.spyOn(console, 'log')
    await checkInSessieAanpassing('u1', 3)
    const logCall = logSpy.mock.calls.find(c => c[0]?.includes('[checkIn]'))
    expect(logCall[0]).toContain(`score=${Math.round(verwachtRuw)}`)
  })

  it('geen rhr_basislijn_28d op hrv-profiel: RHR-component volledig afwezig — GEEN fallback naar plan.profiel.hr_basislijn', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': basisPlan, // heeft wél profiel.hr_basislijn: 45
      'hrv-profiel:u1': { betrouwbaar: true }, // geen rhr_basislijn_28d
    })
    vi.mocked(getKV).mockReturnValue(kv)

    // Verwacht: rhrBasislijn=null (NIET 45) -> component valt weg, score gelijk
    // aan de tsb/hrv-only berekening.
    const verwachtRuw = berekenObjectieveScore({ tsb: 5, hrv: 60, hrvBasislijn: 58, rhr: 48, rhrBasislijn: null })
    const logSpy = vi.spyOn(console, 'log')
    await checkInSessieAanpassing('u1', 3)
    const logCall = logSpy.mock.calls.find(c => c[0]?.includes('[checkIn]'))
    expect(logCall[0]).toContain(`score=${Math.round(verwachtRuw)}`)
  })

  it('geen hrv-profiel-record op KV: RHR-component volledig afwezig — GEEN fallback naar 49', async () => {
    const kv = maakKvMock({
      'u1:seizoensplan': basisPlan,
      // geen hrv-profiel:u1 record
    })
    vi.mocked(getKV).mockReturnValue(kv)

    const verwachtRuw = berekenObjectieveScore({ tsb: 5, hrv: 60, hrvBasislijn: 58, rhr: 48, rhrBasislijn: null })
    const logSpy = vi.spyOn(console, 'log')
    await checkInSessieAanpassing('u1', 3)
    const logCall = logSpy.mock.calls.find(c => c[0]?.includes('[checkIn]'))
    expect(logCall[0]).toContain(`score=${Math.round(verwachtRuw)}`)
  })
})

describe('bepaalStatus (B4) — margetoets + check-in als tie-breaker', () => {
  for (const grens of [75, 55, 35]) {
    const gunstig = grens === 75 ? 'good' : grens === 55 ? 'caution' : 'careful'
    const beschermend = grens === 75 ? 'caution' : grens === 55 ? 'careful' : 'rest'

    it(`binnen 5 punten van grens ${grens} (erboven): checkin=3 (neutraal, sub=0.5) tipt naar de beschermende kant`, () => {
      expect(bepaalStatus(grens + 3, 3)).toBe(beschermend)
    })

    it(`binnen 5 punten van grens ${grens} (eronder): checkin=3 (neutraal, sub=0.5) tipt naar de beschermende kant`, () => {
      expect(bepaalStatus(grens - 3, 3)).toBe(beschermend)
    })

    it(`binnen 5 punten van grens ${grens}: checkin<=3 (sub<=0.5, NIET strikt >0.5) tipt naar de beschermende kant`, () => {
      expect(bepaalStatus(grens + 3, 1)).toBe(beschermend)
      expect(bepaalStatus(grens + 3, 2)).toBe(beschermend)
      expect(bepaalStatus(grens + 3, 3)).toBe(beschermend)
    })

    it(`binnen 5 punten van grens ${grens}: checkin=4+ (sub=0.75+, strikt >0.5) tipt naar de gunstige kant`, () => {
      expect(bepaalStatus(grens - 3, 4)).toBe(gunstig)
      expect(bepaalStatus(grens - 3, 5)).toBe(gunstig)
    })

    it(`exact op grens ${grens} (afstand 0, per definitie binnen de marge): checkin bepaalt de kant`, () => {
      expect(bepaalStatus(grens, 3)).toBe(beschermend)
      expect(bepaalStatus(grens, 4)).toBe(gunstig)
    })

    it(`exact op de margegrens (afstand precies 5) telt nog als "binnen": checkin bepaalt de kant`, () => {
      expect(bepaalStatus(grens + 5, 3)).toBe(beschermend)
      expect(bepaalStatus(grens - 5, 4)).toBe(gunstig)
    })

    it(`buiten de marge van grens ${grens} (afstand 5.01): kale cutoff geldt ongewijzigd, checkin genegeerd`, () => {
      expect(bepaalStatus(grens + 5.01, 1)).toBe(gunstig) // zou anders naar beschermend willen tippen
      expect(bepaalStatus(grens - 5.01, 5)).toBe(beschermend) // zou anders naar gunstig willen tippen
    })

    it(`ver buiten de marge van grens ${grens}: kale cutoff geldt ongewijzigd`, () => {
      expect(bepaalStatus(grens + 15, 1)).toBe(gunstig)
      expect(bepaalStatus(grens - 15, 5)).toBe(beschermend)
    })
  }

  it('checkin=null: tie-breaker valt terug op de neutrale sub 0.5 -> beschermende kant, net als checkin=3', () => {
    expect(bepaalStatus(77, null)).toBe('caution') // binnen marge van grens 75, sub 75+3 -> beschermend
  })

  it('checkin=0 (buiten het geldige 1-5-bereik): behandeld als afwezig -> neutrale sub 0.5 -> beschermende kant', () => {
    expect(bepaalStatus(77, 0)).toBe('caution')
  })

  it('vóór-afronding-precisie: een rauwe score net BINNEN de marge (grens+4.9) triggert de margetoets — een afgeronde waarde (grens+5, ook nog binnen) zou hier toevallig hetzelfde resultaat geven, maar de toets zelf gebeurt op de rauwe waarde', () => {
    expect(bepaalStatus(55 + 4.9, 3)).toBe('careful') // beschermende kant van grens 55, niet 'caution' (de kale >=55-uitkomst)
  })

  it('vóór-afronding-precisie: een rauwe score net BUITEN de marge (grens+5.1) gebruikt de kale cutoff, ongeacht checkin — Math.round zou deze (60) juist WEL binnen de marge van 55 hebben geplaatst', () => {
    // 55 + 5.1 = 60.1 -> ruw buiten marge (afstand 5.1 > 5) -> kale cutoff.
    // Math.round(60.1) = 60 -> afstand tot 55 zou dan 5 zijn, dus WEL binnen
    // de marge -> een op de afgeronde waarde werkende toets zou hier het
    // verkeerde (margetoets-)pad hebben gekozen.
    expect(bepaalStatus(60.1, 1)).toBe('caution') // kale >=55-uitkomst, ongewijzigd door checkin
  })

  it('vóór-afronding-precisie: het omgekeerde randgeval — rauw 49.6 (afstand 5.4 tot grens 55) valt BUITEN de marge, terwijl een afgeronde waarde (50, afstand exact 5) er nog net BINNEN zou vallen', () => {
    expect(bepaalStatus(49.6, 5)).toBe('careful') // buiten marge -> kale <55-uitkomst, checkin (5) wordt genegeerd
  })
})
