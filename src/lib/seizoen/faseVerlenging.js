// Geëxtraheerd uit cron/sync/route.js (was daar inline verweven in de
// cardiac-decoupling-fase-overgangcheck, sectie 22-F) zodat dezelfde
// kader-invoegmechaniek ook buiten die cron-context aanroepbaar is — o.a.
// door de afwezigheidsperiode-heropbouw (sectie 55).
//
// Puur op `plan` en `weekNr` — geen impliciete afhankelijkheid op cron-
// specifieke state (apiKey/athleteId/ritten). De caller blijft zelf
// verantwoordelijk voor eigen boekhouding (bv. fase_verlengd_count bij
// cardiac decoupling, of een eigen afwezigheid-specifiek veld) en voor het
// versturen van een passende melding — dat hoort niet in deze functie, elke
// aanroeper heeft daar een andere tekst/aanleiding voor nodig.

/**
 * Voegt één extra week in vóór de eerstvolgende herstelweek vanaf `weekNr`,
 * door de voorgaande week te klonen. Hernummert alle kaderweken na de
 * invoeging en werkt `plan.tijdshorizon_weken` bij. Muteert `plan` in-place
 * (bedoeld om binnen een `bijwerkPlanVeilig()`-mutator-callback te draaien).
 *
 * @param {object} plan - seizoensplan met `.kader`
 * @param {number} weekNr - weeknummer vanaf waar gezocht wordt (meestal het
 *   huidige weeknummer, of bij afwezigheid het weeknummer van de terugkeerdatum)
 * @param {object} [opts]
 * @param {string} [opts.weektype="opbouw"] - weektype van de ingevoegde week
 * @param {number} [opts.tssPct=1] - fractie van het tss_doel van de
 *   voorgaande week die de ingevoegde week krijgt (1 = ongewijzigd kloon,
 *   zoals het cardiac-decoupling-pad altijd deed; <1 voor een lichtere week)
 * @returns {boolean} of de invoeging is toegepast (false als er geen
 *   herstelweek gevonden werd om vóór in te voegen)
 */
export function voegExtraWeekToe(plan, weekNr, { weektype = "opbouw", tssPct = 1 } = {}) {
  if (!plan?.kader) return false;

  const herstelIdx = plan.kader.findIndex((w, i) => i >= weekNr - 1 && w.weektype === "herstel");
  if (herstelIdx <= 0) return false;

  const vorigeWeek = plan.kader[herstelIdx - 1];
  // Alleen de inhoudelijke week-velden overnemen — niet vorigeWeek's eigen
  // startDatum/eindDatum/beschikbaar_vanaf, want die horen bij vorigeWeek's
  // kalenderweek en zouden anders als duplicaat meekomen naar deze nieuw
  // ingevoegde week.
  const extraWeek = {
    week: vorigeWeek.week + 0.5,
    fase: vorigeWeek.fase,
    weektype,
    tss_doel: Math.round(vorigeWeek.tss_doel * tssPct),
    focus: vorigeWeek.focus,
    z1z2_doel: vorigeWeek.z1z2_doel,
    max_intensiteit: vorigeWeek.max_intensiteit,
    sessietypes: vorigeWeek.sessietypes,
  };

  plan.kader.splice(herstelIdx, 0, extraWeek);
  // Hernummer alle weken na de invoeging.
  for (let k = 0; k < plan.kader.length; k++) {
    plan.kader[k].week = k + 1;
  }
  plan.tijdshorizon_weken = plan.kader.length;

  return true;
}
