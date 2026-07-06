export const DOELPROFIELEN = {
  ftp: {
    naam: "FTP verhogen",
    tss_opbouw_pct: 0.10,
    decoupling_drempel: 7,
    eindtest_type: "ramp_test",
    fases: [
      { naam: "Basis", weken: [1,2,3], z1z2_doel: 0.90,
        max_intensiteit_per_week: 1,
        sessietypes: ["z2_duur","kracht_lage_cadans","z1_herstel"],
        kracht_lage_cadans_max_per_2_weken: 1 },
      { naam: "Sweetspot", weken: [5,6,7], z1z2_doel: 0.80,
        max_intensiteit_per_week: 2,
        sessietypes: ["sweetspot_intervallen","z2_duur","z1_herstel"] },
      { naam: "Drempel", weken: [9,10,11], z1z2_doel: 0.75,
        max_intensiteit_per_week: 2,
        sessietypes: ["drempel_intervallen","vo2max_intervallen","z2_duur","z1_herstel"] },
      { naam: "Consolidatie", weken: [12], z1z2_doel: 0.80,
        max_intensiteit_per_week: 1,
        sessietypes: ["z2_duur","drempel_intervallen","z1_herstel"] },
      { naam: "Test", weken: [13], z1z2_doel: 0.90,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","ramp_test"] },
    ],
  },

  aerobe_basis: {
    naam: "Betere aerobe basis",
    tss_opbouw_pct: 0.08,
    decoupling_drempel: 5,
    eindtest_type: "ramp_test",
    fases: [
      { naam: "Aerobe opbouw 1", weken: [1,2,3], z1z2_doel: 0.95,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","z1_herstel"],
        langste_sessie_verleng_min: 15 },
      { naam: "Aerobe opbouw 2", weken: [5,6,7], z1z2_doel: 0.92,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","z1_herstel"],
        langste_sessie_verleng_min: 15 },
      { naam: "Aerobe verdieping", weken: [9,10,11], z1z2_doel: 0.88,
        max_intensiteit_per_week: 1,
        sessietypes: ["z2_duur","sweetspot_intervallen","z1_herstel"],
        sweetspot_max_per_2_weken: 1 },
      { naam: "Consolidatie", weken: [12], z1z2_doel: 0.90,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","z1_herstel"] },
      { naam: "Test", weken: [13], z1z2_doel: 0.95,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","ramp_test"] },
    ],
  },

  klimmen: {
    naam: "Klimmen & W/kg",
    tss_opbouw_pct: 0.10,
    decoupling_drempel: 7,
    eindtest_type: "ramp_test",
    fases: [
      { naam: "Basis", weken: [1,2,3], z1z2_doel: 0.90,
        max_intensiteit_per_week: 1,
        sessietypes: ["z2_duur","kracht_lage_cadans","z1_herstel"] },
      { naam: "Sweetspot", weken: [5,6,7], z1z2_doel: 0.78,
        max_intensiteit_per_week: 2,
        sessietypes: ["sweetspot_intervallen","kracht_lage_cadans","z2_duur","z1_herstel"] },
      { naam: "Drempel + VO2max", weken: [9,10], z1z2_doel: 0.73,
        max_intensiteit_per_week: 2,
        sessietypes: ["drempel_intervallen","vo2max_intervallen","z2_duur","z1_herstel"] },
      { naam: "Klimspecifiek", weken: [11], z1z2_doel: 0.70,
        max_intensiteit_per_week: 2,
        sessietypes: ["vo2max_intervallen","drempel_intervallen","z2_duur","z1_herstel"] },
      { naam: "Consolidatie", weken: [12], z1z2_doel: 0.80,
        max_intensiteit_per_week: 1,
        sessietypes: ["z2_duur","sweetspot_intervallen","z1_herstel"] },
      { naam: "Test", weken: [13], z1z2_doel: 0.90,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","ramp_test"] },
    ],
  },

  uithoudingsvermogen: {
    naam: "Lange ritten",
    tss_opbouw_pct: 0.07,
    decoupling_drempel: 7,
    eindtest_type: null,
    taper_tss_pct: 0.32,
    fases: [
      { naam: "Volume opbouw", weken: [1,2,3], z1z2_doel: 0.92,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","z1_herstel"],
        langste_sessie_is_sleutel: true },
      { naam: "Volume + duur", weken: [5,6,7], z1z2_doel: 0.90,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","z1_herstel"],
        langste_sessie_target_pct_event: 0.75 },
      { naam: "Sweetspot hardening", weken: [9,10,11], z1z2_doel: 0.83,
        max_intensiteit_per_week: 1,
        sessietypes: ["sweetspot_intervallen","z2_duur","z1_herstel"] },
      { naam: "Consolidatie", weken: [12], z1z2_doel: 0.88,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur"],
        langste_sessie_target_pct_event: 1.0 },
      { naam: "Taper", weken: [13], z1z2_doel: 0.95,
        max_intensiteit_per_week: 0,
        sessietypes: ["z2_duur","z1_herstel"] },
    ],
  },

  sprint: {
    naam: "Snelheid & sprint",
    tss_opbouw_pct: 0.10,
    decoupling_drempel: 7,
    eindtest_type: "sprint_peak_test",
    fases: [
      { naam: "Aerobe basis", weken: [1,2,3], z1z2_doel: 0.88,
        max_intensiteit_per_week: 1,
        sessietypes: ["z2_duur","sprint_neuraal","z1_herstel"],
        sprint_neuraal_max_per_week: 1,
        sprint_neuraal_reps: [4,6] },
      { naam: "Sprintkracht", weken: [5,6,7], z1z2_doel: 0.82,
        max_intensiteit_per_week: 2,
        sessietypes: ["sprint_neuraal","z2_duur","z1_herstel"],
        sprint_neuraal_max_per_week: 2,
        sprint_neuraal_reps: [6,8] },
      { naam: "Sprint + drempel", weken: [9,10,11], z1z2_doel: 0.78,
        max_intensiteit_per_week: 2,
        sessietypes: ["sprint_neuraal","sweetspot_intervallen","z2_duur","z1_herstel"] },
      { naam: "Specifiek", weken: [12], z1z2_doel: 0.80,
        max_intensiteit_per_week: 2,
        sessietypes: ["z2_embedded_sprint","sprint_neuraal","z1_herstel"] },
      { naam: "Test", weken: [13], z1z2_doel: 0.90,
        max_intensiteit_per_week: 1,
        sessietypes: ["sprint_neuraal","z1_herstel"] },
    ],
  },
};

/**
 * Zoekt de fase voor een gegeven weeknummer in een doelprofiel.
 * Herstelweken (4, 8) worden overgeslagen in de fasetabel.
 */
export function faseVoorWeek(profiel, weekNr) {
  if (!profiel?.fases) return null;
  for (const fase of profiel.fases) {
    if (fase.weken.includes(weekNr)) return fase;
  }
  return null;
}

/**
 * Zoekt fase-instellingen op basis van fase-naam (lowercase) en doelprofiel.
 * Gebruikt door de dynamische bouwKader().
 */
export function faseInstellingen(profiel, faseNaam) {
  if (!profiel?.fases) return null;
  const normaal = faseNaam.toLowerCase();
  for (const fase of profiel.fases) {
    if (fase.naam.toLowerCase() === normaal) return fase;
  }
  // Fallback: overgangsfase → sweetspot-instellingen als basis
  if (normaal === "overgangsfase") {
    const ss = profiel.fases.find(f => f.naam.toLowerCase() === "sweetspot");
    if (ss) return { ...ss, naam: "Overgangsfase", max_intensiteit_per_week: 2, sessietypes: ["sweetspot_lang", "drempel_intervallen", "z2_duur", "z1_herstel"] };
  }
  return null;
}

/**
 * Genereert de fasetabel als leesbare tekst voor de prompt.
 */
export function fasetabelAlsTekst(profiel) {
  return profiel.fases.map(f =>
    `${f.naam} (week ${f.weken.join(",")}): Z1-Z2 ${Math.round(f.z1z2_doel * 100)}%, max ${f.max_intensiteit_per_week} intensiteitssessies/week, types: ${f.sessietypes.join(", ")}`
  ).join("\n");
}

/**
 * Genereert doel-specifieke instructies voor de prompt.
 */
export function doelInstructiesAlsTekst(profiel) {
  const instructies = [];
  for (const fase of profiel.fases) {
    const extra = [];
    if (fase.kracht_lage_cadans_max_per_2_weken) extra.push(`kracht_lage_cadans: max ${fase.kracht_lage_cadans_max_per_2_weken}× per 2 weken`);
    if (fase.langste_sessie_verleng_min) extra.push(`langste sessie: +${fase.langste_sessie_verleng_min} min elke 3 weken`);
    if (fase.sweetspot_max_per_2_weken) extra.push(`sweetspot: max ${fase.sweetspot_max_per_2_weken}× per 2 weken`);
    if (fase.sprint_neuraal_max_per_week) extra.push(`sprint_neuraal: max ${fase.sprint_neuraal_max_per_week}×/week, ${fase.sprint_neuraal_reps?.[0]}-${fase.sprint_neuraal_reps?.[1]} sprints`);
    if (fase.langste_sessie_is_sleutel) extra.push("langste sessie is de sleutelsessie van de week");
    if (fase.langste_sessie_target_pct_event) extra.push(`langste sessie: ${Math.round(fase.langste_sessie_target_pct_event * 100)}% van eventduur`);
    if (extra.length > 0) instructies.push(`${fase.naam}: ${extra.join("; ")}`);
  }
  if (profiel.eindtest_type === null) instructies.push("Geen eindtest — week 13 is taper (korte Z2-ritten, TSS 32% van piekweek)");
  if (profiel.eindtest_type === "sprint_peak_test") instructies.push("Eindtest: sprint_peak_test (3× max sprint 10s, 5 min rust) op laatste trainingsdag");
  if (profiel.taper_tss_pct) instructies.push(`Taperweek TSS: ${Math.round(profiel.taper_tss_pct * 100)}% van piekweek`);
  return instructies.join("\n");
}
