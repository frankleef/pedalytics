export function bepaalHrvZone(huidigHrv, hrvProfiel) {
  if (huidigHrv == null || !hrvProfiel?.betrouwbaar) return "onbekend";

  const { rood_drempel, geel_drempel, basislijn_28d, sd_90d } = hrvProfiel;

  if (huidigHrv < rood_drempel) return "rood";
  if (huidigHrv < geel_drempel) return "geel";
  if (huidigHrv > basislijn_28d + 1 * sd_90d) return "hoog";
  return "normaal";
}

export function bepaalGecombineerdeZone(hrvZone, checkInScore, gewichten) {
  if (checkInScore == null) return hrvZone;

  const { hrv: hrvGewicht, checkin: checkInGewicht } = gewichten ?? { hrv: 0.65, checkin: 0.35 };

  const HRV_NAAR_WAARDE = { rood: 0, geel: 0.5, normaal: 1.0, hoog: 1.5 };
  const hrvWaarde = HRV_NAAR_WAARDE[hrvZone] ?? 1.0;
  const checkInWaarde = (checkInScore - 1) / 4;

  const gecombineerd = hrvWaarde * hrvGewicht + checkInWaarde * checkInGewicht;

  if (gecombineerd < 0.30) return "rood";
  if (gecombineerd < 0.55) return "geel";
  if (gecombineerd < 1.10) return "normaal";
  return "hoog";
}
