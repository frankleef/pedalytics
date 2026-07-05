import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logEvent } from "@/lib/posthog";

// Tijdelijke validatieroute voor chunk 1 van de observabiliteitslaag (sectie 44).
// Verstuurt één test-event en bevestigt dat de verzending niet crasht — de
// daadwerkelijke aankomst wordt handmatig gecontroleerd in PostHog's Live events.
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.id !== process.env.ADMIN_USER_ID) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await logEvent("posthog_test_event", user.id, { bron: "api/debug/posthog-test" });

  return NextResponse.json({ success: true, message: "Test-event verstuurd, controleer PostHog Live events" });
}
