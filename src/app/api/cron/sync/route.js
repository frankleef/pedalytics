import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { intervalsGet } from "@/lib/intervals";
import { decrypt } from "@/lib/crypto";
import { datumOffset } from "@/lib/datum";
import { sendPush } from "@/lib/pushNotify";
import { verifyQStash } from "@/lib/qstash";
import { verwerkFtpTest } from "@/lib/sessie/ftpUpdate";
import { berekenDistributie } from "@/lib/sessie/distributie";
import { checkFaseOvergang, berekenEnCacheDecoupling } from "@/lib/decoupling";
import { berekenRpeTrend, verwerkRpeTrend } from "@/lib/sessie/rpeTrend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

export async function POST(request) {
  const geldig = await verifyQStash(request);
  if (!geldig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kv = getKV();
  const results = [];

  try {
    const userIds = (await kv.get("users:active")) || [];

    for (const userId of userIds) {
      try {
        const [encKey, athleteId] = await kv.mget(`user:${userId}:intervals_key`, `user:${userId}:athlete_id`);
        if (!encKey || !athleteId) continue;

        const apiKey = decrypt(encKey);
        const lastActivity = await kv.get(`user:${userId}:last_activity`);
        const oldest = lastActivity?.datum_iso || datumOffset(-3);

        const activities = await intervalsGet("/activities", {
          oldest,
          newest: datumOffset(0),
          limit: "10",
          fields: "id,start_date_local,type,icu_training_load,moving_time,icu_weighted_avg_watts",
        }, { apiKey, athleteId });

        const ritten = (activities || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");

        if (ritten.length === 0) {
          results.push({ userId, status: "no_new" });
          continue;
        }

        const nieuwste = ritten[ritten.length - 1];

        // Idempotent: skip als we deze al kennen
        if (lastActivity?.id === nieuwste.id) {
          results.push({ userId, status: "up_to_date" });
          continue;
        }

        await kv.set(`user:${userId}:last_activity`, {
          id: nieuwste.id,
          datum_iso: nieuwste.start_date_local?.split("T")[0],
          checkedAt: new Date().toISOString(),
        });

        // Check of nieuwste rit een FTP-test was
        const plan = await kv.get(`${userId}:seizoensplan`);
        if (plan?.weekSessies?.sessies) {
          const ritDatum = nieuwste.start_date_local?.split("T")[0];
          const sessie = plan.weekSessies.sessies.find(s => s.datum === ritDatum);
          if (sessie?.intentie?.rol === "ftp_test") {
            try {
              const fullActivity = await intervalsGet(`/activities/${nieuwste.id}`, {}, { apiKey, athleteId });
              const ftpResult = await verwerkFtpTest(userId, fullActivity);
              if (ftpResult.updated) {
                await sendPush(userId, {
                  title: "FTP bijgewerkt",
                  body: `Je FTP is bijgewerkt naar ${ftpResult.newFtp}W — je toekomstige trainingen zijn aangepast.`,
                  url: "/",
                });
              }
            } catch (e) {
              console.warn(`[sync] FTP-test verwerking mislukt voor ${userId}:`, e.message);
            }
          }

          // Decoupling cachen voor Z2-duurritten (>45 min)
          for (const rit of ritten) {
            const duurMin = (rit.moving_time || 0) / 60;
            if (duurMin < 45) continue;
            const np = rit.icu_weighted_avg_watts;
            const ritFtp = plan.huidige_ftp || 265;
            if (!np || (np / ritFtp) < 0.55 || (np / ritFtp) > 0.75) continue;
            const alCached = await kv.get(`decoupling:${rit.id}`);
            if (alCached !== null && alCached !== undefined) continue;
            try {
              const streams = await fetch(`https://intervals.icu/api/v1/activity/${rit.id}/streams?types=watts,heartrate`, {
                headers: { Authorization: "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64") },
              }).then(r => r.json());
              const wattsArr = (Array.isArray(streams) ? streams.find(s => s.type === "watts") : streams?.watts)?.data || [];
              const hrArr = (Array.isArray(streams) ? streams.find(s => s.type === "heartrate") : streams?.heartrate)?.data || [];
              berekenEnCacheDecoupling(rit.id, wattsArr, hrArr).catch(e => console.warn(`[sync] Decoupling cache mislukt:`, e.message));
            } catch (e) {
              console.warn(`[sync] Streams ophalen mislukt voor rit ${rit.id}:`, e.message);
            }
          }

          // Wekelijkse distributie-check
          const veertienDagenGeleden = datumOffset(-14);
          const recenteRitten = ritten.filter(r => (r.start_date_local?.split("T")[0] || "") >= veertienDagenGeleden);
          if (recenteRitten.length >= 3) {
            try {
              await berekenDistributie(userId, recenteRitten, plan.ervaringsniveau || "recreatief");
            } catch (e) {
              console.warn(`[sync] Distributie-berekening mislukt voor ${userId}:`, e.message);
            }
          }

          // RPE-trend check
          try {
            const trend = await berekenRpeTrend(userId);
            if (trend !== null) {
              const actie = await verwerkRpeTrend(userId, trend);
              if (actie === "overbelasting") {
                await sendPush(userId, {
                  title: "Plan aangepast",
                  body: "Je trainingen voelen zwaarder aan dan ze zouden moeten. We hebben de komende sessies iets teruggeschroefd.",
                  url: "/",
                });
              }
            }
          } catch (e) {
            console.warn(`[sync] RPE-trend check mislukt voor ${userId}:`, e.message);
          }

          // VO2max-suggestie evaluatie (wekelijks, alleen bij doel=ftp, week>=5)
          try {
            const vo2maxStatus = await kv.get(`vo2max_suggestie_status:${userId}`);
            if (!vo2maxStatus || vo2maxStatus === "geen") {
              const doelType = plan.seizoensdoel?.type || plan.doel || "ftp";
              const wkNr = plan.startdatum ? Math.max(1, Math.ceil((Date.now() - new Date(plan.startdatum).getTime()) / 86400000 / 7)) : 1;
              if (doelType === "ftp" && wkNr >= 5) {
                const { evalueerVo2maxSuggestie } = await import("@/lib/plan/vo2maxDetectie");
                const suggestie = await evalueerVo2maxSuggestie(userId);
                if (suggestie.suggereer) {
                  await kv.set(`vo2max_suggestie_status:${userId}`, "getoond");
                  await kv.set(`vo2max_suggestie_details:${userId}`, suggestie.details);
                  console.log(`[sync] VO2max-suggestie getoond voor ${userId}`);
                }
              }
            }
          } catch (e) {
            console.warn(`[sync] VO2max-suggestie check mislukt voor ${userId}:`, e.message);
          }

          // Fase-overgang check via cardiac decoupling (bouwstuk 8b)
          if (plan.kader) {
            const dagenSindsStart = plan.startdatum ? Math.max(0, (Date.now() - new Date(plan.startdatum).getTime()) / 86400000) : 0;
            const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
            const isLaatsteOpbouwWeek = weekNr % 4 === 3;

            if (isLaatsteOpbouwWeek) {
              try {
                const decouplingWaarden = [];
                const cached = await kv.get(`decoupling_check:${userId}:${weekNr}`);
                if (!cached) {
                  // Haal Z2-duurritten van afgelopen 3 weken
                  const drieWekenGeleden = datumOffset(-21);
                  const z2Ritten = ritten.filter(r => {
                    const d = r.start_date_local?.split("T")[0] || "";
                    return d >= drieWekenGeleden;
                  });
                  // Gebruik decoupling-waarden uit KV cache
                  for (const rit of z2Ritten) {
                    const dc = await kv.get(`decoupling:${rit.id}`);
                    if (dc !== null && dc !== undefined) decouplingWaarden.push(dc);
                  }

                  if (decouplingWaarden.length >= 2) {
                    const aantalVerlengingen = plan.fase_verlengd_count || 0;
                    const { uitstel, mediaan } = checkFaseOvergang(decouplingWaarden, aantalVerlengingen);

                    if (uitstel) {
                      console.log(`[sync] Fase-overgang uitgesteld voor ${userId}: mediaan decoupling ${mediaan}%`);
                      plan.fase_verlengd_count = aantalVerlengingen + 1;
                      plan.fase_verlengd = true;

                      // Verschuif kader: voeg extra opbouwweek in vóór de herstelweek
                      if (plan.kader) {
                        const herstelIdx = plan.kader.findIndex((w, i) => i >= weekNr - 1 && w.weektype === "herstel");
                        if (herstelIdx > 0) {
                          const vorigeWeek = plan.kader[herstelIdx - 1];
                          const extraWeek = {
                            ...vorigeWeek,
                            week: vorigeWeek.week + 0.5,
                            tss_doel: vorigeWeek.tss_doel,
                            fase: vorigeWeek.fase,
                            weektype: "opbouw",
                          };
                          plan.kader.splice(herstelIdx, 0, extraWeek);
                          // Hernummer alle weken na de invoeging
                          for (let k = 0; k < plan.kader.length; k++) {
                            plan.kader[k].week = k + 1;
                          }
                          plan.tijdshorizon_weken = plan.kader.length;
                        }
                      }

                      await kv.set(planKey, plan);

                      await sendPush(userId, {
                        title: "Extra opbouwweek",
                        body: "Je aerobe basis is nog in ontwikkeling — we geven je een extra week voordat we de belasting verhogen.",
                        url: "/",
                      });
                    }

                    await kv.set(`decoupling_check:${userId}:${weekNr}`, { mediaan, uitstel }, { ex: 14 * 86400 });
                  }
                }
              } catch (e) {
                console.warn(`[sync] Fase-overgang check mislukt voor ${userId}:`, e.message);
              }
            }
          }
        }

        // Push-notificatie bij nieuwe rit
        await sendPush(userId, {
          title: "Nieuwe rit gedetecteerd",
          body: `Je rit van ${nieuwste.start_date_local?.split("T")[0]} is verwerkt`,
          url: "/",
        });

        results.push({ userId, status: "new_activity", id: nieuwste.id });
      } catch (e) {
        results.push({ userId, status: "error", error: e.message });
      }
    }

    return NextResponse.json({ success: true, results, checkedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
