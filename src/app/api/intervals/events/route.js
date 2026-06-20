import { NextResponse } from "next/server";
import { intervalsGet, intervalsPost, intervalsPut } from "@/lib/intervals";
import { segmentenNaarZwo } from "@/lib/workoutZwo";
import { vandaagISO, datumOffset } from "@/lib/datum";

export async function GET(request) {
  try {
    const vandaag = vandaagISO();
    const over14 = datumOffset(14);
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
          bestaandeEvents[e.start_date_local.split("T")[0]] = e.id;
        }
      });
    } catch {}

    const resultaten = [];
    for (const sessie of sessies) {
      const zwo = segmentenNaarZwo(sessie.segmenten, sessie.titel);
      const datum = sessie.datum?.includes("T") ? sessie.datum : `${sessie.datum}T08:00:00`;
      const datumDag = sessie.datum?.split("T")[0] || sessie.datum;
      const eventBody = {
        category: "WORKOUT",
        start_date_local: datum,
        name: sessie.titel || sessie.type,
        type: "Ride",
        moving_time: (sessie.duur_min || 90) * 60,
        ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
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

      if (result.id && zwo) {
        try {
          const segDuur = (sessie.segmenten || []).reduce((s, seg) => s + (seg.duur_min || 0), 0) * 60;
          const resolvedDuur = result.moving_time || result.workout_doc?.duration;
          if (resolvedDuur && Math.abs(resolvedDuur - segDuur) > 60) {
            console.warn(`[Events] Duur-mismatch voor ${datumDag}: app=${segDuur}s, intervals.icu=${resolvedDuur}s`);
          }
        } catch {}
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
