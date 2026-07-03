import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsPost, intervalsDelete } from "@/lib/intervals";
import { DAGNAMEN } from "@/lib/datum";
import { getArchetypesVoorSessietypeRaw, TEST_SESSIETYPES } from "@/lib/sessie-archetypes";
import { genereerSessieDeterministisch } from "@/lib/sessie-generatie";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";
import { capSessieDuur } from "@/lib/sessie/duurCap";
import { bouwRampTestSessie } from "@/lib/sessiesAanvullen";
import { sessieNaarZwo } from "@/lib/workoutZwo";

// z2_duur is de enige "rustige" categorie uit GELDIGE_SESSIETYPES — de rest
// (sweetspot/drempel/vo2max/sprint/kracht/z6/gemengd) is een intensiteitsdag.
// Zelfde tweedeling als TOEGESTANE_ZONES_PER_SESSIETYPE (weekSolver.js) impliciet
// al hanteert, hier alleen gebruikt om een zinnige DagRol te zetten bij een
// handmatige override (spec: "overschrijft rol, sessietype").
const AEROBE_SESSIETYPES = new Set(["z2_duur"]);
function bepaalRolVoorHandmatigeKeuze(sessietype) {
  return AEROBE_SESSIETYPES.has(sessietype) ? "aerobe_dag" : "intensiteitsdag";
}

/**
 * Sectie 51-D, chunk 2, stap 3: overschrijft de dag-intentie en genereert de
 * inhoud direct (geen job/Claude-omweg nodig — genereerSessieDeterministisch en
 * genereerRampTestSessie zijn beide pure, synchrone functies).
 */
export async function PUT(request) {
  try {
    const user = await getSessionUser();
    if (!user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { datum, sessietype, archetype_id, variant_id } = body;
    if (!datum || !sessietype) {
      return NextResponse.json({ success: false, error: "datum en sessietype vereist" }, { status: 400 });
    }

    const kv = getKV();
    const planKey = `${user.id}:seizoensplan`;
    const plan = await kv.get(planKey);
    if (!plan) return NextResponse.json({ success: false, error: "Geen actief plan" }, { status: 404 });

    const dagNaam = DAGNAMEN[new Date(datum).getDay()];
    const uren = plan.urenPerDag?.[dagNaam] || 1.5;

    let nieuweSessie;
    if (TEST_SESSIETYPES.has(sessietype)) {
      if (sessietype !== "ramp_test") {
        return NextResponse.json({ success: false, error: `Sessietype "${sessietype}" heeft nog geen generator` }, { status: 400 });
      }
      nieuweSessie = bouwRampTestSessie(datum, dagNaam);
    } else {
      if (!archetype_id || !variant_id) {
        return NextResponse.json({ success: false, error: "archetype_id en variant_id vereist voor dit sessietype" }, { status: 400 });
      }
      const archetypes = await getArchetypesVoorSessietypeRaw(sessietype, kv);
      const archetype = archetypes.find(a => a.id === archetype_id);
      if (!archetype) {
        return NextResponse.json({ success: false, error: `Archetype "${archetype_id}" niet gevonden voor sessietype "${sessietype}"` }, { status: 400 });
      }
      const variant = archetype.varianten?.find(v => v.id === variant_id);
      if (!variant) {
        return NextResponse.json({ success: false, error: `Variant "${variant_id}" niet gevonden voor archetype "${archetype_id}"` }, { status: 400 });
      }

      const ftp = plan.huidige_ftp || 265;
      nieuweSessie = genereerSessieDeterministisch({
        dagIntentie: { rol: bepaalRolVoorHandmatigeKeuze(sessietype) },
        archetype, variant,
        doelDuurMin: Math.round(uren * 60),
        ftp, sessietype,
      });
      nieuweSessie.datum = datum;
      nieuweSessie.dag = dagNaam;
      nieuweSessie.gegenereerd_door = "handmatige_keuze";

      normaliseerSessieSegmenten(nieuweSessie);
      voegVerwachtRpeToe(nieuweSessie);
      corrigeerSessieTss(nieuweSessie);
      if (uren) capSessieDuur(nieuweSessie, Math.round(uren * 60), "PUT /api/sessie/kies", user.id);
    }

    // Bestaand intervals.icu-event voor deze dag opruimen vóórdat het nieuwe
    // event wordt aangemaakt — voorkomt duplicaten (zelfde patroon als
    // /api/admin/regenereer-toekomstige-sessies).
    const bestaandeSessies = plan.weekSessies?.sessies || [];
    const oudeSessie = bestaandeSessies.find(s => s.datum === datum);

    let creds = null;
    try {
      creds = await getIntervalsCredentials(user.id);
    } catch { /* niet gekoppeld — sla intervals.icu-sync over, sessie blijft wel lokaal opgeslagen */ }

    if (creds) {
      try {
        if (oudeSessie?.intervalsEventId) {
          await intervalsDelete(`/events/${oudeSessie.intervalsEventId}`, creds);
        }
        const zwo = sessieNaarZwo(nieuweSessie, plan.huidige_ftp || 265);
        const eventBody = {
          category: "WORKOUT",
          start_date_local: `${datum}T08:00:00`,
          name: nieuweSessie.titel || nieuweSessie.type,
          type: "Ride",
          moving_time: (nieuweSessie.duur_min || 90) * 60,
          ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
        };
        const result = await intervalsPost("/events", eventBody, creds);
        if (result.id) {
          nieuweSessie.intervalsEventId = result.id;
          if (result.icu_training_load) {
            nieuweSessie.tss = result.icu_training_load;
            nieuweSessie.tss_bron = "intervals_icu";
          }
        }
      } catch (e) {
        console.warn(`[sessie/kies] Intervals-sync mislukt voor ${datum}:`, e.message);
      }
    }

    // Verse plan-kopie vóór het schrijven (zelfde lost-update-preventie als
    // bijwerkPlanVeilig in cron/sync/route.js).
    const versPlan = await kv.get(planKey);
    if (!versPlan) return NextResponse.json({ success: false, error: "Plan verdween tijdens verwerking" }, { status: 409 });
    const versSessies = versPlan.weekSessies?.sessies || [];
    versPlan.weekSessies = {
      ...versPlan.weekSessies,
      sessies: [...versSessies.filter(s => s.datum !== datum), nieuweSessie],
    };
    await kv.set(planKey, versPlan);

    return NextResponse.json({ success: true, data: nieuweSessie });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
