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

export function ritMatchesSessie(ritClassificatie, sessieType) {
  const t = ritClassificatie.type;
  const s = sessieType;
  if (t === s) return true;
  if (s === "duur_lang" && (t === "duur_lang" || t === "herstel" || t === "tempo")) return true;
  if (s === "duur_variabel" && (t === "duur_lang" || t === "tempo")) return true;
  if (s === "sweetspot" && (t === "sweetspot" || t === "tempo" || t === "drempel")) return true;
  if (s === "interval" && (t === "vo2max" || t === "drempel" || t === "sweetspot" || t === "anaeroob")) return true;
  if (s === "duur_middel" && (t === "duur_lang" || t === "tempo")) return true;
  if (s === "herstel" && (t === "herstel" || t === "duur_lang")) return true;
  return false;
}
