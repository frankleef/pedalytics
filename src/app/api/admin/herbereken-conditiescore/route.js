import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { berekenConditieScore, belastingsStatus, conditieStatus, conditiePillStatus, bepaalDecouplingMedianen } from "@/lib/conditie";
import { datumOffset } from "@/lib/datum";

export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = "u_frank_001";
  const kv = getKV();
  const creds = await getIntervalsCredentials(userId);
  if (!creds) return NextResponse.json({ error: "Geen credentials" }, { status: 400 });

  const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0), fields: "id,ctl,atl,rampRate" }, creds);
  const ctlAll = (wellData || []).filter(w => w.ctl != null).sort((a, b) => (a.id || "").localeCompare(b.id || ""));

  const ctlNu = ctlAll.length > 0 ? ctlAll[ctlAll.length - 1].ctl : null;
  const ctl4wGeleden = ctlAll.length > 0 ? ctlAll[0].ctl : null;
  // Rechtstreeks intervals.icu's eigen rampRate — zie ramp-rate-fix-en-impact.md, Deel A.
  const ctlRamp = ctlAll.length > 0 ? (ctlAll[ctlAll.length - 1].rampRate ?? null) : null;

  const rpeTrend = await kv.get(`rpe_trend:${userId}`);

  // Decoupling medianen uit KV
  const activities = await intervalsGet("/activities", { oldest: datumOffset(-30), newest: datumOffset(0), limit: "30", fields: "id,type" }, creds);
  const ritten = (activities || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");
  const dcWaarden = [];
  for (const r of ritten) {
    const dc = await kv.get(`decoupling:${r.id}`);
    if (dc == null) continue;
    const w = typeof dc === "number" ? dc : dc?.decoupling;
    if (w != null) dcWaarden.push(w);
  }
  const { huidig: dcHuidig, vorig: dcVorig } = bepaalDecouplingMedianen(dcWaarden);

  const score = berekenConditieScore({ ctl_nu: ctlNu, ctl_4w_geleden: ctl4wGeleden, rpe_delta_trend: rpeTrend ?? null, decoupling_huidig: dcHuidig, decoupling_vorig: dcVorig });
  const belasting = belastingsStatus(ctlRamp ?? 0, 50);
  const conditie = conditieStatus(score);
  const pill = conditiePillStatus(belasting, conditie);

  await kv.set(`conditie_score:${userId}`, { score, belasting, conditie, pill, ctl_nu: ctlNu, ctl_4w_geleden: ctl4wGeleden, ctl_ramp: ctlRamp, rpe_delta_trend: rpeTrend, bijgewerkt_op: new Date().toISOString() }, { ex: 8 * 86400 });

  return NextResponse.json({ success: true, score, belasting, conditie, pill, ctl_nu: ctlNu, ctl_4w_geleden: ctl4wGeleden, ctl_ramp: ctlRamp, rpe_delta_trend: rpeTrend, dc_huidig: dcHuidig, dc_vorig: dcVorig });
}
