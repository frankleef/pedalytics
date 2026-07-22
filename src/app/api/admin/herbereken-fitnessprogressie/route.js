import { NextResponse } from "next/server";
import { berekenEnSlaFitnessprogressieOp } from "@/lib/fitnessprogressieIO";

// Bearer ADMIN_SECRET, geen sessiegebonden user.id-check (die zit één laag
// hoger, in de /api/admin/trigger-proxy die dit secret injecteert). Roept uitsluitend
// berekenEnSlaFitnessprogressieOp() aan — in tegenstelling tot
// /api/volumecorrectie/hereval (voerWekelijkseEvaluatieUit met forceer:true)
// heeft dit geen neveneffecten op plan.kader of weekSessies.
export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = body.userId || "u_frank_001";

  try {
    const resultaat = await berekenEnSlaFitnessprogressieOp(userId);
    return NextResponse.json({ success: true, userId, ...resultaat });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
