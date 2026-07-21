// B2: HRV-herstelsnelheid — tijd-tot-baseline na de laatste zware inspanning.
// Per-sessie-hersteltijd-vraag, fundamenteel anders dan de drie andere
// HRV-lagen in deze codebase: bepaalHrvZone (hrv/zone.js, vandaag-vs-rollende-
// basislijn), hrv/trend.js (acute 14-dagen-daling, ongewijzigd, dagelijks via
// cron/morning), hrv/basislijnTrend.js (B6, structurele 21-dagen-trend in de
// basislijn zelf). Zie ieder van die bestanden voor hun eigen toelichting.

import { gemiddelde } from "./math";

/**
 * Schone referentie-HRV: gemiddelde over (tot) de laatste 14 dagen VÓÓR
 * zwareSessieDatum — spiegelt hrv/trend.js's berekenHrvBaseline-PRINCIPE
 * (exclusie van mogelijk-gecontamineerde recente dagen), maar de exclusiegrens
 * ankert op de zware-sessie-datum zelf i.p.v. op een vaste "vandaag min 3" —
 * berekenHrvBaseline zelf blijft bewust ongewijzigd (actief, dagelijks
 * mechanisme via cron/morning/route.js, geen risico nemen door het te
 * parametriseren voor dit andere doel).
 * @param {Array} wellnessData - {datum|id, hrv}[]
 * @param {string} zwareSessieDatum - ISO-datum
 * @returns {number|null} null bij <7 bruikbare datapunten vóór die datum
 */
export function berekenSchoneReferentie(wellnessData, zwareSessieDatum) {
  const voorSessie = (wellnessData || [])
    .filter(d => (d.datum || d.id) < zwareSessieDatum)
    .slice(-14)
    .map(d => d.hrv)
    .filter(v => v != null && v > 0);

  if (voorSessie.length < 7) return null;
  return gemiddelde(voorSessie);
}

/**
 * Aantal dagen ná sessieDatum tot HRV terugveerde naar/boven schoneReferentie
 * (max. 5 dagen vooruit gekeken). Referentie is nu een expliciet meegegeven,
 * al-berekende schone waarde (berekenSchoneReferentie) i.p.v. hier zelf een
 * drempel af te leiden van hrvProfiel.basislijn_28d/sd_90d — die basislijn
 * wordt zelf maar wekelijks herberekend en zou de eigen onderdrukte dagen ná
 * de sessie meetellen zodra de eerstvolgende maandag komt (zelfde
 * "absorptie"-probleem als B6, hier op weekniveau).
 * @param {string} sessietype
 * @param {string} sessieDatum - ISO-datum
 * @param {Array} wellnessData - {datum|id, hrv}[]
 * @param {number|null} schoneReferentie - uit berekenSchoneReferentie()
 * @returns {number|null} 1-5, of null (geen referentie, of geen herstel binnen 5 dagen)
 */
export function berekenHerstelDagen(sessietype, sessieDatum, wellnessData, schoneReferentie) {
  if (schoneReferentie == null) return null;

  const dagenNaSessie = (wellnessData || [])
    .filter(d => (d.datum || d.id) > sessieDatum)
    .slice(0, 5);

  for (let i = 0; i < dagenNaSessie.length; i++) {
    if (dagenNaSessie[i].hrv >= schoneReferentie) return i + 1;
  }
  return null;
}

export const POPULATIENORMEN_HERSTEL = {
  drempel_intervallen: 2.0,
  vo2max_intervallen: 2.5,
  vo2max_lang: 2.5,
  vo2max_kort: 2.0,
  sweetspot_lang: 1.8,
  sweetspot_intervallen: 1.5,
  microbursts: 1.5,
  z2_duur: 0.9,
  z2_lang: 1.0,
  sprint_neuraal: 1.2,
  kracht_lage_cadans: 1.5,
  herstel_actief: 0.3,
  _default: 1.5,
};

export function getHerstelDagen(sessietype, hrvProfiel) {
  const data = hrvProfiel?.herstelsnelheid?.[sessietype];
  if (data && data.observaties >= 8) return data.dagen;
  return POPULATIENORMEN_HERSTEL[sessietype] ?? POPULATIENORMEN_HERSTEL._default;
}

// Veiligheidsplafond: bescherming tegen een corrupte of onrealistisch
// opgeblazen gepersonaliseerde waarde in hrvProfiel.herstelsnelheid (bv. door
// een datafout) die anders een trigger weken zou laten doorlopen. Geëxporteerd
// zodat genereren.js dezelfde grens kan hergebruiken als voorwaarde vóórdat
// een verse /wellness-call de moeite waard is (geen recente zware sessie =
// geen reden om schoneReferentie ooit te berekenen).
export const HERSTEL_PLAFOND_DAGEN = 3;

/**
 * B2-trigger: is de gebruiker nog "acuut aan het herstellen" van de laatste
 * zware sessie? Combineert een tijdsvenster (per-sessietype-norm, geplafonneerd)
 * met een HRV-vs-schone-referentie-check.
 *
 * Drempel (0.90, d.w.z. HRV >10% onder de schone referentie): coaching-
 * heuristiek, niet cyclisme-specifiek gevalideerd — zelfde soort voorlopige
 * grenswaarde als monotonie/strain se ">2.0" en B6's "±5%", later te
 * kalibreren met echte gebruikersdata.
 *
 * @param {object} params
 * @param {string|null} params.zwareSessieDatum
 * @param {number|null} params.huidigeHrv
 * @param {number|null} params.schoneReferentie
 * @param {string|null} params.sessietype
 * @param {object|null} params.hrvProfiel
 * @returns {boolean}
 */
export function bepaalHerstelsnelheidTrigger({ zwareSessieDatum, huidigeHrv, schoneReferentie, sessietype, hrvProfiel }) {
  if (!zwareSessieDatum || huidigeHrv == null || schoneReferentie == null) return false;

  const dagenSindsSessie = Math.floor((new Date() - new Date(zwareSessieDatum)) / 86400000);
  const venster = Math.min(getHerstelDagen(sessietype, hrvProfiel), HERSTEL_PLAFOND_DAGEN);
  if (dagenSindsSessie > venster) return false;

  return huidigeHrv < schoneReferentie * 0.90;
}
