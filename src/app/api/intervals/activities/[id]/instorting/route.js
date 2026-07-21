import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getUserIntervalsConfig } from "@/lib/auth";

// E1: pure KV-leesroute — geen nieuwe intervals.icu-aanroep. Het
// segment_instorting-record wordt al server-side door cron/sync
// weggeschreven (src/app/api/cron/sync/route.js). Eigen try/catch/route,
// losstaand van de bestaande streams-route: een falende lookup mag de
// hoofdritweergave (die classificeerRit() al gebruikt) nooit beïnvloeden.
export async function GET(request, { params }) {
  try {
    const { userId } = await getUserIntervalsConfig();
    const { id } = params;
    const kv = getKV();
    const data = await kv.get(`segment_instorting:${userId}:${id}`);
    return NextResponse.json({ success: true, data: data || null });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
