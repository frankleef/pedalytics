// Sectie 47: lichte Claude-aanroep die uitsluitend het sessietype (+ tss_doel +
// sprint-vlag) voor een nieuwe dag bepaalt. De deterministische generator
// (sectie 46) doet daarna de rest: blokken, wattages, TSS.
//
// heeft_sprint_staartjes uit deze respons wordt gevalideerd en gelogd, maar
// NIET doorgezet naar sessie.intentie — het bestaande magSprintStaartje()-
// mechanisme in sessiesAanvullen.js is rijker (TSB, decoupling, langste
// z2_duur-dag van de week) en blijft de enige echte beslisser daarover.

import { claudeCall } from "../claude";
import { GELDIGE_SESSIETYPES, TEST_SESSIETYPES, HERSTEL_SESSIETYPES } from "../sessie-archetypes";
import { sessietypesVoorFase } from "../promptBuilder";

/**
 * Bepaalt het sessietype voor een nieuwe dag via een lichte Claude-aanroep.
 * Claude genereert GEEN sessie-inhoud — alleen de dag-intentie.
 *
 * @param {object} ctx
 * @param {string} ctx.fase
 * @param {number} ctx.weekInFase
 * @param {number} ctx.aantalWekenInFase
 * @param {string} ctx.weektype
 * @param {object} ctx.kaderWeek - voor sessietypesVoorFase (per-week override)
 * @param {number} ctx.weekTssDoel
 * @param {Array}  ctx.geplandeDagen - [{ dag, sessietype, tss }]
 * @param {string} ctx.datum
 * @param {string} ctx.dagNaam
 * @param {number} ctx.beschikbareUren
 * @returns {Promise<object>} { sessietype, tss_doel, heeft_sprint_staartjes }
 */
export async function bepaalDagIntentieViaClaude(ctx) {
  const {
    fase, weekInFase, aantalWekenInFase, weektype, kaderWeek,
    weekTssDoel, geplandeDagen, datum, dagNaam, beschikbareUren,
  } = ctx;

  const geplandeTss = geplandeDagen.reduce((s, d) => s + (d.tss ?? 0), 0);
  const restTss = Math.max(0, weekTssDoel - geplandeTss);

  const geplandeDagenTekst = geplandeDagen.length > 0
    ? geplandeDagen.map(d => `  ${d.dag}: ${d.sessietype} (~${d.tss ?? "?"} TSS)`).join("\n")
    : "  (geen sessies gepland deze week)";

  const toegestaneSessietypes = sessietypesVoorFase(fase, kaderWeek);

  const prompt = `Je bepaalt welk sessietype past bij een nieuwe trainingsdag.

CONTEXT:
- Fase: ${fase} (week ${weekInFase} van ${aantalWekenInFase})
- Weektype: ${weektype}
- Weekdoel TSS: ${weekTssDoel}
- Al gepland deze week:
${geplandeDagenTekst}
- Nieuwe dag: ${dagNaam} (${datum})
- Beschikbare tijd: ${beschikbareUren} uur
- Nog beschikbaar: ${restTss} TSS

REGELS:
- Kies één sessietype uit: ${toegestaneSessietypes}
- tss_doel moet ≤ ${restTss} zijn (resterend weekdoel)
- tss_doel moet realistisch zijn voor ${beschikbareUren} uur
- heeft_sprint_staartjes: true alleen als fase === 'basis' én dit de langste
  z2_duur-dag van de week wordt
- Herstelweek (weektype 'herstel'): kies alleen z2_duur of herstel_actief, nooit intensiteitssessies

Geef ALLEEN dit JSON-object terug, zonder uitleg, zonder markdown:
{"sessietype":"z2_duur","tss_doel":75,"heeft_sprint_staartjes":false}`;

  return claudeCall({
    prompt,
    system: "Je bepaalt uitsluitend het sessietype en TSS-doel voor een trainingsdag. Geef nooit blokken, wattages of beschrijvingen — alleen het gevraagde JSON-object.",
    max_tokens: 100,
  });
}

/**
 * Valideert een dag-intentie-object. Gooit een Error bij ongeldige waarden.
 */
export function valideerDagIntentie(intentie) {
  const alleGeldige = new Set([
    ...GELDIGE_SESSIETYPES,
    ...TEST_SESSIETYPES,
    ...HERSTEL_SESSIETYPES,
  ]);

  if (!intentie || typeof intentie !== "object") {
    throw new Error("Dag-intentie is geen object");
  }
  if (!alleGeldige.has(intentie.sessietype)) {
    throw new Error(`Ongeldig sessietype: "${intentie.sessietype}". Geldige opties: ${[...alleGeldige].join(", ")}`);
  }
  if (typeof intentie.tss_doel !== "number" || intentie.tss_doel <= 0 || intentie.tss_doel > 300) {
    throw new Error(`Ongeldig tss_doel: ${intentie.tss_doel}`);
  }
  if (typeof intentie.heeft_sprint_staartjes !== "boolean") {
    throw new Error(`heeft_sprint_staartjes moet een boolean zijn, kreeg: ${intentie.heeft_sprint_staartjes}`);
  }
  return true;
}

/**
 * Bepaalt dag-intentie via Claude met retry bij fout. Max 2 pogingen totaal.
 */
export async function bepaalDagIntentieMetRetry(ctx) {
  const maxPogingen = 2;
  let laatsteFout;

  for (let poging = 1; poging <= maxPogingen; poging++) {
    try {
      const intentie = await bepaalDagIntentieViaClaude(ctx);
      valideerDagIntentie(intentie);
      console.log(`Dag-intentie bepaald voor ${ctx.datum}: ${intentie.sessietype} (${intentie.tss_doel} TSS, sprint-suggestie=${intentie.heeft_sprint_staartjes})`);
      return intentie;
    } catch (e) {
      console.warn(`Dag-intentie poging ${poging}/${maxPogingen} mislukt voor ${ctx.datum}:`, e.message);
      laatsteFout = e;
    }
  }

  throw new Error(`Dag-intentie mislukt na ${maxPogingen} pogingen voor ${ctx.datum}: ${laatsteFout?.message}`);
}
