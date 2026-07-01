import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { genereerSessieDag } from "@/lib/sessie/genereren";
import { kaderWeekVoorDatum, weekInFaseVoorKaderWeek } from "@/lib/weekgrenzen";
import { DAGNAMEN } from "@/lib/datum";

export const maxDuration = 300;

export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kv = getKV();
  const userIds = (await kv.get("users:active")) || [];
  const allResults = [];

  for (const userId of userIds) {
    const plan = await kv.get(`${userId}:seizoensplan`);
    if (!plan?.weekSessies?.sessies) continue;

    const dag = new Date();
    const dagVanDeWeek = dag.getDay();
    const dagenTotMaandag = dagVanDeWeek === 0 ? 1 : dagVanDeWeek === 1 ? 7 : 8 - dagVanDeWeek;
    const maandag = new Date(dag);
    maandag.setDate(dag.getDate() + dagenTotMaandag);
    const grensdatum = maandag.toISOString().slice(0, 10);

    let profiel;
    try {
      const creds = await getIntervalsCredentials(userId);
      const athlete = creds ? await intervalsGet("/", {}, creds) : null;
      const rideSport = (athlete?.sportSettings || []).find(s => s.types?.includes("Ride")) || {};
      profiel = {
        ftp: rideSport.ftp || plan.huidige_ftp || 265,
        lt_hr: rideSport.lthr || 184,
        max_hr: rideSport.max_hr || 200,
        gewicht: athlete?.icu_weight || 90,
        hrv_basislijn: plan.profiel?.hrv_basislijn || 58,
        hr_basislijn: plan.profiel?.hr_basislijn || 49,
        power_zones: rideSport.power_zones || null,
      };
    } catch {
      profiel = { ftp: plan.huidige_ftp || 265, lt_hr: 184, max_hr: 200, gewicht: 90, hrv_basislijn: 58, hr_basislijn: 49, power_zones: null };
    }

    const hrvProfiel = await kv.get(`hrv-profiel:${userId}`);
    const piekSprint = await kv.get(`piek_sprint_vermogen:${userId}`) || Math.round((profiel.ftp || 265) * 1.8);

    const sessies = plan.weekSessies.sessies;
    let bijgewerkt = false;

    for (const sessie of sessies) {
      if (!sessie.datum || sessie.datum < grensdatum) continue;
      if (sessie.voltooid) continue;
      if (!sessie.intentie) continue;

      try {
        const dagNaam = DAGNAMEN[new Date(sessie.datum).getDay()];
        const uren = plan.urenPerDag?.[dagNaam] || 1.5;
        const overigeSessies = sessies.filter(s => s.datum !== sessie.datum && !s.voltooid);
        const kaderWeek = kaderWeekVoorDatum(sessie.datum, plan.kader, plan.startdatum);
        const huidigeFase = kaderWeek?.fase ?? "basis";
        const weekInFase = weekInFaseVoorKaderWeek(kaderWeek, plan.kader);

        const result = await genereerSessieDag({
          kv, userId, datum: sessie.datum, dagNaam, uren,
          profiel, wellness: null, plan, overigeSessies,
          oudeSessie: sessie, aanleiding: "methode_herberekening",
          huidigeFase, weekInFase, hrvProfiel, piekSprint,
          alleSessiesVoorKrachtCheck: sessies,
        });

        if (sessie.intervalsEventId) result.intervalsEventId = sessie.intervalsEventId;
        const idx = sessies.indexOf(sessie);
        if (idx >= 0) sessies[idx] = result;
        bijgewerkt = true;
        allResults.push({ userId, datum: sessie.datum, status: "hergenereerd" });
        console.log(`[herbereken] ${userId} ${sessie.datum}: ${result.type} "${result.titel}"`);
      } catch (e) {
        allResults.push({ userId, datum: sessie.datum, status: "fout", fout: e.message });
        console.error(`[herbereken] ${userId} ${sessie.datum} mislukt:`, e.message);
      }
    }

    if (bijgewerkt) await kv.set(`${userId}:seizoensplan`, plan);
  }

  return NextResponse.json({
    aantalHergenereerd: allResults.filter(r => r.status === "hergenereerd").length,
    aantalFouten: allResults.filter(r => r.status === "fout").length,
    resultaten: allResults,
  });
}
