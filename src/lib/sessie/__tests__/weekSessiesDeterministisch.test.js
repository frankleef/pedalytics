import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/sessie/context', () => ({
  bepaalAlGeleverd: vi.fn(),
  haalWellnessVoorDatum: vi.fn(),
}))
// Blok A: standaard fail-open (null -> geen trigger), zelfde als de bestaande
// tests vandaag al impliciet kregen via ontbrekende intervals.icu-credentials
// in de kv-mock — expliciet gemockt i.p.v. via die impliciete route, zodat de
// monotonie-triggerende test hieronder het gedrag gericht kan overschrijven.
vi.mock('@/lib/sessie/monotonieStrain', () => ({
  haalDagelijkseTssReeks: vi.fn(),
  berekenMonotonieEnStrain: vi.fn(),
}))
vi.mock('@/lib/meldingen', () => ({ maakMelding: vi.fn(async () => {}) }))

import { getKV } from '@/lib/kv'
import { bepaalAlGeleverd, haalWellnessVoorDatum } from '@/lib/sessie/context'
import { haalDagelijkseTssReeks, berekenMonotonieEnStrain } from '@/lib/sessie/monotonieStrain'
import { maakMelding } from '@/lib/meldingen'
import { _wisArchetypeCacheVoorTests } from '@/lib/sessie-archetypes'
import { ARCHETYPES_FIXTURE } from '@/lib/__tests__/fixtures/archetypesFixture.js'
import { genereerWeekSessiesDeterministisch } from '../weekSessiesDeterministisch.js'
import { probeerHerschikking } from '../herschikking.js'
import * as herschikkingModule from '../herschikking.js'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    mget: vi.fn(async (...ks) => ks.map(k => store.get(k) ?? null)),
  }
}

// Zelfde basisopzet als sessiesAanvullen.rampTest.test.js: aerobe_basis +
// basisfase houdt de niet-ramp_test-dagen voorspelbaar op het z2_duur-pad
// (geen kernstimulus/secundair-split, kracht_lage_cadans hard uitgesloten),
// zodat de tests zich richten op dagselectie/venster-gedrag i.p.v. op de rest
// van de deterministische generatiepijplijn.
const STARTDATUM = '2026-01-05' // maandag

function bouwSeizoensplan(overrides = {}) {
  const kader = []
  for (let week = 1; week <= 4; week++) {
    kader.push({
      week, fase: 'basis', weektype: 'opbouw', tss_doel: 200,
      ...(week === 3 ? { bevat_tussentijdse_ftp_test: true } : {}),
    })
  }
  return {
    kader,
    startdatum: STARTDATUM,
    huidige_ctl: 45,
    huidige_ftp: 265,
    seizoensdoel: { type: 'aerobe_basis' },
    ...overrides,
  }
}

let kv
beforeEach(() => {
  _wisArchetypeCacheVoorTests()
  const kvSeed = { 'archetypes:z2_duur': ARCHETYPES_FIXTURE.z2_duur }
  kv = maakKvMock(kvSeed)
  vi.mocked(getKV).mockReturnValue(kv)
  vi.mocked(bepaalAlGeleverd).mockResolvedValue({ tss: 0 })
  vi.mocked(haalWellnessVoorDatum).mockResolvedValue(null)
  vi.mocked(haalDagelijkseTssReeks).mockReset().mockResolvedValue(null)
  vi.mocked(berekenMonotonieEnStrain).mockReset().mockReturnValue({ trigger: false })
  vi.mocked(maakMelding).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const profiel = { ftp: 265, lt_hr: 184, max_hr: 200, gewicht: 80 }

describe('genereerWeekSessiesDeterministisch', () => {
  it('retourneert null als er geen beschikbare/onvoltooide dag in het 7-dagenvenster valt', async () => {
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: null, seizoensplan: bouwSeizoensplan(), weekSessies: null,
      urenPerDag: {}, beschikbareDagen: [], voortgang: null,
    })
    expect(resultaat).toBeNull()
  })

  it('plant maximaal maxTrainingsdagenPerWeek(ctl) dagen, met een min-1-rustdag-tussen-4-op-een-rij-gate', async () => {
    // Alle 7 dagen beschikbaar, venster = ma 2026-01-05 t/m zo 2026-01-11 (één ISO-week).
    // ctl 45 -> maxTrainingsdagenPerWeek = 4.
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
    const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))

    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSeizoensplan(), weekSessies: null,
      urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
    })

    expect(resultaat).not.toBeNull()
    expect(resultaat.sessies).toHaveLength(4)
    const datums = resultaat.sessies.map(s => s.datum).sort()
    // do (01-08) valt weg door de 4-op-een-rij-gate na ma/di/wo; za/zo vallen
    // weg omdat de frequentiecap (4) al bereikt is na vr.
    expect(datums).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-09'])
    for (const s of resultaat.sessies) {
      expect(s.intentie?.sessietype).toBe('z2_duur')
      expect(s.datum).toBeDefined()
    }
    expect(resultaat.tss_totaal).toBeGreaterThan(0)
  })

  it('regenereert een dag die al een sessie heeft (silent RPE-herplanning), niet alleen ontbrekende dagen', async () => {
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const bestaandeSessie = {
      datum: '2026-01-05', dag: 'Maandag', type: 'duur_variabel', titel: 'Oude sessie',
      tss: 999, duur_min: 999, intentie: { sessietype: 'z2_duur', tss_doel: 999 },
    }
    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: null, seizoensplan: bouwSeizoensplan(), weekSessies: { sessies: [bestaandeSessie] },
      urenPerDag: { Maandag: 1.5 }, beschikbareDagen: ['Maandag'], voortgang: null,
    })

    expect(resultaat.sessies).toHaveLength(1)
    const nieuw = resultaat.sessies[0]
    expect(nieuw.datum).toBe('2026-01-05')
    expect(nieuw.titel).not.toBe('Oude sessie')
    expect(nieuw.tss).not.toBe(999)
  })

  it('slaat een dag over als de rit die dag al voltooid is (voortgang.ritten matcht)', async () => {
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const bestaandeSessie = { datum: '2026-01-05', dag: 'Maandag', type: 'duur_variabel', tss: 50, duur_min: 60 }
    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: null, seizoensplan: bouwSeizoensplan(), weekSessies: { sessies: [bestaandeSessie] },
      urenPerDag: { Maandag: 1.5 }, beschikbareDagen: ['Maandag'],
      voortgang: { ritten: [{ datum_iso: '2026-01-05' }] },
    })
    // "vandaag" is 2026-01-05 zelf -> voltooid-check vereist datum < vandaag,
    // dus deze rit telt nog niet als voltooid en de dag wordt gewoon gepland.
    expect(resultaat.sessies).toHaveLength(1)
  })

  it('slaat dagen binnen een actieve afwezigheidsperiode over, ook als ze verder beschikbaar/onvoltooid zijn', async () => {
    vi.setSystemTime(new Date('2026-01-05T08:00:00'))
    const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
    const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))
    kv.store.set('u_test:afwezigheid', [
      { periodeId: 'p1', startDatum: '2026-01-06', eindDatum: '2026-01-08', reden: 'ziek', status: 'actief' },
    ])

    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSeizoensplan(), weekSessies: null,
      urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
    })

    const datums = resultaat.sessies.map(s => s.datum)
    expect(datums).not.toContain('2026-01-06')
    expect(datums).not.toContain('2026-01-07')
    expect(datums).not.toContain('2026-01-08')
    expect(resultaat.sessies.length).toBeGreaterThan(0) // overige dagen worden gewoon gevuld
  })

  it('forceert de laatste trainingsdag van een bevat_tussentijdse_ftp_test-week naar ramp_test', async () => {
    // Venster ma 2026-01-19 t/m zo 2026-01-25 = week 3 (bevat_tussentijdse_ftp_test).
    vi.setSystemTime(new Date('2026-01-19T08:00:00'))
    const beschikbareDagen = ['Maandag', 'Woensdag', 'Vrijdag']
    const urenPerDag = { Maandag: 1.5, Woensdag: 1.5, Vrijdag: 1.5 }

    const resultaat = await genereerWeekSessiesDeterministisch({
      kv, userId: 'u_test', profiel,
      wellness: null, seizoensplan: bouwSeizoensplan(), weekSessies: null,
      urenPerDag, beschikbareDagen, voortgang: null,
    })

    expect(resultaat.sessies.map(s => s.datum).sort()).toEqual(['2026-01-19', '2026-01-21', '2026-01-23'])
    const rampTestDag = resultaat.sessies.find(s => s.datum === '2026-01-23')
    expect(rampTestDag.intentie.rol).toBe('ftp_test')
    expect(rampTestDag.intentie.sessietype).toBe('ramp_test')
    expect(rampTestDag.protocol).toBeDefined()

    const overigeDagen = resultaat.sessies.filter(s => s.datum !== '2026-01-23')
    expect(overigeDagen).toHaveLength(2)
    for (const dag of overigeDagen) {
      expect(dag.intentie?.sessietype).not.toBe('ramp_test')
    }
  })

  describe('B5: beschermd_herschikking bij doelGewicht 1 (genereren.js)', () => {
    it('markeert een dag met een zwaar-negatieve TSB (doelGewicht 1) als beschermd_herschikking', async () => {
      vi.setSystemTime(new Date('2026-01-05T08:00:00'))
      vi.mocked(haalWellnessVoorDatum).mockResolvedValue({ ctl: 40, atl: 70, hrv: null }) // tsb = -30 -> doelGewicht 1

      const resultaat = await genereerWeekSessiesDeterministisch({
        kv, userId: 'u_test', profiel,
        wellness: { ctl: 40, atl: 70 }, seizoensplan: bouwSeizoensplan(), weekSessies: null,
        urenPerDag: { Woensdag: 1.5 }, beschikbareDagen: ['Woensdag'], voortgang: null,
      })

      expect(resultaat.sessies).toHaveLength(1)
      expect(resultaat.sessies[0].variant_gewicht).toBe(1)
      expect(resultaat.sessies[0].beschermd_herschikking).toBe(true)
    })

    it('geen beschermd_herschikking-markering bij een neutrale TSB (doelGewicht 2)', async () => {
      vi.setSystemTime(new Date('2026-01-05T08:00:00'))
      vi.mocked(haalWellnessVoorDatum).mockResolvedValue({ ctl: 45, atl: 45, hrv: null }) // tsb = 0 -> doelGewicht 2

      const resultaat = await genereerWeekSessiesDeterministisch({
        kv, userId: 'u_test', profiel,
        wellness: { ctl: 45, atl: 45 }, seizoensplan: bouwSeizoensplan(), weekSessies: null,
        urenPerDag: { Woensdag: 1.5 }, beschikbareDagen: ['Woensdag'], voortgang: null,
      })

      expect(resultaat.sessies).toHaveLength(1)
      expect(resultaat.sessies[0].variant_gewicht).toBe(2)
      expect(resultaat.sessies[0].beschermd_herschikking).toBeUndefined()
    })
  })

  describe('Blok A: monotonie/strain-degradatie', () => {
    // ftp/sweetspot heeft, i.t.t. bouwSeizoensplan()'s aerobe_basis-fixture
    // (altijd fase 'basis', geen kernstimulus), wél een kernstimulus-kandidaat
    // (sweetspot_intervallen) — nodig om de degradatie daadwerkelijk te kunnen
    // waarnemen op een niet-z2-toewijzing.
    function bouwSweetspotPlan() {
      return {
        kader: [{ week: 1, fase: 'sweetspot', weektype: 'opbouw', tss_doel: 300 }],
        startdatum: STARTDATUM,
        huidige_ctl: 45,
        huidige_ftp: 265,
        seizoensdoel: { type: 'ftp' },
      }
    }

    it('degradeert de kernstimulus-dag naar z2_duur bij trigger, en verstuurt de monotonie_degradatie-melding', async () => {
      kv.store.set('archetypes:sweetspot_intervallen', ARCHETYPES_FIXTURE.sweetspot_intervallen)
      vi.mocked(haalDagelijkseTssReeks).mockResolvedValue([50, 50, 50, 50, 50, 50, 50])
      vi.mocked(berekenMonotonieEnStrain).mockReturnValue({ gemiddelde: 50, standaarddeviatie: 0, monotonie: Infinity, strain: Infinity, trigger: true })

      vi.setSystemTime(new Date('2026-01-05T08:00:00'))
      const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
      const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))

      const resultaat = await genereerWeekSessiesDeterministisch({
        kv, userId: 'u_test', profiel,
        wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSweetspotPlan(), weekSessies: null,
        urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
      })

      expect(maakMelding).toHaveBeenCalledTimes(1)
      expect(maakMelding).toHaveBeenCalledWith('u_test', 'monotonie_degradatie', expect.objectContaining({ monotonie: Infinity }))

      const sessietypes = resultaat.sessies.map(s => s.intentie?.sessietype)
      expect(sessietypes).not.toContain('sweetspot_intervallen') // gedegradeerd, dus niet meer aanwezig
      expect(sessietypes.every(t => t === 'z2_duur')).toBe(true) // alle dagen zijn nu z2_duur

      // B5-correctie: monotonie-degradatie triggert GEEN herschikkingspoging
      // meer — de gedegradeerde dag blijft simpelweg staan zoals gegenereerd,
      // geen enkele dag krijgt verplaatst_van/verplaatst_naar toegewezen.
      for (const s of resultaat.sessies) {
        expect(s.verplaatst_van).toBeUndefined()
        expect(s.verplaatst_naar).toBeUndefined()
      }

      // De gedegradeerde dag zelf is wél nog steeds beschermd_herschikking —
      // niet om zelf een reflow te triggeren, maar om een latere, aparte
      // B1-herschikking uit te sluiten van deze dag als doelwit (zie de
      // STAP F-test hieronder).
      const gedegradeerdeDatum = vi.mocked(maakMelding).mock.calls[0][2].datum
      const gedegradeerdeDag = resultaat.sessies.find(s => s.datum === gedegradeerdeDatum)
      expect(gedegradeerdeDag.beschermd_herschikking).toBe(true)
    })

    it('B5-correctie (regressietest): monotonie-trigger roept probeerHerschikking NIET aan — B1 blijft de enige trigger', async () => {
      const herschikkingSpy = vi.spyOn(herschikkingModule, 'probeerHerschikking')

      kv.store.set('archetypes:sweetspot_intervallen', ARCHETYPES_FIXTURE.sweetspot_intervallen)
      vi.mocked(haalDagelijkseTssReeks).mockResolvedValue([50, 50, 50, 50, 50, 50, 50])
      vi.mocked(berekenMonotonieEnStrain).mockReturnValue({ gemiddelde: 50, standaarddeviatie: 0, monotonie: Infinity, strain: Infinity, trigger: true })

      vi.setSystemTime(new Date('2026-01-05T08:00:00'))
      const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
      const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))

      await genereerWeekSessiesDeterministisch({
        kv, userId: 'u_test', profiel,
        wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSweetspotPlan(), weekSessies: null,
        urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
      })

      expect(maakMelding).toHaveBeenCalledWith('u_test', 'monotonie_degradatie', expect.anything()) // degradatie vond wel degelijk plaats
      expect(herschikkingSpy).not.toHaveBeenCalled() // maar triggerde GEEN herschikkingspoging

      herschikkingSpy.mockRestore()
    })

    it('STAP F: een door monotonie gedegradeerde (en dus beschermd_herschikking) dag wordt nooit als kandidaat gekozen voor een latere, aparte B1-herschikking diezelfde week', async () => {
      kv.store.set('archetypes:sweetspot_intervallen', ARCHETYPES_FIXTURE.sweetspot_intervallen)
      kv.store.set('archetypes:drempel_intervallen', ARCHETYPES_FIXTURE.drempel_intervallen)
      vi.mocked(haalDagelijkseTssReeks).mockResolvedValue([50, 50, 50, 50, 50, 50, 50])
      vi.mocked(berekenMonotonieEnStrain).mockReturnValue({ gemiddelde: 50, standaarddeviatie: 0, monotonie: Infinity, strain: Infinity, trigger: true })

      vi.setSystemTime(new Date('2026-01-05T08:00:00'))
      const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
      const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))

      const resultaat = await genereerWeekSessiesDeterministisch({
        kv, userId: 'u_test', profiel,
        wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSweetspotPlan(), weekSessies: null,
        urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
      })

      const gedegradeerdeDatum = vi.mocked(maakMelding).mock.calls[0][2].datum
      const gedegradeerdeDag = resultaat.sessies.find(s => s.datum === gedegradeerdeDatum)
      expect(gedegradeerdeDag.beschermd_herschikking).toBe(true) // door verlaagBijHogeMonotonie gezet (weekSolver.js)

      // Simuleert een SEPARATE, latere B1-gebeurtenis (bv. hrv/verwerking.js's
      // verwerkSchrappen) die diezelfde week een ANDER kernsessie-verlies
      // probeert te herschikken — bouwt hiervoor verder op het echte,
      // al-gegenereerde weekresultaat i.p.v. een geïsoleerde fixture, zodat
      // dit de daadwerkelijke eind-tot-eind-samenwerking tussen Blok A en B1 toetst.
      const simulatiePlan = {
        kader: bouwSweetspotPlan().kader, startdatum: STARTDATUM, huidige_ftp: 265,
        seizoensdoel: { type: 'ftp' }, urenPerDag,
        weekSessies: { sessies: resultaat.sessies.map(s => ({ ...s })) },
      }
      // Kies de VROEGSTE dag die niet de gedegradeerde dag zelf is en niet al
      // de herschikte kernstimulus draagt, als bron van het gesimuleerde
      // B1-verlies — vroegst, zodat er nog dagen ná deze bron overblijven
      // binnen de week om als herschikkingskandidaat te dienen.
      const anderKernsessieDag = simulatiePlan.weekSessies.sessies
        .filter(s => s.datum !== gedegradeerdeDatum && s.intentie?.sessietype === 'z2_duur')
        .sort((a, b) => a.datum.localeCompare(b.datum))[0]
      const b1Resultaat = await probeerHerschikking('u_test', simulatiePlan, anderKernsessieDag.datum, 'drempel_intervallen')

      expect(b1Resultaat).not.toBeNull() // er is nog een geldige, onbeschermde dag over
      expect(b1Resultaat.kandidaatDatum).not.toBe(gedegradeerdeDatum) // de monotonie-beschermde dag wordt nooit gekozen
    })

    it('geen degradatie en geen melding als trigger false is, ondanks aanwezige kernstimulus-kandidaat', async () => {
      kv.store.set('archetypes:sweetspot_intervallen', ARCHETYPES_FIXTURE.sweetspot_intervallen)
      vi.mocked(haalDagelijkseTssReeks).mockResolvedValue([10, 20, 10, 20, 10, 20, 10])
      vi.mocked(berekenMonotonieEnStrain).mockReturnValue({ trigger: false })

      vi.setSystemTime(new Date('2026-01-05T08:00:00'))
      const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
      const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))

      const resultaat = await genereerWeekSessiesDeterministisch({
        kv, userId: 'u_test', profiel,
        wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSweetspotPlan(), weekSessies: null,
        urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
      })

      const sessietypes = resultaat.sessies.map(s => s.intentie?.sessietype)
      expect(sessietypes).toContain('sweetspot_intervallen') // ongewijzigd, geen degradatie
      expect(maakMelding).not.toHaveBeenCalled()
    })

    it('fail-open bij mislukte dagelijkse-TSS-fetch (null): geen trigger, geen degradatie, geen crash', async () => {
      kv.store.set('archetypes:sweetspot_intervallen', ARCHETYPES_FIXTURE.sweetspot_intervallen)
      vi.mocked(haalDagelijkseTssReeks).mockResolvedValue(null) // expliciet, al de beforeEach-default

      vi.setSystemTime(new Date('2026-01-05T08:00:00'))
      const alleDagen = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
      const urenPerDag = Object.fromEntries(alleDagen.map(d => [d, 1.5]))

      const resultaat = await genereerWeekSessiesDeterministisch({
        kv, userId: 'u_test', profiel,
        wellness: { ctl: 45, atl: 40 }, seizoensplan: bouwSweetspotPlan(), weekSessies: null,
        urenPerDag, beschikbareDagen: alleDagen, voortgang: null,
      })

      expect(berekenMonotonieEnStrain).not.toHaveBeenCalled() // ternary short-circuit bij null
      const sessietypes = resultaat.sessies.map(s => s.intentie?.sessietype)
      expect(sessietypes).toContain('sweetspot_intervallen')
      expect(maakMelding).not.toHaveBeenCalled()
    })
  })
})
