import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getKV } from "@/lib/kv";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const kv = getKV();
  const userIds = (await kv.get("users:active")) || [];

  const sporters = await Promise.all(userIds.map(async (id) => {
    const [athleteNaam, userObj] = await kv.mget(`user:${id}:athlete_naam`, `user:${id}`);
    const label = athleteNaam || userObj?.naam || userObj?.email || id;
    return { id, label };
  }));

  return NextResponse.json({ success: true, data: sporters });
}
