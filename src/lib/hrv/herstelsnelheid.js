export function berekenHerstelDagen(sessietype, sessieDatum, wellnessData, hrvProfiel) {
  const { basislijn_28d, sd_90d } = hrvProfiel;
  const herstelDrempel = basislijn_28d - 0.5 * sd_90d;
  const dagenNaSessie = wellnessData
    .filter(d => (d.datum || d.id) > sessieDatum)
    .slice(0, 5);

  for (let i = 0; i < dagenNaSessie.length; i++) {
    if (dagenNaSessie[i].hrv >= herstelDrempel) return i + 1;
  }
  return null;
}

export const POPULATIENORMEN_HERSTEL = {
  drempel_intervallen: 2.0,
  vo2max_intervallen: 2.5,
  vo2max_lang: 2.5,
  vo2max_kort: 2.0,
  sweetspot_lang: 1.8,
  sweetspot_intervallen: 1.5,
  microbursts: 1.5,
  z2_duur: 0.9,
  z2_lang: 1.0,
  sprint_neuraal: 1.2,
  kracht_lage_cadans: 1.5,
  herstel_actief: 0.3,
  _default: 1.5,
};

export function getHerstelDagen(sessietype, hrvProfiel) {
  const data = hrvProfiel?.herstelsnelheid?.[sessietype];
  if (data && data.observaties >= 8) return data.dagen;
  return POPULATIENORMEN_HERSTEL[sessietype] ?? POPULATIENORMEN_HERSTEL._default;
}
