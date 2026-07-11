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

// Zelfde IF-midden/max-effectieve-uren als z2_duur in weekSolver.js's
// SESSIETYPE_IF_MIDDEN/SESSIETYPE_MAX_EFFECTIEVE_UREN — z2_duur is het meest
// volumineuze sessietype, dus het plafond van wat één dag realistisch kan
// leveren.
const Z2_IF_MIDDEN = 0.72;
const Z2_MAX_EFFECTIEVE_UREN = 4;

/**
 * Bepaalt hoeveel dagen deze week een sessie mogen krijgen. Basis is de
 * CTL-gedreven veiligheidscap (of, in de weken vlak na een blokcheck, de
 * TSB-gecorrigeerde kaderWeek.trainingsfrequentie) — maar die basis kent het
 * tss_doel van de week niet. Bij een week met een fors hoger tss_doel dan
 * binnen die cap haalbaar is met de daadwerkelijk beschikbare uren per dag
 * (bv. een sweetspot-opbouwweek met "hoge belasting gewenst"), zou de
 * basis-cap dagen wegsnijden die nodig zijn om het doel te halen — vandaar
 * hier een demand-gedreven ondergrens, nooit hoger dan het aantal
 * daadwerkelijk beschikbare dagen.
 *
 * @param {number} ctl
 * @param {object|null} kaderWeek - { trainingsfrequentie?, tss_doel?, weektype? }
 * @param {string[]} beschikbareDagenNamen - dagnamen die de gebruiker heeft aangevinkt
 * @param {Object<string, number>} [urenPerDag] - { [dagNaam]: uren }
 */
export function frequentieVoorWeek({ ctl, kaderWeek, beschikbareDagenNamen = [], urenPerDag = {} }) {
  const basis = kaderWeek?.trainingsfrequentie ?? maxTrainingsdagenPerWeek(ctl);
  const weekTssDoel = kaderWeek?.tss_doel ?? 0;
  if (kaderWeek?.weektype === "herstel" || weekTssDoel <= 0 || beschikbareDagenNamen.length === 0) return basis;

  // Realistische TSS-capaciteit per beschikbare dag, aflopend gesorteerd zodat
  // de meest waardevolle dagen (langste beschikbare tijd) als eerst meetellen.
  const capaciteitAflopend = beschikbareDagenNamen
    .map((dag) => Z2_IF_MIDDEN * Z2_IF_MIDDEN * Math.min(urenPerDag[dag] || 1.5, Z2_MAX_EFFECTIEVE_UREN) * 100)
    .sort((a, b) => b - a);

  let benodigdeDagen = 0;
  let cumulatief = 0;
  for (const capaciteit of capaciteitAflopend) {
    if (cumulatief >= weekTssDoel) break;
    cumulatief += capaciteit;
    benodigdeDagen++;
  }

  if (benodigdeDagen <= basis) return basis;
  return Math.min(benodigdeDagen, beschikbareDagenNamen.length, 6);
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
