import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { sendPush } from "@/lib/pushNotify";
import { vandaagISO } from "@/lib/datum";
import { verifyQStash } from "@/lib/qstash";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

export async function POST(request) {
  const geldig = await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kv = getKV();
  const userIds = (await kv.get("users:active")) || [];
  const vandaag = vandaagISO();
  const results = [];

  for (const userId of userIds) {
    try {
      // Skip als vandaag al ingevuld
      const checkin = await kv.get(`${userId}:checkin:${vandaag}`);
      if (checkin) { results.push({ userId, status: "al_ingevuld" }); continue; }

      await sendPush(userId, {
        title: "Goedemorgen! ☀️",
        body: "Hoe voel je je vandaag? Vul je ochtend-check-in in.",
        url: "/",
        tag: "morning-checkin",
      });
      results.push({ userId, status: "sent" });
    } catch (e) {
      results.push({ userId, status: "error", error: e.message });
    }
  }

  return NextResponse.json({ success: true, results });
}
