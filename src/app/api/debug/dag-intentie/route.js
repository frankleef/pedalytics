import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getKV } from "@/lib/kv";
import { getRecenteArchetypes } from "@/lib/sessie-archetypes";

function planKey(userId) { return userId ? `${userId}:seizoensplan` : "seizoensplan"; }

export async function GET(request) {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const datum = new URL(request.url).searchParams.get("datum");
    if (!datum) return NextResponse.json({ error: "Query-param 'datum' (YYYY-MM-DD) is verplicht." }, { status: 400 });

    const kv = getKV();
    const plan = await kv.get(planKey(user.id));
    const sessie = (plan?.weekSessies?.sessies || []).find(s => s.datum === datum);

    if (!sessie) {
      return NextResponse.json({
        error: `Geen sessie gevonden voor ${datum}. Dit geldt zowel voor rustdagen als voor datums die nog niet gegenereerd zijn — er bestaat geen dag-intentie los van de generatie zelf, dus voor nog niet gegenereerde toekomstige dagen is hier niets op te vragen.`,
      }, { status: 404 });
    }

    const intentie = sessie.intentie || {};
    // gepland_sessietype ontbreekt op sessies die vóór deze route zijn gegenereerd
    // (val terug op sessietype — dan is een eventuele afwijking niet meer zichtbaar).
    const geplandSessietype = intentie.gepland_sessietype ?? intentie.sessietype ?? null;
    const werkelijkSessietype = intentie.sessietype ?? sessie.type ?? null;

    const dagIntentie = {
      rol: intentie.rol ?? null,
      sessietype: geplandSessietype,
      toegestane_zones: intentie.toegestane_zones ?? null,
      tss_range: intentie.tss_range ?? null,
      toelichting: intentie.toelichting ?? null,
    };

    const gegenereerdeSessie = {
      sessietype: werkelijkSessietype,
      archetype_id: sessie.archetype_id ?? null,
      duur_min: sessie.duur_min ?? null,
      tss: sessie.tss ?? null,
      aanleiding: sessie.volumecorrectie?.aanleiding ?? null,
    };

    const recenteArchetypes = werkelijkSessietype
      ? await getRecenteArchetypes(kv, user.id, werkelijkSessietype)
      : [];

    return NextResponse.json({
      datum,
      dag_intentie: dagIntentie,
      gegenereerde_sessie: gegenereerdeSessie,
      sessietype_afwijking: geplandSessietype !== null && geplandSessietype !== werkelijkSessietype,
      gepland_sessietype_beschikbaar: intentie.gepland_sessietype !== undefined,
      recente_archetypes_op_moment_van_opvragen: recenteArchetypes,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
