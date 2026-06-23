export const Z2_SUBTYPES = {
  z2_cadans: {
    label: "Cadans-variatie",
    beschrijving: "Afwisseling hoge en lage cadans binnen Z2",
    min_duur_min: 45,
    bouwBlokken: (min, ftp) => {
      const blokken = [];
      let t = 0;
      while (t + 12 <= min) {
        blokken.push({ label: "Z2 hoog cadans", duur_min: 8, vermogenMin: 68, vermogenMax: 74, cadans_rpm: { min: 95, max: 105 } });
        blokken.push({ label: "Z2 laag cadans", duur_min: 4, vermogenMin: 68, vermogenMax: 74, cadans_rpm: { min: 70, max: 80 } });
        t += 12;
      }
      if (t < min) blokken.push({ label: "Z2 uitrij", duur_min: min - t, vermogenMin: 60, vermogenMax: 68 });
      return blokken;
    },
  },
  z2_heuvel: {
    label: "Heuvelsimulatie",
    beschrijving: "Hogere en lagere wattage-blokken binnen Z2",
    min_duur_min: 45,
    bouwBlokken: (min, ftp) => {
      const blokken = [];
      let t = 0;
      while (t + 11 <= min) {
        blokken.push({ label: "Z2 heuvel op", duur_min: 6, vermogenMin: 72, vermogenMax: 78 });
        blokken.push({ label: "Z2 heuvel af", duur_min: 5, vermogenMin: 60, vermogenMax: 66 });
        t += 11;
      }
      if (t < min) blokken.push({ label: "Z2 uitrij", duur_min: min - t, vermogenMin: 65, vermogenMax: 72 });
      return blokken;
    },
  },
  z2_tempo_teugjes: {
    label: "Tempo-teugjes",
    beschrijving: "Korte blokken aan de bovenkant van Z2",
    min_duur_min: 60,
    vereist_decoupling_max: 6,
    bouwBlokken: (min, ftp) => {
      const blokken = [];
      let t = 0;
      while (t + 18 <= min) {
        blokken.push({ label: "Z2-hoog tempo", duur_min: 10, vermogenMin: 78, vermogenMax: 82 });
        blokken.push({ label: "Z2-laag herstel", duur_min: 8, vermogenMin: 58, vermogenMax: 65 });
        t += 18;
      }
      if (t < min) blokken.push({ label: "Z2 uitrij", duur_min: min - t, vermogenMin: 62, vermogenMax: 70 });
      return blokken;
    },
  },
  z2_steady: {
    label: "Steady-state",
    beschrijving: "Langdurig stabiel Z2",
    min_duur_min: 150,
    voor_decoupling_meting: true,
    bouwBlokken: (min, ftp) => [{ label: "Z2 steady", duur_min: min, vermogenMin: 68, vermogenMax: 75 }],
  },
};

export function kiesZ2Subtype({ beschikbaarMinuten, laatsteSubtype, decouplingMediaan }) {
  const kandidaten = Object.entries(Z2_SUBTYPES)
    .filter(([key, subtype]) => {
      if (subtype.min_duur_min > beschikbaarMinuten) return false;
      if (subtype.vereist_decoupling_max && (decouplingMediaan == null || decouplingMediaan > subtype.vereist_decoupling_max)) return false;
      if (beschikbaarMinuten < 150 && key === "z2_steady") return false;
      if (key === laatsteSubtype) return false;
      return true;
    })
    .map(([key]) => key);

  if (kandidaten.length === 0) return "z2_cadans";
  return kandidaten[Math.floor(Math.random() * kandidaten.length)];
}
