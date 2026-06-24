export function afleidZonePositie(vermogenMinPct, vermogenMaxPct) {
  const midPct = (vermogenMinPct + vermogenMaxPct) / 2;

  const ZONE_GRENZEN = [
    { key: "Z1", min: 0, max: 55 },
    { key: "Z2", min: 55, max: 75 },
    { key: "Z3", min: 75, max: 90 },
    { key: "Z4", min: 90, max: 105 },
    { key: "Z5", min: 105, max: 120 },
    { key: "Z6", min: 120, max: 150 },
    { key: "Z7", min: 150, max: 999 },
  ];

  let gevonden = ZONE_GRENZEN.find(z => midPct >= z.min && midPct <= z.max);
  if (!gevonden) gevonden = ZONE_GRENZEN[ZONE_GRENZEN.length - 1];

  const breedte = gevonden.max - gevonden.min;
  const relatief = breedte > 0 ? (midPct - gevonden.min) / breedte : 0.5;

  let positie;
  if (relatief < 0.33) positie = "onder";
  else if (relatief < 0.67) positie = "midden";
  else positie = "boven";

  return { zone: gevonden.key, positie };
}

export function afleidSessietype(blokNaam, zone) {
  const naam = (blokNaam || "").toLowerCase();
  if (naam.includes("sprint")) return "sprint_neuraal";
  if (naam.includes("kracht") || naam.includes("lage cadans")) return "kracht_lage_cadans";
  if (naam.includes("vo2")) return "vo2max_intervallen";
  if (naam.includes("drempel") || naam.includes("threshold")) return "drempel_intervallen";
  if (naam.includes("sweetspot") || naam.includes("sweet spot")) return "sweetspot_intervallen";
  if (naam.includes("over") && naam.includes("under")) return "over_under";
  if (naam.includes("pyramide")) return "pyramide";
  if (zone === "Z7") return "sprint_neuraal";
  if (zone === "Z6") return "z6_anaeroob";
  if (zone === "Z5") return "vo2max_intervallen";
  if (zone === "Z4") return "drempel_intervallen";
  return "z2_duurrit";
}
