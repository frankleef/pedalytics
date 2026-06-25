import { pearsonCorrelatie } from "./math";

export function berekenHrvRpeCorrelatie(observaties, hrvProfiel) {
  if (observaties.length < 20) {
    return { coeff: null, observaties: observaties.length, betrouwbaar: false };
  }

  const x = observaties.map(o => (o.hrv - hrvProfiel.basislijn_28d) / hrvProfiel.sd_90d);
  const y = observaties.map(o => o.rpe_delta);
  const coeff = pearsonCorrelatie(x, y);

  return {
    coeff: Math.round(coeff * 100) / 100,
    observaties: observaties.length,
    betrouwbaar: observaties.length >= 20,
  };
}

export function voorspelRpeEffect(huidigHrv, hrvProfiel) {
  const { coeff, betrouwbaar } = hrvProfiel?.hrv_rpe_correlatie ?? {};
  if (!betrouwbaar || coeff == null) return null;

  const afwijking = (huidigHrv - hrvProfiel.basislijn_28d) / hrvProfiel.sd_90d;
  const verwachteDelta = coeff * afwijking * -1;

  if (Math.abs(verwachteDelta) < 0.5) return null;

  const richting = verwachteDelta > 0 ? "zwaarder" : "lichter";
  const magnitude = Math.abs(verwachteDelta) > 1.5 ? "significant" : "iets";

  return `Op basis van jouw data verwachten we dat de sessie ${magnitude} ${richting} aanvoelt dan normaal.`;
}
