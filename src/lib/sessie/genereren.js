// Centrale sessiedag-generator (sectie 46, later volledig deterministisch gemaakt):
// beslist NOOIT meer zelf via Claude welk sessietype of welke inhoud een dag krijgt.
// Gedeeld door alle aanroeppaden: sessiesAanvullen-cron, admin-regeneratie, en
// /api/jobs (sessieDag). De caller moet altijd een sessietype meegeven — via
// ctx.effectiefSessietype of oudeSessie.intentie.sessietype — vooraf bepaald door
// een deterministische bron (bv. solveWeek(), een bestaande sessie, of een expliciete
// override voor volumecorrectie). Ontbreekt dat, dan gooit deze functie een expliciete
// fout in plaats van stilzwijgend Claude te vragen om het te verzinnen.
//
// De enige overgebleven Claude-gestuurde sessiegeneratie in deze codebase is de
// weekSessies-job (bouwWeekSessiesPrompt, /api/jobs type "weekSessies") — die loopt
// niet via deze functie en blijft bewust buiten deze migratie (chunk 6.2).

import { normaliseerSessieSegmenten, valideerKrachtRestrictie } from "./normaliseer";
import { voegVerwachtRpeToe } from "./rpe";
import { corrigeerSessieTss, corrigeerSessieTssTovDagbudget } from "./tssValidatie";
import { capSessieDuur } from "./duurCap";
import { rondDuurMinAf } from "./duurAfronding";
import {
  getArchetypesVoorSessietype,
  getArchetypesVoorSessietypeRaw,
  getRecenteArchetypes,
  selecteerArchetype,
  slaArchetypeOp,
  migreesSessietype,
  valideerZ1Gebruik,
} from "../sessie-archetypes";
import { schatTssDoel, degradeerBijLageTsb, effectieveDuurMin } from "./weekSolver";
import { maakMelding } from "../meldingen";
import { voegZ2VerlengingToe } from "./segmentStaart";
import { selecteerVariantOpDagvorm, genereerSessieDeterministisch } from "../sessie-generatie";
import { bepaalHrvZone } from "../hrv/zone";
import { haalHrvTrendOp, haalRhrTrendOp, bepaalHrvTrendTrigger, bepaalRhrTrendTrigger } from "../hrv/basislijnTrend";
import { berekenSchoneReferentie, bepaalHerstelsnelheidTrigger, HERSTEL_PLAFOND_DAGEN } from "../hrv/herstelsnelheid";
import { haalLaatsteZwareSessieDatum, haalBevrorenWeekInFase } from "./compliance";
import { getIntervalsCredentials } from "../users";
import { intervalsGet } from "../intervals";
import { datumISO, datumOffset } from "../datum";
import { logEvent } from "../posthog";
import { haalCpWprimeTrendOp } from "../cpWprime";
import { WBAL_KALIBRATIE_SESSIETYPES } from "../wbalSimulatie";
import { haalWbalDrempels } from "../wbalDrempels";

/**
 * Genereert één sessiedag, volledig deterministisch.
 *
 * @param {object} ctx
 * @param {object} ctx.kv
 * @param {string} ctx.userId
 * @param {string} ctx.datum
 * @param {string} ctx.dagNaam
 * @param {number} ctx.uren - beschikbare uren; bepaalt doelDuurMin en de duur-cap
 * @param {object} ctx.profiel - { ftp, power_zones, ... }
 * @param {object|null} ctx.wellness
 * @param {object} ctx.plan - seizoensplan (kader/seizoensdoel)
 * @param {object|null} [ctx.oudeSessie] - bestaande sessie met .intentie, indien regeneratie
 * @param {Array} [ctx.overigeSessies]
 * @param {string|null} [ctx.effectiefSessietype] - override; anders oudeSessie?.intentie?.sessietype
 * @param {string} [ctx.huidigeFase]
 * @param {number} [ctx.weekInFase]
 * @param {string} [ctx.weektype] - 'opbouw'|'herstel'; sluit archetypes met
 *   `toegestaan_in_herstelweek: false` uit tijdens een herstelweek
 * @param {object|null} [ctx.hrvProfiel] - voor bepaalHrvZone; null -> hrv 'onbekend'
 * @param {number} [ctx.piekSprint]
 * @param {number|null} [ctx.weekTssDoel] - kader-weekbudget voor de lopende week;
 *   samen met ctx.alGeleverdTss gebruikt om het dagbudget te clampen op het
 *   resterende weekbudget. Beide weglaten (bestaand gedrag, bv. cron-pad dat al
 *   via solveWeek()/pasBudgetToe() budget-bewust is) slaat deze clamp over.
 * @param {number|null} [ctx.alGeleverdTss] - reeds geleverde TSS deze week
 *   (bv. via bepaalAlGeleverd()); zie ctx.weekTssDoel.
 * @returns {Promise<object|{_geenSessie: true, reden: string}>} de gegenereerde
 *   sessie, of een marker-object als het resterende weekbudget te klein is voor
 *   een zinvolle sessie (alleen mogelijk als weekTssDoel/alGeleverdTss zijn
 *   meegegeven)
 * @throws {Error} als er geen sessietype bekend is, of geen archetype/variantendata
 *   voor het gevraagde sessietype bestaat
 */
// Onder dit resterende-weekbudget wordt geen sessie meer gegenereerd (i.p.v.
// een gedegenereerde, bijna-lege sessie) — ongeveer het minimum voor een
// zinvol actief-herstelritje.
const MINIMALE_ZINVOLLE_TSS = 30;

// Onder deze duur is een Z2-verlenging (zie hieronder) niet de moeite waard —
// te weinig om als zinvol duurvolume te tellen, wel genoeg om ruis te geven.
const MINIMALE_ZINVOLLE_VERLENGING_MIN = 15;
// Zelfde IF-midden als SESSIETYPE_IF_MIDDEN.z2_duur in weekSolver.js.
const Z2_IF_MIDDEN = 0.72;

export async function genereerSessieDag(ctx) {
  const {
    kv, userId, datum, dagNaam, uren, profiel, wellness, plan,
    oudeSessie = null, overigeSessies = [],
    huidigeFase = "basis", weekInFase = 1, weektype = "opbouw", hrvProfiel = null,
    weekTssDoel = null, alGeleverdTss = null,
  } = ctx;

  const dagIntentie = oudeSessie?.intentie || null;
  const effectiefSessietypeRuw = ctx.effectiefSessietype !== undefined
    ? ctx.effectiefSessietype
    : (dagIntentie?.sessietype ?? null);

  if (!effectiefSessietypeRuw) {
    throw new Error(
      `genereerSessieDag: geen sessietype bekend voor ${datum} — effectiefSessietype/oudeSessie.intentie.sessietype ontbreekt. Dit moet vooraf deterministisch bepaald zijn (bv. via solveWeek()); genereerSessieDag beslist dit zelf niet (geen Claude-fallback meer).`
    );
  }

  // Migratie van verouderde/legacy sessietype-namen (bv. nog aanwezig in een
  // opgeslagen dagIntentie van vóór een archetype-hernoeming, of afkomstig van
  // de Claude-gestuurde weekSessies-job die een bredere vocabulaire toestaat)
  // gebeurt hier centraal — niet langer de verantwoordelijkheid van elke
  // aanroeper afzonderlijk (voorheen inconsistent toegepast: alleen de
  // admin-regeneratieroutes deden dit, sessiesAanvullen.js en /api/jobs niet).
  const effectiefSessietype = migreesSessietype(effectiefSessietypeRuw);
  if (!effectiefSessietype) {
    throw new Error(
      `genereerSessieDag: onbekend sessietype "${effectiefSessietypeRuw}" voor ${datum} — niet in GELDIGE_SESSIETYPES en geen SESSIETYPE_MIGRATIE-entry.`
    );
  }

  const archetypesVoorType = await getArchetypesVoorSessietypeRaw(effectiefSessietype, kv);
  const archetypes = getArchetypesVoorSessietype(archetypesVoorType, huidigeFase, weekInFase, plan?.seizoensdoel?.type ?? null, Math.round(uren * 60), weektype);
  if (archetypes.length === 0) {
    logEvent("archetype_niet_gevonden", userId, { sessietype: effectiefSessietype, fase: huidigeFase, weekInFase });
    const err = new Error(
      `genereerSessieDag: geen archetypes beschikbaar voor sessietype "${effectiefSessietype}" (fase "${huidigeFase}", week ${weekInFase}, ${uren}u beschikbaar) op ${datum} — mogelijk vereisen alle kandidaten meer tijd dan beschikbaar (min_duur_min).`
    );
    err._observabilityLogged = true;
    throw err;
  }

  const recenteArchetypes = await getRecenteArchetypes(kv, userId, effectiefSessietype);
  // getArchetypesVoorSessietype() filtert al vanuit KV-data waarin metadata en
  // varianten/blokken samengevoegd zijn (zie migratiescript) — gekozenArchetype
  // draagt dus al .varianten, geen aparte vindArchetypeMetVarianten-lookup nodig.
  const gekozenArchetype = selecteerArchetype(archetypes, recenteArchetypes);

  if (!gekozenArchetype?.varianten?.length) {
    logEvent("archetype_niet_gevonden", userId, { sessietype: effectiefSessietype, fase: huidigeFase, weekInFase });
    const err = new Error(
      `genereerSessieDag: geen variantendata voor archetype "${gekozenArchetype?.id}" (sessietype "${effectiefSessietype}") op ${datum} — elk bekend archetype hoort variantendata te hebben (KV: archetypes:${effectiefSessietype}).`
    );
    err._observabilityLogged = true;
    throw err;
  }

  const tsb = wellness ? Math.round((wellness.ctl ?? 0) - (wellness.atl ?? 0)) : 0;
  const hrvZone = hrvProfiel ? bepaalHrvZone(wellness?.hrv, hrvProfiel) : "onbekend";
  const rpeTrend = (await kv.get(`rpe_trend:${userId}`)) ?? 0;
  // B6: meerdere-weken-trendsignalen (structureel, niet de acute 14-dagen-
  // check uit hrv/trend.js) — puntenreeksen zijn al KV-lezingen, geen nieuwe
  // intervals.icu-call.
  const hrvTrendPunten = userId ? await haalHrvTrendOp(kv, userId) : [];
  const rhrTrendPunten = userId ? await haalRhrTrendOp(kv, userId) : [];
  const hrvTrendTrigger = bepaalHrvTrendTrigger(hrvTrendPunten);
  const rhrTrendTrigger = bepaalRhrTrendTrigger(rhrTrendPunten);

  // B2: acute per-sessie-hersteltijd. haalLaatsteZwareSessieDatum is een
  // gratis, verse plan-scan (geen IO) — dus altijd actueel, in tegenstelling
  // tot de wekelijkse hrv-profiel-herberekening in cron/sync. Een verse,
  // extra /wellness-call wordt ALLEEN gedaan als er daadwerkelijk een zware
  // sessie binnen het hersteltijd-plafond ligt — op de meeste dagen (geen
  // recente zware sessie) kost dit dus niets, i.p.v. een call op elke
  // genereerSessieDag-aanroep.
  let herstelsnelheidTrigger = false;
  if (userId && plan) {
    const zwareSessieDatum = haalLaatsteZwareSessieDatum(plan);
    if (zwareSessieDatum) {
      const dagenGeleden = Math.floor((new Date() - new Date(zwareSessieDatum)) / 86400000);
      if (dagenGeleden <= HERSTEL_PLAFOND_DAGEN) {
        try {
          const creds = await getIntervalsCredentials(userId);
          if (creds) {
            const veertienDagenVoorSessie = new Date(zwareSessieDatum);
            veertienDagenVoorSessie.setDate(veertienDagenVoorSessie.getDate() - 14);
            const wellnessData = await intervalsGet("/wellness", {
              oldest: datumISO(veertienDagenVoorSessie), newest: datumOffset(0),
            }, creds);
            const schoneReferentie = berekenSchoneReferentie(
              (wellnessData || []).map(w => ({ ...w, datum: w.id || w.datum })),
              zwareSessieDatum
            );
            const zwareSessie = plan.weekSessies.sessies.find(s => s.datum === zwareSessieDatum);
            herstelsnelheidTrigger = bepaalHerstelsnelheidTrigger({
              zwareSessieDatum,
              huidigeHrv: wellness?.hrv ?? null,
              schoneReferentie,
              sessietype: zwareSessie?.intentie?.sessietype,
              hrvProfiel,
            });
          }
        } catch (e) {
          console.warn(`[genereerSessieDag] ${datum}: herstelsnelheid-check mislukt (fail-open):`, e.message);
        }
      }
    }
  }

  const dagvorm = { tsb, hrv: hrvZone, rpeDeltaTrend: rpeTrend, hrvTrendTrigger, rhrTrendTrigger, herstelsnelheidTrigger };

  const { variant, doelGewicht } = await selecteerVariantOpDagvorm(kv, gekozenArchetype, userId, dagvorm);

  // Dagbudget (tss_doel) altijd vers herberekenen op basis van de daadwerkelijk
  // beschikbare tijd NU, i.p.v. blind dagIntentie.tss_doel te vertrouwen — dat
  // kan een verouderde waarde zijn (bv. bij regeneratie na een beschikbaarheids-
  // wijziging, waar de oude sessie/intentie van vóór de wijziging wordt
  // hergebruikt om alleen het sessietype over te nemen). sessietype (welke
  // stimulus) blijft wél uit dagIntentie komen — dat is een bewuste
  // planningskeuze (solveWeek()), geen tijdsafhankelijk gegeven.
  const { gedegradeerd } = degradeerBijLageTsb(effectiefSessietype, tsb);
  if (gedegradeerd && userId) {
    maakMelding(userId, "tsb_degradatie", { datum, dagLabel: dagNaam, tsb }).catch(
      (e) => console.warn(`[genereerSessieDag] ${datum}: melding-aanmaak (tsb_degradatie) mislukt:`, e.message)
    );
  }
  // Compliance-freeze (C3/C4/C5): gedeelde leesfunctie met
  // weekSessiesDeterministisch.js (solveWeek) — zie compliance.js voor de
  // volledige toelichting (fail-open, record.actief-gegateerd).
  const bevrorenWeekInFase = await haalBevrorenWeekInFase(kv, userId, plan);

  let tssDoelVers = schatTssDoel(
    { [effectiefSessietype]: archetypesVoorType },
    effectiefSessietype,
    huidigeFase,
    weekInFase,
    plan?.seizoensdoel?.type ?? null,
    gedegradeerd,
    weektype,
    Math.round(uren * 60),
    bevrorenWeekInFase
  );

  // Clamp op het resterende weekbudget — alleen als de caller dat kent
  // (weekTssDoel/alGeleverdTss). Callers die zelf al budget-bewust zijn (bv.
  // sessiesAanvullen.js/solveWeek()) geven deze niet mee en behouden exact het
  // bestaande gedrag. Zonder deze clamp negeert schatTssDoel() volledig hoeveel
  // TSS deze week al geleverd is — precies het gat dat een hersteldweek met
  // overschreden budget alsnog een volle sessie liet plannen.
  if (weekTssDoel != null && alGeleverdTss != null) {
    const restBudget = Math.max(0, weekTssDoel - alGeleverdTss);
    tssDoelVers = Math.min(tssDoelVers, restBudget);
    if (tssDoelVers < MINIMALE_ZINVOLLE_TSS) {
      console.log(`[genereerSessieDag] ${datum}: resterend weekbudget te klein (${restBudget} TSS) — geen sessie gegenereerd`);
      return { _geenSessie: true, reden: "weekbudget_uitgeput" };
    }
  }

  const dagIntentieVers = dagIntentie ? { ...dagIntentie, tss_doel: tssDoelVers } : dagIntentie;

  const volleDuurMin = rondDuurMinAf(uren * 60);
  const gecapteDoelDuurMin = rondDuurMinAf(effectieveDuurMin(effectiefSessietype, Math.round(uren * 60), weekInFase, weektype, bevrorenWeekInFase));

  // D5: CP/W'-kalibratie (wbalSimulatie.js) — alleen opgehaald voor de
  // sessietypes waar het daadwerkelijk toegepast wordt, om onnodige KV-reads
  // te vermijden op elke andere generatie. Fail-open: geen/onvolledige
  // CP/W'-data (D4, cpWprime.js) -> cpWprime blijft null, genereerSessieDeterministisch
  // valt terug op de archetype-standaardduur, geen crash.
  let cpWprime = null;
  let wbalDrempels = null;
  if (WBAL_KALIBRATIE_SESSIETYPES.has(effectiefSessietype)) {
    const cpWprimePunten = await haalCpWprimeTrendOp(kv, userId);
    const laatste = cpWprimePunten[cpWprimePunten.length - 1];
    if (laatste?.criticalPower != null && laatste?.wPrime != null) {
      cpWprime = { criticalPower: laatste.criticalPower, wPrime: laatste.wPrime };
      wbalDrempels = await haalWbalDrempels(kv);
    }
  }

  const sessie = genereerSessieDeterministisch({
    dagIntentie: dagIntentieVers,
    archetype: gekozenArchetype,
    variant,
    doelDuurMin: gecapteDoelDuurMin,
    ftp: profiel.ftp,
    sessietype: effectiefSessietype,
    cpWprime,
    wbalDrempels,
  });
  sessie.datum = datum;
  sessie.dag = dagNaam;
  sessie.variant_gewicht = doelGewicht;
  sessie.dagvorm_tsb = dagvorm.tsb;
  sessie.dagvorm_hrv = dagvorm.hrv;
  // B5: gewicht 1 (tsb/hrv-rood/hrvTrendTrigger/rhrTrendTrigger/
  // herstelsnelheidTrigger, gezamenlijk — geen onderscheid nodig) betekent al
  // een lichtere uitvoering van dit sessietype; beschermt deze dag tegen een
  // latere herschikkingspoging die 'm als doelwit zou kiezen.
  if (doelGewicht === 1) sessie.beschermd_herschikking = true;

  console.log(`Deterministisch: ${datum} ${effectiefSessietype}/${gekozenArchetype.id}/${variant.id} gewicht=${doelGewicht} TSS=${sessie.tss} in ${sessie.generatie_ms}ms`);

  await slaArchetypeOp(kv, userId, effectiefSessietype, gekozenArchetype.id);

  // Gemeenschappelijke nabewerking
  normaliseerSessieSegmenten(sessie);
  voegVerwachtRpeToe(sessie);
  corrigeerSessieTss(sessie);

  // Kracht-gate kijkt standaard naar dezelfde overigeSessies als de generatie, maar
  // accepteert desgewenst een bredere (ongefilterde) lijst — voltooide
  // kracht_lage_cadans-sessies moeten óók meetellen voor de rollend-7-dagenrestrictie.
  const krachtCheck = valideerKrachtRestrictie(sessie, ctx.alleSessiesVoorKrachtCheck ?? overigeSessies);
  if (!krachtCheck.geldig) {
    console.warn(`[genereerSessieDag] ${userId} ${datum}: kracht geblokkeerd — ${krachtCheck.reden} → z2_duur`);
    sessie.type = "duur_variabel";
    sessie.titel = "Z2 Duur — Kracht geblokkeerd";
    if (sessie.intentie) {
      sessie.intentie.sessietype = "z2_duur";
      sessie.intentie.rol = "aerobe_dag";
      sessie.intentie.toegestane_zones = ["Z2"];
    }
    sessie.duur_min = rondDuurMinAf(uren * 60);
    sessie.segmenten = [{
      zone: "Z2", positie: "midden", blokDuurSeconden: sessie.duur_min * 60,
      isSpecifiek: false, sessietype: "z2_duur",
    }];
    corrigeerSessieTss(sessie);
  }

  // Onafhankelijk van corrigeerSessieTss() hierboven (generiek IF-bereik per
  // sessietype): toetst of de daadwerkelijke TSS niet losraakt van het
  // specifieke dagbudget (tss_doel) dat solveWeek()/schatTssDoel() voor déze
  // dag berekende — bv. een archetype met een op zich normale TSS-range dat
  // in een herstelweek toch ver boven zijn dagbudget uitkomt.
  corrigeerSessieTssTovDagbudget(sessie);

  // Sessietypes met een eigen effectieve-urenplafond (SESSIETYPE_MAX_EFFECTIEVE_UREN
  // in weekSolver.js, bv. kracht_lage_cadans: 1,5u) laten anders onbenutte
  // beschikbare tijd liggen zodra dat plafond lager ligt dan wat er daadwerkelijk
  // beschikbaar is — bv. 1,5u kracht terwijl er 2,5u beschikbaar is. Die rest
  // wordt hier als los Z2-duurblok aangeplakt i.p.v. weggegooid. Alleen als de
  // sessie zijn oorspronkelijke sessietype nog heeft (de kracht-gate hierboven
  // kan 'm al naar een volledige-duur z2_duur-sessie hebben omgezet, die al de
  // volle tijd gebruikt) en als er nog weekbudget over is voor de toevoeging.
  if (krachtCheck.geldig && volleDuurMin > gecapteDoelDuurMin) {
    let verlengingMin = volleDuurMin - gecapteDoelDuurMin;
    if (weekTssDoel != null && alGeleverdTss != null) {
      const resterendBudget = Math.max(0, weekTssDoel - alGeleverdTss - sessie.tss);
      const maxVerlengingMin = Math.round((resterendBudget / (Z2_IF_MIDDEN * Z2_IF_MIDDEN * 100)) * 60);
      verlengingMin = Math.min(verlengingMin, maxVerlengingMin);
    }
    if (verlengingMin >= MINIMALE_ZINVOLLE_VERLENGING_MIN) {
      voegZ2VerlengingToe(sessie, profiel.ftp, verlengingMin);
      normaliseerSessieSegmenten(sessie);
      voegVerwachtRpeToe(sessie);
      corrigeerSessieTss(sessie);
      console.log(`[genereerSessieDag] ${datum}: Z2-verlenging +${verlengingMin}min (plafond ${effectiefSessietype} was ${gecapteDoelDuurMin}min, ${volleDuurMin}min beschikbaar)`);
    }
  }

  // Z1-validatie: was voorheen alleen een losse, na-de-feit-check in
  // sessiesAanvullen.js (en dus afwezig voor /api/jobs sessieDag en de
  // admin-regeneratieroutes) — hier centraal zodat élke aanroeper van
  // genereerSessieDag() dezelfde garantie krijgt. Een geschonden Z1-restrictie
  // wijst op een content-fout in de archetype-data zelf (zie
  // Z1_TOEGESTANE_SESSIETYPES in sessie-archetypes.js), niet op iets dat
  // runtime gecorrigeerd kan worden — vandaar hard falen i.p.v. auto-fixen.
  if (!valideerZ1Gebruik(sessie.segmenten, sessie.intentie?.sessietype ?? sessie.type, sessie.archetype_id ?? null)) {
    logEvent("z1_validatie_fout", userId, {
      sessietype: sessie.intentie?.sessietype ?? sessie.type,
      archetype_id: sessie.archetype_id ?? null,
      blok: (sessie.segmenten || []).find(b => b.zone === "Z1") ?? null,
    });
    throw new Error(`genereerSessieDag: Z1-validatie mislukt voor sessietype ${sessie.intentie?.sessietype ?? sessie.type} op ${datum}`);
  }

  if (uren) {
    capSessieDuur(sessie, rondDuurMinAf(uren * 60), `genereerSessieDag ${datum}`, userId);
  }

  return sessie;
}

/**
 * Logt sessie_gegenereerd — bewust NIET binnen genereerSessieDag() zelf, want
 * niet elke aanroeper houdt het resultaat: sessiesAanvullen.js gooit sessies
 * korter dan 60min na generatie alsnog weg. Callers loggen dus pas op het punt
 * waar de sessie daadwerkelijk behouden/opgeslagen wordt.
 */
export function logSessieGegenereerd(sessie, { userId, huidigeFase, weekInFase }) {
  logEvent("sessie_gegenereerd", userId, {
    sessietype: sessie.intentie?.sessietype ?? sessie.type ?? null,
    archetype_id: sessie.archetype_id ?? null,
    variant_id: sessie.variant_id ?? null,
    fase: huidigeFase,
    weekInFase,
    duur_min: sessie.duur_min,
    tss_doel: sessie.tss,
    gegenereerd_door: "deterministisch",
  });
}
