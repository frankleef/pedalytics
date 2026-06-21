import { NextResponse } from "next/server";
import { intervalsGet } from "@/lib/intervals";
import { getUserIntervalsConfig, NietGekoppeldError } from "@/lib/auth";

export async function GET(request) {
  try {
    const creds = await getUserIntervalsConfig();
    const { searchParams } = new URL(request.url);
    const periode = searchParams.get("periode") || "42d";
    const vorige = searchParams.get("vorige") || "84d";

    const data = await intervalsGet("/power-curves.json", { type: "Ride", curves: `${periode},${vorige}` }, creds);

    const BUCKETS = [5, 15, 30, 60, 180, 300, 600, 1200, 3600];
    const LABELS = ["5s", "15s", "30s", "1m", "3m", "5m", "10m", "20m", "60m"];

    const extract = (curve) => {
      if (!curve?.secs || !curve?.watts) return [];
      return BUCKETS.map((sec, i) => {
        const idx = curve.secs.indexOf(sec);
        return { sec, label: LABELS[i], watt: idx >= 0 ? curve.watts[idx] : 0 };
      });
    };

    const huidig = extract(data.list?.[0]);
    const vorig_data = extract(data.list?.[1]);

    return NextResponse.json({ success: true, huidig, vorig: vorig_data });
  } catch (e) {
    if (e.code === "NOT_LINKED") return NextResponse.json({ success: false, notLinked: true });
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
