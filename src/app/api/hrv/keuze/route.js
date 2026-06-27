import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { vandaagISO } from "@/lib/datum";
import { verwerkSchrappen, verwerkVerlichten, verwerkVerplaatsen, verwerkOrigineel } from "@/lib/hrv/verwerking";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { datum, keuze, nieuweDatum } = await request.json();
  if (!datum || !keuze) return NextResponse.json({ error: "datum en keuze vereist" }, { status: 400 });

  const vandaag = vandaagISO();
  if (datum < vandaag) return NextResponse.json({ error: "Kan geen keuze maken voor een dag in het verleden" }, { status: 400 });

  const kv = getKV();
  const lockKey = `hrv-keuze-lock:${user.id}:${datum}`;
  if (await kv.get(lockKey)) return NextResponse.json({ error: "Er loopt al een verwerking" }, { status: 409 });
  await kv.set(lockKey, "1", { ex: 60 });

  try {
    const planKey = `${user.id}:seizoensplan`;
    const seizoensplan = await kv.get(planKey);
    const sessies = seizoensplan?.weekSessies?.sessies || [];
    const sessie = sessies.find(s => s.datum === datum);
    if (!sessie) return NextResponse.json({ error: "Geen sessie gevonden" }, { status: 404 });

    const dag = {
      hrv_vandaag: sessie.hrv_vandaag,
      fase: (() => {
        const weekNr = seizoensplan?.startdatum ? weeknummerVoorDatum(datum, seizoensplan.startdatum) : 1;
        return seizoensplan?.kader?.find(w => w.week === weekNr)?.fase || "basis";
      })(),
    };

    switch (keuze) {
      case "schrappen":
        await verwerkSchrappen(user.id, datum, dag, seizoensplan);
        return NextResponse.json({ ok: true, nieuweMode: "geschrapt_hrv", sessieGewijzigd: false });
      case "verlichten":
        await verwerkVerlichten(user.id, datum, dag, seizoensplan);
        return NextResponse.json({ ok: true, nieuweMode: "aangepast_hrv", sessieGewijzigd: true });
      case "verplaatsen":
        if (!nieuweDatum) return NextResponse.json({ error: "nieuweDatum vereist" }, { status: 400 });
        await verwerkVerplaatsen(user.id, datum, dag, nieuweDatum, seizoensplan);
        return NextResponse.json({ ok: true, nieuweMode: "geschrapt_hrv", sessieGewijzigd: true });
      case "origineel":
        await verwerkOrigineel(user.id, datum, dag, seizoensplan);
        return NextResponse.json({ ok: true, nieuweMode: null, sessieGewijzigd: false });
      default:
        return NextResponse.json({ error: "Ongeldige keuze" }, { status: 400 });
    }
  } finally {
    await kv.del(lockKey);
  }
}
