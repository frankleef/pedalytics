import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet, intervalsPost, intervalsDelete } from "@/lib/intervals";
import { vandaagISO, datumISO } from "@/lib/datum";
import { sessieNaarZwo } from "@/lib/workoutZwo";
import { weeknummerVoorDatum, kaderWeekVoorDatum, weekInFaseVoorKaderWeek, getMaandagVanWeek } from "@/lib/weekgrenzen";
import { genereerSessieDag, logSessieGegenereerd } from "@/lib/sessie/genereren";
import { bouwRampTestSessie } from "@/lib/sessiesAanvullen";
import {
  migreerZ2VariabelNaarDuur,
  migreesSessietype,
} from "@/lib/sessie-archetypes";
import { bepaalVrijheidsdag } from "@/lib/vrijheidsdag";
import { bepaalAlGeleverd, haalWellnessVoorDatum } from "@/lib/sessie/context";

export const maxDuration = 300;

const ADMIN_EMAIL = "fr.levering@gmail.com";

export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { userId } = body;
  if (!userId) return NextResponse.json({ error: "userId vereist" }, { status: 400 });

  const kv = getKV();

  // 1. KV-migratie z2_variabel → z2_duur
  await migreerZ2VariabelNaarDuur(kv, userId);

  // KV-cleanup verouderde sessietype-sleutels
  const VEROUDERDE_SESSIETYPES = ['over_under', 'pyramide', 'tempo_intervallen', 'z2_vlak', 'z2_cadans'];
  for (const oud of VEROUDERDE_SESSIETYPES) {
    try {
      await kv.delete(`sessie_archetypes:${userId}:${oud}`);
    } catch { /* sleutel bestond niet — geen probleem */ }
  }

  // 2. Plan ophalen
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan) return NextResponse.json({ error: "Geen actief plan" }, { status: 404 });

  const vandaag = vandaagISO();
  const sessies = plan.weekSessies?.sessies || [];

  // 3. Filter: alleen toekomstige, niet-voltooide sessies
  const toekomstigeSessies = sessies.filter(s =>
    s.datum > vandaag &&
    s.status !== 'voltooid' &&
    s.status !== 'bezig' &&
    !s.voltooid
  );

  console.log(`[regenereer-toekomstige-sessies] ${toekomstigeSessies.length} sessies voor userId ${userId}`);

  // Profiel ophalen voor vermogensbereik
  let profiel = { ftp: plan.huidige_ftp || 265, power_zones: null };
  let creds = null;
  let piekSprint = Math.round((profiel.ftp) * 1.8);
  try {
    creds = await getIntervalsCredentials(userId);
    if (creds) {
      const athlete = await intervalsGet("/", {}, creds);
      const rideSport = (athlete.sportSettings || []).find(s => s.types?.includes("Ride")) || {};
      profiel = {
        ftp: rideSport.ftp || plan.huidige_ftp || 265,
        lt_hr: rideSport.lthr || 184,
        max_hr: rideSport.max_hr || 200,
        gewicht: athlete.icu_weight || 90,
        hrv_basislijn: plan.profiel?.hrv_basislijn || 58,
        hr_basislijn: plan.profiel?.hr_basislijn || 49,
        power_zones: rideSport.power_zones || null,
      };
      piekSprint = await kv.get(`piek_sprint_vermogen:${userId}`) || Math.round(profiel.ftp * 1.8);
    }
  } catch (e) {
    console.warn('[regenereer-toekomstige-sessies] Profiel ophalen mislukt:', e.message);
  }

  const hrvProfiel = await kv.get(`hrv-profiel:${userId}`);

  const resultaten = [];

  // 3b. Opruimen: verwijder ALLE bestaande WORKOUT-events in intervals.icu voor
  // datums die we gaan regenereren — voorkomt duplicaten bij herhaalde runs.
  if (creds) {
    try {
      const teDatumsSet = new Set(toekomstigeSessies.map(s => s.datum));
      const verVerDatum = toekomstigeSessies.at(-1)?.datum ?? vandaag;
      const alleEvents = await intervalsGet("/events.json", { oldest: vandaag, newest: verVerDatum }, creds);
      const teVerwijderen = (alleEvents || []).filter(e =>
        e.category === "WORKOUT" &&
        e.start_date_local &&
        teDatumsSet.has(e.start_date_local.split("T")[0])
      );
      console.log(`[regenereer] ${teVerwijderen.length} bestaande WORKOUT-events verwijderen`);
      for (const evt of teVerwijderen) {
        try {
          await intervalsDelete(`/events/${evt.id}`, creds);
        } catch (e) {
          console.warn(`[regenereer] Event ${evt.id} verwijderen mislukt:`, e.message);
        }
      }
      // Reset bekende event-IDs in het plan zodat de regeneratie ze opnieuw aanmaakt
      for (const sessie of toekomstigeSessies) {
        if (sessie.intervalsEventId) sessie.intervalsEventId = null;
      }
    } catch (e) {
      console.warn('[regenereer] Events opruimen mislukt:', e.message);
    }
  }

  // 4a. Migratie: markeer sprint-staartjes in basisfase (eenmalig, idempotent)
  {
    const basisZ2PerWeek = {};
    for (const sessie of toekomstigeSessies) {
      const weekNr = weeknummerVoorDatum(sessie.datum, plan.startdatum);
      const kw = plan.kader?.find(w => w.week === weekNr);
      if (!kw || kw.fase !== 'basis' || kw.weektype === 'herstel') continue;
      if (sessie.intentie?.sessietype !== 'z2_duur') continue;
      if (!basisZ2PerWeek[weekNr]) basisZ2PerWeek[weekNr] = [];
      basisZ2PerWeek[weekNr].push(sessie);
    }
    let sprintMigraties = 0;
    for (const sessies_week of Object.values(basisZ2PerWeek)) {
      const langste = sessies_week.reduce((a, b) =>
        (a.intentie?.tss_range?.max ?? 0) >= (b.intentie?.tss_range?.max ?? 0) ? a : b
      );
      if (!langste.intentie) langste.intentie = {};
      if (!langste.intentie.heeft_sprint_staartjes) {
        langste.intentie.heeft_sprint_staartjes = true;
        const zones = langste.intentie.toegestane_zones || ["Z2"];
        if (!zones.includes("Z7")) langste.intentie.toegestane_zones = [...zones, "Z7"];
        console.log(`[regenereer] Sprint-staartjes gemarkeerd: ${langste.datum}`);
        sprintMigraties++;
      }
    }
    if (sprintMigraties > 0) {
      await kv.set(planKey, plan);
    }
  }

  // 4b. Sequentieel regenereren
  const alGeleverdPerWeek = {};
  for (const sessie of toekomstigeSessies) {
    const datum = sessie.datum;
    try {
      // Migreer verouderd sessietype in dag-intentie
      const oorspronkelijkSessietype = sessie.intentie?.sessietype;
      const gemigreerdSessietype = migreesSessietype(oorspronkelijkSessietype);

      if (sessie.intentie && !gemigreerdSessietype && oorspronkelijkSessietype) {
        console.warn(`[regenereer] Onbekend sessietype "${oorspronkelijkSessietype}" op ${datum} — overgeslagen`);
        resultaten.push({ datum, status: 'overgeslagen', reden: `onbekend sessietype: ${oorspronkelijkSessietype}` });
        continue;
      }

      if (sessie.intentie && gemigreerdSessietype && gemigreerdSessietype !== oorspronkelijkSessietype) {
        console.log(`[regenereer] Migratie dag-intentie ${datum}: "${oorspronkelijkSessietype}" → "${gemigreerdSessietype}"`);
        sessie.intentie.sessietype = gemigreerdSessietype;
      }

      const overigeSessies = sessies.filter(s => s.datum !== datum && !s.voltooid);

      // Archetype-selectie: fase/week bepalen effectiefSessietype (incl. vrijheidsdag-override)
      const kaderWeek = kaderWeekVoorDatum(datum, plan.kader, plan.startdatum);
      const huidigeFase = kaderWeek?.fase ?? 'basis';
      const weekInFase = weekInFaseVoorKaderWeek(kaderWeek, plan.kader);
      const dagIntentie = sessie.intentie || null;

      const isVrijheidsdag = bepaalVrijheidsdag({
        weekInFase, dagRol: dagIntentie?.rol, fase: huidigeFase,
      });
      const effectiefSessietype = isVrijheidsdag ? 'gemengd' : (dagIntentie?.sessietype ?? null);

      let nieuweSessie;
      if (effectiefSessietype === 'ramp_test') {
        // Sectie 51-B/C: ramp_test heeft geen archetype/variantendata (bewust
        // uitgesloten, zie TEST_SESSIETYPES) — genereerSessieDag zou hier
        // hard falen. Vast protocol i.p.v. het deterministische archetype-pad.
        nieuweSessie = bouwRampTestSessie(datum, sessie.dag || 'Maandag');
      } else {
        const wellnessVoorDezeDag = creds ? await haalWellnessVoorDatum(userId, datum, creds) : null;
        // datumISO() (lokale datumcomponenten), niet .toISOString() (UTC) —
        // anders schuift de maandag-datum een dag op buiten een UTC-runtime.
        const weekStart = datumISO(getMaandagVanWeek(datum));
        if (!(weekStart in alGeleverdPerWeek)) {
          alGeleverdPerWeek[weekStart] = creds ? await bepaalAlGeleverd(userId, weekStart) : { tss: 0 };
        }

        const result = await genereerSessieDag({
          kv, userId, datum, dagNaam: sessie.dag || 'Maandag',
          uren: (sessie.duur_min || 90) / 60,
          profiel, wellness: wellnessVoorDezeDag, plan,
          oudeSessie: sessie, overigeSessies,
          aanleiding: "beschikbaarheid_nieuw",
          effectiefSessietype, huidigeFase, weekInFase, weektype: kaderWeek?.weektype || 'opbouw',
          hrvProfiel, piekSprint,
          weekTssDoel: kaderWeek?.tss_doel ?? null, alGeleverdTss: alGeleverdPerWeek[weekStart].tss,
        });

        if (result?._geenSessie) {
          resultaten.push({ datum, status: 'overgeslagen', reden: result.reden });
          continue;
        }
        nieuweSessie = result;
      }

      // Safety net: behoud heeft_sprint_staartjes als de originele sessie die had
      if (sessie.intentie?.heeft_sprint_staartjes && nieuweSessie.intentie) {
        if (!nieuweSessie.intentie.heeft_sprint_staartjes) {
          nieuweSessie.intentie.heeft_sprint_staartjes = true;
          const zones = nieuweSessie.intentie.toegestane_zones || ["Z2"];
          if (!zones.includes("Z7")) nieuweSessie.intentie.toegestane_zones = [...zones, "Z7"];
        }
      }

      const gekozenArchetypeId = nieuweSessie.archetype_id ?? null;

      // Intervals event bijwerken
      if (creds) {
        try {
          if (sessie.intervalsEventId) {
            await intervalsDelete(`/events/${sessie.intervalsEventId}`, creds);
          }
          const zwo = sessieNaarZwo(nieuweSessie, profiel.ftp || 265);
          const eventBody = {
            category: "WORKOUT",
            start_date_local: `${datum}T08:00:00`,
            name: nieuweSessie.titel || nieuweSessie.type,
            type: "Ride",
            moving_time: (nieuweSessie.duur_min || 90) * 60,
            ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
          };
          const result = await intervalsPost("/events", eventBody, creds);
          if (result.id) nieuweSessie.intervalsEventId = result.id;
        } catch (e) {
          console.warn(`[regenereer] Intervals sync mislukt voor ${datum}:`, e.message);
        }
      }

      // Sessie bijwerken in plan
      const huidigPlan = await kv.get(planKey);
      huidigPlan.weekSessies = {
        ...huidigPlan.weekSessies,
        sessies: (huidigPlan.weekSessies?.sessies || []).map(s =>
          s.datum === datum ? { ...nieuweSessie, datum } : s
        ),
      };
      await kv.set(planKey, huidigPlan);

      if (effectiefSessietype !== 'ramp_test') logSessieGegenereerd(nieuweSessie, { userId, huidigeFase, weekInFase });

      resultaten.push({
        datum,
        status: 'ok',
        archetype: gekozenArchetypeId,
        ...(gemigreerdSessietype !== oorspronkelijkSessietype
          ? { sessietype_gemigreerd: `${oorspronkelijkSessietype} → ${gemigreerdSessietype}` }
          : {}),
      });
      console.log(`[regenereer] ${datum}: ok, archetype=${gekozenArchetypeId}`);
    } catch (e) {
      console.error(`[regenereer] ${datum} mislukt:`, e.message);
      resultaten.push({ datum, status: 'fout', fout: e.message });
    }

    // Rate-limiting: 500ms = max 2/sec
    await new Promise(r => setTimeout(r, 500));
  }

  // Log opslaan in KV
  try {
    const logSleutel = `regen_log:${userId}:${Date.now()}`;
    await kv.set(logSleutel, { timestamp: new Date().toISOString(), resultaten }, { ex: 60 * 60 * 24 * 7 });
  } catch {}

  const geslaagd = resultaten.filter(r => r.status === 'ok').length;
  const mislukt = resultaten.filter(r => r.status === 'fout').length;

  return NextResponse.json({
    bericht: `${geslaagd} sessies geregenereerd, ${mislukt} mislukt`,
    resultaten,
  });
}
