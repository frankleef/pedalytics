import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { maakMelding } from "@/lib/meldingen";
import { DAGNAMEN } from "@/lib/datum";

// Dun rapportage-endpoint voor het al bestaande, client-side conflict-vangnet
// (AppClient.js hersolveWeekConflicten — 48u-conflict/budget-conflict na een
// wijziging in beschikbaarheid). Bouwt geen nieuwe beslislogica: de client
// heeft het conflict al gedetecteerd en opgelost vóórdat dit aangeroepen
// wordt, dit endpoint legt alleen de al genomen beslissing vast als melding.
export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { datum, actie } = await request.json().catch(() => ({}));
  if (!datum || !actie) return NextResponse.json({ error: "datum en actie vereist" }, { status: 400 });

  const dagLabel = DAGNAMEN[new Date(datum).getDay()] || "Je sessie";
  const tekst = actie === "gekort"
    ? `${dagLabel} is ingekort zodat de belasting in balans blijft.`
    : `${dagLabel} is aangepast naar een lichtere variant zodat de belasting in balans blijft.`;

  const melding = await maakMelding(user.id, "overbelastingsgate_nieuwe_dag", { datum, dagLabel, tekst });
  return NextResponse.json({ success: true, melding });
}
