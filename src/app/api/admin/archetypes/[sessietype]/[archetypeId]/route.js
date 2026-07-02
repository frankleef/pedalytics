import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { GELDIGE_SESSIETYPES, invalideerArchetypeCache } from "@/lib/sessie-archetypes";

export async function DELETE(request, { params }) {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { sessietype, archetypeId } = await params;
    if (!GELDIGE_SESSIETYPES.has(sessietype)) {
      return NextResponse.json({ success: false, error: `Onbekend sessietype "${sessietype}"` }, { status: 400 });
    }

    const kv = getKV();
    const bestaand = (await kv.get(`archetypes:${sessietype}`)) ?? [];
    if (!bestaand.some(a => a.id === archetypeId)) {
      return NextResponse.json({ success: false, error: `Archetype "${archetypeId}" niet gevonden in sessietype "${sessietype}"` }, { status: 404 });
    }

    const overgebleven = bestaand.filter(a => a.id !== archetypeId);
    await kv.set(`archetypes:${sessietype}`, overgebleven);
    invalideerArchetypeCache(sessietype);

    return NextResponse.json({ success: true, data: overgebleven });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
