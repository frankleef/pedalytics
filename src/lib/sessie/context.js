// Assembleert de volledige context voor het genereren/aanpassen van één sessiedag.
// Bouwstuk 3: elke sessie-aanroep krijgt dezelfde, complete context mee.

import { getIntervalsCredentials } from "../users";
import { intervalsGet } from "../intervals";
import { zoneTimesNaarObject } from "../uitvoeringsscore";

/**
 * Bepaalt wat er deze week al daadwerkelijk geleverd is (gereden ritten),
 * voor gebruik als `alGeleverd` in solveWeek() (sectie 48). Haalt echte
 * activiteiten op via de bestaande intervals.icu-ophaallogica (zelfde
 * fields-conventie als cron/sync/route.js) i.p.v. te vertrouwen op de
 * mogelijk verouderde tss/voltooid-velden in het opgeslagen seizoensplan.
 *
 * @param {string} userId
 * @param {string} weekStart - ISO-datum (maandag van de lopende week)
 * @returns {Promise<{tss: number, z2Minuten: number, totaalMinuten: number}>}
 */
export async function bepaalAlGeleverd(userId, weekStart) {
  const leeg = { tss: 0, z2Minuten: 0, totaalMinuten: 0 };

  const creds = await getIntervalsCredentials(userId);
  if (!creds) return leeg;

  const vandaag = new Date().toISOString().slice(0, 10);
  let activiteiten;
  try {
    activiteiten = await intervalsGet("/activities", {
      oldest: weekStart,
      newest: vandaag,
      fields: "id,start_date_local,type,icu_training_load,moving_time,icu_zone_times",
    }, creds);
  } catch (e) {
    console.warn(`[bepaalAlGeleverd] intervals.icu-ophalen mislukt voor ${userId}:`, e.message);
    return leeg;
  }

  const ritten = (activiteiten || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");
  if (ritten.length === 0) return leeg;

  let tss = 0;
  let z2Seconden = 0;
  let totaalSeconden = 0;

  for (const rit of ritten) {
    tss += rit.icu_training_load ?? 0;
    totaalSeconden += rit.moving_time ?? 0;
    const tijdInZones = zoneTimesNaarObject(rit.icu_zone_times);
    if (tijdInZones) z2Seconden += tijdInZones.Z2 ?? 0;
  }

  return {
    tss: Math.round(tss),
    z2Minuten: Math.round(z2Seconden / 60),
    totaalMinuten: Math.round(totaalSeconden / 60),
  };
}

/**
 * Haalt wellness (ctl/atl/hrv/...) op voor een specifieke datum — nooit "vandaag"
 * hergebruiken voor een andere dag, want intervals.icu geeft voor toekomstige
 * datums een geprojecteerde CTL/ATL terug op basis van al geplande activiteiten
 * (zie ook sessiesAanvullen.js's per-week-cache voor dezelfde reden). Gedeelde
 * bron voor elke aanroeper van genereerSessieDag() die wellness/TSB-bewust wil
 * zijn: /api/jobs (sessieDag), admin-herbereken-sessies, admin-regenereer-
 * toekomstige-sessies.
 *
 * @param {string} userId
 * @param {string} datum - ISO-datum
 * @param {object|null} [creds] - al opgehaalde intervals.icu-credentials, anders zelf opgehaald
 * @returns {Promise<object|null>}
 */
export async function haalWellnessVoorDatum(userId, datum, creds = null) {
  try {
    const c = creds || await getIntervalsCredentials(userId);
    if (!c) return null;
    const wData = await intervalsGet("/wellness", { oldest: datum, newest: datum }, c);
    return wData?.length > 0 ? wData[0] : null;
  } catch (e) {
    console.warn(`[haalWellnessVoorDatum] wellness-ophalen mislukt voor ${userId} ${datum}:`, e.message);
    return null;
  }
}

