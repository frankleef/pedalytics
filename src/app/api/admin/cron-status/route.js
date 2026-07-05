import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getKV } from "@/lib/kv";

const NAMEN = ["morning", "sync", "sessies-aanvullen"];

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const kv = getKV();
  const waarden = await kv.mget(...NAMEN.map(n => `cronrun:${n}:laatst`));
  const data = Object.fromEntries(NAMEN.map((n, i) => [n, waarden[i] ?? null]));

  return NextResponse.json({ success: true, data });
}
