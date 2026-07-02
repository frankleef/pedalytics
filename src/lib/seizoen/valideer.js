/**
 * Valideert een seizoensplan op structurele correctheid.
 * @param {object} plan - Het seizoensplan-object
 * @returns {{ geldig: boolean, fouten: string[] }}
 */
export function valideerSeizoensPlan(plan) {
  const fouten = [];

  if (!plan) {
    fouten.push("Plan is leeg");
    return { geldig: false, fouten };
  }

  const kader = plan.kader || [];

  for (const week of kader) {
    if (!week.weektype) {
      fouten.push(`Week ${week.week}: weektype ontbreekt`);
    }
  }

  // Overgangsweek validatie
  const sweetspotWeken = kader.filter(w => w.fase === "sweetspot" || w.fase === "Sweetspot");
  const drempelWeken = kader.filter(w => w.fase === "drempel" || w.fase === "Drempel" || w.fase === "Drempel + VO2max");
  if (sweetspotWeken.length > 0 && drempelWeken.length > 0) {
    const heeftOvergang = kader.some(w => w.fase === "overgangsfase" || w.fase === "Overgangsfase");
    if (!heeftOvergang) {
      fouten.push("Overgangsweek (overgangsfase) ontbreekt tussen sweetspot en drempel");
    }
  }

  // Consolidatieweek TSS
  const consolidatieWeek = kader.find(w => (w.fase || "").toLowerCase() === "consolidatie");
  if (consolidatieWeek && drempelWeken.length > 0) {
    const drempelPiek = Math.max(0, ...drempelWeken.map(w => w.tss_doel ?? 0));
    if (drempelPiek > 0 && consolidatieWeek.tss_doel > drempelPiek * 0.65) {
      fouten.push(`Consolidatieweek TSS (${consolidatieWeek.tss_doel}) boven 65% van drempelpiek (${Math.round(drempelPiek * 0.65)})`);
    }
  }

  // Valideer sessies in weekSessies (bij weeksessie-generatie)
  if (plan.weekSessies?.sessies && Array.isArray(plan.weekSessies.sessies)) {
    for (const sessie of plan.weekSessies.sessies) {
      if (sessie.voltooid) continue;
      if (!sessie.intentie) {
        fouten.push(`${sessie.datum || sessie.dag}: sessie zonder intentie`);
      }
    }
  }

  return { geldig: fouten.length === 0, fouten };
}
