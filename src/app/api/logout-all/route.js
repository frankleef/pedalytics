import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (password !== process.env.APP_PASSWORD) {
      return NextResponse.json({ success: false, error: "Onjuist wachtwoord" }, { status: 401 });
    }

    const kv = getKV();
    let cursor = 0;
    let deleted = 0;
    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: "session:*", count: 100 });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await Promise.all(keys.map(k => kv.del(k)));
        deleted += keys.length;
      }
    } while (cursor !== 0);

    const response = NextResponse.json({ success: true, deleted });
    response.cookies.delete("session_id");
    return response;
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
