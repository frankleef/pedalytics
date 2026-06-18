import { NextResponse } from "next/server";

const BASE_URL = "https://intervals.icu/api/v1";
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID || "i594622";
const API_KEY = process.env.INTERVALS_API_KEY;

function auth() {
  return "Basic " + Buffer.from("API_KEY:" + API_KEY).toString("base64");
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const oldest = searchParams.get("oldest") || "2026-01-01";
    const newest = searchParams.get("newest") || new Date().toISOString().split("T")[0];

    // Alle relevante wellness velden inclusief Garmin data
    const fields = [
      "id", "ctl", "atl", "rampRate",
      "restingHR", "hrv", "hrvSDNN",
      "sleepScore", "sleepSecs", "sleepQuality",
      "weight", "fatigue", "mood", "motivation",
      "soreness", "steps", "spO2",
      // Garmin specifieke velden
      "bodyBattery", "stressLevel", "respirationRate",
      "avgSkinTemp", "hydration",
    ].join(",");

    const url = `${BASE_URL}/athlete/${ATHLETE_ID}/wellness.json?oldest=${oldest}&newest=${newest}&fields=${fields}`;
    const resp = await fetch(url, { headers: { Authorization: auth() } });
    if (!resp.ok) throw new Error(`Intervals API ${resp.status}`);
    const data = await resp.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
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

    const url = `${BASE_URL}/athlete/${ATHLETE_ID}/wellness/${datum}`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify(wellnessData),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Intervals API ${resp.status}: ${errText}`);
    }
    const data = await resp.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
