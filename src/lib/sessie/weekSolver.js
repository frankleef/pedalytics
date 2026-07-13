// Weeksolver (sectie 48): deterministische invulling van open dagen in een week
// met sessietypes — vervangt waar mogelijk de lichte Claude-aanroep uit
// dagIntentie.js. Zie project-memory voor de scopebeslissing: chunks 1-5
// (deze module, zelfstandig) zijn nu gebouwd; de daadwerkelijke vervanging van
// bouwWeekSessiesPrompt/dagIntentie.js (chunk 6) is een aparte, latere opdracht.

import { vindArchetypeMetVarianten, bepaalDoelGewicht } from "../sessie-generatie";
import { getArchetypesVoorSessietype } from "../sessie-archetypes";
import { bepaalVrijheidsdag } from "../vrijheidsdag";
import { IF_BEREIK } from "./tssValidatie";

// Zelfde TSB-drempel als bepaalDoelGewicht() in sessie-generatie.js (gewicht 1
// als tsb < TSB_DEGRADATIE_DREMPEL) — één bron van waarheid voor "wanneer is
// dagvorm zo slecht dat we moeten degraderen", of dat nu op weekplan-niveau
// (hier) of op generatiemoment (selecteerVariantOpDagvorm) gebeurt.
const TSB_DEGRADATIE_DREMPEL = -20;

/**
 * Berekent het verwachte Z2-aandeel (fractie 0-1) van een archetype, op basis
 * van de concrete blokdefinities (metadata+varianten, uit KV of een
 * client-side archetypesData-fetch — zie vindArchetypeMetVarianten). Een blok
 * telt mee als "Z2-achtig" als het zone Z2 is, of een herstelblok is dat niet
 * Z1 is (Z1 is in dit systeem een aparte, beperkte categorie — zie
 * Z1-restrictie elders). Gemiddeld over alle varianten van het archetype
 * (representatieve waarde, onafhankelijk van welke variant later daadwerkelijk
 * gekozen wordt).
 *
 * duur_sec_vast wordt bewust NIET ondersteund (vervolgticket chunk 2): voor
 * een archetype met vaste-seconden-blokken (bv. vo2_afbouwend) is "het
 * Z2-aandeel" geen vaste, duur-onafhankelijke eigenschap — het schaalbare deel
 * groeit/krimpt met de gevraagde sessieduur, terwijl het vaste deel gelijk
 * blijft, dus de fractie verandert per doelduur. Eerder gaf deze functie hier
 * stilzwijgend 0 terug (duur_pct is undefined op zo'n blok -> NaN -> de
 * ternary hieronder ving dat af tot 0, geen crash, geen zichtbare fout).
 * Bevestigd getroffen: vo2_afbouwend (écht Z2-aandeel is hoog, berekende
 * uitkomst was 0). In plaats van een misleidend "duur_pct-equivalent op een
 * gekozen referentieduur" te verzinnen (dat zou een schijnbaar duur-
 * onafhankelijk getal opleveren dat feitelijk alleen op dat ene referentiepunt
 * klopt), gooien we hier expliciet — er zijn op moment van schrijven geen
 * productie-aanroepers van deze functie (geverifieerd), dus dit raakt geen
 * bestaand gedrag.
 *
 * @param {Object<string, Array>} archetypesData - alle archetypes per sessietype
 * @param {string} sessietype
 * @param {string} archetypeId
 * @returns {number} fractie 0-1
 * @throws {Error} als het sessietype/archetype-id geen variantendata heeft, of
 *   als een variant duur_sec_vast-blokken bevat (zie hierboven)
 */
export function berekenZ2AandeelSessietype(archetypesData, sessietype, archetypeId) {
  const archetype = vindArchetypeMetVarianten(archetypesData?.[sessietype] ?? [], archetypeId);
  if (!archetype?.varianten?.length) {
    throw new Error(
      `berekenZ2AandeelSessietype: geen variantendata voor sessietype "${sessietype}" / archetype "${archetypeId}" — kan Z2-aandeel niet berekenen.`
    );
  }

  for (const variant of archetype.varianten) {
    if (variant.blokken.some((b) => b.duur_sec_vast != null)) {
      throw new Error(
        `berekenZ2AandeelSessietype: variant "${variant.id}" (${sessietype}/${archetypeId}) bevat duur_sec_vast-blokken — het Z2-aandeel is voor zulke archetypes niet duur-onafhankelijk gedefinieerd, deze functie ondersteunt dat bewust niet.`
      );
    }
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
 * BELANGRIJK — fasenamen: de standaard kader-opbouw (bouwKader → bouwWeekvolgorde
 * in src/lib/seizoen/faseDuren.js) genereert voor ELK seizoensdoel dezelfde zes
 * generieke, kleine-letter fasenamen: basis, sweetspot, overgangsfase, drempel,
 * consolidatie, test. Er bestaat GEEN "vo2max"-fase — die bug (PRIORITEIT_PER_FASE.
 * ftp.vo2max) veroorzaakte een undefined-crash zodra een ftp-gebruiker in de
 * Drempel-periode zat. Deze tabel is daarom gesleuteld op de generieke namen.
 *
 * doelprofielen.js (src/lib/seizoen/doelprofielen.js) kent daarnaast rijkere,
 * doel-specifieke fasenamen (bv. "Drempel + VO2max", "Klimspecifiek",
 * "Sprintkracht") — die komen alleen voor in kaderWeek.fase nadat een gebruiker
 * via /api/plan/wijzig-doel van seizoensdoel wisselt (die route herschrijft
 * fase-namen voor toekomstige weken met doelprofielen.js's namen). FASE_ALIAS
 * hieronder vertaalt die rijke namen terug naar de generieke sleutel. Waar één
 * doelprofielen-doel de generieke "drempel"-periode in meerdere sub-fases
 * opdeelt (klimmen: "Drempel + VO2max" + "Klimspecifiek"), wordt dat NIET meer
 * hier samengevoegd — zie KLIMMEN_DREMPEL_MEERDERHEID/_LAATSTE_WEEK en
 * haalPrioriteitOp()'s weekInFase-gebaseerde sub-splitsing verderop.
 */
// klimmen's generieke "drempel"-fase dekt twee sub-fases uit doelprofielen.js met
// OMGEKEERDE kernstimulus/secundair: "Drempel + VO2max" (meerderheid van de
// periode) en, in de laatste week, "Klimspecifiek" (vo2max_intervallen wordt dan
// kernstimulus, drempel_intervallen secundair). Zie haalPrioriteitOp() verderop
// voor de weekInFase-gebaseerde keuze tussen deze twee.
const KLIMMEN_DREMPEL_MEERDERHEID = { kernstimulus: ['drempel_intervallen'], secundair: 'vo2max_intervallen', eerstLatenVallen: ['sprint_neuraal', 'gemengd'] };
const KLIMMEN_DREMPEL_LAATSTE_WEEK = { kernstimulus: ['vo2max_intervallen'], secundair: 'drempel_intervallen', eerstLatenVallen: ['sprint_neuraal', 'gemengd'] };

export const PRIORITEIT_PER_FASE = {
  ftp: {
    basis:         { kernstimulus: null,                     secundair: null,                 eerstLatenVallen: [] },
    sweetspot:     { kernstimulus: ['sweetspot_intervallen'], secundair: null,                 eerstLatenVallen: ['vo2max_intervallen', 'sprint_neuraal', 'gemengd'] },
    overgangsfase: { kernstimulus: ['sweetspot_intervallen'], secundair: null,                 eerstLatenVallen: ['vo2max_intervallen', 'sprint_neuraal', 'gemengd'] },
    drempel:       { kernstimulus: ['drempel_intervallen'],   secundair: 'vo2max_intervallen', eerstLatenVallen: ['sweetspot_intervallen', 'sprint_neuraal', 'gemengd'] },
    consolidatie:  { kernstimulus: ['drempel_intervallen'],   secundair: null,                 eerstLatenVallen: ['sprint_neuraal', 'gemengd'] },
    test:          { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
  },
  klimmen: {
    basis:         { kernstimulus: null,                     secundair: null,                 eerstLatenVallen: [] },
    sweetspot:     { kernstimulus: ['sweetspot_intervallen'], secundair: null,                 eerstLatenVallen: ['drempel_intervallen', 'sprint_neuraal', 'gemengd'] },
    overgangsfase: { kernstimulus: ['sweetspot_intervallen'], secundair: null,                 eerstLatenVallen: ['drempel_intervallen', 'sprint_neuraal', 'gemengd'] },
    // Fallback zonder periode-info (zie haalPrioriteitOp voor de echte splitsing).
    drempel:       KLIMMEN_DREMPEL_MEERDERHEID,
    consolidatie:  { kernstimulus: ['sweetspot_intervallen'], secundair: null,                 eerstLatenVallen: ['vo2max_intervallen', 'gemengd'] },
    test:          { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
  },
  aerobe_basis: {
    basis:         { kernstimulus: null,                     secundair: null,                 eerstLatenVallen: [] },
    sweetspot:     { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
    overgangsfase: { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
    // "alleen bij decoupling <5%" (spec) is een variant-nuance die hier niet
    // afgedwongen wordt — vereist decoupling-data die solveWeek() nu niet ontvangt.
    drempel:       { kernstimulus: ['sweetspot_intervallen'], secundair: null,                 eerstLatenVallen: ['drempel_intervallen', 'vo2max_intervallen', 'sprint_neuraal', 'gemengd'] },
    consolidatie:  { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
    test:          { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
  },
  uithoudingsvermogen: {
    basis:         { kernstimulus: null,                     secundair: null,                 eerstLatenVallen: [] },
    sweetspot:     { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
    overgangsfase: { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
    drempel:       { kernstimulus: ['sweetspot_intervallen'], secundair: null,                 eerstLatenVallen: ['drempel_intervallen', 'vo2max_intervallen', 'sprint_neuraal', 'gemengd'] },
    consolidatie:  { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
    // doelprofielen noemt dit "Taper" (geen eindtest voor dit doel) — komt via de
    // generieke kader-opbouw toch als "test"-fase binnen.
    test:          { kernstimulus: null,                      secundair: null,                 eerstLatenVallen: [] },
  },
  sprint: {
    basis:         { kernstimulus: ['sprint_neuraal'],        secundair: null,                 eerstLatenVallen: ['drempel_intervallen', 'vo2max_intervallen', 'gemengd'] },
    sweetspot:     { kernstimulus: ['sprint_neuraal'],        secundair: null,                 eerstLatenVallen: ['drempel_intervallen', 'vo2max_intervallen', 'gemengd'] },
    overgangsfase: { kernstimulus: ['sprint_neuraal'],        secundair: null,                 eerstLatenVallen: ['drempel_intervallen', 'vo2max_intervallen', 'gemengd'] },
    // "secundair alleen over_under-archetype" (spec) is een variant-nuance,
    // hier niet afgedwongen — dat is archetype-selectie, niet sessietype-keuze.
    drempel:       { kernstimulus: ['sprint_neuraal'],        secundair: 'drempel_intervallen', eerstLatenVallen: ['vo2max_intervallen', 'gemengd'] },
    consolidatie:  { kernstimulus: 'gemengd',                 secundair: 'sprint_neuraal',      eerstLatenVallen: ['drempel_intervallen', 'vo2max_intervallen'] },
    test:          { kernstimulus: ['sprint_neuraal'],        secundair: null,                 eerstLatenVallen: [] },
  },
};

const GENERIEKE_FASES = new Set(['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test']);

// Vertaalt doelprofielen.js's rijke, doel-specifieke fasenamen (kleine letters)
// terug naar de generieke sleutel hierboven — alleen relevant voor kaderWeken die
// via /api/plan/wijzig-doel zijn herschreven; de standaard kader-opbouw levert
// al generieke namen, die hebben deze alias niet nodig.
const FASE_ALIAS_PER_DOEL = {
  ftp: {
    'basis': 'basis', 'sweetspot': 'sweetspot', 'drempel': 'drempel',
    'consolidatie': 'consolidatie', 'test': 'test',
  },
  klimmen: {
    'basis': 'basis', 'sweetspot': 'sweetspot',
    'drempel + vo2max': 'drempel', 'klimspecifiek': 'drempel',
    'consolidatie': 'consolidatie', 'test': 'test',
  },
  aerobe_basis: {
    'aerobe opbouw 1': 'basis', 'aerobe opbouw 2': 'sweetspot',
    'aerobe verdieping': 'drempel', 'consolidatie': 'consolidatie', 'test': 'test',
  },
  uithoudingsvermogen: {
    'volume opbouw': 'basis', 'volume + duur': 'sweetspot',
    'sweetspot hardening': 'drempel', 'consolidatie': 'consolidatie', 'taper': 'test',
  },
  sprint: {
    'aerobe basis': 'basis', 'sprintkracht': 'sweetspot',
    'sprint + drempel': 'drempel', 'specifiek': 'consolidatie', 'test': 'test',
  },
};

/**
 * Haalt de prioriteit-entry op voor een seizoensdoel × fase. Accepteert zowel de
 * generieke kader-fasenamen (het normale geval) als de rijke doelprofielen-namen
 * (na een wijzig-doel-actie), via FASE_ALIAS_PER_DOEL.
 * Gooit een expliciete fout bij een onbekende combinatie — geen stille fallback,
 * zodat een ontbrekende beleidsbeslissing zichtbaar blijft, en gooit VOORDAT er
 * enige dagtoewijzing gebeurt (aangeroepen als eerste stap in solveWeek()).
 */
function normaliseerFase(seizoensdoel, fase) {
  const genormaliseerd = fase?.toLowerCase?.() ?? "";
  return GENERIEKE_FASES.has(genormaliseerd)
    ? genormaliseerd
    : FASE_ALIAS_PER_DOEL[seizoensdoel]?.[genormaliseerd];
}

// klimmen's generieke "drempel"-fase dekt in doelprofielen.js twee sub-fases met
// OMGEKEERDE kernstimulus/secundair: "Drempel + VO2max" (meerderheid van de periode)
// en, in de laatste week van diezelfde periode, "Klimspecifiek" (vo2max_intervallen
// wordt dan kernstimulus, drempel_intervallen secundair). De generieke kaderopbouw
// kent geen aparte fasenaam voor die laatste week — dit wordt hier onderscheiden via
// weekInFase/aantalWekenInFase (positie binnen de fase-periode), niet via de fasenaam.
function isLaatsteWeekVanPeriode(weekInFase, aantalWekenInFase) {
  return aantalWekenInFase != null && weekInFase != null && weekInFase >= aantalWekenInFase;
}

/**
 * Haalt de prioriteit-entry op voor een seizoensdoel × fase. Accepteert zowel de
 * generieke kader-fasenamen (het normale geval) als de rijke doelprofielen-namen
 * (na een wijzig-doel-actie), via FASE_ALIAS_PER_DOEL.
 *
 * @param {string} seizoensdoel
 * @param {string} fase
 * @param {{weekInFase?: number, aantalWekenInFase?: number}} [periode] - voor de
 *   klimmen+drempel sub-fase-splitsing (zie isLaatsteWeekVanPeriode). Optioneel en
 *   backward-compatible: zonder periode-info valt klimmen+drempel terug op de
 *   meerderheidsvariant ("Drempel + VO2max"), zoals vóór deze fix.
 *
 * Gooit een expliciete fout bij een onbekende combinatie — geen stille fallback,
 * zodat een ontbrekende beleidsbeslissing zichtbaar blijft, en gooit VOORDAT er
 * enige dagtoewijzing gebeurt (aangeroepen als eerste stap in solveWeek()).
 */
export function haalPrioriteitOp(seizoensdoel, fase, periode = {}) {
  const tabel = PRIORITEIT_PER_FASE[seizoensdoel];
  if (!tabel) {
    throw new Error(
      `haalPrioriteitOp: geen prioriteitstabel voor seizoensdoel "${seizoensdoel}" — nog niet gedefinieerd in PRIORITEIT_PER_FASE.`
    );
  }
  const generiekeFase = normaliseerFase(seizoensdoel, fase);

  if (seizoensdoel === 'klimmen' && generiekeFase === 'drempel') {
    return isLaatsteWeekVanPeriode(periode.weekInFase, periode.aantalWekenInFase)
      ? KLIMMEN_DREMPEL_LAATSTE_WEEK
      : KLIMMEN_DREMPEL_MEERDERHEID;
  }

  const entry = generiekeFase ? tabel[generiekeFase] : undefined;
  if (!entry) {
    throw new Error(
      `haalPrioriteitOp: geen prioriteitsdefinitie voor doel "${seizoensdoel}", fase "${fase}".`
    );
  }
  return entry;
}

// Sectie 22-G: frequentie-opbouw van de kernstimulus binnen een blok (1x->2x
// per week), generiek mechanisme met een fase-specifieke grens. Fases die hier
// ontbreken (basis, consolidatie, test) of expliciet maxFrequentie:1 hebben
// krijgen geen opbouw — precies zoals vandaag (solveWeek wijst 1 kernstimulus-
// dag toe). sweetspot/overgangsfase mogen opbouwen omdat er geen bestaande
// secundair-sessietype is om mee te stapelen; drempel/consolidatie bewust
// uitgesloten — drempel heeft al een aparte vo2max-secundair (twee
// intensiteitstypen/week vanaf fase-start), dus geen extra 2e drempel-dag
// erbovenop. Klimmen's Klimspecifiek-laatste-week (KLIMMEN_DREMPEL_LAATSTE_WEEK)
// is ook een "drempel"-fase-instantie en krijgt dus ook geen opbouw, blijft
// dus onaangeraakt door dit mechanisme. Het sprint-doel heeft al zijn eigen,
// doel-specifieke frequentiemechanisme (sprint_neuraal_max_per_week in
// doelprofielen.js) en wordt hier bewust niet aangeraakt.
const KERNSTIMULUS_FREQUENTIE_OPBOUW = {
  sweetspot:     { startFrequentie: 1, maxFrequentie: 2, weekInFaseVoorMax: 3 },
  overgangsfase: { startFrequentie: 1, maxFrequentie: 2, weekInFaseVoorMax: 3 },
};

/**
 * Bepaalt hoe vaak de kernstimulus deze week mag voorkomen (1 of meer),
 * gegeven de generieke fase, weekInFase en weektype. Fases zonder entry in
 * KERNSTIMULUS_FREQUENTIE_OPBOUW blijven op 1 (huidig gedrag). Lineaire opbouw
 * tussen startFrequentie (weekInFase 1) en maxFrequentie (bereikt bij
 * weekInFaseVoorMax), afgerond naar beneden zodat de opbouw pas op de
 * aangegeven week daadwerkelijk een extra dag oplevert i.p.v. er te vroeg al
 * naartoe af te ronden. Een herstelweek krijgt nooit meer dan 1 (feitelijk
 * krijgt een herstelweek elders al helemaal geen kernstimulus, zie
 * isHerstelAchtig in solveWeek — deze guard is een expliciet vangnet).
 */
function bepaalKernstimulusFrequentie(generiekeFase, weekInFase = 1, weektype = "opbouw") {
  const entry = KERNSTIMULUS_FREQUENTIE_OPBOUW[generiekeFase];
  if (!entry || weektype === "herstel") return 1;
  const { startFrequentie, maxFrequentie, weekInFaseVoorMax } = entry;
  if (weekInFaseVoorMax <= 1) return maxFrequentie;
  const voortgang = Math.min(1, Math.max(0, (Math.max(1, weekInFase) - 1) / (weekInFaseVoorMax - 1)));
  return Math.min(maxFrequentie, Math.floor(startFrequentie + voortgang * (maxFrequentie - startFrequentie)));
}

// Sectie 26-A, fix 2: kracht_lage_cadans-gating is een HARDE beslissing binnen
// solveWeek() zelf (stap 5), niet meer een informatief vlag voor een downstream
// Claude-promptinstructie. aerobe_basis/uithoudingsvermogen krijgen het nooit
// (bevestigd: geen enkele fase in doelprofielen.js vermeldt kracht_lage_cadans
// voor deze twee doelen). sprint krijgt het ook nooit — bevestigd via
// doelprofielen.js: geen van sprint's vijf fases vermeldt kracht_lage_cadans in
// de sessietypes-lijst (in tegenstelling tot wat een eerdere opdracht aannam).
// klimmen/ftp: frequentie per fase, opgegeven door de gebruiker (geen bestaande
// tabel hiervoor gevonden in de codebase — zie project-memory).
const KRACHT_LAGE_CADANS_VERBODEN_DOELEN = new Set(['aerobe_basis', 'uithoudingsvermogen', 'sprint']);

// Frequentietabel. Voor `ftp` is dit op 13 juli 2026 strak gezet op
// design/IMPLEMENTATIE.md regels 3056-3070 — die spec-tabel staat
// kracht_lage_cadans voor het `ftp`-doel uitsluitend in Basis (week 1-3) toe,
// nergens anders. Een eerdere versie van deze tabel stond `ftp` ook in
// sweetspot/drempel toe; dat bleek niet terug te voeren op een bewuste,
// gedocumenteerde beslissing en week af van de spec, dus is het teruggedraaid
// (zie fitnessprogressie-en-kracht-fase-check.md, Deel B). `klimmen` is
// ongewijzigd. Fases die hier ontbreken (overgangsfase, consolidatie, test)
// staan kracht_lage_cadans nooit toe.
const KRACHT_FREQUENTIE = {
  klimmen: {
    basis:         { toegestaan: true,  frequentie: '1x_per_week' },
    sweetspot:     { toegestaan: true,  frequentie: '1x_per_week' },
    overgangsfase: { toegestaan: false },
    drempel:       { toegestaan: true,  frequentie: '1x_per_2_weken' },
    consolidatie:  { toegestaan: false },
    test:          { toegestaan: false },
  },
  ftp: {
    basis:         { toegestaan: true,  frequentie: '1x_per_2_weken' },
    sweetspot:     { toegestaan: false },
    overgangsfase: { toegestaan: false },
    drempel:       { toegestaan: false },
    consolidatie:  { toegestaan: false },
    test:          { toegestaan: false },
  },
};

// Vertaalt de frequentie-labels naar een interval in weken.
const FREQUENTIE_NAAR_WEKEN = { '1x_per_week': 1, '1x_per_2_weken': 2 };

/**
 * Bepaalt of een Z2-slot deze week kracht_lage_cadans mag worden, i.p.v. gewone
 * z2_duur. Harde uitsluiting voor KRACHT_LAGE_CADANS_VERBODEN_DOELEN. Voor de
 * overige doelen: alleen toegestaan in fases met `toegestaan: true` in
 * KRACHT_FREQUENTIE, en alleen als het opgegeven interval sinds de laatste
 * toewijzing verstreken is.
 *
 * @param {string} seizoensdoel
 * @param {string} generiekeFase - al genormaliseerd (zie normaliseerFase)
 * @param {number|null|undefined} weekNummerInSeizoen - absoluut weeknummer (plan.kader[].week)
 * @param {number|null|undefined} laatsteKrachtLageCadansWeek - weeknummer van de
 *   laatst bekende kracht_lage_cadans-toewijzing (uit vaste/voltooide sessies)
 * @returns {boolean}
 */
function magKrachtLageCadans(seizoensdoel, generiekeFase, weekNummerInSeizoen, laatsteKrachtLageCadansWeek) {
  if (KRACHT_LAGE_CADANS_VERBODEN_DOELEN.has(seizoensdoel)) return false;
  const entry = KRACHT_FREQUENTIE[seizoensdoel]?.[generiekeFase];
  if (!entry?.toegestaan) return false;
  const intervalWeken = FREQUENTIE_NAAR_WEKEN[entry.frequentie];
  if (!intervalWeken) return false;
  if (weekNummerInSeizoen == null || laatsteKrachtLageCadansWeek == null) return true;
  return (weekNummerInSeizoen - laatsteKrachtLageCadansWeek) >= intervalWeken;
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

/**
 * Kiest, uit een reeds gefilterde archetype-lijst (fase/week/seizoensdoel/duur al
 * toegepast door getArchetypesVoorSessietype), het "zwaarste" archetype dat nog
 * past — gerangschikt op min_duur_min (hoog naar laag). Een archetype dat meer
 * tijd vereist is per definitie pas bereikbaar bij meer beschikbare tijd (het
 * viel anders al weg via getArchetypesVoorSessietype's duurfilter), dus de
 * hoogste min_duur_min die nog in de lijst zit is het zwaarste archetype dat bij
 * de beschikbare tijd past.
 *
 * Archetypes zonder min_duur_min (de meerderheid van de huidige dataset) tellen
 * als 0 en behouden via een stabiele sort hun oorspronkelijke onderlinge
 * volgorde — voor data zonder enige min_duur_min levert dit dus identiek gedrag
 * op aan de vorige "eerste archetype"-selectie (geen regressie).
 *
 * @param {Array} archetypes - output van getArchetypesVoorSessietype
 * @returns {object|null}
 */
function kiesZwaarsteArchetype(archetypes) {
  if (!archetypes.length) return null;
  return [...archetypes].sort((a, b) => (b.min_duur_min ?? 0) - (a.min_duur_min ?? 0))[0];
}

/**
 * Zwaarste beschikbare archetype-id voor een sessietype/fase/week/beschikbare
 * duur, of null. Zie kiesZwaarsteArchetype.
 * @param {number|null} [beschikbareDuurMin] - beschikbare tijd voor de dag in
 *   minuten; null = geen duurfilter (bestaand gedrag).
 */
function bepaalArchetypeHint(archetypesData, sessietype, fase, weekInFase, seizoensdoel, weektype, beschikbareDuurMin = null) {
  const archetypes = getArchetypesVoorSessietype(archetypesData?.[sessietype] ?? [], fase, weekInFase, seizoensdoel, beschikbareDuurMin, weektype);
  return kiesZwaarsteArchetype(archetypes)?.id ?? null;
}

// TSS = IF² × uren × 100 (zelfde formule als corrigeerSessieTss in
// tssValidatie.js). IF_MIDDEN is een representatief intensiteitsniveau per
// sessietype (midden van een realistisch bereik voor die stimulus).
// MAX_EFFECTIEVE_UREN is de duur waarboven méér beschikbare tijd niet meer tot
// een hoger dagbudget leidt: voor duurgerichte/tempo-achtige stimuli (z2,
// sweetspot, drempel) schaalt de trainingsdosis mee met beschikbare tijd tot
// een fysiologisch redelijk maximum; voor hoge-intensiteit, interval-
// gebaseerde stimuli (vo2max, sprint, z6) is de dosis inherent tijdgebonden —
// je verdraagt niet "meer" VO2max-werk simpelweg omdat er meer tijd is
// (bevestigd door eerdere analyse: alle vo2max-archetypes clusteren rond
// 30-45 min kernwerk, ongeacht welk archetype gekozen wordt).
//
// Voor de sessietypes die ook een IF_BEREIK-entry hebben in tssValidatie.js
// (post-generatie TSS-clamp) wordt het midden hiervandaan afgeleid i.p.v. los
// gekopieerd — anders kunnen de twee tabellen stilzwijgend uit elkaar lopen.
// z2_duur/z6_anaeroob/gemengd hebben geen (overeenkomende) IF_BEREIK-entry
// (z2_duur's IF_BEREIK-tegenhanger "duur_variabel" ligt bewust hoger, 0.74,
// omdat dat bereik ook lange ritten met tempo-teugjes dekt) en blijven dus
// eigen, expliciete waarden.
const SESSIETYPE_NAAR_IF_BEREIK_KEY = {
  sweetspot_intervallen: "sweetspot",
  drempel_intervallen: "drempel",
  vo2max_intervallen: "vo2max",
  kracht_lage_cadans: "kracht_lage_cadans",
  sprint_neuraal: "sprint_neuraal",
};
function ifMiddenVanBereik(key) {
  const bereik = IF_BEREIK[key];
  return (bereik.min + bereik.max) / 2;
}
const SESSIETYPE_IF_MIDDEN = {
  z2_duur: 0.72,
  z6_anaeroob: 0.55,
  gemengd: 0.80,
  ...Object.fromEntries(
    Object.entries(SESSIETYPE_NAAR_IF_BEREIK_KEY).map(([sessietype, key]) => [sessietype, ifMiddenVanBereik(key)])
  ),
};
const SESSIETYPE_MAX_EFFECTIEVE_UREN = {
  z2_duur: 4,
  sweetspot_intervallen: 2.5,
  kracht_lage_cadans: 1.5,
  drempel_intervallen: 2,
  vo2max_intervallen: 1,
  sprint_neuraal: 1,
  z6_anaeroob: 0.75,
  gemengd: 2,
};

// Sectie 22-G: week-in-blok duur-/volumeprogressie. Alleen interval-gebaseerde
// kernstimulus-sessietypes groeien in duur/intervalaantal naarmate weekInFase
// toeneemt — z2_duur/kracht_lage_cadans/sprint_neuraal/z6_anaeroob/gemengd
// blijven op factor 1 (exact huidig, flat gedrag). IF/%FTP verandert nooit —
// die zit vast in de archetype/variant-blokdata (sessie-varianten.js) en wordt
// door deze factor niet aangeraakt, alleen de duur waarnaar schaalVariant()
// schaalt groeit mee.
const PROGRESSIEVE_SESSIETYPES = new Set([
  "sweetspot_intervallen", "drempel_intervallen", "vo2max_intervallen",
]);

// Week 3 (of later) van een blok bereikt het bestaande, ongewijzigde
// SESSIETYPE_MAX_EFFECTIEVE_UREN-plafond (= huidig gedrag van vóór deze
// wijziging) — week 1/2 zijn dus bewust lichter dan voorheen, in plaats van
// week 3 zwaarder te maken dan het al gevalideerde fysiologische plafond.
// Een herstelweek staat nooit op de blok-piek, ongeacht weekInFase.
function progressieFactor(sessietype, weekInFase = 1, weektype = "opbouw") {
  if (!PROGRESSIEVE_SESSIETYPES.has(sessietype)) return 1;
  if (weektype === "herstel") return 0.75;
  return Math.min(1, 0.75 + 0.125 * (Math.max(1, weekInFase) - 1));
}

/**
 * Schat het TSS-dagbudget voor een sessietype, rechtstreeks op basis van
 * beschikbare tijd × een representatief intensiteitsniveau (IF) voor dat
 * sessietype — niet langer afgeleid van het tss_range van een specifiek
 * archetype (die ranges zijn geijkt op kwaliteitsgerichte sessies van
 * doorgaans 50-95 min, niet op 2+ uur, en vormden zo zelf een te laag
 * plafond). Welk archetype straks daadwerkelijk gegenereerd wordt (variatie,
 * duurfilter) is een aparte, al bestaande beslissing in
 * genereren.js/selecteerArchetype — dit bepaalt uitsluitend het budget
 * waarbinnen die generatie moet passen.
 * @param {number|null} [beschikbareDuurMin] - beschikbare tijd voor de dag in
 *   minuten; null = gebruik de helft van de maximale effectieve duur.
 */
export function schatTssDoel(archetypesData, sessietype, fase, weekInFase, seizoensdoel, gedegradeerd, weektype, beschikbareDuurMin = null) {
  const ifMidden = SESSIETYPE_IF_MIDDEN[sessietype] ?? 0.70;
  const uren = effectieveDuurMin(sessietype, beschikbareDuurMin, weekInFase, weektype) / 60;
  const basis = Math.round(ifMidden * ifMidden * uren * 100);
  return gedegradeerd ? Math.round(basis * 0.85) : basis;
}

/**
 * Effectieve (gecapte) duur in minuten voor een sessietype, gegeven de
 * daadwerkelijk beschikbare tijd — het plafond uit SESSIETYPE_MAX_EFFECTIEVE_UREN
 * hierboven, vermenigvuldigd met de week-in-blok-progressiefactor (sectie
 * 22-G) voor interval-sessietypes. Gedeeld door schatTssDoel()
 * (dagbudget-schatting) EN genereerSessieDag() (de daadwerkelijke
 * sessie-opbouw, zie genereren.js) zodat een sessie nooit voller wordt
 * gebouwd dan het budget waarop hij vervolgens getoetst wordt — anders bouwt
 * genereerSessieDag() op de volle beschikbare tijd en knipt
 * corrigeerSessieTssTovDagbudget() 'm achteraf weer terug. Omdat duur én
 * dagbudget via dezelfde progressieFactor() groeien, blijven ze proportioneel
 * en klemt die dagbudget-clamp de groei niet terug.
 * @param {number|null} beschikbareDuurMin - null = geen duurfilter (helft van het maximum)
 * @param {number} [weekInFase] - positie binnen de fase-periode; stuurt
 *   progressieFactor() voor PROGRESSIEVE_SESSIETYPES, genegeerd voor de rest.
 * @param {string} [weektype] - 'opbouw'|'herstel'; een herstelweek staat nooit
 *   op de blok-piek.
 */
export function effectieveDuurMin(sessietype, beschikbareDuurMin = null, weekInFase = 1, weektype = "opbouw") {
  const maxUren = SESSIETYPE_MAX_EFFECTIEVE_UREN[sessietype] ?? 2;
  const factor = progressieFactor(sessietype, weekInFase, weektype);
  if (beschikbareDuurMin == null) return Math.round((maxUren / 2) * 60 * factor);
  return Math.round(Math.min(beschikbareDuurMin, maxUren * 60) * factor);
}

function bouwToewijzing({ datum, beschikbareUren }, sessietype, { archetypesData, fase, weekInFase, weektype, seizoensdoel, gedegradeerd = false, pad, tssDoelOverride }) {
  const beschikbareDuurMin = Math.round(beschikbareUren * 60);
  const toewijzing = {
    datum,
    sessietype,
    tss_doel: tssDoelOverride ?? schatTssDoel(archetypesData, sessietype, fase, weekInFase, seizoensdoel, gedegradeerd, weektype, beschikbareDuurMin),
    toegestane_zones: TOEGESTANE_ZONES_PER_SESSIETYPE[sessietype] ?? ["Z2"],
    archetype_hint: bepaalArchetypeHint(archetypesData, sessietype, fase, weekInFase, seizoensdoel, weektype, beschikbareDuurMin),
    gedegradeerd,
    pad, // observability: 'kernstimulus'|'secundair'|'vrijheidsessie'|'z2'
    beschikbareUren,
  };
  return toewijzing;
}

/**
 * Vult de open dagen van een week met sessietypes — deterministisch, zonder
 * LLM-aanroep. Zie sectie 48. Budgetcorrectie (proportioneel korten/schrappen)
 * gebeurt niet hier maar in pasBudgetToe() (chunk 5) — deze functie wijst alleen
 * toe, op basis van prioriteit, TSB-degradatie, adjacency en vrijheidsdag.
 *
 * Sectie 22-G: de kernstimulus-toewijzing kan meer dan 1 dag/week opleveren
 * (KERNSTIMULUS_FREQUENTIE_OPBOUW, fase-afhankelijk, opbouwend binnen het
 * blok via weekInFase), en kracht_lage_cadans vervalt hard zodra de week al
 * 2x de kernstimulus bevat (ongeacht fase) — zie de inline comments bij die
 * mechanismen verderop in dit bestand.
 *
 * @param {object} ctx
 * @param {Object<string, Array>} ctx.archetypesData - alle archetypes per sessietype
 *   (server: getAlleArchetypesRaw(); client: eenmalige GET /api/archetypes-fetch)
 * @param {string} ctx.fase
 * @param {number} ctx.weekInFase
 * @param {string} ctx.weektype - 'opbouw'|'herstel'
 * @param {string} ctx.seizoensdoel - 'ftp'|'klimmen'|'aerobe_basis'|'uithoudingsvermogen'|'sprint' (zie haalPrioriteitOp)
 * @param {number} [ctx.aantalWekenInFase] - totaal aantal weken in de huidige fase-periode
 *   (bv. plan.kader.filter(w => w.fase === huidigeFase).length) — alleen nodig voor de
 *   klimmen+drempel sub-fase-splitsing (zie haalPrioriteitOp); optioneel elders.
 * @param {number} ctx.weekTssDoel
 * @param {number} [ctx.belastingscap] - harde bovengrens; standaard gelijk aan weekTssDoel
 * @param {Array}  [ctx.vasteDagen] - [{ datum, sessietype, tss_doel, status }]
 * @param {Array}  ctx.openDagen - [{ datum, beschikbareUren }]
 * @param {{tss?: number, z2Minuten?: number, totaalMinuten?: number}} [ctx.alGeleverd]
 * @param {number|null} [ctx.tsb]
 * @param {number|null} [ctx.weekNummerInSeizoen] - absoluut weeknummer (plan.kader[].week)
 *   voor de kracht_lage_cadans-frequentiegate (zie magKrachtLageCadans)
 * @param {number|null} [ctx.laatsteKrachtLageCadansWeek] - weeknummer van de laatst
 *   bekende kracht_lage_cadans-toewijzing, uit vaste/voltooide sessies
 * @returns {Array<{datum, sessietype, tss_doel, toegestane_zones, archetype_hint, gedegradeerd, pad}>}
 */
export function solveWeek({
  archetypesData, fase, weekInFase, weektype, seizoensdoel, weekTssDoel, belastingscap, aantalWekenInFase,
  vasteDagen = [], openDagen = [], alGeleverd = {}, tsb = null,
  weekNummerInSeizoen = null, laatsteKrachtLageCadansWeek = null,
}) {
  if (!archetypesData || typeof archetypesData !== "object") {
    throw new Error("solveWeek: archetypesData ontbreekt — moet vooraf opgehaald zijn (server: getAlleArchetypesRaw(), client: GET /api/archetypes).");
  }
  const cap = belastingscap ?? weekTssDoel;
  const alGeleverdTss = alGeleverd.tss ?? 0;
  // Vaste dagen (al gepland, nog niet gereden) tellen ook mee als verbruikt
  // budget — anders wijst de z2-opvulling verderop (en de kernstimulus/
  // secundair-budgetcheck) een veel te hoog restbudget toe aan de laatste open
  // dag, dat pasBudgetToe() vervolgens alsnog moet terugsnoeien op basis van
  // hetzelfde vasteDagenTss-cijfer — met als risico dat de dag onder de
  // minimumduur zakt en volledig geschrapt wordt in plaats van gewoon kleiner.
  const vasteDagenTss = vasteDagen
    .filter(d => d.status !== "voltooid")
    .reduce((s, d) => s + (d.tss_doel ?? 0), 0);
  const prioriteit = haalPrioriteitOp(seizoensdoel, fase, { weekInFase, aantalWekenInFase });

  const isHerstelAchtig = weektype === "herstel";
  const bestaandeSessietypesDezeWeek = new Set(vasteDagen.map(d => d.sessietype).filter(Boolean));

  const openDagenAflopend = [...openDagen].sort((a, b) => b.beschikbareUren - a.beschikbareUren);
  const gebruikt = new Set();
  const toewijzingen = [];
  let restBudget = cap - alGeleverdTss - vasteDagenTss;
  const kernstimulusDatums = [];
  const generiekeFaseVoorFrequentie = normaliseerFase(seizoensdoel, fase);
  let kernstimulusType = null;

  // Stap 2/3: kernstimulus — vult tot bepaalKernstimulusFrequentie() dagen met
  // hetzelfde kernstimulus-sessietype (sectie 22-G: standaard 1x/week, kan
  // binnen sommige fases binnen het blok opbouwen naar 2x/week — zie
  // KERNSTIMULUS_FREQUENTIE_OPBOUW). Elke extra dag hergebruikt dezelfde
  // budget-guard als de eerste, plus een adjacency-guard t.o.v. eerder
  // toegewezen kernstimulusdagen (geen twee zware dagen achter elkaar) — bij
  // frequentie 1 (het huidige, oorspronkelijke gedrag) is die guard een no-op
  // omdat er dan nog geen eerdere kernstimulusdag is om aangrenzend aan te zijn.
  if (!isHerstelAchtig && prioriteit.kernstimulus) {
    const kandidaten = Array.isArray(prioriteit.kernstimulus) ? prioriteit.kernstimulus : [prioriteit.kernstimulus];
    kernstimulusType = kandidaten.find(t => !bestaandeSessietypesDezeWeek.has(t));
    const frequentie = bepaalKernstimulusFrequentie(generiekeFaseVoorFrequentie, weekInFase, weektype);

    for (let i = 0; i < frequentie && kernstimulusType; i++) {
      const dag = openDagenAflopend.find(
        d => !gebruikt.has(d.datum) && !kernstimulusDatums.some(kd => zijnAangrenzend(kd, d.datum))
      );
      if (!dag) break;

      const { gedegradeerd } = degradeerBijLageTsb(kernstimulusType, tsb);
      const tssDoel = schatTssDoel(archetypesData, kernstimulusType, fase, weekInFase, seizoensdoel, gedegradeerd, weektype, Math.round(dag.beschikbareUren * 60));
      if (tssDoel > restBudget) break;

      gebruikt.add(dag.datum);
      kernstimulusDatums.push(dag.datum);
      restBudget -= tssDoel;
      toewijzingen.push(bouwToewijzing(dag, kernstimulusType, { archetypesData, fase, weekInFase, weektype, seizoensdoel, gedegradeerd, pad: "kernstimulus", tssDoelOverride: tssDoel }));
    }
  }

  // Stap 3/4: secundair — idem, plus adjacency-check t.o.v. elke kernstimulusdag,
  // plus vrijheidsdag-uitzondering (week 3 van een intensieve fase -> 'gemengd').
  if (!isHerstelAchtig && prioriteit.secundair && !bestaandeSessietypesDezeWeek.has(prioriteit.secundair)) {
    let dag = openDagenAflopend.find(d => !gebruikt.has(d.datum));

    if (dag && kernstimulusDatums.some(kd => zijnAangrenzend(kd, dag.datum))) {
      const alternatief = openDagenAflopend.find(
        d => !gebruikt.has(d.datum) && d.datum !== dag.datum && !kernstimulusDatums.some(kd => zijnAangrenzend(kd, d.datum))
      );
      if (alternatief) dag = alternatief; // anders: geen alternatief, adjacency toegestaan
    }

    if (dag) {
      const isVrijheid = bepaalVrijheidsdag({ weekInFase, dagRol: "tweede_intensiteit", fase });
      const secundairType = isVrijheid ? "gemengd" : prioriteit.secundair;
      const { gedegradeerd } = degradeerBijLageTsb(secundairType, tsb);
      const tssDoel = schatTssDoel(archetypesData, secundairType, fase, weekInFase, seizoensdoel, gedegradeerd, weektype, Math.round(dag.beschikbareUren * 60));
      if (tssDoel <= restBudget) {
        gebruikt.add(dag.datum);
        restBudget -= tssDoel;
        toewijzingen.push(bouwToewijzing(dag, secundairType, { archetypesData, fase, weekInFase, weektype, seizoensdoel, gedegradeerd, pad: isVrijheid ? "vrijheidsessie" : "secundair", tssDoelOverride: tssDoel }));
      }
    }
  }

  // Uitzondering (sectie 48, stap 3.2) — sprint-doel, Sprintkracht-fase (generiek:
  // sweetspot): een TWEEDE sprint_neuraal-dag toestaan bovenop de kernstimulus,
  // mits niet aangrenzend aan de eerste. Dit vult secundair niet generiek in
  // (die is hier null) — het is een doel-specifieke aanvulling vóór de generieke
  // adjacency-check/z2-opvulling, niet een vervanging daarvan.
  if (
    !isHerstelAchtig && seizoensdoel === "sprint" &&
    normaliseerFase(seizoensdoel, fase) === "sweetspot" &&
    kernstimulusDatums.length > 0 && !bestaandeSessietypesDezeWeek.has("sprint_neuraal")
  ) {
    const kandidaat = openDagenAflopend.find(
      d => !gebruikt.has(d.datum) && !kernstimulusDatums.some(kd => zijnAangrenzend(kd, d.datum))
    );
    if (kandidaat) {
      const { gedegradeerd } = degradeerBijLageTsb("sprint_neuraal", tsb);
      const tssDoel = schatTssDoel(archetypesData, "sprint_neuraal", fase, weekInFase, seizoensdoel, gedegradeerd, weektype, Math.round(kandidaat.beschikbareUren * 60));
      if (tssDoel <= restBudget) {
        gebruikt.add(kandidaat.datum);
        restBudget -= tssDoel;
        toewijzingen.push(bouwToewijzing(kandidaat, "sprint_neuraal", { archetypesData, fase, weekInFase, weektype, seizoensdoel, gedegradeerd, pad: "secundair", tssDoelOverride: tssDoel }));
      }
    }
  }

  // Stap 5: rest vullen met z2_duur, resterend budget proportioneel naar uren.
  // Fix 2: kracht_lage_cadans is hier een harde beslissing (magKrachtLageCadans),
  // niet meer een downstream Claude-promptinstructie — max 1 keer per week, en
  // alleen als de frequentiegate dat toelaat en het niet al via een vaste dag
  // deze week geleverd is.
  const z2Dagen = openDagenAflopend.filter(d => !gebruikt.has(d.datum));
  const totaalUrenZ2 = z2Dagen.reduce((s, d) => s + d.beschikbareUren, 0);
  const generiekeFaseVoorKracht = generiekeFaseVoorFrequentie;
  let krachtLageCadansGebruiktDezeWeek = bestaandeSessietypesDezeWeek.has("kracht_lage_cadans");
  // Sectie 22-G, gedrag 3: generieke, fase-onafhankelijke prioriteitsregel —
  // zodra de week al 2x de actieve kernstimulus bevat (deze solveWeek()-pas
  // plus eventuele al-vaste, nog niet voltooide dagen), vervalt
  // kracht_lage_cadans automatisch, ongeacht wat KRACHT_FREQUENTIE toestaat.
  // Dit is de vervanging voor de statische wekelijkse toestemming uit die
  // tabel in precies dit geval — de tabel zelf blijft gelden voor het
  // onderliggende "mag het sowieso van doel/fase"-basisgeval.
  const kernstimulusTotaalDezeWeek = kernstimulusType
    ? kernstimulusDatums.length + vasteDagen.filter(d => d.status !== "voltooid" && d.sessietype === kernstimulusType).length
    : 0;
  for (const dag of z2Dagen) {
    const aandeel = totaalUrenZ2 > 0 ? dag.beschikbareUren / totaalUrenZ2 : 0;
    const tssDoel = Math.max(0, Math.round(restBudget * aandeel));
    const wordtKracht = !isHerstelAchtig && !krachtLageCadansGebruiktDezeWeek && kernstimulusTotaalDezeWeek < 2 &&
      magKrachtLageCadans(seizoensdoel, generiekeFaseVoorKracht, weekNummerInSeizoen, laatsteKrachtLageCadansWeek);
    if (wordtKracht) krachtLageCadansGebruiktDezeWeek = true;
    toewijzingen.push(bouwToewijzing(dag, wordtKracht ? "kracht_lage_cadans" : "z2_duur", { archetypesData, fase, weekInFase, weektype, seizoensdoel, pad: "z2", tssDoelOverride: tssDoel }));
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
 * nooit aangepast. Als die alleen al (samen met alGeleverdTss + vasteDagenTss)
 * het budget overschrijden, is dat een inputfout uit solveWeek — wordt gelogd,
 * niet stilzwijgend overschreven.
 *
 * @param {Array} toewijzingen - output van solveWeek()
 * @param {number} belastingscap
 * @param {number} [alGeleverdTss] - TSS van daadwerkelijk gereden activiteiten deze week
 * @param {number} [vasteDagenTss] - TSS van reeds bestaande, nog NIET gereden sessies
 *   deze week (bv. uit een eerdere weekSessies-job-run) — de caller moet dagen die al
 *   in alGeleverdTss zijn meegeteld (status 'voltooid') hier uitsluiten om dubbeltelling
 *   te voorkomen (zie sessiesAanvullen.js)
 * @returns {Array} nieuwe array, zelfde vorm als toewijzingen
 */
export function pasBudgetToe(toewijzingen, belastingscap, alGeleverdTss = 0, vasteDagenTss = 0) {
  const alVerbruikt = alGeleverdTss + vasteDagenTss;
  const nietZ2 = toewijzingen.filter(t => t.pad !== "z2");
  const nietZ2Tss = nietZ2.reduce((s, t) => s + (t.tss_doel ?? 0), 0);

  // Deze guard signaleert alleen een echte input-fout: kernstimulus/secundair
  // (nietZ2Tss) die zelf, samen met al geleverd/al vast gepland, al niet passen
  // — zou niet moeten voorkomen na TSB-degradatie in solveWeek. Bij nietZ2Tss=0
  // (geen kernstimulus/secundair deze run, bv. omdat solveWeek() ze al terecht
  // wegliet) is een overschrijding puur via alGeleverdTss GEEN input-fout maar
  // het normale geval van een al te volle week — daar moet de Z2-correctie
  // hieronder gewoon op los (die zet de resterende Z2-dag(en) dan terecht om
  // naar 'rust' i.p.v. hier stilzwijgend een volle sessie te laten staan).
  if (nietZ2Tss > 0 && alVerbruikt + nietZ2Tss > belastingscap) {
    console.warn(
      `[pasBudgetToe] kernstimulus/secundair (+ al geleverd + al vast gepland) overschrijden het budget alleen al (${alVerbruikt + nietZ2Tss} > ${belastingscap}) — zou niet moeten voorkomen na TSB-degradatie in solveWeek. Kernstimulus/secundair worden nooit aangepast; input controleren.`
    );
    return toewijzingen;
  }

  const z2 = toewijzingen.filter(t => t.pad === "z2").map(t => ({ ...t }));
  const beschikbaarVoorZ2 = belastingscap - alVerbruikt - nietZ2Tss;
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

    // Geen enkel budget over voor de kortbare dagen (bv. omdat solveWeek() hun
    // tss_doel al op 0 zette door een negatief restBudget): kortbaarTss(0) <=
    // doelVoorKortbaar(0) zou hier ten onrechte als "past al" gelezen worden,
    // terwijl beschikbareUren (en dus de daadwerkelijke sessieduur) nog intact
    // is. Schrap ze dan direct — anders blijft er een volle-duur sessie over
    // met tss_doel 0 (zie genereerSessieDag, die duur nooit uit tss_doel haalt).
    if (doelVoorKortbaar <= 0) {
      for (const dag of kortbaar) schrapToewijzing(dag);
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
