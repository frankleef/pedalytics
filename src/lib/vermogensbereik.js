export function middelpuntVoorPositie(zone, positie) {
  const breedte = zone.maxW - zone.minW;
  const onder = zone.minW + breedte * 0.10;
  const boven = zone.maxW - breedte * 0.10;
  const midden = (onder + boven) / 2;
  return { onder, midden, boven }[positie] ?? midden;
}

export function berekenSpread(middelpunt, isSpecifiek) {
  const basis = middelpunt * 0.10;
  return isSpecifiek ? basis * 0.85 : basis;
}

export function berekenRangeZ1Z4(zone, positie, isSpecifiek, ftpW) {
  const mid = middelpuntVoorPositie(zone, positie);
  const spread = berekenSpread(mid, isSpecifiek);
  const ondergrens = Math.max(zone.minW, Math.round(mid - spread / 2));
  const capBoven = zone.maxW + ftpW * 0.05;
  const bovengrens = Math.round(Math.min(capBoven, mid + spread / 2));
  return { ondergrens, bovengrens };
}

export function verschuivingVoorDuur(blokDuurSeconden, ftpW) {
  if (blokDuurSeconden > 180) return 0;
  if (blokDuurSeconden > 60) return ftpW * 0.05;
  if (blokDuurSeconden > 30) return ftpW * 0.10;
  return ftpW * 0.15;
}

export function berekenRangeZ5Z6(zone, blokDuurSeconden, isSpecifiek, ftpW) {
  const basismid = (zone.minW + zone.maxW) / 2;
  const mid = basismid + verschuivingVoorDuur(blokDuurSeconden, ftpW);
  const spread = berekenSpread(mid, isSpecifiek);
  const ondergrens = Math.max(zone.minW, Math.round(mid - spread / 2));
  const capBoven = zone.maxW + ftpW * 0.05;
  const bovengrens = Math.round(Math.min(capBoven, mid + spread / 2));
  return { ondergrens, bovengrens };
}

export function berekenRangeZ7(piekSprintW, isSpecifiek) {
  const mid = piekSprintW * 0.92;
  const spread = berekenSpread(mid, isSpecifiek);
  return { ondergrens: Math.round(mid - spread / 2), bovengrens: Math.round(mid + spread / 2) };
}

export function cadansVoorBlok(sessietype, blokDuurSeconden) {
  if (sessietype === "kracht_lage_cadans") return { min: 45, max: 60 };
  if (sessietype === "sprint_neuraal") return { min: 100, max: 120 };
  if (["z5_vo2max", "vo2max_intervallen"].includes(sessietype)) {
    return blokDuurSeconden <= 120 ? { min: 95, max: 105 } : { min: 90, max: 100 };
  }
  if (sessietype === "z6_anaeroob") return { min: 95, max: 105 };
  if (["drempel_intervallen", "over_under", "pyramide", "sweetspot_intervallen"].includes(sessietype)) {
    return { min: 88, max: 95 };
  }
  return { min: 85, max: 95 };
}

export function berekenBlok(blokDef, zones, ftpW, piekSprintW) {
  const zone = zones[blokDef.zone];
  if (!zone) return blokDef;

  let range;
  if (blokDef.zone === "Z7") {
    range = berekenRangeZ7(piekSprintW || ftpW * 1.8, blokDef.isSpecifiek);
  } else if (["Z5", "Z6"].includes(blokDef.zone)) {
    range = berekenRangeZ5Z6(zone, blokDef.blokDuurSeconden || 240, blokDef.isSpecifiek, ftpW);
  } else {
    range = berekenRangeZ1Z4(zone, blokDef.positie || "midden", blokDef.isSpecifiek, ftpW);
  }

  const cadans = cadansVoorBlok(blokDef.sessietype, blokDef.blokDuurSeconden || 240);

  return {
    ...blokDef,
    vermogenMin: range.ondergrens,
    vermogenMax: range.bovengrens,
    cadansMin: cadans.min,
    cadansMax: cadans.max,
  };
}

export function bouwZonesUitProfiel(ftpW, powerZones) {
  if (!powerZones?.length || !ftpW) return null;
  const namen = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"];
  const result = {};
  powerZones.forEach((grens, i) => {
    const vorige = i === 0 ? 0 : powerZones[i - 1];
    const minW = Math.round(ftpW * vorige / 100);
    const maxW = grens >= 999 ? Math.round(ftpW * 2.0) : Math.round(ftpW * grens / 100);
    if (namen[i]) result[namen[i]] = { minW, maxW };
  });
  return result;
}
