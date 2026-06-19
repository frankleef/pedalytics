import { NextResponse } from "next/server";
import { stravaGet, getStoredTokens } from "@/lib/strava";

export async function GET(request) {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) {
      return NextResponse.json({ success: false, error: "Niet geautoriseerd", authUrl: "/api/strava/auth" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const after = searchParams.get("after");
    const epoch = after ? Math.floor(new Date(after).getTime() / 1000) : Math.floor(new Date("2026-01-01").getTime() / 1000);

    const activities = await stravaGet(`/athlete/activities?per_page=200&after=${epoch}`);

    const mapping = {};
    for (const a of activities) {
      mapping[String(a.id)] = {
        athlete_count: a.athlete_count || 1,
        name: a.name,
      };
    }

    return NextResponse.json({ success: true, data: mapping, total: activities.length });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
