const COGGAN_TABEL = [
  { maxIF: 0.55, type: "herstel",     label: "Herstelrit",     zone: "Zone 1" },
  { maxIF: 0.76, type: "duur_lang",   label: "Duurrit",        zone: "Zone 2" },
  { maxIF: 0.85, type: "tempo",       label: "Tempo",          zone: "Zone 3" },
  { maxIF: 0.95, type: "sweetspot",   label: "Sweet spot",     zone: "Zone 3–4" },
  { maxIF: 1.00, type: "drempel",     label: "Drempel",        zone: "Zone 4" },
  { maxIF: 1.10, type: "vo2max",      label: "VO2max",         zone: "Zone 5" },
  { maxIF: 1.30, type: "anaeroob",    label: "Anaeroob",       zone: "Zone 6" },
  { maxIF: Infinity, type: "sprint",  label: "Sprint",         zone: "Zone 7" },
];

export function classificeerRit(rit, ftp) {
  if (!ftp) return { type: "onbekend", label: "Rit", zone: "", intensityFactor: null };

  const np = rit?.np || rit?.wattage;
  if (!np) return { type: "onbekend", label: "Rit", zone: "", intensityFactor: null };

  const intensityFactor = np / ftp;

  const categorie = COGGAN_TABEL.find(c => intensityFactor <= c.maxIF) || COGGAN_TABEL[COGGAN_TABEL.length - 1];

  const vi = (rit.np && rit.avgWatts && rit.avgWatts > 0) ? rit.np / rit.avgWatts : null;
  let variabel = null;
  if (vi != null) variabel = vi > 1.05;

  return {
    type: categorie.type,
    label: categorie.label,
    zone: categorie.zone,
    intensityFactor: Math.round(intensityFactor * 100) / 100,
    vi: vi ? Math.round(vi * 100) / 100 : null,
    variabel,
  };
}

export function ritMatchesSessie(ritClassificatie, sessieType, rit, sessie) {
  const t = ritClassificatie.type;
  const s = sessieType;

  // Type-match: zit de rit in dezelfde "familie" als gepland?
  let typeMatch = false;
  if (t === s) typeMatch = true;
  else if (s === "duur_lang" && (t === "duur_lang" || t === "herstel" || t === "tempo")) typeMatch = true;
  else if (s === "duur_variabel" && (t === "duur_lang" || t === "tempo")) typeMatch = true;
  else if (s === "sweetspot" && (t === "sweetspot" || t === "tempo" || t === "drempel")) typeMatch = true;
  else if (s === "interval" && (t === "vo2max" || t === "drempel" || t === "sweetspot" || t === "anaeroob")) typeMatch = true;
  else if (s === "duur_middel" && (t === "duur_lang" || t === "tempo")) typeMatch = true;
  else if (s === "herstel" && (t === "herstel" || t === "duur_lang")) typeMatch = true;
  else if (s === "kracht_lage_cadans" && (t === "sweetspot" || t === "tempo" || t === "duur_lang")) typeMatch = true;

  if (!typeMatch) return false;

  // Duur: ±20%. TSS: asymmetrisch — overshoot tot 35%, undershoot tot 20%.
  // Meer TSS bij hetzelfde type en duur = harder gereden, niet afgeweken.
  if (rit && sessie) {
    const ritDuur = rit.duur_min || (rit.moving_time ? Math.round(rit.moving_time / 60) : null);
    const ritTss = rit.tss || rit.icu_training_load;
    const planDuur = sessie.duur_min;
    const planTss = sessie.tss;

    if (ritDuur && planDuur && Math.abs(ritDuur - planDuur) / planDuur > 0.20) return false;
    if (ritTss && planTss) {
      const delta = (ritTss - planTss) / planTss;
      if (delta > 0.35) return false;
      if (delta < -0.20) return false;
    }
  }

  return true;
}
