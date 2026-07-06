import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { bouwWeekvolgorde } from "@/lib/seizoen/faseDuren";
import { DOELPROFIELEN, faseInstellingen } from "@/lib/seizoen/doelprofielen";

export const maxDuration = 60;

export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kv = getKV();
  const userId = "u_frank_001";
  const plan = await kv.get(`${userId}:seizoensplan`);
  if (!plan) return NextResponse.json({ error: "Geen plan gevonden" }, { status: 404 });

  // Archiveer
  await kv.set(`${userId}:seizoensplan:pre_16wk`, JSON.stringify(plan), { ex: 90 * 86400 });

  const doelType = plan.seizoensdoel?.type || "ftp";
  const niveau = plan.ervaringsniveau || "recreatief";
  const doelProfiel = DOELPROFIELEN[doelType] || DOELPROFIELEN.ftp;

  const weekVolgorde = bouwWeekvolgorde(16, doelType, niveau);

  // Bouw TSS-doelen
  const ctl = plan.huidige_ctl || 45;
  const baseTss = Math.round(ctl * 5);
  const opbouwPct = doelProfiel.tss_opbouw_pct ?? 0.10;
  const niveauTaper = { starter: 0.40, recreatief: 0.50, getraind: 0.60 }[niveau] || 0.50;
  const taperPct = doelProfiel.taper_tss_pct ?? niveauTaper;
  let vorigOpbouwTss = baseTss;
  let piekTss = baseTss;

  const nieuwKader = weekVolgorde.map((wk) => {
    const faseInfo = faseInstellingen(doelProfiel, wk.fase);
    let tss_doel;

    if (wk.weektype === "herstel") {
      tss_doel = Math.round(piekTss * taperPct);
      vorigOpbouwTss = baseTss;
      piekTss = baseTss;
    } else if (wk.fase === "consolidatie") {
      tss_doel = Math.round(piekTss * 0.58);
    } else if (wk.fase === "test") {
      tss_doel = Math.round(piekTss * 0.40);
    } else {
      tss_doel = wk.weeknummer === 1 ? baseTss : Math.round(vorigOpbouwTss * (1 + opbouwPct));
      tss_doel = Math.min(tss_doel, Math.round(baseTss * 1.8));
      vorigOpbouwTss = tss_doel;
      piekTss = Math.max(piekTss, tss_doel);
    }

    return {
      week: wk.weeknummer,
      fase: wk.fase,
      weektype: wk.weektype,
      tss_doel,
      focus: faseInfo ? `${faseInfo.sessietypes.slice(0, 3).join(", ")}` : "Z2 volume",
      z1z2_doel: faseInfo?.z1z2_doel || 0.80,
      max_intensiteit: faseInfo?.max_intensiteit_per_week ?? 1,
      sessietypes: faseInfo?.sessietypes || ["z2_duur", "z1_herstel"],
    };
  });

  const bijgewerktPlan = {
    ...plan,
    kader: nieuwKader,
    tijdshorizon_weken: 16,
  };

  await kv.set(`${userId}:seizoensplan`, bijgewerktPlan);

  return NextResponse.json({
    success: true,
    totaalWeken: 16,
    kader: nieuwKader.map(w => `wk${w.week}: ${w.fase} (${w.weektype}) TSS=${w.tss_doel}`),
    notitie: "Kader gemigreerd naar 16 weken. Gebruik /api/admin/herbereken-sessies om toekomstige sessies te regenereren.",
  });
}
