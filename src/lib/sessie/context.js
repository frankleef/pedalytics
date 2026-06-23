// Assembleert de volledige context voor het genereren/aanpassen van één sessiedag.
// Bouwstuk 3: elke sessie-aanroep krijgt dezelfde, complete context mee.

import { kiesZ2Subtype, Z2_SUBTYPES } from "./z2subtypes";
const ZWAAR_TYPES = ["sweetspot", "interval", "drempel", "vo2max", "sweetspot_intervallen", "drempel_intervallen", "vo2max_intervallen", "over_under", "sprint_neuraal", "pyramide", "kracht_lage_cadans"];

/**
 * @typedef {import('../types').DagIntentie} DagIntentie
 *
 * @typedef {"beschikbaarheid_nieuw" | "beschikbaarheid_uren" | "check_in_aanpassing" | "rpe_trigger" | "fase_2_conflict" | "distributie_correctie"} Aanleiding
 *
 * @typedef {Object} SessieContext
 * @property {string} datum
 * @property {string} dagVanDeWeek
 * @property {string} fase
 * @property {number} weeknummer
 * @property {string} weektype
 * @property {DagIntentie|null} dagIntentie
 * @property {Array} overigeSessiesDezeWeek
 * @property {object|null} vorigeSessieOpDezeDag
 * @property {{ ctl: number, atl: number, tsb: number }} ctlAtlTsb
 * @property {{ hrv: number|null, rhr: number|null, trend: string }} hrvEnRhr
 * @property {number|null} checkInVandaag
 * @property {{ gemiddelde: number|null, trend: string, aantal: number }} rpeTrend
 * @property {Aanleiding} aanleiding
 * @property {object} atleetProfiel
 * @property {{ richting: string, magnitude: number }|null} distributieAfwijking
 */

/**
 * Bouwt de volledige sessie-context voor een gegeven datum en gebruiker.
 *
 * @param {object} params
 * @param {object} params.profiel - Atleetprofiel (ftp, lt_hr, max_hr, gewicht, etc.)
 * @param {object|null} params.wellness - Huidige wellness-data (ctl, atl, restingHR)
 * @param {Array} params.dagelijkseData - Afgelopen 7-14 dagen wellness
 * @param {object|null} params.voortgang - { ritten: [...] }
 * @param {object} params.seizoensplan - Het seizoensplan
 * @param {Array} params.overigeSessies - Andere sessies deze week
 * @param {string} params.datum - ISO-datumstring
 * @param {string} params.dagNaam - Dagnaam (Maandag, etc.)
 * @param {number} params.uren - Beschikbare uren
 * @param {object|null} params.oudeSessie - Bestaande sessie voor deze dag
 * @param {Aanleiding} [params.aanleiding] - Reden voor deze aanroep
 * @param {number|null} [params.checkInScore] - Check-in score (1-5)
 * @param {object|null} [params.distributieAfwijking] - Uit Upstash KV
 * @returns {SessieContext}
 */
export function bouwSessieContext({
  profiel,
  wellness,
  dagelijkseData,
  voortgang,
  seizoensplan,
  overigeSessies,
  datum,
  dagNaam,
  uren,
  oudeSessie,
  aanleiding = "beschikbaarheid_nieuw",
  checkInScore = null,
  distributieAfwijking = null,
}) {
  const ftp = profiel?.ftp || 265;

  // Toekomstige dagen: wellness-data van vandaag is niet representatief
  const vandaag = new Date().toISOString().slice(0, 10);
  const isToekomst = datum > vandaag;

  const ctl = wellness?.ctl || seizoensplan?.huidige_ctl || 45;
  const atl = wellness?.atl || 0;
  const tsb = Math.round(ctl - atl);

  // Weeknummer en kaderweek
  const dagenSindsStart = seizoensplan?.startdatum
    ? Math.max(0, (new Date(datum).getTime() - new Date(seizoensplan.startdatum).getTime()) / 86400000)
    : 0;
  const weeknummer = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
  const kaderWeek = seizoensplan?.kader?.find((w) => w.week === weeknummer) ||
    seizoensplan?.kader?.[0] ||
    { fase: "basis", tss_doel: 250, focus: "Z2 volume", weektype: "opbouw" };

  // Dag-intentie: uit oudeSessie of null
  const dagIntentie = oudeSessie?.intentie || null;

  // Z2-subtype selectie
  let z2Subtype = null;
  const isZ2Type = dagIntentie?.sessietype === "z2_vlak" || dagIntentie?.sessietype === "z2_variabel"
    || (!dagIntentie && !oudeSessie);
  if (isZ2Type) {
    const subKey = kiesZ2Subtype({
      beschikbaarMinuten: uren * 60,
      laatsteSubtype: null,
      decouplingMediaan: null,
    });
    if (subKey && Z2_SUBTYPES[subKey]) {
      z2Subtype = { key: subKey, label: Z2_SUBTYPES[subKey].label, beschrijving: Z2_SUBTYPES[subKey].beschrijving };
    }
  }

  // HRV/RHR
  const recenteHrv = (dagelijkseData || []).filter((d) => d.hrv).slice(-5);
  let hrvTrend = "stabiel";
  let hrvWaarde = null;
  let rhrWaarde = null;
  if (recenteHrv.length > 0) {
    hrvWaarde = recenteHrv[recenteHrv.length - 1].hrv;
    if (recenteHrv.length >= 3) {
      const eerste = recenteHrv.slice(0, 2).reduce((s, d) => s + d.hrv, 0) / 2;
      const laatste = recenteHrv.slice(-2).reduce((s, d) => s + d.hrv, 0) / 2;
      if (laatste < eerste - 3) hrvTrend = "dalend";
      else if (laatste > eerste + 3) hrvTrend = "stijgend";
    }
  }
  rhrWaarde = wellness?.restingHR || (dagelijkseData || []).filter((d) => d.rusthartslag).slice(-1)[0]?.rusthartslag || null;

  // RPE-trend (afgelopen 7-10 ritten)
  const tiendagenGeleden = new Date(Date.now() - 10 * 86400000);
  const rittenMetRpe = (voortgang?.ritten || []).filter(
    (r) => r.rpe && r.datum_iso && new Date(r.datum_iso) >= tiendagenGeleden
  );
  let rpeTrendGem = null;
  let rpeTrendRichting = "stabiel";
  if (rittenMetRpe.length >= 2) {
    rpeTrendGem = +(rittenMetRpe.reduce((s, r) => s + r.rpe, 0) / rittenMetRpe.length).toFixed(1);
    if (rpeTrendGem > 7) rpeTrendRichting = "hoog";
    else if (rpeTrendGem < 4) rpeTrendRichting = "laag";
  }

  // Overige sessies formatteren
  const overigeSessiesFormatted = (overigeSessies || []).map((s) => ({
    datum: s.datum,
    dag: s.dag,
    type: s.type,
    tss: s.tss,
    duur_min: s.duur_min,
    isZwaar: ZWAAR_TYPES.includes(s.type),
    intentie: s.intentie || null,
  }));

  // Rollend 7-dagen TSS-venster: [datum-6, datum] inclusief
  const datumMs = new Date(datum).getTime();
  const zevenDagenTerugMs = datumMs - 6 * 86400000;
  const tssRollend7d = overigeSessiesFormatted
    .filter((s) => {
      if (!s.datum) return false;
      const sMs = new Date(s.datum).getTime();
      return sMs >= zevenDagenTerugMs && sMs <= datumMs;
    })
    .reduce((sum, s) => sum + (s.tss || 0), 0);

  return {
    datum,
    dagVanDeWeek: dagNaam,
    isToekomst,
    fase: kaderWeek.fase,
    weeknummer,
    weektype: kaderWeek.weektype || "opbouw",
    tssDoel: kaderWeek.tss_doel,
    focus: kaderWeek.focus,
    sessietypes: kaderWeek.sessietypes || null,
    maxIntensiteit: kaderWeek.max_intensiteit ?? 1,
    z1z2Doel: kaderWeek.z1z2_doel || 0.80,
    doelType: seizoensplan?.seizoensdoel?.type || "ftp",
    uren,
    dagIntentie,
    z2Subtype,
    overigeSessiesDezeWeek: overigeSessiesFormatted,
    tssRollend7d,
    vorigeSessieOpDezeDag: oudeSessie || null,
    ctlAtlTsb: isToekomst ? null : { ctl: Math.round(ctl), atl: Math.round(atl), tsb },
    hrvEnRhr: isToekomst ? null : {
      hrv: hrvWaarde,
      rhr: rhrWaarde,
      trend: hrvTrend,
      basislijn_hrv: profiel?.hrv_basislijn || 58,
      basislijn_rhr: profiel?.hr_basislijn || 49,
    },
    checkInVandaag: isToekomst ? null : checkInScore,
    rpeTrend: { gemiddelde: rpeTrendGem, trend: rpeTrendRichting, aantal: rittenMetRpe.length },
    aanleiding,
    atleetProfiel: {
      ftp,
      lt_hr: profiel?.lt_hr,
      max_hr: profiel?.max_hr,
      gewicht: profiel?.gewicht,
      ervaringsniveau: seizoensplan?.ervaringsniveau || "recreatief",
    },
    distributieAfwijking,
    rpeOverbelasting: false,
    rpeOnderstimulering: false,
    vo2maxTogestaan: seizoensplan?.planOverrides?.vo2max_toegestaan ?? false,
  };
}

