import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { verifyQStash } from "@/lib/qstash";
import { vulSessiesAanVoorGebruiker } from "@/lib/sessiesAanvullen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

export async function POST(request) {
  const geldig = await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kv = getKV();
  const userIds = (await kv.get("users:active")) || [];
  const results = [];

  for (const userId of userIds) {
    try {
      const result = await vulSessiesAanVoorGebruiker(userId);
      results.push({ userId, ...result });
    } catch (e) {
      results.push({ userId, status: "error", error: e.message });
    }
  }

  return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() });
}
