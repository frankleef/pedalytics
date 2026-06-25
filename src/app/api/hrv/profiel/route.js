import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const kv = getKV();
  const raw = await kv.get(`hrv-profiel:${user.id}`);
  const profiel = typeof raw === "string" ? JSON.parse(raw) : raw;

  return NextResponse.json({ success: true, data: profiel || null });
}
