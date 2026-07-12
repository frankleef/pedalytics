/**
 * Bepaalt of een decoupling-waarde een statistische uitschieter is.
 * Gebruikt IQR-methode: uitschieter als waarde > Q3 + 1.5×IQR.
 * @param {number} waarde - de decoupling-waarde om te testen
 * @param {number[]} alleWaarden - alle beschikbare niet-null waarden
 * @returns {boolean}
 */
export function isDecouplingUitschieter(waarde, alleWaarden) {
  if (!alleWaarden?.length || alleWaarden.length < 3) return false;
  // Absolute cap: >12% is bijna altijd extern (hitte, ziekte, dehydratie)
  if (waarde > 12) return true;
  // IQR-methode voor subtielere uitschieters bij voldoende data
  if (alleWaarden.length < 6) return false;
  const gesorteerd = [...alleWaarden].sort((a, b) => a - b);
  const q1 = gesorteerd[Math.floor(gesorteerd.length * 0.25)];
  const q3 = gesorteerd[Math.floor(gesorteerd.length * 0.75)];
  const iqr = q3 - q1;
  return waarde > q3 + 1.5 * iqr || waarde < q1 - 1.5 * iqr;
}

export function ctlRampRegressie(ctlWaarden) {
  if (!ctlWaarden?.length || ctlWaarden.length < 7) return null;
  const n = ctlWaarden.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += ctlWaarden[i]; sumXY += i * ctlWaarden[i]; sumX2 += i * i;
  }
  const helling = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return Math.round(helling * 7 * 100) / 100;
}

export function belastingsStatus(ctl_ramp_per_week, gereedheidsscore) {
  if (ctl_ramp_per_week < 0 && gereedheidsscore >= 60) return "herstelblok";
  if (ctl_ramp_per_week > 7) return "te_hoog";
  if (ctl_ramp_per_week >= 5) return "aan_de_grens";
  if (ctl_ramp_per_week >= 1.5) return "optimaal";
  if (ctl_ramp_per_week >= 0.5) return "te_laag";
  return "inactief";
}

export function normaliseerCtlRichting(ctl_nu, ctl_4w_geleden) {
  if (ctl_4w_geleden == null) return 0;
  const delta = ctl_nu - ctl_4w_geleden;
  return Math.max(-1, Math.min(1, delta / 10));
}

export function normaliseerRpeDelta(rpe_delta_trend) {
  return Math.max(-1, Math.min(1, rpe_delta_trend / 3)) * -1;
}

export function normaliseerDecoupling(mediaan_huidig, mediaan_vorig) {
  if (mediaan_vorig == null) return 0;
  // Absoluut verschil in procentpunten i.p.v. relatief percentage — de relatieve formule deelt
  // door mediaan_vorig, wat bij waarden dicht bij 0% instabiel is (zie decoupling-clamp-verificatie.md:
  // 0,38% → 2,85% gaf met de relatieve formule -1,0, terwijl het een bescheiden absolute verschuiving is).
  // TODO: 5pp voor volledige clamp is een beargumenteerde keuze (gangbare <5%-decoupling-richtlijn
  // als absolute schaal), geen empirisch geverifieerd optimum — zie decoupling-fix-en-backtest.md.
  const verbetering_pp = mediaan_vorig - mediaan_huidig;
  return Math.max(-1, Math.min(1, verbetering_pp / 5));
}

/**
 * Bepaalt de decoupling-medianen voor de conditiescore uit een chronologisch geordende pool
 * kwalificerende ritten (oudste eerst). Venster: laatste 5 ritten vs. de 5 daaraan voorafgaande.
 * Bij <10 kwalificerende ritten is er geen signaal (null, geen bijvangst — gewicht in
 * berekenConditieScore() wordt dan herverdeeld over CTL/RPE). Bij >10 tellen alleen de meest
 * recente 10 mee, oudere ritten worden genegeerd.
 */
export function bepaalDecouplingMedianen(dcAlleWaarden) {
  if (!dcAlleWaarden || dcAlleWaarden.length < 10) return { huidig: null, vorig: null };
  const huidig = [...dcAlleWaarden.slice(-5)].sort((a, b) => a - b)[2];
  const vorig = [...dcAlleWaarden.slice(-10, -5)].sort((a, b) => a - b)[2];
  return { huidig, vorig };
}

export function berekenConditieScore({ ctl_nu, ctl_4w_geleden, rpe_delta_trend, decoupling_huidig, decoupling_vorig }) {
  const bijdragen = [];
  if (ctl_nu != null && ctl_4w_geleden != null) bijdragen.push({ score: normaliseerCtlRichting(ctl_nu, ctl_4w_geleden), gewicht: 0.50 });
  if (rpe_delta_trend != null && rpe_delta_trend !== 0) bijdragen.push({ score: normaliseerRpeDelta(rpe_delta_trend), gewicht: 0.35 });
  if (decoupling_huidig != null && decoupling_vorig != null) bijdragen.push({ score: normaliseerDecoupling(decoupling_huidig, decoupling_vorig), gewicht: 0.15 });
  if (!bijdragen.length) return null;
  const totaalGewicht = bijdragen.reduce((s, b) => s + b.gewicht, 0);
  return bijdragen.reduce((s, b) => s + b.score * b.gewicht, 0) / totaalGewicht;
}

export function conditieStatus(score) {
  if (score == null) return null;
  if (score > 0.3) return "groeit";
  if (score > 0.1) return "lichte_groei";
  if (score > -0.1) return "stabiel";
  if (score > -0.3) return "lichte_daling";
  return "daalt";
}

export function conditiePillStatus(belasting, conditie) {
  if (belasting === "te_hoog") return { label: "Pas op overbelasting", kleur: "rood" };
  if (belasting === "herstelblok") return { label: "Herstelweek", kleur: "blauw" };
  if (conditie === "groeit") return { label: "Conditie groeit", kleur: "groen" };
  if (conditie === "lichte_groei") return { label: "Lichte verbetering", kleur: "groen" };
  if (conditie === "stabiel" && belasting === "optimaal") return { label: "Onderhoud", kleur: "geel" };
  if (conditie === "stabiel" && belasting === "te_laag") return { label: "Te weinig stimulus", kleur: "oranje" };
  if (conditie === "lichte_daling") return { label: "Lichte achteruitgang", kleur: "oranje" };
  if (conditie === "daalt") return { label: "Conditie daalt", kleur: "rood" };
  if (belasting === "aan_de_grens") return { label: "Aan de grens", kleur: "geel" };
  return { label: "Te weinig stimulus", kleur: "oranje" };
}

// Uitleg van de vier signalen achter de conditiescore — gedeeld tussen de
// homepage-kaart en de schema-tab-kaart, want het is dezelfde score.
export const CONDITIE_UITLEG = [
  { titel: "Belasting", tekst: "Hoe snel bouw je trainingsbelasting (CTL) op? Optimaal is 3-7 punten per week. Te snel = overbelasting, te langzaam = te weinig stimulus." },
  { titel: "Conditieontwikkeling", tekst: "Stijgt, stabiliseert of daalt je fitheid (CTL) over de afgelopen 4 weken? Dit is het primaire signaal." },
  { titel: "Gevoel (RPE-trend)", tekst: "Voelen je trainingen lichter of zwaarder aan dan verwacht? Als gelijke training makkelijker wordt, groei je." },
  { titel: "Aerobe basis", tekst: "Hoe efficiënt werkt je hart bij lage intensiteit? Gemeten via hartslagstijging tijdens Z2-ritten." },
];

export function conditieInfoRegels(ctl_nu, ctl_4w_geleden, rpe_delta_trend) {
  let ctlRegel = null;
  if (ctl_nu != null && ctl_4w_geleden != null) {
    const delta = Math.round(ctl_nu - ctl_4w_geleden);
    ctlRegel = delta > 0 ? `CTL +${delta} deze maand` : delta < 0 ? `CTL ${delta} deze maand` : "CTL stabiel deze maand";
  }
  let rpeRegel = null;
  if (rpe_delta_trend != null) {
    rpeRegel = rpe_delta_trend < -0.5 ? "Trainingen voelen lichter dan verwacht" : rpe_delta_trend > 0.5 ? "Trainingen voelen zwaarder dan verwacht" : "Gevoel stabiel";
  }
  return { ctlRegel, rpeRegel };
}
