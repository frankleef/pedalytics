import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { bouwSeizoensplanPrompt, bouwWeekSessiesPrompt, bouwSessieDagPrompt } from "@/lib/promptBuilder";
import { valideerSeizoensPlan } from "@/lib/seizoen/valideer";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function claudeCall({ prompt, system, max_tokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY niet geconfigureerd");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens, system, messages: [{ role: "user", content: prompt }] }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const cleaned = text.replace(/```json|```/g, "").trim();
  if (!cleaned) throw new Error("Lege response van Claude");
  if (data.stop_reason === "max_tokens") {
    console.error("[claudeCall] Response afgekapt (max_tokens bereikt). Laatste 200 chars:", cleaned.slice(-200));
    throw new Error("Claude response afgekapt — max_tokens te laag voor deze prompt");
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("[claudeCall] JSON parse mislukt. Eerste 300 chars:", cleaned.slice(0, 300));
    throw new Error(`JSON parse mislukt: ${e.message}`);
  }
}

export async function POST(request) {
  const { type, params } = await request.json();
  const jobId = genId();
  const kv = getKV();

  await kv.set(`genjob:${jobId}`, { status: "pending", type, created: new Date().toISOString() }, { ex: 300 });

  // Fire-and-forget: start de generatie op de achtergrond
  (async () => {
    try {
      let promptData;
      if (type === "seizoensplan") {
        promptData = bouwSeizoensplanPrompt(params);
      } else if (type === "weekSessies") {
        promptData = bouwWeekSessiesPrompt(params);
        if (!promptData) {
          await kv.set(`genjob:${jobId}`, { status: "done", type, result: { sessies: [], tss_totaal: 0 } }, { ex: 300 });
          return;
        }
      } else if (type === "sessieDag") {
        promptData = bouwSessieDagPrompt(params);
        const intentieInfo = params.oudeSessie?.intentie
          ? `INTENTIE: ${params.oudeSessie.intentie.sessietype} (${params.oudeSessie.intentie.rol})`
          : "GEEN INTENTIE (wordt bepaald)";
        console.log(`[Job ${jobId}] sessieDag voor ${params.datum}: ${intentieInfo} | aanleiding: ${params.aanleiding || "niet opgegeven"}`);
        if (process.env.DEBUG_SESSIE_CONTEXT === "true") {
          console.log(`[Job ${jobId}] Volledige prompt:`, promptData.prompt.slice(0, 800));
        }
      } else {
        throw new Error(`Onbekend job type: ${type}`);
      }

      const raw = await claudeCall(promptData);
      if (type === "sessieDag") {
        const r = raw.sessie || raw.sessies?.[0] || raw;
        console.log(`[Job ${jobId}] Claude response type: ${r.type} ${r.vermogen} | duur: ${r.duur_min}min | tss: ${r.tss} | uren param: ${params.uren}`);
      }

      let result;
      if (type === "sessieDag") {
        result = raw.sessie || raw.sessies?.[0] || raw;
        if (!result.datum) result.datum = params.datum;
        if (!result.dag) result.dag = params.dagNaam;
        normaliseerSessieSegmenten(result);
        voegVerwachtRpeToe(result);
      } else if (type === "weekSessies") {
        result = raw;
        result.voltooideDatams = promptData.voltooideDatams;
        (result.sessies || []).forEach(s => { normaliseerSessieSegmenten(s); voegVerwachtRpeToe(s); });
      } else {
        result = raw;
        (result.detail_weken || []).forEach(w => (w.sessies || []).forEach(s => { normaliseerSessieSegmenten(s); voegVerwachtRpeToe(s); }));
      }

      // Valideer seizoensplan en weekSessies output
      if (type === "seizoensplan" || type === "weekSessies") {
        const planVoorValidatie = type === "seizoensplan"
          ? { ...params, ...result }
          : { kader: params.seizoensplan?.kader, weekSessies: { sessies: result.sessies } };
        const { geldig, fouten } = valideerSeizoensPlan(planVoorValidatie);
        if (!geldig) {
          console.warn(`[Job ${jobId}] Validatiefouten:`, fouten);
        }
      }

      await kv.set(`genjob:${jobId}`, { status: "done", type, result }, { ex: 300 });
    } catch (e) {
      await kv.set(`genjob:${jobId}`, { status: "failed", type, error: e.message }, { ex: 300 });
    }
  })();

  return NextResponse.json({ success: true, jobId });
}
