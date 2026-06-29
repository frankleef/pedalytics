import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { bouwSessieDagPrompt } from "@/lib/promptBuilder";
import { claudeCall } from "@/lib/claude";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";
import { berekenBlok, bouwZonesUitProfiel } from "@/lib/vermogensbereik";
import { magSprintStaartje } from "@/lib/sessie/weekpatroon";
import { DAGNAMEN } from "@/lib/datum";

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

  // Zet heeft_sprint_staartjes vlag op de intentie
  const oudeZones = sessie.intentie?.toegestane_zones || ["Z2"];
  const nieuweZones = oudeZones.includes("Z7") ? oudeZones : [...oudeZones, "Z7"];
  const bijgewerkteSessie = {
    ...sessie,
    intentie: {
      ...sessie.intentie,
      heeft_sprint_staartjes: true,
      toegestane_zones: nieuweZones,
    },
  };
  plan.weekSessies.sessies[idx] = bijgewerkteSessie;

  // Haal profiel op
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

  const dagNaam = DAGNAMEN[new Date(datum).getDay()];
  const uren = plan.urenPerDag?.[dagNaam] || 1.5;
  const overigeSessies = plan.weekSessies.sessies.filter(s => (s.datum_iso || s.datum) !== datum && !s.voltooid);

  const promptData = bouwSessieDagPrompt({
    profiel, wellness: null, dagelijkseData: [], voortgang: null,
    seizoensplan: { ...plan, weekSessies: undefined },
    overigeSessies, datum, dagNaam, uren,
    oudeSessie: bijgewerkteSessie,
    aanleiding: "sprint_staartje_activatie",
  });

  const raw = await claudeCall(promptData);
  const result = raw.sessie || raw.sessies?.[0] || raw;
  if (!result.datum) result.datum = datum;
  if (!result.dag) result.dag = dagNaam;
  normaliseerSessieSegmenten(result);
  voegVerwachtRpeToe(result);
  corrigeerSessieTss(result);

  if (profiel.power_zones && profiel.ftp) {
    try {
      const zones = bouwZonesUitProfiel(profiel.ftp, profiel.power_zones);
      const piekSprint = await kv.get(`piek_sprint_vermogen:${userId}`) || Math.round(profiel.ftp * 1.8);
      const sessietype = result.intentie?.sessietype || result.sessietype || result.type;
      result.segmenten = (result.segmenten || []).map(seg =>
        seg.zone ? berekenBlok(seg, zones, profiel.ftp, piekSprint, sessietype) : seg
      );
    } catch {}
  }

  if (sessie.intervalsEventId) result.intervalsEventId = sessie.intervalsEventId;
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
