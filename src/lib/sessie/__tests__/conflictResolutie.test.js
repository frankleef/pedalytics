import { describe, it, expect } from 'vitest'
import { detecteerWeekConflicten, degradeerSessie, corrigeerWeekBudget, normaliseerVoor48uCheck } from '../conflictResolutie.js'
import { ARCHETYPES_FIXTURE } from '../../__tests__/fixtures/archetypesFixture.js'

describe('detecteerWeekConflicten', () => {
  const kaderWeek = { tss_doel: 300 }

  it('detecteert een 48u-conflict tussen twee zware sessies, alleen als de latere gewijzigd is', () => {
    const sessies = [
      { datum: '2026-07-06', type: 'sweetspot', tss: 90 },
      { datum: '2026-07-07', type: 'drempel', tss: 85 }, // 24u later, binnen 48u
    ]
    const resultaat = detecteerWeekConflicten(sessies, kaderWeek, ['2026-07-07'])
    expect(resultaat.conflictDatums).toContain('2026-07-07')
  })

  it('geen conflict als de latere zware dag niet in gewijzigdeDatums zit', () => {
    const sessies = [
      { datum: '2026-07-06', type: 'sweetspot', tss: 90 },
      { datum: '2026-07-07', type: 'drempel', tss: 85 },
    ]
    const resultaat = detecteerWeekConflicten(sessies, kaderWeek, ['2026-07-06'])
    expect(resultaat.conflictDatums).toEqual([])
  })

  it('geen conflict bij twee zware sessies buiten 48u van elkaar', () => {
    const sessies = [
      { datum: '2026-07-06', type: 'sweetspot', tss: 90 },
      { datum: '2026-07-09', type: 'drempel', tss: 85 }, // 3 dagen later
    ]
    const resultaat = detecteerWeekConflicten(sessies, kaderWeek, ['2026-07-09'])
    expect(resultaat.conflictDatums).toEqual([])
  })

  it('detecteert een budget-conflict (>15% boven tss_doel) en wijst de zwaarste gewijzigde, niet-voltooide dag aan', () => {
    const sessies = [
      { datum: '2026-07-06', type: 'duur_variabel', tss: 200, voltooid: false },
      { datum: '2026-07-07', type: 'sweetspot', tss: 160, voltooid: false },
    ]
    // totaal 360, doel 300 * 1.15 = 345 -> overschreden
    const resultaat = detecteerWeekConflicten(sessies, kaderWeek, ['2026-07-06', '2026-07-07'])
    expect(resultaat.budgetConflictDatum).toBe('2026-07-06') // hoogste TSS (200)
    expect(resultaat.conflictDatums).toContain('2026-07-06')
  })

  it('geen budget-conflict binnen de 15%-marge', () => {
    const sessies = [
      { datum: '2026-07-06', type: 'duur_variabel', tss: 170, voltooid: false },
      { datum: '2026-07-07', type: 'sweetspot', tss: 160, voltooid: false },
    ]
    // totaal 330, doel 300 * 1.15 = 345 -> binnen marge
    const resultaat = detecteerWeekConflicten(sessies, kaderWeek, ['2026-07-06', '2026-07-07'])
    expect(resultaat.budgetConflictDatum).toBeNull()
  })
})

describe('degradeerSessie', () => {
  it('degradeert naar de lichtste variant van hetzelfde archetype, zelfde duur', () => {
    const sessie = {
      datum: '2026-07-07',
      type: 'sweetspot',
      intentie: { sessietype: 'sweetspot_intervallen', rol: 'intensiteitsdag' },
      archetype_id: 'ss_standaard',
      variant_id: 'ss_std_3x20', // gewicht 2, niet de lichtste
      duur_min: 90,
    }
    const resultaat = degradeerSessie(ARCHETYPES_FIXTURE, sessie, 265)
    expect(resultaat).not.toBeNull()
    expect(resultaat.archetype_id).toBe('ss_standaard')
    expect(resultaat.variant_id).toBe('ss_std_3x15') // gewicht 1, de lichtste
    expect(resultaat.duur_min).toBe(90) // zelfde duur, alleen lichter
    expect(resultaat.datum).toBe('2026-07-07')
  })

  it('retourneert null als de sessie al de lichtste variant heeft', () => {
    const sessie = {
      datum: '2026-07-07',
      intentie: { sessietype: 'sweetspot_intervallen' },
      archetype_id: 'ss_standaard',
      variant_id: 'ss_std_3x15', // al de lichtste
      duur_min: 90,
    }
    expect(degradeerSessie(ARCHETYPES_FIXTURE, sessie, 265)).toBeNull()
  })

  it('retourneert null zonder archetype_id (kan niet degraderen)', () => {
    const sessie = { datum: '2026-07-07', intentie: { sessietype: 'sweetspot_intervallen' }, duur_min: 90 }
    expect(degradeerSessie(ARCHETYPES_FIXTURE, sessie, 265)).toBeNull()
  })

  it('retourneert null voor een onbekend archetype_id', () => {
    const sessie = { datum: '2026-07-07', intentie: { sessietype: 'sweetspot_intervallen' }, archetype_id: 'bestaat_niet', duur_min: 90 }
    expect(degradeerSessie(ARCHETYPES_FIXTURE, sessie, 265)).toBeNull()
  })
})

describe('corrigeerWeekBudget', () => {
  it('kort Z2-dagen proportioneel, laat kernstimulus/secundair-dagen ongemoeid', () => {
    const sessies = [
      { datum: '2026-07-06', intentie: { sessietype: 'sweetspot_intervallen' }, tss: 90, duur_min: 120, segmenten: [{ zone: 'Z3', blokDuurSeconden: 7200 }] },
      { datum: '2026-07-08', intentie: { sessietype: 'z2_duur' }, tss: 100, duur_min: 180, segmenten: [{ zone: 'Z2', blokDuurSeconden: 10800 }] },
      { datum: '2026-07-10', intentie: { sessietype: 'z2_duur' }, tss: 60, duur_min: 90, segmenten: [{ zone: 'Z2', blokDuurSeconden: 5400 }] },
    ]
    // totaal 250, cap 200 -> 50 TSS te veel, alleen de Z2-dagen (160 TSS samen) mogen korten.
    // De langste rit (180min/100TSS) blijft de laatst gekorte — hier is de kortste
    // Z2-dag (90min/60TSS) al genoeg om het tekort te dekken, dus die wordt gekort/
    // geschrapt en de langste rit blijft ongewijzigd (zelfde volgorde als pasBudgetToe).
    const resultaat = corrigeerWeekBudget(sessies, 200)
    const kernstimulus = resultaat.find(r => r.datum === '2026-07-06')
    expect(kernstimulus.actie).toBe('ongewijzigd')
    const langsteRit = resultaat.find(r => r.datum === '2026-07-08')
    expect(langsteRit.actie).toBe('ongewijzigd')
    const kortsteZ2 = resultaat.find(r => r.datum === '2026-07-10')
    expect(['gekort', 'verwijderd']).toContain(kortsteZ2.actie)
  })

  it('markeert een Z2-dag als verwijderd als die onder de minimumduur zou zakken', () => {
    const sessies = [
      { datum: '2026-07-06', intentie: { sessietype: 'sweetspot_intervallen' }, tss: 90, duur_min: 120, segmenten: [{ zone: 'Z3', blokDuurSeconden: 7200 }] },
      { datum: '2026-07-08', intentie: { sessietype: 'z2_duur' }, tss: 100, duur_min: 180, segmenten: [{ zone: 'Z2', blokDuurSeconden: 10800 }] },
      { datum: '2026-07-10', intentie: { sessietype: 'z2_duur' }, tss: 40, duur_min: 70, segmenten: [{ zone: 'Z2', blokDuurSeconden: 4200 }] },
    ]
    // cap zeer krap -> de kortste Z2-dag moet volledig geschrapt worden
    const resultaat = corrigeerWeekBudget(sessies, 120)
    const kortsteZ2 = resultaat.find(r => r.datum === '2026-07-10')
    expect(kortsteZ2.actie).toBe('verwijderd')
    expect(kortsteZ2.sessie).toBeNull()
  })

  it('laat alles ongewijzigd als het budget al ruim voldoende is', () => {
    const sessies = [
      { datum: '2026-07-06', intentie: { sessietype: 'z2_duur' }, tss: 60, duur_min: 90, segmenten: [{ zone: 'Z2', blokDuurSeconden: 5400 }] },
    ]
    const resultaat = corrigeerWeekBudget(sessies, 300)
    expect(resultaat[0].actie).toBe('ongewijzigd')
  })
})

describe('normaliseerVoor48uCheck — mapping-adapter (Fix 3a), dekt elke legacy-typenaam uit dit bestand', () => {
  it('sweetspot -> sweetspot_intervallen', () => {
    expect(normaliseerVoor48uCheck({ type: 'sweetspot' }).intentie.sessietype).toBe('sweetspot_intervallen')
  })

  it('drempel -> drempel_intervallen', () => {
    expect(normaliseerVoor48uCheck({ type: 'drempel' }).intentie.sessietype).toBe('drempel_intervallen')
  })

  it('vo2max -> vo2max_intervallen', () => {
    expect(normaliseerVoor48uCheck({ type: 'vo2max' }).intentie.sessietype).toBe('vo2max_intervallen')
  })

  it('sprint_neuraal -> sprint_neuraal (identiek, behoudt eigen naam)', () => {
    expect(normaliseerVoor48uCheck({ type: 'sprint_neuraal' }).intentie.sessietype).toBe('sprint_neuraal')
  })

  it('kracht_lage_cadans -> kracht_lage_cadans (identiek, behoudt eigen naam)', () => {
    expect(normaliseerVoor48uCheck({ type: 'kracht_lage_cadans' }).intentie.sessietype).toBe('kracht_lage_cadans')
  })

  it('interval -> GEEN mapping gevonden (bevestigd via brede grep) -> null, geen crash', () => {
    // Dit is het enige niet-neutrale randgeval van Fix 3a: "interval" stond in
    // de oude ZWARE_TYPES-lijst maar heeft geen vindbare moderne tegenhanger.
    // Een sessie met alleen s.type==="interval" (geen s.intentie.sessietype)
    // wordt na normalisatie dus niet meer als zware sessie herkend.
    expect(normaliseerVoor48uCheck({ type: 'interval' }).intentie.sessietype).toBeNull()
  })

  it('een al-aanwezige s.intentie.sessietype krijgt voorrang boven de legacy-vertaling van s.type', () => {
    const sessie = { type: 'sweetspot', intentie: { sessietype: 'sweetspot_intervallen', rol: 'intensiteitsdag' } }
    const genormaliseerd = normaliseerVoor48uCheck(sessie)
    expect(genormaliseerd.intentie.sessietype).toBe('sweetspot_intervallen')
    expect(genormaliseerd.intentie.rol).toBe('intensiteitsdag') // overige intentie-velden blijven behouden
  })
})
