import { getArchetypesVoorSessietype } from "../sessie-archetypes";

const HERSTELGERELATEERDE_REDENEN = ["hitte", "vermoeid"];

// Kandidaten per rol — uitsluitend sessietypes die daadwerkelijk als categorie
// bestaan in het deterministische archetype-systeem (sessie-archetypes.js /
// sessie-varianten.js): z2_duur, sweetspot_intervallen, kracht_lage_cadans,
// drempel_intervallen, vo2max_intervallen, sprint_neuraal, z6_anaeroob, gemengd.
// Eerdere versie noemde hier ook archetype-ids (z2_heuvel, race_simulatie),
// legacy/niet-gemigreerde namen (progressief, sweetspot_lang, vo2max_lang,
// vo2max_kort, microbursts, z2_lang) en types zonder archetypedata
// (herstel_actief, herstel_mobiliteit) — geen daarvan bestaat als
// sessietype-categorie, dus getArchetypesVoorSessietype() gaf altijd [] terug
// en genereerSessieDag() gooide een fout (vóór de Claude-fallback-verwijdering
// werd dat stilzwijgend door Claude opgevangen).
//
// Reikbaarheid voor de actuele fase/week/doel wordt hierna alsnog expliciet
// gecheckt via getArchetypesVoorSessietype — geen enkele kandidaat hier wordt
// dus blind teruggegeven als er voor de huidige context geen archetype
// beschikbaar is. z2_duur is de gegarandeerde laatste terugval (bereikbaar in
// alle zes generieke fasen, zie de fase-dekkingsfix).
const KANDIDATEN_PER_ROL = {
  intensiteitsdag: ["sweetspot_intervallen", "drempel_intervallen", "vo2max_intervallen", "gemengd", "sprint_neuraal", "kracht_lage_cadans"],
  variabele_dag: ["gemengd", "kracht_lage_cadans", "z2_duur"],
  aerobe_dag: ["z2_duur"],
  hersteldag: ["z2_duur"],
};

function kiesAlternatiefSessietype(origineelType, rol, fase, weekInFase, seizoensdoel) {
  const kandidaten = (KANDIDATEN_PER_ROL[rol] ?? ["z2_duur"]).filter(t => t !== origineelType);

  for (const kandidaat of kandidaten) {
    if (getArchetypesVoorSessietype(kandidaat, fase, weekInFase, seizoensdoel).length > 0) {
      return kandidaat;
    }
  }
  // Niets uit de kandidatenlijst is bereikbaar in deze context — val terug op
  // z2_duur (altijd bereikbaar), tenzij dat toevallig het origineletype was.
  if (origineelType !== "z2_duur" && getArchetypesVoorSessietype("z2_duur", fase, weekInFase, seizoensdoel).length > 0) {
    return "z2_duur";
  }
  return origineelType;
}

/**
 * @param {object} origineleIntentie
 * @param {string|null} reden
 * @param {string} fase
 * @param {string|null} hrvZone
 * @param {number} [weekInFase] - voor de fase-reikbaarheidscheck; default 1
 * @param {string} [seizoensdoel] - voor doel_beperking-filtering; optioneel
 */
export function bepaalNieuweIntentie(origineleIntentie, reden, fase, hrvZone, weekInFase = 1, seizoensdoel = null) {
  if (!origineleIntentie) return null;

  const effectieveReden = reden ?? (hrvZone === "rood" ? "vermoeid" : null);

  if (HERSTELGERELATEERDE_REDENEN.includes(effectieveReden) && origineleIntentie.rol === "intensiteitsdag") {
    return {
      rol: "aerobe_dag",
      sessietype: "z2_duur",
      toegestane_zones: ["Z1", "Z2"],
      tss_range: {
        min: Math.round((origineleIntentie.tss_range?.min ?? 60) * 0.6),
        max: Math.round((origineleIntentie.tss_range?.max ?? 90) * 0.7),
      },
      toelichting: reden
        ? `Alternatief vanwege ${reden}: intensiteitsdag vervangen door herstelgerichte Z2`
        : "Alternatief: HRV rood — intensiteitsdag automatisch verlaagd naar Z2",
    };
  }

  const alternatief = kiesAlternatiefSessietype(
    origineleIntentie.sessietype,
    origineleIntentie.rol,
    fase,
    weekInFase,
    seizoensdoel
  );

  return {
    ...origineleIntentie,
    sessietype: alternatief,
    toelichting: reden
      ? `Alternatief op verzoek (${reden}): sessietype gewisseld van ${origineleIntentie.sessietype} naar ${alternatief}`
      : hrvZone === "geel"
      ? "Alternatief: HRV geel — lichtere variant gekozen"
      : `Alternatief op verzoek: sessietype gewisseld van ${origineleIntentie.sessietype} naar ${alternatief}`,
  };
}
