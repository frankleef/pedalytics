import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { haalEfTrendOp, berekenEFTrend } from "@/lib/ef";

const BANDEN = ["z2", "sweetspot", "drempel", "vo2max"];
const MIN_PUNTEN_VOOR_TREND = 4;
const VENSTER_DAGEN = 21; // "laatste 3-4 weken" (sectie EF-prompt, stap 2)

export async function GET() {
  try {
    const user = await getSessionUser();
    const kv = getKV();
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
