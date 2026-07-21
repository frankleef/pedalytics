import { describe, it, expect } from 'vitest'
import {
  schaalVariant,
  berekenWattagesVanBlokken,
  berekenTssVanBlokken,
  berekenZonedistributie,
  groeperenInSets,
  selecteerVariantOpDagvorm,
  genereerSessieDeterministisch,
  vindArchetypeMetVarianten,
  bepaalMaximumBlokduur,
  bepaalDoelGewicht,
} from '../sessie-generatie.js'
import { SESSIE_ARCHETYPES as VARIANT_ARCHETYPES } from '../sessie-varianten.js'
import { ARCHETYPES_FIXTURE } from './fixtures/archetypesFixture.js'

describe('schaalVariant — volledige dataset', () => {
  it('blijft voor alle 114 varianten binnen 10% van de doelduur op 45/60/90/120 min', () => {
    const afwijkingen = []
    for (const [sessietype, archetypes] of Object.entries(VARIANT_ARCHETYPES)) {
      for (const archetype of archetypes) {
        for (const variant of archetype.varianten) {
          for (const doelMin of [45, 60, 90, 120]) {
            const geschaald = schaalVariant(variant, doelMin * 60)
            const totaal = geschaald.reduce((s, b) => s + b.blokDuurSeconden * (b.reps ?? 1), 0)
            const afwijkingPct = Math.abs(totaal / (doelMin * 60) - 1)
            if (afwijkingPct > 0.10) {
              afwijkingen.push(`${sessietype}/${archetype.id}/${variant.id} @ ${doelMin}min: ${Math.round(totaal / 60)}min`)
            }
          }
        }
      }
    }
    expect(afwijkingen).toEqual([])
  })
})

function maakKv() {
  const store = new Map()
  return {
    store,
    get: async (k) => store.get(k) ?? null,
    set: async (k, v) => { store.set(k, v) },
  }
}

const NEGATIEF_SPLIT_6BLOKKEN = {
  blokken: [
    { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 1 / 6 },
    { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 1 / 6 },
    { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 1 / 6 },
    { type: 'werk', zone: 'Z2', pct_ftp: 68, duur_pct: 1 / 6 },
    { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 1 / 6 },
    { type: 'werk', zone: 'Z2', pct_ftp: 72, duur_pct: 1 / 6 },
  ],
}

describe('schaalVariant', () => {
  it('is sessieduur-agnostisch: zelfde structuur, proportioneel andere blokduur', () => {
    const g90 = schaalVariant(NEGATIEF_SPLIT_6BLOKKEN, 5400)
    const g120 = schaalVariant(NEGATIEF_SPLIT_6BLOKKEN, 7200)
    expect(g90.map(b => Math.round(b.blokDuurSeconden / 60))).toEqual([15, 15, 15, 15, 15, 15])
    expect(g120.map(b => Math.round(b.blokDuurSeconden / 60))).toEqual([20, 20, 20, 20, 20, 20])
  })

  it('normaliseert duur_pct die niet exact op 1.0 uitkomt', () => {
    const scheef = {
      blokken: [
        { type: 'werk', zone: 'Z5', pct_ftp: 120, duur_pct: 0.3 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_pct: 0.3 },
      ],
    } // som = 0.6, niet 1.0
    const geschaald = schaalVariant(scheef, 3600)
    const totaal = geschaald.reduce((s, b) => s + b.blokDuurSeconden, 0)
    expect(totaal).toBeCloseTo(3600, -1) // binnen ~10s door afronding, niet 2160 (0.6*3600)
  })

  it('respecteert minimumduren: werk >= 90s, herstel >= 60s', () => {
    const kort = {
      blokken: [
        { type: 'werk', zone: 'Z5', pct_ftp: 130, duur_pct: 0.01 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_pct: 0.01 },
      ],
    }
    const geschaald = schaalVariant(kort, 600) // 10 min totaal, blokken zouden anders ~3s zijn
    expect(geschaald[0].blokDuurSeconden).toBeGreaterThanOrEqual(90)
    expect(geschaald[1].blokDuurSeconden).toBeGreaterThanOrEqual(60)
  })

  it('expandeert reps niet zelf (dat doet berekenWattagesVanBlokken) maar behoudt het veld', () => {
    const metReps = { blokken: [{ type: 'werk', zone: 'Z5', pct_ftp: 120, duur_pct: 0.1, reps: 4 }] }
    const geschaald = schaalVariant(metReps, 1200)
    expect(geschaald[0].reps).toBe(4)
  })

  it('past de minimumduur NIET toe op herhaalde blokken (reps > 1) — anders schiet de totale duur fors over', () => {
    // 20x 40s werk + 20x 20s herstel + 1x uitrijden, gemikt op 60 min.
    // Met een 90s/60s-vloer per rep zou dit 20x90s+20x60s=3000s alleen al aan
    // reps zijn — ruim boven de 3600s doelduur.
    const variant = {
      blokken: [
        { type: 'werk', zone: 'Z5', pct_ftp: 120, duur_pct: 0.011, reps: 20 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_pct: 0.006, reps: 20 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_pct: 0.66 },
      ],
    }
    const geschaald = schaalVariant(variant, 3600)
    const totaal = geschaald.reduce((s, b) => s + b.blokDuurSeconden * (b.reps ?? 1), 0)
    expect(Math.abs(totaal - 3600)).toBeLessThan(360) // binnen 10%
  })

  it('past de minimumduur niet toe op Z7 — sprints zijn per definitie kort, ook zonder reps-veld', () => {
    const variant = {
      blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.15 },
        { type: 'werk', zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
        { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.15 },
        { type: 'werk', zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_pct: 0.694 },
      ],
    }
    const geschaald = schaalVariant(variant, 3600)
    const sprintBlokken = geschaald.filter(b => b.zone === 'Z7')
    for (const b of sprintBlokken) expect(b.blokDuurSeconden).toBeLessThan(90)
    const totaal = geschaald.reduce((s, b) => s + b.blokDuurSeconden, 0)
    expect(Math.abs(totaal - 3600)).toBeLessThan(360) // binnen 10%
  })
})

describe('berekenWattagesVanBlokken', () => {
  it('berekent vermogen direct uit pct_ftp en expandeert reps', () => {
    const blokken = [{ type: 'werk', zone: 'Z5', pct_ftp: 120, blokDuurSeconden: 40, reps: 3 }]
    const resultaat = berekenWattagesVanBlokken(blokken, 265, 'vo2max_intervallen')
    expect(resultaat).toHaveLength(3)
    for (const b of resultaat) {
      expect(b.vermogenMin).toBeLessThanOrEqual(265 * 1.2)
      expect(b.vermogenMax).toBeGreaterThanOrEqual(265 * 1.2)
      expect(b.eenheid).toBe('watts')
      expect(b.blokDuurSeconden).toBe(40)
    }
  })

  it('normaliseert een los cadans-getal naar {min,max}', () => {
    const blokken = [{ type: 'werk', zone: 'Z3', pct_ftp: 90, blokDuurSeconden: 300, cadans_rpm: 50 }]
    const [b] = berekenWattagesVanBlokken(blokken, 265, 'kracht_lage_cadans')
    expect(b.cadans_rpm).toEqual({ min: 45, max: 55 })
  })

  it('bugfix: interleaved werk/herstel i.p.v. alle werk-reps eerst en dan alle herstel-reps (auteursformaat: twee opeenvolgende entries met gelijke reps)', () => {
    const blokken = [
      { type: 'werk', zone: 'Z3', pct_ftp: 90, blokDuurSeconden: 300, reps: 4 },
      { type: 'herstel', zone: 'Z2', pct_ftp: 63, blokDuurSeconden: 120, reps: 4 },
      { type: 'herstel', zone: 'Z2', pct_ftp: 63, blokDuurSeconden: 600 },
    ]
    const resultaat = berekenWattagesVanBlokken(blokken, 265, 'kracht_lage_cadans')
    expect(resultaat).toHaveLength(9) // 4x werk + 4x herstel + 1 afsluitende herstel-tail
    const types = resultaat.map(b => b.type)
    expect(types).toEqual(['werk', 'herstel', 'werk', 'herstel', 'werk', 'herstel', 'werk', 'herstel', 'herstel'])
  })

  it('bugfix: een enkel reps-blok zonder aangrenzend paar wordt gewoon N keer herhaald (geen regressie)', () => {
    const blokken = [{ type: 'werk', zone: 'Z5', pct_ftp: 120, blokDuurSeconden: 40, reps: 3 }]
    const resultaat = berekenWattagesVanBlokken(blokken, 265, 'vo2max_intervallen')
    expect(resultaat.map(b => b.type)).toEqual(['werk', 'werk', 'werk'])
  })

  it('bugfix over de volledige dataset: berekenWattagesVanBlokken volgt exact dezelfde set-structuur als groeperenInSets (onafhankelijke kruisverificatie)', () => {
    // groeperenInSets() is de reeds vertrouwde, apart geteste bron van waarheid voor
    // "hoeveel sets, hoeveel reps, wat zit er in elke set" (UI plan_sets). Als
    // berekenWattagesVanBlokken() een andere volgorde oplevert dan wat die sets
    // impliceren (elke set `reps` keer herhaald, in dezelfde interne volgorde),
    // is de expansie niet correct geïnterleaved.
    for (const [sessietype, archetypes] of Object.entries(VARIANT_ARCHETYPES)) {
      for (const archetype of archetypes) {
        for (const variant of archetype.varianten) {
          const geschaald = schaalVariant(variant, 3600)
          const sets = groeperenInSets(geschaald)
          const verwachteTypes = sets.flatMap(set =>
            Array.from({ length: set.reps }, () => set.blokken.map(b => b.type)).flat()
          )
          const resultaat = berekenWattagesVanBlokken(geschaald, 265, sessietype)
          expect(resultaat.map(b => b.type), `${sessietype}/${archetype.id}/${variant.id}`).toEqual(verwachteTypes)
        }
      }
    }
  })
})

describe('berekenTssVanBlokken / berekenZonedistributie', () => {
  it('berekent TSS en zonedistributie voor een simpele Z2-blok', () => {
    const blokken = berekenWattagesVanBlokken(
      [{ type: 'werk', zone: 'Z2', pct_ftp: 65, blokDuurSeconden: 3600 }],
      265, 'z2_duur'
    )
    const tss = berekenTssVanBlokken(blokken, 265)
    expect(tss).toBeGreaterThan(35)
    expect(tss).toBeLessThan(55)
    const dist = berekenZonedistributie(blokken)
    expect(dist.Z2).toBe(1)
  })
})

describe('groeperenInSets', () => {
  it('groepeert opeenvolgende blokken met gelijke reps als één set', () => {
    const blokken = [
      { type: 'werk', reps: 4 },
      { type: 'herstel', reps: 4 },
      { type: 'herstel' },
    ]
    const sets = groeperenInSets(blokken)
    expect(sets).toHaveLength(2)
    expect(sets[0].reps).toBe(4)
    expect(sets[0].blokken).toHaveLength(2)
    expect(sets[1].reps).toBe(1)
  })
})

describe('selecteerVariantOpDagvorm', () => {
  const archetype = {
    id: 'test_archetype',
    varianten: [
      { id: 'v_licht_1', zwaartegewicht: 1, blokken: [] },
      { id: 'v_licht_2', zwaartegewicht: 1, blokken: [] },
      { id: 'v_middel_1', zwaartegewicht: 2, blokken: [] },
      { id: 'v_zwaar_1', zwaartegewicht: 3, blokken: [] },
    ],
  }

  const scenarios = [
    { tsb: -25, hrv: 'rood', rpeDeltaTrend: 0, verwacht: 1 },
    { tsb: -12, hrv: 'normaal', rpeDeltaTrend: 0, verwacht: 2 },
    { tsb: 0, hrv: 'geel', rpeDeltaTrend: 0, verwacht: 2 },
    { tsb: 2, hrv: 'normaal', rpeDeltaTrend: 1.5, verwacht: 2 },
    { tsb: 8, hrv: 'hoog', rpeDeltaTrend: 0, verwacht: 3 },
    { tsb: 6, hrv: 'normaal', rpeDeltaTrend: 0.3, verwacht: 3 },
    { tsb: 10, hrv: 'rood', rpeDeltaTrend: 0, verwacht: 1 }, // HRV rood wint altijd, ongeacht TSB
  ]

  for (const s of scenarios) {
    it(`TSB=${s.tsb} HRV=${s.hrv} RPE-trend=${s.rpeDeltaTrend} -> gewicht ${s.verwacht}`, async () => {
      const kv = maakKv()
      const { doelGewicht } = await selecteerVariantOpDagvorm(kv, archetype, 'test_user', s)
      expect(doelGewicht).toBe(s.verwacht)
    })
  }

  it('valt terug op gewicht 2 (normaal/onbekend) als dagvorm ontbreekt', async () => {
    const kv = maakKv()
    const { doelGewicht } = await selecteerVariantOpDagvorm(kv, archetype, 'test_user', null)
    expect(doelGewicht).toBe(2)
  })

  it('rouleert binnen een gewichtsgroep — herhaalt niet direct dezelfde variant', async () => {
    const kv = maakKv()
    const dagvorm = { tsb: -25, hrv: 'rood', rpeDeltaTrend: 0 } // -> gewicht 1, 2 kandidaten
    const eerste = await selecteerVariantOpDagvorm(kv, archetype, 'test_user', dagvorm)
    const tweede = await selecteerVariantOpDagvorm(kv, archetype, 'test_user', dagvorm)
    expect(tweede.variant.id).not.toBe(eerste.variant.id)
  })

  it('valt terug op de volledige pool als een gewichtsgroep geen varianten heeft', async () => {
    const archetypeZonderZwaar = {
      id: 'test_archetype_2',
      varianten: [{ id: 'enige', zwaartegewicht: 1, blokken: [] }],
    }
    const kv = maakKv()
    const { variant, doelGewicht } = await selecteerVariantOpDagvorm(kv, archetypeZonderZwaar, 'test_user', { tsb: 10, hrv: 'hoog', rpeDeltaTrend: 0 })
    expect(doelGewicht).toBe(3)
    expect(variant.id).toBe('enige')
  })
})

describe('vindArchetypeMetVarianten', () => {
  it('vindt een bestaand archetype met variantendata', () => {
    const gevonden = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['z2_duur'], 'z2_progressief')
    expect(gevonden).not.toBeNull()
    expect(gevonden.varianten.length).toBeGreaterThan(0)
  })

  it('z2_heuvel, z2_tempo_teugjes, vo2_microbursts en race_simulatie hebben nu allemaal variantendata (voorheen de enige 4 Claude-fallback-gevallen)', () => {
    expect(vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['z2_duur'], 'z2_heuvel')?.varianten.length).toBeGreaterThan(0)
    expect(vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['z2_duur'], 'z2_tempo_teugjes')?.varianten.length).toBeGreaterThan(0)
    expect(vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['vo2max_intervallen'], 'vo2_microbursts')?.varianten.length).toBeGreaterThan(0)
    expect(vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['gemengd'], 'race_simulatie')?.varianten.length).toBeGreaterThan(0)
  })

  it('retourneert null voor een niet-bestaand archetype-id', () => {
    expect(vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['z2_duur'], 'bestaat_niet')).toBeNull()
  })
})

describe('genereerSessieDeterministisch', () => {
  const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['z2_duur'], 'z2_progressief')
  const variant = archetype.varianten[0]

  it('genereert een volledige sessie met de juiste metadata', () => {
    const sessie = genereerSessieDeterministisch({
      dagIntentie: { rol: 'aerobe_dag' },
      archetype: { id: 'z2_progressief', naam: 'Progressief' },
      variant,
      doelDuurMin: 90,
      ftp: 265,
      sessietype: 'z2_duur',
    })
    expect(sessie.gegenereerd_door).toBe('deterministisch')
    expect(sessie.archetype_id).toBe('z2_progressief')
    expect(sessie.variant_id).toBe(variant.id)
    expect(sessie.duur_min).toBe(90)
    expect(sessie.type).toBe('duur_variabel')
    expect(sessie.intentie.sessietype).toBe('z2_duur')
    expect(sessie.intentie.rol).toBe('aerobe_dag')
    expect(sessie.tss).toBeGreaterThan(0)
    expect(sessie.verwacht_rpe).toBeGreaterThanOrEqual(1)
    expect(sessie.verwacht_rpe).toBeLessThanOrEqual(10)
    expect(sessie.segmenten.length).toBeGreaterThan(0)
    const totaalSec = sessie.segmenten.reduce((s, b) => s + b.blokDuurSeconden, 0)
    expect(Math.round(totaalSec / 60)).toBeCloseTo(90, -1)
  })

  it('genereert 7 sessies in ruim onder 200ms totaal', () => {
    const t0 = Date.now()
    for (let i = 0; i < 7; i++) {
      genereerSessieDeterministisch({
        dagIntentie: {}, archetype: { id: 'z2_progressief', naam: 'Progressief' },
        variant, doelDuurMin: 90, ftp: 265, sessietype: 'z2_duur',
      })
    }
    expect(Date.now() - t0).toBeLessThan(200)
  })
})

describe('genereerSessieDeterministisch — warming-up (bugfix: sessie start direct met werk)', () => {
  it('kracht_lage_cadans begint met een Z2-inrijblok, niet direct met het kracht-blok', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['kracht_lage_cadans'], 'kracht_standaard')
    const variant = archetype.varianten.find(v => v.id === 'kracht_std_4x5')
    const sessie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 90, ftp: 265, sessietype: 'kracht_lage_cadans',
    })
    expect(sessie.segmenten[0].zone).toBe('Z2')
    expect(sessie.segmenten[0].cadans_rpm).not.toEqual({ min: 45, max: 55 }) // geen lage-cadans op het inrijblok
    expect(sessie.segmenten[0].blokDuurSeconden).toBeGreaterThanOrEqual(5 * 60)
    // Totale sessieduur blijft gelijk aan de doelduur, ondanks het toegevoegde inrijblok
    const totaalSec = sessie.segmenten.reduce((s, b) => s + b.blokDuurSeconden, 0)
    expect(Math.round(totaalSec / 60)).toBeCloseTo(90, -1)
  })

  it('z2_duur krijgt geen extra inrijblok (de hele sessie is al Z2)', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['z2_duur'], 'z2_progressief')
    const variant = archetype.varianten[0]
    const sessie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 90, ftp: 265, sessietype: 'z2_duur',
    })
    // z2_progressief's eigen eerste blok is al Z2 — geen apart, dubbel inrijblok nodig
    expect(sessie.segmenten[0].zone).toBe('Z2')
  })

  it('een archetype dat al met Z2 begint (pieken_en_dalen) wordt niet dubbel opgewarmd', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['gemengd'], 'pieken_en_dalen')
    const variant = archetype.varianten[0]
    const sessieMetOpwarming = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 90, ftp: 265, sessietype: 'gemengd',
    })
    // Het originele eerste blok (Z2 @ 66%) blijft het eerste segment — geen extra blok ervoor
    const eersteBlokPct = variant.blokken[0].pct_ftp
    expect(sessieMetOpwarming.segmenten[0].zone).toBe('Z2')
    const verwachtVermogen = Math.round(265 * eersteBlokPct / 100)
    const marge = 20 // spread-tolerantie
    expect(Math.abs(sessieMetOpwarming.segmenten[0].vermogenMax - verwachtVermogen)).toBeLessThan(marge * 3)
  })

  it('dataset-breed: elk niet-z2_duur/al-rustig-beginnend archetype start nu met Z1/Z2 i.p.v. direct met het werkblok', () => {
    const nietOpgewarmd = []
    for (const [sessietype, archetypes] of Object.entries(VARIANT_ARCHETYPES)) {
      if (sessietype === 'z2_duur') continue
      for (const archetype of archetypes) {
        for (const variant of archetype.varianten) {
          const sessie = genereerSessieDeterministisch({
            dagIntentie: null, archetype, variant, doelDuurMin: 90, ftp: 265, sessietype,
          })
          if (!['Z1', 'Z2'].includes(sessie.segmenten[0].zone)) {
            nietOpgewarmd.push(`${sessietype}/${archetype.id}/${variant.id}`)
          }
        }
      }
    }
    expect(nietOpgewarmd).toEqual([])
  })
})

describe('schaalVariant — maximum blokduur (bugfix: 24-minuten krachtsblok bij lange sessieduur)', () => {
  it('reproduceert en fixt het gerapporteerde geval: kracht_std_4x5 @ 180 min blijft binnen zijn archetype-maximum', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['kracht_lage_cadans'], 'kracht_standaard')
    const variant = archetype.varianten.find(v => v.id === 'kracht_std_4x5')

    // Vóór de fix: schaalVariant(variant, 10800) zonder cap gaf hier 1436s (~24 min)
    const zonderContext = schaalVariant(variant, 180 * 60)
    expect(Math.round(zonderContext[0].blokDuurSeconden / 60)).toBe(24) // oude, ongecapte gedrag nog aantoonbaar zonder archetype-context

    const sessie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 180, ftp: 265, sessietype: 'kracht_lage_cadans',
    })
    const krachtBlokken = sessie.segmenten.filter(s => s.zone === 'Z3' || s.zone === 'Z4')
    for (const b of krachtBlokken) {
      expect(b.blokDuurSeconden).toBeLessThanOrEqual(360) // kracht_standaard-maximum: 6 min
    }
  })

  it('archetype.max_blokduur_sec (admin-geconfigureerd, via KV) wint van de hardcoded tabel', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['kracht_lage_cadans'], 'kracht_standaard')
    const variant = archetype.varianten.find(v => v.id === 'kracht_std_4x5')

    // Zonder override: hardcoded max van 360s (6 min) geldt.
    const zonderOverride = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 180, ftp: 265, sessietype: 'kracht_lage_cadans',
    })
    const krachtZonder = zonderOverride.segmenten.filter(s => s.zone === 'Z3' || s.zone === 'Z4')
    expect(Math.max(...krachtZonder.map(b => b.blokDuurSeconden))).toBeLessThanOrEqual(360)

    // Met override: archetype.max_blokduur_sec (bv. 180s) wint van de hardcoded 360s.
    const archetypeMetOverride = { ...archetype, max_blokduur_sec: 180 }
    const metOverride = genereerSessieDeterministisch({
      dagIntentie: null, archetype: archetypeMetOverride, variant, doelDuurMin: 180, ftp: 265, sessietype: 'kracht_lage_cadans',
    })
    const krachtMet = metOverride.segmenten.filter(s => s.zone === 'Z3' || s.zone === 'Z4')
    for (const b of krachtMet) {
      expect(b.blokDuurSeconden).toBeLessThanOrEqual(180)
    }
  })

  it('elk interval-achtig sessietype: bij een extreme sessieduur (4 uur) overschrijdt geen enkel werkblok zijn eigen archetype-maximum', () => {
    const overtredingen = []
    for (const [sessietype, archetypes] of Object.entries(VARIANT_ARCHETYPES)) {
      if (sessietype === 'z2_duur') continue // bewust geen maximum, zie aparte test hieronder
      for (const archetype of archetypes) {
        for (const variant of archetype.varianten) {
          const sessie = genereerSessieDeterministisch({
            dagIntentie: null, archetype, variant, doelDuurMin: 240, ftp: 265, sessietype,
          })
          for (const seg of sessie.segmenten) {
            const maxSec = bepaalMaximumBlokduur(sessietype, archetype.id, seg)
            if (maxSec != null && seg.blokDuurSeconden > maxSec) {
              overtredingen.push(`${sessietype}/${archetype.id}/${variant.id}: ${seg.zone} ${seg.blokDuurSeconden}s > ${maxSec}s`)
            }
          }
        }
      }
    }
    expect(overtredingen).toEqual([])
  })

  it('z2_duur blijft ongewijzigd bij een extreme sessieduur (4 uur) — geen cap, blokken schalen vrij mee', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['z2_duur'], 'z2_progressief')
    const variant = archetype.varianten[0]
    const sessie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 240, ftp: 265, sessietype: 'z2_duur',
    })
    const totaalMin = sessie.segmenten.reduce((s, b) => s + b.blokDuurSeconden, 0) / 60
    expect(Math.round(totaalMin)).toBeCloseTo(240, -1)
    // Elk blok schaalt evenredig mee — bij 3 gelijke delen dus rond de 80 min per blok
    expect(sessie.segmenten[0].blokDuurSeconden / 60).toBeGreaterThan(60)
  })

  it('totale sessieduur blijft dicht bij de gevraagde doelduur ondanks herverdeling van "teveel" naar herstelblokken', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['kracht_lage_cadans'], 'kracht_standaard')
    const variant = archetype.varianten.find(v => v.id === 'kracht_std_4x5')
    const sessie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 180, ftp: 265, sessietype: 'kracht_lage_cadans',
    })
    const totaalMin = sessie.segmenten.reduce((s, b) => s + b.blokDuurSeconden, 0) / 60
    expect(Math.abs(totaalMin - 180)).toBeLessThan(5) // binnen 5 min van de gevraagde 180 min
  })

  it('regressie: normale sessieduur (90 min, cap wordt niet geraakt) levert hetzelfde resultaat op als vóór de fix', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['sweetspot_intervallen'], 'ss_standaard')
    const variant = archetype.varianten.find(v => v.id === 'ss_std_3x15')
    // ss_std_3x15 @ 90 min: werkblok ruw = round(0.225*5400) = 1215s, ruim onder het
    // archetype-maximum van 1560s — cap/herverdeling raakt hier niet in werking, dus
    // schaalVariant() met archetype-context geeft hetzelfde resultaat als zonder.
    const metContext = schaalVariant(variant, 90 * 60, 'sweetspot_intervallen', 'ss_standaard')
    const zonderContext = schaalVariant(variant, 90 * 60)
    expect(metContext).toEqual(zonderContext)
    expect(metContext[0].blokDuurSeconden).toBe(1215)
  })
})

describe('schaalVariant — vaste blokduur (duur_sec_vast, feature: "precies 30 minuten Z2")', () => {
  it('een vast blok krijgt letterlijk zijn opgegeven duur, ongeacht doelDuurSec', () => {
    const variant = {
      blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_sec_vast: 1800 }, // altijd 30 min
        { type: 'werk', zone: 'Z3', pct_ftp: 85, duur_pct: 0.5 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 60, duur_pct: 0.5 },
      ],
    }
    for (const doelMin of [45, 90, 180]) {
      const resultaat = schaalVariant(variant, doelMin * 60)
      expect(resultaat[0].blokDuurSeconden).toBe(1800)
    }
  })

  it('de resterende (duur_pct-)blokken verdelen alleen de tijd NA aftrek van de vaste blokken', () => {
    const variant = {
      blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_sec_vast: 1800 }, // 30 min vast
        { type: 'werk', zone: 'Z3', pct_ftp: 85, duur_pct: 1.0 }, // de rest
      ],
    }
    const resultaat = schaalVariant(variant, 60 * 60) // 60 min totaal -> 30 min rest voor het pct-blok
    expect(resultaat[0].blokDuurSeconden).toBe(1800)
    expect(resultaat[1].blokDuurSeconden).toBeCloseTo(1800, -1)
  })

  it('vaste blokken doen niet mee in de duur_pct-normalisatie van de overige blokken', () => {
    const metVast = schaalVariant({
      blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_sec_vast: 600 },
        { type: 'werk', zone: 'Z3', pct_ftp: 85, duur_pct: 0.6 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 60, duur_pct: 0.4 },
      ],
    }, 3600)
    // De twee duur_pct-blokken (0.6/0.4, som=1.0) verdelen de resterende 3000s
    expect(metVast[1].blokDuurSeconden).toBeCloseTo(1800, -1) // 0.6 * 3000
    expect(metVast[2].blokDuurSeconden).toBeCloseTo(1200, -1) // 0.4 * 3000
  })

  it('vaste blokken worden nooit begrensd door bepaalMaximumBlokduur — de opgegeven waarde staat vast', () => {
    // kracht_standaard heeft een hardcoded maximum van 360s — een vast blok van 900s
    // (buiten die grens) moet toch letterlijk 900s blijven.
    const variant = {
      blokken: [
        { type: 'werk', zone: 'Z3', pct_ftp: 90, duur_sec_vast: 900, reps: 1 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_pct: 1.0 },
      ],
    }
    const resultaat = schaalVariant(variant, 180 * 60, 'kracht_lage_cadans', 'kracht_standaard')
    expect(resultaat[0].blokDuurSeconden).toBe(900)
  })

  it('vaste herstelblokken worden nooit gebruikt om overschot van gecapte werkblokken op te vangen', () => {
    const variant = {
      blokken: [
        { type: 'werk', zone: 'Z3', pct_ftp: 90, duur_pct: 1.0, reps: 4 }, // wordt gecapt
        { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_sec_vast: 60 }, // vast — mag niet groeien
      ],
    }
    const resultaat = schaalVariant(variant, 180 * 60, 'kracht_lage_cadans', 'kracht_standaard')
    expect(resultaat[1].blokDuurSeconden).toBe(60) // ongewijzigd, ondanks overschot van blok 0
  })

  it('reps werken hetzelfde voor vaste blokken: duur_sec_vast is per instantie', () => {
    const variant = {
      blokken: [
        { type: 'werk', zone: 'Z4', pct_ftp: 100, duur_sec_vast: 120, reps: 4 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 60, duur_pct: 1.0 },
      ],
    }
    const resultaat = schaalVariant(variant, 60 * 60)
    expect(resultaat[0].blokDuurSeconden).toBe(120)
    // 4 * 120s vast = 480s, rest (3120s - 480s = 3120s... 3600-480=3120) gaat naar het pct-blok
    expect(resultaat[1].blokDuurSeconden).toBeCloseTo(3600 - 4 * 120, -1)
  })

  it('genereerSessieDeterministisch respecteert een vast Z2-blok van precies 30 minuten, ook bij 45 of 180 min sessieduur', () => {
    const archetype = { id: 'test_vast', naam: 'Test' }
    const variant = {
      id: 'v1',
      blokken: [
        { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_sec_vast: 1800 },
        { type: 'werk', zone: 'Z3', pct_ftp: 85, duur_pct: 0.5 },
        { type: 'herstel', zone: 'Z2', pct_ftp: 60, duur_pct: 0.5 },
      ],
    }
    for (const doelMin of [45, 180]) {
      const sessie = genereerSessieDeterministisch({
        dagIntentie: null, archetype, variant, doelDuurMin: doelMin, ftp: 265, sessietype: 'sweetspot_intervallen',
      })
      const vastBlok = sessie.segmenten.find(s => s.zone === 'Z2' && s.type === 'werk')
      expect(vastBlok.blokDuurSeconden).toBe(1800)
    }
  })

  it('warm-up-injectie krimpt een vast blok nooit — alleen de schaalbare blokken maken ruimte', () => {
    // Archetype dat NIET met Z1/Z2 begint (dus warm-up-injectie triggert),
    // met een vast Z2-blok ergens middenin dat exact 10 min moet blijven.
    const archetype = { id: 'test_vast_warmup', naam: 'Test' }
    const variant = {
      id: 'v1',
      blokken: [
        { type: 'werk', zone: 'Z3', pct_ftp: 85, duur_pct: 0.5 },
        { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_sec_vast: 600 }, // altijd 10 min
        { type: 'herstel', zone: 'Z2', pct_ftp: 60, duur_pct: 0.5 },
      ],
    }
    const sessie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 60, ftp: 265, sessietype: 'sweetspot_intervallen',
    })
    const vastBlok = sessie.segmenten.find(s => s.blokDuurSeconden === 600 && s.zone === 'Z2')
    expect(vastBlok).toBeDefined()
  })
})

describe('genereerSessieDeterministisch — D5: CP/W-kalibratie', () => {
  const CP_WPRIME = { criticalPower: 230, wPrime: 20000 }
  const DREMPELS = { depletiePct: 60, herstelPct: 75 }

  it('vo2max_intervallen krijgt een gekalibreerde duur met standaardBlokDuurSeconden erbij wanneer CP/W beschikbaar is', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['vo2max_intervallen'], 'vo2_5x5')
    const variant = archetype.varianten.find(v => v.id === 'vo2_5x5_std')

    const zonderKalibratie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 60, ftp: 260, sessietype: 'vo2max_intervallen',
    })
    const metKalibratie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 60, ftp: 260, sessietype: 'vo2max_intervallen',
      cpWprime: CP_WPRIME, wbalDrempels: DREMPELS,
    })

    const werkZonder = zonderKalibratie.segmenten.find(s => s.zone === 'Z5')
    const werkMet = metKalibratie.segmenten.find(s => s.zone === 'Z5')
    expect(werkZonder.standaardBlokDuurSeconden).toBeUndefined()
    expect(werkMet.standaardBlokDuurSeconden).toBe(werkZonder.blokDuurSeconden)
    expect(werkMet.blokDuurSeconden).not.toBe(werkZonder.blokDuurSeconden)
    expect(werkMet.blokDuurSeconden).toBeGreaterThan(0)

    // Het herstelblok van dezelfde reps-cyclus (Z2, 63%) is ook gekalibreerd.
    const rustBlokkenMet = metKalibratie.segmenten.filter(s => s.zone === 'Z2' && s.standaardBlokDuurSeconden != null)
    expect(rustBlokkenMet.length).toBeGreaterThan(0)
  })

  it('regressie: niet-VO2max/anaerobe sessietypes blijven volledig ongewijzigd, ook als cpWprime toevallig wordt meegegeven', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['sweetspot_intervallen'], 'ss_klassiek') ?? ARCHETYPES_FIXTURE['sweetspot_intervallen'].find(a => a.varianten?.length)
    const variant = archetype.varianten[0]

    const zonder = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 60, ftp: 260, sessietype: 'sweetspot_intervallen',
    })
    const metCpWprimeToch = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 60, ftp: 260, sessietype: 'sweetspot_intervallen',
      cpWprime: CP_WPRIME, wbalDrempels: DREMPELS,
    })

    expect(metCpWprimeToch.segmenten).toEqual(zonder.segmenten)
    expect(metCpWprimeToch.duur_min).toBe(zonder.duur_min)
    expect(metCpWprimeToch.segmenten.every(s => s.standaardBlokDuurSeconden === undefined)).toBe(true)
  })

  it('fail-open: cpWprime null (bv. te weinig data voor D4) levert exact de archetype-standaardsessie op, geen crash', () => {
    const archetype = vindArchetypeMetVarianten(ARCHETYPES_FIXTURE['z6_anaeroob'], 'z6_standaard')
    const variant = archetype.varianten[0]

    expect(() => genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 45, ftp: 260, sessietype: 'z6_anaeroob',
      cpWprime: null, wbalDrempels: null,
    })).not.toThrow()

    const sessie = genereerSessieDeterministisch({
      dagIntentie: null, archetype, variant, doelDuurMin: 45, ftp: 260, sessietype: 'z6_anaeroob',
      cpWprime: null, wbalDrempels: null,
    })
    expect(sessie.segmenten.every(s => s.standaardBlokDuurSeconden === undefined)).toBe(true)
  })
})

describe('bepaalDoelGewicht — B6: hrvTrendTrigger/rhrTrendTrigger', () => {
  it('hrvTrendTrigger triggert gewicht 1, ook met verder gunstige tsb/hrv (zuivere OR, geen AND-afhankelijkheid)', () => {
    const gewicht = bepaalDoelGewicht({ tsb: 10, hrv: 'hoog', rpeDeltaTrend: 0, hrvTrendTrigger: true, rhrTrendTrigger: false })
    expect(gewicht).toBe(1)
  })

  it('rhrTrendTrigger triggert gewicht 1, ook met verder gunstige tsb/hrv', () => {
    const gewicht = bepaalDoelGewicht({ tsb: 10, hrv: 'normaal', rpeDeltaTrend: 0, hrvTrendTrigger: false, rhrTrendTrigger: true })
    expect(gewicht).toBe(1)
  })

  it('geen van beide trend-triggers, verder gunstige dagvorm -> ongewijzigd gedrag (gewicht 3)', () => {
    const gewicht = bepaalDoelGewicht({ tsb: 10, hrv: 'hoog', rpeDeltaTrend: 0, hrvTrendTrigger: false, rhrTrendTrigger: false })
    expect(gewicht).toBe(3)
  })

  it('ontbrekende hrvTrendTrigger/rhrTrendTrigger-velden (bestaande aanroepers die B6 niet kennen) -> ongewijzigd gedrag', () => {
    const gewicht = bepaalDoelGewicht({ tsb: 10, hrv: 'hoog', rpeDeltaTrend: 0 })
    expect(gewicht).toBe(3)
  })
})

describe('bepaalDoelGewicht — B2: herstelsnelheidTrigger', () => {
  it('herstelsnelheidTrigger triggert gewicht 1, ook met verder gunstige tsb/hrv en zonder de B6-triggers (zuivere OR)', () => {
    const gewicht = bepaalDoelGewicht({ tsb: 10, hrv: 'hoog', rpeDeltaTrend: 0, hrvTrendTrigger: false, rhrTrendTrigger: false, herstelsnelheidTrigger: true })
    expect(gewicht).toBe(1)
  })

  it('geen herstelsnelheidTrigger, verder gunstige dagvorm -> ongewijzigd gedrag (gewicht 3)', () => {
    const gewicht = bepaalDoelGewicht({ tsb: 10, hrv: 'hoog', rpeDeltaTrend: 0, herstelsnelheidTrigger: false })
    expect(gewicht).toBe(3)
  })

  it('ontbrekend herstelsnelheidTrigger-veld (bestaande aanroepers die B2 niet kennen) -> ongewijzigd gedrag', () => {
    const gewicht = bepaalDoelGewicht({ tsb: 10, hrv: 'hoog', rpeDeltaTrend: 0, hrvTrendTrigger: false, rhrTrendTrigger: false })
    expect(gewicht).toBe(3)
  })
})
