import { NextResponse } from "next/server";
import { intervalsGet } from "@/lib/intervals";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const oldest = searchParams.get("oldest") || "2026-01-01";
    const newest = searchParams.get("newest") || new Date().toISOString().split("T")[0];
    const limit = searchParams.get("limit") || "100";

    const fields = ["id","name","type","start_date_local","distance","moving_time","average_watts","icu_weighted_avg_watts","average_heartrate","max_heartrate","icu_training_load","icu_atl","icu_ctl","icu_form","icu_rpe","average_speed","icu_hr_zone_times","icu_power_zone_times","total_elevation_gain","average_cadence","calories","max_watts","strava_id"].join(",");

    const data = await intervalsGet("/activities", { oldest, newest, limit, fields });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
