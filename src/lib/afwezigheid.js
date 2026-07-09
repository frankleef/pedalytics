// Afwezigheidsperiodes (ziek/vakantie/anders): een gebruiker markeert een
// periode als afwezig, geplande sessies binnen die periode vervallen, en bij
// terugkeer wordt afhankelijk van duur/reden eventueel een extra
// (herstel- of verlaagde-opbouw-)week ingevoegd in het seizoensplan —
// hergebruikt hetzelfde kader-invoegmechanisme als de cardiac-decoupling-
// fase-verlenging (zie faseVerlenging.js), maar met een eigen boekhouding,
// niet gedeeld met fase_verlengd_count.
//
// KV-opslag: één array-sleutel per gebruiker (${userId}:afwezigheid),
// zelfde patroon als ftp-historie/meldingen — geen scan nodig om alle
// periodes van een gebruiker te vinden.

import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet, intervalsDelete } from "@/lib/intervals";
import { vandaagISO, datumISO } from "@/lib/datum";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { bijwerkPlanVeilig } from "@/lib/plan/bijwerkPlanVeilig";
import { voegExtraWeekToe } from "@/lib/seizoen/faseVerlenging";
import { maakMelding } from "@/lib/meldingen";
import { effectiefEind, valtBinnenAfwezigheid } from "@/lib/afwezigheidHelpers";

export { valtBinnenAfwezigheid };

const REDENEN = ["ziek", "vakantie", "anders"];
const MAX_DAGEN_TERUG = 14;

// Eerste-gok-defaults voor de heropbouw-beslissing (onderdeel 4) — productkeuze,
// geen uit bestaande code gediagnosticeerde waarde. Later aan te passen zonder
// de rest van deze module of de aanroepers te raken.
export const HEROPBOUW_CONSTANTEN = {
  MIN_DAGEN_VOOR_INGREEP: 4,      // <4 dagen: nooit een ingreep, ongeacht reden
  MIN_DAGEN_VOOR_OPBOUWWEEK: 8,   // >=8 dagen: opbouw-pad i.p.v. herstel-pad
  RATIO_DREMPEL_OVERIG: 0.5,      // geleverdeTss/verwachteTss >= dit -> lichtere/geen ingreep bij "vakantie"/"anders"
  TSS_PCT_HERSTEL: 0.6,           // 4-7 dagen (of overig-ratio>=drempel in 8+ dagen): herstelweek op 60% van de voorgaande week
  TSS_PCT_OPBOUW_VERLAAGD: 0.75,  // 8+ dagen (of overig-ratio<drempel in 4-7 dagen valt hier niet onder): verlaagde opbouwweek op 75%
};

function afwezigheidKey(userId) {
  return `${userId}:afwezigheid`;
}

export async function haalAfwezigheidsperiodes(userId) {
  const kv = getKV();
  return (await kv.get(afwezigheidKey(userId))) || [];
}

function periodesOverlappen(a, b) {
  return a.startDatum <= effectiefEind(b) && b.startDatum <= effectiefEind(a);
}

/**
 * Maakt een nieuwe afwezigheidsperiode aan na validatie. Verwijdert zelf
 * geen sessies — dat is een aparte stap (verwijderSessiesInPeriode), door de
 * caller (de route) direct na een succesvolle aanmaak aan te roepen.
 *
 * @returns {Promise<{periode: object}|{error: string, conflict?: object}>}
 */
export async function maakAfwezigheidsperiode(userId, { startDatum, eindDatum = null, reden, notitie = null }) {
  if (!startDatum || !reden) return { error: "startDatum en reden zijn verplicht" };
  if (!REDENEN.includes(reden)) return { error: `Ongeldige reden — moet één van: ${REDENEN.join(", ")}` };
  if (eindDatum === null) {
    if (reden !== "ziek") return { error: "Open einde (geen eindDatum) is alleen toegestaan bij reden 'ziek'" };
  } else if (eindDatum < startDatum) {
    return { error: "eindDatum ligt vóór startDatum" };
  }

  const vandaag = vandaagISO();
  const dagenTerug = Math.round((new Date(vandaag) - new Date(startDatum)) / 86400000);
  if (dagenTerug > MAX_DAGEN_TERUG) {
    return { error: `startDatum ligt meer dan ${MAX_DAGEN_TERUG} dagen in het verleden (${dagenTerug} dagen)` };
  }

  const kv = getKV();
  const key = afwezigheidKey(userId);
  const periodes = (await kv.get(key)) || [];

  const nieuw = { startDatum, eindDatum };
  const conflict = periodes.find(p => p.status === "actief" && periodesOverlappen(nieuw, p));
  if (conflict) return { error: "Overlapt met een bestaande actieve periode", conflict };

  const periode = {
    periodeId: crypto.randomUUID(),
    startDatum,
    eindDatum,
    reden,
    notitie,
    aangemaaktOp: new Date().toISOString(),
    status: "actief",
    heropbouwToegepast: false,
  };
  periodes.push(periode);
  await kv.set(key, periodes);
  return { periode };
}

/** Zet de eindDatum van een open-eind-periode (alleen "ziek") op vandaag. */
export async function sluitOpenPeriode(userId, periodeId) {
  const kv = getKV();
  const key = afwezigheidKey(userId);
  const periodes = (await kv.get(key)) || [];
  const periode = periodes.find(p => p.periodeId === periodeId);
  if (!periode) return { error: "Periode niet gevonden" };
  if (periode.status !== "actief") return { error: "Periode is niet actief" };
  if (periode.eindDatum !== null) return { error: "Periode heeft al een einddatum" };

  periode.eindDatum = vandaagISO();
  await kv.set(key, periodes);
  return { periode };
}

/**
 * Annuleert een periode. Sessies die al verwijderd waren n.a.v. deze periode
 * blijven verwijderd — retroactief herstellen is bewust geen onderdeel van
 * deze functie (bekende beperking, zie implementatie-opdracht).
 */
export async function annuleerPeriode(userId, periodeId) {
  const kv = getKV();
  const key = afwezigheidKey(userId);
  const periodes = (await kv.get(key)) || [];
  const periode = periodes.find(p => p.periodeId === periodeId);
  if (!periode) return { error: "Periode niet gevonden" };

  periode.status = "geannuleerd";
  await kv.set(key, periodes);
  return { periode };
}

/**
 * Verwijdert geplande (niet-voltooide) sessies binnen [startDatum, eindDatum]
 * uit plan.weekSessies.sessies, en de gekoppelde intervals.icu-events. Raakt
 * nooit een voltooide sessie. Doet niets (geen foutmelding) als er niets te
 * verwijderen valt — bv. omdat het rollend generatievenster de periode nog
 * niet heeft bereikt.
 *
 * @returns {Promise<{verwijderd: string[]}>} verwijderde datums
 */
export async function verwijderSessiesInPeriode(userId, periode) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const eind = effectiefEind(periode);
  let teVerwijderen = [];

  const versPlan = await bijwerkPlanVeilig(kv, planKey, (plan) => {
    if (!plan.weekSessies?.sessies?.length) return;
    teVerwijderen = plan.weekSessies.sessies.filter(s =>
      s.datum >= periode.startDatum && s.datum <= eind && !s.voltooid
    );
    if (teVerwijderen.length === 0) return;
    const teVerwijderenDatums = new Set(teVerwijderen.map(s => s.datum));
    plan.weekSessies.sessies = plan.weekSessies.sessies.filter(s => !teVerwijderenDatums.has(s.datum));
  });

  if (!versPlan || teVerwijderen.length === 0) return { verwijderd: [] };

  const creds = await getIntervalsCredentials(userId);
  if (creds) {
    for (const s of teVerwijderen) {
      if (!s.intervalsEventId) continue;
      await intervalsDelete(`/events/${s.intervalsEventId}`, creds).catch(
        (e) => console.warn(`[afwezigheid] intervals.icu-event ${s.intervalsEventId} verwijderen mislukt:`, e.message)
      );
    }
  }
  return { verwijderd: teVerwijderen.map(s => s.datum) };
}

/**
 * Zij-effect-vrije variant van verwijderSessiesInPeriode: telt hoeveel
 * geplande (niet-voltooide) sessies binnen [startDatum, eindDatum] zouden
 * worden verwijderd, zonder te schrijven of intervals.icu aan te roepen.
 * Voor de live-preview-regel in het invoerscherm, vóór de periode daadwerkelijk
 * is aangemaakt.
 */
export async function telSessiesInPeriode(userId, startDatum, eindDatum) {
  const kv = getKV();
  const plan = await kv.get(`${userId}:seizoensplan`);
  const eind = eindDatum ?? "9999-12-31";
  const sessies = plan?.weekSessies?.sessies || [];
  return sessies.filter(s => s.datum >= startDatum && s.datum <= eind && !s.voltooid).length;
}

/** Som van icu_training_load van Ride/VirtualRide-activiteiten in [startDatum, eindDatum]. */
async function berekenGeleverdeTssInPeriode(userId, startDatum, eindDatum) {
  const creds = await getIntervalsCredentials(userId);
  if (!creds) return 0;
  let activiteiten;
  try {
    activiteiten = await intervalsGet("/activities", {
      oldest: startDatum, newest: eindDatum,
      fields: "id,start_date_local,type,icu_training_load",
    }, creds);
  } catch (e) {
    console.warn(`[afwezigheid] TSS-ophalen mislukt voor ${userId}:`, e.message);
    return 0;
  }
  const ritten = (activiteiten || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");
  return Math.round(ritten.reduce((s, r) => s + (r.icu_training_load ?? 0), 0));
}

/** Verwachte TSS over de periode: per overspannen kalenderdag, tss_doel/7 van de kaderweek van die dag. */
function verwachteTssVoorPeriode(plan, periode) {
  if (!plan?.startdatum || !plan?.kader || !periode.eindDatum) return 0;
  let totaal = 0;
  const d = new Date(periode.startDatum);
  const eindD = new Date(periode.eindDatum);
  while (d <= eindD) {
    const iso = datumISO(d);
    const weekNr = weeknummerVoorDatum(iso, plan.startdatum);
    const kaderWeek = plan.kader.find(w => w.week === weekNr);
    if (kaderWeek) totaal += (kaderWeek.tss_doel || 0) / 7;
    d.setDate(d.getDate() + 1);
  }
  return totaal;
}

/**
 * Bepaalt of/hoe een extra week wordt ingevoegd bij terugkeer, volgens de
 * duur-tabel (sectie 55-D): 1-3 dagen nooit, 4-7 dagen een herstelweek op
 * TSS_PCT_HERSTEL, 8+ dagen een verlaagde opbouwweek op
 * TSS_PCT_OPBOUW_VERLAAGD — bij "vakantie"/"anders" eerst getoetst aan de
 * TSS-ratio (geleverd/verwacht) tijdens de periode; bij een ratio >= de
 * drempel schuift het pad één stap "lichter" (8+ dagen -> herstel-pad i.p.v.
 * opbouw-pad; 4-7 dagen -> geen ingreep i.p.v. herstel-pad).
 *
 * @returns {Promise<{actie: "geen"|"lichte_week"|"opbouwweek", tssPct?: number, ratio?: number}>}
 */
export async function bepaalHeropbouwActie(plan, userId, periode) {
  const duurDagen = Math.round((new Date(periode.eindDatum) - new Date(periode.startDatum)) / 86400000) + 1;

  if (duurDagen < HEROPBOUW_CONSTANTEN.MIN_DAGEN_VOOR_INGREEP) {
    return { actie: "geen", duurDagen };
  }

  const isLangePeriode = duurDagen >= HEROPBOUW_CONSTANTEN.MIN_DAGEN_VOOR_OPBOUWWEEK;

  if (periode.reden === "ziek") {
    return isLangePeriode
      ? { actie: "opbouwweek", tssPct: HEROPBOUW_CONSTANTEN.TSS_PCT_OPBOUW_VERLAAGD, duurDagen }
      : { actie: "lichte_week", tssPct: HEROPBOUW_CONSTANTEN.TSS_PCT_HERSTEL, duurDagen };
  }

  // reden "vakantie"/"anders": TSS-ratio bepaalt of het pad één stap lichter wordt.
  const verwachteTss = verwachteTssVoorPeriode(plan, periode);
  const geleverdeTss = await berekenGeleverdeTssInPeriode(userId, periode.startDatum, periode.eindDatum);
  const ratio = verwachteTss > 0 ? geleverdeTss / verwachteTss : 0;
  const actiefGebleven = ratio >= HEROPBOUW_CONSTANTEN.RATIO_DREMPEL_OVERIG;

  if (isLangePeriode) {
    return actiefGebleven
      ? { actie: "lichte_week", tssPct: HEROPBOUW_CONSTANTEN.TSS_PCT_HERSTEL, duurDagen, ratio }
      : { actie: "opbouwweek", tssPct: HEROPBOUW_CONSTANTEN.TSS_PCT_OPBOUW_VERLAAGD, duurDagen, ratio };
  }
  return actiefGebleven
    ? { actie: "geen", duurDagen, ratio }
    : { actie: "lichte_week", tssPct: HEROPBOUW_CONSTANTEN.TSS_PCT_HERSTEL, duurDagen, ratio };
}

/**
 * Terugkeer-detectie (onderdeel 4) — bedoeld om dagelijks vanuit cron/morning
 * aangeroepen te worden (draait voor élke actieve gebruiker, ongeacht nieuwe
 * ritten; cron/sync draait alleen bij een nieuwe activiteit en is dus geen
 * betrouwbare plek voor een puur datumgedreven check).
 *
 * Idempotent: een periode met heropbouwToegepast: true wordt genegeerd, dus
 * een volgende run doet nooit een dubbele insertie.
 */
export async function verwerkTerugkeerDetectie(userId, vandaag = vandaagISO()) {
  const kv = getKV();
  const key = afwezigheidKey(userId);
  const periodes = (await kv.get(key)) || [];
  const teVerwerken = periodes.filter(p =>
    p.status === "actief" && p.eindDatum !== null && p.eindDatum <= vandaag && !p.heropbouwToegepast
  );
  if (teVerwerken.length === 0) return { verwerkt: 0 };

  const planKey = `${userId}:seizoensplan`;
  let verwerkt = 0;

  for (const periode of teVerwerken) {
    const plan = await kv.get(planKey);
    const { actie, tssPct } = plan
      ? await bepaalHeropbouwActie(plan, userId, periode)
      : { actie: "geen" };

    if (actie !== "geen" && plan?.startdatum && plan?.kader) {
      const weekNr = weeknummerVoorDatum(vandaag, plan.startdatum);
      const weektype = actie === "opbouwweek" ? "opbouw" : "herstel";
      await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
        const toegepast = voegExtraWeekToe(versPlan, weekNr, { weektype, tssPct });
        if (toegepast) {
          versPlan.afwezigheid_heropbouw_toegepast_op = [
            ...(versPlan.afwezigheid_heropbouw_toegepast_op || []),
            periode.periodeId,
          ];
        }
      });
    }

    // Periode-boekhouding staat onder een eigen KV-sleutel, los van het plan —
    // verse lezen vlak vóór schrijven, zelfde voorzichtigheid als
    // bijwerkPlanVeilig, voor het geval een gelijktijdige aanmaak/annulering
    // de array intussen heeft gewijzigd.
    const versePeriodes = (await kv.get(key)) || [];
    const versePeriode = versePeriodes.find(p => p.periodeId === periode.periodeId);
    if (versePeriode) {
      versePeriode.heropbouwToegepast = true;
      versePeriode.status = "afgerond";
      await kv.set(key, versePeriodes);
    }

    await maakMelding(userId, "afwezigheid_afgerond", {
      reden: periode.reden,
      actie,
      duurDagen: Math.round((new Date(periode.eindDatum) - new Date(periode.startDatum)) / 86400000) + 1,
    });
    verwerkt++;
  }

  return { verwerkt };
}
