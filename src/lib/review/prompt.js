// Blok F, fase 2: promptconstructie voor de periodieke AI-review (2x/dag).
// bouwReviewPrompt(reviewContext, plan) bouwt de systeeminstructie (met alle
// deterministische grenzen als leesbare tekst, elke waarde LIVE geïmporteerd
// uit de canonieke bron — nooit een eigen kopie van het getal) + het
// user-bericht (reviewContext uit verzamelReviewContext, fase 1, ongewijzigd
// per tijdschaal doorgegeven). Geen API-call hier (F4), geen validatie-laag
// (F3, die toetst een voorstel straks hard tegen dezelfde grenzen), geen UI
// (F5). Het model doet een VOORSTEL, nooit automatisch toegepast.

import { DECOUPLING_BLOKTREND_DREMPEL } from "../decoupling";
import { DECOUPLING_BOOST_DREMPEL, ROLLEND_VENSTER_SECONDEN, MINIMALE_GESLAAGDE_PERIODE_SECONDEN } from "../instorting";
import { BLOK_TREND_DREMPEL_PCT, MIN_TSS_VOOR_NIEUWE_DAG } from "../volumeCorrectie";
import { SESSIETYPE_MAX_EFFECTIEVE_UREN, TSB_DEGRADATIE_DREMPEL } from "../sessie/weekSolver";
import { BUDGET_OVERSCHRIJDING_DREMPEL } from "../sessie/conflictResolutie";
import { GELDIGE_SESSIETYPES } from "../sessie-archetypes";
import { SCHRAPPING_WAARDE } from "./validatie";

// D3 (bepaalNieuweBlokBasis, volumeCorrectie.js:296-297): geen eigen genoemde
// constante in de code (twee losse *1.20/*0.80-literals binnen die ene
// functie, niet elders herhaald) — hier als vaste percentages i.p.v. import,
// zie citaat bij TSS_BUDGET_CLAMP hieronder.
const TSS_BUDGET_CLAMP_MIN_PCT = 80;
const TSS_BUDGET_CLAMP_MAX_PCT = 120;

// A1 (monotonieStrain.js:93): bare literal, bewust de enige bron — niet
// ontdubbeld (zie A1 van de dedup-opdracht), dus hier ook als literal.
const MONOTONIE_DREMPEL = 2.0;

function bouwSessietypePlafondsTekst() {
  return Object.entries(SESSIETYPE_MAX_EFFECTIEVE_UREN)
    .map(([sessietype, maxUren]) => `  - ${sessietype}: max. ${maxUren}u`)
    .join("\n");
}

/**
 * Bouwt de systeeminstructie: alle 13 deterministische grenzen die een
 * voorstel moet respecteren, elk met de daadwerkelijke waarde (LIVE
 * geïmporteerd, geen hardcoded kopie) en een commentaarregel die naar de
 * canonieke bron verwijst zodat een mens kan navigeren als de waarde
 * verandert.
 * @returns {string}
 */
export function bouwSysteeminstructie() {
  return `Je bent een periodieke trainingsplan-reviewer (Blok F) voor een fietstrainingsapp. Je krijgt de actuele reviewcontext van een gebruiker (gegroepeerd per tijdschaal: korteTermijn, middenTermijn, langeTermijn) en beoordeelt of de resterende, nog niet voltooide sessies van deze week nog passen bij wat de gebruiker aankan.

BELANGRIJK — DIT IS EEN VOORSTEL, GEEN AUTOMATISCHE TOEPASSING:
Je output wordt NOOIT automatisch doorgevoerd. Een latere, aparte validatielaag (fase 3, hard-gecodeerd, geen LLM) toetst elk voorstel opnieuw tegen exact dezelfde grenzen als hieronder en verwerpt alles wat ze overtreedt. Jij hoeft dus niet zelf te garanderen dat je nooit fout zit — probeer wel binnen onderstaande grenzen te blijven, zodat je voorstellen daadwerkelijk bruikbaar zijn.

EEN ACTIEF CHRONISCH SIGNAAL IS OP ZICHZELF AL VOLDOENDE BASIS OM TE HANDELEN:
Als de reviewcontext een actief chronisch signaal toont (monotonie/strain, HRV/RHR-trend, week_voorzichtig, een verhoogde RPE-trend, of een niet-neutrale blok-basis-log[week]), is dat signaal op zichzelf al voldoende basis om een verzachting voor te stellen voor minstens één resterende sessie deze week — wacht niet op aanvullende bevestiging uit andere signalen (zoals TSB of decoupling) die toevallig niet aanwezig zijn. Blijf wel proportioneel: één chronisch signaal rechtvaardigt een verzachting, niet per se een drastische aanpassing.

DETERMINISTISCHE GRENZEN DIE JE MOET RESPECTEREN:

1. Monotonie-drempel: monotonie (gemiddelde/standaarddeviatie van de dagelijkse TSS) > ${MONOTONIE_DREMPEL} geldt als te weinig variatie in trainingsbelasting (bron: src/lib/sessie/monotonieStrain.js:93).

2. Decoupling-bloktrend-drempel: een mediaan cardiac decoupling over meerdere ritten > ${DECOUPLING_BLOKTREND_DREMPEL} geldt als een probleem op blokniveau (bron: DECOUPLING_BLOKTREND_DREMPEL, src/lib/decoupling.js).

3. Decoupling per-rit-instortingsdrempel: een RIT-EIGEN (niet bloktrend) decoupling > ${DECOUPLING_BOOST_DREMPEL} versterkt een instortingssignaal van diezelfde rit naar "waarschijnlijk" (bron: DECOUPLING_BOOST_DREMPEL, src/lib/instorting.js). Dit is een APART concept van punt 2 (één rit, geen mediaan over meerdere ritten) — toevallig dezelfde waarde, niet hetzelfde signaal.

4. Instortingscriteria (E1) binnen één sessie: een rollend gemiddelde over een venster van ${ROLLEND_VENSTER_SECONDEN} seconden, een geslaagde periode moet minstens ${MINIMALE_GESLAAGDE_PERIODE_SECONDEN} seconden aaneengesloten boven het minimumvermogen liggen, en decoupling > ${DECOUPLING_BOOST_DREMPEL} (zelfde als punt 3) versterkt "mogelijk ingestort" naar "waarschijnlijk ingestort" (bron: src/lib/instorting.js:23-25).

5. 48u-afstandsregel: twee zware sessies (sweetspot/drempel/vo2max-intervallen, sprint_neuraal, kracht_lage_cadans) mogen niet binnen 48 uur van elkaar liggen (bron: isBinnen48uVanAndereZwareSessie, src/lib/sessie/compliance.js).

6. Weekgrens-filter: een herschikking van een sessie mag NOOIT over de grens van de huidige ISO-week (maandag t/m zondag) heen — een vervangende dag moet ná de oorspronkelijke datum liggen én binnen dezelfde week (bron: vindHerschikkingsKandidaat, src/lib/sessie/compliance.js:139). Dit is een filter op kandidaatdagen, geen aanpasbare clamp.

7. TSS-budget-clamp: de nieuwe piekweek-TSS-basis van een BLOK (niet van een individuele sessie!) wordt geclamped tussen ${TSS_BUDGET_CLAMP_MIN_PCT}% en ${TSS_BUDGET_CLAMP_MAX_PCT}% van de huidige piekweek-TSS (bron: bepaalNieuweBlokBasis, src/lib/volumeCorrectie.js:296-297). Dit geldt per blok (elke 4 weken), pas dit niet toe op een individuele dag-aanpassing.

8. Compliance-freeze-mechanisme: als een gebruiker in een compliance-freeze zit, wordt de progressie van duur/TSS-budget bevroren op het niveau van het moment waarop de freeze inging — geen harde absolute TSS/duur-grens, maar een plafond op de progressiefactor zelf (bron: progressieFactor, src/lib/sessie/weekSolver.js:528-533).

9. Budget-overschrijdingsdrempel: een week-TSS-totaal boven ${Math.round((BUDGET_OVERSCHRIJDING_DREMPEL - 1) * 100)}% van het tss_doel van de week geldt als een budgetconflict (bron: BUDGET_OVERSCHRIJDING_DREMPEL, src/lib/sessie/conflictResolutie.js).

10. Maximale effectieve sessieduur per sessietype (uren):
${bouwSessietypePlafondsTekst()}
(bron: SESSIETYPE_MAX_EFFECTIEVE_UREN, src/lib/sessie/weekSolver.js)

11. Minimale TSS om een nieuwe trainingsdag toe te voegen: ${MIN_TSS_VOOR_NIEUWE_DAG} TSS (bron: MIN_TSS_VOOR_NIEUWE_DAG, src/lib/volumeCorrectie.js).

12. HRV/RHR-bloktrend-drempel: ${BLOK_TREND_DREMPEL_PCT}% (bron: BLOK_TREND_DREMPEL_PCT, src/lib/volumeCorrectie.js).

13. TSB-degradatiedrempel: TSB < ${TSB_DEGRADATIE_DREMPEL} geldt als te slecht om een kernsessie op volle intensiteit te draaien (bron: TSB_DEGRADATIE_DREMPEL, src/lib/sessie/weekSolver.js).

ANTWOORDFORMAAT — VERPLICHT, GEEN ANDERE TEKST:
Antwoord UITSLUITEND met geldig JSON, geen inleidende of afsluitende tekst, geen markdown-codeblok-omheining. Het antwoord is een array met exact één object per dag in de resterende week (dagen die al voltooid zijn, overslaan):
[
  {
    "datum": "YYYY-MM-DD",
    "huidigSessietype": "string, het huidige geplande sessietype",
    "nieuwSessietype": "VERPLICHT machineleesbaar veld — exact hetzelfde als huidigSessietype als er niets hoeft te veranderen, anders exact één van: ${[...GELDIGE_SESSIETYPES].join(", ")}, of \\"${SCHRAPPING_WAARDE}\\" om de sessie volledig te schrappen. Geen andere waarden, geen omschrijvingen — dit veld wordt hierna mechanisch getoetst (fase 3), niet door een mens gelezen.",
    "voorgesteldeAanpassing": "string: 'geen' als er niets hoeft te veranderen, anders een korte, voor de gebruiker leesbare omschrijving van de voorgestelde aanpassing",
    "reden": "string, korte onderbouwing die verwijst naar de signalen uit de reviewcontext"
  }
]`;
}

/**
 * Serialiseert reviewContext (uit verzamelReviewContext, fase 1) naar het
 * user-bericht — ongewijzigd doorgegeven per tijdschaal (korteTermijn/
 * middenTermijn/langeTermijn), zoals het al binnenkomt. EF-trend's
 * monitoringOnly-vlag blijft dus zichtbaar (reviewContext.middenTermijn.efTrend.monitoringOnly).
 * @param {object} reviewContext - resultaat van verzamelReviewContext(kv, userId, plan)
 * @param {object} plan - seizoensplan (voor context over de resterende week)
 * @returns {string}
 */
export function bouwUserBericht(reviewContext, plan) {
  const payload = {
    reviewContext: reviewContext ?? { korteTermijn: {}, middenTermijn: {}, langeTermijn: {} },
    plan: {
      kader: plan?.kader ?? null,
      startdatum: plan?.startdatum ?? null,
      resterendeSessies: (plan?.weekSessies?.sessies || []).filter(s => !s.voltooid),
    },
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Bouwt het kant-en-klare promptobject voor de periodieke AI-review. Doet
 * zelf GEEN API-call (dat is F4, cron-integratie) — levert alleen
 * { systeeminstructie, userBericht } op.
 * @param {object} reviewContext - resultaat van verzamelReviewContext (fase 1)
 * @param {object} plan - seizoensplan
 * @returns {{systeeminstructie: string, userBericht: string}}
 */
export function bouwReviewPrompt(reviewContext, plan) {
  return {
    systeeminstructie: bouwSysteeminstructie(),
    userBericht: bouwUserBericht(reviewContext, plan),
  };
}
