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
