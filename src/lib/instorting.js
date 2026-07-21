// E1: detecteert een mogelijke fysiologische instorting binnen een geplande,
// gestructureerde sessie — een vroeg werk-segment haalt het doel (bewijst een
// serieuze poging), een later werk-segment niet. Gebruikt UITSLUITEND de
// ruwe, seconde-per-seconde watts-tijdreeks (streams-endpoint), nooit
// intervals.icu's eigen lap-detectie (icu_intervals): een live-geverifieerde
// rit (i166071231) toonde dat een door intervals.icu als één "WORK-lap,
// gemiddeld 235W" gelabeld interval zelf een instorting van 235W naar 37W kon
// bevatten — een lap-gemiddelde is zelf ook een gemiddelde en kan dus precies
// het patroon maskeren dat dit mechanisme moet detecteren.
//
// Boost-drempel (decoupling > 7) hergebruikt dezelfde grens als
// checkFaseOvergang (decoupling.js) — geen nieuw getal verzonnen. De
// decoupling-waarde zelf wordt NIET hier opgehaald: de aanroeper geeft de
// rit-eigen decoupling (nieuwste.decoupling, al aanwezig in de
// /activities-respons vóór deze functie draait) door als parameter — zie
// cron/sync/route.js voor de precieze reden waarom dit de rit-eigen waarde
// moet zijn, niet de cross-ride decoupling_baseline-mediaan.

import { intervalsAuth } from "./intervals";
import { rollendGemiddelde, vindAaneengeslotenPeriodes } from "./reeksAnalyse";

const BASE_URL = "https://intervals.icu/api/v1";
// Geëxporteerd (waren intern) zodat src/lib/review/prompt.js (Blok F, fase 2)
// deze waarden kan citeren in de systeeminstructie i.p.v. eigen kopieën.
export const ROLLEND_VENSTER_SECONDEN = 60;
export const MINIMALE_GESLAAGDE_PERIODE_SECONDEN = 120;
export const DECOUPLING_BOOST_DREMPEL = 7;

/**
 * Haalt de ruwe, seconde-per-seconde watts-tijdreeks op voor één activiteit.
 * Credential-gebaseerd (apiKey/athleteId als parameters), zelfde patroon als
 * decoupling.js:backfillDecoupling/ef.js:backfillEf se eigen fetches binnen
 * cron/sync — met dit verschil: gebruikt de al-bestaande, geëxporteerde
 * intervalsAuth()-helper voor de header i.p.v. de Basic-auth-string handmatig
 * te herbouwen (die twee bestanden blijven zelf ongewijzigd).
 * @param {string} apiKey
 * @param {string} athleteId
 * @param {string|number} activiteitId
 * @returns {Promise<number[]|null>} watts, of null bij een fout/lege respons
 */
export async function haalWattsStream(apiKey, athleteId, activiteitId) {
  try {
    const resp = await fetch(`${BASE_URL}/activity/${activiteitId}/streams?types=watts`, {
      headers: { Authorization: intervalsAuth(apiKey) },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const find = (type) => (Array.isArray(data) ? data.find(s => s.type === type) : data?.[type]);
    const watts = find("watts")?.data;
    return Array.isArray(watts) && watts.length > 0 ? watts : null;
  } catch {
    return null;
  }
}

/**
 * Cumulatieve som van voorgaande segmenten se blokDuurSeconden — bewust
 * geaccepteerde beperking, geen tijdelijke placeholder: sessie.segmenten
 * draagt geen eigen start-tijd/offset-veld, en intervals.icu's lap-grenzen
 * (icu_intervals) zijn zelf gebaseerd op wat er daadwerkelijk gebeurde
 * (auto-gedetecteerd op basis van de gereden data), niet op het plan — ze
 * vormen dus geen betrouwbaarder anker voor "waar zou dit GEPLANDE segment
 * moeten beginnen" dan deze afleiding. Timing-drift binnen de rit (bv. een
 * langzamere start dan gepland) is een te documenteren grens van deze
 * aanpak, geen oplosbaar gat met de vandaag beschikbare databronnen.
 */
function bepaalSegmentOffsets(segmenten) {
  let cursor = 0;
  return segmenten.map(seg => {
    const start = cursor;
    cursor += seg.blokDuurSeconden || 0;
    return { ...seg, start, eind: cursor };
  });
}

/**
 * Detecteert een mogelijke/waarschijnlijke instorting binnen een geplande,
 * gestructureerde sessie. Puur-functioneel — geen kv/fetch — zodat dit los
 * van de KV-/netwerklaag getest kan worden.
 *
 * Per werk-segment (nooit één ritbrede doelzone — bevestigd noodzakelijk via
 * de ss_oplopend/ss_afdalend-archetypes, die per werk-segment een ander
 * vermogenMin/vermogenMax dragen): rollend gemiddelde (venster 60) over de
 * segment-eigen sub-reeks, dan aaneengesloten periodes >= vermogenMin,
 * gefilterd op >= 120s.
 *
 * @param {number[]} watts - volledige, ruwe seconde-per-seconde reeks van de rit
 * @param {{type: string, blokDuurSeconden: number, vermogenMin: number, vermogenMax: number}[]} segmenten
 * @param {number|null} [decouplingWaarde] - de rit-EIGEN decoupling (niet een baseline/mediaan)
 * @returns {{mogelijkIngestort: boolean, waarschijnlijkIngestort: boolean, totaleTijdInZoneSeconden: number, totaalGeplandSeconden: number}|null}
 *   null bij onvoldoende input (fail-open) — geen werk-segmenten of geen/te korte watts-reeks
 */
export function detecteerMogelijkeInstorting(watts, segmenten, decouplingWaarde = null) {
  const werkSegmenten = (segmenten || []).filter(s => s.type === "werk" && s.blokDuurSeconden > 0);
  if (werkSegmenten.length === 0 || !watts?.length) return null;

  const offsets = bepaalSegmentOffsets(segmenten || []).filter(s => s.type === "werk" && s.blokDuurSeconden > 0);

  let totaleTijdInZoneSeconden = 0;
  let eersteSegmentHeeftGeslaagdePeriode = false;

  offsets.forEach((seg, i) => {
    const subReeks = watts.slice(seg.start, seg.eind);
    const rollend = rollendGemiddelde(subReeks, ROLLEND_VENSTER_SECONDEN);
    const periodes = vindAaneengeslotenPeriodes(rollend, seg.vermogenMin, MINIMALE_GESLAAGDE_PERIODE_SECONDEN);

    totaleTijdInZoneSeconden += periodes.reduce((s, p) => s + p.duurSeconden, 0);
    if (i === 0 && periodes.length > 0) eersteSegmentHeeftGeslaagdePeriode = true;
  });

  const totaalGeplandSeconden = werkSegmenten.reduce((s, seg) => s + seg.blokDuurSeconden, 0);
  const tijdInZoneAandeel = totaalGeplandSeconden > 0 ? totaleTijdInZoneSeconden / totaalGeplandSeconden : 0;

  const mogelijkIngestort = eersteSegmentHeeftGeslaagdePeriode && tijdInZoneAandeel < 0.5;
  const waarschijnlijkIngestort = mogelijkIngestort && decouplingWaarde != null && decouplingWaarde > DECOUPLING_BOOST_DREMPEL;

  return { mogelijkIngestort, waarschijnlijkIngestort, totaleTijdInZoneSeconden, totaalGeplandSeconden };
}

/**
 * Batch-leest segment_instorting:${userId}:${activiteitId} voor een lijst
 * activiteit-ids via kv.mget — tot nu toe alleen los (ef.js:83) gelezen.
 * kv.mget geeft zelf al null terug op de positie van een niet-bestaande key
 * (bv. een niet-geanalyseerde duurrit zonder werk-segmenten) — dat is geen
 * foutpad, dus die posities worden hier stil weggefilterd, geen crash. De
 * volledige aanroep is bovendien in try/catch: een falende kv.mget (bv.
 * netwerkfout) geeft een lege lijst terug i.p.v. verzamelReviewContext te
 * laten crashen op dit ene signaal.
 * @param {object} kv
 * @param {string} userId
 * @param {(number|string)[]} activiteitIds
 * @returns {Promise<{activiteitId: number|string, instorting: object}[]>}
 */
export async function leesRecenteInstortingen(kv, userId, activiteitIds) {
  if (!activiteitIds?.length) return [];
  try {
    const keys = activiteitIds.map(id => `segment_instorting:${userId}:${id}`);
    const resultaten = await kv.mget(...keys);
    return activiteitIds
      .map((activiteitId, i) => ({ activiteitId, instorting: resultaten[i] ?? null }))
      .filter(r => r.instorting != null);
  } catch (e) {
    console.warn(`[instorting] leesRecenteInstortingen mislukt (fail-open):`, e.message);
    return [];
  }
}
