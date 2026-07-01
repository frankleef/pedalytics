import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { datumOffset } from "@/lib/datum";
import { berekenVerwachtRpe } from "@/lib/sessie/rpe";
import { zoneTimesNaarObject } from "@/lib/uitvoeringsscore";

// Eenmalig herstel-endpoint (sectie 26-C, Appendix B-1): herberekent verwacht_rpe
// en rpe_delta van gisteren met de nieuwe Lucia TRIMP-formule, na de overstap van
// IF^2.5 naar zonedistributie. Alleen relevant zolang die overstap nog niet via de
// normale PUT /api/intervals/workouts/[id]-flow is herberekend.
export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = "u_frank_001";
  const kv = getKV();
  const creds = await getIntervalsCredentials(userId);
  if (!creds) return NextResponse.json({ error: "Geen credentials" }, { status: 404 });

  const datum = datumOffset(-1);

  const activiteiten = await intervalsGet("/activities", {
    oldest: datum, newest: datum,
    fields: "id,name,start_date_local,icu_rpe,moving_time,type,icu_zone_times",
  }, creds);

  const activiteit = (activiteiten || []).find(a => a.type === "Ride" || a.type === "VirtualRide");
  if (!activiteit) {
    return NextResponse.json({ error: `Geen rit gevonden voor ${datum}` }, { status: 404 });
  }

  const tijdInZones = zoneTimesNaarObject(activiteit.icu_zone_times);
  if (!tijdInZones) {
    return NextResponse.json({ error: `Geen zonedistributie beschikbaar voor ${datum}` }, { status: 422 });
  }

  const werkelijkRpe = activiteit.icu_rpe;
  if (werkelijkRpe == null) {
    return NextResponse.json({ error: `Geen RPE ingevuld voor ${datum} — delta kan niet berekend worden` }, { status: 422 });
  }

  const duurMinuten = activiteit.moving_time ? Math.round(activiteit.moving_time / 60) : 60;
  const nieuweVerwachtRpe = berekenVerwachtRpe(tijdInZones, duurMinuten);
  const nieuweDelta = Math.round((werkelijkRpe - nieuweVerwachtRpe) * 10) / 10;

  const plan = await kv.get(`${userId}:seizoensplan`);
  const sessie = plan?.weekSessies?.sessies?.find(s => s.datum === datum);
  if (sessie) {
    sessie.verwacht_rpe = nieuweVerwachtRpe;
    sessie.rpe_delta = nieuweDelta;
    await kv.set(`${userId}:seizoensplan`, plan);
  }

  await kv.set(`rpe_delta:${datum}:${userId}`, nieuweDelta, { ex: 30 * 86400 });

  return NextResponse.json({
    datum,
    tijdInZones,
    nieuweVerwachtRpe,
    werkelijkRpe,
    nieuweDelta,
    seizoensplanBijgewerkt: !!sessie,
  });
}
