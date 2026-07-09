import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sluitOpenPeriode } from "@/lib/afwezigheid";

export async function POST(request, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { periodeId } = await params;
  if (!periodeId) return NextResponse.json({ error: "periodeId vereist" }, { status: 400 });

  const resultaat = await sluitOpenPeriode(user.id, periodeId);
  if (resultaat.error) return NextResponse.json(resultaat, { status: 400 });

  return NextResponse.json({ success: true, data: resultaat.periode });
}
