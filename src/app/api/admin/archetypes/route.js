import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getArchetypesVoorSessietypeRaw, GELDIGE_SESSIETYPES } from "@/lib/sessie-archetypes";

// Beheeroverzicht — alle archetypes per sessietype, ONGEFILTERD op fase (dat is
// de sessiegeneratie-context, niet relevant voor het admin-overzicht).
export async function GET() {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const paren = await Promise.all(
      [...GELDIGE_SESSIETYPES].map(async (t) => [t, await getArchetypesVoorSessietypeRaw(t)])
    );
    return NextResponse.json({ success: true, data: Object.fromEntries(paren) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
