// Generieke, dependency-vrije datum-gebaseerde lineaire regressie over
// {datum, waarde}-punten. Geëxtraheerd uit ef.js's berekenEFTrend (die als
// eerste dit patroon nodig had) zodat andere longitudinale trends (bv.
// hrv/trend.js) dezelfde regressie-kern hergebruiken i.p.v. herhalen.
//
// Regresseert op echte datumverschillen (in dagen), niet op array-index —
// ctlRampRegressie() (lib/conditie.js) doet dat laatste wél, maar veronderstelt
// daarmee equidistante (dagelijkse) metingen. Deze functie is bedoeld voor
// onregelmatig verspreide punten (niet elke dag een meting/kwalificerende
// rit) en blijft daardoor robuust tegen ontbrekende dagen/weken in de reeks.

/**
 * @param {{datum: string, waarde: number}[]} punten
 * @returns {{hellingPerDag: number, hellingPerWeek: number, laatsteWaarde: number}|null}
 *   null bij <4 punten, of als alle punten op dezelfde dag liggen (geen tijdsspreiding)
 */
export function berekenLineaireTrendPerWeek(punten) {
  if (!punten?.length || punten.length < 4) return null;

  const gesorteerd = [...punten].sort((a, b) => a.datum.localeCompare(b.datum));
  const t0 = new Date(gesorteerd[0].datum).getTime();
  const dagenSindsStart = gesorteerd.map(p => (new Date(p.datum).getTime() - t0) / 86400000);
  const waarden = gesorteerd.map(p => p.waarde);

  const n = dagenSindsStart.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += dagenSindsStart[i];
    sumY += waarden[i];
    sumXY += dagenSindsStart[i] * waarden[i];
    sumX2 += dagenSindsStart[i] * dagenSindsStart[i];
  }
  const noemer = n * sumX2 - sumX * sumX;
  if (noemer === 0) return null; // alle punten op dezelfde dag — geen tijdsspreiding

  const hellingPerDag = (n * sumXY - sumX * sumY) / noemer;
  return {
    hellingPerDag,
    hellingPerWeek: hellingPerDag * 7,
    laatsteWaarde: waarden[n - 1],
  };
}
