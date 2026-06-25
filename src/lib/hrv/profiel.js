import { gemiddelde, standaardDeviatie } from "./math";

export function herberekenHrvProfiel(wellnessData, huidigProfiel) {
  const hrv28d = wellnessData
    .slice(-28)
    .map(d => d.hrv)
    .filter(v => v != null && v > 0);

  const hrv90d = wellnessData
    .slice(-90)
    .map(d => d.hrv)
    .filter(v => v != null && v > 0);

  if (hrv28d.length < 14) {
    return { ...(huidigProfiel || {}), modus: "leren", betrouwbaar: false };
  }

  const basislijn = gemiddelde(hrv28d);

  const nieuweSD = hrv90d.length >= 30
    ? standaardDeviatie(hrv90d)
    : huidigProfiel?.sd_90d ?? 8.0;

  const gematigdeSD = huidigProfiel?.sd_90d
    ? Math.min(nieuweSD, huidigProfiel.sd_90d * 1.10)
    : nieuweSD;

  const rodeDrempel = basislijn - 2 * gematigdeSD;
  const geleDrempel = basislijn - 1 * gematigdeSD;
  const modus = hrv90d.length >= 28 ? "persoonlijk" : "leren";

  return {
    basislijn_28d: Math.round(basislijn * 10) / 10,
    sd_90d: Math.round(gematigdeSD * 10) / 10,
    rood_drempel: Math.round(rodeDrempel * 10) / 10,
    geel_drempel: Math.round(geleDrempel * 10) / 10,
    modus,
    betrouwbaar: hrv28d.length >= 14,
    laatst_berekend: new Date().toISOString().slice(0, 10),
  };
}

export function checkDataStatus(wellnessData, huidigProfiel) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const recente = wellnessData
    .filter(d => d.hrv != null && d.hrv > 0)
    .sort((a, b) => (b.datum || b.id || "").localeCompare(a.datum || a.id || ""));

  const dagenZonderData = recente.length > 0
    ? Math.floor((new Date(vandaag) - new Date(recente[0].datum || recente[0].id)) / 86400000)
    : 999;

  const dataOnderbreking = dagenZonderData > 7;
  const wasLeren = huidigProfiel?.modus === "leren";
  const isNuPersoonlijk = recente.length >= 28;
  const modusOvergang = wasLeren && isNuPersoonlijk;

  return {
    data_onderbreking: dataOnderbreking,
    data_onderbreking_sinds: dataOnderbreking ? (recente[0]?.datum || recente[0]?.id || null) : null,
    basislijn_bevroren_op: dataOnderbreking ? (recente[0]?.datum || recente[0]?.id || null) : null,
    modus_overgang: modusOvergang,
  };
}
