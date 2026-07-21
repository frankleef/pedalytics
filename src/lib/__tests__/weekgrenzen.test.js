import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { faseStartdatum, haalFaseGebondenTeller, hoogFaseGebondenTellerOp } from '../weekgrenzen.js'

// startdatum ma 2026-05-25 -> week1=05-25..05-31 (basis), week2=06-01..06-07 (basis),
// week3=06-08..06-14 (basis), week4=06-15..06-21 (test), week5=06-22..06-28 (sweetspot)
const STARTDATUM = '2026-05-25'
const KADER = [
  { week: 1, fase: 'basis', tss_doel: 240 },
  { week: 2, fase: 'basis', tss_doel: 250 },
  { week: 3, fase: 'basis', tss_doel: 260 },
  { week: 4, fase: 'test', tss_doel: 180 },
  { week: 5, fase: 'sweetspot', tss_doel: 280 },
  { week: 6, fase: 'sweetspot', tss_doel: 290 },
]

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

afterEach(() => {
  vi.useRealTimers()
})

describe('faseStartdatum', () => {
  it('geeft de maandag van de EERSTE week van de huidige fase (niet de week van vandaag zelf)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T10:00:00')) // valt in week 5 (sweetspot), niet de eerste sweetspot-week per se
    const plan = { kader: KADER, startdatum: STARTDATUM }

    const resultaat = faseStartdatum(plan)

    expect(iso(resultaat)).toBe('2026-06-22') // maandag van week 5, de eerste sweetspot-week
  })

  it('als vandaag al in de eerste week van de fase valt, is faseStartdatum die week zelf', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T10:00:00')) // week 3, nog steeds fase 'basis' (start: week 1)
    const plan = { kader: KADER, startdatum: STARTDATUM }

    const resultaat = faseStartdatum(plan)

    expect(iso(resultaat)).toBe('2026-05-25') // maandag van week 1, de eerste basis-week
  })

  it('fail-open: null zonder plan.kader', () => {
    expect(faseStartdatum({ startdatum: STARTDATUM })).toBeNull()
    expect(faseStartdatum({ kader: [], startdatum: STARTDATUM })).toBeNull()
  })

  it('fail-open: null zonder plan.startdatum', () => {
    expect(faseStartdatum({ kader: KADER })).toBeNull()
  })

  it('fail-open: null zonder plan', () => {
    expect(faseStartdatum(null)).toBeNull()
    expect(faseStartdatum(undefined)).toBeNull()
  })
})

// FIX 2 (per-fase reset van fase_verlengd_count / compliance_verlengd_count):
// haalFaseGebondenTeller / hoogFaseGebondenTellerOp, cron/sync/route.js:701,721,738,742
describe('haalFaseGebondenTeller / hoogFaseGebondenTellerOp', () => {
  it('test 3: teller blijft behouden en incrementeert normaal zolang faseStartdatum ongewijzigd is (zelfde fase); wordt 0 zodra de fase wisselt, ondanks een hoge oude waarde', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T10:00:00')) // week 2, fase 'basis' (start 2026-05-25)
    const plan = { kader: KADER, startdatum: STARTDATUM }

    hoogFaseGebondenTellerOp(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')
    hoogFaseGebondenTellerOp(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')
    hoogFaseGebondenTellerOp(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')

    expect(plan.fase_verlengd_count).toBe(3)
    expect(plan.fase_verlengd_count_faseAnker).toBe('2026-05-25')
    expect(haalFaseGebondenTeller(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')).toBe(3)

    // Fase wisselt naar sweetspot (week 5, start 2026-06-22) -> oude waarde (3) telt niet meer mee.
    vi.setSystemTime(new Date('2026-06-24T10:00:00'))
    expect(haalFaseGebondenTeller(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')).toBe(0)

    hoogFaseGebondenTellerOp(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')
    expect(plan.fase_verlengd_count).toBe(1) // 0 + 1, niet 3 + 1
    expect(plan.fase_verlengd_count_faseAnker).toBe('2026-06-22')
  })

  it('test 4: migratie — bestaande hoge teller zonder ankerveld wordt bij de eerste evaluatie behandeld als 0', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T10:00:00')) // week 2, fase 'basis'
    const plan = { kader: KADER, startdatum: STARTDATUM, fase_verlengd_count: 5 } // geen fase_verlengd_count_faseAnker

    expect(haalFaseGebondenTeller(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')).toBe(0)

    hoogFaseGebondenTellerOp(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')
    expect(plan.fase_verlengd_count).toBe(1) // 0 + 1, niet 5 + 1
    expect(plan.fase_verlengd_count_faseAnker).toBe('2026-05-25')
  })

  it('test 6: hoogFaseGebondenTellerOp crasht niet als faseStartdatum(plan) === null op het moment van ophogen, en laat een consistente staat achter', () => {
    // plan.kader = [] -> faseStartdatum() geeft null (fail-open pad), maar het
    // omringende cron/sync-blok (if (plan.kader)) zou dit wél binnengaan omdat
    // een lege array truthy is.
    const plan = { kader: [], startdatum: STARTDATUM, fase_verlengd_count: 2 }

    expect(() => hoogFaseGebondenTellerOp(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')).not.toThrow()
    expect(plan.fase_verlengd_count).toBe(3) // rauwe waarde +1, geen reset mogelijk zonder anker
    expect(plan.fase_verlengd_count_faseAnker).toBeUndefined() // bewust niet aangeraakt

    // Consistent met de volgende leesactie zolang faseStartdatum null blijft.
    expect(haalFaseGebondenTeller(plan, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')).toBe(3)

    // Stale ankerveld van vóór een eerdere geldige fase blijft ongemoeid tijdens de null-episode...
    const planMetStaleAnker = { kader: [], startdatum: STARTDATUM, fase_verlengd_count: 2, fase_verlengd_count_faseAnker: '2026-01-01' }
    hoogFaseGebondenTellerOp(planMetStaleAnker, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')
    expect(planMetStaleAnker.fase_verlengd_count).toBe(3)
    expect(planMetStaleAnker.fase_verlengd_count_faseAnker).toBe('2026-01-01') // ongewijzigd

    // ...en zodra faseStartdatum weer geldig wordt, telt die stale waarde als mismatch -> reset naar 0.
    planMetStaleAnker.kader = KADER
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T10:00:00')) // week 2, fase 'basis', start 2026-05-25
    expect(haalFaseGebondenTeller(planMetStaleAnker, 'fase_verlengd_count', 'fase_verlengd_count_faseAnker')).toBe(0)
  })

  // Test 6 (cron/sync-plan "gedeelde fase-gebonden guard tegen dubbele
  // voegExtraWeekToe-invoeging"): opbouwweek_verlengd_count/-faseAnker
  // hergebruikt dezelfde infrastructuur ONGEWIJZIGD (generiek op veldnaam) —
  // dit bevestigt dat een nieuwe fase de guard weer opheft, ondanks dat de
  // guard in de vorige fase al gezet was.
  it('test 6: gedeelde guard (opbouwweek_verlengd_count) reset bij een nieuwe fase, ondanks dat de guard in de vorige fase al gezet was', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T10:00:00')) // week 2, fase 'basis' (start 2026-05-25)
    const plan = { kader: KADER, startdatum: STARTDATUM }

    hoogFaseGebondenTellerOp(plan, 'opbouwweek_verlengd_count', 'opbouwweek_verlengd_count_faseAnker')
    expect(plan.opbouwweek_verlengd_count).toBe(1)
    expect(haalFaseGebondenTeller(plan, 'opbouwweek_verlengd_count', 'opbouwweek_verlengd_count_faseAnker')).toBeGreaterThan(0) // "al verlengd deze fase"

    // Fase wisselt naar sweetspot (week 5, start 2026-06-22) -> guard is weer "niet gezet".
    vi.setSystemTime(new Date('2026-06-24T10:00:00'))
    expect(haalFaseGebondenTeller(plan, 'opbouwweek_verlengd_count', 'opbouwweek_verlengd_count_faseAnker')).toBe(0)

    hoogFaseGebondenTellerOp(plan, 'opbouwweek_verlengd_count', 'opbouwweek_verlengd_count_faseAnker')
    expect(plan.opbouwweek_verlengd_count).toBe(1) // 0 + 1, niet 1 + 1 -> een verlenging is weer mogelijk
    expect(plan.opbouwweek_verlengd_count_faseAnker).toBe('2026-06-22')
  })
})
