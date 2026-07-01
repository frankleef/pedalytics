// Weeksolver (sectie 48): deterministische invulling van open dagen in een week
// met sessietypes — vervangt waar mogelijk de lichte Claude-aanroep uit
// dagIntentie.js. Zie project-memory voor de scopebeslissing: chunks 1-5
// (deze module, zelfstandig) zijn nu gebouwd; de daadwerkelijke vervanging van
// bouwWeekSessiesPrompt/dagIntentie.js (chunk 6) is een aparte, latere opdracht.

import { vindArchetypeMetVarianten, bepaalDoelGewicht } from "../sessie-generatie";
import { getArchetypesVoorSessietype } from "../sessie-archetypes";
import { bepaalVrijheidsdag } from "../vrijheidsdag";

// Zelfde TSB-drempel als bepaalDoelGewicht() in sessie-generatie.js (gewicht 1
// als tsb < TSB_DEGRADATIE_DREMPEL) — één bron van waarheid voor "wanneer is
// dagvorm zo slecht dat we moeten degraderen", of dat nu op weekplan-niveau
// (hier) of op generatiemoment (selecteerVariantOpDagvorm) gebeurt.
const TSB_DEGRADATIE_DREMPEL = -20;

/**
 * Berekent het verwachte Z2-aandeel (fractie 0-1) van een archetype, op basis
 * van de concrete blokdefinities in sessie-varianten.js. Een blok telt mee als
 * "Z2-achtig" als het zone Z2 is, of een herstelblok is dat niet Z1 is (Z1 is
 * in dit systeem een aparte, beperkte categorie — zie Z1-restrictie elders).
 * Gemiddeld over alle varianten van het archetype (representatieve waarde,
 * onafhankelijk van welke variant later daadwerkelijk gekozen wordt).
 *
 * @param {string} sessietype
 * @param {string} archetypeId
 * @returns {number} fractie 0-1
 * @throws {Error} als het sessietype/archetype-id geen variantendata heeft
 */
export function berekenZ2AandeelSessietype(sessietype, archetypeId) {
  const archetype = vindArchetypeMetVarianten(sessietype, archetypeId);
  if (!archetype?.varianten?.length) {
    throw new Error(
      `berekenZ2AandeelSessietype: geen variantendata voor sessietype "${sessietype}" / archetype "${archetypeId}" — kan Z2-aandeel niet berekenen.`
    );
  }

  const isZ2Achtig = (blok) => blok.zone === "Z2" || (blok.type === "herstel" && blok.zone !== "Z1");

  const fractiesPerVariant = archetype.varianten.map((variant) => {
    let z2Som = 0;
    let totaal = 0;
    for (const blok of variant.blokken) {
      const gewicht = blok.duur_pct * (blok.reps ?? 1);
      totaal += gewicht;
      if (isZ2Achtig(blok)) z2Som += gewicht;
    }
    return totaal > 0 ? z2Som / totaal : 0;
  });

  return fractiesPerVariant.reduce((s, f) => s + f, 0) / fractiesPerVariant.length;
}

/**
 * Kernstimulus/secundair/eerst-laten-vallen-indeling per seizoensdoel × fase.
 * Vastgesteld beleid — niet wijzigen tijdens implementatie.
 *
 * 'sprint' als seizoensdoel bestaat (zie doel_beperking in sessie-archetypes.js)
 * maar heeft bewust nog geen entry hier — haalPrioriteitOp() gooit een expliciete
 * fout voor 'sprint' in plaats van stilzwijgend op ftp terug te vallen, in
 * afwachting van een echte sprint-indeling.
 *
 * kracht_lage_cadans telt NIET mee als eigen intensiteitsslot — behandel het
 * overal in deze module als variant van z2_duur (zie chunk 4/5).
 */
export const PRIORITEIT_PER_FASE = {
  ftp: {
    basis:      { kernstimulus: null,                                          secundair: null,                    eerstLatenVallen: [] },
    sweetspot:  { kernstimulus: ['sweetspot_intervallen', 'drempel_intervallen'], secundair: 'vo2max_intervallen', eerstLatenVallen: ['sprint_neuraal', 'gemengd'] },
    vo2max:     { kernstimulus: ['vo2max_intervallen'],                        secundair: 'sweetspot_intervallen', eerstLatenVallen: ['sprint_neuraal', 'gemengd'] },
    herstel:    { kernstimulus: null,                                          secundair: null,                    eerstLatenVallen: [] },
  },
  klimmen: {
    basis:      { kernstimulus: null,                                          secundair: null,                    eerstLatenVallen: [] },
    sweetspot:  { kernstimulus: ['sweetspot_intervallen'],                     secundair: 'drempel_intervallen',   eerstLatenVallen: ['sprint_neuraal', 'gemengd'] },
    vo2max:     { kernstimulus: ['vo2max_intervallen'],                        secundair: 'sprint_neuraal',        eerstLatenVallen: ['gemengd'] },
    herstel:    { kernstimulus: null,                                          secundair: null,                    eerstLatenVallen: [] },
  },
};

/**
 * Haalt de prioriteit-entry op voor een seizoensdoel × fase.
 * Gooit een expliciete fout bij een onbekende combinatie (bv. 'sprint') —
 * geen stille fallback, zodat een ontbrekende beleidsbeslissing zichtbaar blijft.
 */
export function haalPrioriteitOp(seizoensdoel, fase) {
  const tabel = PRIORITEIT_PER_FASE[seizoensdoel];
  if (!tabel) {
    throw new Error(
      `haalPrioriteitOp: geen prioriteitstabel voor seizoensdoel "${seizoensdoel}" — nog niet gedefinieerd in PRIORITEIT_PER_FASE.`
    );
  }
  const entry = tabel[fase];
  if (!entry) {
    throw new Error(
      `haalPrioriteitOp: geen prioriteit-entry voor fase "${fase}" binnen seizoensdoel "${seizoensdoel}".`
    );
  }
  return entry;
}

/**
 * Degradeert een kandidaat-sessietype bij lage TSB op weekplan-niveau.
 * Hergebruikt bepaalDoelGewicht() (hetzelfde mechanisme als de dagvorm-
 * gestuurde variantselectie bij generatie) i.p.v. een parallelle TSB-check te
 * bouwen — drempel -20, gelijk aan sessie-generatie.js. Het sessietype zelf
 * verandert nooit; alleen de vlag `gedegradeerd` wordt gezet, als signaal dat
 * de generator later (op basis van de dan actuele dagvorm) een lichte variant
 * zal kiezen.
 *
 * @param {string} sessietype
 * @param {number|null|undefined} tsb - null/undefined bij ontbrekende historie
 * @param {{tsbOndergrens?: number}} [drempels] - optionele override, anders
 *   dezelfde drempel als bepaalDoelGewicht()
 * @returns {{ sessietype: string, gedegradeerd: boolean }}
 */
export function degradeerBijLageTsb(sessietype, tsb, drempels = {}) {
  if (tsb == null) {
    return { sessietype, gedegradeerd: false };
  }
  const ondergrens = drempels.tsbOndergrens ?? TSB_DEGRADATIE_DREMPEL;
  const gedegradeerd = drempels.tsbOndergrens != null
    ? tsb < ondergrens
    : bepaalDoelGewicht({ tsb }) === 1;
  return { sessietype, gedegradeerd };
}

// Indicatieve toegestane_zones per sessietype — een redelijk startpunt voor
// downstream weergave/validatie, niet autoritatief. De daadwerkelijke zones
// volgen uit de blokdata zodra genereerSessieDag de sessie echt genereert.
const TOEGESTANE_ZONES_PER_SESSIETYPE = {
  z2_duur: ["Z2"],
  sweetspot_intervallen: ["Z2", "Z3", "Z4"],
  drempel_intervallen: ["Z2", "Z4"],
  vo2max_intervallen: ["Z2", "Z5"],
  kracht_lage_cadans: ["Z2", "Z3"],
  sprint_neuraal: ["Z1", "Z2", "Z7"],
  z6_anaeroob: ["Z1", "Z2", "Z6"],
  gemengd: ["Z2", "Z3", "Z4", "Z5", "Z7"],
};

function zijnAangrenzend(datumA, datumB) {
  const diff = Math.abs(new Date(datumA).getTime() - new Date(datumB).getTime());
  return diff === 86400000;
}

/** Eerste beschikbare archetype-id voor een sessietype/fase/week, of null. */
function bepaalArchetypeHint(sessietype, fase, weekInFase, seizoensdoel) {
  const archetypes = getArchetypesVoorSessietype(sessietype, fase, weekInFase, seizoensdoel);
  return archetypes[0]?.id ?? null;
}

/** Midden van de tss_range van het eerste beschikbare archetype, of een vaste fallback. */
function schatTssDoel(sessietype, fase, weekInFase, seizoensdoel, gedegradeerd) {
  const archetypes = getArchetypesVoorSessietype(sessietype, fase, weekInFase, seizoensdoel);
  const bereik = archetypes[0]?.tss_range;
  const basis = bereik ? Math.round((bereik[0] + bereik[1]) / 2) : 70;
  return gedegradeerd ? Math.round(basis * 0.85) : basis;
}

function bouwToewijzing({ datum, beschikbareUren }, sessietype, { fase, weekInFase, seizoensdoel, gedegradeerd = false, pad, tssDoelOverride }) {
  return {
    datum,
    sessietype,
    tss_doel: tssDoelOverride ?? schatTssDoel(sessietype, fase, weekInFase, seizoensdoel, gedegradeerd),
    toegestane_zones: TOEGESTANE_ZONES_PER_SESSIETYPE[sessietype] ?? ["Z2"],
    archetype_hint: bepaalArchetypeHint(sessietype, fase, weekInFase, seizoensdoel),
    gedegradeerd,
    pad, // observability: 'kernstimulus'|'secundair'|'vrijheidsessie'|'z2'
    beschikbareUren,
  };
}

/**
 * Vult de open dagen van een week met sessietypes — deterministisch, zonder
 * LLM-aanroep. Zie sectie 48. Budgetcorrectie (proportioneel korten/schrappen)
 * gebeurt niet hier maar in pasBudgetToe() (chunk 5) — deze functie wijst alleen
 * toe, op basis van prioriteit, TSB-degradatie, adjacency en vrijheidsdag.
 *
 * @param {object} ctx
 * @param {string} ctx.fase
 * @param {number} ctx.weekInFase
 * @param {string} ctx.weektype - 'opbouw'|'herstel'
 * @param {string} ctx.seizoensdoel - 'ftp'|'klimmen' (zie haalPrioriteitOp)
 * @param {number} ctx.weekTssDoel
 * @param {number} [ctx.belastingscap] - harde bovengrens; standaard gelijk aan weekTssDoel
 * @param {Array}  [ctx.vasteDagen] - [{ datum, sessietype, tss_doel, status }]
 * @param {Array}  ctx.openDagen - [{ datum, beschikbareUren }]
 * @param {{tss?: number, z2Minuten?: number, totaalMinuten?: number}} [ctx.alGeleverd]
 * @param {number|null} [ctx.tsb]
 * @returns {Array<{datum, sessietype, tss_doel, toegestane_zones, archetype_hint, gedegradeerd, pad}>}
 */
export function solveWeek({
  fase, weekInFase, weektype, seizoensdoel, weekTssDoel, belastingscap,
  vasteDagen = [], openDagen = [], alGeleverd = {}, tsb = null,
}) {
  const cap = belastingscap ?? weekTssDoel;
  const alGeleverdTss = alGeleverd.tss ?? 0;
  const prioriteit = haalPrioriteitOp(seizoensdoel, fase);

  const isHerstelAchtig = weektype === "herstel";
  const bestaandeSessietypesDezeWeek = new Set(vasteDagen.map(d => d.sessietype).filter(Boolean));

  const openDagenAflopend = [...openDagen].sort((a, b) => b.beschikbareUren - a.beschikbareUren);
  const gebruikt = new Set();
  const toewijzingen = [];
  let restBudget = cap - alGeleverdTss;
  let kernstimulusDatum = null;

  // Stap 2/3: kernstimulus — eerste kandidaat die deze week nog niet via een
  // vaste dag is geleverd (voorkomt bv. een tweede sweetspot-dag).
  if (!isHerstelAchtig && prioriteit.kernstimulus) {
    const kandidaten = Array.isArray(prioriteit.kernstimulus) ? prioriteit.kernstimulus : [prioriteit.kernstimulus];
    const kernstimulusType = kandidaten.find(t => !bestaandeSessietypesDezeWeek.has(t));
    const dag = openDagenAflopend.find(d => !gebruikt.has(d.datum));

    if (kernstimulusType && dag) {
      const { gedegradeerd } = degradeerBijLageTsb(kernstimulusType, tsb);
      const tssDoel = schatTssDoel(kernstimulusType, fase, weekInFase, seizoensdoel, gedegradeerd);
      if (tssDoel <= restBudget) {
        gebruikt.add(dag.datum);
        kernstimulusDatum = dag.datum;
        restBudget -= tssDoel;
        toewijzingen.push(bouwToewijzing(dag, kernstimulusType, { fase, weekInFase, seizoensdoel, gedegradeerd, pad: "kernstimulus", tssDoelOverride: tssDoel }));
      }
    }
  }

  // Stap 3/4: secundair — idem, plus adjacency-check t.o.v. de kernstimulusdag,
  // plus vrijheidsdag-uitzondering (week 3 van een intensieve fase -> 'gemengd').
  if (!isHerstelAchtig && prioriteit.secundair && !bestaandeSessietypesDezeWeek.has(prioriteit.secundair)) {
    let dag = openDagenAflopend.find(d => !gebruikt.has(d.datum));

    if (dag && kernstimulusDatum && zijnAangrenzend(kernstimulusDatum, dag.datum)) {
      const alternatief = openDagenAflopend.find(d => !gebruikt.has(d.datum) && d.datum !== dag.datum && !zijnAangrenzend(kernstimulusDatum, d.datum));
      if (alternatief) dag = alternatief; // anders: geen alternatief, adjacency toegestaan
    }

    if (dag) {
      const isVrijheid = bepaalVrijheidsdag({ weekInFase, dagRol: "tweede_intensiteit", fase });
      const secundairType = isVrijheid ? "gemengd" : prioriteit.secundair;
      const { gedegradeerd } = degradeerBijLageTsb(secundairType, tsb);
      const tssDoel = schatTssDoel(secundairType, fase, weekInFase, seizoensdoel, gedegradeerd);
      if (tssDoel <= restBudget) {
        gebruikt.add(dag.datum);
        restBudget -= tssDoel;
        toewijzingen.push(bouwToewijzing(dag, secundairType, { fase, weekInFase, seizoensdoel, gedegradeerd, pad: isVrijheid ? "vrijheidsessie" : "secundair", tssDoelOverride: tssDoel }));
      }
    }
  }

  // Stap 5: rest vullen met z2_duur, resterend budget proportioneel naar uren.
  const z2Dagen = openDagenAflopend.filter(d => !gebruikt.has(d.datum));
  const totaalUrenZ2 = z2Dagen.reduce((s, d) => s + d.beschikbareUren, 0);
  for (const dag of z2Dagen) {
    const aandeel = totaalUrenZ2 > 0 ? dag.beschikbareUren / totaalUrenZ2 : 0;
    const tssDoel = Math.max(0, Math.round(restBudget * aandeel));
    toewijzingen.push(bouwToewijzing(dag, "z2_duur", { fase, weekInFase, seizoensdoel, pad: "z2", tssDoelOverride: tssDoel }));
  }

  toewijzingen.sort((a, b) => a.datum.localeCompare(b.datum));
  return toewijzingen;
}

// Zelfde minimumduur-grens als sessiesAanvullen.js ("sessie te kort... overgeslagen").
const MINIMUM_SESSIE_MINUTEN = 60;

function schrapToewijzing(toewijzing) {
  toewijzing.sessietype = "rust";
  toewijzing.tss_doel = 0;
  toewijzing.beschikbareUren = 0;
  toewijzing.toegestane_zones = [];
  toewijzing.archetype_hint = null;
}

/**
 * Past het weekbudget toe op de output van solveWeek(): kort Z2-dagen
 * proportioneel als de week over het budget dreigt te gaan, met de langste
 * Z2-dag ("lange rit") als laatst gekort. Een Z2-dag die door korten onder de
 * minimumsessieduur (60 min, zie sessiesAanvullen.js) zou zakken wordt volledig
 * geschrapt (sessietype 'rust', geen intentie) i.p.v. uitgehold — het restant-
 * tekort wordt herverdeeld over de overgebleven Z2-dagen.
 *
 * Kernstimulus/secundair/vrijheidsessie-toewijzingen (pad !== 'z2') worden hier
 * nooit aangepast. Als die alleen al (samen met alGeleverdTss) het budget
 * overschrijden, is dat een inputfout uit solveWeek — wordt gelogd, niet
 * stilzwijgend overschreven.
 *
 * @param {Array} toewijzingen - output van solveWeek()
 * @param {number} belastingscap
 * @param {number} [alGeleverdTss]
 * @returns {Array} nieuwe array, zelfde vorm als toewijzingen
 */
export function pasBudgetToe(toewijzingen, belastingscap, alGeleverdTss = 0) {
  const nietZ2 = toewijzingen.filter(t => t.pad !== "z2");
  const nietZ2Tss = nietZ2.reduce((s, t) => s + (t.tss_doel ?? 0), 0);

  if (alGeleverdTss + nietZ2Tss > belastingscap) {
    console.warn(
      `[pasBudgetToe] kernstimulus/secundair (+ al geleverd) overschrijden het budget alleen al (${alGeleverdTss + nietZ2Tss} > ${belastingscap}) — zou niet moeten voorkomen na TSB-degradatie in solveWeek. Kernstimulus/secundair worden nooit aangepast; input controleren.`
    );
    return toewijzingen;
  }

  const z2 = toewijzingen.filter(t => t.pad === "z2").map(t => ({ ...t }));
  const beschikbaarVoorZ2 = belastingscap - alGeleverdTss - nietZ2Tss;
  const huidigeZ2Tss = () => z2.filter(t => t.sessietype !== "rust").reduce((s, t) => s + t.tss_doel, 0);

  if (huidigeZ2Tss() <= beschikbaarVoorZ2) {
    return toewijzingen;
  }

  // Itereer tot stabiel: schaal de kortbare dagen (alles behalve de langste
  // actieve rit) naar het resterende budget. Alles wat onder de minimumduur
  // zou zakken wordt volledig geschrapt, waarna opnieuw verdeeld wordt over
  // de overgebleven dagen. Als alleen de langste rit nog overstaat en zelf nog
  // te veel is, wordt die als laatste redmiddel ook gekort (en evt. geschrapt).
  for (let poging = 0; poging <= z2.length; poging++) {
    const actief = z2.filter(t => t.sessietype !== "rust");
    if (actief.length === 0 || huidigeZ2Tss() <= beschikbaarVoorZ2) break;

    const langsteRit = actief.reduce((max, t) => (t.beschikbareUren > max.beschikbareUren ? t : max), actief[0]);
    const kortbaar = actief.filter(t => t !== langsteRit);
    const kortbaarTss = kortbaar.reduce((s, t) => s + t.tss_doel, 0);
    const doelVoorKortbaar = Math.max(0, beschikbaarVoorZ2 - langsteRit.tss_doel);

    if (kortbaar.length === 0) {
      // Laatste redmiddel: alleen de langste rit staat nog over.
      const ratio = langsteRit.tss_doel > 0 ? beschikbaarVoorZ2 / langsteRit.tss_doel : 0;
      langsteRit.tss_doel = Math.max(0, Math.round(langsteRit.tss_doel * ratio));
      langsteRit.beschikbareUren = langsteRit.beschikbareUren * ratio;
      if (langsteRit.beschikbareUren * 60 < MINIMUM_SESSIE_MINUTEN) schrapToewijzing(langsteRit);
      continue;
    }

    if (kortbaarTss <= doelVoorKortbaar) break; // past al, niks te doen

    const ratio = doelVoorKortbaar / kortbaarTss;
    for (const dag of kortbaar) {
      dag.tss_doel = Math.max(0, Math.round(dag.tss_doel * ratio));
      dag.beschikbareUren = dag.beschikbareUren * ratio;
      if (dag.beschikbareUren * 60 < MINIMUM_SESSIE_MINUTEN) schrapToewijzing(dag);
    }
  }

  return [...nietZ2, ...z2].sort((a, b) => a.datum.localeCompare(b.datum));
}
