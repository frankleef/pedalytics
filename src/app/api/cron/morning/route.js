import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { sendPush } from "@/lib/pushNotify";
import { vandaagISO } from "@/lib/datum";
import { verifyQStash } from "@/lib/qstash";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { bepaalHrvZone } from "@/lib/hrv/zone";
import { bepaalNotificatie, checkNotificatieLimiet, verhoogNotificatieTeller, bouwNotificatieTekst } from "@/lib/hrv/notificatie";
import { bepaalOpportunistischeTraining } from "@/lib/hrv/opportunistisch";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { logEvent } from "@/lib/posthog";

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

export async function POST(request) {
  const geldig = await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      results.push({ userId, status: checkin ? "al_ingevuld" : "sent", hrv: hrvResult });
    } catch (e) {
      results.push({ userId, status: "error", error: e.message });
    }
  }

  return NextResponse.json({ success: true, results });
}
