import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { haalGebruikersLocatie } from "@/lib/locatie";
import { berekenTempBaseline, berekenHitteVlag } from "@/lib/hitte";

const CONDITIE_MAP = {
  0: "Helder", 1: "Overwegend helder", 2: "Half bewolkt", 3: "Bewolkt",
  45: "Mistig", 48: "Rijpmist", 51: "Lichte motregen", 53: "Motregen", 55: "Zware motregen",
  61: "Lichte regen", 63: "Regen", 65: "Zware regen", 71: "Lichte sneeuw", 73: "Sneeuw",
  80: "Lichte buien", 81: "Buien", 82: "Zware buien", 95: "Onweer",
};

export async function GET() {
  try {
    const user = await getSessionUser();
    const { lat, lon, stad } = await haalGebruikersLocatie(user?.id);

    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max&hourly=precipitation_probability&timezone=Europe/Amsterdam&forecast_days=10`,
      { next: { revalidate: 1800 } }
    );
    if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}`);
    const data = await resp.json();

    const temp = Math.round(data.current?.temperature_2m ?? 0);
    const apparentTemp = data.current?.apparent_temperature ?? null;
    const code = data.current?.weather_code ?? 0;
    const wind = Math.round(data.current?.wind_speed_10m ?? 0);
    const conditie = CONDITIE_MAP[code] || "Onbekend";

    const uurlijks = data.hourly?.precipitation_probability || [];
    const maxNeerslag = Math.max(...uurlijks.slice(0, 24), 0);
    const middag = uurlijks.slice(12, 18);
    const neerslagMiddag = middag.length > 0 ? Math.max(...middag) : 0;

    // Meerdaagse forecast per datum
    const forecast = {};
    const dagDatums = data.daily?.time || [];
    dagDatums.forEach((datum, i) => {
      forecast[datum] = {
        temp: Math.round(data.daily.temperature_2m_max?.[i] ?? 0),
        tempMin: Math.round(data.daily.temperature_2m_min?.[i] ?? 0),
        wind: Math.round(data.daily.wind_speed_10m_max?.[i] ?? 0),
        conditie: CONDITIE_MAP[data.daily.weather_code?.[i]] || "Onbekend",
      };
    });

    // Hitte-detectie
    let hitte = false;
    if (apparentTemp != null) {
      try {
        const kv = getKV();
        const userId = user?.id;
        if (userId) {
          const dcKeys = await kv.keys(`decoupling:*`);
          const dcEntries = [];
          for (const key of (dcKeys || []).slice(-20)) {
            const entry = await kv.get(key);
            if (entry?.userId === userId && entry?.apparent_temp_celsius != null) dcEntries.push(entry);
          }
          const baseline = berekenTempBaseline(dcEntries);
          hitte = baseline != null ? berekenHitteVlag(apparentTemp, baseline) : apparentTemp >= 32;
        } else {
          hitte = apparentTemp >= 32;
        }
      } catch { hitte = apparentTemp >= 32; }
    }

    return NextResponse.json({
      success: true,
      data: { temp, apparentTemp: apparentTemp != null ? Math.round(apparentTemp) : null, conditie, wind, neerslagKans: maxNeerslag, neerslagMiddag, stad, forecast, hitte },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getSessionUser();
    const { stad, lat, lon } = await request.json();
    if (!stad || !lat || !lon) return NextResponse.json({ success: false, error: "stad, lat en lon zijn verplicht" }, { status: 400 });
    const weerKey = user?.id ? `${user.id}:weer-locatie` : "weer-locatie";
    await getKV().set(weerKey, { stad, lat, lon });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
