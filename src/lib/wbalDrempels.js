// D5: instelbare W'bal-drempels voor CP/W'-gekalibreerde interval-/rustduur
// (VO2max/anaerobe archetypes, zie wbalSimulatie.js). Zelfde vorm als het
// archetype-KV-cache-mechanisme (sessie-archetypes.js: archetypeCache,
// getArchetypesVoorSessietypeRaw, invalideerArchetypeCache) — hier met één
// vaste KV-key i.p.v. één key per sessietype, maar dezelfde Map-cache/TTL/
// expliciete-invalidatie-structuur, zodat een admin-wijziging direct effect
// heeft i.p.v. tot 5 minuten later.
import { getKV } from "./kv";

export const WBAL_DREMPELS_KV_KEY = "wbal_drempels";

// Startwaarden: depletiePct=60 (gepubliceerd HIIE-onderzoek: interval eindigt
// bij 40% resterend W'). herstelPct=75 is bewust gematigd, niet hard
// onderbouwd — het Skiba-model onderschat reconstitutie systematisch, dus een
// hoger percentage zou nodeloos lange rust opleveren (zie D5-trace).
export const STANDAARD_WBAL_DREMPELS = { depletiePct: 60, herstelPct: 75 };

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Haalt de actuele W'bal-drempels op (cache-first, TTL 5 min). Ontbrekende
 * KV-waarde -> standaardwaarden, nooit een crash.
 * @param {object} [kv] - injectable KV-client (default: getKV()), zelfde
 *   patroon als getArchetypesVoorSessietypeRaw
 */
export async function haalWbalDrempels(kv = getKV()) {
  const cached = cache.get(WBAL_DREMPELS_KV_KEY);
  if (cached && Date.now() - cached.opgehaaldOp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = (await kv.get(WBAL_DREMPELS_KV_KEY)) ?? STANDAARD_WBAL_DREMPELS;
  cache.set(WBAL_DREMPELS_KV_KEY, { data, opgehaaldOp: Date.now() });
  return data;
}

/** Forceert een verse KV-read bij de volgende aanroep. */
export function invalideerWbalDrempelsCache() {
  cache.delete(WBAL_DREMPELS_KV_KEY);
}

/** Uitsluitend voor testgebruik — zelfde reden als _wisArchetypeCacheVoorTests. */
export function _wisWbalDrempelsCacheVoorTests() {
  cache.clear();
}
