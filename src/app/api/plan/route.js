import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";

const KEY = "seizoensplan";

export async function GET() {
  try {
    const plan = await getKV().get(KEY);
    return NextResponse.json({ success: true, data: plan || null });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const plan = await request.json();
    await getKV().set(KEY, plan);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await getKV().del(KEY);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
