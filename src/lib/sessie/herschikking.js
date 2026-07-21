// B5: re-flow-sublaag. Bij een B1 (HRV-rood-vervanging) of monotonie-gedreven
// VERLIES van een kernsessie (sessietype-niveau — niet de B6/B2-variant-
// verzachting via dagvorm/doelGewicht, die de kernstimulus zelf niet wegneemt,
// zie de trace-toelichting bij bepaalDoelGewicht): één herschikkingspoging
// binnen de resterende week. Nooit over de weekgrens heen (vindHerschikkings-
// Kandidaat, compliance.js, regelt dit al).
//
// Bouwt op dezelfde archetype-/variant-selectieprimitieven als genereerSessieDag
// (genereren.js) — geen parallelle herimplementatie van die logica, wel een
// apart aanroeppunt omdat de kandidaat-dag hier al een bestaande toewijzing/
// sessie heeft die vervangen wordt, i.p.v. een nog-lege dag die voor het eerst
// gevuld wordt.

import { getKV } from "../kv";
import { vindHerschikkingsKandidaat } from "./compliance";
import {
  getArchetypesVoorSessietypeRaw,
  getArchetypesVoorSessietype,
  getRecenteArchetypes,
  selecteerArchetype,
} from "../sessie-archetypes";
import { selecteerVariantOpDagvorm, genereerSessieDeterministisch } from "../sessie-generatie";
import { kaderWeekVoorDatum, weekInFaseVoorKaderWeek } from "../weekgrenzen";

// D: verzwakte variant vóór volledige typewissel, geforceerd op gewicht 2 —
// een neutrale dagvorm (geen van de vijf triggers/tsb/hrv wijst ergens heen)
// resulteert via bepaalDoelGewicht's eigen default-pad (sessie-generatie.js)
// altijd in gewicht 2, zonder dat selecteerVariantOpDagvorm/bepaalDoelGewicht
// zelf een los "forceer dit gewicht"-overrideparameter nodig hebben.
const NEUTRALE_DAGVORM = {
  tsb: 0, hrv: "normaal", rpeDeltaTrend: 0,
  hrvTrendTrigger: false, rhrTrendTrigger: false, herstelsnelheidTrigger: false,
};

async function bouwArchetypeKeuze(kv, userId, sessietype, fase, weekInFase, seizoensdoel, weektype, beschikbareDuurMin) {
  const archetypesVoorType = await getArchetypesVoorSessietypeRaw(sessietype, kv);
  const archetypes = getArchetypesVoorSessietype(archetypesVoorType, fase, weekInFase, seizoensdoel, beschikbareDuurMin, weektype);
  if (archetypes.length === 0) return null;

  const recenteArchetypes = await getRecenteArchetypes(kv, userId, sessietype);
  const gekozenArchetype = selecteerArchetype(archetypes, recenteArchetypes);
  if (!gekozenArchetype?.varianten?.length) return null;

  return gekozenArchetype;
}

/**
 * Probeert een gemiste kernsessie (gemisteSessietype, oorspronkelijk gepland
 * op gedowngradeDatum) op een andere dag deze week te herschikken.
 * Muteert seizoensplan.weekSessies.sessies in-place bij succes (kandidaat- én
 * gedowngradeerde-dag krijgen verplaatst_van/verplaatst_naar, zelfde
 * bron-neutrale velden als bepaalComplianceRecord al leest, C1).
 *
 * @param {string} userId
 * @param {object} seizoensplan - met .weekSessies.sessies, .kader, .startdatum, .huidige_ftp, .urenPerDag
 * @param {string} gedowngradeDatum - ISO-datum van de gedowngradeerde sessie
 * @param {string} gemisteSessietype - het sessietype dat gedowngradeDatum verloor
 * @returns {Promise<{kandidaatDatum: string, effectiefSessietype: string}|null>}
 */
export async function probeerHerschikking(userId, seizoensplan, gedowngradeDatum, gemisteSessietype) {
  if (!seizoensplan?.weekSessies?.sessies || !gemisteSessietype) return null;

  const kandidaatDatum = vindHerschikkingsKandidaat(seizoensplan, gedowngradeDatum);
  if (!kandidaatDatum) return null;

  const kandidaatIdx = seizoensplan.weekSessies.sessies.findIndex(s => s.datum === kandidaatDatum);
  if (kandidaatIdx === -1) return null;
  const kandidaatSessie = seizoensplan.weekSessies.sessies[kandidaatIdx];

  const kv = getKV();
  const kaderWeek = kaderWeekVoorDatum(kandidaatDatum, seizoensplan.kader, seizoensplan.startdatum);
  const fase = kaderWeek?.fase ?? "basis";
  const weekInFase = weekInFaseVoorKaderWeek(kaderWeek, seizoensplan.kader);
  const weektype = kaderWeek?.weektype || "opbouw";
  const seizoensdoel = seizoensplan.seizoensdoel?.type ?? null;
  const ftp = seizoensplan.huidige_ftp || 265;
  const dagNaam = kandidaatSessie.dag;
  const beschikbareDuurMin = Math.round((seizoensplan.urenPerDag?.[dagNaam] || 1.5) * 60);

  let effectiefSessietype = gemisteSessietype;
  let gekozenArchetype = await bouwArchetypeKeuze(kv, userId, gemisteSessietype, fase, weekInFase, seizoensdoel, weektype, beschikbareDuurMin);

  if (!gekozenArchetype) {
    // Geen geldig archetype/budget voor het gemiste type op deze dag ->
    // volledige typewissel naar z2_duur (zelfde fallback-vangnet-filosofie
    // als pasBudgetToe's eigen schrapToewijzing elders).
    effectiefSessietype = "z2_duur";
    gekozenArchetype = await bouwArchetypeKeuze(kv, userId, "z2_duur", fase, weekInFase, seizoensdoel, weektype, beschikbareDuurMin);
    if (!gekozenArchetype) return null; // zelfs z2_duur past niet -> geen herschikking mogelijk
  }

  const { variant } = await selecteerVariantOpDagvorm(kv, gekozenArchetype, userId, NEUTRALE_DAGVORM);

  const nieuweSessie = genereerSessieDeterministisch({
    dagIntentie: null, archetype: gekozenArchetype, variant, doelDuurMin: beschikbareDuurMin, ftp, sessietype: effectiefSessietype,
  });
  nieuweSessie.datum = kandidaatDatum;
  nieuweSessie.dag = dagNaam;
  nieuweSessie.beschermd_herschikking = true; // zelf niet nogmaals doelwit van een latere herschikking
  nieuweSessie.verplaatst_van = gedowngradeDatum;

  seizoensplan.weekSessies.sessies[kandidaatIdx] = nieuweSessie;

  // E: compliance-bron-neutrale koppeling terug op de gedowngradeerde dag —
  // zelfde velden als C1/hrv_verplaatst_naar, geen nieuwe naam.
  const gedowngradeSessie = seizoensplan.weekSessies.sessies.find(s => s.datum === gedowngradeDatum);
  if (gedowngradeSessie) gedowngradeSessie.verplaatst_naar = kandidaatDatum;

  return { kandidaatDatum, effectiefSessietype };
}
