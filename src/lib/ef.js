// Efficiency Factor (EF = NP / gem. hartslag) als longitudinale trendlijn per
// intensiteitsband — anders dan cardiac decoupling (Pw:Hr-drift BINNEN één rit)
// vergelijkt dit OVER meerdere ritten heen of dezelfde inspanning meer watt
// oplevert voor dezelfde hartslag. Banden zijn onderling niet vergelijkbaar
// (Z2 EF vs. drempel EF zijn geen appels-met-appels: bij hogere intensiteit
// verzadigt hartslag richting HRmax en groeit de anaerobe bijdrage aan
// vermogen, wat NP/HR opdrijft los van aerobe fitheid), dus vier losse
// trendlijnen.
//
// EF wordt overgenomen uit intervals.icu's eigen Activity.icu_efficiency_factor
// i.p.v. zelf uit de ruwe streams herberekend — dat is een whole-ride getal
// (geen los per-band/per-interval veld beschikbaar), dus eligibility filtert
// hier nog steeds op de bestaande sectie 33-classificatie (IF-band van de
// hele rit) zodat alleen ritten die overwegend in één band gereden zijn een
// datapunt opleveren. Voor sweetspot/drempel/vo2max-ritten met langere
// hersteldelen tussen intervallen zit er wél verdunning in t.o.v. de oude
// per-seconde-in-band-berekening: whole-ride gem.HR daalt door de
// hersteldelen terwijl NP daar al voor corrigeert, dus EF valt structureel
// iets hoger uit dan "zuiver op de werkblokken". Geaccepteerd trade-off voor
// het niet meer zelf hoeven ophalen/verwerken van streams.

import { classificeerRit } from "./rittype";
import { berekenLineaireTrendPerWeek } from "./trend";

const RIT_TYPE_NAAR_BAND = { duur_lang: "z2", sweetspot: "sweetspot", drempel: "drempel", vo2max: "vo2max" };

const CAP_DATAPUNTEN = 20;

/**
 * Lineaire regressie over EF-datapunten (datum, ef) → trend (EF/week).
 * Dunne wrapper om de gedeelde, generieke regressiekern (trend.js) — zie
 * die functie voor waarom hier bewust datum- i.p.v. index-gebaseerd gekozen
 * is: EF-datapunten liggen onregelmatig verspreid (niet elke dag een
 * kwalificerende rit).
 * @param {{datum: string, ef: number}[]} punten
 * @returns {number|null} trend in EF-verandering per week, of null bij <4 punten
 */
export function berekenEFTrend(punten) {
  if (!punten?.length) return null;
  const resultaat = berekenLineaireTrendPerWeek(punten.map(p => ({ datum: p.datum, waarde: p.ef })));
  if (resultaat == null) return null;
  return Math.round(resultaat.hellingPerWeek * 1000) / 1000;
}

function efTrendKey(userId, band) {
  return `ef_trend:${userId}:${band}`;
}

/**
 * Voegt een EF-datapunt toe aan de tijdreeks van een band (dedupe op
 * activityId, gesorteerd op datum, gecapt op de laatste 20 punten).
 */
export async function voegEfDatapuntToe(kv, userId, band, punt) {
  const bestaande = (await kv.get(efTrendKey(userId, band))) || [];
  const zonderDupe = bestaande.filter(p => p.activityId !== punt.activityId);
  const bijgewerkt = [...zonderDupe, punt]
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(-CAP_DATAPUNTEN);
  await kv.set(efTrendKey(userId, band), bijgewerkt);
  return bijgewerkt;
}

export async function haalEfTrendOp(kv, userId, band) {
  return (await kv.get(efTrendKey(userId, band))) || [];
}

/**
 * Verwerkt één gereden activiteit voor de EF-trend: bepaalt de band via de
 * bestaande sectie 33-classificatie, checkt eligibility/dedupe en pusht een
 * datapunt met intervals.icu's eigen icu_efficiency_factor. Gedeeld tussen de
 * live sync-cron en de eenmalige backfill, zodat beide paden identiek gedrag
 * hebben.
 * @returns {Promise<string|null>} de band waarvoor een datapunt is toegevoegd, of null
 */
export async function verwerkRitVoorEf(kv, userId, rit, ftp) {
  const np = rit.icu_weighted_avg_watts;
  if (!np) return null;

  // E1: een (mogelijk/waarschijnlijk) ingestorte rit levert geen betrouwbaar
  // EF-datapunt op — de gemiddelde efficiëntie over de hele rit wordt dan
  // vertekend door het instortingsdeel. Skip stil, geen backfill van
  // historische data (zie instorting.js).
  const instorting = await kv.get(`segment_instorting:${userId}:${rit.id}`);
  if (instorting?.mogelijkIngestort || instorting?.waarschijnlijkIngestort) return null;

  const classificatie = classificeerRit({ np, avgWatts: rit.average_watts }, ftp);
  const band = RIT_TYPE_NAAR_BAND[classificatie.type];
  if (!band) return null;

  const duurMin = (rit.moving_time || 0) / 60;
  if (band === "z2" && duurMin < 45) return null;

  const datum = rit.start_date_local?.split("T")[0];
  if (!datum) return null;

  const ef = rit.icu_efficiency_factor;
  if (ef == null) return null;

  const bestaandeReeks = await haalEfTrendOp(kv, userId, band);
  if (bestaandeReeks.some(p => p.activityId === rit.id)) return null;

  await voegEfDatapuntToe(kv, userId, band, { datum, ef, activityId: rit.id });
  return band;
}

/**
 * Eenmalige backfill: verwerkt de laatste ~8 weken activiteiten zodat de vier
 * EF-trendlijnen niet leeg starten na deploy. Gedraagt zich verder als
 * backfillDecoupling() (lib/decoupling.js): eigen gestart/voltooid-KV-vlaggen,
 * fire-and-forget vanuit de sync-cron.
 */
export async function backfillEf(kv, userId, ftpWaarde, apiKey, athleteId) {
  await kv.set(`ef_backfill_gestart:${userId}`, "true");

  try {
    const achtWekenGeleden = new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10);
    const vandaag = new Date().toISOString().slice(0, 10);
    const auth = "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64");

    const resp = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${achtWekenGeleden}&newest=${vandaag}&fields=id,start_date_local,type,moving_time,icu_weighted_avg_watts,average_watts,icu_efficiency_factor`, {
      headers: { Authorization: auth },
    });
    const acts = await resp.json();
    const ritten = (acts || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");

    let verwerkt = 0, overgeslagen = 0;
    for (const rit of ritten) {
      try {
        const band = await verwerkRitVoorEf(kv, userId, rit, ftpWaarde);
        if (band) verwerkt++; else overgeslagen++;
      } catch (e) {
        console.warn(`[ef-backfill] Rit ${rit.id} mislukt:`, e.message);
        overgeslagen++;
      }
    }

    await kv.set(`ef_backfill_voltooid:${userId}`, { datum: new Date().toISOString(), verwerkt, overgeslagen, totaalRitten: ritten.length });
    console.log(`[ef-backfill] ${userId}: ${verwerkt} datapunten toegevoegd, ${overgeslagen} overgeslagen van ${ritten.length} ritten`);
  } catch (e) {
    console.error("[ef-backfill] Job mislukt:", e);
    await kv.del(`ef_backfill_gestart:${userId}`);
  }
}
