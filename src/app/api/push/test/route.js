import { NextResponse } from "next/server";
import { sendPush } from "@/lib/pushNotify";
import { getUserIntervalsConfig } from "@/lib/auth";

export async function POST(request) {
  if (process.env.NODE_ENV === "production") {
    try { await getUserIntervalsConfig(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  }

  const { userId = "u_frank_001", title, body, url } = await request.json().catch(() => ({}));

  const ok = await sendPush(userId, {
    title: title || "Goedemorgen! ☀️",
    body: body || "Hoe voel je je vandaag? Vul je ochtend-check-in in.",
    url: url || "/",
    tag: "test",
  });

  return NextResponse.json({ success: ok, note: ok ? "Verstuurd!" : "Geen push-subscriptie gevonden voor deze user" });
}
