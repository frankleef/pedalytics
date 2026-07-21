// Blok F, fase 5: UI-aanroeppunt voor de gepersisteerde review-voorstellen
// (review_voorstel:${userId}, geschreven door F4/cron/review). Ingelogde-
// gebruiker-actie — zelfde auth-conventie als /api/hrv/keuze en
// /api/sessie/kies (getSessionUser), NIET de cron-auth (ADMIN_SECRET/QStash)
// van F4.
//
// "Toepassen" muteert het plan via genereerSessieDag met effectiefSessietype
// als override — hetzelfde patroon als sessiesAanvullen.js:398-408 en
// admin/herbereken-sessies/route.js:95-101 (de enige twee bestaande
// aanroeppunten van genereerSessieDag met een sessietype-override). Er
// bestaat GEEN bestaand "voorstel accepteren"-mechanisme dat direct
// hergebruikt kon worden — HrvAdviesKaart's onKeuze->/api/hrv/keuze delegeert
// naar hrv/verwerking.js's verwerkVerlichten/verwerkSchrappen, die een
// VASTE, HRV-specifieke downgrade toepassen (via sessie/alternatief.js) — geen
// arbitrair doel-sessietype accepteren zoals Blok F nodig heeft. Zie
// verificatierapport voor de volledige onderbouwing.
import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { DAGNAMEN } from "@/lib/datum";
import { kaderWeekVoorDatum, weekInFaseVoorKaderWeek } from "@/lib/weekgrenzen";
import { genereerSessieDag, logSessieGegenereerd } from "@/lib/sessie/genereren";
import { haalWellnessVoorDatum } from "@/lib/sessie/context";

function reviewVoorstelKey(userId) {
  return `review_voorstel:${userId}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });

  const kv = getKV();
  const data = await kv.get(reviewVoorstelKey(user.id));
  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });

  const { datum, actie, nieuwSessietype } = await request.json().catch(() => ({}));
  if (!datum || !actie) return NextResponse.json({ success: false, error: "datum en actie vereist" }, { status: 400 });
  if (actie !== "toepassen" && actie !== "negeren") {
    return NextResponse.json({ success: false, error: "Ongeldige actie" }, { status: 400 });
  }

  const kv = getKV();
  const key = reviewVoorstelKey(user.id);
  const lijst = (await kv.get(key)) || [];
  const item = lijst.find(v => v.datum === datum);
  if (!item) return NextResponse.json({ success: false, error: "Voorstel niet gevonden" }, { status: 404 });

  if (actie === "toepassen") {
    if (!nieuwSessietype) return NextResponse.json({ success: false, error: "nieuwSessietype vereist" }, { status: 400 });

    const planKey = `${user.id}:seizoensplan`;
    const plan = await kv.get(planKey);
    if (!plan?.weekSessies?.sessies) return NextResponse.json({ success: false, error: "Geen actief plan" }, { status: 404 });

    const sessies = plan.weekSessies.sessies;
    const bestaandeSessie = sessies.find(s => s.datum === datum);
    if (!bestaandeSessie) return NextResponse.json({ success: false, error: "Geen sessie gevonden voor deze datum" }, { status: 404 });
    if (bestaandeSessie.voltooid) return NextResponse.json({ success: false, error: "Sessie is al voltooid" }, { status: 400 });

    const dagNaam = DAGNAMEN[new Date(datum).getDay()];
    const uren = plan.urenPerDag?.[dagNaam] || 1.5;
    const overigeSessies = sessies.filter(s => s.datum !== datum && !s.voltooid);
    const kaderWeek = kaderWeekVoorDatum(datum, plan.kader, plan.startdatum);
    const huidigeFase = kaderWeek?.fase ?? "basis";
    const weekInFase = weekInFaseVoorKaderWeek(kaderWeek, plan.kader);
    const weektype = kaderWeek?.weektype || "opbouw";

    const profiel = { ftp: plan.huidige_ftp || 265 };
    const wellness = await haalWellnessVoorDatum(user.id, datum);
    const hrvProfielRaw = await kv.get(`hrv-profiel:${user.id}`);
    const hrvProfiel = typeof hrvProfielRaw === "string" ? JSON.parse(hrvProfielRaw) : hrvProfielRaw;

    const nieuweSessie = await genereerSessieDag({
      kv, userId: user.id, datum, dagNaam, uren,
      profiel, wellness, plan, overigeSessies,
      oudeSessie: bestaandeSessie, effectiefSessietype: nieuwSessietype,
      aanleiding: "review_voorstel_toegepast",
      huidigeFase, weekInFase, weektype, hrvProfiel,
    });

    if (nieuweSessie?._geenSessie) {
      return NextResponse.json({ success: false, error: nieuweSessie.reden || "Kon geen sessie genereren" }, { status: 400 });
    }

    if (bestaandeSessie.intervalsEventId) nieuweSessie.intervalsEventId = bestaandeSessie.intervalsEventId;
    logSessieGegenereerd(nieuweSessie, { userId: user.id, huidigeFase, weekInFase });

    const idx = sessies.indexOf(bestaandeSessie);
    sessies[idx] = nieuweSessie;
    await kv.set(planKey, plan);
  }
  // "negeren": geen planwijziging.

  const resterend = lijst.filter(v => v.datum !== datum);
  if (resterend.length > 0) await kv.set(key, resterend);
  else await kv.del(key);

  return NextResponse.json({ success: true });
}
