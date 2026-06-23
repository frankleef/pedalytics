import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { migratie04Doeltype } from "@/lib/migraties/migratie-04-doeltype";

export async function POST(request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const kv = getKV();
  const actieveUsers = (await kv.get("users:active")) || [];

  const details = [];
  let geslaagd = 0;
  let mislukt = 0;

  for (const userId of actieveUsers) {
    try {
      const planKey = `${userId}:seizoensplan`;
      const plan = await kv.get(planKey);

      if (!plan) {
        details.push({ userId, status: "overgeslagen", reden: "geen plan" });
        continue;
      }

      const gemigreerd = migratie04Doeltype(plan);
      await kv.set(planKey, gemigreerd);
      geslaagd++;
      details.push({ userId, status: "geslaagd", seizoensdoel: gemigreerd.seizoensdoel });
    } catch (e) {
      mislukt++;
      details.push({ userId, status: "mislukt", fout: e.message });
    }
  }

  return NextResponse.json({ geslaagd, mislukt, totaal: actieveUsers.length, details });
}
