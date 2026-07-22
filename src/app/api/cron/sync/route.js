import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { bijwerkPlanVeilig } from "@/lib/plan/bijwerkPlanVeilig";
import { voegExtraWeekToe, verwijderSessiesVanafWeek } from "@/lib/seizoen/faseVerlenging";
import { intervalsGet, intervalsDelete } from "@/lib/intervals";
import { decrypt } from "@/lib/crypto";
import { datumOffset } from "@/lib/datum";
import { weeknummerVoorDatum, haalFaseGebondenTeller, hoogFaseGebondenTellerOp } from "@/lib/weekgrenzen";
import { sendPush } from "@/lib/pushNotify";
import { verifyQStash } from "@/lib/qstash";
import { verwerkFtpTest, isEindtest } from "@/lib/sessie/ftpUpdate";
import { voegCpWprimeDatapuntToe } from "@/lib/cpWprime";
import { berekenGemiddeldeUrenPerWeek, berekenStartTss } from "@/lib/rijhistorie";
import { berekenDistributie } from "@/lib/sessie/distributie";
import { checkFaseOvergang, cacheDecoupling, bijwerkenDecouplingBaseline, backfillDecoupling, isDecouplingUitschieter } from "@/lib/decoupling";
import { verwerkRitVoorEf, backfillEf } from "@/lib/ef";
import { haalWattsStream, detecteerMogelijkeInstorting } from "@/lib/instorting";
import { waitUntil } from "@vercel/functions";
import { berekenRpeTrend, verwerkRpeTrend } from "@/lib/sessie/rpeTrend";
import { berekenUitvoeringsscoreMetDetails, scoreLabel, zoneTimesNaarObject } from "@/lib/uitvoeringsscore";
import { bepaalComplianceRecord, evalueerComplianceGate, haalLaatsteZwareSessieDatum } from "@/lib/sessie/compliance";
import { haalRitTemperatuur, berekenTempBaseline, berekenHitteVlag } from "@/lib/hitte";
import { herberekenHrvProfiel, checkDataStatus, berekenRhrBasislijn } from "@/lib/hrv/profiel";
import { herberekenGewichtenHrvCheckin } from "@/lib/hrv/leerdata";
import { voegHrvTrendPuntToe, voegRhrTrendPuntToe } from "@/lib/hrv/basislijnTrend";
import { berekenSchoneReferentie, berekenHerstelDagen } from "@/lib/hrv/herstelsnelheid";
import { isWekelijkseCheckVerschuldigd, voerWekelijkseEvaluatieUit, voerHerstelweekEvaluatieUit } from "@/lib/volumeCorrectie";
import { berekenEnSlaFitnessprogressieOp } from "@/lib/fitnessprogressieIO";
import { logEvent } from "@/lib/posthog";
import { logCronRun } from "@/lib/cronLog";
import { maakMelding } from "@/lib/meldingen";

// Fallback zolang er nog geen (of te weinig) geleerde checkin-gewichten zijn —
// zelfde defaults als voorheen hardcoded in api/admin/herbereken-hrv-profiel.
const DEFAULT_HRV_CHECKIN_GEWICHTEN = { hrv: 0.65, checkin: 0.35, observaties: 0, gepersonaliseerd: false };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Gebruik POST (via QStash)" }, { status: 405 });
}

// Compliance-dedupgate-lezing + evalueerComplianceGate-aanroep + cache-write-
// bij-uitstel (FIX 1: "alleen cachen bij trigger") — de EVALUATIE-slice, los
// van de guard/schrijf-afhandeling die per aanroeper (helper hieronder resp.
// het volledige pad) apart blijft. Puur wat betreft plan/KV-lezen: geen
// bijwerkPlanVeilig, geen voegExtraWeekToe, geen melding.
export async function evalueerComplianceUitstel(kv, userId, plan, weekNr) {
  const complianceCached = await kv.get(`compliance_check:${userId}:${weekNr}`);
  if (complianceCached) return { uitstel: false };

  const complianceVerlengdCount = haalFaseGebondenTeller(plan, "compliance_verlengd_count", "compliance_verlengd_count_faseAnker");
  const { uitstel, nietGeleverd } = await evalueerComplianceGate(userId, plan, complianceVerlengdCount);
  if (!uitstel) return { uitstel: false };

  console.log(`[sync] Fase-overgang uitgesteld voor ${userId}: ${nietGeleverd} niet_geleverd kernsessies deze fase`);
  await kv.set(`compliance_check:${userId}:${weekNr}`, { nietGeleverd, uitstel }, { ex: 14 * 86400 });
  return { uitstel: true, nietGeleverd };
}

// Compliance-poort (D1) losgekoppeld van de "nieuwe activiteit"-idempotentie
// (regel ±211-212 hieronder): evalueerComplianceGate heeft geen intervals.icu-
// credentials nodig (leest uitsluitend via haalComplianceVenster, KV-only), dus
// hoeft niet te wachten op een nieuwe rit. Aanroepbaar vanuit zowel de vroege-
// return-tak (geen nieuwe activiteit) als het volledige pad (zie call sites).
//
// Gedeelde fase-gebonden guard (opbouwweek_verlengd_count/-faseAnker, via
// dezelfde haalFaseGebondenTeller/hoogFaseGebondenTellerOp-infrastructuur als
// fase_verlengd_count/compliance_verlengd_count): voegExtraWeekToe is niet
// idempotent binnen een fase (splice + hernummering vindt bij een tweede
// aanroep gewoon opnieuw dezelfde herstelweek, faseVerlenging.js:44-74) — dus
// als een ANDER signaal deze fase al een extra week invoegde, wordt deze
// aanroep hier volledig genegeerd (geen teller, geen melding, geen invoeging).
// Los van (niet i.p.v.) de bestaande compliance_check-dedupgate hierboven, die
// alleen "compliance deze week al geëvalueerd" voorkomt, niet "een ANDER
// signaal heeft deze fase al verlengd".
async function verlengBijComplianceIndienNodig(kv, planKey, userId, plan, weekNr, apiKey, athleteId) {
  const { uitstel } = await evalueerComplianceUitstel(kv, userId, plan, weekNr);
  if (!uitstel) return;

  let verlengd = false;
  let stale = { verwijderd: [], intervalsEventIds: [] };
  await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
    if (haalFaseGebondenTeller(versPlan, "opbouwweek_verlengd_count", "opbouwweek_verlengd_count_faseAnker") > 0) return;

    hoogFaseGebondenTellerOp(versPlan, "compliance_verlengd_count", "compliance_verlengd_count_faseAnker");
    versPlan.compliance_verlengd = true;
    hoogFaseGebondenTellerOp(versPlan, "opbouwweek_verlengd_count", "opbouwweek_verlengd_count_faseAnker");
    const { toegepast, vanafWeek } = voegExtraWeekToe(versPlan, weekNr);
    if (toegepast) stale = verwijderSessiesVanafWeek(versPlan, vanafWeek);
    verlengd = true;
  });
  if (!verlengd) return;

  await maakMelding(userId, "compliance_opbouwweek_verlengd");

  if (stale.intervalsEventIds.length > 0) {
    for (const eventId of stale.intervalsEventIds) {
      await intervalsDelete(`/events/${eventId}`, { apiKey, athleteId }).catch(
        (e) => console.warn(`[sync] intervals.icu-event ${eventId} verwijderen mislukt:`, e.message)
      );
    }
  }
  if (stale.verwijderd.length > 0) {
    const { vulSessiesAanVoorGebruiker } = await import("@/lib/sessiesAanvullen");
    vulSessiesAanVoorGebruiker(userId, {}).then((r) => {
      console.log(`[sync] Sessies aangevuld na fase-verlenging voor ${userId}:`, r);
    }).catch((e) => {
      console.warn(`[sync] Sessies aanvullen na fase-verlenging mislukt voor ${userId}:`, e.message);
    });
  }
}

// Deze cron-run leest het plan van een gebruiker één keer aan het begin en houdt
// die referentie dan urenlang (relatief) vast over een lange keten van sequentiële
// intervals.icu-aanroepen, om er later meerdere keren delen van terug te schrijven.
// Elke plek die daadwerkelijk terugschrijft gebruikt daarom bijwerkPlanVeilig()
// (zie src/lib/plan/bijwerkPlanVeilig.js voor de lost-update-race die dit voorkomt)
// i.p.v. de lang vastgehouden `plan`-variabele blind terug te zetten. `plan` zelf
// blijft elders in dit bestand prima bruikbaar voor beslissingen (lezen), alleen
// schrijven gaat via bijwerkPlanVeilig().
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
        const [encKey, athleteId] = await kv.mget(`user:${userId}:intervals_key`, `user:${userId}:athlete_id`);
        if (!encKey || !athleteId) continue;

        const apiKey = decrypt(encKey);

        // Plan één keer lezen per user per sync-run
        const planKey = `${userId}:seizoensplan`;
        const plan = await kv.get(planKey);

        // Eenmalige EF-backfill (laatste ~8 weken) — hier en niet verderop bij de
        // decoupling-backfill, want de code daar zit ná de "geen nieuwe rit"/
        // idempotente vroege-continues (regel ±170/232). Als een gebruiker een
        // tijd niet rijdt, komt die verderop-code dus nooit aan de beurt en zou
        // de backfill voor onbepaalde tijd nooit starten. waitUntil() voorkomt
        // daarnaast dat deze niet-geawaite achtergrondtaak wordt afgebroken
        // zodra de request-response al verstuurd is (zelfde patroon als
        // logEvent() in lib/posthog.js).
        const efBfVoltooid = await kv.get(`ef_backfill_voltooid:${userId}`);
        const efBfGestart = await kv.get(`ef_backfill_gestart:${userId}`);
        if (!efBfVoltooid && !efBfGestart) {
          waitUntil(backfillEf(kv, userId, plan?.huidige_ftp || 265, apiKey, athleteId).catch(e => console.warn(`[sync] EF-backfill mislukt:`, e.message)));
        }

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

            // D4: CP/W'-dataverzameling. Eigen, geneste try/catch — losstaand
            // van de FTP-update-if hieronder, zodat een fout hier de
            // FTP-sync-beslissing niet raakt en vice versa. Uitsluitend via
            // dit al-opgehaalde /athlete/{id}-object lezen, NOOIT via het
            // dedicated /athlete/{id}/sport-settings/Ride-endpoint — dat
            // retourneert reproduceerbaar null voor mmp_model op hetzelfde
            // record (bevestigd via een live API-call). Geen nieuwe fetch.
            try {
              const mmpModel = rideSport?.mmp_model ?? null;
              if (mmpModel) {
                await voegCpWprimeDatapuntToe(kv, userId, {
                  datum: datumOffset(0),
                  criticalPower: mmpModel.criticalPower,
                  wPrime: mmpModel.wPrime,
                  pMax: mmpModel.pMax,
                  modelEftp: mmpModel.ftp,
                });
              }
            } catch (e) { console.warn(`[cp-wprime-sync] Opslag mislukt voor ${userId}:`, e.message); }

            const ftpVanIntervals = rideSport?.ftp ?? null;
            const ftpInPlan = plan?.huidige_ftp ?? null;
            if (ftpVanIntervals && ftpInPlan && Math.abs(ftpVanIntervals - ftpInPlan) > 1) {
              console.log(`[ftp-sync] ${userId}: ${ftpInPlan}W → ${ftpVanIntervals}W`);
              await verwerkFtpTest(userId, { icu_ftp: ftpVanIntervals });
            }
          } else if (athleteResp.status === 401 || athleteResp.status === 403) {
            const dedupeKey = `koppeling-melding-verzonden:${userId}`;
            if (!(await kv.get(dedupeKey))) {
              await maakMelding(userId, "koppeling_verbroken");
              await kv.set(dedupeKey, "1", { ex: 86400 });
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
              // B6: RHR-tegenhanger van de HRV-basislijn, uit dezelfde al-opgehaalde
              // 90-dagen-wellnessdata — geen nieuwe intervals.icu-call. Los van (niet
              // i.p.v.) plan.profiel.hr_basislijn, dat statisch en weergave-only blijft
              // (zie checkinAanpassing.js voor de toelichting bij de twee basislijnen).
              const rhrBasislijn28d = berekenRhrBasislijn(genormaliseerd);

              // B2: herstelsnelheid-personalisatie — versie-gate, want oudere
              // hrv-profiel:${userId}.herstelsnelheid-data (indien aanwezig) is
              // berekend met de oude drempelformule (basislijn_28d - 0.5*sd_90d,
              // vóór de reparatie in hrv/herstelsnelheid.js). Zonder deze gate
              // zouden oude en nieuwe (schone-referentie-gebaseerde) observaties
              // door elkaar gemiddeld worden. Ontbreekt versie:2: schone lei.
              const herstelsnelheidBestaand = bestaand?.herstelsnelheid?.versie === 2 ? bestaand.herstelsnelheid : {};
              const zwareSessieDatum = haalLaatsteZwareSessieDatum(plan);
              if (zwareSessieDatum) {
                const zwareSessie = plan.weekSessies.sessies.find(s => s.datum === zwareSessieDatum);
                const sessietype = zwareSessie?.intentie?.sessietype;
                const schoneReferentie = berekenSchoneReferentie(genormaliseerd, zwareSessieDatum);
                const dagen = berekenHerstelDagen(sessietype, zwareSessieDatum, genormaliseerd, schoneReferentie);
                if (dagen != null && sessietype) {
                  const bestaandeVoorType = herstelsnelheidBestaand[sessietype];
                  const nieuweObservaties = (bestaandeVoorType?.observaties || 0) + 1;
                  const nieuwGemiddelde = bestaandeVoorType
                    ? ((bestaandeVoorType.dagen * bestaandeVoorType.observaties) + dagen) / nieuweObservaties
                    : dagen;
                  herstelsnelheidBestaand[sessietype] = { dagen: Math.round(nieuwGemiddelde * 10) / 10, observaties: nieuweObservaties };
                }
              }

              const observatiesRaw = await kv.get(`hrv-observaties:${userId}`);
              const observaties = Array.isArray(observatiesRaw) ? observatiesRaw : (typeof observatiesRaw === "string" ? JSON.parse(observatiesRaw) : []);
              const hrvCheckinGewichten = herberekenGewichtenHrvCheckin(observaties, bestaand?.hrv_checkin_gewichten ?? DEFAULT_HRV_CHECKIN_GEWICHTEN);

              await kv.set(`hrv-profiel:${userId}`, {
                ...(bestaand || {}), ...nieuwProfiel, ...statusCheck, hrv_checkin_gewichten: hrvCheckinGewichten,
                ...(rhrBasislijn28d != null ? { rhr_basislijn_28d: rhrBasislijn28d } : {}),
                herstelsnelheid: { ...herstelsnelheidBestaand, versie: 2 },
              });

              // B6: longitudinale trendpunten — alleen toevoegen als deze pas een
              // geldige, betrouwbare basislijn opleverde (niet in de "leren"-tak,
              // waar nieuwProfiel.basislijn_28d ontbreekt).
              if (nieuwProfiel.betrouwbaar) {
                await voegHrvTrendPuntToe(kv, userId, { datum: datumOffset(0), basislijn: nieuwProfiel.basislijn_28d });
              }
              if (rhrBasislijn28d != null) {
                await voegRhrTrendPuntToe(kv, userId, { datum: datumOffset(0), basislijn: rhrBasislijn28d });
              }

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
          fields: "id,start_date_local,type,icu_training_load,moving_time,icu_weighted_avg_watts,average_watts,icu_rpe,icu_intensity,icu_zone_times,decoupling,icu_efficiency_factor",
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
          // Herbereken fitnessprogressie met verse wellness-data, ook zonder nieuwe rit
          try {
            if (plan) {
              // Venster verbreed naar 70 dagen (was 28) zodat fitnessprogressie
              // (CTL_TREND_VENSTER_DAGEN, fitnessprogressieIO.js) dezelfde fetch
              // kan hergebruiken i.p.v. een eigen /wellness-call te doen — zie
              // fitnessprogressie-kracht-en-weekinfase-implementatie.md.
              const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-70), newest: datumOffset(0), fields: "id,ctl,atl,rampRate" }, { apiKey, athleteId });
              let actResp = null;
              try {
                actResp = await intervalsGet("/activities", { oldest: datumOffset(-70), newest: datumOffset(0), limit: "100", fields: "id,type,start_date_local,moving_time,icu_weighted_avg_watts" }, { apiKey, athleteId });
              } catch {}
              await berekenEnSlaFitnessprogressieOp(userId, { wellData, activiteiten: actResp });
            }
          } catch (e) { console.warn(`[sync] Fitnessprogressie mislukt:`, e.message); }

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

          // D1: compliance-poort ook in het idempotente pad — evalueerComplianceGate
          // heeft geen nieuwe activiteit nodig (KV-only), dus hoeft niet te wachten
          // op de volledige, activiteit-gedreven tak hieronder (zie toelichting bij
          // verlengBijComplianceIndienNodig hierboven).
          try {
            const weekNr = plan?.startdatum ? weeknummerVoorDatum(new Date(), plan.startdatum) : 1;
            const isLaatsteOpbouwWeek = weekNr % 4 === 3;
            if (plan?.kader && isLaatsteOpbouwWeek) {
              await verlengBijComplianceIndienNodig(kv, planKey, userId, plan, weekNr, apiKey, athleteId);
            }
          } catch (e) { console.warn(`[sync] Compliance-poort (idempotent pad) mislukt voor ${userId}:`, e.message); }

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
            let complianceRecord = null;

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

              // E1: mogelijke-instorting-detectie — uitsluitend voor ritten met
              // minstens één gepland werk-segment (kostenbeheersing: geen
              // streams-fetch voor duurritten/sessies zonder segmenten). Gebruikt
              // nieuwste.decoupling — deze RIT se EIGEN, whole-ride decoupling-
              // waarde (al aanwezig in de /activities-respons, fields= regel
              // hierboven bevat "decoupling") — NIET de cross-ride
              // decoupling_baseline-mediaan: die laatste is een trendsignaal
              // (hetzelfde concept als checkFaseOvergang/D2), geen bevestiging
              // dat DEZE specifieke rit een instortingssignatuur toont.
              try {
                const werkSegmenten = (sessie.segmenten || []).filter(s => s.type === "werk" && s.blokDuurSeconden > 0);
                if (werkSegmenten.length > 0) {
                  const watts = await haalWattsStream(apiKey, athleteId, nieuwste.id);
                  if (watts) {
                    const instortingResultaat = detecteerMogelijkeInstorting(watts, sessie.segmenten, nieuwste.decoupling ?? null);
                    if (instortingResultaat) {
                      await kv.set(`segment_instorting:${userId}:${nieuwste.id}`, instortingResultaat, { ex: 365 * 86400 });
                    }
                  }
                }
              } catch (e) {
                console.warn(`[sync] Instorting-detectie mislukt voor ${userId}/${nieuwste.id}:`, e.message);
              }
            }

            await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
              const versSessie = versPlan.weekSessies?.sessies?.find(s => s.datum === ritDatum);
              if (versSessie && !versSessie.voltooid) {
                versSessie.voltooid = true;
                if (scoreData) versSessie.uitvoeringsScore = scoreData;

                // Compliance-record (C1) — gebruikt versSessie.intentie (het
                // aangepaste plan binnen déze verse callback), niet de stale
                // sessie.intentie hierboven, conform ontwerpbeslissing "toets
                // tegen het aangepaste plan". bijwerkPlanVeilig() roept deze
                // callback synchroon aan (bijwerkPlanVeilig.js:14, geen await),
                // dus de KV-write voor dit record gebeurt bewust ná de
                // bijwerkPlanVeilig-aanroep hieronder i.p.v. hierbinnen.
                if (versSessie.intentie) {
                  const complianceSessietype = versSessie.intentie?.sessietype ?? versSessie.type ?? null;
                  complianceRecord = bepaalComplianceRecord({
                    sessietype: complianceSessietype,
                    tssDoel: versSessie.tss,
                    toegestaneZones: versSessie.intentie?.toegestane_zones,
                    icuTrainingLoad: nieuwste.icu_training_load,
                    icuZoneTimes: nieuwste.icu_zone_times,
                    activiteitId: nieuwste.id,
                    // B5: verplaatst_van/verplaatst_naar (zonder hrv_-prefix) is het
                    // bron-neutrale veldpaar dat een niet-HRV-gedreven herschikking
                    // (probeerHerschikking, sessie/herschikking.js) vult — hrv_-
                    // geprefixt blijft de HRV-keuze-flow (hrv/verwerking.js) zelf.
                    verplaatstVan: versSessie.verplaatst_van ?? versSessie.hrv_verplaatst_van,
                    verplaatstNaar: versSessie.verplaatst_naar ?? versSessie.hrv_verplaatst_naar,
                    datum: versSessie.datum,
                  });
                }
              }
            });
            if (complianceRecord) {
              await kv.set(`sessie_compliance:${userId}:${complianceRecord.datum}`, complianceRecord, { ex: 365 * 86400 });
            }
            sessie.voltooid = true; // lokale referentie ook bijwerken voor de rest van dit blok

            logEvent("sessie_voltooid", userId, {
              sessietype: sessie.intentie?.sessietype ?? sessie.type ?? null,
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
                await maakMelding(userId, "ftp_gedetecteerd", { oudeFtp: ftpResult.oldFtp, nieuweFtp: ftpResult.newFtp });
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
            // Ritten die al gecached zijn maar (bv. door een tijdelijke Open-Meteo-
            // storing) geen temperatuur kregen, blijven anders permanent op null
            // staan — nooit een retry. Zulke ritten laten we wél doorlopen, maar
            // uitsluitend voor een hernieuwde hitte-poging (geen dubbele streams-
            // ophaal/decoupling-herberekening, zie retry-tak verderop).
            const heeftAlHitteData = alCached && typeof alCached === "object" && alCached.apparent_temp_celsius != null;
            if (alCached != null && heeftAlHitteData) continue;
            const isHitteRetry = alCached != null && !heeftAlHitteData;

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
              if (hitte_gecorrigeerd) {
                await maakMelding(userId, "hitte_correctie", {
                  temperatuur: Math.round(apparent_temp_celsius),
                  datum: rit.start_date_local?.split("T")[0],
                });
              }
            } catch {}

            if (isHitteRetry) {
              // Decoupling stond al goed gecached — alleen de hitte-velden
              // bijwerken als de retry nu wél lukte. Mislukt hij weer, dan blijft
              // de entry op null staan voor een volgende cron-run.
              if (apparent_temp_celsius != null) {
                await kv.set(`decoupling:${rit.id}`, { ...alCached, apparent_temp_celsius, temp_baseline, hitte_gecorrigeerd });
              }
              continue;
            }

            try {
              const dc = await cacheDecoupling(rit.id, rit.decoupling);
              if (dc != null) {
                await kv.set(`decoupling:${rit.id}`, { decoupling: dc, apparent_temp_celsius, temp_baseline, hitte_gecorrigeerd, startTijd: rit.start_date_local, duurMinuten: Math.round(duurMin), userId });
              }
              await bijwerkenDecouplingBaseline(userId).catch(() => {});
              if (temp_baseline != null) {
                await kv.set(`temp_baseline:${userId}`, temp_baseline, { ex: 90 * 86400 });
              }
            } catch (e) {
              console.warn(`[sync] Decoupling cache mislukt voor rit ${rit.id}:`, e.message);
            }
          }

          // Efficiency Factor-trend per intensiteitsband (z2/sweetspot/drempel/vo2max) —
          // eligibility op basis van de bestaande sectie 33-classificatie (IF-band) van
          // de hele rit; EF zelf is intervals.icu's eigen icu_efficiency_factor
          // (whole-ride, zie lib/ef.js).
          for (const rit of ritten) {
            try {
              await verwerkRitVoorEf(kv, userId, rit, plan.huidige_ftp || 265);
            } catch (e) {
              console.warn(`[sync] EF-berekening mislukt voor rit ${rit.id}:`, e.message);
            }
          }

          // Wekelijkse distributie-check
          const veertienDagenGeleden = datumOffset(-14);
          const recenteRitten = ritten.filter(r => (r.start_date_local?.split("T")[0] || "") >= veertienDagenGeleden);
          if (recenteRitten.length >= 3) {
            try {
              const afwijking = await berekenDistributie(userId, recenteRitten, plan.ervaringsniveau || "recreatief");
              if (afwijking) {
                const richtingTekst = afwijking.richting === "te_intensief"
                  ? `Je reed de afgelopen 14 dagen ${afwijking.z1z2Pct}% in Z1/Z2 — iets minder dan je streefwaarde van ${afwijking.doelPct}%.`
                  : `Je reed de afgelopen 14 dagen ${afwijking.z1z2Pct}% in Z1/Z2 — meer dan je streefwaarde van ${afwijking.doelPct}%.`;
                await maakMelding(userId, "distributie_correctie", { tekst: richtingTekst });
              }
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

          // Fitnessprogressie herberekenen
          try {
            // Venster verbreed naar 70 dagen — fitnessprogressie hergebruikt deze
            // respons i.p.v. een eigen /wellness-call te doen.
            const wellAll = await intervalsGet("/wellness", { oldest: datumOffset(-70), newest: datumOffset(0), fields: "id,ctl,atl,rampRate" }, { apiKey, athleteId });

            // `ritten` (boven, regel 178) is alleen "sinds laatste sync" — te smal
            // voor fitnessprogressie's 70-dagen decoupling-trend, dus hier kan
            // geen bestaande bredere activities-fetch hergebruikt worden (in
            // tegenstelling tot het idempotente pad, waar die al bestond).
            const activiteitenVoorTrend = await intervalsGet("/activities", { oldest: datumOffset(-70), newest: datumOffset(0), limit: "100", fields: "id,type,start_date_local,moving_time,icu_weighted_avg_watts" }, { apiKey, athleteId });
            await berekenEnSlaFitnessprogressieOp(userId, { wellData: wellAll, activiteiten: activiteitenVoorTrend });
          } catch (e) {
            console.warn(`[sync] Fitnessprogressie mislukt voor ${userId}:`, e.message);
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
                let decouplingUitstel = false;
                let complianceUitstel = false;

                const decouplingWaarden = [];
                const cached = await kv.get(`decoupling_check:${userId}:${weekNr}`);
                if (!cached) {
                  // Haal Z2-duurritten van afgelopen 3 weken. NB: dit moet een eigen
                  // intervals.icu-aanroep zijn — `ritten` (hoger in deze functie) bevat
                  // alleen activiteiten sinds de vorige sync (`oldest: lastActivity`),
                  // meestal maar 1-3 dagen, wat deze 3-wekenfilter anders een no-op maakt
                  // en de mediaan op een veel te kleine steekproef laat draaien.
                  const drieWekenGeleden = datumOffset(-21);
                  const recenteActiviteiten = await intervalsGet("/activities", {
                    oldest: drieWekenGeleden,
                    newest: datumOffset(0),
                    limit: "40",
                    fields: "id,start_date_local,type",
                  }, { apiKey, athleteId });
                  const z2Ritten = (recenteActiviteiten || []).filter(a => a.type === "Ride" || a.type === "VirtualRide");
                  // Gebruik decoupling-waarden uit KV cache
                  // 1. Filter hitte-ritten (spec 32-F)
                  // 2. Filter uitschieters als extra laag (>12% of IQR)
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

                  // Minimaal 3 nodig: isDecouplingUitschieter() slaat zijn eigen
                  // uitschieter-check (zelfs de simpele >12%-cap) helemaal over onder de
                  // 3 waarden, dus bij minder is er geen enkele bescherming tegen één
                  // ruizige meting die de mediaan over de uitstel-drempel tilt.
                  if (decouplingWaarden.length >= 3) {
                    const aantalVerlengingen = haalFaseGebondenTeller(plan, "fase_verlengd_count", "fase_verlengd_count_faseAnker");
                    const { uitstel, mediaan } = checkFaseOvergang(decouplingWaarden, aantalVerlengingen);
                    decouplingUitstel = uitstel;

                    if (uitstel) {
                      console.log(`[sync] Fase-overgang uitgesteld voor ${userId}: mediaan decoupling ${mediaan}%`);
                      await kv.set(`decoupling_check:${userId}:${weekNr}`, { mediaan, uitstel }, { ex: 14 * 86400 });
                    }
                  }
                }

                // D1: compliance-poort — eigen dedup-gate (compliance_check),
                // zelfde per-week-eenmalig-patroon als decoupling_check hierboven,
                // onafhankelijk van decoupling's eigen >=3-datavoorwaarde. Eigen
                // teller (compliance_verlengd_count, NIET fase_verlengd_count —
                // D1-plan beslissing #2: een fysiologisch en een uitvoeringssignaal
                // mogen niet om hetzelfde verlengingsbudget concurreren).
                ({ uitstel: complianceUitstel } = await evalueerComplianceUitstel(kv, userId, plan, weekNr));

                const moetVerlengen = decouplingUitstel || complianceUitstel;

                if (moetVerlengen) {
                  let stale = { verwijderd: [], intervalsEventIds: [] };
                  // Gedeelde fase-gebonden guard (zie toelichting bij
                  // verlengBijComplianceIndienNodig hierboven): check EENMAAL, vóór
                  // de per-signaal-tellers, zodat een gelijktijdige trigger van beide
                  // signalen bínnen deze ene synchrone evaluatie (moetVerlengen
                  // hierboven) ongewijzigd blijft werken — beide tellers verhogen,
                  // één voegExtraWeekToe — terwijl een signaal dat pas triggert nadat
                  // een ANDER signaal deze fase al eerder (in een aparte cron-run,
                  // bv. via de idempotente tak) heeft verlengd, hier alsnog volledig
                  // wordt genegeerd.
                  let verlengd = false;
                  await bijwerkPlanVeilig(kv, planKey, (versPlan) => {
                    if (haalFaseGebondenTeller(versPlan, "opbouwweek_verlengd_count", "opbouwweek_verlengd_count_faseAnker") > 0) return;

                    if (decouplingUitstel) {
                      hoogFaseGebondenTellerOp(versPlan, "fase_verlengd_count", "fase_verlengd_count_faseAnker");
                      versPlan.fase_verlengd = true;
                    }
                    if (complianceUitstel) {
                      hoogFaseGebondenTellerOp(versPlan, "compliance_verlengd_count", "compliance_verlengd_count_faseAnker");
                      versPlan.compliance_verlengd = true;
                    }
                    hoogFaseGebondenTellerOp(versPlan, "opbouwweek_verlengd_count", "opbouwweek_verlengd_count_faseAnker");
                    const { toegepast, vanafWeek } = voegExtraWeekToe(versPlan, weekNr);
                    if (toegepast) stale = verwijderSessiesVanafWeek(versPlan, vanafWeek);
                    verlengd = true;
                  });

                  if (verlengd) {
                    // Beide onafhankelijk van elkaar — bij gelijktijdig triggeren
                    // dus allebei verstuurd (D1-plan, aanpassing op stap D).
                    if (decouplingUitstel) await maakMelding(userId, "opbouwweek_verlengd");
                    if (complianceUitstel) await maakMelding(userId, "compliance_opbouwweek_verlengd");

                    // Async cleanup mag niet binnen bijwerkPlanVeilig's (synchrone)
                    // mutator — zelfde tweefasenpatroon als verwijderSessiesInPeriode
                    // in afwezigheid.js. Al-gegenereerde sessies ná het invoegpunt zijn
                    // stale (kader-inhoud is verschoven, zie faseVerlenging.js); ruim
                    // de gekoppelde intervals.icu-events op en vul de ontstane gaten
                    // meteen opnieuw, i.p.v. te wachten op de volgende cron-cyclus.
                    if (stale.intervalsEventIds.length > 0) {
                      for (const eventId of stale.intervalsEventIds) {
                        await intervalsDelete(`/events/${eventId}`, { apiKey, athleteId }).catch(
                          (e) => console.warn(`[sync] intervals.icu-event ${eventId} verwijderen mislukt:`, e.message)
                        );
                      }
                    }
                    if (stale.verwijderd.length > 0) {
                      const { vulSessiesAanVoorGebruiker } = await import("@/lib/sessiesAanvullen");
                      vulSessiesAanVoorGebruiker(userId, {}).then((r) => {
                        console.log(`[sync] Sessies aangevuld na fase-verlenging voor ${userId}:`, r);
                      }).catch((e) => {
                        console.warn(`[sync] Sessies aanvullen na fase-verlenging mislukt voor ${userId}:`, e.message);
                      });
                    }
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

    await logCronRun("sync", { startedAt, results }).catch(err => console.warn("[sync] cronrun-log mislukt:", err.message));
    return NextResponse.json({ success: true, results, checkedAt: new Date().toISOString() });
  } catch (e) {
    await logCronRun("sync", { startedAt, results: [...results, { userId: "_run_", status: "error", error: e.message }] }).catch(err => console.warn("[sync] cronrun-log mislukt:", err.message));
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
