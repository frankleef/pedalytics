import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsDelete } from "@/lib/intervals";
import { voerWekelijkseEvaluatieUit } from "@/lib/volumeCorrectie";
import { vulSessiesAanVoorGebruiker } from "@/lib/sessiesAanvullen";
import { vandaagISO } from "@/lib/datum";

export const maxDuration = 300;

export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId vereist" }, { status: 400 });

  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan) return NextResponse.json({ error: "Geen plan gevonden" }, { status: 404 });

  const vandaag = vandaagISO();
  const bestaande = plan.weekSessies?.sessies || [];
  const teVerwijderen = bestaande.filter(s => !s.voltooid && s.datum >= vandaag);
  const teBehouden = bestaande.filter(s => s.voltooid || s.datum < vandaag);

  // Verwijder Intervals-events voor aankomende sessies
  const creds = await getIntervalsCredentials(userId).catch(() => null);
  const verwijderdEvents = [];
  const misluktEvents = [];

  if (creds) {
    for (const sessie of teVerwijderen) {
      if (!sessie.intervalsEventId) continue;
      try {
        await intervalsDelete(`/events/${sessie.intervalsEventId}`, creds);
        verwijderdEvents.push(sessie.intervalsEventId);
      } catch (e) {
        console.warn(`[reset-en-regenereer] Event ${sessie.intervalsEventId} verwijderen mislukt:`, e.message);
        misluktEvents.push(sessie.intervalsEventId);
      }
    }
  }

  // Wis niet-voltooide sessies uit plan
  plan.weekSessies = { ...plan.weekSessies, sessies: teBehouden };
  await kv.set(planKey, plan);

  console.log(`[reset-en-regenereer] ${userId}: ${teVerwijderen.length} sessies gewist, ${verwijderdEvents.length} events verwijderd`);

  // Voer volumecorrectie + vulSessiesAan uit
  let regenereerResultaat;
  try {
    regenereerResultaat = await voerWekelijkseEvaluatieUit(userId, { forceer: true });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: `Regeneratie mislukt: ${e.message}`,
      gewist: teVerwijderen.length,
      verwijderdEvents,
      misluktEvents,
    }, { status: 500 });
  }

  // Tweede pass: vul eventuele gaten die door een mislukte Claude-call zijn ontstaan
  let aanvulResultaat = null;
  try {
    aanvulResultaat = await vulSessiesAanVoorGebruiker(userId);
  } catch (e) {
    console.warn(`[reset-en-regenereer] Aanvul-pass mislukt voor ${userId}:`, e.message);
  }

  return NextResponse.json({
    ok: true,
    gewist: teVerwijderen.length,
    verwijderdEvents,
    misluktEvents,
    regenereerResultaat,
    aanvulResultaat,
  });
}
