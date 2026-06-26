import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { vulSessiesAanVoorGebruiker } from "@/lib/sessiesAanvullen";

export const maxDuration = 120;

export async function POST() {
  const user = await getSessionUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const resultaat = await vulSessiesAanVoorGebruiker(user.id);
    return NextResponse.json({ ok: true, resultaat });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
