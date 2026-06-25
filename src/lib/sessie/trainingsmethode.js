const POLARIZED_INSTRUCTIE = `Trainingsmethode: POLARIZED (Seiler, 2010).
Aerobe dagen: strikt Z1–Z2, max 76% FTP. Geen Z3-blokken.
Intensiteitsdagen: bewust hard, Z4–Z5 of drempel.
De grauwe zone (Z3, 76–88% FTP) wordt op aerobe dagen nooit gebruikt.
Herstelintervallen: minimaal 1:1 werk/herstel-ratio.
Bij VO2max-blokken: herstel minimaal 0.75× de werkduur.`;

const SST_INSTRUCTIE = `Trainingsmethode: SWEET SPOT (Coggan & Allen).
Intensiteitsdag: Z3–Z4, 88–93% FTP. Blokken minimaal 8 minuten.
Herstel tussen blokken: 3–5 minuten actief Z1.
Aerobe dagen rondom deze sessie: strikt Z1–Z2 (polarized — SST geldt alleen vandaag).
Doel: hoog metabolisch volume per uur, niet maximale VO2max-stimulus.`;

const SST_TIJDBEPERKT_INSTRUCTIE = `Trainingsmethode: SWEET SPOT, tijdbeperkte variant.
Beschikbare tijd is beperkt (<5 uur/week). Maximaliseer TSS per beschikbaar uur.
Blokken 10–15 minuten @ 88–93% FTP met korte herstel (2–3 min).
Kies een compact sessieformaat dat het TSS-doel haalt binnen de beschikbare tijd.`;

const SEILER_LONG_INSTRUCTIE = `Trainingsmethode: SEILER LONG INTERVALS (Seiler, 2013).
Blokken: 8–12 minuten @ 100–108% FTP.
Herstel: gelijke duur als het werkblok (1:1), actief in Z1. Nooit korter.
Doel: maximale cumulatieve tijd op of net boven FTP per sessie.
Intensiteit stabiel binnen elk blok — geen negatieve splits of build-up.
Aantal herhalingen: 3–5× afhankelijk van blokduur en TSS-budget.`;

export const METHODE_INSTRUCTIES = {
  polarized: POLARIZED_INSTRUCTIE,
  sst: SST_INSTRUCTIE,
  sst_tijdbeperkt: SST_TIJDBEPERKT_INSTRUCTIE,
  seiler_long: SEILER_LONG_INSTRUCTIE,
};

export const METHODE_PER_FASE_EN_DOEL = {
  ftp: {
    basis: "polarized",
    sweetspot: "sst",
    drempel: "polarized",
    consolidatie: "polarized",
    test: "polarized",
  },
  aerobe_basis: {
    aerobe_opbouw_1: "polarized",
    aerobe_opbouw_2: "polarized",
    aerobe_verdieping: "polarized",
    consolidatie: "polarized",
    test: "polarized",
  },
  klimmen: {
    basis: "polarized",
    sweetspot: "sst",
    drempel_vo2max: "seiler_long",
    klimspecifiek: "seiler_long",
    consolidatie: "sst",
    test: "polarized",
  },
  uithoudingsvermogen: {
    volume_opbouw: "polarized",
    volume_duur: "polarized",
    sweetspot_hard: "sst",
    consolidatie: "polarized",
    taper: "polarized",
  },
  sprint: {
    aerobe_basis: "polarized",
    sprintkracht: "polarized",
    drempel_vo2max: "sst",
    specifiek: "polarized",
    test: "polarized",
  },
};

export function bepaalTrainingsmethode({
  dagRol,
  fase,
  seizoensDoel,
  beschikbareUren,
  rpeOverbelasting,
  rpeOnderstimulering,
  ervaringsniveau,
  wPerKg,
}) {
  if (["aerobe_dag", "hersteldag", "variabele_dag"].includes(dagRol)) {
    return {
      methode: "polarized",
      aerobeDagInstructie: true,
      instructie: POLARIZED_INSTRUCTIE,
      reden: "Aerobe dag — altijd polarized, geen Z3",
    };
  }

  if (rpeOverbelasting) {
    return {
      methode: "polarized",
      instructie: POLARIZED_INSTRUCTIE +
        "\n\nLET OP: RPE-trend toont structurele overbelasting. " +
        "Houd intensiteit aan de onderkant van de zone-bandbreedte. " +
        "Geen extra blokken toevoegen boven het TSS-minimum.",
      reden: "RPE-overbelasting actief — terugschakelen naar polarized",
    };
  }

  let methode = METHODE_PER_FASE_EN_DOEL[seizoensDoel]?.[fase]
    ?? METHODE_PER_FASE_EN_DOEL.ftp[fase]
    ?? "polarized";

  // Starter + lage w/kg: geen SST in basis/sweetspot
  if (ervaringsniveau === "starter" && (wPerKg == null || wPerKg < 2.5)) {
    if (methode === "sst" && ["basis", "sweetspot"].includes(fase)) {
      methode = "polarized";
    }
  }

  // Tijdbeperking: <5 uur/week → SST tijdbeperkte variant
  if (methode === "sst" && beschikbareUren < 5) {
    methode = "sst_tijdbeperkt";
  }

  const onderstimuleringSuffix = rpeOnderstimulering
    ? "\n\nLET OP: RPE-trend toont onderstimulering. " +
      "Kies de bovenkant van de TSS-range en zone-bandbreedte. " +
      "Voeg eventueel één extra herhaling toe als TSS-budget het toelaat."
    : "";

  return {
    methode,
    instructie: METHODE_INSTRUCTIES[methode] + onderstimuleringSuffix,
    reden: `Fase: ${fase}, doel: ${seizoensDoel}, methode: ${methode}`,
  };
}
