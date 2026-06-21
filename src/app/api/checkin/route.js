import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { vandaagISO } from "@/lib/datum";
import { getSessionUser } from "@/lib/auth";

function checkinKey(userId) {
  const prefix = userId ? `${userId}:` : "";
  return `${prefix}checkin:${vandaagISO()}`;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    const data = await getKV().get(checkinKey(user?.id));
    return NextResponse.json({ success: true, data: data || null });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getSessionUser();
    const { score } = await request.json();
    if (!score || score < 1 || score > 5) {
      return NextResponse.json({ success: false, error: "Score moet 1-5 zijn" }, { status: 400 });
    }
    const data = { score, timestamp: new Date().toISOString() };
    await getKV().set(checkinKey(user?.id), data, { ex: 86400 * 2 });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
