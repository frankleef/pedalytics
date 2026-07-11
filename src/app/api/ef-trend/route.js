import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser, getUserIntervalsConfig } from "@/lib/auth";
import { haalEfTrendOp, berekenEFTrend, verwerkRitVoorEf } from "@/lib/ef";
import { intervalsGet } from "@/lib/intervals";
import { vandaagISO, datumOffset } from "@/lib/datum";

const BANDEN = ["z2", "sweetspot", "drempel", "vo2max"];
const MIN_PUNTEN_VOOR_TREND = 4;
const VENSTER_DAGEN = 21; // "laatste 3-4 weken" (sectie EF-prompt, stap 2)

// De uur-cron verwerkt nieuwe ritten pas bij zijn volgende run — een rit van
// vandaag mist daardoor tot een uur lang in de trend. Ritten van de laatste
// twee dagen hier alvast live verwerken (verwerkRitVoorEf dedupet zelf op
// activityId, dus dit is een goedkope no-op voor alles wat de cron al deed).
async function verwerkRecenteRittenLive(kv, userId) {
  try {
    const creds = await getUserIntervalsConfig();
    const plan = await kv.get(`${userId}:seizoensplan`);
    const ftp = plan?.huidige_ftp || 265;
    const acts = await intervalsGet("/activities", {
      oldest: datumOffset(-2),
      newest: vandaagISO(),
      limit: "20",
      fields: "id,start_date_local,type,moving_time,icu_weighted_avg_watts,average_watts",
    }, creds);
    const ritten = (acts || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");
    for (const rit of ritten) {
      await verwerkRitVoorEf(kv, userId, rit, ftp, creds.apiKey).catch(() => {});
    }
  } catch {}
}

export async function GET() {
  try {
    const user = await getSessionUser();
    const kv = getKV();
    if (user?.id) await verwerkRecenteRittenLive(kv, user.id);
    const grens = new Date(Date.now() - VENSTER_DAGEN * 86400000).toISOString().slice(0, 10);

    const data = {};
    for (const band of BANDEN) {
      const punten = await haalEfTrendOp(kv, user?.id, band);
      const recentePunten = punten.filter(p => p.datum >= grens);
      data[band] = {
        punten,
        trend: berekenEFTrend(punten),
        aantalRecent: recentePunten.length,
        voldoendeData: recentePunten.length >= MIN_PUNTEN_VOOR_TREND,
      };
    }

    return NextResponse.json({ success: true, data, minPuntenVoorTrend: MIN_PUNTEN_VOOR_TREND });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
