// Vervangt checkImpact's Claude-gestuurde regeneratie (AppClient.js) door een
// deterministische detectie- en resolutiefunctie. checkImpact scande de hele week
// (vast + net gewijzigd) op twee conflicttypes en regenereerde de conflicterende dag
// via een volledige sessie-aanroep — dat routeerde na de eerdere genereerSessieDag()-
// fix al niet meer naar Claude (elke sessie in weekSessies.sessies draagt een
// intentie.sessietype), maar loste het conflict zelf nooit structureel op: een
// reroll van dezelfde dag/hetzelfde sessietype verandert niets aan 48u-nabijheid of
// weekbudget. Dit bestand bouwt de daadwerkelijke, deterministische resolutie:
// degraderen naar een lichtere variant (48u-conflict) of proportioneel korten
// (budget-conflict, hergebruikt pasBudgetToe's kortingslogica via een adapter).
//
// Puur, geen KV/fetch-afhankelijkheid — synchroon aanroepbaar vanuit de client
// (AppClient.js) zonder job-omweg.

import { vindArchetypeMetVarianten, genereerSessieDeterministisch } from "../sessie-generatie";
import { pasBudgetToe } from "./weekSolver";
import { rondSessieAf } from "./duurAfronding";

const ZWARE_TYPES = ["sweetspot", "interval", "drempel", "vo2max"];
const Z2_ACHTIGE_SESSIETYPES = new Set(["z2_duur", "kracht_lage_cadans"]);
const BUDGET_OVERSCHRIJDING_DREMPEL = 1.15;

/**
 * Detecteert conflicten in de lopende week — 1-op-1 dezelfde scanlogica als de
 * oude checkImpact: (a) twee "zware" sessies binnen 48u waarvan de laatste in
 * gewijzigdeDatums zit, (b) totale week-TSS > tss_doel * 1.15 (gewicht op de
 * zwaarste gewijzigde, niet-voltooide sessie).
 *
 * @param {Array} sessies - alle sessies van de lopende week (vast + gewijzigd)
 * @param {object} kaderWeek - { tss_doel }
 * @param {string[]} gewijzigdeDatums
 * @returns {{ conflictDatums: string[], budgetConflictDatum: string|null, weekTss: number, tssTarget: number }}
 */
export function detecteerWeekConflicten(sessies, kaderWeek, gewijzigdeDatums) {
  const tssTarget = kaderWeek?.tss_doel || 300;
  const zwareSessies = sessies.filter(s => ZWARE_TYPES.includes(s.type));
  const conflicten = new Set();

  for (const s of zwareSessies) {
    if (!s.datum) continue;
    const d = new Date(s.datum);
    for (const andere of zwareSessies) {
      if (andere === s || !andere.datum) continue;
      const verschilUren = Math.abs(d - new Date(andere.datum)) / 3600000;
      if (verschilUren > 0 && verschilUren < 48) {
        const later = s.datum > andere.datum ? s.datum : andere.datum;
        if (gewijzigdeDatums.includes(later)) conflicten.add(later);
      }
    }
  }

  const weekTss = sessies.reduce((s, sess) => s + (sess.tss || 0), 0);
  let budgetConflictDatum = null;
  if (weekTss > tssTarget * BUDGET_OVERSCHRIJDING_DREMPEL) {
    const laatstGepland = sessies
      .filter(s => !s.voltooid && gewijzigdeDatums.includes(s.datum))
      .sort((a, b) => (b.tss || 0) - (a.tss || 0))[0];
    if (laatstGepland) {
      conflicten.add(laatstGepland.datum);
      budgetConflictDatum = laatstGepland.datum;
    }
  }

  return { conflictDatums: [...conflicten], budgetConflictDatum, weekTss, tssTarget };
}

function kiesLichtsteVariant(archetype) {
  if (!archetype?.varianten?.length) return null;
  const minGewicht = Math.min(...archetype.varianten.map(v => v.zwaartegewicht ?? 2));
  return archetype.varianten.find(v => (v.zwaartegewicht ?? 2) === minGewicht) ?? archetype.varianten[0];
}

/**
 * Lost een 48u-conflict op door de sessie te degraderen naar de lichtste
 * beschikbare variant van hetzelfde archetype (zelfde sessietype/archetype_id,
 * zelfde duur — alleen de intensiteitsverdeling wordt lichter). Verandert het
 * sessietype zelf niet (blijft dus "zwaar" in de type-classificatie), maar
 * vermindert de opeenstapeling van belasting tussen de twee nabije dagen.
 *
 * Retourneert null als er geen archetype_id bekend is, het archetype niet
 * gevonden kan worden, of de sessie al de lichtste variant heeft — de caller
 * moet dit als "onopgelost conflict" behandelen (loggen, niet crashen).
 *
 * @param {Object<string, Array>} archetypesData - alle archetypes per sessietype
 *   (server: getAlleArchetypesRaw(); client: eenmalige GET /api/archetypes-fetch)
 * @param {object} sessie - bestaande sessie (moet .archetype_id, .intentie.sessietype hebben)
 * @param {number} ftp
 * @returns {object|null} nieuwe, lichtere sessie, of null als degraderen niet mogelijk is
 */
export function degradeerSessie(archetypesData, sessie, ftp) {
  const sessietype = sessie.intentie?.sessietype || sessie.type;
  if (!sessie.archetype_id || !sessietype) return null;

  const archetype = vindArchetypeMetVarianten(archetypesData?.[sessietype] ?? [], sessie.archetype_id);
  if (!archetype) return null;

  const lichtsteVariant = kiesLichtsteVariant(archetype);
  if (!lichtsteVariant || lichtsteVariant.id === sessie.variant_id) return null;

  const nieuw = genereerSessieDeterministisch({
    dagIntentie: sessie.intentie,
    archetype,
    variant: lichtsteVariant,
    doelDuurMin: sessie.duur_min,
    ftp,
    sessietype,
  });
  nieuw.datum = sessie.datum;
  nieuw.dag = sessie.dag;
  if (sessie.intervalsEventId) nieuw.intervalsEventId = sessie.intervalsEventId;
  return nieuw;
}

function kortSessieIn(sessie, nieuwDuurMin) {
  const huidigeSegmenten = sessie.segmenten || [];
  const huidigTotaalSec = huidigeSegmenten.reduce((s, seg) => s + (seg.blokDuurSeconden || 0), 0);
  const nieuwTotaalSec = Math.max(0, Math.round(nieuwDuurMin * 60));
  const ratio = huidigTotaalSec > 0 ? nieuwTotaalSec / huidigTotaalSec : 0;
  const geschaaldeSegmenten = huidigeSegmenten
    .map(seg => ({ ...seg, blokDuurSeconden: Math.round((seg.blokDuurSeconden || 0) * ratio) }))
    .filter(seg => seg.blokDuurSeconden > 0);
  const { segmenten, duur_min } = rondSessieAf(geschaaldeSegmenten);
  return { ...sessie, segmenten, duur_min };
}

/**
 * Lost een budget-conflict op: past dezelfde kortingsvolgorde toe als
 * pasBudgetToe() (weekSolver.js stap 6) — korte Z2-dagen eerst, langste rit
 * laatst, kernstimulus/secundair-dagen nooit op duur gekort — maar dan over
 * ALLE dagen van de week (vast + gewijzigd), niet alleen net-toegewezen dagen.
 * Hergebruikt pasBudgetToe() zelf via een lichte adapter (sessie -> toewijzing-
 * vorm en terug) i.p.v. de kortingslogica te dupliceren.
 *
 * @param {Array} sessies - alle sessies van de lopende week (vast + gewijzigd)
 * @param {number} tssTarget - kaderWeek.tss_doel
 * @returns {Array<{datum: string, actie: 'gekort'|'verwijderd'|'ongewijzigd', sessie: object|null}>}
 */
export function corrigeerWeekBudget(sessies, tssTarget) {
  const nietVoltooid = sessies.filter(s => !s.voltooid);
  const voltooid = sessies.filter(s => s.voltooid);
  const alGeleverdTss = voltooid.reduce((s, x) => s + (x.tss || 0), 0);

  const toewijzingen = nietVoltooid.map(s => {
    const sessietype = s.intentie?.sessietype || s.type;
    const pad = Z2_ACHTIGE_SESSIETYPES.has(sessietype) ? "z2" : "kernstimulus";
    return { datum: s.datum, sessietype, tss_doel: s.tss ?? 0, beschikbareUren: (s.duur_min ?? 0) / 60, pad };
  });

  const aangepast = pasBudgetToe(toewijzingen, tssTarget, alGeleverdTss, 0);

  const resultaten = [];
  for (const t of aangepast) {
    const origineel = nietVoltooid.find(s => s.datum === t.datum);
    if (!origineel) continue;

    if (t.sessietype === "rust") {
      resultaten.push({ datum: t.datum, actie: "verwijderd", sessie: null });
      continue;
    }
    const oudDuurMin = origineel.duur_min || 0;
    const nieuwDuurMin = Math.round(t.beschikbareUren * 60);
    if (nieuwDuurMin === oudDuurMin) {
      resultaten.push({ datum: t.datum, actie: "ongewijzigd", sessie: origineel });
      continue;
    }
    resultaten.push({ datum: t.datum, actie: "gekort", sessie: kortSessieIn(origineel, nieuwDuurMin) });
  }
  return resultaten;
}
