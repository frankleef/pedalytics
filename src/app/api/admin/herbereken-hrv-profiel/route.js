import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { herberekenHrvProfiel, checkDataStatus } from "@/lib/hrv/profiel";
import { berekenHerstelDagen } from "@/lib/hrv/herstelsnelheid";
import { berekenHrvRpeCorrelatie } from "@/lib/hrv/correlatie";
import { datumOffset } from "@/lib/datum";
import { berekenVerwachtRpe as berekenVerwachtRpeLib } from "@/lib/sessie/rpe";

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

  // RPE-correlatie: haal alle ritten met icu_rpe rechtstreeks uit intervals.icu
  const wellnessByDatum = {};
  for (const w of genormaliseerd) { if (w.datum) wellnessByDatum[w.datum] = w; }

  const alleActiviteiten = await intervalsGet("/activities", {
    oldest: datumOffset(-365), newest: datumOffset(0), limit: "500",
    fields: "id,name,start_date_local,icu_rpe,icu_training_load,moving_time,type,icu_weighted_avg_watts,average_watts",
  }, creds);

  const rittenMetRpe = (alleActiviteiten || [])
    .filter(a => (a.type === "Ride" || a.type === "VirtualRide") && a.icu_rpe != null);

  const observatiesVoorCorrelatie = rittenMetRpe
    .map(rit => {
      const datum = rit.start_date_local?.slice(0, 10);
      const w = wellnessByDatum[datum];
      if (!w?.hrv) return null;
      if (!rit.icu_weighted_avg_watts && !rit.average_watts) return null;
      const npWatts = rit.icu_weighted_avg_watts || rit.average_watts;
      const ftpVoorRit = plan?.huidige_ftp || 265;
      const ifGereden = npWatts / ftpVoorRit;
      const duurMin = rit.moving_time ? Math.round(rit.moving_time / 60) : null;
      const verwachtRpe = (ifGereden && duurMin) ? berekenVerwachtRpeLib(ifGereden, duurMin) : null;
      const rpeDelta = verwachtRpe != null ? rit.icu_rpe - verwachtRpe : null;
      return { datum, hrv: w.hrv, icu_rpe: rit.icu_rpe, verwacht_rpe: verwachtRpe, rpe_delta: rpeDelta };
    })
    .filter(Boolean);

  const metDelta = observatiesVoorCorrelatie.filter(o => o.rpe_delta != null);
  const correlatie = berekenHrvRpeCorrelatie(metDelta, profiel);

  // Sla observaties op voor leerlaag
  await kv.set(`hrv-observaties:${userId}`, metDelta.map(o => ({
    datum: o.datum, hrv: o.hrv, rpe_delta: o.rpe_delta,
    keuze: null, sessietype: null, override: false, timestamp: new Date().toISOString(),
  })).slice(-365));

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
    ritten_met_rpe: rittenMetRpe.length,
    ritten_met_hrv_en_rpe: metDelta.length,
  });
}
