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

    const datums = sessies.map(s => s.datum).filter(Boolean).sort();
    const oldest = datums[0];
    const newest = datums[datums.length - 1];

    let bestaandeEvents = {};
    try {
      const events = await intervalsGet("/events.json", { oldest, newest });
      (events || []).forEach(e => {
        if (e.category === "WORKOUT" && e.start_date_local) {
          const dag = e.start_date_local.split("T")[0];
          bestaandeEvents[dag] = e.id;
        }
      });
    } catch {}

    const resultaten = [];
    for (const sessie of sessies) {
      const workoutTekst = segmentenNaarTekst(sessie.segmenten, ftp);
      const datum = sessie.datum?.includes("T") ? sessie.datum : `${sessie.datum}T08:00:00`;
      const datumDag = sessie.datum?.split("T")[0] || sessie.datum;
      const eventBody = {
        category: "WORKOUT",
        start_date_local: datum,
        name: sessie.titel || sessie.type,
        type: "Ride",
        moving_time: (sessie.duur_min || 90) * 60,
        description: workoutTekst,
      };

      const bestaandId = sessie.intervalsEventId || bestaandeEvents[datumDag];
      let result;
      if (bestaandId) {
        try {
          result = await intervalsPut(`/events/${bestaandId}`, eventBody);
        } catch {
          result = await intervalsPost("/events", eventBody);
        }
      } else {
        result = await intervalsPost("/events", eventBody);
      }
      bestaandeEvents[datumDag] = result.id;
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
