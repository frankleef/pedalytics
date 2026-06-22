// Bouwstuk 7: Intensiteitsdistributie-berekening.
// Berekent of de 80/20-verdeling afwijkt en slaat correctie op in KV.

import { getKV } from "../kv";

/**
 * Berekent de distributie-afwijking op basis van voltooide ritten.
 * @param {string} userId
 * @param {Array} ritten - Voltooide ritten van afgelopen 14 dagen
 * @param {string} ervaringsniveau - "starter" | "recreatief" | "getraind"
 * @returns {Promise<{richting: string, magnitude: number}|null>}
 */
export async function berekenDistributie(userId, ritten, ervaringsniveau = "recreatief") {
  let z1z2Seconden = 0;
  let totaalSeconden = 0;

  for (const rit of ritten) {
    const zones = rit.zoneTijden || rit.icu_zone_times;
    if (!zones || !Array.isArray(zones)) continue;

    for (const z of zones) {
      const secs = z.secs || 0;
      totaalSeconden += secs;
      if (z.id === "Z1" || z.id === "Z2") z1z2Seconden += secs;
    }
  }

  if (totaalSeconden < 3600) return null;

  const z1z2Pct = z1z2Seconden / totaalSeconden;
  const doelPct = { starter: 0.90, recreatief: 0.80, getraind: 0.75 }[ervaringsniveau] || 0.80;
  const afwijking = z1z2Pct - doelPct;

  if (Math.abs(afwijking) < 0.10) return null;

  const result = {
    richting: afwijking < 0 ? "te_intensief" : "te_rustig",
    magnitude: Math.abs(afwijking),
    z1z2Pct: Math.round(z1z2Pct * 100),
    doelPct: Math.round(doelPct * 100),
  };

  // Sla op in KV met 8 dagen TTL
  const kv = getKV();
  await kv.set(`distributie:${userId}`, result, { ex: 8 * 86400 });

  return result;
}

/**
 * Leest de huidige distributie-afwijking uit KV.
 * @param {string} userId
 * @returns {Promise<{richting: string, magnitude: number}|null>}
 */
export async function haalDistributieAfwijking(userId) {
  const kv = getKV();
  return await kv.get(`distributie:${userId}`);
}
