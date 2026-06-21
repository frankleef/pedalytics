import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });

    const subscription = await request.json();
    if (!subscription?.endpoint) return NextResponse.json({ success: false, error: "Ongeldig abonnement" }, { status: 400 });

    await getKV().set(`push-sub:${user.id}`, subscription);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });
    await getKV().del(`push-sub:${user.id}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
