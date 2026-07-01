import { describe, it, expect } from 'vitest'
import { genereerSessieDag } from '../sessie/genereren.js'

function maakKv(seed = {}) {
  const store = new Map(Object.entries(seed))
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
