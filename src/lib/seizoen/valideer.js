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

  // Check 3:1 ritme: elke 4e week moet herstelweek zijn
  kader.forEach((week, i) => {
    if ((i + 1) % 4 === 0 && week.weektype !== "herstel") {
      fouten.push(`Week ${week.week}: verwacht herstelweek op positie ${i + 1}, maar is "${week.weektype}"`);
    }
  });

  // Valideer sessies in detail_weken (als aanwezig, bij seizoensgeneratie)
  if (plan.detail_weken && Array.isArray(plan.detail_weken)) {
    for (const week of plan.detail_weken) {
      if (!week.sessies) continue;
      for (const sessie of week.sessies) {
        if (!sessie.intentie) {
          fouten.push(`Week ${week.week}, ${sessie.dag || sessie.datum}: trainingsdag zonder intentie`);
        } else {
          if (!sessie.intentie.rol) fouten.push(`Week ${week.week}, ${sessie.dag || sessie.datum}: intentie.rol ontbreekt`);
          if (!sessie.intentie.sessietype) fouten.push(`Week ${week.week}, ${sessie.dag || sessie.datum}: intentie.sessietype ontbreekt`);
          if (!sessie.intentie.toegestane_zones || sessie.intentie.toegestane_zones.length === 0) {
            fouten.push(`Week ${week.week}, ${sessie.dag || sessie.datum}: intentie.toegestane_zones ontbreekt`);
          }
          if (!sessie.intentie.tss_range || typeof sessie.intentie.tss_range.min !== "number") {
            fouten.push(`Week ${week.week}, ${sessie.dag || sessie.datum}: intentie.tss_range ontbreekt`);
          }
        }
      }
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
