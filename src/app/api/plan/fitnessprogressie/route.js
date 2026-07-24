import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { bepaalFitnessDataGereed } from "@/lib/fitnessprogressie";
import { haalDecouplingReeks } from "@/lib/decoupling";

export async function GET() {
  try {
    const user = await getSessionUser();
    const kv = getKV();
    const data = await kv.get(`fitnessprogressie:${user?.id}`);
    const fitnessDataGereed = bepaalFitnessDataGereed({ ctlTrend: data?.ctl_trend, decouplingTrend: data?.decoupling_trend });
    const decouplingReeks = await haalDecouplingReeks(user?.id);
    return NextResponse.json({ success: true, data: data || null, fitnessDataGereed, decouplingReeks });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
