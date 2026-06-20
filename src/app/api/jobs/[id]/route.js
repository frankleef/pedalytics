import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const job = await getKV().get(`genjob:${id}`);
    if (!job) return NextResponse.json({ success: false, error: "Job niet gevonden" }, { status: 404 });
    return NextResponse.json({ success: true, ...job });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
