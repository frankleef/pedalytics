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

import { weeknummerVoorDatum } from "@/lib/weekgrenzen";

/**
 * Voegt één extra week in vóór de eerstvolgende herstelweek vanaf `weekNr`,
 * door de voorgaande week te klonen. Hernummert alle kaderweken na de
 * invoeging en werkt `plan.tijdshorizon_weken` bij. Muteert `plan` in-place
 * (bedoeld om binnen een `bijwerkPlanVeilig()`-mutator-callback te draaien).
 *
 * Kalender-datums blijven ongewijzigd gekoppeld aan hun weeknummer
 * (`weeknummerVoorDatum()` is puur tijd-gebaseerd) — de invoeging verschuift
 * dus welke kader-inhoud bij welke datum hoort, vanaf `vanafWeek`. Voor elke
 * datum met `weeknummerVoorDatum(datum, plan.startdatum) >= vanafWeek` is
 * eerder gegenereerde content (in `plan.weekSessies.sessies`) daardoor stale
 * geworden — zie `verwijderSessiesVanafWeek()` hieronder, die diezelfde
 * grens gebruikt maar bewust een aparte functie is (deze functie raakt
 * alleen `plan.kader`, niet `plan.weekSessies`).
 *
 * @param {object} plan - seizoensplan met `.kader`
 * @param {number} weekNr - weeknummer vanaf waar gezocht wordt (meestal het
 *   huidige weeknummer, of bij afwezigheid het weeknummer van de terugkeerdatum)
 * @param {object} [opts]
 * @param {string} [opts.weektype="opbouw"] - weektype van de ingevoegde week
 * @param {number} [opts.tssPct=1] - fractie van het tss_doel van de
 *   voorgaande week die de ingevoegde week krijgt (1 = ongewijzigd kloon,
 *   zoals het cardiac-decoupling-pad altijd deed; <1 voor een lichtere week)
 * @returns {{toegepast: boolean, vanafWeek: number|undefined}} of de
 *   invoeging is toegepast (false als er geen herstelweek gevonden werd om
 *   vóór in te voegen — dan is `vanafWeek` undefined), en zo ja, het
 *   (nieuwe, na-hernummering) weeknummer vanaf waar kader-inhoud is
 *   verschoven
 */
export function voegExtraWeekToe(plan, weekNr, { weektype = "opbouw", tssPct = 1 } = {}) {
  if (!plan?.kader) return { toegepast: false };

  const herstelIdx = plan.kader.findIndex((w, i) => i >= weekNr - 1 && w.weektype === "herstel");
  if (herstelIdx <= 0) return { toegepast: false };

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

  return { toegepast: true, vanafWeek: herstelIdx + 1 };
}

/**
 * Verwijdert niet-voltooide sessies uit `plan.weekSessies.sessies` waarvan de
 * datum op/na `vanafWeek` valt (zelfde uitsluitingsprincipe als
 * `verwijderSessiesInPeriode()` in afwezigheid.js: een voltooide sessie wordt
 * nooit aangeraakt). Muteert `plan` in-place — puur en synchroon, bedoeld om
 * binnen dezelfde `bijwerkPlanVeilig()`-mutator te draaien als
 * `voegExtraWeekToe()`. Doet zelf geen intervals.icu-cleanup (async, mag niet
 * in een synchrone mutator) — de caller verzamelt `intervalsEventIds` en
 * ruimt die na de `bijwerkPlanVeilig()`-call apart op.
 *
 * @param {object} plan - seizoensplan met `.weekSessies.sessies` en `.startdatum`
 * @param {number} vanafWeek - ondergrens (inclusief), typisch `vanafWeek` uit
 *   `voegExtraWeekToe()`'s return-waarde
 * @returns {{verwijderd: string[], intervalsEventIds: string[]}}
 */
export function verwijderSessiesVanafWeek(plan, vanafWeek) {
  if (!plan?.weekSessies?.sessies?.length || !plan.startdatum) {
    return { verwijderd: [], intervalsEventIds: [] };
  }

  const teVerwijderen = plan.weekSessies.sessies.filter(s =>
    !s.voltooid && s.datum && weeknummerVoorDatum(s.datum, plan.startdatum) >= vanafWeek
  );
  if (teVerwijderen.length === 0) return { verwijderd: [], intervalsEventIds: [] };

  const teVerwijderenDatums = new Set(teVerwijderen.map(s => s.datum));
  plan.weekSessies.sessies = plan.weekSessies.sessies.filter(s => !teVerwijderenDatums.has(s.datum));

  return {
    verwijderd: teVerwijderen.map(s => s.datum),
    intervalsEventIds: teVerwijderen.map(s => s.intervalsEventId).filter(Boolean),
  };
}
