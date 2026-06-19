import { NextResponse } from "next/server";
import { intervalsGet, intervalsAuth, ATHLETE_ID } from "@/lib/intervals";

export async function GET() {
  try {
    const resp = await fetch(`https://intervals.icu/api/v1/athlete/${ATHLETE_ID}`, {
      headers: { Authorization: intervalsAuth() },
      next: { revalidate: 0 },
    });
    if (!resp.ok) throw new Error(`Intervals API ${resp.status}`);
    const athlete = await resp.json();

    const sportSettings = (athlete.sportSettings || []).find(s =>
      s.types?.includes("Ride")
    ) || {};

    // HRV en HR basislijn berekenen uit laatste 30 dagen wellness
    const oldest = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const wellness = await intervalsGet("/wellness.json", { oldest, fields: "id,hrv,restingHR" });

    const hrvWaarden = wellness.filter(w => w.hrv).map(w => w.hrv);
    const hrWaarden = wellness.filter(w => w.restingHR).map(w => w.restingHR);

    const profiel = {
      ftp: sportSettings.ftp || null,
      lt_hr: sportSettings.lthr || null,
      max_hr: sportSettings.max_hr || null,
      gewicht: athlete.icu_weight || null,
      hr_zones: sportSettings.hr_zones || null,
      power_zones: sportSettings.power_zones || null,
      resting_hr: athlete.icu_resting_hr || null,
      hrv_basislijn: hrvWaarden.length > 0 ? Math.round(hrvWaarden.reduce((s, v) => s + v, 0) / hrvWaarden.length) : null,
      hr_basislijn: hrWaarden.length > 0 ? Math.round(hrWaarden.reduce((s, v) => s + v, 0) / hrWaarden.length * 10) / 10 : null,
    };

    return NextResponse.json({ success: true, data: profiel });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
