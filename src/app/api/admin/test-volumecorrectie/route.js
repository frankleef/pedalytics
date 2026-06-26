import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { voerWekelijkseEvaluatieUit, haalVolumeSignalen } from "@/lib/volumeCorrectie";

export async function POST() {
  const user = await getSessionUser();
  if (user?.id !== "u_frank_001") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Haal signalen op voor diagnostiek vóór uitvoering
    const signalen = await haalVolumeSignalen(user.id);

    const resultaat = await voerWekelijkseEvaluatieUit(user.id, { forceer: true });

    return NextResponse.json({ ok: true, signalen, resultaat });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
