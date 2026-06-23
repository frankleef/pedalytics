import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getSessionUser();
    await getKV().set(`vo2max_suggestie_status:${user?.id}`, "afgewezen");
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
