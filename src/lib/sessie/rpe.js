/**
 * Berekent de verwachte RPE op basis van sessie-IF en duur.
 * @param {number} gewogenGemVermogen - gewogen gem. vermogen van alle segmenten (%FTP)
 * @param {number} duurMinuten - totale sessieduur
 * @returns {number} verwacht_rpe - afgerond op 0.5, bereik 1-10
 */
export function berekenVerwachtRpe(gewogenGemVermogen, duurMinuten) {
  const IF = gewogenGemVermogen / 100;
  const basis_rpe = IF * 10;
  const duur_correctie = (duurMinuten - 60) * 0.015;
  const rpe = basis_rpe + duur_correctie;
  return Math.round(Math.min(10, Math.max(1, rpe)) * 2) / 2;
}

/**
 * Berekent het gewogen gemiddeld vermogen van segmenten (in %FTP).
 */
export function berekenGewogenGemVermogen(segmenten) {
  if (!segmenten || segmenten.length === 0) return 65;
  let totalPctMin = 0;
  let totalMin = 0;
  for (const seg of segmenten) {
    const gemPct = ((seg.vermogenMin ?? seg.vermogenMin_pct ?? 65) + (seg.vermogenMax ?? seg.vermogenMax_pct ?? 75)) / 2;
    const min = seg.duur_min || 1;
    totalPctMin += gemPct * min;
    totalMin += min;
  }
  return totalMin > 0 ? totalPctMin / totalMin : 65;
}

/**
 * Berekent verwacht RPE voor een sessie en voegt het toe aan het sessie-object.
 */
export function voegVerwachtRpeToe(sessie) {
  if (!sessie || sessie.verwacht_rpe != null) return sessie;
  const gemPct = berekenGewogenGemVermogen(sessie.segmenten);
  sessie.verwacht_rpe = berekenVerwachtRpe(gemPct, sessie.duur_min || 60);
  return sessie;
}

/**
 * RPE delta feedbacktekst.
 */
export function rpeDeltaFeedback(delta) {
  if (delta == null) return null;
  if (delta <= -2) return "Lichter dan verwacht — goed teken dat je herstel op orde is.";
  if (delta <= -0.5) return "Iets lichter dan gepland — dat is prima.";
  if (delta <= 0.4) return "Precies zoals verwacht.";
  if (delta <= 1.9) return "Iets zwaarder dan gepland — normaal, maar houd het in de gaten.";
  return "Duidelijk zwaarder dan verwacht — let op je herstel.";
}
