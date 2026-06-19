import { NextResponse } from "next/server";
import { intervalsGet, intervalsPost } from "@/lib/intervals";

export async function GET(request) {
  try {
    const vandaag = new Date().toISOString().split("T")[0];
    const over14 = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const data = await intervalsGet("/events.json", { oldest: vandaag, newest: over14 });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { workouts } = await request.json();
    const FTP = 265;
    const aangemaakteWorkouts = [];
    for (const workout of workouts) {
      const stappen = [];
      stappen.push({ type: "SteadyState", duration: 1200, power: { value: 0.55, units: "FTP" }, text: "Warming-up" });
      if (workout.type === "duur_lang") {
        stappen.push({ type: "SteadyState", duration: 6000, power: { value: 0.72, units: "FTP" }, text: `Z2 duur — ${Math.round(FTP * 0.72)}W` });
      } else if (workout.type === "duur_middel") {
        stappen.push({ type: "SteadyState", duration: 4200, power: { value: 0.72, units: "FTP" }, text: `Z2 duur — ${Math.round(FTP * 0.72)}W` });
      } else if (workout.type === "interval") {
        for (let i = 0; i < 4; i++) {
          stappen.push({ type: "SteadyState", duration: 300, power: { value: 0.95, units: "FTP" }, text: `Interval ${i+1}/4` });
          if (i < 3) stappen.push({ type: "SteadyState", duration: 300, power: { value: 0.55, units: "FTP" }, text: "Herstel" });
        }
      }
      stappen.push({ type: "SteadyState", duration: 600, power: { value: 0.50, units: "FTP" }, text: "Cooling-down" });
      const result = await intervalsPost("/events", {
        category: "WORKOUT",
        start_date_local: workout.datum,
        name: workout.naam,
        type: "Ride",
        moving_time: (workout.duurMin || 90) * 60,
        description: workout.beschrijving,
        workout_doc: { steps: stappen },
      });
      aangemaakteWorkouts.push(result);
    }
    return NextResponse.json({ success: true, data: aangemaakteWorkouts, message: `${aangemaakteWorkouts.length} workouts gepland` });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
