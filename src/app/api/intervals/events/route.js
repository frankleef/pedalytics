import { NextResponse } from "next/server";
import { intervalsGet, intervalsPost, intervalsPut } from "@/lib/intervals";
import { sessieNaarZwo } from "@/lib/workoutZwo";
import { vandaagISO, datumOffset } from "@/lib/datum";
import { getUserIntervalsConfig, NietGekoppeldError } from "@/lib/auth";

export async function GET(request) {
  try {
    const creds = await getUserIntervalsConfig();
    const vandaag = vandaagISO();
    const over14 = datumOffset(14);
    const data = await intervalsGet("/events.json", { oldest: vandaag, newest: over14 }, creds);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e.code === "NOT_LINKED") return NextResponse.json({ success: false, notLinked: true });
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const creds = await getUserIntervalsConfig();
    const { sessies, ftp } = await request.json();
    if (!sessies || sessies.length === 0) {
      return NextResponse.json({ success: false, error: "Geen sessies opgegeven" }, { status: 400 });
    }

    const datums = sessies.map(s => s.datum).filter(Boolean).sort();
    const oldest = datums[0];
    const newest = datums[datums.length - 1];

    let bestaandeEvents = {};
    try {
      const events = await intervalsGet("/events.json", { oldest, newest }, creds);
      (events || []).forEach(e => {
        if (e.category === "WORKOUT" && e.start_date_local) {
          bestaandeEvents[e.start_date_local.split("T")[0]] = e.id;
        }
      });
    } catch {}

    const resultaten = [];
    for (const sessie of sessies) {
      const zwo = sessieNaarZwo(sessie, ftp || 265);
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
          result = await intervalsPut(`/events/${bestaandId}`, eventBody, creds);
        } catch {
          result = await intervalsPost("/events", eventBody, creds);
        }
      } else {
        result = await intervalsPost("/events", eventBody, creds);
      }

      // ramp_test heeft per definitie een variabele einduur (protocol i.p.v.
      // segmenten) — de duur-mismatch-check hieronder is daar zinloos.
      if (result.id && zwo && !sessie.protocol) {
        try {
          const segDuur = (sessie.segmenten || []).reduce((s, seg) => s + (seg.blokDuurSeconden || (seg.duur_min || 0) * 60), 0);
          const resolvedDuur = result.moving_time || result.workout_doc?.duration;
          if (resolvedDuur && Math.abs(resolvedDuur - segDuur) > 60) {
            console.warn(`[Events] Duur-mismatch voor ${datumDag}: app=${segDuur}s, intervals.icu=${resolvedDuur}s`);
          }
        } catch {}
      }

      bestaandeEvents[datumDag] = result.id;

      // TSS ophalen van intervals.icu (berekend op basis van ZWO)
      let icuTss = result.icu_training_load ?? null;
      if (icuTss == null && result.id && zwo) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const evt = await intervalsGet(`/events/${result.id}`, {}, creds);
          icuTss = evt?.icu_training_load ?? null;
        } catch {}
      }

      resultaten.push({ id: result.id, datum: sessie.datum, icu_training_load: icuTss });
    }

    return NextResponse.json({
      success: true,
      data: resultaten,
      message: `${resultaten.length} sessies gesynchroniseerd naar intervals.icu`,
    });
  } catch (e) {
    if (e.code === "NOT_LINKED") return NextResponse.json({ success: false, notLinked: true });
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
