// I/O-laag voor fitnessprogressie (zie src/lib/fitnessprogressie.js voor de
// pure berekening). Analoog aan hoe conditie.js (pure) en cron/sync/route.js
// (I/O) al gescheiden zijn — hier gescheiden in twee bestanden omdat deze I/O
// ook los, vanuit de wekelijkse volumeCorrectie-job, aangeroepen wordt.
import { getKV } from "./kv";
import { getIntervalsCredentials } from "./users";
import { intervalsGet } from "./intervals";
import { datumOffset } from "./datum";
import { weeknummerVoorDatum } from "./weekgrenzen";
import { berekenFitnessprogressie } from "./fitnessprogressie";

// 8-10 weken venster (zie fitnessprogressie-en-kracht-fase-check.md, Deel A) —
// 70 dagen = 10 weken, ruim boven CTL_TREND_MIN_DAGEN zodat de regressie altijd
// het volledige gevraagde venster ziet zodra er genoeg geschiedenis is.
const CTL_TREND_VENSTER_DAGEN = 70;
const DECOUPLING_TREND_VENSTER_DAGEN = 70;

/**
 * @param {string} userId
 * @param {number} [dagen]
 * @param {Array|null} [wellDataVooraf] - al opgehaalde, rauwe /wellness-respons
 *   (moet minimaal `id`/`ctl` per dag bevatten) — als meegegeven, wordt er
 *   geen eigen intervals.icu-call gedaan. Zie sync/route.js: conditiescore
 *   haalt daar al wellness op in hetzelfde verzoek, dus die wordt hier
 *   hergebruikt i.p.v. een tweede keer opgehaald.
 */
export async function haalCtlReeksVoorTrend(userId, dagen = CTL_TREND_VENSTER_DAGEN, wellDataVooraf = null) {
  try {
    let wellData = wellDataVooraf;
    if (!wellData) {
      const creds = await getIntervalsCredentials(userId);
      if (!creds) return [];
      wellData = await intervalsGet("/wellness", {
        oldest: datumOffset(-dagen), newest: datumOffset(0), fields: "id,ctl",
      }, creds);
    }
    return (wellData || [])
      .filter(w => w.ctl != null && w.id)
      .map(w => ({ datum: w.id, ctl: w.ctl }))
      .sort((a, b) => a.datum.localeCompare(b.datum));
  } catch {
    return [];
  }
}

/**
 * Alle kwalificerende decoupling-punten (zelfde eligibiliteit als
 * bepaalDecouplingMedianen()/haalDecouplingMediaan: Ride/VirtualRide, ≥45 min,
 * IF 0,55-0,75) in de periode, met datum — voor de trendregressie. In
 * tegenstelling tot haalDecouplingMediaan() (volumeCorrectie.js, mediaan van
 * laatste N) geeft dit de volledige puntenwolk terug.
 *
 * @param {string} userId
 * @param {number} [dagen]
 * @param {Array|null} [activiteitenVooraf] - al opgehaalde, rauwe
 *   /activities-respons (moet minimaal `id,type,start_date_local,moving_time,
 *   icu_weighted_avg_watts` per rit bevatten) — als meegegeven, wordt er geen
 *   eigen intervals.icu-call gedaan.
 */
export async function haalDecouplingReeksVoorTrend(userId, dagen = DECOUPLING_TREND_VENSTER_DAGEN, activiteitenVooraf = null) {
  try {
    const kv = getKV();
    const plan = await kv.get(`${userId}:seizoensplan`);
    const ftp = plan?.huidige_ftp || 265;

    let activiteiten = activiteitenVooraf;
    if (!activiteiten) {
      const creds = await getIntervalsCredentials(userId);
      if (!creds) return [];
      activiteiten = await intervalsGet("/activities", {
        oldest: datumOffset(-dagen), newest: datumOffset(0), limit: "100",
        fields: "id,type,start_date_local,moving_time,icu_weighted_avg_watts",
      }, creds);
    }
    if (!activiteiten?.length) return [];

    const kwalificerend = activiteiten.filter(a => {
      if (a.type !== "Ride" && a.type !== "VirtualRide") return false;
      const duurMin = (a.moving_time || 0) / 60;
      if (duurMin < 45) return false;
      if (!a.icu_weighted_avg_watts) return false;
      const ifVal = a.icu_weighted_avg_watts / ftp;
      return ifVal >= 0.55 && ifVal <= 0.75;
    });

    const punten = [];
    for (const rit of kwalificerend) {
      const dc = await kv.get(`decoupling:${rit.id}`);
      if (dc == null) continue;
      const waarde = typeof dc === "number" ? dc : dc?.decoupling;
      const isHitte = typeof dc === "object" && (dc?.hitte_gecorrigeerd ?? false);
      if (waarde == null || isHitte) continue;
      const datum = rit.start_date_local?.slice(0, 10);
      if (datum) punten.push({ datum, waarde });
    }
    return punten.sort((a, b) => a.datum.localeCompare(b.datum));
  } catch {
    return [];
  }
}

/**
 * FTP-test-ankerpunten voor de trendgrafiek: elke kaderweek met
 * `bevat_tussentijdse_ftp_test` (altijd week 3, zie bouwKader.js), plus de
 * werkelijke datum zodra de bijbehorende sessie is voltooid (intentie.rol ===
 * "ftp_test", inclusief handmatig gemarkeerde tests via
 * /api/sessie/markeer-als-test, die dezelfde rol krijgen).
 */
export async function haalFtpTestMarkers(userId) {
  try {
    const kv = getKV();
    const plan = await kv.get(`${userId}:seizoensplan`);
    if (!plan?.kader) return [];

    const kaderMarkers = plan.kader
      .filter(w => w.bevat_tussentijdse_ftp_test)
      .map(w => ({ week: w.week, datum: null }));

    const sessieMarkers = (plan.weekSessies?.sessies || [])
      .filter(s => s.intentie?.rol === "ftp_test" && s.voltooid && s.datum)
      .map(s => ({
        week: plan.startdatum ? weeknummerVoorDatum(s.datum, plan.startdatum) : null,
        datum: s.datum,
      }));

    // Merge: voltooide sessie-datum vult de kaderweek aan als ze samenvallen,
    // losse sessies (bv. handmatig gemarkeerd buiten een geplande testweek om)
    // blijven als eigen ankerpunt staan.
    const merged = [...kaderMarkers];
    for (const sm of sessieMarkers) {
      const idx = merged.findIndex(m => m.week === sm.week);
      if (idx >= 0) merged[idx] = { ...merged[idx], datum: sm.datum };
      else merged.push(sm);
    }
    return merged.sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
  } catch {
    return [];
  }
}

/**
 * Berekent de fitnessprogressie en schrijft 'm naar KV
 * (`fitnessprogressie:{userId}`, TTL 90 dagen). Aangeroepen vanuit
 * cron/sync/route.js (beide paden — idempotent en nieuwe-activiteit), waar
 * conditiescore al wellness/activities heeft opgehaald in hetzelfde verzoek.
 * Best-effort: fouten hier mogen de aanroepende job nooit breken, dus caller
 * vangt dit af.
 * @param {string} userId
 * @param {{wellData?: Array|null, activiteiten?: Array|null}} [vooraf] - al
 *   opgehaalde rauwe intervals.icu-data, zie haalCtlReeksVoorTrend()/
 *   haalDecouplingReeksVoorTrend() voor de vereiste velden. Weglaten = eigen
 *   fetch (bv. voor het admin-endpoint, dat geen voorafgaande fetch heeft).
 */
export async function berekenEnSlaFitnessprogressieOp(userId, { wellData = null, activiteiten = null } = {}) {
  const kv = getKV();
  const [ctlReeks, decouplingReeks, ftpTestMarkers] = await Promise.all([
    haalCtlReeksVoorTrend(userId, CTL_TREND_VENSTER_DAGEN, wellData),
    haalDecouplingReeksVoorTrend(userId, DECOUPLING_TREND_VENSTER_DAGEN, activiteiten),
    haalFtpTestMarkers(userId),
  ]);
  const resultaat = berekenFitnessprogressie({ ctlReeks, decouplingReeks, ftpTestMarkers });
  await kv.set(`fitnessprogressie:${userId}`, resultaat, { ex: 90 * 86400 });
  return resultaat;
}

/**
 * Leest de laatst berekende fitnessprogressie (zie berekenFitnessprogressie,
 * fitnessprogressie.js), tot nu toe geen bestaande leesfunctie — alleen de
 * schrijfkant (berekenEnSlaFitnessprogressieOp) bestond. Puur-lezend.
 * @param {object} kv
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function leesFitnessprogressie(kv, userId) {
  return (await kv.get(`fitnessprogressie:${userId}`)) ?? null;
}
