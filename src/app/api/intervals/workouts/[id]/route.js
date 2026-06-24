import { NextResponse } from "next/server";
import { intervalsActivityGet, intervalsActivityPut } from "@/lib/intervals";
import { getUserIntervalsConfig } from "@/lib/auth";
import { getKV } from "@/lib/kv";
import { vandaagISO } from "@/lib/datum";

export async function GET(request, { params }) {
  try {
    const creds = await getUserIntervalsConfig();
    const { id } = params;
    const data = await intervalsActivityGet(id, creds);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const creds = await getUserIntervalsConfig();
    const { id } = params;
    const { rpe, gevoel, opmerking } = await request.json();
    const body = { icu_rpe: rpe };
    if (gevoel) {
      const gevoelMap = { top: 5, goed: 4, matig: 3, moe: 2, slecht: 1 };
      body.feel = gevoelMap[gevoel] || 3;
    }
    if (opmerking) body.description = opmerking;
    const data = await intervalsActivityPut(id, body, creds);

    // RPE-delta berekenen en opslaan
    if (rpe && creds.userId) {
      try {
        const kv = getKV();
        const plan = await kv.get(`${creds.userId}:seizoensplan`);
        if (plan?.weekSessies?.sessies) {
          // Vind de activiteit-datum via intervals.icu
          const activity = await intervalsActivityGet(id, creds);
          const ritDatum = activity?.start_date_local?.split("T")[0];

          // Zoek de geplande sessie voor die datum
          const sessie = ritDatum ? plan.weekSessies.sessies.find(s => s.datum === ritDatum) : null;
          if (sessie?.verwacht_rpe) {
            const delta = rpe - sessie.verwacht_rpe;
            sessie.rpe_delta = Math.round(delta * 10) / 10;
            sessie.voltooid = true;

            // Opslaan in KV voor trend-berekening, maar hitte-ritten overslaan (spec 32-F)
            const dcEntry = await kv.get(`decoupling:${id}`);
            const isHitteRit = typeof dcEntry === "object" && (dcEntry?.hitte_gecorrigeerd ?? false);
            if (!isHitteRit) {
              await kv.set(`rpe_delta:${ritDatum}:${creds.userId}`, delta, { ex: 30 * 86400 });
            }

            // Herbereken rpe_trend: gewogen gemiddelde van laatste 10 deltas
            const alleDeltas = [];
            for (const s of plan.weekSessies.sessies) {
              if (s.rpe_delta != null) alleDeltas.push({ datum: s.datum, delta: s.rpe_delta });
            }
            alleDeltas.sort((a, b) => b.datum.localeCompare(a.datum));
            const laatste10 = alleDeltas.slice(0, 10);
            if (laatste10.length >= 2) {
              const gewogen = laatste10.map((d, i) => ({ waarde: d.delta, gewicht: i < 3 ? 1.5 : 1.0 }));
              const totGewicht = gewogen.reduce((s, g) => s + g.gewicht, 0);
              const trend = gewogen.reduce((s, g) => s + g.waarde * g.gewicht, 0) / totGewicht;
              await kv.set(`rpe_trend:${creds.userId}`, Math.round(trend * 100) / 100, { ex: 8 * 86400 });
            }

            await kv.set(`${creds.userId}:seizoensplan`, plan);
          }
        }
      } catch (e) {
        console.warn("[RPE] Delta-berekening mislukt:", e.message);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
