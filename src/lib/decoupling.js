// Cardiac decoupling: NP-gebaseerd met arbeidssplit.

import { getKV } from "./kv";

function berekenNP(watts) {
  if (!watts?.length || watts.length < 30) return null;
  const rolling = [];
  for (let i = 29; i < watts.length; i++) {
    let som = 0;
    for (let j = i - 29; j <= i; j++) som += watts[j];
    rolling.push(som / 30);
  }
  let som4 = 0;
  for (const w of rolling) som4 += Math.pow(w, 4);
  return Math.pow(som4 / rolling.length, 0.25);
}

function splitOpArbeid(watts, heartrate) {
  const totaal = watts.reduce((a, w) => a + w, 0);
  const helft = totaal / 2;
  let cumulatief = 0;
  let splitIndex = Math.floor(watts.length / 2);
  for (let i = 0; i < watts.length; i++) {
    cumulatief += watts[i];
    if (cumulatief >= helft) { splitIndex = i; break; }
  }
  return {
    watts_eerste: watts.slice(0, splitIndex),
    watts_tweede: watts.slice(splitIndex),
    hr_eerste: heartrate.slice(0, splitIndex),
    hr_tweede: heartrate.slice(splitIndex),
  };
}

function filterNulWatt(watts, heartrate) {
  const wGef = [], hrGef = [];
  for (let i = 0; i < watts.length; i++) {
    if (watts[i] > 0 && heartrate[i] > 0) { wGef.push(watts[i]); hrGef.push(heartrate[i]); }
  }
  return { watts: wGef, heartrate: hrGef };
}

/**
 * Berekent cardiac decoupling via EF = NP / gem HR per arbeidssplit.
 * @param {number[]} rawWatts
 * @param {number[]} rawHr
 * @returns {number|null} decoupling in procent (positief = drift)
 */
export function berekenDecoupling(rawWatts, rawHr) {
  if (!rawWatts?.length || !rawHr?.length) return null;
  const n = Math.min(rawWatts.length, rawHr.length);
  const { watts, heartrate } = filterNulWatt(rawWatts.slice(0, n), rawHr.slice(0, n));
  if (watts.length < 2700) return null;

  const { watts_eerste, watts_tweede, hr_eerste, hr_tweede } = splitOpArbeid(watts, heartrate);

  const np1 = berekenNP(watts_eerste);
  const np2 = berekenNP(watts_tweede);
  if (!np1 || !np2) return null;

  const gemHr1 = hr_eerste.reduce((a, b) => a + b, 0) / hr_eerste.length;
  const gemHr2 = hr_tweede.reduce((a, b) => a + b, 0) / hr_tweede.length;
  if (!gemHr1 || !gemHr2) return null;

  const ef1 = np1 / gemHr1;
  const ef2 = np2 / gemHr2;

  return ((ef1 - ef2) / ef1) * 100;
}

/**
 * Berekent en cachet decoupling voor een activiteit.
 */
export async function berekenEnCacheDecoupling(activiteitId, watts, heartrate) {
  const kv = getKV();
  const cacheKey = `decoupling:${activiteitId}`;

  const cached = await kv.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const result = berekenDecoupling(watts, heartrate);
  if (result !== null) {
    await kv.set(cacheKey, Math.round(result * 10) / 10);
  }

  return result;
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

  const uitstel = mediaan > 7 && aantalVerlengingen < 2;

  return { uitstel, mediaan: Math.round(mediaan * 10) / 10 };
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
