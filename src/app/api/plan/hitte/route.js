import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";

export async function GET(request) {
  try {
    await getSessionUser();
    const ritId = new URL(request.url).searchParams.get("ritId");
    if (!ritId) return NextResponse.json({ success: false, error: "ritId vereist" }, { status: 400 });
    const data = await getKV().get(`decoupling:${ritId}`);
    if (!data || typeof data !== "object") return NextResponse.json({ success: true, data: null });
    return NextResponse.json({
      success: true,
      data: {
        apparent_temp_celsius: data.apparent_temp_celsius ?? data.temperatuur_celsius ?? null,
        temp_baseline: data.temp_baseline ?? null,
        hitte_gecorrigeerd: data.hitte_gecorrigeerd ?? false,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
