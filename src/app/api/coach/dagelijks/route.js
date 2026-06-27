import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser, getUserIntervalsConfig } from "@/lib/auth";
import { claudeCall } from "@/lib/claude";
import { datumOffset, vandaagISO } from "@/lib/datum";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { intervalsGet } from "@/lib/intervals";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user?.id) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });
    const userId = user.id;
    const kv = getKV();

    const vandaag = new Date().toISOString().slice(0, 10);

    // Hitte-vlag + cache-check: temp_baseline:{userId} is bijgehouden door sync-cron (1 kv.get)
    let weerData = null;
    try {
      const { haalGebruikersLocatie } = await import("@/lib/locatie");
      const { berekenHitteVlag } = await import("@/lib/hitte");
      const { lat, lon } = await haalGebruikersLocatie(userId);
      const [weerResp, tempBaseline] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=apparent_temperature&timezone=Europe/Amsterdam`, { next: { revalidate: 1800 } }),
        kv.get(`temp_baseline:${userId}`),
      ]);
      if (weerResp.ok) {
        const wd = await weerResp.json();
        const apparentTemp = wd.current?.apparent_temperature ?? null;
        if (apparentTemp != null) {
          const hitte = tempBaseline != null ? berekenHitteVlag(apparentTemp, tempBaseline) : apparentTemp >= 32;
          weerData = { apparentTemp: Math.round(apparentTemp), hitte, delta: tempBaseline != null ? Math.round(apparentTemp - tempBaseline) : null };
        }
      }
    } catch {}

    const cacheKey = `coach-bericht:${userId}:${vandaag}:${weerData?.hitte ? "hitte" : "normaal"}`;

    const cached = await kv.get(cacheKey);
    if (cached) return NextResponse.json({ success: true, data: cached, cached: true });

    let creds;
    try { creds = await getUserIntervalsConfig(); } catch { creds = null; }

    const [conditieData, rpeTrend, plan, wellness, checkinData] = await Promise.all([
      kv.get(`conditie_score:${userId}`),
      kv.get(`rpe_trend:${userId}`),
      kv.get(`${userId}:seizoensplan`),
      creds ? intervalsGet("/wellness.json", { oldest: datumOffset(-7), newest: vandaagISO(), fields: "id,ctl,atl,hrv,restingHR" }, creds).catch(() => null) : null,
      kv.get(`${userId}:checkin:${vandaag}`),
    ]);

    const laatsteWellness = Array.isArray(wellness) && wellness.length > 0 ? wellness[wellness.length - 1] : null;

    const ctl = laatsteWellness?.ctl ? Math.round(laatsteWellness.ctl) : null;
    const atl = laatsteWellness?.atl ? Math.round(laatsteWellness.atl) : null;
    const tsb = ctl != null && atl != null ? ctl - atl : null;
    const hrv = laatsteWellness?.hrv ?? null;
    const hrvStatus = hrv ? (hrv > 60 ? "boven basislijn" : hrv > 45 ? "normaal" : "onder basislijn") : "geen data";

    let gereedheidLabel = "onbekend";
    let gereedheidScore = null;
    if (tsb != null) {
      if (tsb > 5) { gereedheidLabel = "uitgerust"; gereedheidScore = 80; }
      else if (tsb > -10) { gereedheidLabel = "goed"; gereedheidScore = 65; }
      else if (tsb > -20) { gereedheidLabel = "vermoeid"; gereedheidScore = 45; }
      else { gereedheidLabel = "overbelast"; gereedheidScore = 25; }
    }
    const checkinScore = checkinData?.score ?? null;
    if (checkinScore) {
      const checkinInvloed = (checkinScore / 5) * 100;
      gereedheidScore = gereedheidScore != null ? Math.round(gereedheidScore * 0.75 + checkinInvloed * 0.25) : Math.round(checkinInvloed);
    }

    const sessieVandaag = (() => {
      const sessies = plan?.weekSessies?.sessies || [];
      return sessies.find(s => s.datum === vandaag && s.type !== "rust") || null;
    })();

    const weekNr = plan?.startdatum ? weeknummerVoorDatum(new Date(), plan.startdatum) : null;
    const totaalWeken = plan?.tijdshorizon_weken || plan?.kader?.length || null;
    const fase = (() => {
      if (!weekNr || !plan?.kader) return null;
      const kw = plan.kader.find(w => w.week === weekNr);
      return kw?.fase || null;
    })();

    const datumStr = new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

    const weerPrompt = weerData
      ? `- Gevoelstemperatuur: ${weerData.apparentTemp}°C${weerData.hitte ? ` (${weerData.delta != null ? weerData.delta + "°C warmer dan normaal — " : ""}hitte-omstandigheden)` : ""}\n`
      : "";
    const hitteInstructie = weerData?.hitte
      ? "\nLET OP: Het is vandaag aanzienlijk warmer dan normaal. Verwerk dit expliciet: adviseer vroeg of laat rijden, waarschuw dat hartslag hoger zal zijn bij hetzelfde vermogen, en stel lagere intensiteit of kortere duur voor als er een sessie gepland staat.\n"
      : "";

    const prompt = `Je bent een persoonlijke fietstrainer. Schrijf een coaching-bericht voor vandaag.
Schrijf in de tweede persoon (je/jij), direct en concreet. Geen algemeenheden.
Combineer de signalen tot één coherent beeld — geen opsomming van data.

CONTEXT:
- Datum: ${datumStr}
- Seizoensfase: ${fase ?? "onbekend"}, week ${weekNr ?? "?"} van ${totaalWeken ?? "?"}
- Gereedheid: ${gereedheidScore ?? "?"}/100 (${gereedheidLabel})
  TSB: ${tsb ?? "?"} | HRV: ${hrvStatus} | Check-in: ${checkinScore ?? "niet ingevuld"}
- Conditie: ${conditieData?.conditie ?? "?"} (score: ${conditieData?.score?.toFixed?.(2) ?? "?"})
- Belasting: ${conditieData?.belasting ?? "?"}
${weerPrompt}- Sessie vandaag: ${sessieVandaag
  ? `${sessieVandaag.titel} — ${sessieVandaag.tss} TSS, ${sessieVandaag.duur_min || sessieVandaag.duur_minuten} min`
  : "rustdag"}
- RPE-delta trend: ${rpeTrend != null ? Number(rpeTrend).toFixed(2) : "onvoldoende data (<5 ritten)"}
${hitteInstructie}
SCHRIJF als JSON (geen markdown, geen preamble):
{
  "dagelijks_bericht": "2-4 zinnen. Interpreteer de combinatie van signalen. Verwijs naar wat je echt ziet.",
  "seizoensduiding": "1-2 zinnen over de fase en wat er aankomt. Leeg string als dit niets toevoegt.",
  "aandachtspunten": ["Alleen invullen als er iets concreets aandacht verdient. Lege array als alles goed gaat."]
}`;

    const bericht = await claudeCall({ prompt, max_tokens: 400 });

    const nu = new Date();
    const middernacht = new Date(nu);
    middernacht.setHours(24, 0, 0, 0);
    const ttl = Math.floor((middernacht - nu) / 1000);
    await kv.set(cacheKey, bericht, { ex: Math.max(ttl, 60) });

    return NextResponse.json({ success: true, data: bericht });
  } catch (e) {
    console.error("[coach/dagelijks] Fout:", e.message);
    return NextResponse.json({ success: true, data: {
      dagelijks_bericht: null,
      seizoensduiding: null,
      aandachtspunten: [],
      error: true,
    }});
  }
}
