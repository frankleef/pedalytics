import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { markeerGelezen } from "@/lib/meldingen";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  await markeerGelezen(user.id, "alle");
  return NextResponse.json({ success: true });
}
