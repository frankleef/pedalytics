import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAlleArchetypesRaw } from "@/lib/sessie-archetypes";

// Alle archetypes (metadata + varianten/blokken), globale content — voor elke
// ingelogde gebruiker leesbaar (geen admin-only route, in tegenstelling tot
// /api/admin/archetypes). De client haalt dit één keer op bij het laden van de
// app en geeft het als parameter door aan de pure archetype-functies
// (bepaalNieuweIntentie, degradeerSessie, solveWeek) — die blijven zo synchroon
// en client-side aanroepbaar zonder zelf KV te lezen.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await getAlleArchetypesRaw();
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
