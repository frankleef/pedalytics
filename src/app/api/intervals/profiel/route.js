import { NextResponse } from "next/server";
import { intervalsGet, intervalsAuth } from "@/lib/intervals";
import { getKV } from "@/lib/kv";
import { vandaagISO, datumOffset } from "@/lib/datum";
import { getUserIntervalsConfig, NietGekoppeldError } from "@/lib/auth";

export async function GET() {
  try {
    const creds = await getUserIntervalsConfig();
    const resp = await fetch(`https://intervals.icu/api/v1/athlete/${creds.athleteId}`, {
      headers: { Authorization: intervalsAuth(creds.apiKey) },
      next: { revalidate: 0 },
    });
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
      } catch {}
    }

    return NextResponse.json({ success: true, data: profiel });
  } catch (e) {
    if (e.code === "NOT_LINKED") return NextResponse.json({ success: false, notLinked: true });
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
