import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { bouwSeizoensplanPrompt, bouwWeekSessiesPrompt, bouwSessieDagPrompt } from "@/lib/promptBuilder";
import { valideerSeizoensPlan } from "@/lib/seizoen/valideer";
import { normaliseerSessieSegmenten, valideerKrachtRestrictie } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { claudeCall } from "@/lib/claude";
import { berekenBlok, bouwZonesUitProfiel } from "@/lib/vermogensbereik";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";

export const maxDuration = 120;

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request) {
  const jobId = genId();
  const kv = getKV();
  let type, params;

  try {
    ({ type, params } = await request.json());
  } catch (e) {
    console.error(`[Job ${jobId}] Request parse mislukt:`, e.message);
    return NextResponse.json({ success: false, error: "Ongeldige request body" }, { status: 400 });
  }

  console.log(`[Job ${jobId}] Start: type=${type}${type === "sessieDag" ? ` datum=${params.datum} aanleiding=${params.aanleiding || "?"}` : ""}`);

  const laatsteKey = `laatstejob:${type}:${params.datum || "all"}`;
  await kv.set(laatsteKey, jobId, { ex: 600 });

  try {
    // 1. Prompt bouwen
    let promptData;
    if (type === "seizoensplan") {
      promptData = bouwSeizoensplanPrompt(params);
    } else if (type === "weekSessies") {
      promptData = bouwWeekSessiesPrompt(params);
      if (!promptData) {
        console.log(`[Job ${jobId}] Geen dagen te plannen — leeg resultaat`);
        const emptyResult = { sessies: [], tss_totaal: 0 };
        await kv.set(`genjob:${jobId}`, { status: "done", type, result: emptyResult }, { ex: 300 });
        return NextResponse.json({ success: true, jobId, status: "done", result: emptyResult });
      }
    } else if (type === "sessieDag") {
      promptData = bouwSessieDagPrompt(params);
      const intentieInfo = params.oudeSessie?.intentie
        ? `INTENTIE: ${params.oudeSessie.intentie.sessietype} (${params.oudeSessie.intentie.rol})`
        : "GEEN INTENTIE (wordt bepaald)";
      console.log(`[Job ${jobId}] ${intentieInfo} | uren: ${params.uren}`);
    } else {
      throw new Error(`Onbekend job type: ${type}`);
    }

    // 2. Claude aanroepen
    console.log(`[Job ${jobId}] Claude aanroep...`);
    const raw = await claudeCall(promptData);
    console.log(`[Job ${jobId}] Claude response ontvangen`);

    // 3. Resultaat verwerken
    let result;
    if (type === "sessieDag") {
      result = raw.sessie || raw.sessies?.[0] || raw;
      if (!result.datum) result.datum = params.datum;
      if (!result.dag) result.dag = params.dagNaam;
      normaliseerSessieSegmenten(result);
      voegVerwachtRpeToe(result);
      corrigeerSessieTss(result);

      // Centrale kracht-gate: max 1 kracht_lage_cadans per rollend 7-dagenvenster
      const krachtCheck = valideerKrachtRestrictie(result, params.overigeSessies || []);
      if (!krachtCheck.geldig) {
        console.warn(`[Job ${jobId}] Kracht geblokkeerd — ${krachtCheck.reden} → z2_duur`);
        result.type = "duur_variabel";
        result.titel = "Z2 Duur — Kracht geblokkeerd";
        if (result.intentie) {
          result.intentie.sessietype = "z2_duur";
          result.intentie.rol = "aerobe_dag";
          result.intentie.toegestane_zones = ["Z2"];
        }
        result.duur_min = Math.round((params.uren || 1.5) * 60);
        result.segmenten = [{
          zone: "Z2",
          positie: "midden",
          blokDuurSeconden: result.duur_min * 60,
          isSpecifiek: false,
          sessietype: "z2_duur",
        }];
        corrigeerSessieTss(result);
      }

      console.log(`[Job ${jobId}] Resultaat: ${result.type} "${result.titel}" | ${result.duur_min}min | TSS ${result.tss} | ${result.segmenten?.length || 0} segmenten`);
    } else if (type === "weekSessies") {
      result = raw;
      result.voltooideDatams = promptData.voltooideDatams;
      (result.sessies || []).forEach(s => { normaliseerSessieSegmenten(s); voegVerwachtRpeToe(s); corrigeerSessieTss(s); });
      console.log(`[Job ${jobId}] ${(result.sessies || []).length} sessies gegenereerd`);
    } else {
      result = raw;
      (result.detail_weken || []).forEach(w => (w.sessies || []).forEach(s => { normaliseerSessieSegmenten(s); voegVerwachtRpeToe(s); corrigeerSessieTss(s); }));
    }

    // 4. Validatie
    if (type === "seizoensplan" || type === "weekSessies") {
      const planVoorValidatie = type === "seizoensplan"
        ? { ...params, ...result }
        : { kader: params.seizoensplan?.kader, weekSessies: { sessies: result.sessies } };
      const { geldig, fouten } = valideerSeizoensPlan(planVoorValidatie);
      if (!geldig) console.warn(`[Job ${jobId}] Validatiefouten:`, fouten);
    }

    // 5. Vermogensbereik
    if ((type === "sessieDag" || type === "weekSessies") && params.profiel?.power_zones && params.profiel?.ftp) {
      try {
        const zones = bouwZonesUitProfiel(params.profiel.ftp, params.profiel.power_zones);
        const piekSprint = await kv.get(`piek_sprint_vermogen:${params.userId || ""}`) || Math.round(params.profiel.ftp * 1.8);
        const verwerkSegmenten = (segs, sessietype) => (segs || []).map(seg => {
          if (seg.zone) return berekenBlok(seg, zones, params.profiel.ftp, piekSprint, sessietype);
          return seg;
        });
        if (type === "sessieDag" && result.segmenten) {
          result.segmenten = verwerkSegmenten(result.segmenten, result.intentie?.sessietype || result.sessietype || result.type);
        }
        if (type === "weekSessies" && result.sessies) {
          result.sessies = result.sessies.map(s => ({ ...s, segmenten: verwerkSegmenten(s.segmenten, s.intentie?.sessietype || s.sessietype || s.type) }));
        }
      } catch (e) { console.warn(`[Job ${jobId}] Vermogensbereik mislukt:`, e.message); }
    }

    // 6. Opslaan in KV (voor backward compatibility met polling) + direct retourneren
    await kv.set(`genjob:${jobId}`, { status: "done", type, result }, { ex: 300 });
    console.log(`[Job ${jobId}] Voltooid`);
    return NextResponse.json({ success: true, jobId, status: "done", result });

  } catch (e) {
    console.error(`[Job ${jobId}] MISLUKT: ${e.message}`);
    await kv.set(`genjob:${jobId}`, { status: "failed", type, error: e.message }, { ex: 300 }).catch(() => {});
    return NextResponse.json({ success: true, jobId, status: "failed", error: e.message });
  }
}
