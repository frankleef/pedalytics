import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsPut } from "@/lib/intervals";
import { sessieNaarZwo } from "@/lib/workoutZwo";
import { rondSessieAf } from "@/lib/sessie/duurAfronding";

export const maxDuration = 300;

/**
 * Eenmalige correctie van al gegenereerde (nog niet voltooide) sessies:
 * rondt blokken >= 1 minuut af op hele minuten en de totale sessieduur op
 * een veelvoud van 5 minuten. Verandert archetype/variant/intentie niet —
 * alleen de duur-getallen worden opgeschoond (i.t.t. herbereken-sessies, dat
 * volledig regenereert).
 */
export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kv = getKV();
  const userIds = (await kv.get("users:active")) || [];
  const resultaten = [];

  for (const userId of userIds) {
    const planKey = `${userId}:seizoensplan`;
    const plan = await kv.get(planKey);
    if (!plan?.weekSessies?.sessies) continue;

    const ftp = plan.huidige_ftp || 265;
    let creds;
    let bijgewerkt = false;

    for (const sessie of plan.weekSessies.sessies) {
      if (sessie.voltooid) continue;
      if (!sessie.segmenten?.length) continue;

      const totaalSecOud = sessie.segmenten.reduce((s, seg) => s + (seg.blokDuurSeconden || 0), 0);
      const { segmenten, duur_min } = rondSessieAf(sessie.segmenten);
      const totaalSecNieuw = segmenten.reduce((s, seg) => s + (seg.blokDuurSeconden || 0), 0);
      if (totaalSecNieuw === totaalSecOud && duur_min === sessie.duur_min) continue;

      sessie.segmenten = segmenten;
      sessie.duur_min = duur_min;
      bijgewerkt = true;
      resultaten.push({ userId, datum: sessie.datum, status: "afgerond", duur_min });

      if (sessie.intervalsEventId) {
        try {
          if (creds === undefined) creds = (await getIntervalsCredentials(userId)) || null;
          if (creds) {
            const zwo = sessieNaarZwo(sessie, ftp);
            await intervalsPut(`/events/${sessie.intervalsEventId}`, {
              name: sessie.titel || sessie.type,
              moving_time: duur_min * 60,
              ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
            }, creds);
          }
        } catch (e) {
          console.warn(`[rond-sessieduren-af] Intervals.icu-sync mislukt voor ${userId} ${sessie.datum}:`, e.message);
        }
      }
    }

    if (bijgewerkt) await kv.set(planKey, plan);
  }

  return NextResponse.json({
    aantalAangepast: resultaten.length,
    resultaten,
  });
}
