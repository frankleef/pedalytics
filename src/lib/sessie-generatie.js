// Deterministische sessiegeneratie op basis van archetype + variant (sectie 46).
// Varianten (concrete blokken, pct_ftp, duur_pct) staan in sessie-varianten.js.
// Archetype-metadata (fase/week-filtering, rotatie) staat in sessie-archetypes.js.

import { berekenSpread, cadansVoorBlok } from "./vermogensbereik";
import { berekenVerwachtRpe } from "./sessie/rpe";
import { SESSIE_ARCHETYPES as VARIANT_ARCHETYPES } from "./sessie-varianten";

const HERSTEL_MIN_SEC = 60;
const WERK_MIN_SEC = 90;

/**
 * Zoekt de concrete variantendata voor een archetype-id (uit sessie-archetypes.js)
 * binnen het gegeven sessietype. Retourneert null als er geen variantendata is
 * (bv. z2_heuvel, z2_tempo_teugjes, race_simulatie, vo2_microbursts) — dan moet
 * de aanroeper terugvallen op Claude.
 */
export function vindArchetypeMetVarianten(sessietype, archetypeId) {
  const kandidaten = VARIANT_ARCHETYPES[sessietype] || [];
  return kandidaten.find(a => a.id === archetypeId) || null;
}

function normaliseerCadans(cadansRpm) {
  if (cadansRpm == null) return null;
  if (typeof cadansRpm === "number") return { min: cadansRpm - 5, max: cadansRpm + 5 };
  return cadansRpm;
}

/**
 * Schaalt een variant naar de doelsessieduur via duur_pct.
 * Normaliseert de som van duur_pct*reps naar 1.0 — de auteursdata is niet altijd
 * exact (afgerond per blok), dus zonder normalisatie zou de totale sessieduur
 * structureel afwijken van doelDuurSec.
 * Minima: herstelblokken >= 60s, werkblokken >= 90s — maar niet voor blokken
 * die inherent kort zijn: herhaalde blokken (reps > 1, zoals 40/20's) en Z7
 * (neuromusculair/sprint — per definitie een korte maximale uitbarsting, nooit
 * een volgehouden inspanning). Een 90s-vloer op zulke blokken zou een 10s
 * sprint of 20×40s-interval fors oprekken en de sessie 11-42% laten
 * overschieten (gemeten over de datasetset).
 */
export function schaalVariant(variant, doelDuurSec) {
  const som = variant.blokken.reduce((s, b) => s + b.duur_pct * (b.reps ?? 1), 0) || 1;
  return variant.blokken.map(b => {
    const genormaliseerd = b.duur_pct / som;
    const ruw = Math.round(genormaliseerd * doelDuurSec);
    if ((b.reps ?? 1) > 1 || b.zone === "Z7") return { ...b, blokDuurSeconden: Math.max(1, ruw) };
    const minimum = b.type === "herstel" ? HERSTEL_MIN_SEC : WERK_MIN_SEC;
    return { ...b, blokDuurSeconden: Math.max(minimum, ruw) };
  });
}

/**
 * Berekent vermogen (watts) en cadans per blok, direct uit de auteurswaarde pct_ftp
 * (elk blok in sessie-varianten.js draagt een exacte pct_ftp — geen positie-veld).
 * Gebruikt dezelfde spread-/cadanslogica als berekenBlok() voor consistentie met
 * de rest van de codebase. Expandeert reps naar losse, gelijke blokken.
 */
export function berekenWattagesVanBlokken(blokken, ftp, sessietype) {
  return blokken.flatMap(b => {
    const midden = ftp * (b.pct_ftp / 100);
    const spread = berekenSpread(midden, b.isSpecifiek ?? false);
    const vermogenMin = Math.round(midden - spread / 2);
    const vermogenMax = Math.round(midden + spread / 2);
    const cadans = cadansVoorBlok(sessietype, b.blokDuurSeconden, b.zone, b.positie);
    const cadansRpm = normaliseerCadans(b.cadans_rpm) || { min: cadans.min, max: cadans.max };

    const blok = {
      type: b.type,
      zone: b.zone,
      blokDuurSeconden: b.blokDuurSeconden,
      isSpecifiek: b.isSpecifiek ?? false,
      vermogenMin,
      vermogenMax,
      eenheid: "watts",
      cadansMin: cadansRpm.min,
      cadansMax: cadansRpm.max,
      cadans_rpm: cadansRpm,
      sessietype,
    };

    const reps = b.reps ?? 1;
    return Array.from({ length: reps }, () => ({ ...blok }));
  });
}

export function berekenTssVanBlokken(blokkenMetWattages, ftp) {
  return Math.round(blokkenMetWattages.reduce((tss, b) => {
    const gem = (b.vermogenMin + b.vermogenMax) / 2;
    return tss + Math.pow(gem / ftp, 2) * (b.blokDuurSeconden / 3600) * 100;
  }, 0));
}

export function berekenZonedistributie(blokkenMetWattages) {
  const totaal = blokkenMetWattages.reduce((s, b) => s + b.blokDuurSeconden, 0);
  if (totaal === 0) return {};
  const dist = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, Z6: 0, Z7: 0 };
  for (const b of blokkenMetWattages) {
    const z = b.zone?.toUpperCase();
    if (z && dist[z] !== undefined) dist[z] += b.blokDuurSeconden / totaal;
  }
  return dist;
}

/** Groepeert blokken met reps > 1 als set, voor de plan_sets UI-weergave. */
export function groeperenInSets(blokken) {
  const sets = [];
  let i = 0;
  while (i < blokken.length) {
    const reps = blokken[i].reps ?? 1;
    if (reps > 1) {
      const setBlokken = [];
      while (i < blokken.length && (blokken[i].reps ?? 1) === reps) {
        setBlokken.push({ ...blokken[i], reps: 1 });
        i++;
      }
      sets.push({ reps, blokken: setBlokken });
    } else {
      sets.push({ reps: 1, blokken: [blokken[i]] });
      i++;
    }
  }
  return sets;
}

/**
 * Bepaalt het doelgewicht (1=licht, 2=middel, 3=zwaar) op basis van actuele
 * dagvorm (TSB, HRV-zone, RPE-trend). Pure functie, geen KV-afhankelijkheid —
 * losstaand exportbaar zodat andere modules (bv. de weeksolver, chunk 3) dezelfde
 * drempels hergebruiken in plaats van een parallel mechanisme te bouwen.
 * HRV-vocabulaire moet exact matchen met bepaalHrvZone(): 'rood'|'geel'|'normaal'|'hoog'|'onbekend'.
 *
 * @param {{tsb?: number, hrv?: string, rpeDeltaTrend?: number}} dagvorm
 * @returns {number} 1, 2 of 3
 */
export function bepaalDoelGewicht(dagvorm) {
  const { tsb = 0, hrv = "normaal", rpeDeltaTrend = 0 } = dagvorm ?? {};

  if (tsb < -20 || hrv === "rood") return 1;
  if (tsb < -10 || hrv === "geel" || rpeDeltaTrend > 1.0) return 2;
  if (tsb >= 5 && (hrv === "normaal" || hrv === "hoog") && rpeDeltaTrend < 0.5) return 3;
  return 2;
}

/**
 * Selecteert een variant op basis van actuele dagvorm (TSB, HRV-zone, RPE-trend).
 * KV-rotatie per gewichtsgroep, zodat niet steeds dezelfde (lichte/zware) variant terugkomt.
 *
 * @param {object} kv
 * @param {object} archetype - met .varianten (uit vindArchetypeMetVarianten)
 * @param {string} userId
 * @param {{tsb?: number, hrv?: string, rpeDeltaTrend?: number}} dagvorm
 */
export async function selecteerVariantOpDagvorm(kv, archetype, userId, dagvorm) {
  const doelGewicht = bepaalDoelGewicht(dagvorm);

  const kandidaten = archetype.varianten.filter(v => v.zwaartegewicht === doelGewicht);
  const pool = kandidaten.length > 0 ? kandidaten : archetype.varianten;

  const sleutel = `sessie_varianten:${userId}:${archetype.id}:g${doelGewicht}`;
  const recenteIds = (await kv.get(sleutel)) ?? [];
  const beschikbaar = pool.filter(v => !recenteIds.includes(v.id));
  const gekozen = (beschikbaar.length > 0 ? beschikbaar : pool)[0];
  await kv.set(sleutel, [gekozen.id, ...recenteIds].slice(0, 2));

  return { variant: gekozen, doelGewicht };
}

// intentie.sessietype (archetype-vocabulaire) -> sessie.type (legacy vocabulaire,
// gebruikt door corrigeerSessieTss/IF_BEREIK en UI-labels). Sessietypes zonder
// mapping (z6_anaeroob, gemengd) vallen terug op zichzelf; corrigeerSessieTss
// no-opt dan veilig omdat er geen IF_BEREIK-entry voor bestaat.
const LEGACY_TYPE_MAP = {
  z2_duur: "duur_variabel",
  sweetspot_intervallen: "sweetspot",
  drempel_intervallen: "drempel",
  vo2max_intervallen: "vo2max",
  kracht_lage_cadans: "kracht_lage_cadans",
  sprint_neuraal: "sprint_neuraal",
};

/**
 * Genereert een volledige sessie deterministisch, zonder Claude-aanroep.
 */
export function genereerSessieDeterministisch({ dagIntentie, archetype, variant, doelDuurMin, ftp, sessietype }) {
  const t0 = Date.now();
  const geschaald = schaalVariant(variant, doelDuurMin * 60);
  const segmenten = berekenWattagesVanBlokken(geschaald, ftp, sessietype);
  const tss = berekenTssVanBlokken(segmenten, ftp);
  const zonedist = berekenZonedistributie(segmenten);
  const verwachtRpe = berekenVerwachtRpe(zonedist, doelDuurMin);
  const planSets = groeperenInSets(geschaald);
  const generatieMs = Date.now() - t0;

  return {
    type: LEGACY_TYPE_MAP[sessietype] ?? sessietype,
    titel: archetype.naam ?? archetype.id,
    tss,
    duur_min: doelDuurMin,
    verwacht_rpe: verwachtRpe,
    segmenten,
    plan_sets: planSets,
    intentie: {
      ...(dagIntentie ?? {}),
      sessietype,
    },
    archetype_id: archetype.id,
    variant_id: variant.id,
    gegenereerd_door: "deterministisch",
    generatie_ms: generatieMs,
  };
}
