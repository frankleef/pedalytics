// Pedalytics type definitions (JSDoc)
// Bouwstuk 1: Dag-intentie-structuur en JSON-schema

/**
 * @typedef {"intensiteitsdag" | "aerobe_dag" | "hersteldag" | "variabele_dag" | "ftp_test"} DagRol
 */

/**
 * @typedef {"sweetspot_intervallen" | "drempel_intervallen" | "vo2max_intervallen" | "over_under" | "sprint_neuraal" | "pyramide" | "z2_vlak" | "z2_variabel" | "z1_herstel" | "ramp_test"} Sessietype
 */

/**
 * @typedef {Object} DagIntentie
 * @property {DagRol} rol
 * @property {Sessietype} sessietype
 * @property {string[]} toegestane_zones - bv. ["Z3", "Z4"]
 * @property {{ min: number, max: number }} tss_range
 * @property {string} toelichting
 * @property {boolean} [neuraal] - true alleen bij sprint_neuraal
 */

/**
 * @typedef {Object} GeplandeDag
 * @property {string} datum - ISO-datumstring
 * @property {DagIntentie} [intentie] - aanwezig op trainingsdagen, afwezig op rustdagen
 * @property {boolean} [check_in_aangepast]
 * @property {boolean} [rest_waarschuwing]
 * @property {DagIntentie} [intentie_origineel] - bewaard bij rest-vervanging
 */

/**
 * @typedef {"opbouw" | "herstel"} Weektype
 */

/**
 * @typedef {Object} GeplandeWeek
 * @property {number} weeknummer
 * @property {Weektype} weektype
 * @property {number} tss_doel
 * @property {GeplandeDag[]} dagen
 */

/** Geldige DagRol-waarden */
export const DAG_ROLLEN = [
  "intensiteitsdag",
  "aerobe_dag",
  "hersteldag",
  "variabele_dag",
  "ftp_test",
];

/** Geldige Sessietype-waarden */
export const SESSIETYPES = [
  "sweetspot_intervallen",
  "drempel_intervallen",
  "vo2max_intervallen",
  "over_under",
  "sprint_neuraal",
  "pyramide",
  "z2_vlak",
  "z2_variabel",
  "z1_herstel",
  "ramp_test",
];

/** Geldige Weektype-waarden */
export const WEEKTYPES = ["opbouw", "herstel"];
