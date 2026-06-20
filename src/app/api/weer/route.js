import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";

const DEFAULT_LAT = 51.59;
const DEFAULT_LON = 4.78;
const DEFAULT_STAD = "Breda";

const CONDITIE_MAP = {
  0: "Helder", 1: "Overwegend helder", 2: "Half bewolkt", 3: "Bewolkt",
  45: "Mistig", 48: "Rijpmist", 51: "Lichte motregen", 53: "Motregen", 55: "Zware motregen",
  61: "Lichte regen", 63: "Regen", 65: "Zware regen", 71: "Lichte sneeuw", 73: "Sneeuw",
  80: "Lichte buien", 81: "Buien", 82: "Zware buien", 95: "Onweer",
};

export async function GET() {
  try {
    const locatie = await getKV().get("weer-locatie").catch(() => null);
    const lat = locatie?.lat || DEFAULT_LAT;
    const lon = locatie?.lon || DEFAULT_LON;

    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&hourly=precipitation_probability&timezone=Europe/Amsterdam&forecast_days=1`,
      { next: { revalidate: 1800 } }
    );
    if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}`);
    const data = await resp.json();

    const temp = Math.round(data.current?.temperature_2m ?? 0);
    const code = data.current?.weather_code ?? 0;
    const wind = Math.round(data.current?.wind_speed_10m ?? 0);
    const conditie = CONDITIE_MAP[code] || "Onbekend";

    const uurlijks = data.hourly?.precipitation_probability || [];
    const maxNeerslag = Math.max(...uurlijks, 0);
    const middag = uurlijks.slice(12, 18);
    const neerslagMiddag = middag.length > 0 ? Math.max(...middag) : 0;

    return NextResponse.json({
      success: true,
      data: { temp, conditie, wind, neerslagKans: maxNeerslag, neerslagMiddag, stad: locatie?.stad || DEFAULT_STAD },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { stad, lat, lon } = await request.json();
    if (!stad || !lat || !lon) return NextResponse.json({ success: false, error: "stad, lat en lon zijn verplicht" }, { status: 400 });
    await getKV().set("weer-locatie", { stad, lat, lon });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
