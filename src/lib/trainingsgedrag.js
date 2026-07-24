// Trainingsgedrag: plan-naleving (% sessies daadwerkelijk gereden) en
// polarisatie (Z1-Z2 vs. Z3-Z5 tijdsverdeling), berekend uit ritten/
// weekSessies die de UI toch al in props heeft. Bewust client-side/puur i.p.v.
// via de KV-gebackte distributie.js: die slaat alleen een waarde op zodra de
// afwijking >10pp is (voor de correctie-notificatie), en levert dus geen
// altijd-beschikbaar percentage voor weergave. Gedeeld tussen VoortgangTab en
// de Home-Fitheid-kaart zodat er één plek is met deze formule i.p.v. twee
// losse kopieën.

/**
 * % geplande sessies (t/m vandaag, vanaf grensDatum) waarvoor een gereden rit
 * op dezelfde datum bestaat.
 * @param {{sessies: Array}} weekSessies
 * @param {Array<{datum_iso: string}>} ritten
 * @param {Date} grensDatum
 * @returns {{pct: number, totaalPlan: number}}
 */
export function berekenPlanNaleving(weekSessies, ritten, grensDatum) {
  const planSessies = (weekSessies?.sessies || []).filter(s => s.datum && new Date(s.datum) >= grensDatum);
  const planRitten = (ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grensDatum);

  let matched = 0, totaalPlan = 0;
  const nu = new Date();
  planSessies.forEach(s => {
    if (new Date(s.datum) > nu) return;
    totaalPlan++;
    if (planRitten.some(r => r.datum_iso === s.datum)) matched++;
  });

  return { pct: totaalPlan > 0 ? Math.round((matched / totaalPlan) * 100) : 0, totaalPlan };
}

/**
 * % van de gereden tijd (vanaf grensDatum) in Z1-Z2 t.o.v. Z3-Z5, op basis
 * van de per-rit zoneTijden (intervals.icu icu_zone_times).
 * @param {Array<{datum_iso: string, zoneTijden: Array<{id: string, secs: number}>}>} ritten
 * @param {Date} grensDatum
 * @returns {{pct: number, totaalSeconden: number}}
 */
export function berekenPolarisatie(ritten, grensDatum) {
  let z12secs = 0, totaalSeconden = 0;

  (ritten || [])
    .filter(r => r.datum_iso && new Date(r.datum_iso) >= grensDatum)
    .forEach(r => {
      const zt = r.zoneTijden;
      if (!zt || !Array.isArray(zt)) return;
      zt.forEach(z => {
        const secs = z.secs || 0;
        totaalSeconden += secs;
        if (z.id === "Z1" || z.id === "Z2") z12secs += secs;
      });
    });

  return { pct: totaalSeconden > 0 ? Math.round((z12secs / totaalSeconden) * 100) : 0, totaalSeconden };
}
