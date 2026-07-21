// B6: HRV/RHR-basislijn-trend over meerdere weken.
//
// LET OP — twee verschillende HRV-trendmechanismen in deze codebase, bewust
// naast elkaar (geen vervanging van elkaar): zie src/lib/hrv/trend.js voor
// het ACUTE, KORTETERMIJN-mechanisme (14-dagen-venster, dagelijks vers
// herberekend in cron/morning/route.js, drempel -15%, gevolg: directe
// TSS-verlaging + melding). Dit bestand behandelt het STRUCTURELE,
// MEERDERE-WEKEN-mechanisme: een longitudinale puntenreeks van wekelijkse
// basislijnwaarden, datum-gebaseerde lineaire regressie over ~21 dagen,
// drempel ±5%, gevolg: een dagvorm-signaal (hrvTrendTrigger/rhrTrendTrigger)
// i.p.v. een directe planwijziging. Beide mogen onafhankelijk en
// gelijktijdig triggeren — twee reële signalen op verschillende
// tijdschalen, geen tegenstrijdige claims.
//
// Vult het gat dat het wekelijkse 28-dagen-voortschrijdend-gemiddelde
// (hrv/profiel.js) zelf niet dekt: een aanhoudende meerdere-weken-daling/
// -stijging werkt zich geleidelijk IN de basislijn zelf (die immers ook maar
// een 28-dagen-gemiddelde is), dus een simpele "vandaag vs. basislijn"-
// vergelijking mist een trend die zich langzaam over de basislijn heen
// uitsmeert.
//
// Zelfde longitudinale-puntenreeks-patroon als ef.js (ef_trend:${userId}:${band}):
// niet on-demand bij intervals.icu opgehaald (dat zou een dagelijkse
// 90-dagen-call betekenen voor iets dat maar wekelijks verandert), maar één
// punt per week toegevoegd tijdens de bestaande maandag-only HRV-
// profielherberekening (cron/sync/route.js), op data die daar toch al wordt
// opgehaald.

import { berekenLineaireTrendPerWeek } from "../trend";

const CAP_DATAPUNTEN = 20;

// Extrapolatievenster (bijstelling 1): 21 dagen ≈ 3 weken, aansluitend bij
// "basislijn-nu vs. basislijn-3-weken-terug" — maar afgeleid uit de
// regressie-helling (datum-gebaseerd, gap-robuust) i.p.v. een losse
// "punt van ~21 dagen geleden"-lookup, wat bij een ontbrekende weekmeting
// een verkeerd referentiepunt zou pakken.
const EXTRAPOLATIE_DAGEN = 21;

// Coaching-heuristiek, geen cyclisme-specifiek gevalideerde grenswaarde —
// zelfde soort voorlopige drempel als monotonie/strain se ">2.0" (Foster).
// Later te kalibreren met echte gebruikersdata.
const TREND_DREMPEL_PCT = 5;

function hrvTrendKey(userId) {
  return `hrv_trend:${userId}`;
}

function rhrTrendKey(userId) {
  return `rhr_trend:${userId}`;
}

async function voegTrendPuntToe(kv, key, punt) {
  const bestaande = (await kv.get(key)) || [];
  const zonderDupe = bestaande.filter(p => p.datum !== punt.datum);
  const bijgewerkt = [...zonderDupe, punt]
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(-CAP_DATAPUNTEN);
  await kv.set(key, bijgewerkt);
  return bijgewerkt;
}

/** Voegt een HRV-basislijn-punt toe (één per week, tijdens de cron-pas). */
export async function voegHrvTrendPuntToe(kv, userId, punt) {
  return voegTrendPuntToe(kv, hrvTrendKey(userId), punt);
}

export async function haalHrvTrendOp(kv, userId) {
  return (await kv.get(hrvTrendKey(userId))) || [];
}

/** Voegt een RHR-basislijn-punt toe (één per week, tijdens de cron-pas). */
export async function voegRhrTrendPuntToe(kv, userId, punt) {
  return voegTrendPuntToe(kv, rhrTrendKey(userId), punt);
}

export async function haalRhrTrendOp(kv, userId) {
  return (await kv.get(rhrTrendKey(userId))) || [];
}

/**
 * Bijstelling 1: helling (niet een losse puntvergelijking) geëxtrapoleerd
 * naar EXTRAPOLATIE_DAGEN, uitgedrukt als percentage van de meest recente
 * basislijnwaarde. Bijstelling 2: fail-open (false, geen crash) bij <4 punten
 * — te weinig voor een betekenisvolle regressie over ~3 weken.
 * @param {{datum: string, basislijn: number}[]} punten
 * @param {"dalend"|"stijgend"} richting - welke kant triggert
 * @returns {boolean}
 */
function bepaalTrendTrigger(punten, richting) {
  if (!punten?.length || punten.length < 4) return false;

  const resultaat = berekenLineaireTrendPerWeek(punten.map(p => ({ datum: p.datum, waarde: p.basislijn })));
  if (resultaat == null) return false;

  const { hellingPerDag, laatsteWaarde } = resultaat;
  if (!laatsteWaarde) return false; // 0/null/undefined — geen zinvol percentage te berekenen

  const geëxtrapoleerdeVerandering = hellingPerDag * EXTRAPOLATIE_DAGEN;
  const pct = (geëxtrapoleerdeVerandering / laatsteWaarde) * 100;

  return richting === "dalend" ? pct < -TREND_DREMPEL_PCT : pct > TREND_DREMPEL_PCT;
}

/** HRV-basislijn gedaald met >5% (geëxtrapoleerd over 21 dagen) t.o.v. de huidige waarde. */
export function bepaalHrvTrendTrigger(punten) {
  return bepaalTrendTrigger(punten, "dalend");
}

/** RHR-basislijn gestegen met >5% (geëxtrapoleerd over 21 dagen) t.o.v. de huidige waarde. */
export function bepaalRhrTrendTrigger(punten) {
  return bepaalTrendTrigger(punten, "stijgend");
}
