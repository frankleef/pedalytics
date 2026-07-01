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
} from '../sessie-generatie.js'
import { SESSIE_ARCHETYPES as VARIANT_ARCHETYPES } from '../sessie-varianten.js'

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
    const gevonden = vindArchetypeMetVarianten('z2_duur', 'z2_progressief')
    expect(gevonden).not.toBeNull()
    expect(gevonden.varianten.length).toBeGreaterThan(0)
  })

  it('retourneert null voor een archetype zonder variantendata (fallback naar Claude)', () => {
    expect(vindArchetypeMetVarianten('z2_duur', 'z2_heuvel')).toBeNull()
    expect(vindArchetypeMetVarianten('z2_duur', 'bestaat_niet')).toBeNull()
  })
})

describe('genereerSessieDeterministisch', () => {
  const archetype = vindArchetypeMetVarianten('z2_duur', 'z2_progressief')
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
