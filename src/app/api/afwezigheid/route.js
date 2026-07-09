import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { haalAfwezigheidsperiodes, maakAfwezigheidsperiode, verwijderSessiesInPeriode } from "@/lib/afwezigheid";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const periodes = await haalAfwezigheidsperiodes(user.id);
  return NextResponse.json({ success: true, data: periodes });
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { startDatum, eindDatum, reden, notitie } = body;

  const resultaat = await maakAfwezigheidsperiode(user.id, { startDatum, eindDatum, reden, notitie });
  if (resultaat.error) return NextResponse.json(resultaat, { status: 400 });

  // Synchroon, direct bij aanmaken — niet uitgesteld tot een cron-run, zodat
  // het schema meteen klopt zodra de gebruiker de periode heeft opgeslagen.
  const { verwijderd } = await verwijderSessiesInPeriode(user.id, resultaat.periode);

  return NextResponse.json({ success: true, data: resultaat.periode, sessiesVerwijderd: verwijderd });
}
