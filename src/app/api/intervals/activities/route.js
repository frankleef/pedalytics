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
    const limit = searchParams.get("limit") || "100";

    const fields = ["id","name","type","start_date_local","distance","moving_time","average_watts","icu_weighted_avg_watts","average_heartrate","icu_training_load","icu_atl","icu_ctl","icu_form","perceived_exertion","average_speed","icu_hr_zone_times"].join(",");

    const url = `${BASE_URL}/athlete/${ATHLETE_ID}/activities?oldest=${oldest}&newest=${newest}&limit=${limit}&fields=${fields}`;
    const resp = await fetch(url, { headers: { Authorization: auth() } });
    if (!resp.ok) throw new Error(`Intervals API ${resp.status}`);
    const data = await resp.json();
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
