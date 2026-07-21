import { describe, it, expect, beforeEach } from 'vitest'
import { genereerSessieDag } from '../sessie/genereren.js'
import { PRIORITEIT_PER_FASE } from '../sessie/weekSolver.js'
import { _wisArchetypeCacheVoorTests } from '../sessie-archetypes.js'
import { _wisWbalDrempelsCacheVoorTests } from '../wbalDrempels.js'
import { ARCHETYPES_FIXTURE } from './fixtures/archetypesFixture.js'

// De module-level archetype-cache (sessie-archetypes.js) en de wbal-drempels-
// cache (wbalDrempels.js, D5) moeten vóór elke test leeg zijn — anders lekt de
// mock-KV-data van de ene test naar de volgende (TTL is 5 min, ruim langer
// dan het hele testbestand duurt).
beforeEach(() => {
  _wisArchetypeCacheVoorTests()
  _wisWbalDrempelsCacheVoorTests()
})

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

describe('genereerSessieDag — compliance-freeze (C3/C4/C5)', () => {
  // vo2max_intervallen/drempel-fase/doel=klimmen is dezelfde, elders in dit
  // bestand al gevalideerde combinatie (zie de fase-dekkingsregressietest
  // hierboven, "klimmen's drempel-fase wijst vo2max_intervallen toe").
  const freezeCtx = {
    ...basisCtx,
    plan: { seizoensdoel: { type: 'klimmen' } },
    huidigeFase: 'drempel',
    weekInFase: 3,
    effectiefSessietype: 'vo2max_intervallen',
    oudeSessie: { intentie: { sessietype: 'vo2max_intervallen' } },
    // Klein genoeg t.o.v. het archetype-plafond zodat effectieveDuurMin() de
    // beperkende factor is (min(beschikbaar, plafond)), niet de
    // Z2-verlenging/TSS-ondergrens-correctie verderop in de generatie-pijplijn
    // — anders wordt het duur-effect van de freeze daardoor gemaskeerd.
    uren: 0.5,
  }

  it('actief-gate: een INACTIEF freeze-record met een oude laatsteTriggerDatum beïnvloedt de sessie niet', async () => {
    const kvOnbevroren = maakKv()
    const sessieOnbevroren = await genereerSessieDag({ ...freezeCtx, kv: kvOnbevroren })

    const kvMetOudeVlag = maakKv({
      'compliance_freeze:test_user': { actief: false, laatsteTriggerDatum: '2020-01-01' },
    })
    const sessieMetOudeVlag = await genereerSessieDag({ ...freezeCtx, kv: kvMetOudeVlag })

    expect(sessieMetOudeVlag.duur_min).toBe(sessieOnbevroren.duur_min)
  })

  it('actief=true, ECHTE route (kv.get("compliance_freeze:..."), geen handmatig doorgegeven bevrorenWeekInFase): zowel duur (effectieveDuurMin) als TSS (schatTssDoel) bevriezen consistent in dezelfde aanroep — dekt de exacte bug-vorm uit het plan (duur bevriest, TSS groeit los door)', async () => {
    const kvOnbevroren = maakKv()
    const sessieOnbevroren = await genereerSessieDag({ ...freezeCtx, kv: kvOnbevroren })

    // laatsteTriggerDatum valt op dezelfde datum als de sessie zelf -> zonder
    // plan.kader/startdatum (basisCtx heeft die niet) valt weekInFaseVoorDatum()
    // terug op 1 (weekgrenzen.js: "if (!kaderWeek || !kader) return 1"). Het
    // freeze-record wordt hier uitsluitend via kv.get() gelezen door
    // genereerSessieDag zelf — geen enkele test-aanroep geeft bevrorenWeekInFase
    // rechtstreeks door.
    const kvBevroren = maakKv({
      'compliance_freeze:test_user': { actief: true, laatsteTriggerDatum: freezeCtx.datum },
    })
    const sessieBevroren = await genereerSessieDag({ ...freezeCtx, kv: kvBevroren })

    // Concrete, empirisch bepaalde waarden (niet alleen een relatieve
    // vergelijking) — vastgelegd zodat een regressie waarbij één van beide
    // dimensies stilzwijgend loskoppelt van de freeze wordt opgemerkt.
    expect(sessieOnbevroren.duur_min).toBe(30)
    expect(sessieBevroren.duur_min).toBe(25)
    expect(sessieBevroren.duur_min).toBeLessThan(sessieOnbevroren.duur_min)

    // TSS-doel (schatTssDoel-uitkomst, vóór archetype-ondergrens-correctie)
    expect(sessieOnbevroren.intentie.tss_doel).toBe(45)
    expect(sessieBevroren.intentie.tss_doel).toBe(35)
    expect(sessieBevroren.intentie.tss_doel).toBeLessThan(sessieOnbevroren.intentie.tss_doel)

    // Daadwerkelijke sessie-TSS (ná archetype-ondergrens-correctie) — blijft
    // óók lager bevroren, dus de freeze overleeft de volledige generatie-
    // pijplijn, niet alleen de kale schatTssDoel()-uitkomst.
    expect(sessieOnbevroren.tss).toBe(45)
    expect(sessieBevroren.tss).toBe(38)
    expect(sessieBevroren.tss).toBeLessThan(sessieOnbevroren.tss)
  })

  it('een leesfout op het freeze-record blokkeert de generatie niet (fail-open)', async () => {
    const kv = maakKv()
    kv.get = async (k) => {
      if (k === 'compliance_freeze:test_user') throw new Error('KV-storing (simulatie)')
      return kv.store.get(k) ?? null
    }
    const sessie = await genereerSessieDag({ ...freezeCtx, kv })
    expect(sessie.gegenereerd_door).toBe('deterministisch')
  })
})

describe('genereerSessieDag — D5: CP/W-kalibratie end-to-end', () => {
  const vo2maxCtx = {
    ...basisCtx,
    uren: 1,
    effectiefSessietype: 'vo2max_intervallen',
    oudeSessie: { intentie: { sessietype: 'vo2max_intervallen' } },
    huidigeFase: 'vo2max',
  }

  it('krijgt gekalibreerde werk-/rustblokken (standaardBlokDuurSeconden) wanneer cp_wprime_trend beschikbaar is in KV', async () => {
    const kv = maakKv()
    await kv.set(`cp_wprime_trend:${vo2maxCtx.userId}`, [
      { datum: '2026-07-01', criticalPower: 230, wPrime: 20000, pMax: 800, modelEftp: 240 },
    ])
    const sessie = await genereerSessieDag({ ...vo2maxCtx, kv })

    const gekalibreerd = sessie.segmenten.filter(s => s.standaardBlokDuurSeconden != null)
    expect(gekalibreerd.length).toBeGreaterThan(0)
  })

  it('fail-open: geen cp_wprime_trend in KV (te weinig D4-data) -> archetype-standaardduur, geen crash', async () => {
    const kv = maakKv()
    const sessie = await genereerSessieDag({ ...vo2maxCtx, kv })

    expect(sessie.gegenereerd_door).toBe('deterministisch')
    expect(sessie.segmenten.every(s => s.standaardBlokDuurSeconden == null)).toBe(true)
  })

  it('regressie: een niet-VO2max/anaerobe sessie leest cp_wprime_trend niet uit KV, ook als het toevallig aanwezig is', async () => {
    const kv = maakKv()
    await kv.set('cp_wprime_trend:test_user', [{ datum: '2026-07-01', criticalPower: 230, wPrime: 20000 }])
    const kvGetSpy = []
    const origGet = kv.get
    kv.get = async (k) => { kvGetSpy.push(k); return origGet(k) }

    const sessie = await genereerSessieDag({
      ...basisCtx, kv,
      effectiefSessietype: 'z2_duur',
      oudeSessie: { intentie: { sessietype: 'z2_duur' } },
    })

    expect(sessie.segmenten.every(s => s.standaardBlokDuurSeconden == null)).toBe(true)
    expect(kvGetSpy).not.toContain('cp_wprime_trend:test_user')
  })
})
