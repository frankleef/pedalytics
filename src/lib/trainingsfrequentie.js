import { datumISO } from "./datum";

const MOBILITEIT_TYPE = "herstel_mobiliteit";

function isMobiliteit(s) {
  return s.type === MOBILITEIT_TYPE || s.intentie?.sessietype === MOBILITEIT_TYPE;
}

// ====== Chunk 1 — Frequentiebepaling ======

export function maxTrainingsdagenPerWeek(ctl) {
  if (ctl < 30) return 3;
  if (ctl < 50) return 4;
  if (ctl < 70) return 5;
  return 6;
}

export function bepaalTrainingsfrequentie({
  ctl,
  tsb,
  rpeDeltaTrend,
  decouplingMediaan,
  beschikbareDagen,
}) {
  // Stap 1 — CTL-basis
  let basis = maxTrainingsdagenPerWeek(ctl);

  // Stap 2 — TSB-correctie
  let tsbCorrectie = 0;

  if (tsb !== null) {
    if (tsb > 20) {
      tsbCorrectie = -1;
    } else if (tsb > 5) {
      // Fresh zone
      if (rpeDeltaTrend !== null && rpeDeltaTrend < -0.5) tsbCorrectie = +1;
    } else if (tsb > -10) {
      // Grey zone
      if (rpeDeltaTrend !== null && rpeDeltaTrend < -0.5)  tsbCorrectie = +1;
      else if (rpeDeltaTrend !== null && rpeDeltaTrend > 1.0) tsbCorrectie = -1;
    } else if (tsb > -30) {
      // Optimal zone — herstelweek onvoldoende
      tsbCorrectie = 0;
    } else {
      // Risk zone
      tsbCorrectie = -1;
    }
  }

  // Stap 3 — Decoupling-correctie
  let decouplingCorrectie = 0;
  if (decouplingMediaan !== null && decouplingMediaan > 10) {
    decouplingCorrectie = -1;
  }

  // Stap 4 — Correctiegrenzen: nooit meer dan ±1 dag totaal
  const totaalCorrectie = Math.max(-1, Math.min(1, tsbCorrectie + decouplingCorrectie));
  const gecorrigeerdeBasis = basis + totaalCorrectie;

  // Stap 5 — Beschikbaarheidsgrens + absolute grenzen
  const frequentie = Math.min(gecorrigeerdeBasis, beschikbareDagen, 6);

  return Math.max(0, frequentie);
}

// ====== Harde reekscheck — nooit meer dan 3 opeenvolgende trainingsdagen ======

// sessies: array van { datum, type, intentie? }
// kandidaatDag: optioneel extra dag om te testen (zelfde structuur), of null
export function heeftTeLangReeks(sessies, kandidaatDag = null) {
  const combined = kandidaatDag ? [...sessies, kandidaatDag] : sessies;

  // Mobiliteit telt als rustdag
  const trainingSessies = combined.filter(s => !isMobiliteit(s));

  const gesorteerd = [...trainingSessies]
    .sort((a, b) => a.datum.localeCompare(b.datum));

  let streak = 1;
  for (let i = 1; i < gesorteerd.length; i++) {
    const prev = new Date(gesorteerd[i - 1].datum);
    const curr = new Date(gesorteerd[i].datum);
    const dagVerschil = Math.round((curr - prev) / 86400000);
    if (dagVerschil === 1) {
      streak++;
      if (streak >= 4) return true;
    } else {
      streak = 1;
    }
  }
  return false;
}

// ====== Chunk 2 — Dagvolgorde binnen frequentie ======

// beschikbareDagen: [{ datum, urenPerDag, beschikbaar: true }] gesorteerd op datum
// bestaandeSessies: [{ datum, tss, tss_schatting }]
// frequentie: aantal te selecteren dagen
export function selecteerTrainingsdagen({ beschikbareDagen, frequentie, bestaandeSessies = [] }) {
  if (frequentie === 0 || beschikbareDagen.length === 0) return [];

  // Blokkeer dag na zware bestaande sessie (TSS > 60)
  const geblokkeerd = new Set();
  for (const s of bestaandeSessies) {
    if ((s.tss || s.tss_schatting || 0) > 60) {
      const d = new Date(s.datum);
      d.setDate(d.getDate() + 1);
      geblokkeerd.add(datumISO(d));
    }
  }

  const kandidaten = beschikbareDagen.filter(d => !geblokkeerd.has(d.datum));
  const pool = kandidaten.length >= frequentie ? kandidaten : beschikbareDagen;

  if (pool.length === 0) return [];

  // Greedy: begin met eerste dag, selecteer daarna steeds grootste afstand tot laatste
  const geselecteerd = [pool[0]];

  while (geselecteerd.length < frequentie && geselecteerd.length < pool.length) {
    const laatste = geselecteerd[geselecteerd.length - 1];
    let besteDag = null;
    let besteAfstand = -1;

    for (const kandidaat of pool) {
      if (geselecteerd.some(s => s.datum === kandidaat.datum)) continue;
      const afstand = Math.abs(new Date(kandidaat.datum) - new Date(laatste.datum)) / 86400000;
      if (afstand > besteAfstand) {
        besteAfstand = afstand;
        besteDag = kandidaat;
      }
    }

    if (!besteDag) break;
    geselecteerd.push(besteDag);
  }

  return geselecteerd.sort((a, b) => a.datum.localeCompare(b.datum));
}
