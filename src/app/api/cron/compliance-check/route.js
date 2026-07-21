import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { verifyQStash } from "@/lib/qstash";
import { logCronRun } from "@/lib/cronLog";
import { datumOffset, laatsteNDagen, DAGNAMEN } from "@/lib/datum";
import { isKernsessieVoorCompliance, bepaalComplianceRecord, COMPLIANCE_VENSTER_DAGEN, evalueerComplianceFreeze } from "@/lib/sessie/compliance";
import { logEvent } from "@/lib/posthog";
import { maakMelding } from "@/lib/meldingen";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { bijwerkPlanVeilig } from "@/lib/plan/bijwerkPlanVeilig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

// Vult de "niet-geleverd"-detectie aan die cron/sync/route.js niet dekt: die
// loop is activiteit-gedreven en verlaat een gebruiker vroeg zodra er geen
// nieuwe intervals.icu-activiteit is (cron/sync/route.js:286-287), dus komt
// nooit toe aan geplande kernsessies zónder activiteit. Dit endpoint doet de
// inverse check: itereert over het plan op datum, ongeacht sync-activiteit.
export async function POST(request) {
  const geldig = request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}` || await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = Date.now();
  const kv = getKV();
  const userIds = (await kv.get("users:active")) || [];
  const drempelDatum = datumOffset(-2); // 48u-grace-periode, dagniveau (zelfde ISO-datumvergelijking als elders, bv. volumeCorrectie.js)
  // C8: reconciliatie kijkt nooit verder terug dan wat haalComplianceVenster()
  // (compliance.js) daadwerkelijk leest — verder terugkijken kost extra
  // intervals.icu-calls zonder dat er ooit een consument is die het resultaat
  // leest (sessie_compliance heeft geen andere consument dan het venster).
  const vensterOudsteDatum = laatsteNDagen(COMPLIANCE_VENSTER_DAGEN)[0];
  const results = [];

  for (const userId of userIds) {
    try {
      // Plan altijd vers lezen — nooit een referentie uit een eerdere
      // loop-iteratie of eerdere cron-run hergebruiken. voerWekelijkseEvaluatieUit
      // (volumeCorrectie.js:499-507) kan niet-voltooide toekomstige sessies
      // verwijderen/regenereren; een gecachete planverwijzing zou dan een
      // inmiddels vervangen sessie beoordelen i.p.v. de huidige.
      const planKey = `${userId}:seizoensplan`;
      const plan = await kv.get(planKey);
      const sessies = plan?.weekSessies?.sessies || [];

      let gedetecteerd = 0;
      let gereconcilieerd = 0;
      // C8: sessies met een bestaand niet_geleverd-record dat compliance-check
      // zelf schreef (activiteitId === null — nooit een record dat cron/sync
      // al met een echte, matige activiteit matchte) én binnen het actieve
      // venster — verzameld hier, pas ná de lus in één intervals.icu-call
      // per user gecontroleerd (kosten-argument uit het plan).
      const reconciliatieKandidaten = [];

      for (const sessie of sessies) {
        if (!sessie.datum || sessie.datum > drempelDatum) continue;
        if (sessie.voltooid) continue;
        // C7: een bron-datum met hrv_verplaatst_naar (verwerkVerplaatsen, hrv/verwerking.js:163)
        // is geen gemiste sessie — de intentie zelf staat inmiddels op de nieuwe
        // datum (dezelfde sessies-array, hrv_verplaatst_van), die hier onafhankelijk
        // op haar eigen datum wordt beoordeeld zodra ZIJ de 48u-grens passeert.
        if (sessie.hrv_verplaatst_naar) continue;

        const sessietype = sessie.intentie?.sessietype ?? sessie.type ?? null;
        if (!isKernsessieVoorCompliance(sessietype)) continue;

        const complianceKey = `sessie_compliance:${userId}:${sessie.datum}`;
        const bestaand = await kv.get(complianceKey);
        if (bestaand) {
          if (
            bestaand.tier === "niet_geleverd" &&
            bestaand.activiteitId === null &&
            sessie.datum >= vensterOudsteDatum
          ) {
            reconciliatieKandidaten.push(sessie);
          }
          continue;
        }

        await kv.set(complianceKey, {
          tier: "niet_geleverd",
          percentageOfScore: 0,
          sessietype,
          isKernsessie: true,
          verplaatst_van: sessie.hrv_verplaatst_van ?? null,
          verplaatst_naar: sessie.hrv_verplaatst_naar ?? null,
          activiteitId: null,
          datum: sessie.datum,
          berekendOp: new Date().toISOString(),
        }, { ex: 365 * 86400 });

        logEvent("sessie_overgeslagen", userId, { datum: sessie.datum, sessietype });

        const dagLabel = DAGNAMEN[new Date(sessie.datum).getDay()];
        maakMelding(userId, "sessie_gemist", { datum: sessie.datum, sessietype, dagLabel }).catch(e =>
          console.warn(`[compliance-check] Melding-aanmaak mislukt voor ${userId}/${sessie.datum}:`, e.message)
        );

        gedetecteerd++;
      }

      if (reconciliatieKandidaten.length > 0) {
        try {
          const creds = await getIntervalsCredentials(userId);
          if (creds) {
            const kandidaatDatums = reconciliatieKandidaten.map(s => s.datum).sort();

            // Eén call over het volledige kandidaatvenster — GEEN "nieuwste"-
            // reductie zoals cron/sync/route.js:201-203: elke datum in het
            // venster wordt onafhankelijk gecontroleerd op een exacte match.
            const activiteiten = await intervalsGet("/activities", {
              oldest: kandidaatDatums[0],
              newest: kandidaatDatums[kandidaatDatums.length - 1],
              limit: "50",
              fields: "id,start_date_local,type,icu_training_load,icu_zone_times",
            }, creds);

            // Bij meerdere ritten op dezelfde dag: laatst-gestarte wint —
            // zelfde tie-break als ritten[ritten.length - 1] in cron/sync/route.js:203.
            const activiteitenGesorteerd = (activiteiten || [])
              .filter(a => a.type === "Ride" || a.type === "VirtualRide")
              .sort((a, b) => (a.start_date_local || "").localeCompare(b.start_date_local || ""));
            const activiteitPerDatum = new Map();
            for (const a of activiteitenGesorteerd) {
              const datum = a.start_date_local?.split("T")[0];
              if (datum) activiteitPerDatum.set(datum, a);
            }

            for (const kandidaat of reconciliatieKandidaten) {
              const activiteit = activiteitPerDatum.get(kandidaat.datum);
              if (!activiteit) continue;

              const sessietype = kandidaat.intentie?.sessietype ?? kandidaat.type ?? null;
              const record = bepaalComplianceRecord({
                sessietype,
                tssDoel: kandidaat.tss,
                toegestaneZones: kandidaat.intentie?.toegestane_zones,
                icuTrainingLoad: activiteit.icu_training_load,
                icuZoneTimes: activiteit.icu_zone_times,
                activiteitId: activiteit.id,
                verplaatstVan: kandidaat.hrv_verplaatst_van,
                verplaatstNaar: kandidaat.hrv_verplaatst_naar,
                datum: kandidaat.datum,
              });

              await kv.set(`sessie_compliance:${userId}:${kandidaat.datum}`, record, { ex: 365 * 86400 });

              // sessie.voltooid meenemen — anders blijft het plan een
              // sessie als "nog te doen" behandelen (bv. volumeCorrectie.js:499-507)
              // terwijl het compliance-record al correct "volledig"/"verzwakt" toont.
              await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
                const versSessie = versPlan.weekSessies?.sessies?.find(s => s.datum === kandidaat.datum);
                if (versSessie && !versSessie.voltooid) versSessie.voltooid = true;
              });

              gereconcilieerd++;
            }
          }
        } catch (e) {
          console.warn(`[compliance-check] Reconciliatie mislukt voor ${userId}:`, e.message);
        }
      }

      let freezeActief = null;
      try {
        const freezeResultaat = await evalueerComplianceFreeze(userId);
        freezeActief = freezeResultaat.actief;
      } catch (e) {
        console.warn(`[compliance-check] Freeze-evaluatie mislukt voor ${userId}:`, e.message);
      }

      results.push({ userId, status: "ok", gedetecteerd, gereconcilieerd, freezeActief });
    } catch (e) {
      results.push({ userId, status: "error", error: e.message });
    }
  }

  await logCronRun("compliance-check", { startedAt, results }).catch(e => console.warn("[compliance-check] cronrun-log mislukt:", e.message));

  return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() });
}
