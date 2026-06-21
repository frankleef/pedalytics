import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { setIntervalsKey } from "@/lib/users";

export async function POST(request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: "Niet ingelogd" }, { status: 401 });

    const { apiKey } = await request.json();
    if (!apiKey) return NextResponse.json({ success: false, error: "API-key is verplicht" }, { status: 400 });

    const result = await setIntervalsKey(user.id, apiKey);
    return NextResponse.json({ success: true, athleteId: result.athleteId, naam: result.naam });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
