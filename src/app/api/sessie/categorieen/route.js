import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { kaderWeekVoorDatum, weekInFaseVoorKaderWeek } from "@/lib/weekgrenzen";
import { GELDIGE_SESSIETYPES } from "@/lib/sessie-archetypes";
import { DOELPROFIELEN, faseInstellingen } from "@/lib/seizoen/doelprofielen";

export const dynamic = "force-dynamic";

// Sectie 51-D, chunk 2, stap 1: fase-passende sessietypes voor een datum, plus
// altijd de aparte "tests"-categorie (ongeacht fase — zie 51-D-motivatie: anders
// zou een gebruiker in week 3 nooit zelf een ramp test kunnen kiezen).
//
// bouwKader() (sectie 49/51-C) berekent `kaderWeek.sessietypes` al bij
// plangeneratie, maar dat is een SNAPSHOT op het moment van opslaan — plannen
// die zijn opgeslagen vóórdat dat veld bestond (of die via een ander pad zijn
// aangemaakt/bijgewerkt) kunnen het missen. Daarom hier een garantiefallback:
// als het veld ontbreekt of leeg is, wordt het opnieuw afgeleid uit
// faseInstellingen() — exact dezelfde berekening als bouwKader() zelf gebruikt.
// Zonder deze fallback kon "Kies een type" volledig leeg blijven i.p.v. minimaal
// z2_duur + tests te tonen.
//
// Alleen de types die ook daadwerkelijk archetype/variant-data hebben
// (GELDIGE_SESSIETYPES) worden getoond — z1_herstel e.d. zijn bewust uitgesloten
// van archetypelogica (zie sessie-archetypes.js) en hebben dus geen varianten
// om uit te kiezen.
function bepaalFaseSessietypes(plan, kaderWeek) {
  if (kaderWeek?.sessietypes?.length) return kaderWeek.sessietypes;
  const doelType = plan.seizoensdoel?.type || plan.doel || "ftp";
  const doelProfiel = DOELPROFIELEN[doelType] || DOELPROFIELEN.ftp;
  const faseInfo = kaderWeek?.fase ? faseInstellingen(doelProfiel, kaderWeek.fase) : null;
  return faseInfo?.sessietypes || ["z2_duur", "z1_herstel"];
}

export async function GET(request) {
  try {
    const user = await getSessionUser();
    if (!user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const datum = searchParams.get("datum");
    if (!datum) return NextResponse.json({ success: false, error: "datum vereist" }, { status: 400 });

    const kv = getKV();
    const plan = await kv.get(`${user.id}:seizoensplan`);
    if (!plan) return NextResponse.json({ success: false, error: "Geen actief plan" }, { status: 404 });

    const kaderWeek = kaderWeekVoorDatum(datum, plan.kader, plan.startdatum);
    const faseSessietypes = bepaalFaseSessietypes(plan, kaderWeek).filter(t => GELDIGE_SESSIETYPES.has(t));

    const categorieen = [
      ...faseSessietypes.map(sessietype => ({ categorie: sessietype, sessietype })),
      { categorie: "tests", sessietype: null },
    ];

    return NextResponse.json({
      success: true,
      data: {
        categorieen,
        fase: kaderWeek?.fase ?? null,
        weekInFase: weekInFaseVoorKaderWeek(kaderWeek, plan.kader),
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
