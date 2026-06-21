import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });
    const toestemming = await getKV().get(`user:${user.id}:toestemming_gezondheid`);
    return NextResponse.json({ success: true, heeftToestemming: !!toestemming, data: toestemming });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });
    const { akkoord, versie } = await request.json();
    if (!akkoord) return NextResponse.json({ success: false, error: "Toestemming niet gegeven" }, { status: 400 });

    const record = {
      akkoord: true,
      versie: versie || "1.0-concept",
      timestamp: new Date().toISOString(),
      userId: user.id,
    };
    const kv = getKV();
    await kv.set(`user:${user.id}:toestemming_gezondheid`, record);
    await kv.set(`user:${user.id}:onboarding`, {
      stap: "intervals_key",
      laatstBijgewerkt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });
    await getKV().del(`user:${user.id}:toestemming_gezondheid`);
    await getKV().del(`user:${user.id}:intervals_key`);
    await getKV().del(`user:${user.id}:athlete_id`);
    await getKV().del(`user:${user.id}:athlete_naam`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
