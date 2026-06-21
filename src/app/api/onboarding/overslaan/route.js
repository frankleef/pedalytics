import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });
    await getKV().set(`user:${user.id}:onboarding_overgeslagen`, true);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
