import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { sendPush } from "@/lib/pushNotify";
import { vandaagISO, datumOffset } from "@/lib/datum";
import { verifyQStash } from "@/lib/qstash";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { bepaalHrvZone } from "@/lib/hrv/zone";
import { bepaalNotificatie, checkNotificatieLimiet, verhoogNotificatieTeller, bouwNotificatieTekst } from "@/lib/hrv/notificatie";
import { bepaalOpportunistischeTraining } from "@/lib/hrv/opportunistisch";
import { berekenHrvBaseline, berekenHrvTrend, verwerkHrvTrend } from "@/lib/hrv/trend";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { logEvent } from "@/lib/posthog";
import { logCronRun } from "@/lib/cronLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

async function verwerkHrvNotificatie(userId, kv, vandaag) {
  const hrvProfielRaw = await kv.get(`hrv-profiel:${userId}`);
  const hrvProfiel = typeof hrvProfielRaw === "string" ? JSON.parse(hrvProfielRaw) : hrvProfielRaw;
  if (!hrvProfiel?.betrouwbaar) return null;

  let huidigHrv = null;
  try {
    const creds = await getIntervalsCredentials(userId);
    if (creds) {
      const wData = await intervalsGet("/wellness", { oldest: vandaag, newest: vandaag }, creds);
      huidigHrv = wData?.[0]?.hrv ?? null;
    }
  } catch {}

  const hrvZone = bepaalHrvZone(huidigHrv, hrvProfiel);

  // Sla HRV-zone op in seizoensplan
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (plan?.weekSessies?.sessies) {
    const sessie = plan.weekSessies.sessies.find(s => s.datum === vandaag && !s.voltooid);
    if (sessie) {
      sessie.hrv_zone = hrvZone;
      sessie.hrv_vandaag = huidigHrv;
      await kv.set(planKey, plan);
    }

    const notificatie = bepaalNotificatie({ hrvZone, geplandeSessie: sessie });

    if (!notificatie.sturen) {
      // Check opportunistische training
      if (hrvZone === "hoog" && !sessie) {
        const beschikbaar = plan.beschikbaarheid || {};
        const dagNaam = ["Zondag","Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag"][new Date(vandaag).getDay()];
        const weekNr = plan.startdatum ? weeknummerVoorDatum(vandaag, plan.startdatum) : 1;
        const kaderWeek = plan.kader?.find(w => w.week === weekNr) || plan.kader?.[0];
        const weekTss = plan.weekSessies.sessies.filter(s => {
          if (!s.datum) return false;
          const ws = new Date(vandaag); ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
          const we = new Date(ws); we.setDate(ws.getDate() + 7);
          return s.datum >= ws.toISOString().slice(0, 10) && s.datum < we.toISOString().slice(0, 10);
        }).reduce((s, x) => s + (x.tss || 0), 0);
        const tssBudget = (kaderWeek?.tss_doel || 300) - weekTss;

        const opp = bepaalOpportunistischeTraining({
          hrvZone, geplandeSessie: sessie, beschikbaar: !!beschikbaar[dagNaam],
          tssBudgetResterend: tssBudget, weektype: kaderWeek?.weektype,
        });
        if (opp) {
          await sendPush(userId, { title: opp.notificatie.titel, body: opp.notificatie.body, url: "/", tag: "hrv-opportunistisch" });
          return "opportunistisch_gestuurd";
        }
      }
      return "hrv_ok";
    }

    const magSturen = await checkNotificatieLimiet(userId);
    const checkIn = await kv.get(`${userId}:checkin:${vandaag}`);
    if (!magSturen) {
      logEvent("hrv_waarschuwing", userId, { niveau: notificatie.type, hrv_score: huidigHrv, check_in_score: checkIn?.score ?? null, actie_genomen: "limiet_bereikt" });
      return "limiet_bereikt";
    }

    const tekst = bouwNotificatieTekst(notificatie.type, sessie, hrvProfiel, huidigHrv);
    await sendPush(userId, { title: tekst.titel, body: tekst.body, url: "/", tag: "hrv-advies" });
    await verhoogNotificatieTeller(userId);
    logEvent("hrv_waarschuwing", userId, { niveau: notificatie.type, hrv_score: huidigHrv, check_in_score: checkIn?.score ?? null, actie_genomen: "hrv_notificatie_gestuurd" });
    return "hrv_notificatie_gestuurd";
  }
  return "geen_sessies";
}

// Sectie 52 — onafhankelijke tweede trigger naast RPE-delta. Draait hier (i.p.v.
// in cron/sync) omdat dit de enige cron is die dagelijks voor élke actieve
// gebruiker draait, ook op rustdagen zonder nieuwe rit — precies het scenario
// waarin RPE-delta geen signaal kan geven (geen rit = geen RPE), maar HRV wel.
async function verwerkHrvTrendCheck(userId, vandaag) {
  try {
    const creds = await getIntervalsCredentials(userId);
    if (!creds) return null;

    const wellHrv14d = await intervalsGet("/wellness", { oldest: datumOffset(-13), newest: vandaag }, creds);
    const hrvMetingen14d = (wellHrv14d || []).filter(w => w.hrv != null).map(w => w.hrv);
    const baseline = berekenHrvBaseline(hrvMetingen14d);
    const trend = berekenHrvTrend(hrvMetingen14d.slice(-7), baseline);
    if (trend === null) return null;

    const actie = await verwerkHrvTrend(userId, trend);
    if (actie === "hrv_overbelasting") {
      await sendPush(userId, {
        title: "Plan aangepast",
        body: "Je hartslagvariabiliteit wijst al een paar dagen op onvoldoende herstel, ook al voelden je trainingen niet per se zwaar aan. We hebben de komende sessies iets teruggeschroefd.",
        url: "/",
      });
    }
    return actie;
  } catch (e) {
    console.warn(`[morning] HRV-trend check mislukt voor ${userId}:`, e.message);
    return null;
  }
}

export async function POST(request) {
  const geldig = request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}` || await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = Date.now();
  const kv = getKV();
  const userIds = (await kv.get("users:active")) || [];
  const vandaag = vandaagISO();
  const results = [];

  for (const userId of userIds) {
    try {
      // Check-in push
      const checkin = await kv.get(`${userId}:checkin:${vandaag}`);
      if (!checkin) {
        await sendPush(userId, {
          title: "Goedemorgen!",
          body: "Hoe voel je je vandaag? Vul je ochtend-check-in in.",
          url: "/",
          tag: "morning-checkin",
        });
      }

      // HRV-notificatie
      const hrvResult = await verwerkHrvNotificatie(userId, kv, vandaag);

      // HRV-trend check (sectie 52) — onafhankelijk van bovenstaande dag-zone-check
      const hrvTrendResult = await verwerkHrvTrendCheck(userId, vandaag);

      results.push({ userId, status: checkin ? "al_ingevuld" : "sent", hrv: hrvResult, hrvTrend: hrvTrendResult });
    } catch (e) {
      results.push({ userId, status: "error", error: e.message });
    }
  }

  await logCronRun("morning", { startedAt, results }).catch(e => console.warn("[morning] cronrun-log mislukt:", e.message));

  return NextResponse.json({ success: true, results });
}
