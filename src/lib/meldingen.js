// In-app meldingencentrum: maakt automatische coach-beslissingen (sessie-
// aanpassingen, week-/seizoen-correcties) zichtbaar en uitlegbaar voor de
// gebruiker. Eén centrale module — geen duplicatie van meldingteksten over
// call-sites heen. Wordt uitsluitend server-side aangeroepen, nooit vanuit de
// client (er is bewust geen POST-route om een melding te *maken*).

import { getKV } from "./kv";
import { sendPush } from "./pushNotify";

const MELDING_TEMPLATES = {
  hrv_overbelastingsgate: () => ({
    categorie: "week",
    titel: "Weekbelasting bijgesteld",
    tekst: "Je hartslagvariabiliteit wijst al een paar dagen op onvoldoende herstel — " +
           "we hebben de komende sessies iets teruggeschroefd.",
    bron: "hrv-overbelastingsgate",
    deeplink: "/schema",
  }),
  opbouwweek_verlengd: () => ({
    categorie: "seizoen",
    titel: "Extra opbouwweek ingelast",
    tekst: "Je aerobe basis is nog in ontwikkeling — we geven je een extra week voordat " +
           "we de belasting verhogen.",
    bron: "fase-overgangcheck-decoupling",
    deeplink: "/voortgang",
  }),
  compliance_opbouwweek_verlengd: () => ({
    categorie: "seizoen",
    titel: "Extra opbouwweek ingelast",
    tekst: "Je hebt de afgelopen periode meerdere kernsessies gemist — we geven je een extra " +
           "week voordat we de belasting verhogen.",
    bron: "fase-overgangcheck-compliance",
    deeplink: "/voortgang",
  }),
  afwezigheid_afgerond: (ctx) => ({
    categorie: "seizoen",
    titel: "Welkom terug",
    tekst: ctx.actie === "geen"
      ? "Je afwezigheidsperiode is verwerkt. Je schema loopt gewoon door — geen aanpassing nodig."
      : `Je afwezigheidsperiode (${ctx.duurDagen} dagen) is verwerkt — we hebben een ` +
        `${ctx.actie === "opbouwweek" ? "verlaagde opbouwweek" : "extra lichte week"} ingelast om weer rustig op te bouwen.`,
    bron: "afwezigheidsperiode",
    deeplink: "/schema",
  }),
  fase_overgang: (ctx) => ({
    categorie: "seizoen",
    titel: `Nieuwe fase: ${ctx.faseNaam}`,
    tekst: `Je bent klaar voor de volgende fase van je seizoensplan: ${ctx.faseNaam}. ` +
           `${ctx.faseUitleg ?? ""}`,
    bron: "fase-overgangcheck",
    deeplink: "/schema",
  }),
  niveau_gewijzigd: (ctx) => ({
    categorie: "seizoen",
    titel: "Trainingsniveau bijgewerkt",
    tekst: `Je niveau is bijgewerkt naar ${ctx.niveauLabel}. Je sessies zijn hierop aangepast.`,
    bron: "wijzig-niveau",
    deeplink: "/schema",
  }),
  doel_gewijzigd: (ctx) => ({
    categorie: "seizoen",
    titel: "Seizoensdoel gewijzigd",
    tekst: `Je doel is gewijzigd naar ${ctx.doelLabel}. Je plan is hierop herberekend.`,
    bron: "wijzig-doel",
    deeplink: "/schema",
  }),
  trainingsblok_herijkt: (ctx) => ({
    categorie: "seizoen",
    titel: "Nieuw trainingsblok",
    tekst: ctx.tekst ?? "Je start een nieuw trainingsblok — het volume is op basis van je laatste blok bijgesteld.",
    bron: "blok-evaluatie",
    deeplink: "/voortgang",
  }),
  ftp_gedetecteerd: (ctx) => ({
    categorie: "metingen",
    titel: "Nieuwe FTP gedetecteerd",
    tekst: `Je rit is herkend als ramp-test. Je FTP is bijgewerkt van ${ctx.oudeFtp}W ` +
           `naar ${ctx.nieuweFtp}W. Al je zones rekenen vanaf nu met deze waarde.`,
    bron: "ftp-testdetectie",
    deeplink: "/profiel",
  }),
  koppeling_verbroken: () => ({
    categorie: "systeem",
    titel: "Koppeling met intervals.icu verbroken",
    tekst: "We kunnen je trainingsdata niet meer ophalen. Controleer je API-sleutel in je " +
           "profiel.",
    bron: "intervals-auth-check",
    deeplink: "/profiel",
  }),
  checkin_modulatie: (ctx) => ({
    categorie: "sessie",
    titel: ctx.richting === "verzwaard" ? "Sessie iets verzwaard" : "Sessie iets verlicht",
    tekst: `Je balansscore was ${ctx.score} vandaag. We hebben ${ctx.dagLabel} daarop ` +
           `aangepast: ${ctx.richting === "verzwaard" ? "iets langer en iets intensiever" : "iets korter en iets rustiger"}.`,
    bron: "checkin-modulatie",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  tsb_degradatie: (ctx) => ({
    categorie: "sessie",
    titel: "Sessie verlicht — vorm laag",
    tekst: `Je vorm (TSB ${ctx.tsb}) is op dit moment laag. ${ctx.dagLabel} is daardoor ` +
           "lichter ingepland dan gebruikelijk voor dit type sessie.",
    bron: "tsb-degradatie",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  monotonie_degradatie: (ctx) => ({
    categorie: "sessie",
    titel: "Sessie verlicht — te weinig variatie",
    tekst: (ctx.monotonie === Infinity
      ? "Je trainingsbelasting was deze week elke dag vrijwel identiek."
      : `Je trainingsbelasting van de afgelopen dagen was weinig gevarieerd (monotonie ${ctx.monotonie.toFixed(1)}).`
    ) + ` ${ctx.dagLabel} is daarom vervangen door een lichte duurrit om die variatie terug te brengen.`,
    bron: "monotonie-correctie",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  kritieke_rust: (ctx) => ({
    categorie: "sessie",
    titel: "Rust geadviseerd — advies opgevolgd",
    tekst: `Je balansscore was ${ctx.score}. ${ctx.dagLabel} is vervangen door een korte ` +
           "hersteldag.",
    bron: "kritieke-balansscore",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  duurcap_toegepast: (ctx) => ({
    categorie: "sessie",
    titel: "Sessie ingekort naar beschikbare tijd",
    tekst: `Je had ${ctx.beschikbareMinuten} min beschikbaar; de geplande sessie van ` +
           `${ctx.oorspronkelijkeMinuten} min is proportioneel verkort.`,
    bron: "duurcap",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  hitte_correctie: (ctx) => ({
    categorie: "metingen",
    titel: "Hitte-correctie toegepast",
    tekst: `De gevoelstemperatuur tijdens deze rit was ${ctx.temperatuur}°C. Hartslag en ` +
           "cardiac decoupling zijn daardoor beïnvloed en tellen niet mee in de fase-analyse.",
    bron: "hitte-detectie",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  distributie_correctie: (ctx) => ({
    categorie: "week",
    titel: "Zonebalans wijkt af",
    tekst: ctx.tekst ?? "Je zonebalans wijkt af van het streefpercentage.",
    bron: "distributie-signalering",
    deeplink: "/voortgang",
  }),
  volumecorrectie: (ctx) => ({
    categorie: "week",
    titel: "Sessie verlengd o.b.v. weekvolume",
    tekst: ctx.tekst ?? `${ctx.dagLabel} is iets verlengd om je weekvolume op koers te houden.`,
    bron: "volumecorrectie",
    deeplink: ctx.datum ? `/schema?datum=${ctx.datum}` : "/schema",
  }),
  overbelastingsgate_nieuwe_dag: (ctx) => ({
    categorie: "week",
    titel: "Schema aangepast na wijziging beschikbaarheid",
    tekst: ctx.tekst ?? `${ctx.dagLabel} is aangepast zodat de belasting in balans blijft.`,
    bron: "overbelastingsgate-nieuwe-dag",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  sessie_gemist: (ctx) => ({
    categorie: "systeem",
    titel: "Sessie gemist",
    tekst: `${ctx.dagLabel} is niet gereden. Je schema loopt gewoon door — geen actie nodig.`,
    bron: "missed-detectie",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  compliance_eerste_misser: (ctx) => ({
    categorie: "systeem",
    titel: "Sessie gemist",
    tekst: `${ctx.dagLabel} is niet gereden. Eén gemiste kernsessie is geen probleem — je schema loopt door.`,
    bron: "compliance-freeze",
    deeplink: `/schema?datum=${ctx.datum}`,
  }),
  compliance_freeze_geactiveerd: (ctx) => ({
    categorie: "seizoen",
    titel: "Opbouw tijdelijk vastgehouden",
    tekst: ctx.aantalMissers
      ? `Je hebt ${ctx.aantalMissers} kernsessies gemist in de afgelopen periode — we houden je opbouw tijdelijk vast tot je weer een schone week hebt.`
      : "Je hebt meerdere kernsessies gemist in de afgelopen periode — we houden je opbouw tijdelijk vast tot je weer een schone week hebt.",
    bron: "compliance-freeze",
    deeplink: "/voortgang",
  }),
};

// Vuistregel: alleen pushen als (a) het een achtergrondproces is dat de
// gebruiker niet zelf net getriggerd heeft, én (b) het vandaag/morgen raakt
// of een seizoen-mijlpaal is. Synchrone reacties op een eigen gebruikers-
// actie (check-in, beschikbaarheid wijzigen) pushen niet — de gebruiker zit
// al in de app.
const PUSH_WAARDIGE_TYPES = new Set([
  "hrv_overbelastingsgate",
  "opbouwweek_verlengd",
  "afwezigheid_afgerond",
  "fase_overgang",
  "niveau_gewijzigd",
  "doel_gewijzigd",
  "trainingsblok_herijkt",
  "ftp_gedetecteerd",
  "koppeling_verbroken",
  "compliance_freeze_geactiveerd",
  "compliance_opbouwweek_verlengd",
]);

const MAX_MELDINGEN = 200;
// Meldingen verlopen automatisch 48u na aanmaak — voorkomt dat het meldingen-
// centrum onbeperkt volloopt. Er is geen per-item Redis-TTL mogelijk (alle
// meldingen van een gebruiker staan in één JSON-blob), dus dit wordt op
// applicatieniveau gefilterd op aangemaakt_op, met opschonen bij elke lees-
// en schrijfactie.
const MELDING_TTL_MS = 48 * 60 * 60 * 1000;

function meldingenKey(userId) {
  return `meldingen:${userId}`;
}

function nietVerlopen(melding) {
  return Date.now() - new Date(melding.aangemaakt_op).getTime() < MELDING_TTL_MS;
}

/**
 * Maakt een melding aan, slaat 'm op (nieuwste eerst, verlopen meldingen
 * opgeschoond, gecapt op 200) en stuurt — indien het type daarvoor in
 * aanmerking komt — ook een Web Push.
 *
 * @param {string} userId
 * @param {string} type - moet een sleutel uit MELDING_TEMPLATES zijn
 * @param {object} [ctx] - context-variabelen voor de template
 * @returns {Promise<object>} de aangemaakte melding
 */
export async function maakMelding(userId, type, ctx = {}) {
  const template = MELDING_TEMPLATES[type];
  if (!template) throw new Error(`Onbekend meldingtype: ${type}`);
  const basis = template(ctx);
  let melding = {
    id: crypto.randomUUID(),
    type,
    gelezen: false,
    aangemaakt_op: new Date().toISOString(),
    gepusht: false,
    deeplink: null,
    ...basis,
  };

  if (PUSH_WAARDIGE_TYPES.has(type)) {
    await sendPush(userId, { title: melding.titel, body: melding.tekst, url: melding.deeplink || "/" });
    melding = { ...melding, gepusht: true };
  }

  const kv = getKV();
  const huidige = ((await kv.get(meldingenKey(userId))) ?? []).filter(nietVerlopen);
  const bijgewerkt = [melding, ...huidige].slice(0, MAX_MELDINGEN);
  await kv.set(meldingenKey(userId), bijgewerkt);
  return melding;
}

/**
 * Haalt de meldingen van een gebruiker op, nieuwste eerst. Meldingen ouder
 * dan 48u worden er stilzwijgend uit gefilterd en (indien nodig) meteen
 * opgeschoond in de opslag.
 * @param {string} userId
 * @param {{categorie?: string, ongelezenAlleen?: boolean}} [opts]
 */
export async function haalMeldingen(userId, { categorie, ongelezenAlleen } = {}) {
  const kv = getKV();
  const key = meldingenKey(userId);
  const ruw = (await kv.get(key)) ?? [];
  let lijst = ruw.filter(nietVerlopen);
  if (lijst.length !== ruw.length) await kv.set(key, lijst);
  if (categorie) lijst = lijst.filter((m) => m.categorie === categorie);
  if (ongelezenAlleen) lijst = lijst.filter((m) => !m.gelezen);
  return lijst;
}

/**
 * Markeert één melding (of alle, via id === 'alle') als gelezen.
 * @param {string} userId
 * @param {string} id
 */
export async function markeerGelezen(userId, id) {
  const kv = getKV();
  const key = meldingenKey(userId);
  const lijst = (await kv.get(key)) ?? [];
  const bijgewerkt = id === "alle"
    ? lijst.map((m) => ({ ...m, gelezen: true }))
    : lijst.map((m) => (m.id === id ? { ...m, gelezen: true } : m));
  await kv.set(key, bijgewerkt);
}

/**
 * Verwijdert één melding definitief.
 * @param {string} userId
 * @param {string} id
 */
export async function verwijderMelding(userId, id) {
  const kv = getKV();
  const key = meldingenKey(userId);
  const lijst = (await kv.get(key)) ?? [];
  const bijgewerkt = lijst.filter((m) => m.id !== id);
  await kv.set(key, bijgewerkt);
}
