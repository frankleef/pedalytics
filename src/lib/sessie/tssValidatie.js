import { rondSessieAf } from "./duurAfronding";

// TSS = IF² × uren × 100
// Per sessietype een verwacht IF-bereik; als de Claude-TSS daarbuiten valt, corrigeren.
const IF_BEREIK = {
  herstel:        { min: 0.45, max: 0.55 },
  duur_lang:      { min: 0.65, max: 0.75 },
  duur_variabel:  { min: 0.68, max: 0.80 },
  duur_middel:    { min: 0.65, max: 0.75 },
  sweetspot:      { min: 0.80, max: 0.92 },
  interval:       { min: 0.80, max: 0.95 },
  drempel:        { min: 0.85, max: 0.98 },
  vo2max:         { min: 0.85, max: 1.05 },
  kracht_lage_cadans: { min: 0.70, max: 0.88 },
  sprint_neuraal: { min: 0.55, max: 0.70 },
  z2_embedded_sprint: { min: 0.60, max: 0.72 },
};

export function corrigeerSessieTss(sessie) {
  if (!sessie?.type || !sessie.duur_min || !sessie.tss) return;

  const bereik = IF_BEREIK[sessie.type];
  if (!bereik) return;

  const uren = sessie.duur_min / 60;
  const tssMin = Math.round(bereik.min * bereik.min * uren * 100);
  const tssMax = Math.round(bereik.max * bereik.max * uren * 100);

  if (sessie.tss < tssMin) {
    const midIF = (bereik.min + bereik.max) / 2;
    const gecorrigeerd = Math.round(midIF * midIF * uren * 100);
    console.log(`[TSS-correctie] ${sessie.type} ${sessie.duur_min}min: ${sessie.tss} → ${gecorrigeerd} (was onder minimum ${tssMin})`);
    sessie.tss = gecorrigeerd;
  } else if (sessie.tss > tssMax * 1.15) {
    console.log(`[TSS-correctie] ${sessie.type} ${sessie.duur_min}min: ${sessie.tss} → ${tssMax} (was boven maximum ${tssMax})`);
    sessie.tss = tssMax;
  }

  if (sessie.intentie?.tss_range) {
    sessie.intentie.tss_range.min = Math.max(sessie.intentie.tss_range.min, tssMin);
    sessie.intentie.tss_range.max = Math.min(sessie.intentie.tss_range.max, Math.round(tssMax * 1.1));
  }
}

// Zelfde tolerantie als de bestaande "budget-overschrijding"-conventie elders
// (conflictResolutie.js: BUDGET_OVERSCHRIJDING_DREMPEL, en tssMax*1.15 hierboven).
const DAGBUDGET_OVERSCHRIJDING_DREMPEL = 1.15;

/**
 * Corrigeert een sessie die te ver boven zijn EIGEN dagbudget (dagIntentie.tss_doel,
 * bv. het herstelweek-aandeel van het weekbudget uit schatTssDoel()/pasBudgetToe())
 * uitschiet — onafhankelijk van corrigeerSessieTss() hierboven, dat alleen toetst
 * tegen een generiek IF-bereik per sessietype en niets weet van het specifieke
 * dagbudget. Een archetype kan voor zijn eigen IF-bereik volkomen normaal zijn
 * (bv. tss_range 70-105 voor een "duur_variabel"-rit) en toch ver boven wat DEZE
 * dag zou moeten leveren uitkomen (tss_doel 54 in een herstelweek).
 *
 * Schaalt alleen NEER (nooit omhoog — ondershoot t.o.v. tss_doel is geen
 * probleem, dat is juist de normale dagvorm-gestuurde variatie via
 * selecteerVariantOpDagvorm) en behoudt de vermogens-/zonestructuur van het
 * archetype door de blokduren proportioneel te verkorten (net als de
 * check-in-modulatie), gevolgd door de gebruikelijke afronding op hele
 * minuten/5-minutengrid.
 */
export function corrigeerSessieTssTovDagbudget(sessie) {
  const doelTss = sessie?.intentie?.tss_doel;
  if (!doelTss || !sessie?.tss || !sessie.segmenten?.length) return;
  if (sessie.tss <= doelTss * DAGBUDGET_OVERSCHRIJDING_DREMPEL) return;

  const factor = doelTss / sessie.tss;
  const geschaaldeSegmenten = sessie.segmenten.map((seg) => ({
    ...seg,
    blokDuurSeconden: seg.blokDuurSeconden != null
      ? Math.max(1, Math.round(seg.blokDuurSeconden * factor))
      : seg.blokDuurSeconden,
  }));
  const { segmenten, duur_min } = rondSessieAf(geschaaldeSegmenten);

  const tssVoor = sessie.tss;
  sessie.segmenten = segmenten;
  sessie.duur_min = duur_min;
  sessie.tss = Math.round(sessie.tss * factor);
  console.log(`[TSS-dagbudget-correctie] ${sessie.type} ${tssVoor}→${sessie.tss} (dagbudget ${doelTss}, was ${Math.round((tssVoor / doelTss) * 100)}% van doel)`);
}
