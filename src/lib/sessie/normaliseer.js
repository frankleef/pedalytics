// Normaliseert segment-veldnamen na een Claude-response.
// Claude is inconsistent: soms vermogenMin, soms vermogenMin_pct, soms power_low.
// Deze functie zorgt dat downstream code (ZWO-generator, grafiek) altijd
// vermogenMin/vermogenMax (in %FTP) kan verwachten.

export function normaliseerSegmenten(segmenten) {
  if (!segmenten || !Array.isArray(segmenten)) return segmenten;

  return segmenten.map((seg) => {
    const genormaliseerd = { ...seg };

    // vermogenMin: accepteer vermogenMin_pct, power_low, vermogen_min
    if (genormaliseerd.vermogenMin == null) {
      genormaliseerd.vermogenMin =
        seg.vermogenMin_pct ?? seg.power_low ?? seg.vermogen_min ?? seg.powerLow ?? null;
    }

    // vermogenMax: accepteer vermogenMax_pct, power_high, vermogen_max
    if (genormaliseerd.vermogenMax == null) {
      genormaliseerd.vermogenMax =
        seg.vermogenMax_pct ?? seg.power_high ?? seg.vermogen_max ?? seg.powerHigh ?? null;
    }

    // Als we absolute watts hebben maar geen %FTP, en er is geen %FTP-waarde
    if (genormaliseerd.vermogenMin == null && seg.vermogenMin_W != null) {
      // Kan niet omrekenen zonder FTP — laat null
    }

    // cadans_rpm: Claude stuurt soms een string ("85–90") i.p.v. object
    if (typeof genormaliseerd.cadans_rpm === "string") {
      const match = genormaliseerd.cadans_rpm.match(/(\d+)\s*[–-]\s*(\d+)/);
      if (match) {
        genormaliseerd.cadans_rpm = { min: parseInt(match[1]), max: parseInt(match[2]) };
      } else {
        delete genormaliseerd.cadans_rpm;
      }
    }

    // Opschonen: verwijder alternatieve veldnamen
    delete genormaliseerd.vermogenMin_pct;
    delete genormaliseerd.vermogenMax_pct;
    delete genormaliseerd.power_low;
    delete genormaliseerd.power_high;
    delete genormaliseerd.vermogen_min;
    delete genormaliseerd.vermogen_max;
    delete genormaliseerd.powerLow;
    delete genormaliseerd.powerHigh;

    return genormaliseerd;
  });
}

/**
 * Normaliseert segmenten op een sessie-object (in-place).
 */
export function normaliseerSessieSegmenten(sessie) {
  if (!sessie) return sessie;
  if (sessie.segmenten) {
    sessie.segmenten = normaliseerSegmenten(sessie.segmenten);
  }
  return sessie;
}
