// Deterministische sessiegeneratie op basis van archetype + variant (sectie 46).
// Archetypes (metadata + concrete blokken/varianten samengevoegd) komen sinds de
// KV-migratie (admin sessie-archetype-beheer) niet meer uit een statische import
// hier, maar worden door de caller aangeleverd (KV-gelezen server-side, of
// eenmalig client-side opgehaald via GET /api/archetypes) — zie
// vindArchetypeMetVarianten hieronder.

import { berekenSpread, cadansVoorBlok } from "./vermogensbereik";
import { berekenVerwachtRpe } from "./sessie/rpe";
import { normaliseerGeschaaldeBlokDuren } from "./sessie/duurAfronding";
import { TSB_DEGRADATIE_DREMPEL } from "./sessie/weekSolver";
import { pasWbalKalibratieToe } from "./wbalSimulatie";
import { STANDAARD_WBAL_DREMPELS } from "./wbalDrempels";

const HERSTEL_MIN_SEC = 60;
const WERK_MIN_SEC = 90;

// Maximum werkblokduur per archetype (seconden) — voorkomt dat schaalVariant()
// werkblokken bij een lange gevraagde sessieduur fysiologisch te ver oprekt
// (waargenomen: kracht_lage_cadans-krachtsblok van 24 min bij een 3-uurs sessie).
// Elke waarde is afgeleid uit wat het archetype zelf al aangeeft in zijn naam/
// structuur (bv. 'kracht_std_4x5' = "4× 5' @ 50 rpm" -> 5 min per herhaling),
// genomen over de zwaarste variant binnen dat archetype, plus een bescheiden
// afronding/marge. Geen nieuwe getallen verzonnen — alleen de bestaande
// bedoeling een bovengrens gegeven i.p.v. oneindig laten meeschalen.
//
// z2_duur krijgt hier bewust GEEN entries — dat hele sessietype is duurgericht
// (zie bepaalMaximumBlokduur). Z1/Z2-blokken (vrijwel altijd de herstelblokken,
// soms ook "werk"-getypeerde Z2-blokken zoals in pieken_en_dalen) hebben óók
// geen maximum nodig ongeacht het archetype — laag vermogen volhouden is nooit
// het probleem dat deze cap oplost.
//
// Waarde is óf één getal (geldt voor alle niet-Z1/Z2-werkblokken van dat
// archetype) óf een { [zone]: seconden }-map voor archetypes met meerdere,
// wezenlijk verschillende werkzones (over-unders, vrijheidsessies).
const MAXIMUM_BLOKDUUR_PER_ARCHETYPE = {
  // ── kracht_lage_cadans — "4-8 min" per de fysiologische bedoeling ──
  kracht_standaard: 360,   // 6 min (grootste variant: "4× 5'")
  kracht_lang: 480,        // 8 min (grootste variant: "4× 7'")

  // ── sweetspot_intervallen ──
  ss_standaard: 1560,      // 26 min ("2× 25'")
  ss_oplopend: 960,        // 16 min ("3× 15'"/"4× 12'")
  ss_afdalend: 960,        // 16 min ("3× 15'")
  ss_piramide: 960,        // 16 min (piek-blok "15'", zelfde marge als ss_oplopend/afdalend)
  ss_lang: 2160,           // 36 min ("1× 35'")
  ss_kort_veel: 540,       // 9 min ("6× 8'")
  tempo_continu: 2700,     // 45 min — geen expliciete naam-minuten; bewust lang/aaneengesloten van aard
  tempo_intervallen: 960,  // 16 min ("3× 15'")

  // ── drempel_intervallen ──
  drempel_standaard: 1260,   // 21 min ("2× 20'")
  drempel_oplopend: 960,     // 16 min ("3× 15'")
  drempel_afdalend: 960,     // 16 min ("3× 15'")
  drempel_kort_veel: 540,    // 9 min ("6× 8'")
  drempel_lang: 2160,        // 36 min ("1× 35'")
  drempel_wisselend: 1560,   // 26 min ("25'+10'")
  ou_standaard: { Z3: 150, Z4: 90 },   // 2.5 min "under" / 1.5 min "over" ("6× [2'+1']")
  ou_lang: { Z3: 270, Z4: 180 },       // 4.5 min "under" / 3 min "over" ("4× [3'+2']")
  pyr_oplopend: 480,         // 8 min ("2'–3'–5'–7'")
  pyr_volledig: 540,         // 9 min ("3'–5'–8'–5'–3'")

  // ── vo2max_intervallen ──
  vo2_5x5: 420,          // 7 min (grootste variant: "6× 4'")
  vo2_4x4: 300,          // 5 min ("4×/5× 4'")
  vo2_4020: 60,          // 1 min ("40/20's")
  vo2_microbursts: 25,   // 15 sec-microbursts
  vo2_kort: 120,         // 2 min (grootste variant: "8× 90\"")
  vo2_lang: 540,         // 9 min ("3× 8'")
  vo2_oplopend: 300,     // 5 min ("4× 4'")
  vo2_klim: 270,         // 4.5 min ("5× 3'30\"")

  // ── sprint_neuraal — neuraal, geen metabole belasting: 10-20 sec ──
  sprint_kort: 20,       // ("6× 12\"")
  sprint_lang: 30,       // ("5× 20\"")
  sprint_ingebed: 20,    // embedded sprints van 8-12 sec

  // ── z6_anaeroob ──
  z6_standaard: 60,      // ("4× 50\"")

  // ── gemengd (vrijheidsessies — één variant, meerdere werkzones per archetype) ──
  alles_mag: { Z7: 15, Z5: 150, Z4: 270, Z3: 540 },
  raketstart: { Z7: 20, Z3: 1320 },
  omgekeerde_wereld: { Z5: 270, Z3: 990 },
  pieken_en_dalen: { Z3: 540, Z4: 540 },
  klim_simulator: { Z3: 150, Z5: 45, Z7: 15 },
  negatieve_vermoeidheid: { Z4: 330, Z5: 150 },
  race_simulatie: { Z4: 210, Z6: 75, Z3: 990, Z5: 150, Z7: 45 },
};

// Vangnet voor een werkzone die niet expliciet in de tabel hierboven staat
// (zou niet moeten voorkomen — alle huidige archetypes zijn gecatalogiseerd),
// zodat een toekomstig vergeten archetype nooit stilzwijgend ongelimiteerd blijft.
const GENERIEKE_MAXIMUM_PER_ZONE = { Z3: 900, Z4: 480, Z5: 300, Z6: 90, Z7: 20 };

/**
 * Bepaalt de maximum blokduur (seconden) voor een werkblok, of null als er
 * geen maximum geldt (z2_duur in zijn geheel, en Z1/Z2-blokken in elk archetype).
 *
 * @param {string} sessietype
 * @param {string} archetypeId
 * @param {object} blok
 * @param {number|null} [archetypeMaxBlokduurSec] - admin-geconfigureerde override
 *   (archetype.max_blokduur_sec, via de KV-data zelf) — wint altijd van de
 *   hardcoded tabel hieronder, zodat een via de admin-UI aangemaakt archetype
 *   niet afhankelijk is van een code-wijziging voor een getunede max.
 */
export function bepaalMaximumBlokduur(sessietype, archetypeId, blok, archetypeMaxBlokduurSec = null) {
  // Geen archetype-context meegegeven (bv. een losse unit-test van schaalVariant()
  // met alleen een variant-object) -> geen maximum. Het generieke vangnet hieronder
  // is uitsluitend voor een archetype-id die we WEL kennen maar nog niet
  // gecatalogiseerd hebben — niet voor "we weten het archetype niet".
  if (!archetypeId) return null;
  if (sessietype === "z2_duur") return null;
  if (blok.zone === "Z1" || blok.zone === "Z2") return null;
  if (archetypeMaxBlokduurSec != null) return archetypeMaxBlokduurSec;
  const entry = MAXIMUM_BLOKDUUR_PER_ARCHETYPE[archetypeId];
  if (entry == null) return GENERIEKE_MAXIMUM_PER_ZONE[blok.zone] ?? null;
  if (typeof entry === "number") return entry;
  return entry[blok.zone] ?? GENERIEKE_MAXIMUM_PER_ZONE[blok.zone] ?? null;
}

/**
 * Zoekt één archetype (met samengevoegde metadata + varianten/blokken) op id,
 * binnen een array die de caller al heeft opgehaald voor één sessietype (server:
 * getArchetypesVoorSessietypeRaw(sessietype); client: archetypesData[sessietype]
 * uit de eenmalige GET /api/archetypes-fetch). Pure, synchrone lookup — geen
 * KV-afhankelijkheid, dus ook client-side aanroepbaar.
 *
 * @param {Array} archetypes - archetypes voor één sessietype
 * @param {string} archetypeId
 * @returns {object|null}
 */
export function vindArchetypeMetVarianten(archetypes, archetypeId) {
  return (archetypes || []).find(a => a.id === archetypeId) || null;
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
 *
 * Maxima (bepaalMaximumBlokduur): werkblokken van interval-achtige archetypes
 * mogen niet onbeperkt meeschalen met een lange doelDuurSec — anders wordt een
 * "4× 5' kracht"-blok bij een 3-uurs sessie een 24-minuten krachtsblok
 * (fysiologisch een heel ander soort inspanning). z2_duur en Z1/Z2-blokken
 * hebben geen maximum (duurgericht, per definitie onschuldig). Het "teveel"
 * dat een gecapt werkblok niet meer kwijt kan, wordt herverdeeld over de
 * niet-vaste herstelblokken van dezelfde variant (proportioneel, zelf zonder
 * maximum) — zo blijft de totale sessieduur gelijk aan doelDuurSec.
 *
 * Vaste blokken (b.duur_sec_vast): een blok kan een letterlijke, niet-schalende
 * duur declareren i.p.v. een percentage — bv. "dit Z2-blok is altijd precies 30
 * minuten, ongeacht sessieduur". Zulke blokken doen niet mee in de duur_pct-
 * normalisatie en krijgen nooit een minimum/maximum-correctie (de opgegeven
 * waarde IS de bedoelde, exacte waarde). Hun tijd wordt eerst van doelDuurSec
 * afgetrokken; de resterende (duur_pct-)blokken verdelen de rest zoals gewoonlijk.
 *
 * @param {object} variant
 * @param {number} doelDuurSec
 * @param {string} [sessietype] - voor de z2_duur-uitzondering en archetype-lookup
 * @param {string} [archetypeId] - voor de per-archetype maximum-lookup
 * @param {number|null} [archetypeMaxBlokduurSec] - admin-geconfigureerde max-override,
 *   zie bepaalMaximumBlokduur
 */
export function schaalVariant(variant, doelDuurSec, sessietype = null, archetypeId = null, archetypeMaxBlokduurSec = null) {
  const vasteSec = variant.blokken.reduce((s, b) => s + (b.duur_sec_vast != null ? b.duur_sec_vast * (b.reps ?? 1) : 0), 0);
  const restDuurSec = Math.max(0, doelDuurSec - vasteSec);

  const pctBlokken = variant.blokken.filter(b => b.duur_sec_vast == null);
  const som = pctBlokken.reduce((s, b) => s + b.duur_pct * (b.reps ?? 1), 0) || 1;
  let totaalOvertollig = 0;

  const begrensd = variant.blokken.map(b => {
    if (b.duur_sec_vast != null) {
      return { ...b, blokDuurSeconden: b.duur_sec_vast };
    }

    const genormaliseerd = b.duur_pct / som;
    const ruw = Math.round(genormaliseerd * restDuurSec);
    const isKortInherent = (b.reps ?? 1) > 1 || b.zone === "Z7";
    const naMinimum = isKortInherent
      ? Math.max(1, ruw)
      : Math.max(b.type === "herstel" ? HERSTEL_MIN_SEC : WERK_MIN_SEC, ruw);

    const maximum = bepaalMaximumBlokduur(sessietype, archetypeId, b, archetypeMaxBlokduurSec);
    if (maximum != null && naMinimum > maximum) {
      totaalOvertollig += (naMinimum - maximum) * (b.reps ?? 1);
      return { ...b, blokDuurSeconden: maximum };
    }
    return { ...b, blokDuurSeconden: naMinimum };
  });

  if (totaalOvertollig > 0) {
    const herstelIdxs = begrensd.map((b, i) => ({ b, i })).filter(x => x.b.type === "herstel" && x.b.duur_sec_vast == null).map(x => x.i);
    if (herstelIdxs.length > 0) {
      const totaalGewicht = herstelIdxs.reduce((s, i) => s + begrensd[i].blokDuurSeconden * (begrensd[i].reps ?? 1), 0);
      for (const i of herstelIdxs) {
        const reps = begrensd[i].reps ?? 1;
        const gewicht = begrensd[i].blokDuurSeconden * reps;
        const aandeel = totaalGewicht > 0 ? gewicht / totaalGewicht : 1 / herstelIdxs.length;
        const extraPerInstantie = (totaalOvertollig * aandeel) / reps;
        begrensd[i] = { ...begrensd[i], blokDuurSeconden: Math.round(begrensd[i].blokDuurSeconden + extraPerInstantie) };
      }
    }
    // Geen (niet-vast) herstelblok om het teveel in op te vangen zou niet moeten
    // voorkomen — in dat randgeval blijft de sessie iets korter dan doelDuurSec
    // in plaats van te crashen.
  }

  return begrensd;
}

/**
 * Berekent vermogen (watts) en cadans per blok, direct uit de auteurswaarde pct_ftp
 * (elk blok in sessie-varianten.js draagt een exacte pct_ftp — geen positie-veld).
 * Gebruikt dezelfde spread-/cadanslogica als berekenBlok() voor consistentie met
 * de rest van de codebase.
 *
 * Expandeert reps EN interleavet: de auteursdata modelleert "4× [werk, herstel]"
 * als twee opeenvolgende platte entries (werk met reps:4, herstel met reps:4) —
 * zie groeperenInSets() hieronder, die deze twee-op-een-rij-dezelfde-reps-groepering
 * al correct herkent voor de UI (plan_sets). Een naïeve flatMap-per-entry zou echter
 * ALLE werk-herhalingen eerst plaatsen en pas daarna ALLE herstel-herhalingen
 * (kracht/werk-blok - kracht/werk-blok - ... - Z2 - Z2 - ...) i.p.v. de bedoelde
 * afwisseling (werk - herstel - werk - herstel - ...). Groepeer daarom eerst
 * opeenvolgende entries met dezelfde reps-waarde en interleave die per herhaling.
 */
export function berekenWattagesVanBlokken(blokken, ftp, sessietype) {
  const berekenEnkelBlok = (b) => {
    const midden = ftp * (b.pct_ftp / 100);
    const spread = berekenSpread(midden, b.isSpecifiek ?? false);
    const vermogenMin = Math.round(midden - spread / 2);
    const vermogenMax = Math.round(midden + spread / 2);
    const cadans = cadansVoorBlok(sessietype, b.blokDuurSeconden, b.zone, b.positie);
    const cadansRpm = normaliseerCadans(b.cadans_rpm) || { min: cadans.min, max: cadans.max };

    return {
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
      // D5: CP/W'-transparantie — alleen aanwezig als pasWbalKalibratieToe()
      // dit blok daadwerkelijk overschreef (wbalSimulatie.js). Zonder spread
      // van `b` hierboven zou dit veld anders stilzwijgend verdwijnen.
      ...(b.standaardBlokDuurSeconden != null ? { standaardBlokDuurSeconden: b.standaardBlokDuurSeconden } : {}),
    };
  };

  const resultaat = [];
  let i = 0;
  while (i < blokken.length) {
    const reps = blokken[i].reps ?? 1;
    if (reps > 1) {
      const groep = [];
      while (i < blokken.length && (blokken[i].reps ?? 1) === reps) {
        groep.push(blokken[i]);
        i++;
      }
      for (let r = 0; r < reps; r++) {
        for (const b of groep) resultaat.push(berekenEnkelBlok(b));
      }
    } else {
      resultaat.push(berekenEnkelBlok(blokken[i]));
      i++;
    }
  }
  return resultaat;
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
  const { tsb = 0, hrv = "normaal", rpeDeltaTrend = 0, hrvTrendTrigger = false, rhrTrendTrigger = false, herstelsnelheidTrigger = false } = dagvorm ?? {};

  // B6: een aanhoudende meerdere-weken-daling (HRV) of -stijging (RHR) van de
  // basislijn is minstens zo veelzeggend als een acute rode dag of zwaar
  // negatieve TSB — zuiver additief (OR) naast de bestaande drie voorwaarden,
  // geen AND-afhankelijkheid met tsb/hrv. B2 (herstelsnelheidTrigger): nog
  // niet teruggeveerd van de laatste zware sessie — zelfde besluitvormings-
  // niveau als de twee trend-triggers, dus geen apart/hoger gewicht.
  if (tsb < TSB_DEGRADATIE_DREMPEL || hrv === "rood" || hrvTrendTrigger || rhrTrendTrigger || herstelsnelheidTrigger) return 1;
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
// no-opt dan veilig omdat er geen IF_BEREIK-entry voor bestaat. Geëxporteerd
// (was intern) zodat conflictResolutie.js hier de OMGEKEERDE mapping (legacy
// s.type -> modern intentie.sessietype) uit kan afleiden i.p.v. een eigen,
// los-gedefinieerde vertaaltabel te bouwen — geen tweede bron van waarheid.
export const LEGACY_TYPE_MAP = {
  z2_duur: "duur_variabel",
  sweetspot_intervallen: "sweetspot",
  drempel_intervallen: "drempel",
  vo2max_intervallen: "vo2max",
  kracht_lage_cadans: "kracht_lage_cadans",
  sprint_neuraal: "sprint_neuraal",
};

// Elk niet-z2_duur archetype in sessie-varianten.js begint (op een handvol
// bewuste uitzonderingen na, bv. pieken_en_dalen) direct met het eerste
// werkblok op vol vermogen/lage cadans — geen inrijtijd. Dat geldt vooral voor
// kracht_lage_cadans (hoog vermogen + lage cadans zonder opwarming is
// gewrichtsbelastend), maar evengoed voor sweetspot/drempel/vo2max/sprint/
// gemengd. In plaats van dit in te bouwen in elke variant afzonderlijk
// (~100 varianten, foutgevoelig te onderhouden), wordt hier centraal een
// Z2-inrijblok toegevoegd vóór de eerste rep — de rest van de sessie krimpt
// naar rato mee zodat de totale doelduur ongewijzigd blijft. z2_duur zelf
// wordt overgeslagen (de hele sessie is al Z2/lage intensiteit — er is niets
// "op te warmen naar"), en archetypes die al met Z1/Z2 beginnen (zoals
// pieken_en_dalen) worden niet dubbel opgewarmd.
const WARMING_UP_MIN_SEC = 5 * 60;
const WARMING_UP_MAX_SEC = 12 * 60;
const WARMING_UP_FRACTIE = 0.12;
const WARMING_UP_PCT_FTP = 60;
const WARMT_AL_ROSTIG_OP = new Set(["Z1", "Z2"]);

function voegWarmingUpToe(geschaaldeBlokken, doelDuurSec) {
  if (geschaaldeBlokken.length === 0) return geschaaldeBlokken;
  if (WARMT_AL_ROSTIG_OP.has(geschaaldeBlokken[0].zone)) return geschaaldeBlokken;

  const warmingUpSec = Math.round(Math.min(WARMING_UP_MAX_SEC, Math.max(WARMING_UP_MIN_SEC, doelDuurSec * WARMING_UP_FRACTIE)));
  const restSec = Math.max(0, doelDuurSec - warmingUpSec);
  // schaalVariant() levert per blok-entry één blokDuurSeconden, nog niet
  // geëxpandeerd naar reps (dat gebeurt pas in berekenWattagesVanBlokken) — de
  // werkelijke totale duur van een reps-entry is blokDuurSeconden * reps.
  //
  // Vaste blokken (duur_sec_vast) mogen door de warm-up-injectie nooit
  // ingekort worden — dat zou "altijd precies 30 minuten" breken. Alleen de
  // schaalbare (duur_pct-)blokken krimpen om ruimte te maken; vaste blokken
  // tellen niet mee in de krimp-ratio en worden ongewijzigd doorgegeven.
  const vasteSec = geschaaldeBlokken.reduce((s, b) => s + (b.duur_sec_vast != null ? b.blokDuurSeconden * (b.reps ?? 1) : 0), 0);
  const schaalbaarRestSec = Math.max(0, restSec - vasteSec);
  const huidigSchaalbaarTotaalSec = geschaaldeBlokken.reduce((s, b) => s + (b.duur_sec_vast == null ? b.blokDuurSeconden * (b.reps ?? 1) : 0), 0);
  const ratio = huidigSchaalbaarTotaalSec > 0 ? schaalbaarRestSec / huidigSchaalbaarTotaalSec : 0;

  const ingekort = geschaaldeBlokken.map(b =>
    b.duur_sec_vast != null ? b : { ...b, blokDuurSeconden: Math.max(1, Math.round(b.blokDuurSeconden * ratio)) }
  );
  const warmingUpBlok = { type: "werk", zone: "Z2", pct_ftp: WARMING_UP_PCT_FTP, blokDuurSeconden: warmingUpSec };
  return [warmingUpBlok, ...ingekort];
}

/**
 * Genereert een volledige sessie deterministisch, zonder Claude-aanroep.
 * @param {{criticalPower: number, wPrime: number}|null} [cpWprime] - D5:
 *   renner-eigen CP/W' (cpWprime.js); alleen relevant voor
 *   WBAL_KALIBRATIE_SESSIETYPES (wbalSimulatie.js). null -> geen kalibratie,
 *   archetype-standaardduur (fail-open, bestaand gedrag).
 * @param {{depletiePct: number, herstelPct: number}|null} [wbalDrempels] - D5:
 *   admin-instelbare drempels (wbalDrempels.js). Alleen relevant samen met
 *   cpWprime; ontbreekt-ie, dan gelden de vaste standaardwaarden.
 */
export function genereerSessieDeterministisch({ dagIntentie, archetype, variant, doelDuurMin, ftp, sessietype, cpWprime = null, wbalDrempels = null }) {
  const t0 = Date.now();
  let geschaald = schaalVariant(variant, doelDuurMin * 60, sessietype, archetype.id, archetype.max_blokduur_sec ?? null);
  if (sessietype !== "z2_duur") {
    geschaald = voegWarmingUpToe(geschaald, doelDuurMin * 60);
  }

  // Rond blokken >= 1 minuut af op hele minuten en de totale sessieduur op
  // een veelvoud van 5 minuten — vaste blokken (duur_sec_vast) en blokken die
  // al tegen hun archetype-maximum aan zitten blijven exact zoals berekend.
  const isGepind = (b) => {
    if (b.duur_sec_vast != null) return true;
    const maximum = bepaalMaximumBlokduur(sessietype, archetype.id, b, archetype.max_blokduur_sec ?? null);
    return maximum != null && b.blokDuurSeconden >= maximum;
  };
  const genormaliseerd = normaliseerGeschaaldeBlokDuren(geschaald, isGepind, doelDuurMin * 60);
  geschaald = genormaliseerd.blokken;

  // D5: CP/W'-kalibratie NA de reguliere afronding hierboven — overschrijft
  // blokDuurSeconden van werk/rust-reps-paren met second-precisie fysiologische
  // waarden voor vo2max/anaerobe sessietypes (wbalSimulatie.js). Bewust NIET
  // vóór de afronding toegepast: dat 5-minutengrid is bedoeld voor de
  // auteurs-gedreven standaardduur, niet voor een individueel gekalibreerde
  // duur. Fail-open (geen cpWprime, of geen geldige simulatie): retourneert
  // `geschaald` ongewijzigd, dus duurMin hieronder blijft exact zoals voorheen.
  geschaald = pasWbalKalibratieToe(geschaald, sessietype, ftp, cpWprime, wbalDrempels ?? STANDAARD_WBAL_DREMPELS);
  const duurMin = Math.round(geschaald.reduce((s, b) => s + b.blokDuurSeconden * (b.reps ?? 1), 0) / 60);

  const segmenten = berekenWattagesVanBlokken(geschaald, ftp, sessietype);
  const tss = berekenTssVanBlokken(segmenten, ftp);
  const zonedist = berekenZonedistributie(segmenten);
  const verwachtRpe = berekenVerwachtRpe(zonedist, duurMin);
  const planSets = groeperenInSets(geschaald);
  const generatieMs = Date.now() - t0;

  return {
    type: LEGACY_TYPE_MAP[sessietype] ?? sessietype,
    titel: archetype.naam ?? archetype.id,
    tss,
    duur_min: duurMin,
    verwacht_rpe: verwachtRpe,
    segmenten,
    plan_sets: planSets,
    intentie: {
      ...(dagIntentie ?? {}),
      // gepland_sessietype bewaart wat vóór deze generatie-aanroep als sessietype
      // gold (bv. uit solveWeek()) — `sessietype` hieronder kan daarvan afwijken
      // door een override (volumecorrectie, kracht-gate-fallback). Zonder dit veld
      // was een afwijking na opslag niet meer te onderscheiden, want beide
      // waarden zaten in hetzelfde intentie.sessietype-veld (zie /api/debug/dag-intentie).
      gepland_sessietype: dagIntentie?.sessietype ?? sessietype,
      sessietype,
    },
    archetype_id: archetype.id,
    variant_id: variant.id,
    gegenereerd_door: "deterministisch",
    generatie_ms: generatieMs,
  };
}
