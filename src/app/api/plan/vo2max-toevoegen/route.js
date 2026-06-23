import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getSessionUser();
    const userId = user?.id;
    const kv = getKV();

    const status = await kv.get(`vo2max_suggestie_status:${userId}`);
    if (status !== "getoond") {
      return NextResponse.json({ success: false, error: "Suggestie niet beschikbaar" }, { status: 400 });
    }

    const nu = new Date().toISOString();
    await kv.set(`plan-overrides:${userId}`, { vo2max_toegestaan: true, vo2max_toegevoegd_op: nu });
    await kv.set(`vo2max_suggestie_status:${userId}`, "geaccepteerd");

    return NextResponse.json({ success: true, toegevoegd_op: nu });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
