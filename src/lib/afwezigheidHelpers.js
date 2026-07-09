// Puur, dependency-vrij (geen kv/intervals-imports) — bedoeld om zowel
// server-side (afwezigheid.js, sessiesAanvullen.js) als client-side
// (AppClient.js e.a.) geïmporteerd te kunnen worden zonder server-only code
// (Upstash Redis, intervals.icu-credentials) in de client-bundle te trekken.

export function effectiefEind(periode) {
  return periode.eindDatum ?? "9999-12-31";
}

/** Valt `datum` binnen een actieve afwezigheidsperiode? */
export function valtBinnenAfwezigheid(datum, periodes) {
  return (periodes || []).some(p => p.status === "actief" && datum >= p.startDatum && datum <= effectiefEind(p));
}

/** De actieve afwezigheidsperiode die `datum` overspant, of null. */
export function vindActievePeriode(datum, periodes) {
  return (periodes || []).find(p => p.status === "actief" && datum >= p.startDatum && datum <= effectiefEind(p)) || null;
}
