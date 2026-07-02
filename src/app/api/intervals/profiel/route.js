import { NextResponse } from "next/server";
import { intervalsGet, intervalsAuth } from "@/lib/intervals";
import { getKV } from "@/lib/kv";
import { vandaagISO, datumOffset } from "@/lib/datum";
import { getUserIntervalsConfig, NietGekoppeldError } from "@/lib/auth";
import { invalidateCredsCache } from "@/lib/users";

export async function GET() {
  try {
    let creds = await getUserIntervalsConfig();
    let resp = await fetch(`https://intervals.icu/api/v1/athlete/${creds.athleteId}`, {
      headers: { Authorization: intervalsAuth(creds.apiKey) },
      next: { revalidate: 0 },
    });

    if (resp.status === 401 || resp.status === 403) {
      // Kan een stale in-memory credentials-cache zijn (24u TTL) — één keer verse creds proberen
      // vóórdat we de gebruiker om een nieuwe key vragen.
      invalidateCredsCache(creds.userId);
      creds = await getUserIntervalsConfig();
      resp = await fetch(`https://intervals.icu/api/v1/athlete/${creds.athleteId}`, {
        headers: { Authorization: intervalsAuth(creds.apiKey) },
        next: { revalidate: 0 },
      });
      if (resp.status === 401 || resp.status === 403) {
        return NextResponse.json({ success: false, intervalsAuthFailed: true });
      }
    }

    if (!resp.ok) throw new Error(`Intervals API ${resp.status}`);
    const athlete = await resp.json();

    const sportSettings = (athlete.sportSettings || []).find(s =>
      s.types?.includes("Ride")
    ) || {};

    // HRV en HR basislijn berekenen uit laatste 30 dagen wellness
    const oldest = datumOffset(-30);
    const wellness = await intervalsGet("/wellness.json", { oldest, fields: "id,hrv,restingHR" }, creds);

    const hrvWaarden = wellness.filter(w => w.hrv).map(w => w.hrv);
    const hrWaarden = wellness.filter(w => w.restingHR).map(w => w.restingHR);

    const profiel = {
      ftp: sportSettings.ftp || null,
      lt_hr: sportSettings.lthr || null,
      max_hr: sportSettings.max_hr || null,
      gewicht: athlete.icu_weight || null,
      power_zones: sportSettings.power_zones || null,
      power_zone_names: sportSettings.power_zone_names || null,
      hr_zones: sportSettings.hr_zones || null,
      hr_zone_names: sportSettings.hr_zone_names || null,
      resting_hr: athlete.icu_resting_hr || null,
      hrv_basislijn: hrvWaarden.length > 0 ? Math.round(hrvWaarden.reduce((s, v) => s + v, 0) / hrvWaarden.length) : null,
      hr_basislijn: hrWaarden.length > 0 ? Math.round(hrWaarden.reduce((s, v) => s + v, 0) / hrWaarden.length) : null,
      isAdmin: creds.userId === "u_frank_001",
    };

    if (profiel.ftp && creds.userId) {
      try {
        const kv = getKV();
        const ftpKey = `${creds.userId}:ftp-historie`;
        const historie = (await kv.get(ftpKey)) || [];
        const vandaag = vandaagISO();
        const laatste = historie[historie.length - 1];
        if (!laatste || laatste.ftp !== profiel.ftp) {
          historie.push({ datum: vandaag, ftp: profiel.ftp });
          await kv.set(ftpKey, historie);
        }

        // Pieksprintvermogen ophalen uit power curve
        try {
          const pcData = await intervalsGet("/power-curves.json", { type: "Ride", curves: "42d" }, creds);
          const curve = pcData?.list?.[0];
          let piekSprint = null;
          if (curve?.secs && curve?.watts) {
            const idx5 = curve.secs.indexOf(5);
            if (idx5 >= 0 && curve.watts[idx5] > 0) piekSprint = curve.watts[idx5];
          }
          if (piekSprint) {
            await kv.set(`piek_sprint_vermogen:${creds.userId}`, piekSprint);
            profiel.piek_sprint_vermogen = piekSprint;
          } else {
            profiel.piek_sprint_vermogen = Math.round(profiel.ftp * 1.8);
            profiel.piek_sprint_geschat = true;
          }
        } catch {
          profiel.piek_sprint_vermogen = Math.round(profiel.ftp * 1.8);
          profiel.piek_sprint_geschat = true;
        }
      } catch {}
    }

    return NextResponse.json({ success: true, data: profiel });
  } catch (e) {
    if (e.code === "NOT_LINKED") return NextResponse.json({ success: false, notLinked: true });
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
