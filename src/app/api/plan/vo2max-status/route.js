import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    const kv = getKV();
    const status = await kv.get(`vo2max_suggestie_status:${user?.id}`) || "geen";
    const details = await kv.get(`vo2max_suggestie_details:${user?.id}`);
    const overrides = await kv.get(`plan-overrides:${user?.id}`);
    return NextResponse.json({
      success: true,
      status,
      details: overrides ? { ...details, vo2max_toegevoegd_op: overrides.vo2max_toegevoegd_op } : details,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
