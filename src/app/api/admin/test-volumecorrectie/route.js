import { NextResponse } from "next/server";
import { vulSessiesAanVoorGebruiker } from "@/lib/sessiesAanvullen";

export const maxDuration = 120;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body.secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const resultaat = await vulSessiesAanVoorGebruiker("u_frank_001");
    return NextResponse.json({ ok: true, resultaat });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
