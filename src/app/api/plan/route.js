import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

function planKey(userId) { return userId ? `${userId}:seizoensplan` : "seizoensplan"; }

export async function GET() {
  try {
    const user = await getSessionUser();
    const plan = await getKV().get(planKey(user?.id));
    return NextResponse.json({ success: true, data: plan || null });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getSessionUser();
    const plan = await request.json();
    await getKV().set(planKey(user?.id), plan);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser();
    await getKV().del(planKey(user?.id));
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
