export function normaliseerRpeDelta(trend) {
  return Math.max(-1, Math.min(1, trend / 3)) * -1;
}

export function normaliseerHrvTrend(hrv3d, hrv28d) {
  if (!hrv28d) return 0;
  const afwijking = (hrv3d - hrv28d) / hrv28d;
  return Math.max(-1, Math.min(1, afwijking * 5));
}

export function normaliseerCtlRamp(rampPerWeek) {
  if (rampPerWeek >= 3 && rampPerWeek <= 7) return 1.0;
  if (rampPerWeek >= 1 && rampPerWeek < 3) return 0.3;
  if (rampPerWeek > 7 && rampPerWeek <= 10) return 0.3;
  if (rampPerWeek < 1) return -0.5;
  return -1.0;
}

export function normaliseerDecoupling(huidig, vorig) {
  if (!vorig) return 0;
  const verbetering = (vorig - huidig) / vorig;
  return Math.max(-1, Math.min(1, verbetering * 4));
}

function scoreNaarStatus(score) {
  if (score < -0.5) return "teveel";
  if (score < -0.15) return "iets_teveel";
  if (score <= 0.15) return "optimaal";
  if (score <= 0.5) return "iets_te_weinig";
  return "te_weinig";
}

export function berekenAdaptatieScore({ rpe_delta_trend, hrv_3d, hrv_28d, ctl_ramp, decoupling_huidig, decoupling_vorig }) {
  const componenten = [];

  if (rpe_delta_trend != null) componenten.push({ naam: "rpe_delta", score: normaliseerRpeDelta(rpe_delta_trend), gewicht: 0.35 });
  if (hrv_3d != null && hrv_28d != null) componenten.push({ naam: "hrv", score: normaliseerHrvTrend(hrv_3d, hrv_28d), gewicht: 0.30 });
  if (ctl_ramp != null) componenten.push({ naam: "ctl_ramp", score: normaliseerCtlRamp(ctl_ramp), gewicht: 0.20 });
  if (decoupling_huidig != null && decoupling_vorig != null) componenten.push({ naam: "decoupling", score: normaliseerDecoupling(decoupling_huidig, decoupling_vorig), gewicht: 0.15 });

  if (componenten.length < 2) return null;

  const totaalGewicht = componenten.reduce((a, c) => a + c.gewicht, 0);
  const gewogenSom = componenten.reduce((a, c) => a + c.score * c.gewicht, 0);
  const score = gewogenSom / totaalGewicht;

  const dominant = componenten
    .map(c => ({ naam: c.naam, bijdrage: Math.abs(c.score * c.gewicht / totaalGewicht) }))
    .sort((a, b) => b.bijdrage - a.bijdrage)[0].naam;

  return { score: Math.round(score * 100) / 100, status: scoreNaarStatus(score), dominant, componenten };
}

export const ADAPTATIE_CONFIG = {
  teveel: { kleur: "oklch(0.55 0.18 25)", label: "Te veel belasting", subtekst: "Je lichaam geeft overbelasting-signalen" },
  iets_teveel: { kleur: "oklch(0.72 0.13 70)", label: "Let op je herstel", subtekst: "Signalen wijzen op oplopende vermoeidheid" },
  optimaal: { kleur: "oklch(0.6 0.13 165)", label: "Optimale belasting", subtekst: "Je conditie ontwikkelt zich goed" },
  iets_te_weinig: { kleur: "oklch(0.72 0.13 70)", label: "Iets te weinig stimulus", subtekst: "Iets meer volume of intensiteit helpt" },
  te_weinig: { kleur: "oklch(0.65 0.015 75)", label: "Te weinig belasting", subtekst: "Je conditie groeit nauwelijks" },
};

export const DOMINANT_LABEL = {
  rpe_delta: "Je trainingen voelen zwaarder aan dan verwacht",
  hrv: "Je HRV wijkt af van je persoonlijke baseline",
  ctl_ramp: "Je fitheidsopbouw ligt buiten de optimale zone",
  decoupling: "Je aerobe efficiëntie geeft een signaal",
};
