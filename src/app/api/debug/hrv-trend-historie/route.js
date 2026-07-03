import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { datumISO } from "@/lib/datum";
import { berekenHrvBaseline, berekenHrvTrend } from "@/lib/hrv/trend";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const creds = await getIntervalsCredentials(user?.id);
    if (!creds) return NextResponse.json({ error: "Niet gekoppeld" }, { status: 400 });

    const oldest = datumISO(new Date(Date.now() - 90 * 86400000));
    const newest = datumISO(new Date());
    const wellness = await intervalsGet("/wellness", { oldest, newest }, creds);
    if (!wellness?.length) return NextResponse.json({ success: true, data: [] });

    const hrvPerDag = wellness
      .filter(w => w.hrv != null)
      .sort((a, b) => (a.id || "").localeCompare(b.id || ""));

    const historie = [];
    for (let i = 13; i < hrvPerDag.length; i++) {
      const venster14d = hrvPerDag.slice(i - 13, i + 1).map(w => w.hrv);
      const baseline = berekenHrvBaseline(venster14d);
      const trend = berekenHrvTrend(venster14d.slice(-7), baseline);

      historie.push({
        datum: hrvPerDag[i].id?.split("T")[0],
        hrv: hrvPerDag[i].hrv,
        baseline: baseline != null ? Math.round(baseline * 10) / 10 : null,
        trend: trend != null ? Math.round(trend * 10) / 10 : null,
        getriggerd: trend != null && trend < -15,
      });
    }

    return NextResponse.json({
      success: true,
      drempels: { trigger: "< -15%", licht_verlaagd: "-15% tot -8%", normaal: "-8% tot +8%", geen_actie: "> +8%" },
      data: historie,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
