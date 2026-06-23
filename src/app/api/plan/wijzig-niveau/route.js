import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { sendPush } from "@/lib/pushNotify";

const NIVEAU_PARAMS = {
  starter:    { z1_z2_aandeel: 0.90, tss_opbouw_pct: 0.05, max_intensiteit: 1, herstelweek_tss_pct: 0.40 },
  recreatief: { z1_z2_aandeel: 0.80, tss_opbouw_pct: 0.10, max_intensiteit: 2, herstelweek_tss_pct: 0.50 },
  getraind:   { z1_z2_aandeel: 0.75, tss_opbouw_pct: 0.15, max_intensiteit: 2, herstelweek_tss_pct: 0.60 },
};

export async function POST(request) {
  try {
    const user = await getSessionUser();
    const { nieuwNiveau } = await request.json();
    if (!nieuwNiveau || !NIVEAU_PARAMS[nieuwNiveau]) {
      return NextResponse.json({ error: "Ongeldig niveau" }, { status: 400 });
    }

    const kv = getKV();
    const planKey = `${user.id}:seizoensplan`;
    const plan = await kv.get(planKey);
    if (!plan) return NextResponse.json({ error: "Geen plan" }, { status: 404 });

    const huidigNiveau = plan.ervaringsniveau ?? "recreatief";
    if (nieuwNiveau === huidigNiveau) {
      return NextResponse.json({ error: "Geen wijziging" }, { status: 400 });
    }

    const params = NIVEAU_PARAMS[nieuwNiveau];
    plan.ervaringsniveau = nieuwNiveau;
    plan.z1_z2_aandeel = params.z1_z2_aandeel;
    plan.max_intensiteit_per_week = params.max_intensiteit;
    plan.herstelweek_tss_pct = params.herstelweek_tss_pct;

    // Herbereken TSS-doelen voor toekomstige weken
    const vandaag = new Date().toISOString().slice(0, 10);
    const baseTss = Math.round((plan.huidige_ctl || 45) * 5);
    if (plan.kader) {
      let vorigOpbouwTss = baseTss;
      plan.kader = plan.kader.map(week => {
        const weekStart = plan.startdatum
          ? new Date(new Date(plan.startdatum).getTime() + (week.week - 1) * 7 * 86400000).toISOString().slice(0, 10)
          : null;
        if (weekStart && weekStart <= vandaag) return week;

        if (week.weektype === "herstel") {
          return { ...week, tss_doel: Math.round(vorigOpbouwTss * params.herstelweek_tss_pct) };
        }
        const tss = Math.round(vorigOpbouwTss * (1 + params.tss_opbouw_pct));
        vorigOpbouwTss = tss;
        return { ...week, tss_doel: tss, z1z2_doel: params.z1_z2_aandeel, max_intensiteit: params.max_intensiteit };
      });
    }

    await kv.set(planKey, plan);

    const niveauLabel = { starter: "Starter", recreatief: "Recreatief", getraind: "Getraind" }[nieuwNiveau];
    await sendPush(user.id, {
      title: "Trainingsniveau bijgewerkt",
      body: `Je niveau is bijgewerkt naar ${niveauLabel}. Je sessies zijn hierop aangepast.`,
      url: "/",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
