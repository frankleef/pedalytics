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

const Z1_TOEGESTAAN_IN = ["sprint_neuraal", "vo2max_intervallen", "vo2max_kort", "microbursts", "z2_embedded_sprint", "sprint_peak_test"];

export function normaliseerZ1Blokken(segmenten, sessietype) {
  if (!segmenten || !Array.isArray(segmenten)) return segmenten;
  if (Z1_TOEGESTAAN_IN.includes(sessietype)) return segmenten;

  return segmenten.map(seg => {
    if (seg.zone !== "Z1") return seg;
    console.warn(`[normaliseer] Z1→Z2 in '${sessietype}': blokduur=${seg.blokDuurSeconden || seg.duur_min}s`);
    return { ...seg, zone: "Z2", positie: "onder" };
  });
}

/**
 * Centrale gate: max 1 kracht_lage_cadans per rollend 7-dagenvenster.
 * Synchroon — neemt bestaandeSessies als input, geen KV-aanroep nodig.
 *
 * @param {object} nieuweSessie  - de te valideren sessie (heeft .datum en .intentie?.sessietype)
 * @param {object[]} bestaandeSessies - alle al geplande/gereden sessies (inclusief aangevuld)
 * @returns {{ geldig: boolean, reden?: string }}
 */
export function valideerKrachtRestrictie(nieuweSessie, bestaandeSessies) {
  const sessietype = nieuweSessie.intentie?.sessietype || nieuweSessie.sessietype;
  if (sessietype !== "kracht_lage_cadans") return { geldig: true };

  const nieuweMs = new Date(nieuweSessie.datum).getTime();
  const venster = 6 * 86400000; // 6 dagen = rollend 7-dagenvenster (datum zelf = dag 1)

  const conflicten = (bestaandeSessies || []).filter(s => {
    const st = s.intentie?.sessietype || s.sessietype;
    if (st !== "kracht_lage_cadans") return false;
    const diff = Math.abs(new Date(s.datum).getTime() - nieuweMs);
    return diff > 0 && diff <= venster; // zelfde datum telt niet mee (vervangingsscenario)
  });

  if (conflicten.length === 0) return { geldig: true };

  return {
    geldig: false,
    reden: `kracht_lage_cadans al gepland op ${conflicten.map(s => s.datum).join(", ")} (binnen 7 dagen)`,
  };
}

/**
 * Normaliseert segmenten op een sessie-object (in-place).
 */
export function normaliseerSessieSegmenten(sessie) {
  if (!sessie) return sessie;
  if (sessie.segmenten) {
    sessie.segmenten = normaliseerSegmenten(sessie.segmenten);
    const sessietype = sessie.intentie?.sessietype || sessie.type;
    sessie.segmenten = normaliseerZ1Blokken(sessie.segmenten, sessietype);
  }
  return sessie;
}
