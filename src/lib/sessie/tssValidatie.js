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
