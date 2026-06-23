// Bouwstuk 6a: Automatische FTP-update na ramp test.
// Wordt aangeroepen vanuit de sync-cron wanneer een gematchte rit
// een dag met intentie.rol === "ftp_test" betreft.

import { getKV } from "../kv";
import { getIntervalsCredentials } from "../users";
import { intervalsGet, intervalsPut } from "../intervals";

/**
 * Verwerkt een FTP-test: update FTP en herbereken toekomstige watt-ranges.
 * @param {string} userId
 * @param {object} activity - De gematchte activiteit van intervals.icu
 * @returns {Promise<{updated: boolean, oldFtp?: number, newFtp?: number}>}
 */
export async function verwerkFtpTest(userId, activity) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan) return { updated: false };

  const nieuweFtp = activity.icu_ftp || activity.icu_eftp;
  if (!nieuweFtp) return { updated: false };

  const huidigeFtp = plan.huidige_ftp || 265;
  if (Math.abs(nieuweFtp - huidigeFtp) <= 1) return { updated: false };

  console.log(`[ftpUpdate] ${userId}: FTP ${huidigeFtp}W → ${nieuweFtp}W`);

  // Update plan
  plan.huidige_ftp = nieuweFtp;
  plan.ftp_historie = plan.ftp_historie || [];
  plan.ftp_historie.push({ datum: new Date().toISOString().slice(0, 10), ftp: nieuweFtp });

  // Herbereken watt-ranges in toekomstige sessies
  const vandaag = new Date().toISOString().slice(0, 10);
  if (plan.weekSessies?.sessies) {
    plan.weekSessies.sessies = plan.weekSessies.sessies.map((sessie) => {
      if (sessie.voltooid || sessie.datum < vandaag) return sessie;
      if (!sessie.segmenten) return sessie;

      return {
        ...sessie,
        segmenten: sessie.segmenten.map((seg) => {
          // Segmenten staan in %FTP — de watt-omrekening in de UI
          // gebruikt de huidige FTP, dus segmenten hoeven niet te veranderen.
          // Alleen de vermogen-tekst (absolute watts) updaten.
          return seg;
        }),
        vermogen: sessie.vermogen
          ? sessie.vermogen.replace(/\d+/g, (match, offset) => {
              // Herbereken absolute watts proportioneel
              const oud = parseInt(match);
              return String(Math.round((oud / huidigeFtp) * nieuweFtp));
            })
          : sessie.vermogen,
      };
    });
  }

  await kv.set(planKey, plan);

  // Update intervals.icu events (toekomstige)
  try {
    const creds = await getIntervalsCredentials(userId);
    if (creds && plan.weekSessies?.sessies) {
      for (const sessie of plan.weekSessies.sessies) {
        if (sessie.voltooid || sessie.datum < vandaag || !sessie.intervalsEventId) continue;
        try {
          await intervalsPut(`/events/${sessie.intervalsEventId}`, {
            description: sessie.vermogen || undefined,
          }, creds);
        } catch (e) {
          console.warn(`[ftpUpdate] Event update mislukt voor ${sessie.datum}:`, e.message);
        }
      }
    }
  } catch (e) {
    console.warn("[ftpUpdate] Intervals.icu updates mislukt:", e.message);
  }

  // VO2max-suggestie evalueren na FTP-test
  try {
    const { evalueerVo2maxSuggestie } = await import("../plan/vo2maxDetectie");
    const suggestie = await evalueerVo2maxSuggestie(userId);
    const huidigeStatus = await kv.get(`vo2max_suggestie_status:${userId}`);
    if (!huidigeStatus || huidigeStatus === "geen") {
      if (suggestie.suggereer) {
        await kv.set(`vo2max_suggestie_status:${userId}`, "getoond");
        await kv.set(`vo2max_suggestie_details:${userId}`, suggestie.details);
      } else {
        await kv.set(`vo2max_suggestie_status:${userId}`, "geen");
      }
    }
  } catch (e) {
    console.warn("[ftpUpdate] VO2max-suggestie evaluatie mislukt:", e.message);
  }

  return { updated: true, oldFtp: huidigeFtp, newFtp: nieuweFtp };
}
