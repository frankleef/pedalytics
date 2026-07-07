import { describe, it, expect, beforeEach } from 'vitest'
import { genereerSessieDag } from '../sessie/genereren.js'
import { PRIORITEIT_PER_FASE } from '../sessie/weekSolver.js'
import { _wisArchetypeCacheVoorTests } from '../sessie-archetypes.js'
import { ARCHETYPES_FIXTURE } from './fixtures/archetypesFixture.js'

// De module-level archetype-cache (sessie-archetypes.js) moet vóór elke test
// leeg zijn — anders lekt de mock-KV-data van de ene test naar de volgende
// (TTL is 5 min, ruim langer dan het hele testbestand duurt).
beforeEach(() => { _wisArchetypeCacheVoorTests() })

function maakKv(seed = {}) {
  // archetypes:{sessietype} is sinds de KV-migratie de enige databron voor
  // getArchetypesVoorSessietypeRaw() — elke mock-KV krijgt de fixture als
  // basis, tenzij seed die sleutel expliciet overschrijft.
  const archetypeSeed = Object.fromEntries(
    Object.entries(ARCHETYPES_FIXTURE).map(([sessietype, archetypes]) => [`archetypes:${sessietype}`, archetypes])
  )
  const store = new Map(Object.entries({ ...archetypeSeed, ...seed }))
  return {
    store,
    get: async (k) => store.get(k) ?? null,
    set: async (k, v) => { store.set(k, v) },
  }
}

const basisCtx = {
  userId: 'test_user',
  datum: '2026-07-10',
  dagNaam: 'Vrijdag',
  uren: 1.5,
  profiel: { ftp: 265, power_zones: null },
  wellness: { ctl: 50, atl: 45, hrv: 60 },
  plan: { seizoensdoel: { type: 'ftp' } },
  huidigeFase: 'basis',
  weekInFase: 1,
}

describe('genereerSessieDag — volledig deterministisch, geen Claude meer', () => {
  it('genereert deterministisch als archetype+variant beschikbaar zijn', async () => {
    // Forceer z2_progressief door alle andere z2_duur-archetypes als 'recent' te seeden
    const kv = maakKv({
      'sessie_archetypes:test_user:z2_duur': [
        'z2_negatief_split', 'z2_variabel_blokken', 'z2_golf', 'z2_tempo_blokken', 'z2_cadans', 'z2_heuvel', 'z2_tempo_teugjes',
      ],
    })
    const sessie = await genereerSessieDag({
      ...basisCtx,
      kv,
      effectiefSessietype: 'z2_duur',
      oudeSessie: { intentie: { sessietype: 'z2_duur' } },
    })

    expect(sessie.gegenereerd_door).toBe('deterministisch')
    expect(sessie.archetype_id).toBe('z2_progressief')
    expect(sessie.variant_id).toBeTruthy()
    expect(sessie.intentie.sessietype).toBe('z2_duur')
    expect(sessie.datum).toBe('2026-07-10')

    const opgeslagen = await kv.get('sessie_archetypes:test_user:z2_duur')
    expect(opgeslagen[0]).toBe('z2_progressief')
  })

  // De oude "valt terug op Claude als het gekozen archetype geen variantendata heeft"-
  // test is verwijderd: z2_heuvel/z2_tempo_teugjes/vo2_microbursts/race_simulatie
  // hebben nu allemaal variantendata (zie sessie-varianten.js) — dit scenario kan met
  // een echt archetype-id niet meer voorkomen.

  it('gooit een expliciete fout als er geen sessietype bekend is (geen Claude-fallback meer)', async () => {
    const kv = maakKv()
    await expect(genereerSessieDag({
      ...basisCtx,
      kv,
      effectiefSessietype: null,
      oudeSessie: null,
    })).rejects.toThrow(/geen sessietype bekend/)
  })

  it('gooit een expliciete fout voor een sessietype zonder enig archetype in de gevraagde fase', async () => {
    const kv = maakKv()
    await expect(genereerSessieDag({
      ...basisCtx,
      kv,
      effectiefSessietype: 'vo2max_intervallen',
      huidigeFase: 'basis', // vo2max-archetypes zijn hier niet beschikbaar in de basisfase
      oudeSessie: { intentie: { sessietype: 'vo2max_intervallen' } },
    })).rejects.toThrow(/geen archetypes beschikbaar/)
  })

  // De oude "past capSessieDuur toe"-test simuleerde een Claude-response met een
  // duur_min die niet bij de opgegeven uren paste. Het deterministische pad zet
  // duur_min altijd gelijk aan Math.round(uren*60) (schaalVariant schaalt daar al
  // naar), dus capSessieDuur triggert hier per constructie nooit meer — dat gedrag
  // is nu niet meer zinvol los te testen op dit niveau.

  it('respecteert de kracht-restrictie ook op het deterministische pad', async () => {
    const kv = maakKv()
    const zwareSessies = [
      { datum: '2026-07-09', type: 'kracht_lage_cadans', intentie: { sessietype: 'kracht_lage_cadans' } },
      { datum: '2026-07-08', type: 'kracht_lage_cadans', intentie: { sessietype: 'kracht_lage_cadans' } },
    ]
    const sessie = await genereerSessieDag({
      ...basisCtx,
      kv,
      effectiefSessietype: 'kracht_lage_cadans',
      oudeSessie: { intentie: { sessietype: 'kracht_lage_cadans' } },
      alleSessiesVoorKrachtCheck: zwareSessies,
    })
    // Binnen de rollend-7-dagenrestrictie is een derde kracht_lage_cadans-dag
    // niet toegestaan — het deterministische pad moet net als voorheen naar
    // z2_duur omschakelen.
    expect(sessie.intentie.sessietype).toBe('z2_duur')
  })
})

// Regressietest voor de "fase_beschikbaar dekt niet elke fase die solveWeek()
// daadwerkelijk toewijst"-bug: elke seizoensweek bevat gegarandeerd een
// overgangsfase- en een test-week (bouwWeekvolgorde in faseDuren.js, altijd
// aanwezig, niet optioneel), en klimmen's drempel-fase wijst vo2max_intervallen
// toe. Vóór de fix faalde genereerSessieDag() hier altijd (geen archetype
// bereikbaar), voor élke gebruiker, élk seizoen — dit was geen edge case.
describe('genereerSessieDag x solveWeek() — volledige fase-dekking (regressietest)', () => {
  const GENERIEKE_FASES = ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test']

  for (const [doel, faseTabel] of Object.entries(PRIORITEIT_PER_FASE)) {
    for (const fase of GENERIEKE_FASES) {
      const entry = faseTabel[fase]
      if (!entry) continue
      const kandidaten = new Set([
        ...(Array.isArray(entry.kernstimulus) ? entry.kernstimulus : entry.kernstimulus ? [entry.kernstimulus] : []),
        ...(entry.secundair ? [entry.secundair] : []),
        'z2_duur', // altijd mogelijk via de z2-fill-stap (stap 5)
      ])
      for (const sessietype of kandidaten) {
        it(`${doel} / ${fase}: "${sessietype}" genereert deterministisch, geen throw`, async () => {
          const kv = maakKv()
          const sessie = await genereerSessieDag({
            ...basisCtx,
            kv,
            plan: { seizoensdoel: { type: doel } },
            huidigeFase: fase,
            weekInFase: 3, // ruim binnen elke week_in_fase_min in de dataset (max 2)
            effectiefSessietype: sessietype,
            oudeSessie: { intentie: { sessietype } },
          })
          expect(sessie.gegenereerd_door).toBe('deterministisch')
        })
      }
    }
  }
})

describe('genereerSessieDag — weektype herstel (bugfix: z2_tempo_blokken in herstelweek)', () => {
  it('kiest over herhaalde generaties nooit z2_tempo_blokken/z2_tempo_teugjes in een herstelweek', async () => {
    for (let i = 0; i < 15; i++) {
      const kv = maakKv()
      const sessie = await genereerSessieDag({
        ...basisCtx, kv,
        weekInFase: 4, weektype: 'herstel',
        effectiefSessietype: 'z2_duur',
        oudeSessie: { intentie: { sessietype: 'z2_duur' } },
      })
      expect(sessie.archetype_id).not.toBe('z2_tempo_blokken')
      expect(sessie.archetype_id).not.toBe('z2_tempo_teugjes')
    }
  })

  it('kan z2_tempo_blokken wél kiezen in dezelfde week_in_fase als het een opbouwweek is (geen regressie)', async () => {
    const kv = maakKv({
      // forceer z2_tempo_blokken door alle andere z2_duur-archetypes als 'recent' te seeden
      'sessie_archetypes:test_user:z2_duur': [
        'z2_progressief', 'z2_negatief_split', 'z2_variabel_blokken', 'z2_golf', 'z2_cadans', 'z2_heuvel', 'z2_tempo_teugjes',
      ],
    })
    const sessie = await genereerSessieDag({
      ...basisCtx, kv,
      weekInFase: 4, weektype: 'opbouw',
      effectiefSessietype: 'z2_duur',
      oudeSessie: { intentie: { sessietype: 'z2_duur' } },
    })
    expect(sessie.archetype_id).toBe('z2_tempo_blokken')
  })
})

describe('genereerSessieDag — min_duur_min (feature: "deze sessie kan alleen vanaf 1u30")', () => {
  it('een archetype met min_duur_min hoger dan de beschikbare tijd wordt nooit gekozen', async () => {
    // z2_progressief krijgt hier een min_duur_min van 120 min — bij een 1u-dag
    // (60 min) moet genereerSessieDag terugvallen op een ander z2_duur-archetype
    // i.p.v. dit ontoereikende archetype te kiezen.
    const z2Archetypes = ARCHETYPES_FIXTURE.z2_duur.map(a =>
      a.id === 'z2_progressief' ? { ...a, min_duur_min: 120 } : a
    )
    const kv = maakKv({ 'archetypes:z2_duur': z2Archetypes })
    const sessie = await genereerSessieDag({
      ...basisCtx, kv, uren: 1, // 60 min, ruim onder de 120 min van z2_progressief
      effectiefSessietype: 'z2_duur',
      oudeSessie: { intentie: { sessietype: 'z2_duur' } },
    })
    expect(sessie.archetype_id).not.toBe('z2_progressief')
  })

  it('bij voldoende tijd blijft het archetype gewoon beschikbaar (>=, niet >)', async () => {
    const z2Archetypes = ARCHETYPES_FIXTURE.z2_duur.map(a =>
      a.id === 'z2_progressief' ? { ...a, min_duur_min: 60 } : a
    )
    const kv = maakKv({
      'archetypes:z2_duur': z2Archetypes,
      // forceer alle andere z2-archetypes als 'recent' zodat rotatie wel bij
      // z2_progressief uitkomt als die daadwerkelijk nog in de kandidatenlijst zit
      'sessie_archetypes:test_user:z2_duur': z2Archetypes.filter(a => a.id !== 'z2_progressief').map(a => a.id),
    })
    const sessie = await genereerSessieDag({
      ...basisCtx, kv, uren: 1, // exact 60 min
      effectiefSessietype: 'z2_duur',
      oudeSessie: { intentie: { sessietype: 'z2_duur' } },
    })
    expect(sessie.archetype_id).toBe('z2_progressief')
  })

  it('gooit een duidelijke fout als ALLE kandidaten meer tijd vereisen dan beschikbaar', async () => {
    const krachtArchetypes = ARCHETYPES_FIXTURE.kracht_lage_cadans.map(a => ({ ...a, min_duur_min: 200 }))
    const kv = maakKv({ 'archetypes:kracht_lage_cadans': krachtArchetypes })
    await expect(genereerSessieDag({
      ...basisCtx, kv, uren: 1,
      effectiefSessietype: 'kracht_lage_cadans',
      oudeSessie: { intentie: { sessietype: 'kracht_lage_cadans' } },
    })).rejects.toThrow(/min_duur_min/)
  })
})
