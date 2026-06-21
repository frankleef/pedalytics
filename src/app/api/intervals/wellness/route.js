import { NextResponse } from "next/server";
import { intervalsGet, intervalsPut } from "@/lib/intervals";
import { vandaagISO } from "@/lib/datum";
import { getUserIntervalsConfig } from "@/lib/auth";

export async function GET(request) {
  try {
    const creds = await getUserIntervalsConfig();
    const { searchParams } = new URL(request.url);
    const oldest = searchParams.get("oldest") || "2026-01-01";
    const newest = searchParams.get("newest") || vandaagISO();

    const fields = [
      "id", "ctl", "atl", "rampRate",
      "restingHR", "hrv", "hrvSDNN",
      "sleepScore", "sleepSecs", "sleepQuality",
      "weight", "fatigue", "mood", "motivation",
      "soreness", "steps", "spO2",
      "bodyBattery", "stressLevel", "respirationRate",
      "avgSkinTemp", "hydration",
    ].join(",");

    const data = await intervalsGet("/wellness.json", { oldest, newest, fields }, creds);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const creds = await getUserIntervalsConfig();
    const body = await request.json();
    const { datum, rpe, gevoel, opmerking, slaapUren, slaapScore, hrv, rusthartslag } = body;

    const wellnessData = {};
    if (hrv != null) wellnessData.hrv = hrv;
    if (rusthartslag != null) wellnessData.restingHR = rusthartslag;
    if (slaapScore != null) wellnessData.sleepScore = slaapScore;
    if (slaapUren != null) wellnessData.sleepSecs = Math.round(slaapUren * 3600);
    if (rpe != null) wellnessData.perceived_exertion = rpe;
    if (gevoel != null) wellnessData.feel = { top: 5, goed: 4, matig: 3, moe: 2, slecht: 1 }[gevoel] || 3;
    if (opmerking) wellnessData.comments = opmerking;

    const data = await intervalsPut(`/wellness/${datum}`, wellnessData, creds);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
