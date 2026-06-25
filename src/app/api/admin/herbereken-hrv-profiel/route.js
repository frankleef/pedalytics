import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { herberekenHrvProfiel, checkDataStatus } from "@/lib/hrv/profiel";
import { berekenHerstelDagen } from "@/lib/hrv/herstelsnelheid";
import { berekenHrvRpeCorrelatie } from "@/lib/hrv/correlatie";
import { datumOffset } from "@/lib/datum";

export const maxDuration = 120;

export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kv = getKV();
  const userId = "u_frank_001";
  const creds = await getIntervalsCredentials(userId);
  if (!creds) return NextResponse.json({ error: "Geen credentials" }, { status: 404 });

  // 365 dagen wellness
  const wellnessData = await intervalsGet("/wellness", {
    oldest: datumOffset(-365), newest: datumOffset(0),
  }, creds);

  if (!wellnessData || wellnessData.length === 0) {
    return NextResponse.json({ error: "Geen wellness data" }, { status: 404 });
  }

  // Normaliseer datums
  const genormaliseerd = wellnessData.map(w => ({ ...w, datum: w.id || w.datum }));

  // Basisprofiel
  const profiel = herberekenHrvProfiel(genormaliseerd, null);
  const statusCheck = checkDataStatus(genormaliseerd, null);

  // Herstelsnelheid per sessiecategorie
  const plan = await kv.get(`${userId}:seizoensplan`);
  const sessies = plan?.weekSessies?.sessies || [];
  const voltooide = sessies.filter(s => s.voltooid && s.intentie?.sessietype);

  const herstelsnelheid = {};
  for (const s of voltooide) {
    const dagen = berekenHerstelDagen(s.intentie.sessietype, s.datum, genormaliseerd, profiel);
    if (dagen != null) {
      const type = s.intentie.sessietype;
      if (!herstelsnelheid[type]) herstelsnelheid[type] = { totaal: 0, observaties: 0 };
      herstelsnelheid[type].totaal += dagen;
      herstelsnelheid[type].observaties++;
    }
  }

  const herstelsnelheidGemiddeld = {};
  for (const [type, data] of Object.entries(herstelsnelheid)) {
    herstelsnelheidGemiddeld[type] = {
      dagen: Math.round((data.totaal / data.observaties) * 10) / 10,
      observaties: data.observaties,
    };
  }

  // RPE-correlatie
  const observatiesMetRpe = [];
  for (const s of voltooide) {
    if (!s.datum) continue;
    const wellnessDag = genormaliseerd.find(w => w.datum === s.datum);
    if (!wellnessDag?.hrv || s.verwacht_rpe == null) continue;

    // Zoek de werkelijke RPE uit intervals.icu
    try {
      const acts = await intervalsGet("/activities", { oldest: s.datum, newest: s.datum, limit: "5", fields: "id,start_date_local,icu_rpe" }, creds);
      const rit = (acts || []).find(a => a.start_date_local?.startsWith(s.datum));
      if (rit?.icu_rpe) {
        observatiesMetRpe.push({ hrv: wellnessDag.hrv, rpe_delta: rit.icu_rpe - s.verwacht_rpe });
      }
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }

  const correlatie = berekenHrvRpeCorrelatie(observatiesMetRpe, profiel);

  const volledigProfiel = {
    ...profiel,
    ...statusCheck,
    herstelsnelheid: { ...herstelsnelheidGemiddeld, _fallback_gebruikt: Object.keys(herstelsnelheidGemiddeld).length < 3 },
    hrv_rpe_correlatie: correlatie,
    hrv_checkin_gewichten: { hrv: 0.65, checkin: 0.35, observaties: 0, gepersonaliseerd: false },
    checkin_actief: true,
  };

  await kv.set(`hrv-profiel:${userId}`, volledigProfiel);

  return NextResponse.json({
    profiel: volledigProfiel,
    wellness_dagen: genormaliseerd.length,
    voltooide_sessies: voltooide.length,
    observaties_herstelsnelheid: Object.values(herstelsnelheidGemiddeld).reduce((s, d) => s + d.observaties, 0),
    observaties_correlatie: correlatie.observaties,
  });
}
