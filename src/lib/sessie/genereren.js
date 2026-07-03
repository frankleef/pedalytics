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
import { corrigeerSessieTss } from "./tssValidatie";
import { capSessieDuur } from "./duurCap";
import {
  getArchetypesVoorSessietype,
  getArchetypesVoorSessietypeRaw,
  getRecenteArchetypes,
  selecteerArchetype,
  slaArchetypeOp,
} from "../sessie-archetypes";
import { selecteerVariantOpDagvorm, genereerSessieDeterministisch } from "../sessie-generatie";
import { bepaalHrvZone } from "../hrv/zone";
import { logEvent } from "../posthog";

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
 * @param {object|null} [ctx.hrvProfiel] - voor bepaalHrvZone; null -> hrv 'onbekend'
 * @param {number} [ctx.piekSprint]
 * @returns {Promise<object>} de gegenereerde sessie
 * @throws {Error} als er geen sessietype bekend is, of geen archetype/variantendata
 *   voor het gevraagde sessietype bestaat
 */
export async function genereerSessieDag(ctx) {
  const {
    kv, userId, datum, dagNaam, uren, profiel, wellness, plan,
    oudeSessie = null, overigeSessies = [],
    huidigeFase = "basis", weekInFase = 1, hrvProfiel = null,
  } = ctx;

  const dagIntentie = oudeSessie?.intentie || null;
  const effectiefSessietype = ctx.effectiefSessietype !== undefined
    ? ctx.effectiefSessietype
    : (dagIntentie?.sessietype ?? null);

  if (!effectiefSessietype) {
    throw new Error(
      `genereerSessieDag: geen sessietype bekend voor ${datum} — effectiefSessietype/oudeSessie.intentie.sessietype ontbreekt. Dit moet vooraf deterministisch bepaald zijn (bv. via solveWeek()); genereerSessieDag beslist dit zelf niet (geen Claude-fallback meer).`
    );
  }

  const archetypesVoorType = await getArchetypesVoorSessietypeRaw(effectiefSessietype, kv);
  const archetypes = getArchetypesVoorSessietype(archetypesVoorType, huidigeFase, weekInFase, plan?.seizoensdoel?.type ?? null, Math.round(uren * 60));
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
  const dagvorm = { tsb, hrv: hrvZone, rpeDeltaTrend: rpeTrend };

  const { variant, doelGewicht } = await selecteerVariantOpDagvorm(kv, gekozenArchetype, userId, dagvorm);

  const sessie = genereerSessieDeterministisch({
    dagIntentie,
    archetype: gekozenArchetype,
    variant,
    doelDuurMin: Math.round(uren * 60),
    ftp: profiel.ftp,
    sessietype: effectiefSessietype,
  });
  sessie.datum = datum;
  sessie.dag = dagNaam;
  sessie.variant_gewicht = doelGewicht;
  sessie.dagvorm_tsb = dagvorm.tsb;
  sessie.dagvorm_hrv = dagvorm.hrv;

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
    sessie.duur_min = Math.round(uren * 60);
    sessie.segmenten = [{
      zone: "Z2", positie: "midden", blokDuurSeconden: sessie.duur_min * 60,
      isSpecifiek: false, sessietype: "z2_duur",
    }];
    corrigeerSessieTss(sessie);
  }

  if (uren) {
    capSessieDuur(sessie, Math.round(uren * 60), `genereerSessieDag ${datum}`, userId);
  }

  logEvent("sessie_gegenereerd", userId, {
    sessietype: sessie.intentie?.sessietype ?? effectiefSessietype,
    archetype_id: gekozenArchetype.id,
    variant_id: variant.id,
    fase: huidigeFase,
    weekInFase,
    duur_min: sessie.duur_min,
    tss_doel: sessie.tss,
    gegenereerd_door: "deterministisch",
  });

  return sessie;
}
