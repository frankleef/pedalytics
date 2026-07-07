import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { markeerGelezen } from "@/lib/meldingen";

export async function POST(request, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id vereist" }, { status: 400 });

  await markeerGelezen(user.id, id);
  return NextResponse.json({ success: true });
}
