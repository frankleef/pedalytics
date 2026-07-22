/**
 * Berekent de verwachte RPE op basis van Lucia TRIMP (Lucia et al., 2003):
 * Coggan Z1-Z7 tijdsverdeling gegroepeerd naar 3 fysiologische zones
 * (VT1 ≈ Z2/Z3-grens, VT2 ≈ Z4/Z5-grens), gewicht 1/2/3, gewogen naar tijdsaandeel.
 * Vervangt de eerdere IF^2.5-formule (sectie 26-C, Appendix B-1) — die overschatte
 * variabele buitenritten met hoge VI.
 *
 * @param {object} tijdInZones - tijd (seconden of elke gelijke eenheid) per zone, bv. { Z1: 300, Z2: 4800, ... }
 * @param {number} duurMinuten - totale duur in minuten
 * @returns {number|null} verwacht_rpe - afgerond op 0.5, bereik 1-10, of null zonder zonedata
 */
export function berekenVerwachtRpe(tijdInZones, duurMinuten) {
  if (typeof tijdInZones === "number") {
    console.warn(
      "berekenVerwachtRpe: signatuur gewijzigd — geef een zone-tijdenobject mee " +
      "({ Z1..Z7: seconden }), niet een IF-getal. Zie sectie 26-C, Appendix B-1."
    );
    const basis = 10 * Math.pow(tijdInZones, 2.5);
    const correctie = (duurMinuten - 60) * 0.015;
    return Math.round(Math.min(10, Math.max(1, basis + correctie)) * 2) / 2;
  }

  const totaal = Object.values(tijdInZones || {}).reduce((s, v) => s + (v || 0), 0);
  if (!totaal) return null;

  const lucia1 = (tijdInZones.Z1 || 0) + (tijdInZones.Z2 || 0);
  const lucia2 = (tijdInZones.Z3 || 0) + (tijdInZones.Z4 || 0);
  const lucia3 = (tijdInZones.Z5 || 0) + (tijdInZones.Z6 || 0) + (tijdInZones.Z7 || 0);

  const luciaScore = (lucia1 * 1 + lucia2 * 2 + lucia3 * 3) / totaal;
  const basis_rpe = (luciaScore / 3) * 10;
  const duur_correctie = (duurMinuten - 60) * 0.015;
  const verwacht_rpe = Math.min(10, Math.max(1, basis_rpe + duur_correctie));
  return Math.round(verwacht_rpe * 2) / 2;
}

/**
 * Bepaalt het gemiddelde %FTP van één segment (watts of percentage).
 */
function segmentGemPct(seg, ftpW) {
  const vMin = seg.vermogenMin ?? 65;
  const vMax = seg.vermogenMax ?? 75;
  // Legacy fallback: geen eenheid-veld → >100 = watts
  const inWatts = seg.eenheid === "watts" || (!seg.eenheid && vMin > 100);
  return inWatts ? ((vMin + vMax) / 2 / ftpW) * 100 : (vMin + vMax) / 2;
}

/**
 * Bouwt een zone-tijdenobject uit geplande sessieblokken, voor gebruik vóór de rit.
 * Gebruikt seg.zone waar aanwezig (output van berekenBlok()); valt terug op de
 * %FTP-grenzen VT1≈75%/VT2≈90% (Lucia et al., 2003) voor segmenten zonder zone-label.
 *
 * @param {Array} segmenten - sessie.segmenten, elk met duur_min/blokDuurSeconden
 * @param {number} duurMinuten - totale sessieduur in minuten
 * @param {number} ftpW - FTP in watt, voor segmenten in watts
 * @returns {number|null} verwacht_rpe
 */
export function berekenVerwachtRpeVanBlokken(segmenten, duurMinuten, ftpW = 265) {
  if (!segmenten?.length) return null;
  const tijdInZones = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, Z6: 0, Z7: 0 };
  let totaalSec = 0;
  for (const seg of segmenten) {
    const duurSec = seg.blokDuurSeconden ?? ((seg.duur_min || 0) * 60);
    if (!duurSec) continue;
    let zone = seg.zone;
    if (!zone || tijdInZones[zone] === undefined) {
      const pct = segmentGemPct(seg, ftpW);
      zone = pct < 75 ? "Z2" : pct < 90 ? "Z3" : "Z5";
    }
    tijdInZones[zone] += duurSec;
    totaalSec += duurSec;
  }
  if (!totaalSec) return null;
  return berekenVerwachtRpe(tijdInZones, duurMinuten);
}

/**
 * Berekent verwacht RPE voor een sessie en voegt het toe aan het sessie-object.
 */
export function voegVerwachtRpeToe(sessie) {
  if (!sessie || sessie.verwacht_rpe != null) return sessie;
  sessie.verwacht_rpe = berekenVerwachtRpeVanBlokken(sessie.segmenten, sessie.duur_min || 60);
  return sessie;
}

/**
 * Bepaalt of de RPE van een rit nog aanpasbaar is.
 * Window: 24 uur na het starttijdstip van de rit.
 * @param {string|Date} ritStarttijd - start_date_local van de activiteit (intervals.icu)
 * @returns {boolean}
 */
export function isRpeAanpasbaar(ritStarttijd) {
  if (!ritStarttijd) return false;
  const grens = new Date(ritStarttijd).getTime() + 24 * 60 * 60 * 1000;
  return Date.now() < grens;
}
