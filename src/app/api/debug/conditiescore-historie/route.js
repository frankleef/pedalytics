import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { datumISO } from "@/lib/datum";
import { berekenConditieScore, belastingsStatus, conditieStatus, conditiePillStatus, ctlRampRegressie } from "@/lib/conditie";
import { getKV } from "@/lib/kv";

export async function GET() {
  try {
    const user = await getSessionUser();
    const creds = await getIntervalsCredentials(user?.id);
    if (!creds) return NextResponse.json({ error: "Niet gekoppeld" }, { status: 400 });

    const oldest = datumISO(new Date(Date.now() - 90 * 86400000));
    const newest = datumISO(new Date());
    const wellness = await intervalsGet("/wellness", { oldest, newest }, creds);
    if (!wellness?.length) return NextResponse.json({ success: true, data: [] });

    const kv = getKV();
    const rpeTrend = await kv.get(`rpe_trend:${user.id}`);

    const ctlPerDag = wellness.filter(w => w.ctl != null).sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    const historie = [];

    for (let i = 27; i < ctlPerDag.length; i++) {
      const dag = ctlPerDag[i];
      const datum = dag.id?.split("T")[0];
      const ctlNu = dag.ctl;
      const ctl4w = ctlPerDag[i - 27]?.ctl;
      const window28 = ctlPerDag.slice(Math.max(0, i - 27), i + 1).map(w => w.ctl);
      const ramp = ctlRampRegressie(window28);

      const score = berekenConditieScore({
        ctl_nu: ctlNu,
        ctl_4w_geleden: ctl4w,
        rpe_delta_trend: rpeTrend,
        decoupling_huidig: null,
        decoupling_vorig: null,
      });

      const belasting = belastingsStatus(ramp ?? 0, 60);
      const conditie = conditieStatus(score);
      const pill = conditiePillStatus(belasting, conditie);

      historie.push({
        datum,
        ctl: Math.round(ctlNu),
        ctl_4w_geleden: ctl4w ? Math.round(ctl4w) : null,
        ctl_delta: ctl4w ? Math.round(ctlNu - ctl4w) : null,
        ramp_rate: ramp,
        conditie_score: score != null ? Math.round(score * 100) / 100 : null,
        belasting,
        conditie,
        pill_label: pill.label,
        pill_kleur: pill.kleur,
      });
    }

    return NextResponse.json({
      success: true,
      drempels: { ramp_optimaal: "1.5-5.0/week", ctl_groei: ">+2 over 4 weken" },
      rpe_delta_trend: rpeTrend,
      data: historie,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
