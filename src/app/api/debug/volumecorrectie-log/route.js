import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getKV } from "@/lib/kv";
import { haalIsoWeeknummer } from "@/lib/volumeCorrectie";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const kv = getKV();
    const userId = user.id;

    // Weeknummers: huidige week en 12 weken terug (max 1 jaar)
    const nuWeek = haalIsoWeeknummer(new Date());
    const weekLogs = [];
    for (let i = 0; i < 13; i++) {
      let w = nuWeek - i;
      if (w <= 0) w += 52;
      const log = await kv.get(`volumecorrectie_log:${userId}:${w}`);
      if (log) weekLogs.push(log);
    }

    // Blok-logs: max 10 blokken
    const blokLogs = [];
    for (let b = 0; b < 10; b++) {
      const log = await kv.get(`blokcheck_log:${userId}:${b}`);
      if (log) blokLogs.push(log);
    }

    weekLogs.sort((a, b) => (b.weeknummer || 0) - (a.weeknummer || 0));
    blokLogs.sort((a, b) => (b.blokIndex || 0) - (a.blokIndex || 0));

    return NextResponse.json({ weekLogs, blokLogs });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
