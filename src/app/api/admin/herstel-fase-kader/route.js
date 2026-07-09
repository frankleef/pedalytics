import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { DOELPROFIELEN, faseInstellingen } from "@/lib/seizoen/doelprofielen";

export const maxDuration = 60;

// Fase-naam-mismatch-bugfix: faseInstellingen() matchte voorheen op fase.naam
// i.p.v. fase.slug, waardoor bouwKader() voor 3 van de 5 doelen (aerobe_basis,
// uithoudingsvermogen, sprint) vrijwel altijd op de generieke Z2-fallback
// terugviel. Deze route herstelt dat met terugwerkende kracht in reeds
// opgeslagen plan.kader — alleen daar: geen wijziging aan
// weekSessies.sessies[] (dat is een aparte, latere beslissing, zie
// diagnoserapport fase-naam-mismatch, onderdeel 3).
//
// Bewust géén bulk-modus voor alle users:active — één expliciete userId per
// aanroep, altijd eerst dry-run (toepassen: false/ontbrekend).
export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { userId, toepassen } = body;
  if (!userId) return NextResponse.json({ error: "userId vereist" }, { status: 400 });

  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan) return NextResponse.json({ error: "Geen plan gevonden" }, { status: 404 });
  if (!plan.kader?.length) return NextResponse.json({ error: "Plan heeft geen kader" }, { status: 400 });

  const doelType = plan.seizoensdoel?.type || plan.doel || "ftp";
  const profiel = DOELPROFIELEN[doelType] || DOELPROFIELEN.ftp;
  const vandaag = new Date().toISOString().slice(0, 10);

  const wijzigingen = [];
  const nieuwKader = plan.kader.map(week => {
    const weekStart = plan.startdatum
      ? new Date(new Date(plan.startdatum).getTime() + (week.week - 1) * 7 * 86400000).toISOString().slice(0, 10)
      : null;

    // Verleden weken worden nooit aangeraakt — zelfde principe als
    // wijzig-doel/route.js en overal elders (sectie 10).
    if (!weekStart || weekStart <= vandaag) {
      return { week, gewijzigd: false, reden: "verleden_of_geen_startdatum" };
    }

    const faseInfo = faseInstellingen(profiel, week.fase);
    if (!faseInfo) {
      return { week, gewijzigd: false, reden: "geen_fase_match" };
    }

    const nieuw = {
      ...week,
      sessietypes: faseInfo.sessietypes,
      z1z2_doel: faseInfo.z1z2_doel,
      max_intensiteit: faseInfo.max_intensiteit_per_week,
      focus: faseInfo.sessietypes.slice(0, 3).join(", "),
    };

    const identiek = JSON.stringify(nieuw.sessietypes) === JSON.stringify(week.sessietypes)
      && nieuw.z1z2_doel === week.z1z2_doel
      && nieuw.max_intensiteit === week.max_intensiteit
      && nieuw.focus === week.focus;

    return { week: nieuw, gewijzigd: !identiek, voor: week, na: nieuw };
  });

  for (const r of nieuwKader) {
    if (r.gewijzigd) {
      wijzigingen.push({
        week: r.voor.week,
        fase: r.voor.fase,
        voor: { sessietypes: r.voor.sessietypes, z1z2_doel: r.voor.z1z2_doel, max_intensiteit: r.voor.max_intensiteit, focus: r.voor.focus },
        na: { sessietypes: r.na.sessietypes, z1z2_doel: r.na.z1z2_doel, max_intensiteit: r.na.max_intensiteit, focus: r.na.focus },
      });
    }
  }

  const resultaat = {
    userId,
    doel: doelType,
    totaalWeken: plan.kader.length,
    aantalGewijzigd: wijzigingen.length,
    wijzigingen,
    toegepast: false,
  };

  if (!toepassen) {
    return NextResponse.json(resultaat);
  }

  if (wijzigingen.length > 0) {
    plan.kader = nieuwKader.map(r => r.week);
    await kv.set(planKey, plan);
  }
  resultaat.toegepast = true;

  return NextResponse.json(resultaat);
}
