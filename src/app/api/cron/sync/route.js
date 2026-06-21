import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { getKV } from "@/lib/kv";
import { intervalsGet } from "@/lib/intervals";
import { decrypt } from "@/lib/crypto";
import { datumOffset } from "@/lib/datum";
import { sendPush } from "@/lib/pushNotify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

async function verifyQStash(request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  // In dev of als keys niet geconfigureerd: laat door
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
  const results = [];

  try {
    const userIds = (await kv.get("users:active")) || [];

    for (const userId of userIds) {
      try {
        const [encKey, athleteId] = await kv.mget(`user:${userId}:intervals_key`, `user:${userId}:athlete_id`);
        if (!encKey || !athleteId) continue;

        const apiKey = decrypt(encKey);
        const lastActivity = await kv.get(`user:${userId}:last_activity`);
        const oldest = lastActivity?.datum_iso || datumOffset(-3);

        const activities = await intervalsGet("/activities", {
          oldest,
          newest: datumOffset(0),
          limit: "10",
          fields: "id,start_date_local,type,icu_training_load",
        }, { apiKey, athleteId });

        const ritten = (activities || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");

        if (ritten.length === 0) {
          results.push({ userId, status: "no_new" });
          continue;
        }

        const nieuwste = ritten[ritten.length - 1];

        // Idempotent: skip als we deze al kennen
        if (lastActivity?.id === nieuwste.id) {
          results.push({ userId, status: "up_to_date" });
          continue;
        }

        await kv.set(`user:${userId}:last_activity`, {
          id: nieuwste.id,
          datum_iso: nieuwste.start_date_local?.split("T")[0],
          checkedAt: new Date().toISOString(),
        });

        // Push-notificatie bij nieuwe rit
        await sendPush(userId, {
          title: "Nieuwe rit gedetecteerd",
          body: `Je rit van ${nieuwste.start_date_local?.split("T")[0]} is verwerkt`,
          url: "/",
        });

        results.push({ userId, status: "new_activity", id: nieuwste.id });
      } catch (e) {
        results.push({ userId, status: "error", error: e.message });
      }
    }

    return NextResponse.json({ success: true, results, checkedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
