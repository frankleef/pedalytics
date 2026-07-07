import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { haalMeldingen } from "@/lib/meldingen";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const categorie = searchParams.get("categorie") || undefined;
  const ongelezenAlleen = searchParams.get("ongelezen") === "1" || searchParams.get("ongelezen") === "true";

  const meldingen = await haalMeldingen(user.id, { categorie, ongelezenAlleen });
  return NextResponse.json({ success: true, data: meldingen });
}
