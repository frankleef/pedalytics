// A3: stil, intern "vorige periode had een probleem"-signaal — verlaagt de
// kernstimulus-frequentie (weekSolver.js, bepaalKernstimulusFrequentie) met 1
// zolang actief. Geen gebruikersmelding, geen tiered-logica (i.t.t.
// compliance_freeze, sessie/compliance.js) — alleen het record-vorm/TTL/
// 7-dagen-reset-sjabloon is daarvandaan hergebruikt, niet
// evalueerComplianceFreeze zelf (die is doordrenkt met compliance-specifieke
// databron/drempels/meldingen, een ander domein dan dit signaal).
//
// Twee triggerbronnen (beide schrijven via zetWeekVoorzichtig):
// - monotonie-degradatie (weekSessiesDeterministisch.js, aanroeper van
//   weekSolver.js se verlaagBijHogeMonotonie — niet die pure functie zelf).
// - een mislukte B5-herschikking (hrv/verwerking.js, wanneer
//   sessie/herschikking.js se probeerHerschikking() null teruggeeft).

import { datumOffset } from "../datum";

function weekVoorzichtigKey(userId) {
  return `week_voorzichtig:${userId}`;
}

/**
 * Zet het week_voorzichtig-record actief, met vandaag als nieuwste trigger.
 * Onvoorwaardelijke write bij elke aanroep — geen tellerlogica/drempel zoals
 * compliance_freeze (dat is C4's eigen "1 vs. ≥2 missers"-beleid, hier niet
 * van toepassing: elke trigger is op zichzelf voldoende reden).
 * @param {object} kv
 * @param {string} userId
 * @param {string} datum - ISO-datum van de trigger
 */
export async function zetWeekVoorzichtig(kv, userId, datum) {
  await kv.set(weekVoorzichtigKey(userId), { actief: true, laatsteTriggerDatum: datum }, { ex: 8 * 86400 });
}

/**
 * Leest het week_voorzichtig-record. Puur-lezend: past dezelfde 7-dagen-
 * tijdgebaseerde-resetcheck toe als compliance_freeze (compliance.js,
 * evalueerComplianceFreeze se stap d), maar herschrijft de KV-waarde daarbij
 * NIET — er is geen aparte evaluatie-cron die dat zou moeten doen zoals bij
 * compliance_freeze; de 8-dagen-TTL op zetWeekVoorzichtig is hier het
 * achterliggende, harde vangnet. Fail-open (false) bij een afwezig record.
 * @param {object} kv
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function leesWeekVoorzichtig(kv, userId) {
  const record = await kv.get(weekVoorzichtigKey(userId));
  if (!record?.actief) return false;
  if (record.laatsteTriggerDatum && record.laatsteTriggerDatum <= datumOffset(-7)) return false;
  return true;
}
