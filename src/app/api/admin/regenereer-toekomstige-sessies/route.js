import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet, intervalsPost, intervalsDelete } from "@/lib/intervals";
import { vandaagISO } from "@/lib/datum";
import { bouwSessieDagPrompt } from "@/lib/promptBuilder";
import { claudeCall } from "@/lib/claude";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";
import { berekenBlok, bouwZonesUitProfiel } from "@/lib/vermogensbereik";
import { segmentenNaarZwo } from "@/lib/workoutZwo";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import {
  getArchetypesVoorSessietype,
  getRecenteArchetypes,
  slaArchetypeOp,
  migreerZ2VariabelNaarDuur,
  migreesSessietype,
} from "@/lib/sessie-archetypes";

export const maxDuration = 300;

const ADMIN_EMAIL = "fr.levering@gmail.com";
const VRIJHEID_FASEN = new Set(['sweetspot', 'drempel', 'vo2max']);

function weekInFaseVoorDatum(datum, kader, startdatum) {
  if (!kader || !startdatum) return 1;
  const weekNr = weeknummerVoorDatum(datum, startdatum);
  const kaderWeek = kader.find(w => w.week === weekNr) || kader[0];
  if (!kaderWeek) return 1;
  const fase = kaderWeek.fase;
  const sorted = [...kader].sort((a, b) => a.week - b.week);
  let teller = 0;
  for (const w of sorted) {
    if (w.fase === fase) teller++;
    if (w.week === kaderWeek.week) return teller;
  }
  return 1;
}

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

      const promptData = bouwSessieDagPrompt({
        profiel,
        wellness: null,
        dagelijkseData: [],
        voortgang: null,
        seizoensplan: { ...plan, weekSessies: undefined },
        overigeSessies,
        datum,
        dagNaam: sessie.dag || 'Maandag',
        uren: (sessie.duur_min || 90) / 60,
        oudeSessie: sessie,
        aanleiding: "beschikbaarheid_nieuw",
      });

      // Archetype-selectie
      const kaderWeek = plan.kader?.find(w => w.week === weeknummerVoorDatum(datum, plan.startdatum)) || plan.kader?.[0];
      const huidigeFase = kaderWeek?.fase ?? 'basis';
      const weekInFase = weekInFaseVoorDatum(datum, plan.kader, plan.startdatum);
      const dagIntentie = sessie.intentie || null;

      const isVrijheidsdag = (
        weekInFase === 3 &&
        dagIntentie?.rol === 'tweede_intensiteit' &&
        VRIJHEID_FASEN.has(huidigeFase)
      );
      const effectiefSessietype = isVrijheidsdag ? 'gemengd' : (dagIntentie?.sessietype ?? null);

      let gekozenArchetypeId = null;
      if (effectiefSessietype) {
        const archetypes = getArchetypesVoorSessietype(
          effectiefSessietype,
          huidigeFase,
          weekInFase,
          plan.seizoensdoel?.type ?? null
        );
        if (archetypes.length > 0) {
          const recenteArchetypes = await getRecenteArchetypes(kv, userId, effectiefSessietype);
          const isGemengd = effectiefSessietype === 'gemengd';
          const sessieVariatieBlok = JSON.stringify({
            beschikbare_archetypes: archetypes,
            recente_archetypes: recenteArchetypes,
            rotatie_instructie: isGemengd
              ? 'Dit is een vrijheidsessie (gemengd). Kies een archetype dat NIET gelijk is aan recente_archetypes[0]. Maak de beschrijving motiverend en energiek. Geef gekozen_archetype_id terug als apart veld in je JSON-output.'
              : 'Kies een archetype dat NIET gelijk is aan recente_archetypes[0]. Geef sterke voorkeur aan archetypes die niet in recente_archetypes staan. Schaal blokduur proportioneel naar beschikbare sessieduur. Geef gekozen_archetype_id terug als apart veld in je JSON-output.',
          }, null, 2);
          promptData.prompt += `\n\nSESSIEVARIATIE — VERPLICHT\n\nKies exact één archetype. Regels:\n1. Kies NOOIT hetzelfde archetype als recente_archetypes[0]\n2. Geef sterke voorkeur aan archetypes die niet in recente_archetypes staan\n3. Schaal blokduur proportioneel naar beschikbare sessieduur\n4. Geef gekozen_archetype_id terug als apart veld in je JSON-output\n\nTRAININGEN ZIJN LEUK EN AFWISSELEND:\nElke sessie heeft een herkenbare structuur — een progressie, een ritme of een spel.\n\nZ1-ZONE REGEL — HARDE CONSTRAINT:\nZ1 is verboden behalve in: sprint_neuraal, z6_anaeroob, kracht_lage_cadans.\n\n${sessieVariatieBlok}`;
        }
      }

      const raw = await claudeCall(promptData);
      const nieuweSessie = raw.sessie || raw.sessies?.[0] || raw;
      if (!nieuweSessie.datum) nieuweSessie.datum = datum;

      // Safety net: behoud heeft_sprint_staartjes als de originele sessie die had
      if (sessie.intentie?.heeft_sprint_staartjes && nieuweSessie.intentie) {
        if (!nieuweSessie.intentie.heeft_sprint_staartjes) {
          nieuweSessie.intentie.heeft_sprint_staartjes = true;
          const zones = nieuweSessie.intentie.toegestane_zones || ["Z2"];
          if (!zones.includes("Z7")) nieuweSessie.intentie.toegestane_zones = [...zones, "Z7"];
        }
      }

      gekozenArchetypeId = raw.gekozen_archetype_id ?? nieuweSessie.gekozen_archetype_id ?? null;
      if (gekozenArchetypeId && effectiefSessietype) {
        await slaArchetypeOp(kv, userId, effectiefSessietype, gekozenArchetypeId);
      }

      normaliseerSessieSegmenten(nieuweSessie);
      voegVerwachtRpeToe(nieuweSessie);
      corrigeerSessieTss(nieuweSessie);

      // Vermogensbereik toepassen
      if (profiel.power_zones && profiel.ftp) {
        try {
          const zones = bouwZonesUitProfiel(profiel.ftp, profiel.power_zones);
          const sessietype = nieuweSessie.intentie?.sessietype || nieuweSessie.sessietype || nieuweSessie.type;
          nieuweSessie.segmenten = (nieuweSessie.segmenten || []).map(seg =>
            seg.zone ? berekenBlok(seg, zones, profiel.ftp, piekSprint, sessietype) : seg
          );
        } catch (e) {
          console.warn(`[regenereer] Vermogensbereik mislukt voor ${datum}:`, e.message);
        }
      }

      // Intervals event bijwerken
      if (creds) {
        try {
          if (sessie.intervalsEventId) {
            await intervalsDelete(`/events/${sessie.intervalsEventId}`, creds);
          }
          const zwo = segmentenNaarZwo(nieuweSessie.segmenten, nieuweSessie.titel, profiel.ftp || 265);
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
