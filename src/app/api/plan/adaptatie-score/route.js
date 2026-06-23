import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    const kv = getKV();
    const data = await kv.get(`adaptatie_score:${user?.id}`);
    const hitteMelding = await kv.get(`adaptatie-hitte-melding:${user?.id}`);
    return NextResponse.json({ success: true, data: data || null, hitteMelding: hitteMelding === true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
