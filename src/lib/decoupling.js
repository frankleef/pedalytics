// Cardiac decoupling: overgenomen van intervals.icu's eigen Activity.decoupling
// (Pw:Hr-drift eerste vs. tweede rithelft) i.p.v. zelf uit de ruwe streams
// herberekend. intervals.icu levert dit als kant-en-klaar veld op de
// /activities-lijst (fields=...,decoupling) en op de losse /activity/{id}-call.

import { getKV } from "./kv";

// Bloktrend-drempel (D2 faseovergang-uitstel, D3 blok-volumecorrectie):
// mediaan cardiac decoupling over meerdere ritten. Canonieke bron — ook
// gebruikt door bepaalVolumeCorrectie (volumeCorrectie.js), die 'm importeert
// i.p.v. een eigen kopie van 7 te hardcoden. Los van instorting.js se
// DECOUPLING_BOOST_DREMPEL (E1): dat meet een ANDER concept (rit-EIGEN,
// whole-ride decoupling van één specifieke rit, geen mediaan over meerdere
// ritten) — toevallig dezelfde waarde, bewust niet samengevoegd.
export const DECOUPLING_BLOKTREND_DREMPEL = 7;

/**
 * Cachet de door intervals.icu berekende cardiac decoupling voor een activiteit.
 * @param {number|string} activiteitId
 * @param {number|null|undefined} decouplingRuw - Activity.decoupling van intervals.icu
 * @returns {Promise<number|null>}
 */
export async function cacheDecoupling(activiteitId, decouplingRuw) {
  const kv = getKV();
  const cacheKey = `decoupling:${activiteitId}`;

  const cached = await kv.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  if (decouplingRuw == null) return null;
  const afgerond = Math.round(decouplingRuw * 10) / 10;
  await kv.set(cacheKey, afgerond);
  return afgerond;
}

/**
 * Controleert of een fase-overgang uitgesteld moet worden op basis van decoupling.
 */
export function checkFaseOvergang(decouplingWaarden, aantalVerlengingen = 0) {
  if (decouplingWaarden.length === 0) return { uitstel: false, mediaan: 0 };

  const gesorteerd = [...decouplingWaarden].sort((a, b) => a - b);
  const mid = Math.floor(gesorteerd.length / 2);
  const mediaan = gesorteerd.length % 2 === 0
    ? (gesorteerd[mid - 1] + gesorteerd[mid]) / 2
    : gesorteerd[mid];

  const uitstel = mediaan > DECOUPLING_BLOKTREND_DREMPEL && aantalVerlengingen < 2;

  return { uitstel, mediaan: Math.round(mediaan * 10) / 10 };
}

/**
 * Eenmalige backfill: cachet decoupling voor alle historische Z2-ritten, direct
 * uit het Activity.decoupling-veld van intervals.icu (geen streams meer nodig).
 */
export async function backfillDecoupling(userId, ftpWaarde, apiKey, athleteId) {
  const kv = getKV();
  await kv.set(`decoupling_backfill_gestart:${userId}`, "true");

  try {
    const tweeJaarGeleden = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);
    const vandaag = new Date().toISOString().slice(0, 10);
    const auth = "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64");

    const resp = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${tweeJaarGeleden}&newest=${vandaag}&fields=id,start_date_local,type,moving_time,icu_weighted_avg_watts,decoupling`, {
      headers: { Authorization: auth },
    });
    const acts = await resp.json();
    const z2Ritten = (acts || []).filter(a => {
      if (a.type !== "Ride" && a.type !== "VirtualRide") return false;
      if (!a.icu_weighted_avg_watts || !a.moving_time || a.moving_time < 2700) return false;
      const ifVal = a.icu_weighted_avg_watts / ftpWaarde;
      return ifVal >= 0.55 && ifVal <= 0.75;
    });

    let verwerkt = 0, overgeslagen = 0;
    for (const rit of z2Ritten) {
      const bestaand = await kv.get(`decoupling:${rit.id}`);
      if (bestaand != null) { overgeslagen++; continue; }

      const dc = await cacheDecoupling(rit.id, rit.decoupling);
      if (dc != null) verwerkt++; else overgeslagen++;
    }

    await kv.set(`decoupling_backfill_voltooid:${userId}`, { datum: new Date().toISOString(), verwerkt, overgeslagen, totaalZ2: z2Ritten.length });
    await bijwerkenDecouplingBaseline(userId).catch(() => {});
    console.log(`[backfill] ${userId}: ${verwerkt} verwerkt, ${overgeslagen} overgeslagen van ${z2Ritten.length} Z2-ritten`);
  } catch (e) {
    console.error("[backfill] Job mislukt:", e);
    await kv.del(`decoupling_backfill_gestart:${userId}`);
  }
}

/**
 * Berekent en slaat de persoonlijke decoupling-baseline op (mediaan + trend).
 */
export async function bijwerkenDecouplingBaseline(userId) {
  const kv = getKV();
  const plan = await kv.get(`${userId}:seizoensplan`);
  const sessies = plan?.weekSessies?.sessies || [];

  const waarden = [];
  for (const s of sessies) {
    if (!s.datum || !s.voltooid) continue;
    const dc = await kv.get(`decoupling:${s.intervalsEventId || s.id || s.datum}`);
    if (dc != null) waarden.push({ waarde: dc, datum: s.datum });
  }

  if (waarden.length < 6) return null;

  const gesorteerd = waarden.map(w => w.waarde).sort((a, b) => a - b);
  const mid = Math.floor(gesorteerd.length / 2);
  const mediaan = gesorteerd.length % 2 === 0
    ? (gesorteerd[mid - 1] + gesorteerd[mid]) / 2
    : gesorteerd[mid];

  const opDatum = waarden.sort((a, b) => b.datum.localeCompare(a.datum));
  const laatste3 = opDatum.slice(0, 3).map(w => w.waarde);
  const vorige3 = opDatum.slice(3, 6).map(w => w.waarde);
  const gemLaatste = laatste3.reduce((a, b) => a + b, 0) / laatste3.length;
  const gemVorige = vorige3.reduce((a, b) => a + b, 0) / vorige3.length;
  const trend = gemLaatste - gemVorige;

  const baseline = {
    mediaan: Math.round(mediaan * 10) / 10,
    trend: Math.round(trend * 10) / 10,
    aantalMetingen: waarden.length,
    bijgewerkt: new Date().toISOString(),
  };

  await kv.set(`decoupling_baseline:${userId}`, baseline);
  return baseline;
}

/**
 * Leest de laatst berekende decoupling-baseline ({mediaan, trend,
 * aantalMetingen, bijgewerkt}), tot nu toe alleen inline gelezen in
 * api/plan/decoupling-baseline/route.js. Puur-lezend, geen herevaluatie.
 * @param {object} kv
 * @param {string} userId
 * @returns {Promise<{mediaan: number, trend: number, aantalMetingen: number, bijgewerkt: string}|null>}
 */
export async function leesDecouplingBaseline(kv, userId) {
  return (await kv.get(`decoupling_baseline:${userId}`)) ?? null;
}
