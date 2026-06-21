import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { setIntervalsKey, getIntervalsCredentials } from "@/lib/users";
import { getKV } from "@/lib/kv";
import { intervalsGet } from "@/lib/intervals";
import { datumOffset } from "@/lib/datum";

export async function POST(request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });

    // Rate limiting: max 5 pogingen per minuut per user
    const kv = getKV();
    const rlKey = `ratelimit:onboarding:${user.id}`;
    const pogingen = (await kv.get(rlKey)) || 0;
    if (pogingen >= 5) return NextResponse.json({ success: false, error: "Te veel pogingen. Wacht even en probeer opnieuw." }, { status: 429 });
    await kv.set(rlKey, pogingen + 1, { ex: 60 });

    const { apiKey } = await request.json();
    if (!apiKey) return NextResponse.json({ success: false, error: "API-key is verplicht" }, { status: 400 });

    const result = await setIntervalsKey(user.id, apiKey);

    // Check of er recente wellness-data beschikbaar is
    let dataStatus = "verified_no_data";
    try {
      const oldest = datumOffset(-7);
      const wellness = await intervalsGet("/wellness.json", { oldest, fields: "id,hrv,restingHR" }, { apiKey, athleteId: result.athleteId });
      const heeftData = (wellness || []).some(d => d.hrv || d.restingHR);
      if (heeftData) dataStatus = "verified_with_data";
    } catch {}

    // Sla onboarding-voortgang op
    await kv.set(`user:${user.id}:onboarding`, {
      stap: "voltooid",
      intervalsStatus: dataStatus,
      laatstBijgewerkt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, athleteId: result.athleteId, naam: result.naam, dataStatus, apparaten: result.apparaten });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });
    const kv = getKV();
    const onboarding = await kv.get(`user:${user.id}:onboarding`);
    const heeftKey = !!(await kv.get(`user:${user.id}:intervals_key`));
    const heeftToestemming = !!(await kv.get(`user:${user.id}:toestemming_gezondheid`));

    const stap = heeftKey ? "voltooid" : heeftToestemming ? "intervals_key" : "toestemming";
    return NextResponse.json({ success: true, stap, onboarding, heeftKey, heeftToestemming });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
