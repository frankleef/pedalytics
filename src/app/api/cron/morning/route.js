import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { getKV } from "@/lib/kv";
import { sendPush } from "@/lib/pushNotify";
import { vandaagISO } from "@/lib/datum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

async function verifyQStash(request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey) return true;

  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  try {
    const body = await request.clone().text();
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    await receiver.verify({ signature, body });
    return true;
  } catch {
    return false;
  }
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
