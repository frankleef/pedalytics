// Blok F, fase 3: mechanische validatie van het JSON-voorstel uit fase 2
// (bouwReviewPrompt) tegen reviewContext (fase 1) en de deterministische
// grenzen — VOORDAT het ooit getoond wordt. Claude's eigen tekst
// (voorgesteldeAanpassing/reden) wordt NIET vertrouwd; alleen het
// machineleesbare nieuwSessietype-veld en reviewContext's eigen bestaande
// trigger/boolean-velden bepalen de uitkomst. Bij afwijzing verandert er
// niets aan het item zelf — de caller (F4/F5) behoudt de HUIDIGE geplande
// sessie, dit bestand "past" nooit iets toe, het geeft alleen een oordeel.
//
// Vier signaalfamilies (vastgesteld, zie F3-opdracht):
// - acuut: herstelsnelheid.trigger, segment-instorting — rechtvaardigt
//   uitsluitend verzachting van de eerstvolgende geplande zware sessie.
// - chronisch: week_voorzichtig, monotonie/strain.trigger, HRV/RHR-trend.trigger,
//   RPE-trend (hergebruikt volumeCorrectie.js:248's drempel >1.0),
//   blok-basis-log[week].richting — rechtvaardigt verzachting over meerdere
//   komende dagen.
// - blok-niveau: blok-basis-log[blok], CP/W'-trend, fitnessprogressie,
//   decoupling-bloktrend — rechtvaardigt NOOIT iets, puur achtergrond.
//
// CORRECTIE: intensivering wordt ALTIJD afgewezen (intensivering_niet_toegestaan),
// ongeacht signalen/freeze/mechanische grenzen — positieve volume-aanpassing is
// al een bestaand, deterministisch mechanisme op blokniveau (D3,
// bepaalNieuweBlokBasis's richting "omhoog", elke 4 weken, ±20%-clamp,
// volumeCorrectie.js). Blok F (2x/dag) dupliceert of loopt daar niet op vooruit
// — mag alleen verzachten of gelijk laten. De oorspronkelijke "plafond"-familie
// (freeze-status.actief blokkeert intensivering) is hierdoor overbodig: freeze
// blokkeerde uitsluitend intensivering, en die is nu al onvoorwaardelijk
// geblokkeerd — freeze-status speelt in dit bestand dus geen rol meer. Om
// dezelfde reden is de week-budget-toets (alleen ooit relevant voor een
// geaccepteerde intensivering — verzachting/gelijk kunnen de week-TSS nooit
// verhogen) niet meer bereikbaar en verwijderd.

import { SESSIETYPE_IF_MIDDEN, SESSIETYPE_MAX_EFFECTIEVE_UREN } from "../sessie/weekSolver";
import { MIN_TSS_VOOR_NIEUWE_DAG, dagNaamVanDatum } from "../volumeCorrectie";
import { isZwareSessieVoorHerstel } from "../sessie/compliance";
import { getMaandagVanWeek } from "../weekgrenzen";
import { datumISO } from "../datum";

// Sentinel voor "volledig schrappen naar rust" in nieuwSessietype — geen lid
// van GELDIGE_SESSIETYPES (die bevat uitsluitend actieve sessietypes), dus een
// aparte, expliciete waarde. Ook geïmporteerd door src/lib/review/prompt.js,
// zodat het antwoordschema Claude exact dezelfde waarde voorschrijft — één bron.
export const SCHRAPPING_WAARDE = "rust";

// Zelfde IF-schatting voor een NIEUWE (nog niet geplande) trainingsdag als
// volumeCorrectie.js:403 (Stap 1 van bepaalVolumeAanpassing) gebruikt — geen
// nieuw getal verzonnen, puur hergebruikt voor consistente MIN_TSS_VOOR_NIEUWE_DAG-
// toetsing hier.
const NIEUWE_DAG_IF_SCHATTING = 0.65;

function bepaalWeekgrenzen(nu) {
  const maandag = getMaandagVanWeek(nu);
  const zondag = new Date(maandag);
  zondag.setDate(zondag.getDate() + 6);
  return { maandagISO: datumISO(maandag), zondagISO: datumISO(zondag) };
}

/**
 * Classificeert huidigSessietype -> nieuwSessietype via SESSIETYPE_IF_MIDDEN
 * (weekSolver.js) — de enige bestaande, sessietype-dekkende intensiteitsmaat
 * (geen aparte "hiërarchie" bestaat, zie verificatierapport F3-onderzoek).
 * @returns {"gelijk"|"intensivering"|"verzachting"|"schrapping"|null} null = onbekend sessietype, fail-closed elders
 */
function classificeerAanpassing(huidigSessietype, nieuwSessietype) {
  if (nieuwSessietype === SCHRAPPING_WAARDE) return "schrapping";
  if (nieuwSessietype === huidigSessietype) return "gelijk";
  const ifHuidig = SESSIETYPE_IF_MIDDEN[huidigSessietype];
  const ifNieuw = SESSIETYPE_IF_MIDDEN[nieuwSessietype];
  if (ifHuidig == null || ifNieuw == null) return null;
  if (ifNieuw < ifHuidig) return "verzachting";
  if (ifNieuw > ifHuidig) return "intensivering";
  return "gelijk";
}

/** Eerstvolgende, nog niet voltooide zware sessie (isZwareSessieVoorHerstel) op/ná vandaag. */
function vindEerstvolgendeZwareSessieDatum(plan, vandaagISO) {
  const kandidaten = (plan?.weekSessies?.sessies || [])
    .filter(s => !s.voltooid && s.datum && s.datum >= vandaagISO && isZwareSessieVoorHerstel(s.intentie?.sessietype))
    .sort((a, b) => a.datum.localeCompare(b.datum));
  return kandidaten[0]?.datum ?? null;
}

function heeftActiefAcuutSignaal(reviewContext) {
  const kt = reviewContext?.korteTermijn || {};
  const instortingen = kt.segmentInstorting || [];
  const heeftInstorting = instortingen.some(i => i?.instorting?.mogelijkIngestort || i?.instorting?.waarschijnlijkIngestort);
  return Boolean(kt.herstelsnelheid?.trigger) || heeftInstorting;
}

function heeftActiefChronischSignaal(reviewContext) {
  const kt = reviewContext?.korteTermijn || {};
  const mt = reviewContext?.middenTermijn || {};
  return Boolean(kt.weekVoorzichtig)
    || Boolean(kt.monotonieStrain?.trigger)
    || Boolean(mt.hrvTrend?.trigger)
    || Boolean(mt.rhrTrend?.trigger)
    || (mt.rpeTrend != null && mt.rpeTrend > 1.0) // hergebruikte drempel, zie volumeCorrectie.js:248
    || (mt.blokBasisLogWeek?.richting != null && mt.blokBasisLogWeek.richting !== "geen");
}

/**
 * Valideert het JSON-voorstel van fase 2 mechanisch tegen reviewContext (fase 1)
 * en de deterministische grenzen. Geen enkele tekst van Claude wordt gebruikt
 * om te beslissen — alleen datum/huidigSessietype/nieuwSessietype (machinaal)
 * en reviewContext's eigen trigger/boolean/richting-velden.
 *
 * @param {Array<{datum: string, huidigSessietype: string, nieuwSessietype: string, voorgesteldeAanpassing?: string, reden?: string}>} voorstelArray
 * @param {object} reviewContext - resultaat van verzamelReviewContext (fase 1)
 * @param {object} plan - seizoensplan
 * @param {Date} [nu] - alleen voor tests; default = huidige systeemtijd
 * @returns {Array<object>} elk input-item, aangevuld met {geaccepteerd: boolean, redenVanAfwijzing: string|null}
 */
export function valideerReviewVoorstel(voorstelArray, reviewContext, plan, nu = new Date()) {
  const vandaagISO = datumISO(nu);
  const { maandagISO, zondagISO } = bepaalWeekgrenzen(nu);
  const eerstvolgendeZwareSessieDatum = vindEerstvolgendeZwareSessieDatum(plan, vandaagISO);
  const acuutActief = heeftActiefAcuutSignaal(reviewContext);
  const chronischActief = heeftActiefChronischSignaal(reviewContext);
  const sessiesInPlan = plan?.weekSessies?.sessies || [];

  return (Array.isArray(voorstelArray) ? voorstelArray : []).map(item => {
    // 1. Weekgrens
    if (!item?.datum || item.datum < maandagISO || item.datum > zondagISO) {
      return { ...item, geaccepteerd: false, redenVanAfwijzing: "buiten_weekgrens" };
    }

    // 2. Classificatie
    const classificatie = classificeerAanpassing(item.huidigSessietype, item.nieuwSessietype);
    if (classificatie == null) {
      return { ...item, geaccepteerd: false, redenVanAfwijzing: "onbekend_sessietype" };
    }
    if (classificatie === "gelijk") {
      return { ...item, geaccepteerd: true, redenVanAfwijzing: null };
    }

    // 3. Schrapping: altijd afgewezen
    if (classificatie === "schrapping") {
      return { ...item, geaccepteerd: false, redenVanAfwijzing: "schrapping_niet_toegestaan" };
    }

    // 4. Intensivering: ALTIJD afgewezen, ongeacht signalen/freeze/mechanische
    // grenzen — positieve volume-aanpassing loopt al via D3 (bepaalNieuweBlokBasis,
    // elke 4 weken, ±20%-clamp); Blok F mag dat niet dupliceren/vooruitlopen.
    if (classificatie === "intensivering") {
      return { ...item, geaccepteerd: false, redenVanAfwijzing: "intensivering_niet_toegestaan" };
    }

    // 5+6. Verzachting: minstens 1 acuut (alleen eerstvolgende zware sessie) of chronisch (elke dag) signaal
    const acuutRechtvaardigtDezeDag = acuutActief && item.datum === eerstvolgendeZwareSessieDatum;
    if (!acuutRechtvaardigtDezeDag && !chronischActief) {
      return { ...item, geaccepteerd: false, redenVanAfwijzing: "geen_rechtvaardigend_signaal" };
    }

    const huidigeSessie = sessiesInPlan.find(s => s.datum === item.datum);

    // 7a. Duurplafond van het nieuwe sessietype (alleen toetsbaar met een
    // bekende bestaande duur — het antwoordschema draagt zelf geen nieuwe duur).
    if (huidigeSessie?.duur_min != null) {
      const maxUren = SESSIETYPE_MAX_EFFECTIEVE_UREN[item.nieuwSessietype];
      if (maxUren != null && huidigeSessie.duur_min > maxUren * 60) {
        return { ...item, geaccepteerd: false, redenVanAfwijzing: "duur_overschrijdt_plafond" };
      }
    }

    // 7b. Nieuwe trainingsdag (geen bestaande sessie op deze datum): minimale TSS
    if (!huidigeSessie) {
      const dagUren = plan?.urenPerDag?.[dagNaamVanDatum(item.datum)] || 1.5;
      const geschatteTss = dagUren * NIEUWE_DAG_IF_SCHATTING * NIEUWE_DAG_IF_SCHATTING * 100;
      if (geschatteTss < MIN_TSS_VOOR_NIEUWE_DAG) {
        return { ...item, geaccepteerd: false, redenVanAfwijzing: "nieuwe_dag_te_weinig_tss" };
      }
    }

    return { ...item, geaccepteerd: true, redenVanAfwijzing: null };
  });
}
