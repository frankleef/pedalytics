// Fitnessprogressie (sectie: fitnessprogressie-en-kracht-fase-check.md, Deel A):
// een traag, wekelijks bijgewerkt trendsignaal — losstaand van de dagelijkse
// gereedheidsscore ("gereedheid vandaag"). Puur/synchroon, geen KV-/
// intervals.icu-afhankelijkheid hier — die zit in de I/O-laag (zie
// berekenEnSlaFitnessprogressieOp in volumeCorrectie.js), zodat dit bestand
// zonder mocks testbaar blijft.

import { isDecouplingUitschieter } from "./decoupling";

// ±1 CTL-punt/week bleek in de backtest (1 mei - 13 juli 2026, zie
// fitnessprogressie-en-kracht-fase-check.md) een stabiele grens: de helling
// bleef daarbinnen 7 weken op rij "stijgend" zonder ooit om te slaan, in
// tegenstelling tot de oude dagelijkse pil. Geen empirisch geoptimaliseerde
// waarde — een benoemde constante zodat toekomstige herijking op één plek kan.
export const CTL_TREND_DREMPEL_PER_WEEK = 1;

// Minimum aantal kwalificerende decoupling-punten voor een betrouwbare
// regressie. In de backtest gaf 9-11 punten over 7 weken een teken-omkering
// afhankelijk van uitschieterbehandeling — vandaar bewust een drempel die daar
// net boven ligt i.p.v. elk klein aantal punten al een richting te laten claimen.
export const DECOUPLING_TREND_MIN_PUNTEN = 10;

// Minimum aantal dagen CTL-geschiedenis voor een betekenisvolle trend — een
// regressie over minder dan 4 weken is te gevoelig voor een enkel zwaar/rustig
// blok om als "trend" te tonen.
export const CTL_TREND_MIN_DAGEN = 28;

/**
 * Helling (per dag) van een lineaire regressie (OLS) van y tegen x.
 * @param {Array<{x: number, y: number}>} punten
 * @returns {number|null} - null bij <2 punten of een verticale/gedegenereerde reeks
 */
export function lineaireRegressieHelling(punten) {
  if (!punten || punten.length < 2) return null;
  const n = punten.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of punten) {
    sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x;
  }
  const noemer = n * sumX2 - sumX * sumX;
  if (noemer === 0) return null;
  return (n * sumXY - sumX * sumY) / noemer;
}

/**
 * CTL-trend: regressie van CTL tegen tijd over de meegegeven reeks (verwacht:
 * caller geeft al alleen de laatste 8-10 weken mee, zie
 * berekenEnSlaFitnessprogressieOp). Retourneert null-achtige status bij
 * onvoldoende geschiedenis i.p.v. een misleidende helling op te forceren.
 * @param {Array<{datum: string, ctl: number}>} ctlReeks - chronologisch (oud->nieuw), ISO-datums
 */
export function berekenCtlTrend(ctlReeks) {
  const reeks = (ctlReeks || []).filter(p => p.ctl != null).slice().sort((a, b) => a.datum.localeCompare(b.datum));
  if (reeks.length < 2) return { status: "onvoldoende_data", helling_per_week: null, richting: null, aantal_dagen: reeks.length };

  const t0 = new Date(reeks[0].datum);
  const spanDagen = (new Date(reeks[reeks.length - 1].datum) - t0) / 86400000;
  if (spanDagen < CTL_TREND_MIN_DAGEN) {
    return { status: "onvoldoende_data", helling_per_week: null, richting: null, aantal_dagen: reeks.length };
  }

  const punten = reeks.map(p => ({ x: (new Date(p.datum) - t0) / 86400000, y: p.ctl }));
  const hellingPerDag = lineaireRegressieHelling(punten);
  if (hellingPerDag == null) return { status: "onvoldoende_data", helling_per_week: null, richting: null, aantal_dagen: reeks.length };

  const hellingPerWeek = Math.round(hellingPerDag * 7 * 100) / 100;
  const richting =
    hellingPerWeek > CTL_TREND_DREMPEL_PER_WEEK ? "stijgend" :
    hellingPerWeek < -CTL_TREND_DREMPEL_PER_WEEK ? "dalend" : "stabiel";

  return { status: "ok", helling_per_week: hellingPerWeek, richting, aantal_dagen: reeks.length, venster_dagen: Math.round(spanDagen) };
}

/**
 * Decoupling-trend: regressie van decoupling-waarde tegen tijd, over ALLE
 * kwalificerende ritten in de meegegeven periode (een langzamer, breder
 * signaal dan een korte 5-vs-5-groepsvergelijking). Bij
 * <DECOUPLING_TREND_MIN_PUNTEN punten: expliciet "onvoldoende_data", geen
 * geforceerde richting.
 *
 * Uitschieters (isDecouplingUitschieter, zelfde IQR/>12%-regel als de
 * fase-overgang-mediaan in cron/sync/route.js) worden er vóór de regressie
 * uitgefilterd: één hitte- of dataglitch-rit met een extreme decoupling-
 * waarde kan een verder vlakke reeks anders alleen laten "verslechteren".
 * @param {Array<{datum: string, waarde: number}>} decouplingReeks - chronologisch, ISO-datums
 */
export function berekenDecouplingTrend(decouplingReeks) {
  const alleWaarden = (decouplingReeks || []).filter(p => p.waarde != null).map(p => p.waarde);
  const reeks = (decouplingReeks || [])
    .filter(p => p.waarde != null && !isDecouplingUitschieter(p.waarde, alleWaarden))
    .slice()
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (reeks.length < DECOUPLING_TREND_MIN_PUNTEN) {
    return { status: "onvoldoende_data", helling_per_week: null, richting: null, aantal_punten: reeks.length };
  }

  const t0 = new Date(reeks[0].datum);
  const punten = reeks.map(p => ({ x: (new Date(p.datum) - t0) / 86400000, y: p.waarde }));
  const hellingPerDag = lineaireRegressieHelling(punten);
  if (hellingPerDag == null) return { status: "onvoldoende_data", helling_per_week: null, richting: null, aantal_punten: reeks.length };

  const hellingPerWeek = Math.round(hellingPerDag * 7 * 100) / 100;
  // Decoupling dalend (negatieve helling) = betere aerobe efficiëntie = "verbeterend".
  const richting =
    hellingPerWeek < -0.1 ? "verbeterend" :
    hellingPerWeek > 0.1 ? "verslechterend" : "stabiel";

  return { status: "ok", helling_per_week: hellingPerWeek, richting, aantal_punten: reeks.length };
}

/**
 * Combineert CTL-trend + decoupling-trend + FTP-testankerpunten tot het
 * object dat wekelijks naar KV (`fitnessprogressie:{userId}`) geschreven
 * wordt. Puur — geen KV/tijd-afhankelijkheid behalve wat is meegegeven, zodat
 * dit los van de I/O-laag getest kan worden.
 * @param {Array<{datum: string, ctl: number}>} ctlReeks
 * @param {Array<{datum: string, waarde: number}>} decouplingReeks
 * @param {Array<{week: number, datum: string|null}>} [ftpTestMarkers]
 * @param {string} [berekendOp] - ISO-timestamp, default: nu
 */
export function berekenFitnessprogressie({ ctlReeks, decouplingReeks, ftpTestMarkers = [], berekendOp = new Date().toISOString() }) {
  return {
    berekend_op: berekendOp,
    ctl_trend: berekenCtlTrend(ctlReeks),
    decoupling_trend: berekenDecouplingTrend(decouplingReeks),
    ftp_test_markers: ftpTestMarkers,
  };
}

/**
 * Vertaalt een fitnessprogressie-resultaat (ctl_trend + decoupling_trend) naar
 * weergavetekst. Vervangt de vroegere, VoortgangTab-lokale
 * conditieTrendContextlijn() die de dag-op-dag-volatiliteit had die de rest
 * van Deel A oploste (zie fitnessprogressie-kracht-en-weekinfase-
 * implementatie.md). Puur, framework-agnostisch, zodat de UI-laag
 * (VoortgangTab.js) alleen rendert.
 * @param {{status: string, richting: string|null, helling_per_week: number|null, venster_dagen?: number}} [ctlTrend]
 * @param {{status: string, richting: string|null, aantal_punten?: number}} [decouplingTrend]
 * @returns {{ctlRegel: string, decouplingRegel: string}}
 */
export function fitnessprogressieContextlijn({ ctlTrend, decouplingTrend } = {}) {
  let ctlRegel;
  if (!ctlTrend || ctlTrend.status === "onvoldoende_data") {
    ctlRegel = "Nog te weinig trainingsgeschiedenis voor een betrouwbare fitnesstrend — beschikbaar na een paar weken training.";
  } else if (ctlTrend.richting === "stijgend") {
    ctlRegel = `Je fitheid stijgt — +${ctlTrend.helling_per_week} CTL-punten/week over de laatste ${ctlTrend.venster_dagen} dagen.`;
  } else if (ctlTrend.richting === "dalend") {
    ctlRegel = `Je fitheid daalt — ${ctlTrend.helling_per_week} CTL-punten/week. Controleer je belasting en herstel de komende weken.`;
  } else {
    ctlRegel = "Je fitheid houdt stand deze weken. Meer volume of intensiteit zou de groei aanzwengelen.";
  }

  let decouplingRegel;
  if (!decouplingTrend || decouplingTrend.status === "onvoldoende_data") {
    decouplingRegel = `Aerobe efficiëntie: onvoldoende lange Z2-ritten voor een betrouwbare trend (${decouplingTrend?.aantal_punten ?? 0}/${DECOUPLING_TREND_MIN_PUNTEN} nodig).`;
  } else if (decouplingTrend.richting === "verbeterend") {
    decouplingRegel = "Aerobe efficiëntie verbetert deze periode.";
  } else if (decouplingTrend.richting === "verslechterend") {
    decouplingRegel = "Aerobe efficiëntie verslechtert deze periode — let op herstel.";
  } else {
    decouplingRegel = "Aerobe efficiëntie is stabiel deze periode.";
  }

  return { ctlRegel, decouplingRegel };
}

// Home-scherm Fitheid-kaart: venster waarover "weken data verzameld" wordt
// uitgedrukt. Gekozen op 8 weken omdat dat het venster is waarbinnen zowel
// CTL_TREND_MIN_DAGEN (4 weken) als DECOUPLING_TREND_MIN_PUNTEN doorgaans
// worden gehaald bij normale trainingsfrequentie — geen nieuwe drempel, een
// weergavevenster voor de bestaande CTL-/decoupling-trend-drempels.
export const FITNESS_DATA_VENSTER_WEKEN = 8;

/**
 * Generieke "heeft deze gebruiker genoeg trainingsgeschiedenis voor een
 * fitheidstrend"-gate voor de Home-Fitheid-kaart, gebouwd bovenop de
 * bestaande per-signaal drempels (CTL_TREND_MIN_DAGEN, DECOUPLING_TREND_
 * MIN_PUNTEN) i.p.v. een nieuwe, ongerelateerde drempel te verzinnen.
 * @param {{status: string, aantal_dagen?: number}} [ctlTrend]
 * @param {{status: string, aantal_punten?: number}} [decouplingTrend]
 * @returns {{ready: boolean, wekenVerzameld: number, wekenNodig: number, pct: number}}
 */
export function bepaalFitnessDataGereed({ ctlTrend, decouplingTrend } = {}) {
  const ready = ctlTrend?.status === "ok" && decouplingTrend?.status === "ok";

  const ctlWeken = ctlTrend?.aantal_dagen != null ? ctlTrend.aantal_dagen / 7 : 0;
  const dcWeken = decouplingTrend?.aantal_punten != null
    ? (decouplingTrend.aantal_punten / DECOUPLING_TREND_MIN_PUNTEN) * FITNESS_DATA_VENSTER_WEKEN
    : 0;

  const wekenVerzameld = Math.min(FITNESS_DATA_VENSTER_WEKEN, Math.round(Math.max(ctlWeken, dcWeken)));
  const pct = Math.round((wekenVerzameld / FITNESS_DATA_VENSTER_WEKEN) * 100);

  return { ready, wekenVerzameld, wekenNodig: FITNESS_DATA_VENSTER_WEKEN, pct };
}
