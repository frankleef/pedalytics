// Bouwstuk 8: Cardiac decoupling berekening.
// Pw:Hr ratio eerste helft vs tweede helft van Z2-duurritten.

import { getKV } from "./kv";

/**
 * Berekent cardiac decoupling voor een activiteit.
 * @param {Array} watts - Vermogen-stream
 * @param {Array} heartrate - Hartslag-stream
 * @returns {number|null} - Decoupling percentage (positief = slechter)
 */
export function berekenDecoupling(watts, heartrate) {
  if (!watts || !heartrate || watts.length < 60 || heartrate.length < 60) return null;

  const n = Math.min(watts.length, heartrate.length);
  const helft = Math.floor(n / 2);

  const gemiddelde = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

  const watts1 = watts.slice(0, helft).filter((w) => w > 0);
  const hr1 = heartrate.slice(0, helft).filter((h) => h > 0);
  const watts2 = watts.slice(helft, n).filter((w) => w > 0);
  const hr2 = heartrate.slice(helft, n).filter((h) => h > 0);

  if (watts1.length < 10 || hr1.length < 10 || watts2.length < 10 || hr2.length < 10) return null;

  const pwHr1 = gemiddelde(watts1) / gemiddelde(hr1);
  const pwHr2 = gemiddelde(watts2) / gemiddelde(hr2);

  if (pwHr1 === 0) return null;

  return ((pwHr1 - pwHr2) / pwHr1) * 100;
}

/**
 * Berekent en cachet decoupling voor een activiteit.
 * @param {string} activiteitId
 * @param {Array} watts - Vermogen-stream
 * @param {Array} heartrate - Hartslag-stream
 * @returns {Promise<number|null>}
 */
export async function berekenEnCacheDecoupling(activiteitId, watts, heartrate) {
  const kv = getKV();
  const cacheKey = `decoupling:${activiteitId}`;

  const cached = await kv.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const result = berekenDecoupling(watts, heartrate);
  if (result !== null) {
    await kv.set(cacheKey, Math.round(result * 10) / 10);
  }

  return result;
}

/**
 * Controleert of een fase-overgang uitgesteld moet worden op basis van decoupling.
 * @param {Array} decouplingWaarden - Array van decoupling-percentages
 * @param {number} aantalVerlengingen - Hoe vaak de fase al verlengd is
 * @returns {{ uitstel: boolean, mediaan: number }}
 */
export function checkFaseOvergang(decouplingWaarden, aantalVerlengingen = 0) {
  if (decouplingWaarden.length === 0) return { uitstel: false, mediaan: 0 };

  const gesorteerd = [...decouplingWaarden].sort((a, b) => a - b);
  const mid = Math.floor(gesorteerd.length / 2);
  const mediaan = gesorteerd.length % 2 === 0
    ? (gesorteerd[mid - 1] + gesorteerd[mid]) / 2
    : gesorteerd[mid];

  const uitstel = mediaan > 7 && aantalVerlengingen < 2;

  return { uitstel, mediaan: Math.round(mediaan * 10) / 10 };
}
