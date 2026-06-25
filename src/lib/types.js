// Pedalytics type definitions (JSDoc)
// Bouwstuk 1: Dag-intentie-structuur en JSON-schema

/**
 * @typedef {"intensiteitsdag" | "aerobe_dag" | "hersteldag" | "variabele_dag" | "ftp_test"} DagRol
 */

/**
 * @typedef {"z2_vlak" | "z2_variabel" | "z2_cadans" | "z2_heuvel" | "z2_tempo_teugjes" | "z2_steady" | "z2_lang" |
 *   "sweetspot_intervallen" | "sweetspot_lang" |
 *   "drempel_intervallen" | "over_under" | "pyramide" |
 *   "vo2max_intervallen" | "vo2max_lang" | "vo2max_kort" |
 *   "microbursts" | "race_simulatie" | "progressief" |
 *   "sprint_neuraal" | "kracht_lage_cadans" |
 *   "z2_embedded_sprint" | "sprint_peak_test" |
 *   "herstel_actief" | "herstel_mobiliteit" |
 *   "z1_herstel" | "ramp_test"} Sessietype
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
  "z2_vlak", "z2_variabel", "z2_cadans", "z2_heuvel", "z2_tempo_teugjes", "z2_steady", "z2_lang",
  "sweetspot_intervallen", "sweetspot_lang",
  "drempel_intervallen", "over_under", "pyramide",
  "vo2max_intervallen", "vo2max_lang", "vo2max_kort",
  "microbursts", "race_simulatie", "progressief",
  "sprint_neuraal", "kracht_lage_cadans",
  "z2_embedded_sprint", "sprint_peak_test",
  "herstel_actief", "herstel_mobiliteit",
  "z1_herstel", "ramp_test",
];

export const SESSIETYPE_PARAMS = {
  sweetspot_lang: {
    zones: ["Z3", "Z4"],
    blokDuurSeconden: { min: 900, max: 1500 },
    herstelDuurSeconden: 300,
    aantalBlokken: { min: 2, max: 3 },
    cadansRpm: { min: 88, max: 95 },
    tss_range: { min: 70, max: 95 },
    methode: "sst",
    beschikbaarheid: ["recreatief", "getraind"],
    fasen: ["sweetspot", "drempel", "consolidatie"],
  },
  vo2max_lang: {
    zones: ["Z4", "Z5"],
    blokDuurSeconden: { min: 480, max: 720 },
    herstelRatio: 1.0,
    aantalBlokken: { min: 3, max: 4 },
    cadansRpm: { min: 88, max: 95 },
    tss_range: { min: 75, max: 100 },
    methode: "seiler_long",
    beschikbaarheid: ["recreatief", "getraind"],
    fasen: ["drempel", "consolidatie"],
  },
  vo2max_kort: {
    zones: ["Z1", "Z5"],
    werkBlokSeconden: { min: 20, max: 40 },
    herstelBlokSeconden: { min: 10, max: 20 },
    aantalBlokkenPerSerie: { min: 8, max: 15 },
    aantalSeries: { min: 2, max: 4 },
    herstelTussenSeriesSeconden: { min: 180, max: 240 },
    cadansRpm: { min: 90, max: 110 },
    tss_range: { min: 55, max: 80 },
    methode: "polarized",
    beschikbaarheid: ["starter", "recreatief", "getraind"],
    fasen: ["drempel", "consolidatie"],
    starterBeperking: { maxSeries: 2, alleenVariant: "30/15" },
  },
  microbursts: {
    zones: ["Z1", "Z2", "Z5"],
    werkBlokSeconden: 15,
    herstelBlokSeconden: 15,
    aantalBlokkenPerSerie: { min: 15, max: 20 },
    aantalSeries: { min: 2, max: 3 },
    herstelTussenSeriesSeconden: 300,
    cadansRpm: { min: 85, max: 100 },
    tss_range: { min: 50, max: 70 },
    methode: "polarized",
    beschikbaarheid: ["recreatief", "getraind"],
    fasen: ["sweetspot", "drempel"],
    doelen: ["klimmen", "sprint"],
  },
  race_simulatie: {
    zones: ["Z1", "Z2", "Z5"],
    opritDuurMinuten: { min: 30, max: 40 },
    aanvalBlokSeconden: { min: 30, max: 60 },
    aanvalVermogenPct: { min: 130, max: 150 },
    aantalAanvallen: { min: 4, max: 6 },
    herstelTussenAanvallenSeconden: { min: 180, max: 300 },
    uitrijdenDuurMinuten: { min: 15, max: 20 },
    tss_range: { min: 70, max: 100 },
    methode: "polarized",
    beschikbaarheid: ["starter", "recreatief", "getraind"],
    fasen: ["consolidatie"],
  },
  progressief: {
    zones: ["Z1", "Z2", "Z3", "Z4"],
    structuur: "oplopend_per_kwartier",
    tss_range: { min: 55, max: 80 },
    methode: "polarized",
    beschikbaarheid: ["starter", "recreatief", "getraind"],
    fasen: ["basis", "sweetspot", "drempel"],
  },
  herstel_mobiliteit: {
    zones: ["Z1"],
    duurMinuten: { min: 20, max: 30 },
    tss_range: { min: 15, max: 25 },
    methode: "polarized",
    beschikbaarheid: ["starter", "recreatief", "getraind"],
    fasen: ["alle"],
    uiReminder: true,
  },
};

/** Geldige Weektype-waarden */
export const WEEKTYPES = ["opbouw", "herstel"];

/**
 * @typedef {"ftp" | "aerobe_basis" | "klimmen" | "uithoudingsvermogen" | "sprint"} DoelType
 *
 * @typedef {Object} SeizoensDoel
 * @property {DoelType} type
 * @property {number} [doel_ftp] - alleen bij 'ftp' en 'klimmen'
 * @property {number} [doel_wkg] - alleen bij 'klimmen'
 * @property {string} [doel_omschrijving] - alleen bij 'aerobe_basis', 'uithoudingsvermogen', 'sprint'
 * @property {string} [event_datum] - ISO-datumstring, alleen bij 'uithoudingsvermogen'
 */

/** Geldige DoelType-waarden */
export const DOEL_TYPES = ["ftp", "aerobe_basis", "klimmen", "uithoudingsvermogen", "sprint"];
