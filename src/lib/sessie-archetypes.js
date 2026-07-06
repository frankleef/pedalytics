import { getKV } from "./kv";

// SESSIE_ARCHETYPES is vanaf de KV-migratie (admin sessie-archetype-beheer) geen
// runtime-databron meer — de enige bron is KV (archetypes:{sessietype}), gevuld
// door /api/admin/migreer-archetypes-naar-kv. Deze constante blijft uitsluitend
// bestaan als (a) seed-data voor dat migratiescript en (b) fixture voor de
// 125-varianten-regressietest (sectie 46, samen met sessie-varianten.js) — geen
// enkel generatiepad importeert 'm nog.
export const SESSIE_ARCHETYPES = {
  z2_duur: [
    {
      id: 'z2_progressief',
      naam: 'Progressieve duurrit',
      structuur: 'Verdeel in 3 gelijke delen: onderkant → midden → bovenkant Z2',
      tss_range: [55, 90],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
    },
    {
      id: 'z2_negatief_split',
      naam: 'Negatieve splits',
      structuur: 'Eerste helft onderkant Z2, tweede helft bovenkant Z2',
      tss_range: [55, 85],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
    },
    {
      id: 'z2_variabel_blokken',
      naam: 'Variabele blokken',
      structuur: '15 min onderkant / 10 min bovenkant Z2, herhaald door de rit',
      tss_range: [60, 90],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
    },
    {
      id: 'z2_golf',
      naam: 'Golfpatroon',
      structuur: '8 min oplopend naar bovenkant Z2 → 5 min terugzakken, herhaald',
      tss_range: [60, 95],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
    },
    {
      id: 'z2_tempo_blokken',
      naam: 'Z2 met temposnippers',
      structuur: 'Duurrit met 3–4 ingekapselde Z3-blokken van 5–8 min, rest Z2',
      tss_range: [70, 105],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      week_in_fase_min: 3,
    },
    {
      id: 'z2_cadans',
      naam: 'Cadansvariatie',
      structuur: 'Blokken met verschillende cadans én vermogen binnen Z2',
      tss_range: [55, 90],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
    },
    {
      id: 'z2_heuvel',
      naam: 'Heuvelsimulatie',
      structuur: '6× [6 min hogere Z2-fractie + 5 min lagere Z2-fractie] — simuleert glooiend terrein binnen Z2',
      tss_range: [60, 95],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
    },
    {
      id: 'z2_tempo_teugjes',
      naam: 'Tempo-teugjes',
      structuur: '4× [10 min 78–82% FTP + 8 min 58–65% FTP] — bovenkant Z2 afgewisseld met diep herstel',
      tss_range: [65, 95],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      vereist_lage_decoupling: true,
    },
  ],

  sweetspot_intervallen: [
    {
      id: 'tempo_continu',
      naam: 'Tempo continu',
      structuur: '25–40 min aaneengesloten @ 76–85% FTP',
      tss_range: [60, 90],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'tempo_intervallen',
      naam: 'Tempo intervallen',
      structuur: '4–5× [10–12 min @ 78–87% FTP], 3 min Z2 herstel',
      tss_range: [65, 90],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'ss_standaard',
      naam: 'Sweetspot standaard',
      structuur: '3× [15–20 min @ 88–93% FTP], 5 min Z2 herstel',
      tss_range: [70, 95],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'ss_lang',
      naam: 'Lang sweetspot blok',
      structuur: '2× [25–35 min @ 86–92% FTP], 8 min Z2 herstel',
      tss_range: [75, 105],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
    },
    {
      id: 'ss_oplopend',
      naam: 'Oplopende sweetspot',
      structuur: '4× [12 min] oplopend 85→87→89→91% FTP, 4 min Z2',
      tss_range: [70, 95],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'ss_afdalend',
      naam: 'Afdalende sweetspot',
      structuur: '4× [12 min] afdalend 93→91→89→87% FTP, 4 min Z2',
      tss_range: [70, 95],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'ss_kort_veel',
      naam: 'Veel korte sweetspotblokken',
      structuur: '6–8× [8 min @ 90% FTP], 3 min Z2 herstel',
      tss_range: [70, 100],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
    },
  ],

  kracht_lage_cadans: [
    {
      id: 'kracht_standaard',
      naam: 'Lage-cadans kracht',
      structuur: '4–5× [5 min @ 88–95% FTP, 48–58 rpm], 3 min Z2 herstel',
      tss_range: [55, 75],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel'],
      doel_beperking: ['klimmen', 'ftp', 'sprint'],
    },
    {
      id: 'kracht_lang',
      naam: 'Lage-cadans kracht lang',
      structuur: '4–5× [7 min @ 88–95% FTP, 48–58 rpm], 3 min Z2 herstel',
      tss_range: [65, 85],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel'],
      week_in_fase_min: 2,
      doel_beperking: ['klimmen', 'ftp', 'sprint'],
    },
  ],

  drempel_intervallen: [
    {
      id: 'drempel_standaard',
      naam: 'Drempel standaard',
      structuur: '3× [15–20 min @ 95–105% FTP], 4 min Z2 herstel',
      tss_range: [75, 100],
      fase_beschikbaar: ['drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'drempel_kort_veel',
      naam: 'Veel korte drempelblokken',
      structuur: '6–8× [6–8 min @ 98–105% FTP], 3 min Z2 herstel',
      tss_range: [70, 100],
      fase_beschikbaar: ['drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'drempel_lang',
      naam: 'Lang drempelblok',
      structuur: '1–2× [25–35 min @ 92–98% FTP]',
      tss_range: [80, 110],
      fase_beschikbaar: ['drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'drempel_oplopend',
      naam: 'Oplopende drempel',
      structuur: '3× [12 min] oplopend 93→98→103% FTP, 5 min Z2 herstel',
      tss_range: [75, 100],
      fase_beschikbaar: ['drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'drempel_afdalend',
      naam: 'Afdalende drempel',
      structuur: '3× [12 min] afdalend 103→98→93% FTP, 5 min Z2 herstel',
      tss_range: [75, 100],
      fase_beschikbaar: ['drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'drempel_wisselend',
      naam: 'Wisselende drempel',
      structuur: '1× [20 min @ 94%] + 1× [8 min @ 102% FTP], 5 min Z2 herstel',
      tss_range: [80, 105],
      fase_beschikbaar: ['drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'ou_standaard',
      naam: 'Over-unders',
      structuur: '6× [2 min @ 88% → 1 min @ 105% FTP], 4 min Z2 herstel',
      tss_range: [70, 90],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'ou_lang',
      naam: 'Lange over-unders',
      structuur: '4× [3 min @ 88% → 2 min @ 103% FTP], 5 min Z2 herstel',
      tss_range: [75, 100],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'pyr_oplopend',
      naam: 'Pyramide oplopend',
      structuur: '2m–4m–6m @ drempel, 2 min Z2 tussenin',
      tss_range: [75, 95],
      fase_beschikbaar: ['drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'pyr_volledig',
      naam: 'Volledige pyramide',
      structuur: '2m–4m–6m–4m–2m @ drempel, 2 min Z2 tussenin',
      tss_range: [80, 105],
      fase_beschikbaar: ['drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
  ],

  vo2max_intervallen: [
    {
      id: 'vo2_5x5',
      naam: 'Klassieke 5×5',
      structuur: '5× [5 min @ 106–115% FTP], 5 min Z2 herstel',
      tss_range: [70, 90],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'vo2_4x4',
      naam: 'Rønnestad 4×4',
      structuur: '4× [4 min @ 110–120% FTP], 4 min Z2 herstel',
      tss_range: [60, 80],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'vo2_kort',
      naam: 'Korte intervallen',
      structuur: '10–12× [1 min @ 120–130% FTP], 2 min Z2 herstel',
      tss_range: [55, 80],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
    },
    {
      id: 'vo2_lang',
      naam: 'Lange VO2max-blokken',
      structuur: '3× [7–8 min @ 106–112% FTP], 7 min Z2 herstel',
      tss_range: [75, 100],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
    },
    {
      id: 'vo2_oplopend',
      naam: 'Oplopende VO2max',
      structuur: '5× [3 min] oplopend 106→109→112→115→118% FTP, 4 min Z2',
      tss_range: [65, 85],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
    },
    {
      id: 'vo2_klim',
      naam: 'Klimsimulatie',
      structuur: '6× [3 min @ 112–120% FTP], 5 min Z2 herstel',
      tss_range: [60, 85],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      doel_beperking: ['klimmen'],
    },
    {
      id: 'vo2_microbursts',
      naam: 'Microbursts',
      structuur: '15–20× [15 sec @ 120–130% FTP + 15 sec Z2] — geen volledig herstel, traint snelle VO2-kinetiek',
      tss_range: [60, 85],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
    },
    {
      id: 'vo2_4020',
      naam: "40/20's",
      structuur: '20× [40 sec @ 120% FTP + 20 sec Z2] — snel Z5 in en uit',
      tss_range: [60, 80],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
    },
  ],

  sprint_neuraal: [
    {
      id: 'sprint_kort',
      naam: 'Korte sprints',
      structuur: '8–10× [10 sec maximaal @ Z7], 3 min Z1 volledig herstel',
      tss_range: [30, 45],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
    },
    {
      id: 'sprint_lang',
      naam: 'Langere sprints',
      structuur: '6–8× [15 sec maximaal @ Z7], 4 min Z1 volledig herstel',
      tss_range: [35, 50],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      week_in_fase_min: 2,
    },
    {
      id: 'sprint_ingebed',
      naam: 'Embedded sprints',
      structuur: 'Z2-duurrit met 5–7 max-sprints van 8–12 sec op willekeurige momenten',
      tss_range: [60, 85],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
    },
  ],

  z6_anaeroob: [
    {
      id: 'z6_standaard',
      naam: 'Anaeroob standaard',
      structuur: '5× [40 sec @ 135–150% FTP], 5 min Z1 volledig herstel',
      tss_range: [50, 70],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
      doel_beperking: ['sprint', 'klimmen'],
    },
  ],

  // Vrijheidsarchetypes — uitsluitend geactiveerd door de vrijheidsdag-check
  gemengd: [
    {
      id: 'alles_mag',
      naam: 'Alles mag',
      structuur: '3× 6 sec sprint → 2 min VO2max → 4 min drempel → 8 min tempo, na opwarming',
      tss_range: [60, 85],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'raketstart',
      naam: 'Raketstart',
      structuur: '3× 10 sec max sprint met volledig herstel → 20 min sweetspot → 5 min tempo',
      tss_range: [55, 80],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'omgekeerde_wereld',
      naam: 'Omgekeerde wereld',
      structuur: '2× 4 min VO2max direct na opwarming → 15 min sweetspot → 1× 4 min VO2max',
      tss_range: [65, 85],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'pieken_en_dalen',
      naam: 'Pieken en dalen',
      structuur: '8 min Z2 → 8 min sweetspot → 8 min Z2 → 8 min drempel → 8 min Z2, continu',
      tss_range: [60, 80],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'klim_simulator',
      naam: 'Klimsimulator',
      structuur: '4× [2 min sweetspot → 30 sec VO2max → 10 sec sprint], 5 min Z2 ertussen',
      tss_range: [65, 85],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'negatieve_vermoeidheid',
      naam: 'Negatieve vermoeidheid',
      structuur: '3× 5 min drempel, 3 min herstel → 4× 2 min VO2max, 2 min herstel',
      tss_range: [70, 90],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
    },
    {
      id: 'race_simulatie',
      naam: 'Race simulatie',
      structuur: '10 min Z2 → 2× [3 min drempel + 1 min sprint] → 15 min sweetspot → 2× [2 min VO2max + 30 sec sprint] → 10 min Z2 uitrollen',
      tss_range: [75, 100],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
    },
  ],
};

export const GELDIGE_SESSIETYPES = new Set([
  'z2_duur', 'sweetspot_intervallen', 'kracht_lage_cadans',
  'drempel_intervallen', 'vo2max_intervallen',
  'sprint_neuraal', 'z6_anaeroob', 'gemengd',
]);

export const SESSIETYPE_MIGRATIE = {
  'z2_vlak':            'z2_duur',
  'z2_variabel':        'z2_duur',
  'z2_cadans':          'z2_duur',
  'z2_steady':          'z2_duur',
  'z2_lang':            'z2_duur',
  'over_under':         'drempel_intervallen',
  'pyramide':           'drempel_intervallen',
  'tempo_intervallen':  'sweetspot_intervallen',
  'z2_embedded_sprint': 'sprint_neuraal',
  'sweetspot_lang':     'sweetspot_intervallen',
  'vo2max_lang':        'vo2max_intervallen',
  'vo2max_kort':        'vo2max_intervallen',
  'progressief':        'z2_duur',
};

/**
 * TEST_SESSIETYPES en HERSTEL_SESSIETYPES zijn bewust UITGESLOTEN van de
 * archetypelogica. Dit zijn geen trainingssessies met variatiebehoefte:
 *
 * - Tests (ramp_test, sprint_peak_test) hebben een vaste, gestandaardiseerde
 *   structuur nodig voor meetbare, vergelijkbare resultaten over tijd.
 *   Variatie zou de testresultaten onbetrouwbaar maken.
 *
 * - Herstelsessies (z1_herstel, herstel_actief, herstel_mobiliteit) zijn
 *   bewust simpel en voorspelbaar — het doel is actief herstel, niet
 *   afwisseling. Variatie zou hier geen waarde toevoegen.
 */
export const TEST_SESSIETYPES = new Set([
  'ramp_test',
  'sprint_peak_test',
]);

export const HERSTEL_SESSIETYPES = new Set([
  'z1_herstel',
  'herstel_actief',
  'herstel_mobiliteit',
]);

export function valideerSessietype(sessietype) {
  if (!sessietype) return false;
  return GELDIGE_SESSIETYPES.has(sessietype);
}

export function migreesSessietype(sessietype) {
  if (!sessietype) return null;
  if (GELDIGE_SESSIETYPES.has(sessietype)) return sessietype;
  if (TEST_SESSIETYPES.has(sessietype)) return sessietype;
  if (HERSTEL_SESSIETYPES.has(sessietype)) return sessietype;
  return SESSIETYPE_MIGRATIE[sessietype] ?? null;
}

/**
 * Kiest een archetype op basis van rotatie (pure functie, geen KV-afhankelijkheid).
 * Vermijdt het meest recent gebruikte archetype (recenteArchetypes[0]).
 * Geeft voorkeur aan archetypes die nog niet recent zijn gebruikt.
 * Als alle archetypes recent zijn, kiest de minst recente.
 * @param {Array} archetypes - Beschikbare archetypes (gefilterd op fase/week)
 * @param {string[]} recenteArchetypes - Meest recent gebruikt (index 0 = meest recent), max 3
 * @returns {object|null} Gekozen archetype of null als geen beschikbaar
 */
export function selecteerArchetype(archetypes, recenteArchetypes) {
  if (!archetypes || archetypes.length === 0) return null;
  const meestRecent = recenteArchetypes[0] ?? null;
  const kandidaten = archetypes.filter(a => a.id !== meestRecent);
  if (kandidaten.length === 0) return archetypes[0];
  const nieuweKandidaten = kandidaten.filter(a => !recenteArchetypes.includes(a.id));
  if (nieuweKandidaten.length > 0) {
    return nieuweKandidaten[Math.floor(Math.random() * nieuweKandidaten.length)];
  }
  kandidaten.sort((a, b) => {
    const posA = recenteArchetypes.indexOf(a.id);
    const posB = recenteArchetypes.indexOf(b.id);
    return posB - posA;
  });
  return kandidaten[0];
}

const Z1_TOEGESTANE_SESSIETYPES = new Set(['sprint_neuraal', 'z6_anaeroob', 'kracht_lage_cadans']);
const Z1_TOEGESTANE_GEMENGD_ARCHETYPES = new Set(['alles_mag', 'raketstart', 'klim_simulator']);

/**
 * Valideert of Z1-blokken zijn toegestaan voor het gegeven sessietype/archetype.
 */
export function valideerZ1Gebruik(blokken, sessietype, archetypeId = null) {
  if (Z1_TOEGESTANE_SESSIETYPES.has(sessietype)) return true;
  if (sessietype === 'gemengd' && archetypeId && Z1_TOEGESTANE_GEMENGD_ARCHETYPES.has(archetypeId)) return true;
  const overtredend = (blokken || []).find(b => b.zone === 'Z1');
  if (overtredend) {
    console.error(`[sessie-archetypes] Z1-blok in sessietype "${sessietype}" — niet toegestaan.`, overtredend);
    return false;
  }
  return true;
}

// ─── KV-cache-laag (admin sessie-archetype-beheer) ──────────────────────────
// Archetypes zijn globale content (geen userId in de sleutel) — de cache is dus
// module-level en gedeeld over alle gebruikers binnen één serverless-instance.
const archetypeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Haalt de archetypes voor één sessietype op uit KV (cache-first, TTL 5 min).
 * Elk element bevat zowel metadata (fase_beschikbaar, tss_range, ...) als de
 * concrete varianten/blokken — samengevoegd door het migratiescript.
 * Lege/ontbrekende KV-waarde -> lege array, nooit een crash (bestaande,
 * afgehandelde situatie in de rotatielogica hieronder).
 *
 * @param {string} sessietype
 * @param {object} [kv] - injectable KV-client (default: getKV()) — zelfde
 *   patroon als getRecenteArchetypes/slaArchetypeOp hieronder, zodat tests een
 *   in-memory mock kunnen meegeven i.p.v. de echte KV te raken.
 */
export async function getArchetypesVoorSessietypeRaw(sessietype, kv = getKV()) {
  const cached = archetypeCache.get(sessietype);
  if (cached && Date.now() - cached.opgehaaldOp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = (await kv.get(`archetypes:${sessietype}`)) ?? [];
  archetypeCache.set(sessietype, { data, opgehaaldOp: Date.now() });
  return data;
}

/**
 * Haalt alle 8 sessietypes in één keer op (cache-first per sessietype) — voor
 * callers die met meerdere sessietypes tegelijk werken (bv. de client-side
 * alternatief-/weeksolver-logica, die zelf pure/sync blijft en deze data als
 * parameter meekrijgt via GET /api/archetypes in plaats van zelf KV te lezen).
 * @param {object} [kv] - injectable KV-client (default: getKV())
 * @returns {Promise<Object<string, Array>>}
 */
export async function getAlleArchetypesRaw(kv = getKV()) {
  const paren = await Promise.all(
    [...GELDIGE_SESSIETYPES].map(async (t) => [t, await getArchetypesVoorSessietypeRaw(t, kv)])
  );
  return Object.fromEntries(paren);
}

/** Forceert een verse KV-read bij de volgende aanroep voor dit sessietype. */
export function invalideerArchetypeCache(sessietype) {
  archetypeCache.delete(sessietype);
}

/**
 * Wist de volledige cache (alle sessietypes) — uitsluitend voor testgebruik,
 * zodat opeenvolgende tests met verschillende mock-KV-instances elkaars
 * gecachete resultaten niet lekken (de cache is module-level en overleeft
 * anders de TTL (5 min) ruimschoots binnen één testbestand).
 */
export function _wisArchetypeCacheVoorTests() {
  archetypeCache.clear();
}

/**
 * Filtert archetypes (al opgehaald voor één sessietype, zie
 * getArchetypesVoorSessietypeRaw) op fase + weekInFase + seizoensdoel +
 * beschikbareDuurMin. Pure, synchrone functie — geen KV-afhankelijkheid —
 * zodat 'm ook client-side (browser) aanroepbaar blijft zonder server-omweg.
 * De caller is verantwoordelijk voor het aanleveren van de juiste,
 * al-opgehaalde array.
 *
 * @param {Array} archetypes - archetypes voor één sessietype (uit KV of fixture)
 * @param {string} fase
 * @param {number} [weekInFase]
 * @param {string|null} [seizoensdoel]
 * @param {number|null} [beschikbareDuurMin] - beschikbare tijd voor de dag; een
 *   archetype met a.min_duur_min groter dan dit valt weg (bv. een archetype met
 *   een vast blok van 30 min heeft simpelweg niet genoeg ruimte in 45 min).
 *   null/ontbrekend = geen duurfilter (bestaand gedrag, backward-compatible).
 */
export function getArchetypesVoorSessietype(archetypes, fase, weekInFase = 1, seizoensdoel = null, beschikbareDuurMin = null) {
  const alle = archetypes ?? [];
  return alle.filter(a => {
    if (!a.fase_beschikbaar.includes(fase)) return false;
    // Over-unders: sweetspot alleen vanaf week 5, drempel/vo2max/consolidatie altijd
    if (['ou_standaard', 'ou_lang'].includes(a.id)) {
      if (fase === 'sweetspot' && weekInFase < 5) return false;
    } else {
      if ((a.week_in_fase_min ?? 1) > weekInFase) return false;
      if (a.doel_beperking && seizoensdoel && !a.doel_beperking.includes(seizoensdoel)) return false;
    }
    if (a.min_duur_min != null && beschikbareDuurMin != null && beschikbareDuurMin < a.min_duur_min) return false;
    return true;
  });
}

/**
 * Haalt de recente 3 archetype-ids op uit KV voor dit sessietype.
 */
export async function getRecenteArchetypes(kv, userId, sessietype) {
  try {
    return await kv.get(`sessie_archetypes:${userId}:${sessietype}`) ?? [];
  } catch {
    return [];
  }
}

/**
 * Slaat gekozen archetype-id op (FIFO, max 3).
 */
export async function slaArchetypeOp(kv, userId, sessietype, archetypeId) {
  try {
    const key = `sessie_archetypes:${userId}:${sessietype}`;
    const recent = await kv.get(key) ?? [];
    const bijgewerkt = [archetypeId, ...recent].slice(0, 3);
    await kv.set(key, bijgewerkt);
  } catch (e) {
    console.warn('slaArchetypeOp KV-fout:', e);
  }
}

/**
 * Eenmalige KV-migratie: verplaatst opgeslagen archetype-state van
 * sessie_archetypes:{userId}:z2_variabel naar z2_duur.
 */
export async function migreerZ2VariabelNaarDuur(kv, userId) {
  const oudeSleutel = `sessie_archetypes:${userId}:z2_variabel`;
  const nieuweSleutel = `sessie_archetypes:${userId}:z2_duur`;
  try {
    const bestaand = await kv.get(oudeSleutel);
    if (bestaand) {
      await kv.set(nieuweSleutel, bestaand);
      await kv.delete(oudeSleutel);
      console.log(`KV gemigreerd: ${oudeSleutel} → ${nieuweSleutel}`);
    }
  } catch (e) {
    console.warn('KV-migratie z2_variabel mislukt:', e);
  }
}
