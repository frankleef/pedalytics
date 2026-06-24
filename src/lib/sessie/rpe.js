/**
 * Berekent de verwachte RPE op basis van Intensity Factor en duur.
 * S-curve (IF^1.8): Z2 → ~4, sweetspot → ~7.5, drempel → ~10.
 *
 * @param {number} ifWaarde - Intensity Factor (NP/FTP) of gewogen gem. vermogen als %FTP (wordt gedeeld door 100)
 * @param {number} duurMinuten - totale sessieduur
 * @returns {number} verwacht_rpe - afgerond op 0.5, bereik 1-10
 */
export function berekenVerwachtRpe(ifWaarde, duurMinuten) {
  const IF = ifWaarde > 2 ? ifWaarde / 100 : ifWaarde;
  const basis_rpe = 10 * Math.pow(IF, 2.5);
  const duur_correctie = (duurMinuten - 60) * 0.015;
  return Math.round(Math.min(10, Math.max(1, basis_rpe + duur_correctie)) * 2) / 2;
}

/**
 * Range voor UI: ±1 punt, geclampd op [1, 10].
 */
export function verwachtRpeRange(verwacht_rpe) {
  return {
    min: Math.max(1, verwacht_rpe - 1),
    max: Math.min(10, verwacht_rpe + 1),
  };
}

/**
 * Berekent het gewogen gemiddeld vermogen van segmenten (in %FTP).
 */
export function berekenGewogenGemVermogen(segmenten, ftpW = 265) {
  if (!segmenten || segmenten.length === 0) return 65;
  let totalPctMin = 0;
  let totalMin = 0;
  for (const seg of segmenten) {
    const vMin = seg.vermogenMin ?? 65;
    const vMax = seg.vermogenMax ?? 75;
    const isWatts = vMin > 100;
    const gemPct = isWatts ? ((vMin + vMax) / 2 / ftpW) * 100 : (vMin + vMax) / 2;
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
