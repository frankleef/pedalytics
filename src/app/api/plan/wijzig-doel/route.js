import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { DOELPROFIELEN, faseVoorWeek } from "@/lib/seizoen/doelprofielen";
import { genereerSeizoensMetadata } from "@/lib/seizoen/metadata";
import { sendPush } from "@/lib/pushNotify";

export async function POST(request) {
  try {
    const user = await getSessionUser();
    const { nieuwDoel } = await request.json();
    if (!nieuwDoel || !DOELPROFIELEN[nieuwDoel]) {
      return NextResponse.json({ error: "Ongeldig doel" }, { status: 400 });
    }

    const kv = getKV();
    const planKey = `${user.id}:seizoensplan`;
    const plan = await kv.get(planKey);
    if (!plan) return NextResponse.json({ error: "Geen plan" }, { status: 404 });

    const eindDatum = plan.startdatum
      ? new Date(new Date(plan.startdatum).getTime() + (plan.tijdshorizon_weken || 13) * 7 * 86400000)
      : null;
    const wekenResterend = eindDatum ? Math.ceil((eindDatum - new Date()) / (7 * 86400000)) : 0;
    if (wekenResterend < 4) {
      return NextResponse.json({ error: "Te weinig weken resterend" }, { status: 400 });
    }

    plan.vorig_seizoensdoel = plan.seizoensdoel?.type;
    plan.seizoensdoel = { ...plan.seizoensdoel, type: nieuwDoel };

    // Herbereken kader voor toekomstige weken
    const profiel = DOELPROFIELEN[nieuwDoel];
    const vandaag = new Date().toISOString().slice(0, 10);
    if (plan.kader) {
      plan.kader = plan.kader.map(week => {
        const weekStart = plan.startdatum
          ? new Date(new Date(plan.startdatum).getTime() + (week.week - 1) * 7 * 86400000).toISOString().slice(0, 10)
          : null;
        if (weekStart && weekStart <= vandaag) return week;

        const faseInfo = faseVoorWeek(profiel, week.week);
        if (!faseInfo) return week;
        return {
          ...week,
          fase: faseInfo.naam,
          sessietypes: faseInfo.sessietypes,
          z1z2_doel: faseInfo.z1z2_doel,
          max_intensiteit: faseInfo.max_intensiteit_per_week,
          focus: faseInfo.sessietypes.slice(0, 3).join(", "),
        };
      });
    }

    try {
      const metadata = genereerSeizoensMetadata({
        seizoensdoel: plan.seizoensdoel,
        kader: plan.kader,
        ervaringsniveau: plan.ervaringsniveau,
        ftp: plan.huidige_ftp,
        startProfiel: plan.start_profiel,
        urenPerDag: plan.urenPerDag,
      });
      plan.samenvatting = metadata.samenvatting;
      plan.streefwaarde = metadata.streefwaarde;
    } catch (e) {
      console.warn("Metadata-herberekening mislukt:", e.message);
    }

    await kv.set(planKey, plan);

    const doelLabel = { ftp: "FTP verhogen", aerobe_basis: "Betere aerobe basis", klimmen: "Klimmen & W/kg", uithoudingsvermogen: "Lange ritten", sprint: "Snelheid & sprint" }[nieuwDoel];
    await sendPush(user.id, {
      title: "Plan bijgewerkt",
      body: `Je plan is bijgewerkt voor ${doelLabel}.`,
      url: "/",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
