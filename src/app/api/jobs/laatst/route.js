import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";

export async function POST(request) {
  try {
    const { type, datum } = await request.json();
    const kv = getKV();
    const key = `laatstejob:${type}:${datum || "all"}`;
    const jobId = await kv.get(key);
    if (!jobId) return NextResponse.json({ status: "not_found" });
    const job = await kv.get(`genjob:${jobId}`);
    if (!job) return NextResponse.json({ status: "not_found" });
    return NextResponse.json({ success: true, ...job });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
