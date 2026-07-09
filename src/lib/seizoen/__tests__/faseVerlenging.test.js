import { describe, it, expect } from 'vitest'
import { voegExtraWeekToe } from '../faseVerlenging.js'

// Regressietest: met de default-opties ({weektype: "opbouw", tssPct: 1}) moet
// dit exact hetzelfde resultaat geven als de oorspronkelijke, inline splice-
// logica die in cron/sync/route.js stond (cardiac-decoupling-fase-verlenging,
// sectie 22-F) — geen enkel gedragsverschil door de verplaatsing naar een
// gedeeld bestand.
function bouwKader() {
  return [
    { week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200, focus: 'a', z1z2_doel: 0.9, max_intensiteit: 1, sessietypes: ['z2_duur'] },
    { week: 2, fase: 'basis', weektype: 'opbouw', tss_doel: 210, focus: 'a', z1z2_doel: 0.9, max_intensiteit: 1, sessietypes: ['z2_duur'] },
    { week: 3, fase: 'basis', weektype: 'opbouw', tss_doel: 220, focus: 'a', z1z2_doel: 0.9, max_intensiteit: 1, sessietypes: ['z2_duur'] },
    { week: 4, fase: 'basis', weektype: 'herstel', tss_doel: 100, focus: 'a', z1z2_doel: 0.9, max_intensiteit: 1, sessietypes: ['z2_duur'] },
    { week: 5, fase: 'sweetspot', weektype: 'opbouw', tss_doel: 230, focus: 'b', z1z2_doel: 0.8, max_intensiteit: 2, sessietypes: ['sweetspot_intervallen'] },
  ]
}

// Kopie van de oorspronkelijke inline logica (sync/route.js vóór de verplaatsing),
// puur voor deze regressievergelijking.
function inlineVersie(plan, weekNr) {
  if (!plan.kader) return false
  const herstelIdx = plan.kader.findIndex((w, i) => i >= weekNr - 1 && w.weektype === 'herstel')
  if (herstelIdx <= 0) return false
  const vorigeWeek = plan.kader[herstelIdx - 1]
  const extraWeek = {
    week: vorigeWeek.week + 0.5,
    fase: vorigeWeek.fase,
    weektype: 'opbouw',
    tss_doel: vorigeWeek.tss_doel,
    focus: vorigeWeek.focus,
    z1z2_doel: vorigeWeek.z1z2_doel,
    max_intensiteit: vorigeWeek.max_intensiteit,
    sessietypes: vorigeWeek.sessietypes,
  }
  plan.kader.splice(herstelIdx, 0, extraWeek)
  for (let k = 0; k < plan.kader.length; k++) plan.kader[k].week = k + 1
  plan.tijdshorizon_weken = plan.kader.length
  return true
}

describe('voegExtraWeekToe — regressie t.o.v. de oorspronkelijke inline versie', () => {
  it('geeft met default-opties exact hetzelfde resultaat als de inline splice-logica', () => {
    const planA = { kader: bouwKader() }
    const planB = { kader: bouwKader() }

    const resultaatA = inlineVersie(planA, 3)
    const resultaatB = voegExtraWeekToe(planB, 3) // default: {weektype: "opbouw", tssPct: 1}

    expect(resultaatB).toBe(resultaatA)
    expect(planB.kader).toEqual(planA.kader)
    expect(planB.tijdshorizon_weken).toBe(planA.tijdshorizon_weken)
  })

  it('voegt een week in vóór de eerstvolgende herstelweek, kloont de voorgaande week, hernummert', () => {
    const plan = { kader: bouwKader() }
    const toegepast = voegExtraWeekToe(plan, 1)

    expect(toegepast).toBe(true)
    expect(plan.kader.length).toBe(6)
    expect(plan.tijdshorizon_weken).toBe(6)
    // Nieuwe week zit vóór de herstelweek (was week 4), kloon van week 3
    expect(plan.kader[3]).toMatchObject({ week: 4, fase: 'basis', weektype: 'opbouw', tss_doel: 220 })
    expect(plan.kader[4]).toMatchObject({ week: 5, weektype: 'herstel', tss_doel: 100 })
    // Latere weken zijn correct doorgeschoven
    expect(plan.kader[5]).toMatchObject({ week: 6, fase: 'sweetspot' })
  })

  it('retourneert false zonder plan te wijzigen als er geen herstelweek gevonden wordt', () => {
    const plan = { kader: bouwKader() };
    const kopie = JSON.parse(JSON.stringify(plan.kader))
    const toegepast = voegExtraWeekToe(plan, 6) // voorbij het einde van het kader
    expect(toegepast).toBe(false)
    expect(plan.kader).toEqual(kopie)
  })

  it('past tssPct toe op het gekloonde tss_doel bij een lichtere insertie', () => {
    const plan = { kader: bouwKader() }
    voegExtraWeekToe(plan, 1, { weektype: 'herstel', tssPct: 0.6 })
    const ingevoegd = plan.kader.find(w => w.week === 4)
    expect(ingevoegd.weektype).toBe('herstel')
    expect(ingevoegd.tss_doel).toBe(Math.round(220 * 0.6))
  })

  it('is los aanroepbaar zonder enige sync-cron-context (geen kv/apiKey/athleteId nodig)', () => {
    // Puur een plan-object, geen enkele andere afhankelijkheid — bevestigt dat
    // dit ook vanuit een afwezigheidsperiode-route werkt, niet alleen cron/sync.
    const los = { kader: bouwKader() }
    expect(() => voegExtraWeekToe(los, 2, { weektype: 'opbouw', tssPct: 0.75 })).not.toThrow()
    expect(los.kader.length).toBe(6)
  })
})
