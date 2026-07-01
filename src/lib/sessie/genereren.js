// Centrale sessiedag-generator (sectie 46): deterministisch waar mogelijk
// (bekend sessietype + variantendata beschikbaar), anders via Claude.
// Gedeeld door alle drie de aanroeppaden: sessiesAanvullen-cron,
// admin-regeneratie (regenereer-toekomstige-sessies), en /api/jobs (sessieDag).
//
// Het deterministische pad kan alleen kiezen wanneer het sessietype al bekend
// is vóór generatie (regeneratie van een bestaande dag-intentie). Voor een
// gloednieuwe dag zonder vooraf bepaalde intentie beslist Claude zelf welk
// sessietype het wordt — dat blijft ongewijzigd.

import { bouwSessieDagPrompt } from "../promptBuilder";
import { claudeCall } from "../claude";
import { normaliseerSessieSegmenten, valideerKrachtRestrictie } from "./normaliseer";
import { voegVerwachtRpeToe } from "./rpe";
import { corrigeerSessieTss } from "./tssValidatie";
import { capSessieDuur } from "./duurCap";
import { berekenBlok, bouwZonesUitProfiel } from "../vermogensbereik";
import {
  getArchetypesVoorSessietype,
  getRecenteArchetypes,
  selecteerArchetype,
  slaArchetypeOp,
  migreesSessietype,
} from "../sessie-archetypes";
import { vindArchetypeMetVarianten, selecteerVariantOpDagvorm, genereerSessieDeterministisch } from "../sessie-generatie";
import { bepaalHrvZone } from "../hrv/zone";

function bouwArchetypeHint(effectiefSessietype, archetypes, recenteArchetypes) {
  const isGemengd = effectiefSessietype === "gemengd";
  const sessieVariatieBlok = JSON.stringify({
    beschikbare_archetypes: archetypes,
    recente_archetypes: recenteArchetypes,
    rotatie_instructie: isGemengd
      ? "Dit is een vrijheidsessie (gemengd). Kies een archetype dat NIET gelijk is aan recente_archetypes[0]. Maak de beschrijving motiverend en energiek — dit is de leukste training van de week. Geef gekozen_archetype_id terug als apart veld in je JSON-output."
      : "Kies een archetype dat NIET gelijk is aan recente_archetypes[0]. Geef sterke voorkeur aan archetypes die niet in recente_archetypes staan. Schaal blokduur proportioneel naar beschikbare sessieduur. Geef gekozen_archetype_id terug als apart veld in je JSON-output.",
  }, null, 2);
  return `\n\nSESSIEVARIATIE — VERPLICHT\n\nJe ontvangt beschikbare_archetypes voor het gevraagde sessietype.\nKies exact één archetype. Regels:\n1. Kies NOOIT hetzelfde archetype als recente_archetypes[0]\n2. Geef sterke voorkeur aan archetypes die niet in recente_archetypes staan\n3. Schaal blokduur proportioneel naar beschikbare sessieduur — verander niet de blokverhouding (bv. 3:1 werk/herstel blijft 3:1)\n4. Geef gekozen_archetype_id terug als apart veld in je JSON-output\n\nTRAININGEN ZIJN LEUK EN AFWISSELEND:\nElke sessie heeft een herkenbare structuur — een progressie, een ritme of een spel.\nGeen rechte lijnen. Gebruik de archetypestructuur als basis.\n\nZ1-ZONE REGEL — HARDE CONSTRAINT:\nZ1 is verboden behalve in: sprint_neuraal, z6_anaeroob, kracht_lage_cadans.\nGebruik Z2 als minimumzone voor opwarming, cooling-down en herstelblokken\nin alle andere sessietypes.\n\n${sessieVariatieBlok}`;
}

/**
 * Genereert één sessiedag.
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
 * @param {Array} [ctx.dagelijkseData]
 * @param {object|null} [ctx.voortgang]
 * @param {string} [ctx.aanleiding]
 * @param {string} [ctx.promptExtra] - extra tekst voor de Claude-prompt (bv. volumecorrectie-instructies)
 * @param {string|null} [ctx.effectiefSessietype] - override; anders oudeSessie?.intentie?.sessietype
 * @param {string} [ctx.huidigeFase]
 * @param {number} [ctx.weekInFase]
 * @param {object|null} [ctx.hrvProfiel] - voor bepaalHrvZone; null -> hrv 'onbekend'
 * @param {number} [ctx.piekSprint]
 * @returns {Promise<object>} de gegenereerde sessie
 */
export async function genereerSessieDag(ctx) {
  const {
    kv, userId, datum, dagNaam, uren, profiel, wellness, plan,
    oudeSessie = null, overigeSessies = [], dagelijkseData = [], voortgang = null,
    aanleiding = "beschikbaarheid_nieuw", promptExtra = "",
    huidigeFase = "basis", weekInFase = 1, hrvProfiel = null, piekSprint = null,
  } = ctx;

  const dagIntentie = oudeSessie?.intentie || null;
  const effectiefSessietype = ctx.effectiefSessietype !== undefined
    ? ctx.effectiefSessietype
    : (dagIntentie?.sessietype ?? null);

  let gekozenArchetypeId = null;
  let archetypeHintExtra = "";
  let sessie;

  // 1. Probeer archetype-selectie (rotatielogica) als het sessietype al bekend is
  if (effectiefSessietype) {
    const archetypes = getArchetypesVoorSessietype(effectiefSessietype, huidigeFase, weekInFase, plan?.seizoensdoel?.type ?? null);
    if (archetypes.length > 0) {
      const recenteArchetypes = await getRecenteArchetypes(kv, userId, effectiefSessietype);
      const gekozenArchetype = selecteerArchetype(archetypes, recenteArchetypes);
      const archetypeMetVarianten = gekozenArchetype ? vindArchetypeMetVarianten(effectiefSessietype, gekozenArchetype.id) : null;

      if (archetypeMetVarianten?.varianten?.length > 0) {
        // 2. Deterministisch pad
        const tsb = wellness ? Math.round((wellness.ctl ?? 0) - (wellness.atl ?? 0)) : 0;
        const hrvZone = hrvProfiel ? bepaalHrvZone(wellness?.hrv, hrvProfiel) : "onbekend";
        const rpeTrend = (await kv.get(`rpe_trend:${userId}`)) ?? 0;
        const dagvorm = { tsb, hrv: hrvZone, rpeDeltaTrend: rpeTrend };

        const { variant, doelGewicht } = await selecteerVariantOpDagvorm(kv, archetypeMetVarianten, userId, dagvorm);

        sessie = genereerSessieDeterministisch({
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

        gekozenArchetypeId = gekozenArchetype.id;
        console.log(`Deterministisch: ${datum} ${effectiefSessietype}/${gekozenArchetype.id}/${variant.id} gewicht=${doelGewicht} TSS=${sessie.tss} in ${sessie.generatie_ms}ms`);
      } else {
        // Geen variantendata voor dit archetype (bv. z2_heuvel) — val terug op
        // Claude, met dezelfde archetype-hint als voorheen.
        archetypeHintExtra = bouwArchetypeHint(effectiefSessietype, archetypes, recenteArchetypes);
      }
    }
  }

  // 3. Fallback: Claude
  if (!sessie) {
    const promptData = bouwSessieDagPrompt({
      profiel, wellness, dagelijkseData, voortgang,
      seizoensplan: { ...plan, weekSessies: undefined },
      overigeSessies, datum, dagNaam, uren, oudeSessie, aanleiding,
    });
    promptData.prompt += promptExtra + archetypeHintExtra;

    const raw = await claudeCall(promptData);
    sessie = raw.sessie || raw.sessies?.[0] || raw;
    if (!sessie.datum) sessie.datum = datum;
    if (!sessie.dag) sessie.dag = dagNaam;

    const gegevenType = sessie.intentie?.sessietype || sessie.sessietype;
    if (gegevenType) {
      const gemigreerd = migreesSessietype(gegevenType);
      if (gemigreerd !== gegevenType) {
        const vervangen = gemigreerd ?? "z2_duur";
        console.warn(`[genereerSessieDag] Onverwacht sessietype "${gegevenType}" → "${vervangen}" op ${datum}`);
        if (sessie.intentie) sessie.intentie.sessietype = vervangen;
      }
    }

    gekozenArchetypeId = raw.gekozen_archetype_id ?? sessie.gekozen_archetype_id ?? null;
    if (!gekozenArchetypeId && effectiefSessietype && archetypeHintExtra) {
      console.warn(`[genereerSessieDag] gekozen_archetype_id ontbreekt voor ${effectiefSessietype} op ${datum}`);
    }
    sessie.archetype_id = gekozenArchetypeId;
  }

  if (gekozenArchetypeId && effectiefSessietype) {
    await slaArchetypeOp(kv, userId, effectiefSessietype, gekozenArchetypeId);
  }

  // 4. Gemeenschappelijke nabewerking — zelfde voor Claude- en deterministisch pad
  normaliseerSessieSegmenten(sessie);
  voegVerwachtRpeToe(sessie);
  corrigeerSessieTss(sessie);

  // Kracht-gate kijkt standaard naar dezelfde overigeSessies als de prompt, maar
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
    capSessieDuur(sessie, Math.round(uren * 60), `genereerSessieDag ${datum}`);
  }

  // Deterministische segmenten hebben vermogenMin/vermogenMax al exact uit pct_ftp
  // berekend (zie sessie-generatie.js) — berekenBlok() zou dat overschrijven met de
  // grovere zone+positie-schatting, dus alleen toepassen op Claude-gegenereerde segmenten.
  if (sessie.gegenereerd_door !== "deterministisch" && profiel.power_zones && profiel.ftp) {
    try {
      const zones = bouwZonesUitProfiel(profiel.ftp, profiel.power_zones);
      const piek = piekSprint || Math.round(profiel.ftp * 1.8);
      const sessietype = sessie.intentie?.sessietype || sessie.sessietype || sessie.type;
      sessie.segmenten = (sessie.segmenten || []).map(seg => seg.zone ? berekenBlok(seg, zones, profiel.ftp, piek, sessietype) : seg);
    } catch (e) {
      console.warn(`[genereerSessieDag] Vermogensbereik mislukt voor ${datum}:`, e.message);
    }
  }

  return sessie;
}
