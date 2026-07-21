// C1: compliance-tracking per sessie — bepaalt of een geplande kernsessie
// "volledig", "verzwakt" of "niet_geleverd" is uitgevoerd. Zie
// src/app/api/cron/sync/route.js (matching/write) en
// src/app/api/cron/compliance-check/route.js (niet-geleverd-detectie +
// reconciliatie, C8) voor de call sites. Bouwt bewust voort op bestaande
// primitieven i.p.v. het distributie.js/zonedistributieScore-paar te
// hergebruiken — die twee hebben een andere semantiek (respectievelijk:
// geaggregeerde 14-dagen Z1/Z2-drift t.o.v. een populatiedoel, en een
// gepenaliseerde 0-10-score) dan de hier benodigde "% van de rit binnen de
// toegestane zones van déze sessie".

import { getKV } from "../kv";
import { laatsteNDagen, datumOffset, datumISO, DAGNAMEN } from "../datum";
import { zoneTimesNaarObject, dimensieScore } from "../uitvoeringsscore";
import { maakMelding } from "../meldingen";
import { faseStartdatum, getMaandagVanWeek, weekInFaseVoorDatum } from "../weekgrenzen";

// Discrete-effort sessietypes uit BEOOGDE_IF (uitvoeringsscore.js:39-49) —
// korte, niet-continue inspanningen waarvoor een tijd-in-zone-percentage geen
// zinnige fidelity-metric is. Voor deze types wordt i.p.v. daarvan de
// bestaande dimensieScore-uitkomst (0-10-schaal) als compliance-basis
// gebruikt.
const DISCRETE_EFFORT_TYPES = new Set(["sprint_neuraal", "kracht_lage_cadans"]);

// Kernsessietypes die onder compliance-tracking vallen: sweetspot/drempel/
// vo2max/Z2/tempo. z1_herstel en ramp_test tellen bewust niet mee — ramp_test
// is elders al structureel uitgezonderd van vergelijkbare aanpassingen (zie
// volumeCorrectie.js, "Sectie 51-C: ramp_test is structureel onaantastbaar"),
// en z1_herstel is geen kernsessie maar een hersteldag.
const KERNSESSIE_TYPES = new Set([
  "sweetspot_intervallen",
  "drempel_intervallen",
  "vo2max_intervallen",
  "z2_steady",
  "z2_heuvel",
  "z2_duur",
  "z2_tempo_teugjes",
]);

/**
 * Of dit sessietype meetelt als "kernsessie" voor compliance-tracking.
 * Wordt door latere stappen (C2/C4/C5) gebruikt om te filteren welke sessies
 * meetellen in het 10-dagenvenster — hier alleen de classificatie, geen
 * venster-/freeze-logica.
 * @param {string|null|undefined} sessietype
 * @returns {boolean}
 */
export function isKernsessieVoorCompliance(sessietype) {
  return KERNSESSIE_TYPES.has(sessietype);
}

// B2: fysiologisch zware sessietypes — een engere selectie dan
// KERNSESSIE_TYPES hierboven (die bevat ook lichte Z2-duurritten). Bedoeld om
// te bepalen VANAF WELKE DAG een hersteltijd geteld moet worden, niet om
// compliance te tracken. Uitsluitend de vijf volledige, huidige
// GELDIGE_SESSIETYPES-namen (sessie-archetypes.js) — niet de verouderde korte
// aliassen ("sweetspot"/"interval"/"drempel"/"vo2max") uit het oudere,
// dode ZWAAR_TYPES in context.js (bouwSessieContext, geen aanroepers).
const ZWARE_SESSIETYPES_HERSTEL = new Set([
  "sweetspot_intervallen",
  "drempel_intervallen",
  "vo2max_intervallen",
  "sprint_neuraal",
  "kracht_lage_cadans",
]);

/**
 * Of dit sessietype fysiologisch zwaar genoeg is om als startpunt voor een
 * hersteltijd-telling (B2) te gelden.
 * @param {string|null|undefined} sessietype
 * @returns {boolean}
 */
export function isZwareSessieVoorHerstel(sessietype) {
  return ZWARE_SESSIETYPES_HERSTEL.has(sessietype);
}

/**
 * Datum van de laatste VOLTOOIDE zware sessie (B2), of null als er geen is.
 * Scant plan.weekSessies.sessies — niet ctx.overigeSessies (die bevat alleen
 * niet-voltooide sessies, zie genereren.js). Een sessie die door B1
 * (HRV-rood, hrv/verwerking.js's verwerkSchrappen/verwerkVerlichten) is
 * vervangen heeft dan al een ander sessie.intentie.sessietype (bv.
 * "z1_herstel" of "z2_duur") en wordt hier dus vanzelf uitgefilterd — geen
 * aparte check op sessie.mode/hrv_keuze nodig.
 * @param {object} plan - seizoensplan met .weekSessies.sessies
 * @returns {string|null} ISO-datum, of null
 */
export function haalLaatsteZwareSessieDatum(plan) {
  let laatsteDatum = null;
  for (const s of plan?.weekSessies?.sessies || []) {
    if (!s.voltooid || !s.datum) continue;
    if (!isZwareSessieVoorHerstel(s.intentie?.sessietype)) continue;
    if (laatsteDatum == null || s.datum > laatsteDatum) laatsteDatum = s.datum;
  }
  return laatsteDatum;
}

/**
 * B5: of kandidaatDatum minder dan 48u verwijderd is van een ANDERE zware
 * sessie in het plan (los van welke die zelf is — dit checkt tegen ALLE
 * zware datums, niet alleen de meest recente, in tegenstelling tot
 * haalLaatsteZwareSessieDatum hierboven).
 * @param {object} plan
 * @param {string} kandidaatDatum - ISO-datum
 * @returns {boolean}
 */
export function isBinnen48uVanAndereZwareSessie(plan, kandidaatDatum) {
  for (const s of plan?.weekSessies?.sessies || []) {
    if (!s.datum || s.datum === kandidaatDatum) continue;
    if (!isZwareSessieVoorHerstel(s.intentie?.sessietype)) continue;
    const verschilUren = Math.abs(new Date(s.datum) - new Date(kandidaatDatum)) / 3600000;
    if (verschilUren < 48) return true;
  }
  return false;
}

/**
 * B5: vindt de eerste geldige herschikkingskandidaat ná gedowngradeDatum,
 * binnen dezelfde ISO-week (nooit over de weekgrens heen — beslissing 4).
 * Een kandidaat moet: (a) na de gedowngradeerde datum liggen en niet voorbij
 * zondag van diezelfde week, (b) nog niet voltooid zijn, (c) geen neuraal-
 * sessie zijn (zelfde uitzondering als checkInSessieAanpassing), (d) niet al
 * beschermd zijn (sessie.beschermd_herschikking), (e) zelf ≥48u afstand
 * houden tot elke andere zware sessie. Eerste (vroegste) geldige match wint —
 * deterministisch, geen voorkeur voor "lichtste huidige toewijzing".
 * @param {object} plan
 * @param {string} gedowngradeDatum - ISO-datum van de gedowngradeerde kernsessie
 * @returns {string|null} ISO-datum van de kandidaat, of null
 */
export function vindHerschikkingsKandidaat(plan, gedowngradeDatum) {
  if (!plan?.weekSessies?.sessies || !gedowngradeDatum) return null;

  const weekMaandag = getMaandagVanWeek(gedowngradeDatum);
  const weekZondag = new Date(weekMaandag);
  weekZondag.setDate(weekZondag.getDate() + 6);
  const weekZondagIso = datumISO(weekZondag);

  const kandidaten = plan.weekSessies.sessies
    .filter(s => s.datum && s.datum > gedowngradeDatum && s.datum <= weekZondagIso)
    .filter(s => !s.voltooid)
    .filter(s => s.intentie?.neuraal !== true)
    .filter(s => !s.beschermd_herschikking)
    .filter(s => !isBinnen48uVanAndereZwareSessie(plan, s.datum))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  return kandidaten.length > 0 ? kandidaten[0].datum : null;
}

/**
 * Of dit sessietype een discrete-effort-type is (dimensieScore-pad i.p.v.
 * tijd-in-zone-pad in bepaalComplianceTier).
 * @param {string|null|undefined} sessietype
 * @returns {boolean}
 */
export function isDiscreteEffortType(sessietype) {
  return DISCRETE_EFFORT_TYPES.has(sessietype);
}

/**
 * Tijd-in-zone-fidelity voor continue-intensiteit sessies: welk deel van de
 * gereden tijd viel binnen de toegestane zones van de intentie.
 *
 * Verwacht `tijdInZones` in het formaat van zoneTimesNaarObject()
 * (uitvoeringsscore.js:130-137), dus { Z1: seconden, Z2: seconden, ... } —
 * er wordt hier geen eigen zone-parsing gedaan, alleen die bestaande parsing
 * hergebruikt door de aanroeper.
 *
 * Schaal: 0-100 (percentage), niet 0-1 — consistent met z1z2Pct/doelPct in
 * distributie.js:39-40, en zodat de 85/50-drempels in bepaalComplianceTier
 * direct toepasbaar zijn zonder conversie.
 *
 * @param {Object|null} tijdInZones - { Z1: seconden, Z2: seconden, ... }
 * @param {string[]|null|undefined} toegestaneZones - bijv. ["Z2"]
 * @returns {number|null} 0-100, of null als er geen bruikbare data is
 */
export function berekenTijdInZonePercentage(tijdInZones, toegestaneZones) {
  if (!tijdInZones || !toegestaneZones?.length) return null;

  let secondenInToegestaneZones = 0;
  let totaalSeconden = 0;
  for (const [zone, seconden] of Object.entries(tijdInZones)) {
    totaalSeconden += seconden || 0;
    if (toegestaneZones.includes(zone)) secondenInToegestaneZones += seconden || 0;
  }

  if (totaalSeconden === 0) return null;
  return Math.round((secondenInToegestaneZones / totaalSeconden) * 1000) / 10;
}

/**
 * Bepaalt de compliance-tier op basis van een al-berekende score.
 *
 * Voor discrete-effort-types (sprint_neuraal, kracht_lage_cadans) wordt
 * `percentageOfScore` geïnterpreteerd als een dimensieScore-uitkomst
 * (0-10-schaal, drempels 8.5/5) — voor alle overige sessietypes als een
 * tijd-in-zone-percentage (0-100-schaal, drempels 85/50).
 *
 * @param {number|null} percentageOfScore
 * @param {string|null|undefined} sessietype
 * @returns {'volledig'|'verzwakt'|'niet_geleverd'|null}
 */
export function bepaalComplianceTier(percentageOfScore, sessietype) {
  if (percentageOfScore == null) return null;

  if (isDiscreteEffortType(sessietype)) {
    if (percentageOfScore >= 8.5) return "volledig";
    if (percentageOfScore >= 5) return "verzwakt";
    return "niet_geleverd";
  }

  if (percentageOfScore >= 85) return "volledig";
  if (percentageOfScore >= 50) return "verzwakt";
  return "niet_geleverd";
}

/**
 * Bouwt een volledig sessie_compliance-record. Geëxtraheerd uit de inline
 * logica die voorheen in cron/sync/route.js zat (matching-pad) — nu ook
 * hergebruikt door de reconciliatie in compliance-check/route.js (C8), zodat
 * beide plekken exact dezelfde tier-berekening gebruiken.
 *
 * @param {Object} input
 * @param {string|null} input.sessietype
 * @param {number|null} input.tssDoel
 * @param {string[]|null|undefined} input.toegestaneZones
 * @param {number|null} input.icuTrainingLoad
 * @param {Array|null} input.icuZoneTimes - ruwe icu_zone_times van de activiteit
 * @param {string|number|null} input.activiteitId
 * @param {string|null|undefined} input.verplaatstVan
 * @param {string|null|undefined} input.verplaatstNaar
 * @param {string} input.datum
 * @returns {Object} sessie_compliance-record
 */
export function bepaalComplianceRecord({
  sessietype, tssDoel, toegestaneZones, icuTrainingLoad, icuZoneTimes,
  activiteitId, verplaatstVan, verplaatstNaar, datum,
}) {
  const percentageOfScore = isDiscreteEffortType(sessietype)
    ? dimensieScore(icuTrainingLoad, tssDoel)
    : berekenTijdInZonePercentage(zoneTimesNaarObject(icuZoneTimes), toegestaneZones);

  return {
    tier: bepaalComplianceTier(percentageOfScore, sessietype),
    percentageOfScore,
    sessietype,
    isKernsessie: isKernsessieVoorCompliance(sessietype),
    verplaatst_van: verplaatstVan ?? null,
    verplaatst_naar: verplaatstNaar ?? null,
    activiteitId,
    datum,
    berekendOp: new Date().toISOString(),
  };
}

// C2: venstergrootte gedeeld tussen de reconciliatie-bovengrens
// (compliance-check/route.js) en de venster-lezer hieronder, zodat reconciliatie
// nooit verder terugkijkt dan wat haalComplianceVenster() daadwerkelijk leest.
export const COMPLIANCE_VENSTER_DAGEN = 10;

/**
 * Rollend venster over sessie_compliance-records — on-demand, geen
 * vooraf-berekende/gecachete samenvatting (zie C2-plan: kosten zijn triviaal
 * met kv.mget, en een cache zou een nieuw, onnodig schrijfmoment introduceren).
 * Nog door niemand aangeroepen — bedoeld voor latere C3/C4/C5-stappen.
 *
 * @param {string} userId
 * @param {number} [dagen] - venstergrootte, default COMPLIANCE_VENSTER_DAGEN
 * @returns {Promise<{vensterDagen: number, totaalKernsessies: number, volledig: number, verzwakt: number, nietGeleverd: number, nietGeleverdDatums: string[]}>}
 */
export async function haalComplianceVenster(userId, dagen = COMPLIANCE_VENSTER_DAGEN) {
  const kv = getKV();
  const datums = laatsteNDagen(dagen);
  const keys = datums.map(datum => `sessie_compliance:${userId}:${datum}`);
  const records = await kv.mget(...keys);

  let volledig = 0, verzwakt = 0, nietGeleverd = 0;
  const nietGeleverdDatums = [];

  datums.forEach((datum, i) => {
    const record = records[i];
    if (!record?.isKernsessie) return;
    if (record.tier === "volledig") volledig++;
    else if (record.tier === "verzwakt") verzwakt++;
    else if (record.tier === "niet_geleverd") {
      nietGeleverd++;
      nietGeleverdDatums.push(datum);
    }
  });

  return {
    vensterDagen: dagen,
    totaalKernsessies: volledig + verzwakt + nietGeleverd,
    volledig,
    verzwakt,
    nietGeleverd,
    nietGeleverdDatums,
  };
}

function complianceFreezeKey(userId) {
  return `compliance_freeze:${userId}`;
}

/**
 * Evalueert het compliance-venster en werkt compliance_freeze:${userId} bij.
 * Persistent record (geen log, zelfde patroon als conditie_score:${userId}):
 * { actief, laatsteTriggerDatum }. laatsteTriggerDatum blijft bewust bestaan
 * ná een unfreeze — nodig om een latere, écht nieuwe misser te kunnen
 * onderscheiden van dezelfde (al verwerkte) misser die nog in het venster zit.
 *
 * Algoritme (vier stappen, zie C3/C4/C5-plan):
 * a. Bepaal de meest recente niet_geleverd-datum in het venster.
 * b. Lees het huidige record (default { actief: false, laatsteTriggerDatum: null }).
 * c. Alleen als die meest recente misser NIEUW is t.o.v. laatsteTriggerDatum:
 *    bij 1 misser in het venster -> lichte melding; bij >=2 -> freeze aan
 *    (+ nadrukkelijke melding, alleen bij de false->true-overgang).
 * d. Onafhankelijk van c, elke run: een al-actieve freeze wordt na 7 dagen
 *    zonder nieuwe misser automatisch opgeheven — wint altijd van de ruwe
 *    venstertelling.
 *
 * @param {string} userId
 * @returns {Promise<{actief: boolean, laatsteTriggerDatum: string|null}>}
 */
export async function evalueerComplianceFreeze(userId) {
  const kv = getKV();
  const venster = await haalComplianceVenster(userId);
  const nieuwsteMisser = venster.nietGeleverdDatums.length > 0
    ? venster.nietGeleverdDatums[venster.nietGeleverdDatums.length - 1]
    : null;

  const huidig = (await kv.get(complianceFreezeKey(userId))) ?? { actief: false, laatsteTriggerDatum: null };
  let { actief, laatsteTriggerDatum } = huidig;

  // Stap c: alleen bij een NIEUWE misser sinds de vorige run.
  if (nieuwsteMisser && (laatsteTriggerDatum == null || nieuwsteMisser > laatsteTriggerDatum)) {
    laatsteTriggerDatum = nieuwsteMisser;

    if (venster.nietGeleverd === 1) {
      const dagLabel = DAGNAMEN[new Date(nieuwsteMisser).getDay()];
      maakMelding(userId, "compliance_eerste_misser", { datum: nieuwsteMisser, dagLabel }).catch(e =>
        console.warn(`[compliance] Melding-aanmaak (compliance_eerste_misser) mislukt voor ${userId}:`, e.message)
      );
    } else if (venster.nietGeleverd >= 2) {
      const wasActief = actief;
      actief = true;
      if (!wasActief) {
        maakMelding(userId, "compliance_freeze_geactiveerd", { datum: nieuwsteMisser, aantalMissers: venster.nietGeleverd }).catch(e =>
          console.warn(`[compliance] Melding-aanmaak (compliance_freeze_geactiveerd) mislukt voor ${userId}:`, e.message)
        );
      }
    }
  }

  // Stap d: onafhankelijk van stap c — wint altijd van de ruwe venstertelling.
  if (actief && laatsteTriggerDatum && laatsteTriggerDatum <= datumOffset(-7)) {
    actief = false;
  }

  const bijgewerkt = { actief, laatsteTriggerDatum };
  await kv.set(complianceFreezeKey(userId), bijgewerkt, { ex: 8 * 86400 });
  return bijgewerkt;
}

/**
 * Leest compliance_freeze:${userId} en zet 'm om naar bevrorenWeekInFase —
 * de weekInFase-waarde waarop de progressie (schatTssDoel/effectieveDuurMin,
 * zie weekSolver.js) bevriest zolang de freeze actief is. Puur-lezend (geen
 * herevaluatie van het compliance-venster — dat gebeurt uitsluitend in
 * evalueerComplianceFreeze), fail-open naar null bij afwezig record of een
 * leesfout, zodat sessiegeneratie/-planning nooit blokkeert op dit
 * hulpsignaal. Gedeeld tussen genereren.js (genereerSessieDag, per-dag) en
 * weekSessiesDeterministisch.js (solveWeek, per-week) — zelfde bron, zelfde
 * uitkomst, niet langer op twee plekken inline gedupliceerd.
 * @param {object} kv
 * @param {string} userId
 * @param {object} plan - seizoensplan met .kader en .startdatum
 * @returns {Promise<number|null>}
 */
export async function haalBevrorenWeekInFase(kv, userId, plan) {
  try {
    const freezeRecord = await kv.get(complianceFreezeKey(userId));
    if (freezeRecord?.actief === true) {
      return weekInFaseVoorDatum(freezeRecord.laatsteTriggerDatum, plan?.kader, plan?.startdatum);
    }
  } catch (e) {
    console.warn(`[compliance] bevrorenWeekInFase lezen mislukt (fail-open):`, e.message);
  }
  return null;
}

/**
 * D1: compliance-poort vóór bloktrend-interpretatie — gespiegeld aan
 * checkFaseOvergang(decouplingWaarden, aantalVerlengingen) (decoupling.js:30)
 * qua signatuur-stijl en zuiverheid: puur, geen bijeffecten, geen eigen
 * tellerverhoging (dat blijft, net als bij checkFaseOvergang, de
 * verantwoordelijkheid van de aanroeper in cron/sync/route.js).
 *
 * Evalueert of het lopende blok voldoende compliant was om de bloktrend
 * (fase-overgang) te vertrouwen, over de periode sinds het begin van de
 * HUIDIGE fase (faseStartdatum) — niet het vaste 10-dagenvenster van C3/C4/C5.
 *
 * @param {string} userId
 * @param {object} plan - seizoensplan met .kader en .startdatum
 * @param {number} [complianceVerlengdCount] - eigen teller, NIET
 *   fase_verlengd_count (die is decoupling-specifiek, zie D1-plan beslissing #2)
 * @returns {Promise<{uitstel: boolean, nietGeleverd: number}>}
 */
export async function evalueerComplianceGate(userId, plan, complianceVerlengdCount = 0) {
  const start = faseStartdatum(plan);
  if (!start) return { uitstel: false, nietGeleverd: 0 };

  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);
  const faseDuurInDagen = Math.floor((vandaag - start) / 86400000) + 1;

  const venster = await haalComplianceVenster(userId, faseDuurInDagen);
  const uitstel = venster.nietGeleverd >= 2 && complianceVerlengdCount < 2;
  return { uitstel, nietGeleverd: venster.nietGeleverd };
}
