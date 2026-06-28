export const SESSIE_ARCHETYPES = {
  z2_duur: [
    {
      id: 'z2_progressief',
      naam: 'Progressieve duurrit',
      structuur: 'Verdeel in 3 gelijke delen: onderkant → midden → bovenkant Z2',
      tss_range: [55, 90],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel', 'vo2max', 'consolidatie', 'taper'],
    },
    {
      id: 'z2_negatief_split',
      naam: 'Negatieve splits',
      structuur: 'Eerste helft onderkant Z2, tweede helft bovenkant Z2',
      tss_range: [55, 85],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel', 'vo2max', 'consolidatie', 'taper'],
    },
    {
      id: 'z2_variabel_blokken',
      naam: 'Variabele blokken',
      structuur: '15 min onderkant / 10 min bovenkant Z2, herhaald door de rit',
      tss_range: [60, 90],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel', 'vo2max', 'consolidatie', 'taper'],
    },
    {
      id: 'z2_golf',
      naam: 'Golfpatroon',
      structuur: '8 min oplopend naar bovenkant Z2 → 5 min terugzakken, herhaald',
      tss_range: [60, 95],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel', 'vo2max', 'consolidatie', 'taper'],
    },
    {
      id: 'z2_tempo_blokken',
      naam: 'Z2 met temposnippers',
      structuur: 'Duurrit met 3–4 ingekapselde Z3-blokken van 5–8 min, rest Z2',
      tss_range: [70, 105],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 3,
    },
  ],

  sweetspot_intervallen: [
    {
      id: 'ss_standaard',
      naam: 'Sweetspot standaard',
      structuur: '3× [15–20 min @ 88–93% FTP], 5 min Z2 herstel',
      tss_range: [70, 95],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'ss_lang',
      naam: 'Lang sweetspot blok',
      structuur: '2× [25–35 min @ 86–92% FTP], 8 min Z2 herstel',
      tss_range: [75, 105],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'ss_oplopend',
      naam: 'Oplopende sweetspot',
      structuur: '4× [12 min] oplopend 85→87→89→91% FTP, 4 min Z2',
      tss_range: [70, 95],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'ss_afdalend',
      naam: 'Afdalende sweetspot',
      structuur: '4× [12 min] afdalend 93→91→89→87% FTP, 4 min Z2',
      tss_range: [70, 95],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'ss_kort_veel',
      naam: 'Veel korte sweetspotblokken',
      structuur: '6–8× [8 min @ 90% FTP], 3 min Z2 herstel',
      tss_range: [70, 100],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
  ],

  tempo_intervallen: [
    {
      id: 'tempo_continu',
      naam: 'Tempo continu',
      structuur: '25–40 min aaneengesloten @ 78–85% FTP',
      tss_range: [60, 90],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'tempo_intervallen',
      naam: 'Tempo-intervallen',
      structuur: '4–5× [10–12 min @ 80–88% FTP], 3 min Z2 herstel',
      tss_range: [65, 90],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
    },
  ],

  over_under: [
    {
      id: 'ou_standaard',
      naam: 'Over-unders standaard',
      structuur: '6× [2 min @ 88% → 1 min @ 105% FTP], 4 min Z2 herstel',
      tss_range: [70, 90],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 5,
    },
    {
      id: 'ou_lang',
      naam: 'Lange over-unders',
      structuur: '4× [3 min @ 88% → 2 min @ 103% FTP], 5 min Z2 herstel',
      tss_range: [75, 100],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 5,
    },
  ],

  pyramide: [
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
  ],

  vo2max_intervallen: [
    {
      id: 'vo2_5x5',
      naam: 'Klassieke 5×5',
      structuur: '5× [5 min @ 106–115% FTP], 5 min Z2 herstel',
      tss_range: [70, 90],
      fase_beschikbaar: ['vo2max', 'consolidatie'],
    },
    {
      id: 'vo2_4x4',
      naam: 'Rønnestad 4×4',
      structuur: '4× [4 min @ 110–120% FTP], 4 min Z2 herstel',
      tss_range: [60, 80],
      fase_beschikbaar: ['vo2max', 'consolidatie'],
    },
    {
      id: 'vo2_kort',
      naam: 'Korte intervallen',
      structuur: '10–12× [1 min @ 120–130% FTP], 2 min Z2 herstel',
      tss_range: [55, 80],
      fase_beschikbaar: ['vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'vo2_lang',
      naam: 'Lange VO2max-blokken',
      structuur: '3× [7–8 min @ 106–112% FTP], 7 min Z2 herstel',
      tss_range: [75, 100],
      fase_beschikbaar: ['vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'vo2_oplopend',
      naam: 'Oplopende VO2max',
      structuur: '5× [3 min] oplopend 106→109→112→115→118% FTP, 4 min Z2',
      tss_range: [65, 85],
      fase_beschikbaar: ['vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'vo2_klim',
      naam: 'Klimsimulatie',
      structuur: '6× [3 min @ 112–120% FTP], 5 min Z2 herstel',
      tss_range: [60, 85],
      fase_beschikbaar: ['vo2max', 'consolidatie'],
      week_in_fase_min: 2,
      doel_beperking: ['klimmen'],
    },
  ],

  sprint_neuraal: [
    {
      id: 'sprint_kort',
      naam: 'Korte sprints',
      structuur: '8–10× [10 sec maximaal @ Z7], 3 min Z1 volledig herstel',
      tss_range: [30, 45],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel', 'vo2max', 'consolidatie'],
    },
    {
      id: 'sprint_lang',
      naam: 'Langere sprints',
      structuur: '6–8× [15 sec maximaal @ Z7], 4 min Z1 volledig herstel',
      tss_range: [35, 50],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel', 'vo2max', 'consolidatie'],
      week_in_fase_min: 2,
    },
    {
      id: 'sprint_ingebed',
      naam: 'Embedded sprints',
      structuur: 'Z2-duurrit met 5–7 max-sprints van 8–12 sec op willekeurige momenten',
      tss_range: [60, 85],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel', 'vo2max', 'consolidatie'],
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
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max'],
    },
    {
      id: 'raketstart',
      naam: 'Raketstart',
      structuur: '3× 10 sec max sprint met volledig herstel → 20 min sweetspot → 5 min tempo',
      tss_range: [55, 80],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max'],
    },
    {
      id: 'omgekeerde_wereld',
      naam: 'Omgekeerde wereld',
      structuur: '2× 4 min VO2max direct na opwarming → 15 min sweetspot → 1× 4 min VO2max',
      tss_range: [65, 85],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max'],
    },
    {
      id: 'pieken_en_dalen',
      naam: 'Pieken en dalen',
      structuur: '8 min Z2 → 8 min sweetspot → 8 min Z2 → 8 min drempel → 8 min Z2, continu',
      tss_range: [60, 80],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max'],
    },
    {
      id: 'klim_simulator',
      naam: 'Klimsimulator',
      structuur: '4× [2 min sweetspot → 30 sec VO2max → 10 sec sprint], 5 min Z2 ertussen',
      tss_range: [65, 85],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max'],
    },
    {
      id: 'negatieve_vermoeidheid',
      naam: 'Negatieve vermoeidheid',
      structuur: '3× 5 min drempel, 3 min herstel → 4× 2 min VO2max, 2 min herstel',
      tss_range: [70, 90],
      fase_beschikbaar: ['sweetspot', 'drempel', 'vo2max'],
    },
  ],
};

/**
 * Geeft gefilterde archetypes voor sessietype + fase + weekInFase.
 * Filtert ook op doel_beperking als seizoensdoel meegegeven.
 */
export function getArchetypesVoorSessietype(sessietype, fase, weekInFase = 1, seizoensdoel = null) {
  const alle = SESSIE_ARCHETYPES[sessietype] ?? [];
  return alle.filter(a => {
    if (!a.fase_beschikbaar.includes(fase)) return false;
    if ((a.week_in_fase_min ?? 1) > weekInFase) return false;
    if (a.doel_beperking && seizoensdoel && !a.doel_beperking.includes(seizoensdoel)) return false;
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
