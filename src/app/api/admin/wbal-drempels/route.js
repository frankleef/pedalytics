// D5: admin-instelbare W'bal-drempels (depletiePct/herstelPct), zelfde patroon
// als PUT /api/admin/archetypes/[sessietype]/route.js — single-admin-auth-
// check, KV-schrijf + expliciete cache-invalidatie.
import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { haalWbalDrempels, invalideerWbalDrempelsCache, WBAL_DREMPELS_KV_KEY } from "@/lib/wbalDrempels";

function valideerDrempel(waarde, veldnaam) {
  if (typeof waarde !== "number" || Number.isNaN(waarde) || waarde <= 0 || waarde >= 100) {
    return `${veldnaam} moet een getal tussen 0 en 100 zijn`;
  }
  return null;
}

export async function GET() {
  const user = await getSessionUser();
  if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const kv = getKV();
  const drempels = await haalWbalDrempels(kv);
  return NextResponse.json({ success: true, data: drempels });
}

export async function PUT(request) {
  const user = await getSessionUser();
  if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { depletiePct, herstelPct } = body;

  const fout = valideerDrempel(depletiePct, "depletiePct") ?? valideerDrempel(herstelPct, "herstelPct");
  if (fout) {
    return NextResponse.json({ success: false, error: fout }, { status: 400 });
  }

  const kv = getKV();
  const nieuw = { depletiePct, herstelPct };
  await kv.set(WBAL_DREMPELS_KV_KEY, nieuw);
  invalideerWbalDrempelsCache();

  return NextResponse.json({ success: true, data: nieuw });
}
