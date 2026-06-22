import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet, intervalsPost } from "@/lib/intervals";
import { vandaagISO, datumISO } from "@/lib/datum";
import { bouwSessieDagPrompt } from "@/lib/promptBuilder";
import { segmentenNaarZwo } from "@/lib/workoutZwo";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const DAGNAMEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

async function verifyQStash(request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentSigningKey) return true;
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;
  try {
    const body = await request.clone().text();
    const receiver = new Receiver({ currentSigningKey, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY });
    await receiver.verify({ signature, body });
    return true;
  } catch { return false; }
}

async function claudeCall({ prompt, system, max_tokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY niet geconfigureerd");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens, system, messages: [{ role: "user", content: prompt }] }),
  });

  if (!resp.ok) throw new Error(`Claude API ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const cleaned = text.replace(/```json|```/g, "").trim();
  if (!cleaned) throw new Error("Lege response");
  if (data.stop_reason === "max_tokens") throw new Error("Response afgekapt");
  return JSON.parse(cleaned);
}

export async function POST(request) {
  const geldig = await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kv = getKV();
  const userIds = (await kv.get("users:active")) || [];
  const results = [];

  for (const userId of userIds) {
    try {
      const planKey = `${userId}:seizoensplan`;
      const plan = await kv.get(planKey);
      if (!plan?.kader || !plan.beschikbaarheid) {
        results.push({ userId, status: "geen_plan" });
        continue;
      }

      const creds = await getIntervalsCredentials(userId);
      if (!creds) { results.push({ userId, status: "geen_credentials" }); continue; }

      const vandaag = vandaagISO();
      const beschikbareDagen = Object.entries(plan.beschikbaarheid).filter(([, v]) => v).map(([k]) => k);
      const urenPerDag = plan.urenPerDag || {};
      const bestaandeSessies = plan.weekSessies?.sessies || [];
      const bestaandeDatums = new Set(bestaandeSessies.map(s => s.datum));

      // Vind beschikbare dagen in komende 10 dagen zonder sessie
      const ontbrekend = [];
      const nu = new Date();
      for (let i = 1; i <= 10; i++) {
        const d = new Date(nu);
        d.setDate(nu.getDate() + i);
        const iso = datumISO(d);
        const dagNaam = DAGNAMEN[d.getDay()];
        if (beschikbareDagen.includes(dagNaam) && !bestaandeDatums.has(iso) && iso > vandaag) {
          ontbrekend.push({ datum: iso, dagNaam, uren: urenPerDag[dagNaam] || 1.5 });
        }
      }

      if (ontbrekend.length === 0) {
        results.push({ userId, status: "compleet" });
        continue;
      }

      // Profiel ophalen
      let profiel;
      try {
        const athlete = await intervalsGet("/", {}, creds);
        profiel = {
          ftp: athlete.icu_ftp || plan.huidige_ftp || 265,
          lt_hr: athlete.icu_lthr || 184,
          max_hr: athlete.max_hr || 200,
          gewicht: athlete.icu_weight || 90,
          hrv_basislijn: plan.profiel?.hrv_basislijn || 58,
          hr_basislijn: plan.profiel?.hr_basislijn || 49,
        };
      } catch {
        profiel = { ftp: plan.huidige_ftp || 265, lt_hr: 184, max_hr: 200, gewicht: 90, hrv_basislijn: 58, hr_basislijn: 49 };
      }

      // Wellness ophalen
      let wellness = null;
      try {
        const wData = await intervalsGet("/wellness", { oldest: vandaag, newest: vandaag }, creds);
        if (wData?.length > 0) wellness = wData[0];
      } catch {}

      const aangevuld = [];

      for (const { datum, dagNaam, uren } of ontbrekend) {
        try {
          const overigeSessies = [...bestaandeSessies, ...aangevuld]
            .filter(s => s.datum !== datum && !s.voltooid);

          const promptData = bouwSessieDagPrompt({
            profiel,
            wellness,
            dagelijkseData: [],
            voortgang: null,
            seizoensplan: { ...plan, weekSessies: undefined },
            overigeSessies,
            datum,
            dagNaam,
            uren,
            oudeSessie: null,
            aanleiding: "beschikbaarheid_nieuw",
          });

          const raw = await claudeCall(promptData);
          const sessie = raw.sessie || raw.sessies?.[0] || raw;
          if (!sessie.datum) sessie.datum = datum;
          if (!sessie.dag) sessie.dag = dagNaam;
          normaliseerSessieSegmenten(sessie);

          // Sync naar intervals.icu
          try {
            const zwo = segmentenNaarZwo(sessie.segmenten, sessie.titel);
            const eventBody = {
              category: "WORKOUT",
              start_date_local: `${datum}T08:00:00`,
              name: sessie.titel || sessie.type,
              type: "Ride",
              moving_time: (sessie.duur_min || 90) * 60,
              ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
            };
            const result = await intervalsPost("/events", eventBody, creds);
            if (result.id) sessie.intervalsEventId = result.id;
          } catch (e) {
            console.warn(`[sessies-aanvullen] Intervals sync mislukt voor ${datum}:`, e.message);
          }

          aangevuld.push(sessie);
          console.log(`[sessies-aanvullen] ${userId} ${datum}: ${sessie.type} ${sessie.duur_min}min`);
        } catch (e) {
          console.error(`[sessies-aanvullen] ${userId} ${datum} mislukt:`, e.message);
        }
      }

      if (aangevuld.length > 0) {
        plan.weekSessies = {
          ...plan.weekSessies,
          sessies: [...bestaandeSessies, ...aangevuld],
        };
        await kv.set(planKey, plan);
      }

      results.push({ userId, status: "aangevuld", aantal: aangevuld.length, datums: aangevuld.map(s => s.datum) });
    } catch (e) {
      results.push({ userId, status: "error", error: e.message });
    }
  }

  return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() });
}
