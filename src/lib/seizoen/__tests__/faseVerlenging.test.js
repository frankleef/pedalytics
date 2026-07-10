import { describe, it, expect } from 'vitest'
import { voegExtraWeekToe, verwijderSessiesVanafWeek } from '../faseVerlenging.js'

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

    // voegExtraWeekToe() retourneert sinds de vanafWeek-uitbreiding een object
    // i.p.v. een kale boolean — resultaatA (de oude inline-versie) blijft dat wel.
    expect(resultaatB.toegepast).toBe(resultaatA)
    expect(planB.kader).toEqual(planA.kader)
    expect(planB.tijdshorizon_weken).toBe(planA.tijdshorizon_weken)
  })

  it('voegt een week in vóór de eerstvolgende herstelweek, kloont de voorgaande week, hernummert', () => {
    const plan = { kader: bouwKader() }
    const { toegepast } = voegExtraWeekToe(plan, 1)

    expect(toegepast).toBe(true)
    expect(plan.kader.length).toBe(6)
    expect(plan.tijdshorizon_weken).toBe(6)
    // Nieuwe week zit vóór de herstelweek (was week 4), kloon van week 3
    expect(plan.kader[3]).toMatchObject({ week: 4, fase: 'basis', weektype: 'opbouw', tss_doel: 220 })
    expect(plan.kader[4]).toMatchObject({ week: 5, weektype: 'herstel', tss_doel: 100 })
    // Latere weken zijn correct doorgeschoven
    expect(plan.kader[5]).toMatchObject({ week: 6, fase: 'sweetspot' })
  })

  it('retourneert { toegepast: false } zonder plan te wijzigen als er geen herstelweek gevonden wordt', () => {
    const plan = { kader: bouwKader() };
    const kopie = JSON.parse(JSON.stringify(plan.kader))
    const resultaat = voegExtraWeekToe(plan, 6) // voorbij het einde van het kader
    expect(resultaat).toMatchObject({ toegepast: false })
    expect(plan.kader).toEqual(kopie)
  })

  it('retourneert vanafWeek als het (na-hernummering) weeknummer vanaf waar kader-inhoud verschoven is', () => {
    const plan = { kader: bouwKader() }
    // herstelweek zit op index 3 (week 4) -> vanafWeek = 3 + 1 = 4
    const resultaat = voegExtraWeekToe(plan, 1)
    expect(resultaat).toEqual({ toegepast: true, vanafWeek: 4 })
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

// Onderdeel 1 — regressietest voor testmoment-verschuiving (diagnoserapport
// "drie openstaande afwezigheid-fixes", punt 5): een tussentijdse-FTP-test-
// vlag en de eindtest (via tijdshorizon_weken) moeten na een insertie op de
// juiste, met één week opgeschoven kalenderdatum uitkomen — geconcretiseerd
// met dezelfde datumrekenkunde als weekgrenzen.js (lokale componenten, geen
// .toISOString()).
describe('voegExtraWeekToe — testmoment-verschuiving', () => {
  const startdatum = '2026-01-05' // maandag

  function datumISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function datumVoorWeek(n) {
    const maandag = new Date(startdatum)
    maandag.setDate(maandag.getDate() + (n - 1) * 7)
    return datumISO(maandag)
  }
  function bouwTestKader() {
    const kader = []
    for (let w = 1; w <= 10; w++) {
      kader.push({
        week: w,
        fase: w <= 4 ? 'basis' : 'sweetspot',
        weektype: (w === 5 || w === 10) ? 'herstel' : 'opbouw',
        tss_doel: 100 + w,
        ...(w === 6 ? { bevat_tussentijdse_ftp_test: true } : {}),
      })
    }
    return kader
  }
  function isEindtest(weekNr, tijdshorizonWeken) {
    return weekNr >= (tijdshorizonWeken || 13)
  }

  it('tussentijdse-FTP-test-vlag verschuift na insertie naar de correcte, één week latere kalenderdatum', async () => {
    const { kaderWeekVoorDatum } = await import('../../weekgrenzen.js')
    const plan = { kader: bouwTestKader(), tijdshorizon_weken: 10, startdatum }

    const datumVoorInsertie = datumVoorWeek(6)
    const kwVoor = kaderWeekVoorDatum(datumVoorInsertie, plan.kader, startdatum)
    expect(kwVoor.bevat_tussentijdse_ftp_test).toBe(true)

    // Insertie vóór de herstelweek op week 5 (dus vóór het testmoment op week 6)
    voegExtraWeekToe(plan, 3)

    const tussentestWeek = plan.kader.find(w => w.bevat_tussentijdse_ftp_test)
    expect(tussentestWeek.week).toBe(7) // was 6, nu 7 — één week opgeschoven

    const datumNaInsertie = datumVoorWeek(7)
    expect(datumNaInsertie).not.toBe(datumVoorInsertie)
    const kwNa = kaderWeekVoorDatum(datumNaInsertie, plan.kader, startdatum)
    expect(kwNa.bevat_tussentijdse_ftp_test).toBe(true)

    // De oorspronkelijke datum wijst niet meer naar het testmoment
    const kwOudeDatumNa = kaderWeekVoorDatum(datumVoorInsertie, plan.kader, startdatum)
    expect(kwOudeDatumNa.bevat_tussentijdse_ftp_test).toBeUndefined()
  })

  it('eindtest schuift automatisch mee doordat tijdshorizon_weken wordt bijgewerkt', () => {
    const plan = { kader: bouwTestKader(), tijdshorizon_weken: 10, startdatum }
    expect(plan.kader.filter(w => isEindtest(w.week, plan.tijdshorizon_weken)).map(w => w.week)).toEqual([10])

    voegExtraWeekToe(plan, 3)

    expect(plan.tijdshorizon_weken).toBe(11)
    expect(plan.kader.filter(w => isEindtest(w.week, plan.tijdshorizon_weken)).map(w => w.week)).toEqual([11])
    expect(plan.kader[plan.kader.length - 1].week).toBe(11)
  })
})

describe('verwijderSessiesVanafWeek', () => {
  const startdatum = '2026-01-05' // maandag

  function datumVoorWeek(n) {
    const maandag = new Date(startdatum)
    maandag.setDate(maandag.getDate() + (n - 1) * 7)
    return `${maandag.getFullYear()}-${String(maandag.getMonth() + 1).padStart(2, '0')}-${String(maandag.getDate()).padStart(2, '0')}`
  }

  it('verwijdert niet-voltooide sessies op/na vanafWeek, laat sessies vóór vanafWeek en voltooide sessies ongemoeid', () => {
    const plan = {
      startdatum,
      weekSessies: {
        sessies: [
          { datum: datumVoorWeek(3), voltooid: false, intervalsEventId: 'evt-3' },  // vóór vanafWeek(4) -> blijft
          { datum: datumVoorWeek(4), voltooid: true, intervalsEventId: 'evt-4' },   // op vanafWeek, maar voltooid -> blijft
          { datum: datumVoorWeek(5), voltooid: false, intervalsEventId: 'evt-5' },  // ná vanafWeek -> verwijderd
          { datum: datumVoorWeek(6), voltooid: false, intervalsEventId: null },     // ná vanafWeek, geen event-id -> verwijderd (uit sessies), geen intervalsEventId om op te ruimen
        ],
      },
    }

    const resultaat = verwijderSessiesVanafWeek(plan, 4)

    expect(resultaat.verwijderd.sort()).toEqual([datumVoorWeek(5), datumVoorWeek(6)].sort())
    expect(resultaat.intervalsEventIds).toEqual(['evt-5'])
    const overgeblevenDatums = plan.weekSessies.sessies.map(s => s.datum)
    expect(overgeblevenDatums).toContain(datumVoorWeek(3))
    expect(overgeblevenDatums).toContain(datumVoorWeek(4)) // voltooid, blijft ondanks week >= vanafWeek
    expect(overgeblevenDatums).not.toContain(datumVoorWeek(5))
    expect(overgeblevenDatums).not.toContain(datumVoorWeek(6))
  })

  it('is een harmless no-op zonder sessies of zonder startdatum', () => {
    expect(verwijderSessiesVanafWeek({ weekSessies: { sessies: [] }, startdatum }, 4)).toEqual({ verwijderd: [], intervalsEventIds: [] })
    expect(verwijderSessiesVanafWeek({ weekSessies: { sessies: [{ datum: datumVoorWeek(5), voltooid: false }] } }, 4)).toEqual({ verwijderd: [], intervalsEventIds: [] })
    expect(verwijderSessiesVanafWeek({}, 4)).toEqual({ verwijderd: [], intervalsEventIds: [] })
  })
})
