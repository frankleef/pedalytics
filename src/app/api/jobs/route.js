import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { bouwWeekSessiesPrompt } from "@/lib/promptBuilder";
import { valideerSeizoensPlan } from "@/lib/seizoen/valideer";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { claudeCall } from "@/lib/claude";
import { berekenBlok, bouwZonesUitProfiel } from "@/lib/vermogensbereik";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";
import { genereerSessieDag, logSessieGegenereerd } from "@/lib/sessie/genereren";
import { kaderWeekVoorDatum, weekInFaseVoorKaderWeek, getMaandagVanWeek } from "@/lib/weekgrenzen";
import { bepaalAlGeleverd } from "@/lib/sessie/context";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet, intervalsDelete } from "@/lib/intervals";
import { logEvent } from "@/lib/posthog";
import { maakMelding } from "@/lib/meldingen";

export const maxDuration = 120;

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Schrijft het genjob-resultaat weg én houdt een gekapte index bij
// (genjob:index) zodat de admin Jobs&cron-pagina de laatste N jobs kan tonen —
// de al bestaande per-user laatstejob-key laat geen overzicht over alle
// sporters/jobs toe.
async function opslaanGenJob(kv, jobId, data) {
  await kv.set(`genjob:${jobId}`, data, { ex: 300 });
  await kv.lpush("genjob:index", jobId);
  await kv.ltrim("genjob:index", 0, 199);
}

export async function POST(request) {
  const jobId = genId();
  const startedAt = Date.now();
  const kv = getKV();
  let type, params;

  try {
    ({ type, params } = await request.json());
  } catch (e) {
    console.error(`[Job ${jobId}] Request parse mislukt:`, e.message);
    return NextResponse.json({ success: false, error: "Ongeldige request body" }, { status: 400 });
  }

  console.log(`[Job ${jobId}] Start: type=${type}${type === "sessieDag" ? ` datum=${params.datum} aanleiding=${params.aanleiding || "?"}` : ""}`);

  const sessionUser = await getSessionUser();
  if (sessionUser?.id) {
    const laatsteKey = `laatstejob:${sessionUser.id}:${type}:${params.datum || "all"}`;
    await kv.set(laatsteKey, jobId, { ex: 600 });
  }

  try {
    let result;

    if (type === "sessieDag") {
      // Sessiedag-generatie loopt volledig via de gedeelde genereerSessieDag —
      // die kiest zelf deterministisch (archetype+variant) of Claude.
      const intentieInfo = params.oudeSessie?.intentie
        ? `INTENTIE: ${params.oudeSessie.intentie.sessietype} (${params.oudeSessie.intentie.rol})`
        : "GEEN INTENTIE (wordt bepaald)";
      console.log(`[Job ${jobId}] ${intentieInfo} | uren: ${params.uren}`);

      const kaderWeek = kaderWeekVoorDatum(params.datum, params.seizoensplan?.kader, params.seizoensplan?.startdatum);
      const huidigeFase = kaderWeek?.fase ?? "basis";
      const weekInFase = weekInFaseVoorKaderWeek(kaderWeek, params.seizoensplan?.kader);
      // params.userId wordt door de client nooit meegestuurd voor dit jobtype
      // (geverifieerd via productielogs) — sessionUser (al hierboven via de
      // sessie-cookie opgehaald, betrouwbaar) is de eigenlijke bron. Zonder deze
      // fallback was userId hier altijd "" (leeg), waardoor hrvProfiel/piekSprint
      // altijd op hun default terugvielen én — sinds de weekbudget-clamp van
      // vandaag — alGeleverdTss altijd stil op 0 bleef staan, dus de clamp nooit
      // iets afremde.
      const userId = params.userId || sessionUser?.id || "";
      const hrvProfiel = userId ? await kv.get(`hrv-profiel:${userId}`) : null;
      const piekSprint = await kv.get(`piek_sprint_vermogen:${userId}`) || Math.round((params.profiel?.ftp || 265) * 1.8);

      // Resterend weekbudget: dit pad (regeneratie via UI-actie, bv.
      // beschikbaarheid wijzigen) loopt niet via solveWeek()/pasBudgetToe() en
      // kent dus normaal gesproken geen weekbudget — zonder deze check plant
      // genereerSessieDag() een volle sessie op basis van uren alleen, ook in
      // een hersteldweek met een allang overschreden weekbudget.
      const weekStart = getMaandagVanWeek(params.datum).toISOString().slice(0, 10);
      const alGeleverd = userId ? await bepaalAlGeleverd(userId, weekStart) : { tss: 0 };

      // Wellness/TSB specifiek voor de doeldatum ophalen i.p.v. de meegegeven
      // (altijd "vandaag") params.wellness te vertrouwen — zelfde patroon en
      // reden als "Bug 2 uit het diagnoserapport" in sessiesAanvullen.js:214-220
      // (intervals.icu geeft een geprojecteerde CTL/ATL terug voor toekomstige
      // datums op basis van al geplande activiteiten). Zonder dit gebruikt de
      // TSB-gebaseerde afremlogica (degradeerBijLageTsb) bij het plannen van
      // bv. morgen alsnog de TSB van vandaag, die kan afwijken.
      let wellnessVoorDatum = params.wellness;
      if (userId) {
        try {
          const creds = await getIntervalsCredentials(userId);
          if (creds) {
            const wData = await intervalsGet("/wellness", { oldest: params.datum, newest: params.datum }, creds);
            if (wData?.length > 0) wellnessVoorDatum = wData[0];
          }
        } catch (e) {
          console.warn(`[Job ${jobId}] wellness-ophalen voor ${params.datum} mislukt, val terug op meegegeven wellness:`, e.message);
        }
      }

      result = await genereerSessieDag({
        kv, userId,
        datum: params.datum, dagNaam: params.dagNaam, uren: params.uren,
        profiel: params.profiel, wellness: wellnessVoorDatum, plan: params.seizoensplan,
        oudeSessie: params.oudeSessie || null, overigeSessies: params.overigeSessies || [],
        dagelijkseData: params.dagelijkseData || [], voortgang: params.voortgang || null,
        aanleiding: params.aanleiding, huidigeFase, weekInFase, weektype: kaderWeek?.weektype || 'opbouw', hrvProfiel, piekSprint,
        weekTssDoel: kaderWeek?.tss_doel ?? null, alGeleverdTss: alGeleverd.tss,
      });

      if (result?._geenSessie) {
        console.log(`[Job ${jobId}] Geen sessie gegenereerd: ${result.reden}`);
        if (userId) {
          maakMelding(userId, "overbelastingsgate_nieuwe_dag", {
            datum: params.datum,
            dagLabel: params.dagNaam,
            tekst: `${params.dagNaam} is een rustdag gebleven: je hebt deze week al meer TSS geleverd dan het weekdoel toestaat, dus is er geen extra sessie ingepland.`,
          }).catch((e) => console.warn(`[Job ${jobId}] melding-aanmaak (weekbudget) mislukt:`, e.message));

          // Server-side, atomair verwijderen van een eventuele bestaande sessie op
          // deze datum — niet overlaten aan de client (React state + een losse PUT
          // die kan racen met snel-opeenvolgende beschikbaarheidswijzigingen, of met
          // de navolgende /api/sessies/aanvullen-call). Zonder dit blijft een oude,
          // te grote sessie van vóór deze beslissing gewoon in het plan staan, ook al
          // meldt de app terecht dat het een rustdag is geworden.
          try {
            const planKeyStr = `${userId}:seizoensplan`;
            const plan = await kv.get(planKeyStr);
            const bestaande = plan?.weekSessies?.sessies?.find((s) => s.datum === params.datum);
            if (bestaande && !bestaande.voltooid) {
              const nieuweSessies = plan.weekSessies.sessies.filter((s) => s.datum !== params.datum);
              await kv.set(planKeyStr, { ...plan, weekSessies: { ...plan.weekSessies, sessies: nieuweSessies } });
              console.log(`[Job ${jobId}] Bestaande sessie op ${params.datum} verwijderd (weekbudget uitgeput)`);
              if (bestaande.intervalsEventId) {
                const creds = await getIntervalsCredentials(userId);
                if (creds) {
                  await intervalsDelete(`/events/${bestaande.intervalsEventId}`, creds).catch(
                    (e) => console.warn(`[Job ${jobId}] intervals.icu event ${bestaande.intervalsEventId} verwijderen mislukt:`, e.message)
                  );
                }
              }
            }
          } catch (e) {
            console.warn(`[Job ${jobId}] Opruimen bestaande sessie op ${params.datum} mislukt:`, e.message);
          }
        }
        await opslaanGenJob(kv, jobId, { status: "done", type, result, userId: userId || null, createdAt: new Date(startedAt).toISOString(), durationMs: Date.now() - startedAt });
        return NextResponse.json({ success: true, jobId, status: "done", result });
      }

      console.log(`[Job ${jobId}] Resultaat: ${result.type} "${result.titel}" | ${result.duur_min}min | TSS ${result.tss} | ${result.segmenten?.length || 0} segmenten`);
      if (result.intentie?.sessietype !== "ramp_test") logSessieGegenereerd(result, { userId, huidigeFase, weekInFase });
      await opslaanGenJob(kv, jobId, { status: "done", type, result, userId: userId || null, createdAt: new Date(startedAt).toISOString(), durationMs: Date.now() - startedAt });
      console.log(`[Job ${jobId}] Voltooid`);
      return NextResponse.json({ success: true, jobId, status: "done", result });
    }

    // 1. Prompt bouwen
    let promptData;
    if (type === "weekSessies") {
      promptData = bouwWeekSessiesPrompt(params);
      if (!promptData) {
        console.log(`[Job ${jobId}] Geen dagen te plannen — leeg resultaat`);
        const emptyResult = { sessies: [], tss_totaal: 0 };
        await opslaanGenJob(kv, jobId, { status: "done", type, result: emptyResult, userId: params?.userId ?? sessionUser?.id ?? null, createdAt: new Date(startedAt).toISOString(), durationMs: Date.now() - startedAt });
        return NextResponse.json({ success: true, jobId, status: "done", result: emptyResult });
      }
    } else {
      throw new Error(`Onbekend job type: ${type}`);
    }

    // 2. Claude aanroepen
    console.log(`[Job ${jobId}] Claude aanroep...`);
    const raw = await claudeCall(promptData);
    console.log(`[Job ${jobId}] Claude response ontvangen`);

    // 3. Resultaat verwerken
    result = raw;
    result.voltooideDatams = promptData.voltooideDatams;
    (result.sessies || []).forEach(s => { normaliseerSessieSegmenten(s); voegVerwachtRpeToe(s); corrigeerSessieTss(s); });
    console.log(`[Job ${jobId}] ${(result.sessies || []).length} sessies gegenereerd`);

    // 4. Validatie
    const planVoorValidatie = { kader: params.seizoensplan?.kader, weekSessies: { sessies: result.sessies } };
    const { geldig, fouten } = valideerSeizoensPlan(planVoorValidatie);
    if (!geldig) console.warn(`[Job ${jobId}] Validatiefouten:`, fouten);

    // 5. Vermogensbereik
    if (params.profiel?.power_zones && params.profiel?.ftp) {
      try {
        const zones = bouwZonesUitProfiel(params.profiel.ftp, params.profiel.power_zones);
        const piekSprint = await kv.get(`piek_sprint_vermogen:${params.userId || ""}`) || Math.round(params.profiel.ftp * 1.8);
        const verwerkSegmenten = (segs, sessietype) => (segs || []).map(seg => {
          if (seg.zone) return berekenBlok(seg, zones, params.profiel.ftp, piekSprint, sessietype);
          return seg;
        });
        if (result.sessies) {
          result.sessies = result.sessies.map(s => ({ ...s, segmenten: verwerkSegmenten(s.segmenten, s.intentie?.sessietype || s.sessietype || s.type) }));
        }
      } catch (e) { console.warn(`[Job ${jobId}] Vermogensbereik mislukt:`, e.message); }
    }

    // 6. Opslaan in KV (voor backward compatibility met polling) + direct retourneren
    await opslaanGenJob(kv, jobId, { status: "done", type, result, userId: params?.userId ?? sessionUser?.id ?? null, createdAt: new Date(startedAt).toISOString(), durationMs: Date.now() - startedAt });
    console.log(`[Job ${jobId}] Voltooid`);
    return NextResponse.json({ success: true, jobId, status: "done", result });

  } catch (e) {
    console.error(`[Job ${jobId}] MISLUKT: ${e.message}`);
    if (!e._observabilityLogged) {
      logEvent("generatie_fout", sessionUser?.id || params?.userId || "", {
        functie: type, foutcode: e.message, sessietype: params?.oudeSessie?.intentie?.sessietype ?? null, datum: params?.datum ?? null,
      });
    }
    await opslaanGenJob(kv, jobId, { status: "failed", type, error: e.message, userId: params?.userId ?? sessionUser?.id ?? null, createdAt: new Date(startedAt).toISOString(), durationMs: Date.now() - startedAt }).catch(() => {});
    return NextResponse.json({ success: true, jobId, status: "failed", error: e.message });
  }
}
