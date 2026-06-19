import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { randomUUID } from "crypto";

const TTL_SECONDS = 30 * 24 * 60 * 60;

export async function POST(request) {
  try {
    const { password } = await request.json();
    const appPassword = process.env.APP_PASSWORD;

    if (!appPassword) {
      return NextResponse.json({ success: false, error: "APP_PASSWORD niet geconfigureerd" }, { status: 500 });
    }

    if (password !== appPassword) {
      return NextResponse.json({ success: false, error: "Onjuist wachtwoord" }, { status: 401 });
    }

    const sessionId = randomUUID();
    await getKV().set(`session:${sessionId}`, true, { ex: TTL_SECONDS });

    const response = NextResponse.json({ success: true });
    response.cookies.set("session_id", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: TTL_SECONDS,
    });

    return response;
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
