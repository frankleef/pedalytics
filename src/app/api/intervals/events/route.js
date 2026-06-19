import { NextResponse } from "next/server";
import { intervalsGet, intervalsPost, intervalsPut } from "@/lib/intervals";
import { segmentenNaarTekst } from "@/lib/workoutText";

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
    const { sessies, ftp } = await request.json();
    if (!sessies || sessies.length === 0) {
      return NextResponse.json({ success: false, error: "Geen sessies opgegeven" }, { status: 400 });
    }

    const resultaten = [];
    for (const sessie of sessies) {
      const workoutTekst = segmentenNaarTekst(sessie.segmenten, ftp);
      const datum = sessie.datum?.includes("T") ? sessie.datum : `${sessie.datum}T08:00:00`;
      const eventBody = {
        category: "WORKOUT",
        start_date_local: datum,
        name: sessie.titel || sessie.type,
        type: "Ride",
        moving_time: (sessie.duur_min || 90) * 60,
        description: workoutTekst,
      };

      let result;
      if (sessie.intervalsEventId) {
        try {
          result = await intervalsPut(`/events/${sessie.intervalsEventId}`, eventBody);
        } catch {
          result = await intervalsPost("/events", eventBody);
        }
      } else {
        result = await intervalsPost("/events", eventBody);
      }
      resultaten.push({ id: result.id, datum: sessie.datum });
    }

    return NextResponse.json({
      success: true,
      data: resultaten,
      message: `${resultaten.length} sessies gesynchroniseerd naar intervals.icu`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
