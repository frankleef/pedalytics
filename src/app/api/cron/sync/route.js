import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { intervalsGet } from "@/lib/intervals";
import { decrypt } from "@/lib/crypto";
import { datumOffset } from "@/lib/datum";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { sendPush } from "@/lib/pushNotify";
import { verifyQStash } from "@/lib/qstash";
import { verwerkFtpTest, isEindtest } from "@/lib/sessie/ftpUpdate";
import { berekenGemiddeldeUrenPerWeek, berekenStartTss } from "@/lib/rijhistorie";
import { berekenDistributie } from "@/lib/sessie/distributie";
import { checkFaseOvergang, berekenEnCacheDecoupling, bijwerkenDecouplingBaseline, backfillDecoupling } from "@/lib/decoupling";
import { berekenRpeTrend, verwerkRpeTrend } from "@/lib/sessie/rpeTrend";
import { berekenUitvoeringsscoreMetDetails, scoreLabel, zoneTimesNaarObject } from "@/lib/uitvoeringsscore";
import { berekenConditieScore, belastingsStatus, conditieStatus, conditiePillStatus, ctlRampRegressie } from "@/lib/conditie";
import { haalRitTemperatuur, berekenTempBaseline, berekenHitteVlag, migreerHitteTemperatuur } from "@/lib/hitte";
import { herberekenHrvProfiel, checkDataStatus } from "@/lib/hrv/profiel";
import { isWekelijkseCheckVerschuldigd, voerWekelijkseEvaluatieUit, voerHerstelweekEvaluatieUit } from "@/lib/volumeCorrectie";
import { logEvent } from "@/lib/posthog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

// Deze cron-run leest het plan van een gebruiker één keer aan het begin en houdt
// die referentie dan urenlang (relatief) vast over een lange keten van sequentiële
// intervals.icu-aanroepen, om er later meerdere keren delen van terug te schrijven.
// Als de gebruiker in die tussentijd zelf iets opslaat (bv. beschikbaarheid via
// /api/plan PUT), overschrijft een latere kv.set(planKey, plan) hier stilzwijgend
// die wijziging met de verouderde snapshot — een lost-update-race. Elke plek die
// daadwerkelijk terugschrijft haalt daarom via deze helper vlak vóór het schrijven
// een verse kopie op en past alleen zijn eigen specifieke mutatie daarop toe, i.p.v.
// de lang vastgehouden `plan`-variabele blind terug te zetten. `plan` zelf blijft
// elders in dit bestand prima bruikbaar voor beslissingen (lezen), alleen schrijven
// gaat via hier.
async function bijwerkPlanVeilig(kv, planKey, muteer) {
  const versPlan = await kv.get(planKey);
  if (!versPlan) return null;
  muteer(versPlan);
  await kv.set(planKey, versPlan);
  return versPlan;
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

        // Plan één keer lezen per user per sync-run
        const planKey = `${userId}:seizoensplan`;
        const plan = await kv.get(planKey);

        // Eenmalige TSS-migratie: ophalen van icu_training_load voor bestaande events
        const tssMigratieKey = `migratie:tss-bron:${userId}`;
        if (!(await kv.get(tssMigratieKey))) {
          try {
            const sessies = plan?.weekSessies?.sessies || [];
            const bijgewerkteEvents = [];
            for (const s of sessies) {
              if (!s.intervalsEventId || s.tss_bron === "intervals_icu" || s.voltooid) continue;
              try {
                const evt = await intervalsGet(`/events/${s.intervalsEventId}`, {}, { apiKey, athleteId });
                if (evt?.icu_training_load) {
                  bijgewerkteEvents.push({ intervalsEventId: s.intervalsEventId, tss: evt.icu_training_load });
                }
                await new Promise(r => setTimeout(r, 100));
              } catch {}
            }
            if (bijgewerkteEvents.length > 0) {
              await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
                for (const upd of bijgewerkteEvents) {
                  const versSessie = versPlan.weekSessies?.sessies?.find(x => x.intervalsEventId === upd.intervalsEventId);
                  if (versSessie && versSessie.tss_bron !== "intervals_icu") {
                    versSessie.tss = upd.tss;
                    versSessie.tss_bron = "intervals_icu";
                  }
                }
              });
              console.log(`[tss-migratie] ${bijgewerkteEvents.length} sessies bijgewerkt voor ${userId}`);
            }
            await kv.set(tssMigratieKey, true, { ex: 365 * 86400 });
          } catch (e) { console.warn(`[tss-migratie] mislukt voor ${userId}:`, e.message); }
        }

        // FTP-sync: detecteer wijzigingen vanuit intervals.icu
        try {
          const athleteResp = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}`, {
            headers: { Authorization: `Basic ${Buffer.from("API_KEY:" + apiKey).toString("base64")}` },
          });
          if (athleteResp.ok) {
            const athlete = await athleteResp.json();
            const rideSport = (athlete.sportSettings || []).find(s => s.types?.includes("Ride"));
            const ftpVanIntervals = rideSport?.ftp ?? null;
            const ftpInPlan = plan?.huidige_ftp ?? null;
            if (ftpVanIntervals && ftpInPlan && Math.abs(ftpVanIntervals - ftpInPlan) > 1) {
              console.log(`[ftp-sync] ${userId}: ${ftpInPlan}W → ${ftpVanIntervals}W`);
              await verwerkFtpTest(userId, { icu_ftp: ftpVanIntervals });
            }
          }
        } catch (e) { console.warn(`[ftp-sync] Check mislukt voor ${userId}:`, e.message); }

        // Wekelijkse HRV-profielherberekening (maandag)
        if (new Date().getDay() === 1) {
          try {
            const wellOldest90 = datumOffset(-90);
            const wellData90 = await intervalsGet("/wellness", { oldest: wellOldest90, newest: datumOffset(0) }, { apiKey, athleteId });
            if (wellData90?.length >= 14) {
              const genormaliseerd = wellData90.map(w => ({ ...w, datum: w.id || w.datum }));
              const huidigProfiel = await kv.get(`hrv-profiel:${userId}`);
              const bestaand = typeof huidigProfiel === "string" ? JSON.parse(huidigProfiel) : huidigProfiel;
              const nieuwProfiel = herberekenHrvProfiel(genormaliseerd, bestaand);
              const statusCheck = checkDataStatus(genormaliseerd, bestaand);
              await kv.set(`hrv-profiel:${userId}`, { ...(bestaand || {}), ...nieuwProfiel, ...statusCheck });

              if (statusCheck.modus_overgang) {
                const notKey = `hrv-profiel-modus-notificatie-gestuurd:${userId}`;
                if (!(await kv.get(notKey))) {
                  await sendPush(userId, { title: "Je HRV-profiel is gepersonaliseerd", body: "Adviezen worden voortaan afgestemd op jouw persoonlijke herstelpatroon.", url: "/" });
                  await kv.set(notKey, "1");
                }
              }
              console.log(`[sync] HRV-profiel bijgewerkt voor ${userId}: modus=${nieuwProfiel.modus}, basislijn=${nieuwProfiel.basislijn_28d}`);
            }
          } catch (e) { console.warn(`[sync] HRV-profiel herberekening mislukt voor ${userId}:`, e.message); }
        }

        const lastActivity = await kv.get(`user:${userId}:last_activity`);
        const oldest = lastActivity?.datum_iso || datumOffset(-3);

        const activities = await intervalsGet("/activities", {
          oldest,
          newest: datumOffset(0),
          limit: "10",
          fields: "id,start_date_local,type,icu_training_load,moving_time,icu_weighted_avg_watts,icu_rpe,icu_intensity,icu_zone_times",
        }, { apiKey, athleteId });

        const ritten = (activities || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");

        if (ritten.length === 0) {
          // Wekelijkse volume-evaluatie ook zonder nieuwe rit
          try {
            if (await isWekelijkseCheckVerschuldigd(userId)) {
              if (plan?.kader && plan?.startdatum) {
                const huidigeWeekNr = weeknummerVoorDatum(new Date(), plan.startdatum);
                const huidigeKaderWeek = plan.kader?.find(w => w.week === huidigeWeekNr);
                if (huidigeKaderWeek?.weektype === "herstel") {
                  await voerHerstelweekEvaluatieUit(userId);
                } else {
                  await voerWekelijkseEvaluatieUit(userId);
                }
              }
            }
          } catch (e) { console.warn(`[sync] Volume-evaluatie mislukt voor ${userId}:`, e.message); }
          results.push({ userId, status: "no_new" });
          continue;
        }

        // Sorteer op datum (nieuwste laatst) — intervals.icu volgorde is niet gegarandeerd
        ritten.sort((a, b) => (a.start_date_local || "").localeCompare(b.start_date_local || ""));
        const nieuwste = ritten[ritten.length - 1];

        // Idempotent: skip als we deze al kennen
        if (lastActivity?.id === nieuwste.id) {
          // Herbereken conditiescore met verse wellness-data, ook zonder nieuwe rit
          try {
            if (plan) {
              const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0) }, { apiKey, athleteId });
              let ctlNu = null, ctl4wGeleden = null, ctlRamp = null;
              if (wellData?.length >= 7) {
                const ctlW = wellData.filter(w => w.ctl != null).sort((a,b) => (a.id||"").localeCompare(b.id||""));
                ctlNu = ctlW.length > 0 ? ctlW[ctlW.length - 1].ctl : null;
                ctl4wGeleden = ctlW.length > 0 ? ctlW[0].ctl : null;
                ctlRamp = ctlRampRegressie(ctlW.map(w => w.ctl));
              }
              const rpeTrend = await kv.get(`rpe_trend:${userId}`);
              const gereedheidsscore = 50;
              // Decoupling medianen voor conditiescore: GEEN filter (ruwe waarden)
              let dcHuidigUp = null, dcVorigUp = null;
              try {
                const actResp = await intervalsGet("/activities", { oldest: datumOffset(-60), newest: datumOffset(0), limit: "30", fields: "id,type,start_date_local" }, { apiKey, athleteId });
                const dcAlleWaarden = [];
                const rittenGesorteerd = (actResp || []).filter(a => a.type === "Ride" || a.type === "VirtualRide").sort((a, b) => (a.start_date_local || "").localeCompare(b.start_date_local || ""));
                for (const a of rittenGesorteerd) {
                  const dc = await kv.get(`decoupling:${a.id}`);
                  if (dc == null) continue;
                  const w = typeof dc === "number" ? dc : dc?.decoupling;
                  if (w != null) dcAlleWaarden.push(w);
                }
                if (dcAlleWaarden.length >= 3) dcHuidigUp = dcAlleWaarden.slice(-3).sort((a,b)=>a-b)[1];
                if (dcAlleWaarden.length >= 6) dcVorigUp = dcAlleWaarden.slice(-6, -3).sort((a,b)=>a-b)[1];
              } catch {}
              const score = berekenConditieScore({ ctl_nu: ctlNu, ctl_4w_geleden: ctl4wGeleden, rpe_delta_trend: rpeTrend ?? null, decoupling_huidig: dcHuidigUp, decoupling_vorig: dcVorigUp });
              const belasting = belastingsStatus(ctlRamp ?? 0, gereedheidsscore);
              const conditie = conditieStatus(score);
              const pill = conditiePillStatus(belasting, conditie);
              await kv.set(`conditie_score:${userId}`, { score, belasting, conditie, pill, ctl_nu: ctlNu, ctl_4w_geleden: ctl4wGeleden, ctl_ramp: ctlRamp, rpe_delta_trend: rpeTrend, bijgewerkt_op: new Date().toISOString() }, { ex: 8 * 86400 });
            }
          } catch (e) { console.warn(`[sync] Conditiescore mislukt:`, e.message); }

          // Wekelijkse volume-evaluatie ook in idempotent pad
          try {
            if (await isWekelijkseCheckVerschuldigd(userId)) {
              if (plan?.kader && plan?.startdatum) {
                const huidigeWeekNr = weeknummerVoorDatum(new Date(), plan.startdatum);
                const huidigeKaderWeek = plan.kader?.find(w => w.week === huidigeWeekNr);
                if (huidigeKaderWeek?.weektype === "herstel") {
                  await voerHerstelweekEvaluatieUit(userId);
                } else {
                  await voerWekelijkseEvaluatieUit(userId);
                }
              }
            }
          } catch (e) { console.warn(`[sync] Volume-evaluatie mislukt voor ${userId}:`, e.message); }

          results.push({ userId, status: "up_to_date" });
          continue;
        }

        await kv.set(`user:${userId}:last_activity`, {
          id: nieuwste.id,
          datum_iso: nieuwste.start_date_local?.split("T")[0],
          checkedAt: new Date().toISOString(),
        });

        // Migratie: start_profiel toevoegen als het ontbreekt
        if (plan && !plan.start_profiel) {
          try {
            const urenPerWeek = berekenGemiddeldeUrenPerWeek(ritten);
            const ctlHuidig = ritten.length > 0 ? (ritten[ritten.length - 1].icu_training_load || null) : null;
            const startProfielData = {
              historisch_uren_per_week: urenPerWeek ? Math.round(urenPerWeek * 10) / 10 : null,
              ctl_bij_start: ctlHuidig ? Math.round(ctlHuidig) : null,
              gewicht_kg: null,
              start_tss_week: berekenStartTss(urenPerWeek, ctlHuidig),
              w_per_kg: null,
              gemigreerd: true,
              migratie_datum: new Date().toISOString(),
            };
            const versPlan = await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
              if (!versPlan.start_profiel) versPlan.start_profiel = startProfielData;
            });
            if (versPlan) console.log(`[sync] start_profiel gemigreerd voor ${userId}: TSS ${versPlan.start_profiel.start_tss_week}`);
          } catch (e) {
            console.warn(`[sync] start_profiel migratie mislukt voor ${userId}:`, e.message);
          }
        }

        // Eenmalige decoupling backfill
        const bfVoltooid = await kv.get(`decoupling_backfill_voltooid:${userId}`);
        const bfGestart = await kv.get(`decoupling_backfill_gestart:${userId}`);
        if (!bfVoltooid && !bfGestart) {
          backfillDecoupling(userId, plan?.huidige_ftp || 265, apiKey, athleteId).catch(e => console.warn(`[sync] Backfill mislukt:`, e.message));
        }

        if (plan?.weekSessies?.sessies) {
          const ritDatum = nieuwste.start_date_local?.split("T")[0];
          const sessie = plan.weekSessies.sessies.find(s => s.datum === ritDatum);

          // Markeer sessie als voltooid + bereken uitvoeringsscore
          if (sessie && !sessie.voltooid) {
            let scoreData = null;

            // Bereken uitvoeringsscore alleen voor geplande ritten
            if (sessie.intentie) {
              try {
                const ftp = plan.huidige_ftp || 265;
                const tijdInZones = zoneTimesNaarObject(nieuwste.icu_zone_times);
                const rawIf = nieuwste.icu_intensity
                  ?? (nieuwste.icu_weighted_avg_watts && ftp ? nieuwste.icu_weighted_avg_watts / ftp : null);
                const ifWaarde = rawIf != null ? (rawIf > 2 ? rawIf / 100 : rawIf) : null;

                const resultaat = berekenUitvoeringsscoreMetDetails(
                  {
                    moving_time: nieuwste.moving_time,
                    icu_training_load: nieuwste.icu_training_load,
                    icu_intensity: ifWaarde,
                    icu_time_in_zone: tijdInZones,
                  },
                  {
                    duur_seconden: sessie.duur_min ? sessie.duur_min * 60 : null,
                    tss_doel: sessie.tss || null,
                  },
                  sessie.intentie
                );

                if (resultaat !== null) {
                  scoreData = { ...resultaat, activiteitId: nieuwste.id, berekendOp: new Date().toISOString() };
                  await kv.set(`uitvoering:${userId}:${nieuwste.id}`, scoreData, { ex: 365 * 86400 });
                }
              } catch (e) {
                console.warn(`[sync] Uitvoeringsscore mislukt voor ${userId}/${nieuwste.id}:`, e.message);
              }
            }

            await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
              const versSessie = versPlan.weekSessies?.sessies?.find(s => s.datum === ritDatum);
              if (versSessie && !versSessie.voltooid) {
                versSessie.voltooid = true;
                if (scoreData) versSessie.uitvoeringsScore = scoreData;
              }
            });
            sessie.voltooid = true; // lokale referentie ook bijwerken voor de rest van dit blok

            logEvent("sessie_voltooid", userId, {
              uitvoeringsscore: scoreData?.score ?? null,
              rpe: nieuwste.icu_rpe ?? null,
              tss_werkelijk: nieuwste.icu_training_load ?? null,
              tss_doel: sessie.tss ?? null,
              archetype_id: sessie.archetype_id ?? null,
            });
          }
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

            // Sectie 51-C: eindtest (laatste week — seizoen_afgerond + samenvattingskaart
            // + push, ongewijzigd t.o.v. vóór deze wijziging) vs. tussentest (elke andere
            // week met rol ftp_test — de FTP-update + scoped herberekening van toekomstige
            // vermogensbereiken is hierboven via verwerkFtpTest al gebeurd, voor beide
            // gevallen identiek; hier volgt alleen nog de eindtest-specifieke afronding).
            if (sessie.intentie.sessietype === "ramp_test" && !plan.seizoen_afgerond) {
              const huidigeWeek = plan.startdatum ? weeknummerVoorDatum(new Date(), plan.startdatum) : 1;
              if (isEindtest(huidigeWeek, plan.tijdshorizon_weken)) {
                await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
                  if (versPlan.seizoen_afgerond) return; // al afgerond (concurrent), niet opnieuw
                  if (!versPlan.start_ftp) {
                    const oudsteFtp = (versPlan.ftp_historie || []).sort((a, b) => a.datum.localeCompare(b.datum))[0];
                    if (oudsteFtp) versPlan.start_ftp = oudsteFtp.ftp;
                    else if (versPlan.seizoensdoel?.doel_ftp) versPlan.start_ftp = versPlan.seizoensdoel.doel_ftp;
                  }
                  versPlan.seizoen_afgerond = true;
                });
                await sendPush(userId, {
                  title: "Seizoen afgerond",
                  body: "Je eindtest is binnen. Bekijk je resultaten en start een nieuw seizoen.",
                  url: "/",
                });
                console.log(`[sync] Seizoen afgerond voor ${userId}`);
              } else {
                console.log(`[sync] Tussentijdse FTP-test verwerkt voor ${userId} (week ${huidigeWeek}/${plan.tijdshorizon_weken || 13}) — geen seizoensafronding`);
              }
            }
          }

          // Decoupling cachen voor Z2-duurritten (>45 min) + hitte-detectie
          for (const rit of ritten) {
            const duurMin = (rit.moving_time || 0) / 60;
            if (duurMin < 45) continue;
            const np = rit.icu_weighted_avg_watts;
            const ritFtp = plan.huidige_ftp || 265;
            if (!np || (np / ritFtp) < 0.55 || (np / ritFtp) > 0.75) continue;
            const alCached = await kv.get(`decoupling:${rit.id}`);
            if (alCached !== null && alCached !== undefined) continue;

            // Hitte-detectie met persoonlijke baseline
            let apparent_temp_celsius = null;
            let temp_baseline = null;
            let hitte_gecorrigeerd = false;
            try {
              const tempResult = await haalRitTemperatuur(userId, rit.start_date_local, Math.round(duurMin));
              apparent_temp_celsius = tempResult.apparent_temp_celsius;
              // Baseline berekenen uit bestaande entries, exclusief de huidige rit
              const alleEntries = [];
              for (const r of ritten) {
                const entry = await kv.get(`decoupling:${r.id}`);
                if (entry && typeof entry === "object" && entry.startTijd) alleEntries.push({ ...entry, ritId: r.id });
              }
              temp_baseline = berekenTempBaseline(alleEntries, rit.id);
              hitte_gecorrigeerd = berekenHitteVlag(apparent_temp_celsius, temp_baseline);
            } catch {}

            try {
              const streams = await fetch(`https://intervals.icu/api/v1/activity/${rit.id}/streams?types=watts,heartrate`, {
                headers: { Authorization: "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64") },
              }).then(r => r.json());
              const wattsArr = (Array.isArray(streams) ? streams.find(s => s.type === "watts") : streams?.watts)?.data || [];
              const hrArr = (Array.isArray(streams) ? streams.find(s => s.type === "heartrate") : streams?.heartrate)?.data || [];
              berekenEnCacheDecoupling(rit.id, wattsArr, hrArr)
                .then(async (dc) => {
                  if (dc != null) {
                    await kv.set(`decoupling:${rit.id}`, { decoupling: dc, apparent_temp_celsius, temp_baseline, hitte_gecorrigeerd, startTijd: rit.start_date_local, duurMinuten: Math.round(duurMin), userId });
                  }
                  await bijwerkenDecouplingBaseline(userId).catch(() => {});
                  if (temp_baseline != null) {
                    await kv.set(`temp_baseline:${userId}`, temp_baseline, { ex: 90 * 86400 });
                  }
                })
                .catch(e => console.warn(`[sync] Decoupling cache mislukt:`, e.message));
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

          // Adaptatie-score berekenen
          try {
            const rpeTrend = await kv.get(`rpe_trend:${userId}`);

            // HRV: 3d vs 28d uit intervals.icu wellness
            let hrv7d = null, hrv28d = null, ctlRamp = null;
            try {
              const wellOldest = datumOffset(-28);
              const wellData = await intervalsGet("/wellness", { oldest: wellOldest, newest: datumOffset(0) }, { apiKey, athleteId });
              if (wellData?.length >= 7) {
                const hrvWaarden = wellData.filter(w => w.hrv).map(w => w.hrv);
                if (hrvWaarden.length >= 7) {
                  hrv7d = hrvWaarden.slice(-7).reduce((a, b) => a + b, 0) / 7;
                  hrv28d = hrvWaarden.reduce((a, b) => a + b, 0) / hrvWaarden.length;
                }
                const ctlWaarden = wellData.filter(w => w.ctl != null).sort((a, b) => (a.id || "").localeCompare(b.id || ""));
                ctlRamp = ctlRampRegressie(ctlWaarden.map(w => w.ctl));
              }
            } catch (e) {
              console.warn(`[sync] Wellness voor adaptatie mislukt:`, e.message);
            }

            // Decoupling medianen voor conditiescore: GEEN filter (ruwe waarden, spec 32-F)
            const dcAlleEntries = [];
            for (const rit of ritten) {
              const dc = await kv.get(`decoupling:${rit.id}`);
              if (dc == null) continue;
              const waarde = typeof dc === "number" ? dc : dc?.decoupling;
              const isHitte = typeof dc === "object" && (dc?.hitte_gecorrigeerd ?? false);
              if (waarde != null) dcAlleEntries.push({ waarde, isHitte });
            }
            const dcAlleWaarden = dcAlleEntries.map(e => e.waarde);
            const dcHuidig = dcAlleWaarden.length >= 3 ? dcAlleWaarden.slice(-3).sort((a,b)=>a-b)[1] : null;
            const dcVorig = dcAlleWaarden.length >= 6 ? dcAlleWaarden.slice(-6, -3).sort((a,b)=>a-b)[1] : null;

            // >50% hitte-fallback (spec 32-F): informatiemelding als decoupling-trend onbetrouwbaar
            const laatste6 = dcAlleEntries.slice(-6);
            const hitteAandeel = laatste6.length > 0 ? laatste6.filter(e => e.isHitte).length / laatste6.length : 0;
            if (laatste6.length >= 6 && hitteAandeel > 0.5) {
              await kv.set(`conditie-hitte-melding:${userId}`, true, { ex: 14 * 86400 });
            } else {
              await kv.del(`conditie-hitte-melding:${userId}`).catch(() => {});
            }

            // CTL 4 weken geleden
            let ctlNu = null, ctl4wGeleden = null;
            try {
              const wellAll = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0) }, { apiKey, athleteId });
              const ctlAll = (wellAll || []).filter(w => w.ctl != null).sort((a,b) => (a.id||"").localeCompare(b.id||""));
              if (ctlAll.length > 0) { ctlNu = ctlAll[ctlAll.length - 1].ctl; ctl4wGeleden = ctlAll[0].ctl; }
            } catch {}

            const gereedheidsscore = 50; // TODO: lezen uit KV als beschikbaar
            const condScore = berekenConditieScore({ ctl_nu: ctlNu, ctl_4w_geleden: ctl4wGeleden, rpe_delta_trend: rpeTrend ?? null, decoupling_huidig: dcHuidig, decoupling_vorig: dcVorig });
            const belasting = belastingsStatus(ctlRamp ?? 0, gereedheidsscore);
            const conditie = conditieStatus(condScore);
            const pill = conditiePillStatus(belasting, conditie);
            await kv.set(`conditie_score:${userId}`, { score: condScore, belasting, conditie, pill, ctl_nu: ctlNu, ctl_4w_geleden: ctl4wGeleden, ctl_ramp: ctlRamp, rpe_delta_trend: rpeTrend, bijgewerkt_op: new Date().toISOString() }, { ex: 8 * 86400 });
          } catch (e) {
            console.warn(`[sync] Conditiescore mislukt voor ${userId}:`, e.message);
          }

          // VO2max-suggestie evaluatie (wekelijks, alleen bij doel=ftp, week>=5)
          try {
            const vo2maxStatus = await kv.get(`vo2max_suggestie_status:${userId}`);
            if (!vo2maxStatus || vo2maxStatus === "geen") {
              const doelType = plan.seizoensdoel?.type || plan.doel || "ftp";
              const wkNr = plan.startdatum ? weeknummerVoorDatum(new Date(), plan.startdatum) : 1;
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
            const weekNr = plan.startdatum ? weeknummerVoorDatum(new Date(), plan.startdatum) : 1;
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
                  // 1. Filter hitte-ritten (spec 32-F)
                  // 2. Filter uitschieters als extra laag (>12% of IQR)
                  const { isDecouplingUitschieter } = await import("@/lib/conditie");
                  const dcFaseAlleWaarden = [];
                  for (const rit of z2Ritten) {
                    const dc = await kv.get(`decoupling:${rit.id}`);
                    if (dc == null) continue;
                    const waarde = typeof dc === "number" ? dc : dc?.decoupling;
                    const isHitte = typeof dc === "object" && (dc?.hitte_gecorrigeerd ?? false);
                    if (waarde != null && !isHitte) dcFaseAlleWaarden.push(waarde);
                  }
                  for (const w of dcFaseAlleWaarden) {
                    if (!isDecouplingUitschieter(w, dcFaseAlleWaarden)) decouplingWaarden.push(w);
                  }

                  if (decouplingWaarden.length >= 2) {
                    const aantalVerlengingen = plan.fase_verlengd_count || 0;
                    const { uitstel, mediaan } = checkFaseOvergang(decouplingWaarden, aantalVerlengingen);

                    if (uitstel) {
                      console.log(`[sync] Fase-overgang uitgesteld voor ${userId}: mediaan decoupling ${mediaan}%`);

                      await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
                        versPlan.fase_verlengd_count = (versPlan.fase_verlengd_count || 0) + 1;
                        versPlan.fase_verlengd = true;

                        // Verschuif kader: voeg extra opbouwweek in vóór de herstelweek
                        if (versPlan.kader) {
                          const herstelIdx = versPlan.kader.findIndex((w, i) => i >= weekNr - 1 && w.weektype === "herstel");
                          if (herstelIdx > 0) {
                            const vorigeWeek = versPlan.kader[herstelIdx - 1];
                            const extraWeek = {
                              ...vorigeWeek,
                              week: vorigeWeek.week + 0.5,
                              tss_doel: vorigeWeek.tss_doel,
                              fase: vorigeWeek.fase,
                              weektype: "opbouw",
                            };
                            versPlan.kader.splice(herstelIdx, 0, extraWeek);
                            // Hernummer alle weken na de invoeging
                            for (let k = 0; k < versPlan.kader.length; k++) {
                              versPlan.kader[k].week = k + 1;
                            }
                            versPlan.tijdshorizon_weken = versPlan.kader.length;
                          }
                        }
                      });

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

        // Push-notificatie bij nieuwe rit met deep link naar RPE-invoer
        const ritDatumPush = nieuwste.start_date_local?.split("T")[0];
        await sendPush(userId, {
          title: "Rit gesynchroniseerd ✓",
          body: "Hoe voelde het? Vul je RPE in.",
          url: `/?tab=schema&datum=${ritDatumPush}&rpe=1`,
        });

        // Wekelijkse volume-evaluatie (sectie 38)
        try {
          if (await isWekelijkseCheckVerschuldigd(userId)) {
            if (plan?.kader && plan?.startdatum) {
              const dagenSindsStart = Math.max(0, (Date.now() - new Date(plan.startdatum).getTime()) / 86400000);
              const huidigeWeekNr = Math.max(1, Math.ceil(dagenSindsStart / 7));
              const huidigeKaderWeek = plan.kader?.find(w => w.week === huidigeWeekNr);
              if (huidigeKaderWeek?.weektype === "herstel") {
                await voerHerstelweekEvaluatieUit(userId);
              } else {
                await voerWekelijkseEvaluatieUit(userId);
              }
            }
          }
        } catch (e) {
          console.warn(`[sync] Volume-evaluatie mislukt voor ${userId}:`, e.message);
        }

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
