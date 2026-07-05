// Efficiency Factor (EF = NP / gem. hartslag) als longitudinale trendlijn per
// intensiteitsband — anders dan cardiac decoupling (Pw:Hr-drift BINNEN één rit)
// vergelijkt dit OVER meerdere ritten heen of dezelfde inspanning meer watt
// oplevert voor dezelfde hartslag. Banden zijn onderling niet vergelijkbaar
// (Z2 EF vs. drempel EF zijn geen appels-met-appels), dus vier losse trendlijnen.
//
// Er bestaat geen koppeling tussen archetype-blokdefinities (sessiegeneratie,
// vooraf) en de ruwe stream van een gereden activiteit (zie onderzoek EF-prompt,
// chunk 0 vraag 3) — "werkblokken" in een reeds gereden intervalsessie worden
// daarom per seconde afgeleid via vermogensdrempel (%FTP), niet via de
// oorspronkelijke sessieplanning. Bandgrenzen zijn de bestaande Coggan-IF-tabel
// uit rittype.js (sweetspot 85-95%, drempel 95-100%, vo2max 100-110%) — dezelfde
// bron die al gebruikt wordt om hele ritten te classificeren, zodat de EF-banden
// semantisch overeenkomen met wat de rest van de app al "sweetspot"/"drempel"/
// "vo2max" noemt.

import { berekenNP } from "./np";
import { filterNulWatt } from "./decoupling";
import { classificeerRit } from "./rittype";

const RIT_TYPE_NAAR_BAND = { duur_lang: "z2", sweetspot: "sweetspot", drempel: "drempel", vo2max: "vo2max" };

const Z2_GRENZEN = { minPct: 55, maxPct: 75 };
const BAND_GRENZEN = {
  sweetspot: { minPct: 85, maxPct: 95 },
  drempel: { minPct: 95, maxPct: 100 },
  vo2max: { minPct: 100, maxPct: 110 },
};

const NP_VENSTER = 30;
const MIN_WERK_SECONDEN = 180; // <3 min geselecteerde data is te ruisgevoelig voor een zinvolle EF
const CAP_DATAPUNTEN = 20;

/**
 * Berekent Efficiency Factor over een geselecteerd deel van een rit.
 * @param {number[]} vermogenStream - vermogen per seconde (alleen het geselecteerde deel)
 * @param {number[]} hrStream - hartslag per seconde (zelfde deel, zelfde lengte)
 * @returns {number|null} EF (NP/gemHR), of null bij ontbrekende/onvoldoende HR-data
 */
export function berekenEF(vermogenStream, hrStream) {
  if (!vermogenStream?.length || !hrStream?.length) return null;
  const n = Math.min(vermogenStream.length, hrStream.length);
  const { watts, heartrate } = filterNulWatt(vermogenStream.slice(0, n), hrStream.slice(0, n));
  if (watts.length < NP_VENSTER) return null;

  const np = berekenNP(watts);
  if (!np) return null;

  const gemHr = heartrate.reduce((a, b) => a + b, 0) / heartrate.length;
  if (!gemHr) return null;

  return Math.round((np / gemHr) * 1000) / 1000;
}

// Gladgestreken (30-sec rolling) vermogenswaarde per seconde — voorkomt dat
// losse pieken/dalen in instantaan vermogen een seconde verkeerd classificeren.
// Zelfde vensterlengte als berekenNP(), voor consistente "wat is dit voor
// inspanning op dit moment"-classificatie.
function rollingVermogen(watts) {
  const out = new Array(watts.length).fill(null);
  let som = 0;
  for (let i = 0; i < watts.length; i++) {
    som += watts[i];
    if (i >= NP_VENSTER) som -= watts[i - NP_VENSTER];
    if (i >= NP_VENSTER - 1) out[i] = som / NP_VENSTER;
  }
  return out;
}

/**
 * Selecteert de relevante stream-secties voor EF-berekening, per band.
 * Voor 'z2': hele rit, per seconde gefilterd op 55-75% FTP (sluit Z1
 * warming-up/cooldown en eventuele pieken automatisch uit, geen type-filter).
 * Voor 'sweetspot'/'drempel'/'vo2max': alleen seconden waar het gladgestreken
 * vermogen in de doelband valt (sluit hersteldelen tussen intervallen uit).
 * @param {{vermogenStream: number[], hrStream: number[]}} activiteit
 * @param {'z2'|'sweetspot'|'drempel'|'vo2max'} band
 * @param {number} ftp
 * @returns {{vermogen: number[], hr: number[]} | null} null als de rit niet kwalificeert
 */
export function selecteerHoofdblokken(activiteit, band, ftp) {
  const vermogenRuw = activiteit?.vermogenStream;
  const hrRuw = activiteit?.hrStream;
  if (!vermogenRuw?.length || !hrRuw?.length || !ftp) return null;

  const n = Math.min(vermogenRuw.length, hrRuw.length);
  const vermogen = vermogenRuw.slice(0, n);
  const hr = hrRuw.slice(0, n);

  if (band === "z2" && n < 2700) return null; // sectie 22-F: Z2-eligibility >45 min

  const grenzen = band === "z2" ? Z2_GRENZEN : BAND_GRENZEN[band];
  if (!grenzen) return null;

  const rolling = rollingVermogen(vermogen);
  const inBand = rolling.map(w => {
    if (w == null) return false;
    const pct = (w / ftp) * 100;
    return pct > grenzen.minPct && pct <= grenzen.maxPct;
  });

  // Het rollend venster loopt achter (i's classificatie steunt op i-29..i): bij
  // het VERLATEN van de band blijft inBand[i] nog tot ~NP_VENSTER-1 samples
  // "waar" staan terwijl de ruwe stream al in de volgende fase zit — zonder
  // trim zou dat de verkeerde-fase-waarden (bv. hersteldeel na een interval)
  // laten lekken in de selectie. Elke aaneengesloten in-band-reeks wordt daarom
  // aan het eind ingekort met dat venster; bij het BINNENKOMEN van de band is
  // er geen contaminatie (alleen een vertraagde, veilige onderclassificatie).
  const vermogenSelectie = [];
  const hrSelectie = [];
  let i = 0;
  while (i < n) {
    if (!inBand[i]) { i++; continue; }
    let j = i;
    while (j < n && inBand[j]) j++;
    const eind = j - (NP_VENSTER - 1);
    for (let k = i; k < eind; k++) {
      vermogenSelectie.push(vermogen[k]);
      hrSelectie.push(hr[k]);
    }
    i = j;
  }

  if (vermogenSelectie.length < MIN_WERK_SECONDEN) return null;
  return { vermogen: vermogenSelectie, hr: hrSelectie };
}

/**
 * Lineaire regressie over EF-datapunten (datum, ef) → trend (EF/week).
 * ctlRampRegressie() (lib/conditie.js) is niet herbruikbaar: die gebruikt de
 * array-index als x-as en veronderstelt equidistante (dagelijkse) metingen —
 * EF-datapunten liggen onregelmatig verspreid (niet elke dag een kwalificerende
 * rit), dus hier expliciet op echte datumverschillen (in dagen) geregresseerd.
 * @param {{datum: string, ef: number}[]} punten
 * @returns {number|null} trend in EF-verandering per week, of null bij <4 punten
 */
export function berekenEFTrend(punten) {
  if (!punten?.length || punten.length < 4) return null;

  const gesorteerd = [...punten].sort((a, b) => a.datum.localeCompare(b.datum));
  const t0 = new Date(gesorteerd[0].datum).getTime();
  const dagenSindsStart = gesorteerd.map(p => (new Date(p.datum).getTime() - t0) / 86400000);
  const efWaarden = gesorteerd.map(p => p.ef);

  const n = dagenSindsStart.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += dagenSindsStart[i];
    sumY += efWaarden[i];
    sumXY += dagenSindsStart[i] * efWaarden[i];
    sumX2 += dagenSindsStart[i] * dagenSindsStart[i];
  }
  const noemer = n * sumX2 - sumX * sumX;
  if (noemer === 0) return null; // alle punten op dezelfde dag — geen tijdsspreiding

  const hellingPerDag = (n * sumXY - sumX * sumY) / noemer;
  return Math.round(hellingPerDag * 7 * 1000) / 1000;
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

async function haalStreamsOp(activiteitId, apiKey) {
  const streams = await fetch(`https://intervals.icu/api/v1/activity/${activiteitId}/streams?types=watts,heartrate`, {
    headers: { Authorization: "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64") },
  }).then(r => r.json());
  const watts = (Array.isArray(streams) ? streams.find(s => s.type === "watts") : streams?.watts)?.data || [];
  const heartrate = (Array.isArray(streams) ? streams.find(s => s.type === "heartrate") : streams?.heartrate)?.data || [];
  return { watts, heartrate };
}

/**
 * Verwerkt één gereden activiteit voor de EF-trend: bepaalt de band via de
 * bestaande sectie 33-classificatie, checkt eligibility/dedupe, haalt zo nodig
 * de ruwe stream op en pusht een datapunt. Gedeeld tussen de live sync-cron en
 * de eenmalige backfill, zodat beide paden identiek gedrag hebben.
 * @returns {Promise<string|null>} de band waarvoor een datapunt is toegevoegd, of null
 */
export async function verwerkRitVoorEf(kv, userId, rit, ftp, apiKey) {
  const np = rit.icu_weighted_avg_watts;
  if (!np) return null;

  const classificatie = classificeerRit({ np, avgWatts: rit.average_watts }, ftp);
  const band = RIT_TYPE_NAAR_BAND[classificatie.type];
  if (!band) return null;

  const duurMin = (rit.moving_time || 0) / 60;
  if (band === "z2" && duurMin < 45) return null;

  const datum = rit.start_date_local?.split("T")[0];
  if (!datum) return null;

  const bestaandeReeks = await haalEfTrendOp(kv, userId, band);
  if (bestaandeReeks.some(p => p.activityId === rit.id)) return null;

  const { watts, heartrate } = await haalStreamsOp(rit.id, apiKey);
  const selectie = selecteerHoofdblokken({ vermogenStream: watts, hrStream: heartrate }, band, ftp);
  if (!selectie) return null;

  const ef = berekenEF(selectie.vermogen, selectie.hr);
  if (ef == null) return null;

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

    const resp = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${achtWekenGeleden}&newest=${vandaag}&fields=id,start_date_local,type,moving_time,icu_weighted_avg_watts,average_watts`, {
      headers: { Authorization: auth },
    });
    const acts = await resp.json();
    const ritten = (acts || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");

    let verwerkt = 0, overgeslagen = 0;
    for (const rit of ritten) {
      try {
        const band = await verwerkRitVoorEf(kv, userId, rit, ftpWaarde, apiKey);
        if (band) verwerkt++; else overgeslagen++;
        await new Promise(r => setTimeout(r, 300));
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
