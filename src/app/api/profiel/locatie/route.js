import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function GET(request) {
  try {
    await getSessionUser();
    const q = new URL(request.url).searchParams.get("q");
    if (!q || q.length < 2) return NextResponse.json({ success: true, data: [] });

    const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=nl`);
    if (!resp.ok) throw new Error(`Geocoding ${resp.status}`);
    const data = await resp.json();

    const resultaten = (data.results || []).map(r => ({
      naam: r.name,
      land: r.country,
      lat: r.latitude,
      lon: r.longitude,
    }));

    return NextResponse.json({ success: true, data: resultaten });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const user = await getSessionUser();
    const { stad, lat, lon } = await request.json();
    if (!stad || lat == null || lon == null) {
      return NextResponse.json({ success: false, error: "stad, lat en lon zijn verplicht" }, { status: 400 });
    }
    const kv = getKV();
    await kv.set(`${user.id}:weer-locatie`, { stad, lat, lon });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
