import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { datumISO } from "@/lib/datum";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const creds = await getIntervalsCredentials(user.id);
  if (!creds) return NextResponse.json({ error: "Niet gekoppeld" }, { status: 400 });

  const oldest = datumISO(new Date(Date.now() - 365 * 86400000));
  const newest = datumISO(new Date());

  const activiteiten = await intervalsGet("/activities", {
    oldest, newest, limit: "500",
    fields: "id,name,start_date_local,icu_rpe,icu_training_load,moving_time,type",
  }, creds);

  const ritten = (activiteiten || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");

  const wellness = await intervalsGet("/wellness", { oldest, newest }, creds) || [];
  const wellnessByDatum = {};
  for (const w of wellness) {
    const d = w.id || w.datum;
    if (d) wellnessByDatum[d] = w;
  }

  const observaties = ritten
    .filter(a => a.icu_rpe != null)
    .map(a => {
      const datum = a.start_date_local?.slice(0, 10);
      const w = wellnessByDatum[datum];
      return {
        datum,
        activiteit_naam: a.name,
        icu_rpe: a.icu_rpe,
        hrv: w?.hrv ?? null,
        hrv_beschikbaar: w?.hrv != null,
      };
    });

  const metBeide = observaties.filter(o => o.hrv != null);

  return NextResponse.json({
    samenvatting: {
      totaal_ritten: ritten.length,
      met_icu_rpe: observaties.length,
      met_hrv_en_rpe: metBeide.length,
      betrouwbaar_na_fix: metBeide.length >= 20,
    },
    observaties_met_beide: metBeide.slice(-20).reverse(),
    observaties_zonder_hrv: observaties
      .filter(o => o.hrv == null)
      .map(o => ({ datum: o.datum, naam: o.activiteit_naam, rpe: o.icu_rpe })),
  });
}
