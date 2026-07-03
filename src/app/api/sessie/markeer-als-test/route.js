import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { DAGNAMEN } from "@/lib/datum";
import { TEST_SESSIETYPES } from "@/lib/sessie-archetypes";
import { genereerRampTestSessie } from "@/lib/sessie/rampTest";
import { verwerkFtpTest } from "@/lib/sessie/ftpUpdate";

export const dynamic = "force-dynamic";

const TEST_GENERATOREN = {
  ramp_test: genereerRampTestSessie,
};

/**
 * "Markeer als FTP-test": labelt een al gereden, niet (vooraf) geplande rit
 * (mode "unplanned" — wél een activiteit, geen sessie) retroactief als test.
 *
 * Losstaand van PUT /api/sessie/kies: die plant een TOEKOMSTIGE sessie (post
 * een ZWO-event naar intervals.icu). Hier is de rit al gebeurd — geen event
 * nodig, de sessie wordt direct als voltooid opgeslagen met de echte duur/TSS
 * van de activiteit.
 *
 * `verwerkFtp` (default true) bepaalt of verwerkFtpTest() ook aangeroepen
 * wordt (FTP-update + herberekening toekomstige vermogensbereiken). Uitzetten
 * is bedoeld voor het geval de FTP al op een andere manier verwerkt is (bv.
 * handmatig aangepast) en hier alleen de labeling/geschiedenis hersteld moet
 * worden, zonder dat nogmaals te overschrijven.
 */
export async function PUT(request) {
  try {
    const user = await getSessionUser();
    if (!user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { datum, activiteitId, sessietype = "ramp_test", verwerkFtp = true } = body;
    if (!datum || !activiteitId) {
      return NextResponse.json({ success: false, error: "datum en activiteitId vereist" }, { status: 400 });
    }
    if (!TEST_SESSIETYPES.has(sessietype) || !TEST_GENERATOREN[sessietype]) {
      return NextResponse.json({ success: false, error: `Sessietype "${sessietype}" heeft nog geen generator` }, { status: 400 });
    }

    const kv = getKV();
    const planKey = `${user.id}:seizoensplan`;
    const plan = await kv.get(planKey);
    if (!plan) return NextResponse.json({ success: false, error: "Geen actief plan" }, { status: 404 });

    const creds = await getIntervalsCredentials(user.id);
    if (!creds) return NextResponse.json({ success: false, error: "Niet gekoppeld aan intervals.icu" }, { status: 400 });

    const activiteit = await intervalsGet(`/activities/${activiteitId}`, {}, creds);
    if (!activiteit) return NextResponse.json({ success: false, error: "Activiteit niet gevonden" }, { status: 404 });

    const test = TEST_GENERATOREN[sessietype]();
    const dagNaam = DAGNAMEN[new Date(datum).getDay()];
    const nieuweSessie = {
      ...test,
      type: sessietype,
      titel: activiteit.name || "FTP-test",
      datum,
      dag: dagNaam,
      duur_min: activiteit.moving_time ? Math.round(activiteit.moving_time / 60) : test.duur_min_geschat,
      tss: activiteit.icu_training_load ?? null,
      ...(activiteit.icu_training_load != null ? { tss_bron: "intervals_icu" } : {}),
      intentie: { rol: "ftp_test", sessietype, tss_doel: null },
      voltooid: true,
      intervalsActiviteitId: activiteitId,
    };

    // Vóór de eigen plan-schrijfactie: verwerkFtpTest() doet zelf een read-
    // modify-write op hetzelfde plan. Door hierna een verse kopie te lezen
    // (zie onder) worden beide wijzigingen correct gelaagd i.p.v. dat de een
    // de ander overschrijft.
    let ftpUpdate = null;
    if (verwerkFtp) {
      ftpUpdate = await verwerkFtpTest(user.id, activiteit);
    }

    const versPlan = await kv.get(planKey);
    if (!versPlan) return NextResponse.json({ success: false, error: "Plan verdween tijdens verwerking" }, { status: 409 });
    const versSessies = versPlan.weekSessies?.sessies || [];
    versPlan.weekSessies = {
      ...versPlan.weekSessies,
      sessies: [...versSessies.filter(s => s.datum !== datum), nieuweSessie],
    };
    await kv.set(planKey, versPlan);

    return NextResponse.json({ success: true, data: nieuweSessie, ftpUpdate });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
