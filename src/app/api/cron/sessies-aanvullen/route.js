import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { verifyQStash } from "@/lib/qstash";
import { vulSessiesAanVoorGebruiker } from "@/lib/sessiesAanvullen";
import { logCronRun } from "@/lib/cronLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

export async function POST(request) {
  const geldig = request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}` || await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = Date.now();
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

  await logCronRun("sessies-aanvullen", { startedAt, results }).catch(e => console.warn("[sessies-aanvullen] cronrun-log mislukt:", e.message));

  return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() });
}
