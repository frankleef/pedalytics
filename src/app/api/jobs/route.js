import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { bouwSeizoensplanPrompt, bouwWeekSessiesPrompt, bouwSessieDagPrompt } from "@/lib/promptBuilder";
import { valideerSeizoensPlan } from "@/lib/seizoen/valideer";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { claudeCall } from "@/lib/claude";
import { berekenBlok, bouwZonesUitProfiel } from "@/lib/vermogensbereik";

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

      // Vermogensbereik berekenen als zones beschikbaar zijn
      if ((type === "sessieDag" || type === "weekSessies") && params.profiel?.power_zones && params.profiel?.ftp) {
        try {
          const zones = bouwZonesUitProfiel(params.profiel.ftp, params.profiel.power_zones);
          const piekSprint = await kv.get(`piek_sprint_vermogen:${params.userId || ""}`) || Math.round(params.profiel.ftp * 1.8);
          const verwerkSegmenten = (segs) => (segs || []).map(seg => {
            if (seg.zone && !seg.vermogenMin) return berekenBlok(seg, zones, params.profiel.ftp, piekSprint);
            return seg;
          });
          if (type === "sessieDag" && result.segmenten) {
            result.segmenten = verwerkSegmenten(result.segmenten);
          }
          if (type === "weekSessies" && result.sessies) {
            result.sessies = result.sessies.map(s => ({ ...s, segmenten: verwerkSegmenten(s.segmenten) }));
          }
        } catch (e) { console.warn(`[Job ${jobId}] Vermogensbereik mislukt:`, e.message); }
      }

      await kv.set(`genjob:${jobId}`, { status: "done", type, result }, { ex: 300 });
    } catch (e) {
      await kv.set(`genjob:${jobId}`, { status: "failed", type, error: e.message }, { ex: 300 });
    }
  })();

  return NextResponse.json({ success: true, jobId });
}
