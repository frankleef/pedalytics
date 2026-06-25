import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { vandaagISO } from "@/lib/datum";
import { getSessionUser } from "@/lib/auth";
import { checkInSessieAanpassing, adviesOpvolgen } from "@/lib/sessie/checkinAanpassing";

function checkinKey(userId) {
  const prefix = userId ? `${userId}:` : "";
  return `${prefix}checkin:${vandaagISO()}`;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    const data = await getKV().get(checkinKey(user?.id));
    return NextResponse.json({ success: true, data: data || null });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getSessionUser();
    const { score } = await request.json();
    if (!score || score < 1 || score > 5) {
      return NextResponse.json({ success: false, error: "Score moet 1-5 zijn" }, { status: 400 });
    }
    const kv = getKV();
    const data = { score, timestamp: new Date().toISOString() };
    await kv.set(checkinKey(user?.id), data, { ex: 86400 * 2 });

    // Check of er al een expliciete HRV-keuze is gemaakt
    const planKey = `${user.id}:seizoensplan`;
    const plan = await kv.get(planKey);
    const vandaag = vandaagISO();
    const sessie = plan?.weekSessies?.sessies?.find(s => s.datum === vandaag);

    if (sessie?.hrv_keuze_gemaakt) {
      // HRV-keuze heeft voorrang — sla sectie 21-aanpassing over
      try {
        const { bepaalGecombineerdeZone } = await import("@/lib/hrv/zone");
        const hrvProfielRaw = await kv.get(`hrv-profiel:${user.id}`);
        const hrvProfiel = typeof hrvProfielRaw === "string" ? JSON.parse(hrvProfielRaw) : hrvProfielRaw;
        const gecombineerdeZone = bepaalGecombineerdeZone(
          sessie.hrv_zone ?? "normaal", score, hrvProfiel?.hrv_checkin_gewichten
        );
        sessie.gecombineerde_hrv_zone = gecombineerdeZone;
        await kv.set(planKey, plan);
      } catch (e) { console.warn("[checkIn] GecombineerdeZone mislukt:", e.message); }
      return NextResponse.json({ success: true, data, hrv_keuze_actief: true });
    }

    // Geen HRV-keuze — normale sectie 21-flow
    checkInSessieAanpassing(user?.id, score).then((result) => {
      console.log(`[checkIn] Aanpassing voor ${user?.id}:`, result);
    }).catch((e) => {
      console.error(`[checkIn] Aanpassing mislukt voor ${user?.id}:`, e.message);
    });

    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getSessionUser();
    const { datum } = await request.json();
    if (!datum) {
      return NextResponse.json({ success: false, error: "Datum vereist" }, { status: 400 });
    }
    const result = await adviesOpvolgen(user?.id, datum);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
