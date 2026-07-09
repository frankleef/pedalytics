import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { telSessiesInPeriode } from "@/lib/afwezigheid";

// Zij-effect-vrije telling voor de live-preview-regel in het invoerscherm —
// vóór de periode daadwerkelijk is aangemaakt (POST /api/afwezigheid zelf
// verwijdert synchroon, kent geen dry-run-modus).
export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { startDatum, eindDatum } = body;
  if (!startDatum) return NextResponse.json({ error: "startDatum vereist" }, { status: 400 });

  const aantal = await telSessiesInPeriode(user.id, startDatum, eindDatum ?? null);
  return NextResponse.json({ success: true, data: { aantal } });
}
