import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { herberekenHrvProfiel, checkDataStatus } from "@/lib/hrv/profiel";
import { berekenHrvRpeCorrelatie } from "@/lib/hrv/correlatie";
import { herberekenGewichtenHrvCheckin } from "@/lib/hrv/leerdata";
import { datumOffset } from "@/lib/datum";
import { berekenVerwachtRpe as berekenVerwachtRpeLib } from "@/lib/sessie/rpe";
import { zoneTimesNaarObject } from "@/lib/uitvoeringsscore";

// Fallback zolang er nog geen (of te weinig) geleerde checkin-gewichten zijn.
const DEFAULT_HRV_CHECKIN_GEWICHTEN = { hrv: 0.65, checkin: 0.35, observaties: 0, gepersonaliseerd: false };

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

  // RPE-correlatie: haal alle ritten met icu_rpe rechtstreeks uit intervals.icu
  const wellnessByDatum = {};
  for (const w of genormaliseerd) { if (w.datum) wellnessByDatum[w.datum] = w; }

  const alleActiviteiten = await intervalsGet("/activities", {
    oldest: datumOffset(-365), newest: datumOffset(0), limit: "500",
    fields: "id,name,start_date_local,icu_rpe,icu_training_load,moving_time,type,icu_weighted_avg_watts,average_watts,icu_zone_times",
  }, creds);

  const rittenMetRpe = (alleActiviteiten || [])
    .filter(a => (a.type === "Ride" || a.type === "VirtualRide") && a.icu_rpe != null);

  const observatiesVoorCorrelatie = rittenMetRpe
    .map(rit => {
      const datum = rit.start_date_local?.slice(0, 10);
      const w = wellnessByDatum[datum];
      if (!w?.hrv) return null;
      const tijdInZones = zoneTimesNaarObject(rit.icu_zone_times);
      if (!tijdInZones) return null;
      const duurMin = rit.moving_time ? Math.round(rit.moving_time / 60) : null;
      const verwachtRpe = duurMin ? berekenVerwachtRpeLib(tijdInZones, duurMin) : null;
      const rpeDelta = verwachtRpe != null ? rit.icu_rpe - verwachtRpe : null;
      return { datum, hrv: w.hrv, icu_rpe: rit.icu_rpe, verwacht_rpe: verwachtRpe, rpe_delta: rpeDelta };
    })
    .filter(Boolean);

  const metDelta = observatiesVoorCorrelatie.filter(o => o.rpe_delta != null);
  const correlatie = berekenHrvRpeCorrelatie(metDelta, profiel);

  // Checkin-gewichten herberekenen op basis van de bestaande checkin-keuze-
  // observaties (hrv-observaties:{userId} — gevuld via /api/hrv/keuze, niet
  // door deze route). Niet overschrijven met de hrv+rpe_delta-data hierboven:
  // die dient alleen hrv_rpe_correlatie en heeft geen checkin_score/keuze.
  const bestaandProfiel = await kv.get(`hrv-profiel:${userId}`);
  const observatiesRaw = await kv.get(`hrv-observaties:${userId}`);
  const observatiesCheckin = Array.isArray(observatiesRaw) ? observatiesRaw : (typeof observatiesRaw === "string" ? JSON.parse(observatiesRaw) : []);
  const hrvCheckinGewichten = herberekenGewichtenHrvCheckin(observatiesCheckin, bestaandProfiel?.hrv_checkin_gewichten ?? DEFAULT_HRV_CHECKIN_GEWICHTEN);

  // Baseert op bestaandProfiel i.p.v. puur op de lokale berekeningen hierboven
  // — anders wist elke aanroep van deze admin-actie stilzwijgend velden die
  // deze route niet zelf beheert (bv. rhr_basislijn_28d uit B6, herstelsnelheid
  // dat sinds B2 alleen nog door de wekelijkse cron wordt bijgehouden, en
  // eventuele toekomstige HRV/RHR-trendvelden). Alleen de velden die DEZE
  // route daadwerkelijk berekent worden overridden; profiel zelf blijft
  // bewust een ongedempte volledige herberekening (huidigProfiel: null,
  // regel 41 — dat gaat over de BEREKENING, dit hier alleen over het SCHRIJVEN).
  const volledigProfiel = {
    ...bestaandProfiel,
    ...profiel,
    ...statusCheck,
    hrv_rpe_correlatie: correlatie,
    hrv_checkin_gewichten: hrvCheckinGewichten,
    checkin_actief: true,
  };

  await kv.set(`hrv-profiel:${userId}`, volledigProfiel);

  return NextResponse.json({
    profiel: volledigProfiel,
    wellness_dagen: genormaliseerd.length,
    observaties_correlatie: correlatie.observaties,
    ritten_met_rpe: rittenMetRpe.length,
    ritten_met_hrv_en_rpe: metDelta.length,
  });
}
