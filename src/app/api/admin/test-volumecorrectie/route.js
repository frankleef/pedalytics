import { NextResponse } from "next/server";
import { voerWekelijkseEvaluatieUit, haalVolumeSignalen } from "@/lib/volumeCorrectie";

export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body.secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const signalen = await haalVolumeSignalen("u_frank_001");
    const resultaat = await voerWekelijkseEvaluatieUit("u_frank_001", { forceer: true });
    return NextResponse.json({ ok: true, signalen, resultaat });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
