// Blok F, fase 4: cron-integratie voor de periodieke AI-review (2x/dag).
// Knoopt fase 1 (verzamelReviewContext), fase 2 (bouwReviewPrompt), de
// Claude API-call en fase 3 (valideerReviewVoorstel) aan elkaar. Uitsluitend
// de GEACCEPTEERDE voorstellen worden gepersisteerd (review_voorstel:${userId})
// — voor F5 (UI, nog te bouwen). Zelfde patroon als cron/sync/route.js en
// cron/morning/route.js: POST-only, QStash- of ADMIN_SECRET-geauthenticeerd,
// itereert over kv.get("users:active"), per-user try/catch zodat één falende
// gebruiker de rest van de run niet blokkeert.

import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { verifyQStash } from "@/lib/qstash";
import { logCronRun } from "@/lib/cronLog";
import { verzamelReviewContext } from "@/lib/review/context";
import { bouwReviewPrompt } from "@/lib/review/prompt";
import { valideerReviewVoorstel } from "@/lib/review/validatie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Geen bestaand Anthropic/Claude-precedent in de codebase (zie
// verificatierapport) — minimale, faalveilige eigen aanpak: rechtstreekse
// fetch (zelfde stijl als lib/intervals.js, geen nieuwe SDK-dependency),
// AbortController-timeout, GEEN retry (een hangende/mislukte call mag de
// cron-run voor andere gebruikers niet vertragen of blokkeren).
const CLAUDE_MODEL = "claude-sonnet-5";
const CLAUDE_TIMEOUT_MS = 30_000;
const CLAUDE_MAX_TOKENS = 2048;

// 2x/dag (~12u interval) is nog nergens elders in de codebase geconfigureerd
// (geen vercel.json, QStash-schedules staan buiten deze repo) — TTL hier
// bewust losgekoppeld van een aanname over het exacte QStash-cron-expressie.
// 18u: ruim boven de ~12u-run-tot-run-afstand (marge voor lichte vertraging),
// maar ruim onder 24u zodat een voorstel na precies ÉÉN gemiste run altijd al
// verlopen is — nooit een tweede, dubbel-verouderd voorstel dat blijft hangen.
const REVIEW_VOORSTEL_TTL_SECONDEN = 18 * 3600;

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

/**
 * Rechtstreekse Claude API-call (geen SDK-dependency, zie bestandscommentaar).
 * Faalt met een fout (nooit stil) bij een niet-2xx-respons, timeout, of
 * ontbrekende API-key — de aanroeper (POST hieronder) vangt dit per gebruiker af.
 * @returns {Promise<string>} de ruwe tekstrespons van Claude
 */
export async function roepClaudeAan(systeeminstructie, userBericht) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ontbreekt");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        system: systeeminstructie,
        messages: [{ role: "user", content: userBericht }],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const tekst = await resp.text().catch(() => "");
      throw new Error(`Claude API fout ${resp.status}: ${tekst}`);
    }
    const data = await resp.json();
    // NIET content[0] pakken: modellen met adaptive thinking (bv. claude-sonnet-5)
    // zetten standaard een "thinking"-blok vóór het tekstblok — content[0].text
    // is dan undefined terwijl het echte antwoord in een later blok zit. Zoek
    // het eerste text-blok expliciet.
    const tekstBlok = data?.content?.find(b => b.type === "text");
    return tekstBlok?.text ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parseert Claude's tekstrespons defensief naar het F2-antwoordschema
 * (array van dag-items) — vertrouwt niets: geen tekst, geen JSON, of geen
 * array levert allemaal null op i.p.v. een gegooide fout.
 * @returns {Array|null}
 */
export function parseClaudeVoorstel(ruweTekst) {
  if (!ruweTekst || typeof ruweTekst !== "string") return null;
  // Prompt.js verbiedt markdown-codeblok-omheining expliciet, maar defensief
  // toch strippen als het model het er onverhoopt wel omheen zet.
  const schoon = ruweTekst.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const geparsed = JSON.parse(schoon);
    return Array.isArray(geparsed) ? geparsed : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  const geldig = request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}` || await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = Date.now();
  const kv = getKV();
  const results = [];

  try {
    const userIds = (await kv.get("users:active")) || [];

    for (const userId of userIds) {
      try {
        const plan = await kv.get(`${userId}:seizoensplan`);
        if (!plan?.kader || !plan.startdatum) {
          results.push({ userId, status: "geen_plan" });
          continue;
        }

        let reviewContext;
        try {
          reviewContext = await verzamelReviewContext(kv, userId, plan);
        } catch (e) {
          console.warn(`[review] Contextverzameling mislukt voor ${userId}:`, e.message);
          results.push({ userId, status: "error", fase: "context", error: e.message });
          continue;
        }

        const { systeeminstructie, userBericht } = bouwReviewPrompt(reviewContext, plan);

        let ruweTekst;
        try {
          ruweTekst = await roepClaudeAan(systeeminstructie, userBericht);
        } catch (e) {
          console.warn(`[review] Claude API-call mislukt voor ${userId}:`, e.message);
          results.push({ userId, status: "error", fase: "claude", error: e.message });
          continue;
        }

        const voorstelArray = parseClaudeVoorstel(ruweTekst);
        if (voorstelArray == null) {
          console.warn(`[review] Ongeldige/ontbrekende JSON van Claude voor ${userId}`);
          results.push({ userId, status: "error", fase: "parse", error: "ongeldige JSON" });
          continue;
        }

        let gevalideerd;
        try {
          gevalideerd = valideerReviewVoorstel(voorstelArray, reviewContext, plan);
        } catch (e) {
          console.warn(`[review] Validatie mislukt voor ${userId}:`, e.message);
          results.push({ userId, status: "error", fase: "validatie", error: e.message });
          continue;
        }

        const geaccepteerd = gevalideerd.filter(r => r.geaccepteerd);
        if (geaccepteerd.length === 0) {
          results.push({ userId, status: "geen_geaccepteerd_voorstel" });
          continue;
        }

        await kv.set(`review_voorstel:${userId}`, geaccepteerd, { ex: REVIEW_VOORSTEL_TTL_SECONDEN });
        results.push({ userId, status: "voorstel_gepersisteerd", aantal: geaccepteerd.length });
      } catch (e) {
        results.push({ userId, status: "error", fase: "onbekend", error: e.message });
      }
    }

    await logCronRun("review", { startedAt, results }).catch(err => console.warn("[review] cronrun-log mislukt:", err.message));
    return NextResponse.json({ success: true, results, checkedAt: new Date().toISOString() });
  } catch (e) {
    await logCronRun("review", { startedAt, results: [...results, { userId: "_run_", status: "error", error: e.message }] }).catch(err => console.warn("[review] cronrun-log mislukt:", err.message));
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
