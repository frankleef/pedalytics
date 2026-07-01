import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";
import { voegSprintStaartjesToe } from "@/lib/sessie/segmentStaart";

export const maxDuration = 120;

export async function POST(request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, datum } = await request.json();
  if (!userId || !datum) {
    return NextResponse.json({ error: "userId en datum zijn verplicht" }, { status: 400 });
  }

  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan?.weekSessies?.sessies) {
    return NextResponse.json({ error: "Plan niet gevonden" }, { status: 404 });
  }

  const idx = plan.weekSessies.sessies.findIndex(s => (s.datum_iso || s.datum) === datum);
  if (idx === -1) {
    return NextResponse.json({ error: `Sessie niet gevonden voor datum ${datum}` }, { status: 404 });
  }

  const sessie = plan.weekSessies.sessies[idx];
  if (sessie.voltooid) {
    return NextResponse.json({ error: "Sessie al voltooid" }, { status: 400 });
  }

  const ftp = plan.huidige_ftp || 265;
  const result = { ...sessie, intentie: { ...sessie.intentie } };
  voegSprintStaartjesToe(result, ftp);
  normaliseerSessieSegmenten(result);
  voegVerwachtRpeToe(result);
  corrigeerSessieTss(result);

  plan.weekSessies.sessies[idx] = result;
  await kv.set(planKey, plan);

  return NextResponse.json({
    ok: true,
    datum,
    titel: result.titel,
    type: result.type,
    sessietype: result.intentie?.sessietype,
    toegestane_zones: result.intentie?.toegestane_zones,
    heeft_sprint_staartjes: result.intentie?.heeft_sprint_staartjes ?? true,
    aantalSegmenten: result.segmenten?.length,
    sprintSegmenten: result.segmenten?.filter(s => s.zone === "Z7")?.length ?? 0,
  });
}
