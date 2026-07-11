import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser, getUserIntervalsConfig } from "@/lib/auth";
import { intervalsActivityGet, intervalsAuth } from "@/lib/intervals";
import { berekenDecoupling } from "@/lib/decoupling";

// De uur-cron (zie /api/cron/sync) cachet decoupling normaal pas ná zijn
// volgende run — voor een rit van vandaag blijft de kaart dan tot een uur
// leeg. Bij een cache-miss hier daarom live herberekenen (zelfde eligibility
// als de cron: >45 min, IF 55-75%) en cachen in hetzelfde object-formaat, zodat
// de cron er nadien alleen nog de hitte-velden aan hoeft toe te voegen.
async function berekenLiveDecoupling(kv, ritId) {
  try {
    const creds = await getUserIntervalsConfig();
    const plan = await kv.get(`${creds.userId}:seizoensplan`);
    const ftp = plan?.huidige_ftp;
    if (!ftp) return null;

    const activiteit = await intervalsActivityGet(ritId, creds);
    const duurMin = (activiteit?.moving_time || 0) / 60;
    if (duurMin < 45) return null;
    const np = activiteit?.icu_weighted_avg_watts;
    if (!np || np / ftp < 0.55 || np / ftp > 0.75) return null;

    const streams = await fetch(`https://intervals.icu/api/v1/activity/${ritId}/streams?types=watts,heartrate`, {
      headers: { Authorization: intervalsAuth(creds.apiKey) },
    }).then(r => r.json());
    const watts = (Array.isArray(streams) ? streams.find(s => s.type === "watts") : streams?.watts)?.data || [];
    const heartrate = (Array.isArray(streams) ? streams.find(s => s.type === "heartrate") : streams?.heartrate)?.data || [];

    const dc = berekenDecoupling(watts, heartrate);
    if (dc == null) return null;

    const entry = {
      decoupling: Math.round(dc * 10) / 10,
      apparent_temp_celsius: null,
      temp_baseline: null,
      hitte_gecorrigeerd: false,
      startTijd: activiteit.start_date_local,
      duurMinuten: Math.round(duurMin),
      userId: creds.userId,
    };
    await kv.set(`decoupling:${ritId}`, entry);
    return entry;
  } catch (e) {
    console.warn(`[hitte] Live decoupling-berekening mislukt voor rit ${ritId}:`, e.message);
    return null;
  }
}

export async function GET(request) {
  try {
    await getSessionUser();
    const kv = getKV();
    const ritId = new URL(request.url).searchParams.get("ritId");
    if (!ritId) return NextResponse.json({ success: false, error: "ritId vereist" }, { status: 400 });
    let data = await kv.get(`decoupling:${ritId}`);
    if (data == null) data = await berekenLiveDecoupling(kv, ritId);
    if (data == null) return NextResponse.json({ success: true, data: null });
    if (typeof data === "number") {
      return NextResponse.json({ success: true, data: { decoupling: data, apparent_temp_celsius: null, temp_baseline: null, hitte_gecorrigeerd: false } });
    }
    return NextResponse.json({
      success: true,
      data: {
        decoupling: data.decoupling ?? null,
        apparent_temp_celsius: data.apparent_temp_celsius ?? data.temperatuur_celsius ?? null,
        temp_baseline: data.temp_baseline ?? null,
        hitte_gecorrigeerd: data.hitte_gecorrigeerd ?? false,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
