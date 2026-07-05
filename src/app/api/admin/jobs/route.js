import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getKV } from "@/lib/kv";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Math.min(parseInt(new URL(request.url).searchParams.get("limit") || "50", 10) || 50, 200);
  const kv = getKV();
  const jobIds = await kv.lrange("genjob:index", 0, limit - 1);
  if (jobIds.length === 0) return NextResponse.json({ success: true, data: [] });

  const jobs = await kv.mget(...jobIds.map(id => `genjob:${id}`));
  // genjob:{id} heeft een TTL van 5 min, de index niet — oudere ids die al
  // verlopen zijn worden overgeslagen i.p.v. als lege rij getoond.
  const data = jobIds
    .map((jobId, i) => (jobs[i] ? { jobId, ...jobs[i] } : null))
    .filter(Boolean);

  return NextResponse.json({ success: true, data });
}
