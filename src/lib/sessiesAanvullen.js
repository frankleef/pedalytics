import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet, intervalsPost } from "@/lib/intervals";
import { vandaagISO, datumISO, DAGNAMEN } from "@/lib/datum";
import { bouwSessieDagPrompt } from "@/lib/promptBuilder";
import { maxTrainingsdagenPerWeek, heeftTeLangReeks } from "@/lib/trainingsfrequentie";
import { segmentenNaarZwo } from "@/lib/workoutZwo";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";
import { berekenBlok, bouwZonesUitProfiel } from "@/lib/vermogensbereik";
import { claudeCall } from "@/lib/claude";
import { magSprintStaartje } from "@/lib/sessie/weekpatroon";
import { genereerSessieDag } from "@/lib/sessie/genereren";
import { bepaalDagIntentieMetRetry } from "@/lib/sessie/dagIntentie";

const VERBODEN_TYPES_VOLUMECORRECTIE = ["kracht_lage_cadans", "sprint_neuraal"];


const Z1_TOEGESTANE_SESSIETYPES = new Set([
  'sprint_neuraal',
  'z6_anaeroob',
  'kracht_lage_cadans',
]);

const Z1_TOEGESTANE_GEMENGD_ARCHETYPES = new Set([
  'alles_mag', 'raketstart', 'klim_simulator',
]);

function valideerZ1Gebruik(blokken, sessietype, archetypeId = null) {
  if (Z1_TOEGESTANE_SESSIETYPES.has(sessietype)) return true;
  if (sessietype === 'gemengd' && archetypeId && Z1_TOEGESTANE_GEMENGD_ARCHETYPES.has(archetypeId)) return true;
  const overtredend = (blokken || []).find(b => b.zone === 'Z1');
  if (overtredend) {
    console.error(
      `[sessiesAanvullen] Z1-blok gedetecteerd in sessietype "${sessietype}" — niet toegestaan.`,
      overtredend
    );
    return false;
  }
  return true;
}

const VRIJHEID_FASEN = new Set(['sweetspot', 'drempel', 'vo2max']);

export async function vulSessiesAanVoorGebruiker(userId, { aerobeDagen = [], tempoAfsluiters = [], verlengingen = [] } = {}) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan?.kader || !plan.beschikbaarheid) return { status: "geen_plan" };

  const creds = await getIntervalsCredentials(userId);
  if (!creds) return { status: "geen_credentials" };

  const vandaag = vandaagISO();
  const beschikbareDagen = Object.entries(plan.beschikbaarheid).filter(([, v]) => v).map(([k]) => k);
  const beschikbareDagenAantal = beschikbareDagen.length;

  const urenPerDag = plan.urenPerDag || {};
  const bestaandeSessies = plan.weekSessies?.sessies || [];
  const bestaandeDatums = new Set(bestaandeSessies.map(s => s.datum));

  // ISO-weeknummer van de aankomende week (voor volumecorrectie-metadata)
  const nu = new Date();
  const aankomendeMaandag = new Date(nu);
  aankomendeMaandag.setDate(nu.getDate() + ((8 - nu.getDay()) % 7 || 7));
  const dWeek = new Date(Date.UTC(aankomendeMaandag.getFullYear(), aankomendeMaandag.getMonth(), aankomendeMaandag.getDate()));
  dWeek.setUTCDate(dWeek.getUTCDate() + 4 - (dWeek.getUTCDay() || 7));
  const weekYearStart = new Date(Date.UTC(dWeek.getUTCFullYear(), 0, 1));
  const aankomendeWeekNr = Math.ceil((((dWeek - weekYearStart) / 86400000) + 1) / 7);

  const ctlBasis = plan.huidige_ctl ?? 40;

  // Hulp: maandag-ISO voor een datum (voor week-groepering)
  function weekMaandagISO(isoDate) {
    const d = new Date(isoDate);
    const dag = d.getDay();
    const offset = dag === 0 ? -6 : 1 - dag;
    d.setDate(d.getDate() + offset);
    return datumISO(d);
  }

  // Hulp: kaderweek voor een datum
  function kaderWeekVoorDatum(isoDate) {
    if (!plan.startdatum) return plan.kader?.[0] || null;
    const weekNr = weeknummerVoorDatum(isoDate, plan.startdatum);
    return plan.kader?.find(w => w.week === weekNr) || plan.kader?.[0] || null;
  }

  // Hulp: week-in-fase (1-based) voor een kaderweek
  function weekInFaseVoorKaderWeek(kaderWeek) {
    if (!kaderWeek || !plan.kader) return 1;
    const sorted = [...plan.kader].sort((a, b) => a.week - b.week);
    const fase = kaderWeek.fase;
    let teller = 0;
    for (const w of sorted) {
      if (w.fase === fase) teller++;
      if (w.week === kaderWeek.week) return teller;
    }
    return 1;
  }

  const ontbrekend = [];
  // Per week bijhouden hoeveel al gepland — voor frequentie-stop
  const geplandPerWeek = {};

  // Initialiseer geplandPerWeek vanuit bestaandeSessies
  for (const s of bestaandeSessies) {
    if (s.voltooid || !s.datum) continue;
    if (s.type === "herstel_mobiliteit" || s.intentie?.sessietype === "herstel_mobiliteit") continue;
    const mISO = weekMaandagISO(s.datum);
    geplandPerWeek[mISO] = (geplandPerWeek[mISO] || 0) + 1;
  }

  for (let i = 1; i <= 10; i++) {
    const d = new Date(nu);
    d.setDate(nu.getDate() + i);
    const iso = datumISO(d);
    const dagNaam = DAGNAMEN[d.getDay()];
    if (!beschikbareDagen.includes(dagNaam) || bestaandeDatums.has(iso) || iso <= vandaag) continue;

    const mISO = weekMaandagISO(iso);
    const kaderWeek = kaderWeekVoorDatum(iso);
    const frequentie = kaderWeek?.trainingsfrequentie ?? maxTrainingsdagenPerWeek(ctlBasis);
    const reedsGepland = geplandPerWeek[mISO] || 0;

    // Stop-conditie 1: frequentie bereikt voor deze week
    if (reedsGepland >= frequentie) continue;

    // Stop-conditie 2: zou 4+ opeenvolgende trainingsdagen opleveren
    // Gebruik ALLE sessies (niet alleen dezelfde week) — reeks kan weekgrens overschrijden
    // Inclusief al toegevoegde ontbrekend-entries van deze run
    const alleSessiesVoorReeks = [
      ...bestaandeSessies.filter(s => !s.voltooid),
      ...ontbrekend,
    ];
    if (heeftTeLangReeks(alleSessiesVoorReeks, { datum: iso, type: "kandidaat" })) continue;

    ontbrekend.push({ datum: iso, dagNaam, uren: urenPerDag[dagNaam] || 1.5 });
    geplandPerWeek[mISO] = reedsGepland + 1;
  }

  if (ontbrekend.length === 0) return { status: "compleet" };

  let profiel;
  try {
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
  } catch {
    profiel = { ftp: plan.huidige_ftp || 265, lt_hr: 184, max_hr: 200, gewicht: 90, hrv_basislijn: 58, hr_basislijn: 49, power_zones: null };
  }

  let wellness = null;
  try {
    const wData = await intervalsGet("/wellness", { oldest: vandaag, newest: vandaag }, creds);
    if (wData?.length > 0) wellness = wData[0];
  } catch {}

  const piekSprint = await kv.get(`piek_sprint_vermogen:${userId}`) || Math.round((profiel.ftp || 265) * 1.8);
  const hrvProfiel = await kv.get(`hrv-profiel:${userId}`);

  const tsb = wellness ? Math.round((wellness.ctl ?? 0) - (wellness.atl ?? 0)) : null;

  const aangevuld = [];

  for (const { datum, dagNaam, uren } of ontbrekend) {
    try {
      const overigeSessies = [...bestaandeSessies, ...aangevuld]
        .filter(s => s.datum !== datum && !s.voltooid);

      let promptExtra = "";
      if (aerobeDagen.includes(datum)) {
        promptExtra += "\n\nVOLUMECORRECTIE — AEROBE COMPENSATIE: Deze sessie wordt toegevoegd als aerobe volumecompensatie op basis van een volumecorrectie-evaluatie. Het doel is extra aerobe stimulus. Gebruik uitsluitend sessietypes die primair het aerobe systeem trainen: z2_duur of progressief. Gebruik geen kracht_lage_cadans, sprint_neuraal, microbursts of andere neuromusculaire sessietypes — die dienen een ander fysiologisch doel en zijn niet geschikt als volumecompensatie.";
      }
      if (tempoAfsluiters.includes(datum)) {
        const maxMinuten = Math.round(uren * 60);
        promptExtra += `\n\nVOLUMECORRECTIE — TEMPO-AFSLUITER (harde instructie): Voeg aan het einde van deze sessie een Z3-tempo-afsluiter toe van 15-20 minuten. Dit is een harde instructie vanuit de volumecorrectie-evaluatie — geen suggestie. De rest van de sessie blijft Z2. Zorg dat de totale sessieduur binnen ${maxMinuten} minuten blijft.`;
      }

      const kaderWeekVoorDag = kaderWeekVoorDatum(datum);
      const huidigeFase = kaderWeekVoorDag?.fase ?? 'basis';
      const weekInFase = weekInFaseVoorKaderWeek(kaderWeekVoorDag);

      // Sectie 47: dag-intentie (alleen sessietype+tss_doel) via een lichte
      // Claude-aanroep, zodat genereerSessieDag daarna deterministisch kan
      // genereren. Volumecorrectie-dagen slaan dit over — die vereisen precieze
      // structurele ingrepen (bv. een aangeplakt Z3-blok) die het archetype/
      // variant-systeem niet kan uitdrukken, dus die blijven volledig via Claude
      // (met promptExtra) lopen, zoals vóór sectie 47.
      const isVolumeCorrectieDag = aerobeDagen.includes(datum) || tempoAfsluiters.includes(datum);
      let oudeSessieVoorGeneratie = null;
      if (!isVolumeCorrectieDag) {
        const aantalWekenInFase = (plan.kader || []).filter(w => w.fase === huidigeFase).length || 1;
        const mISOVoorIntentie = weekMaandagISO(datum);
        const geplandeDagenDezeWeek = [...bestaandeSessies, ...aangevuld]
          .filter(s => s.datum !== datum && weekMaandagISO(s.datum) === mISOVoorIntentie)
          .map(s => ({ dag: s.dag || DAGNAMEN[new Date(s.datum).getDay()], sessietype: s.intentie?.sessietype || s.type, tss: s.tss ?? 0 }));

        try {
          const dagIntentie = await bepaalDagIntentieMetRetry({
            fase: huidigeFase, weekInFase, aantalWekenInFase,
            weektype: kaderWeekVoorDag?.weektype || 'opbouw',
            kaderWeek: kaderWeekVoorDag,
            weekTssDoel: kaderWeekVoorDag?.tss_doel ?? 0,
            geplandeDagen: geplandeDagenDezeWeek,
            datum, dagNaam, beschikbareUren: uren,
          });
          oudeSessieVoorGeneratie = { intentie: { sessietype: dagIntentie.sessietype, tss_doel: dagIntentie.tss_doel } };
        } catch (e) {
          console.error(`[sessiesAanvullen] Dag-intentie mislukt voor ${datum} — dag overgeslagen:`, e.message);
          continue;
        }
      }

      const sessie = await genereerSessieDag({
        kv, userId, datum, dagNaam, uren,
        profiel, wellness, plan, overigeSessies,
        oudeSessie: oudeSessieVoorGeneratie,
        aanleiding: aerobeDagen.includes(datum) ? "volumecorrectie_aerobe" : tempoAfsluiters.includes(datum) ? "volumecorrectie_tempo_afsluiter" : "beschikbaarheid_nieuw",
        promptExtra, huidigeFase, weekInFase, hrvProfiel, piekSprint,
        alleSessiesVoorKrachtCheck: [...bestaandeSessies, ...aangevuld],
      });

      // Sprint-staartjes post-generatie check: z2_duur in basisfase
      if (
        huidigeFase === 'basis' &&
        kaderWeekVoorDag?.weektype !== 'herstel' &&
        (sessie.intentie?.sessietype === 'z2_duur' || sessie.intentie?.sessietype === 'z2_heuvel') &&
        !sessie.intentie?.heeft_sprint_staartjes &&
        (tsb === null || tsb >= -25)
      ) {
        const mISO = weekMaandagISO(datum);
        const alleWeekSessies = [
          ...bestaandeSessies.filter(s => weekMaandagISO(s.datum) === mISO),
          ...aangevuld.filter(s => weekMaandagISO(s.datum) === mISO),
          { ...sessie, datum },
        ];
        // Skip als een andere sessie in deze week de vlag al heeft (bijv. via plan-opslag)
        const heeftAlSprintVlag = alleWeekSessies.some(
          s => s.datum !== datum && s.intentie?.heeft_sprint_staartjes === true
        );
        if (!heeftAlSprintVlag && magSprintStaartje({ ...kaderWeekVoorDag, dagen: alleWeekSessies }, { ...sessie, datum }, tsb)) {
          const sprintIntentie = {
            ...sessie.intentie,
            heeft_sprint_staartjes: true,
            toegestane_zones: (sessie.intentie?.toegestane_zones || ['Z2']).includes('Z7')
              ? sessie.intentie.toegestane_zones
              : [...(sessie.intentie?.toegestane_zones || ['Z2']), 'Z7'],
          };
          const sprintPromptData = bouwSessieDagPrompt({
            profiel, wellness, dagelijkseData: [], voortgang: null,
            seizoensplan: { ...plan, weekSessies: undefined },
            overigeSessies: [...bestaandeSessies, ...aangevuld].filter(s => s.datum !== datum && !s.voltooid),
            datum, dagNaam, uren,
            oudeSessie: { ...sessie, intentie: sprintIntentie },
            aanleiding: 'beschikbaarheid_nieuw',
          });
          try {
            const sprintRaw = await claudeCall(sprintPromptData);
            const sprintSessie = sprintRaw.sessie || sprintRaw.sessies?.[0] || sprintRaw;
            if (!sprintSessie.datum) sprintSessie.datum = datum;
            if (!sprintSessie.dag) sprintSessie.dag = dagNaam;
            Object.assign(sessie, sprintSessie);
            if (sessie.intentie) {
              sessie.intentie.heeft_sprint_staartjes = true;
              if (!sessie.intentie.toegestane_zones?.includes('Z7')) {
                sessie.intentie.toegestane_zones = [...(sessie.intentie.toegestane_zones || ['Z2']), 'Z7'];
              }
            }
            normaliseerSessieSegmenten(sessie);
            voegVerwachtRpeToe(sessie);
            corrigeerSessieTss(sessie);
            console.log(`[sessiesAanvullen] Sprint-staartjes geregenereerd voor ${datum}`);
          } catch (e) {
            console.warn(`[sessiesAanvullen] Sprint-staartjes regeneratie mislukt voor ${datum}:`, e.message);
          }
        }
      }

      // Deterministisch vangnet: verboden sessietypes bij volumecorrectie.
      // Dit vervangt segmenten NA genereerSessieDag's interne vermogensbereik-stap,
      // dus het vervangende Z2-blok moet hier zelf opnieuw door berekenBlok.
      const isVolumeCorrectie = aerobeDagen.includes(datum) || tempoAfsluiters.includes(datum);
      if (isVolumeCorrectie) {
        const sessietype = sessie.intentie?.sessietype || sessie.sessietype || "";
        if (VERBODEN_TYPES_VOLUMECORRECTIE.includes(sessietype)) {
          const reden = `${sessietype} niet toegestaan bij volumecorrectie`;
          console.warn(`[sessiesAanvullen] ${userId} ${datum}: type-fix → z2_duur (${reden})`);
          try {
            await kv.set(`volumecorrectie_type_fix:${userId}:${datum}`, { datum, vervangen: sessietype, door: "z2_duur", reden }, { ex: 30 * 86400 });
          } catch {}
          sessie.type = "duur_variabel";
          sessie.titel = "Z2 Duur — Volumecorrectie";
          if (sessie.intentie) {
            sessie.intentie.sessietype = "z2_duur";
            sessie.intentie.rol = "aerobe_dag";
            sessie.intentie.toegestane_zones = ["Z2"];
          }
          sessie.duur_min = Math.round(uren * 60);
          sessie.segmenten = [{
            zone: "Z2",
            positie: "midden",
            blokDuurSeconden: sessie.duur_min * 60,
            isSpecifiek: false,
            sessietype: "z2_duur",
          }];
          corrigeerSessieTss(sessie);
          if (profiel.power_zones && profiel.ftp) {
            try {
              const zones = bouwZonesUitProfiel(profiel.ftp, profiel.power_zones);
              sessie.segmenten = sessie.segmenten.map(seg => berekenBlok(seg, zones, profiel.ftp, piekSprint, "z2_duur"));
            } catch (e) { console.warn(`[sessiesAanvullen] Vermogensbereik mislukt voor ${datum}:`, e.message); }
          }
        }
      }

      const totaalMinuten = (sessie.segmenten || []).reduce((som, seg) => som + (seg.blokDuurSeconden || seg.duur_min * 60 || 0), 0) / 60;
      if (totaalMinuten < 60) {
        console.warn(`[sessiesAanvullen] ${userId} ${datum}: sessie te kort (${Math.round(totaalMinuten)} min) — overgeslagen`);
        continue;
      }

      if (aerobeDagen.includes(datum)) {
        sessie.volumecorrectie = { aanleiding: "nieuwe_dag", beschikbareDagen: beschikbareDagenAantal, weekNr: aankomendeWeekNr };
      } else if (tempoAfsluiters.includes(datum)) {
        sessie.volumecorrectie = { aanleiding: "tempo_afsluiter", beschikbareDagen: beschikbareDagenAantal, weekNr: aankomendeWeekNr };
      }

      // Z1-validatie (STAP 5) — vermogensbereik is al toegepast binnen genereerSessieDag
      {
        const sessietype = sessie.intentie?.sessietype || sessie.sessietype || sessie.type;
        if (!valideerZ1Gebruik(sessie.segmenten, sessietype, sessie.archetype_id ?? null)) {
          throw new Error(`Z1-validatie mislukt voor sessietype ${sessietype} op ${datum}`);
        }
      }

      try {
        const zwo = segmentenNaarZwo(sessie.segmenten, sessie.titel, profiel.ftp || 265);
        const eventBody = {
          category: "WORKOUT",
          start_date_local: `${datum}T08:00:00`,
          name: sessie.titel || sessie.type,
          type: "Ride",
          moving_time: (sessie.duur_min || 90) * 60,
          ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
        };
        const result = await intervalsPost("/events", eventBody, creds);
        if (result.id) {
          sessie.intervalsEventId = result.id;
          if (result.icu_training_load) {
            sessie.tss = result.icu_training_load;
            sessie.tss_bron = "intervals_icu";
          }
        }
      } catch (e) {
        console.warn(`[sessiesAanvullen] Intervals sync mislukt voor ${datum}:`, e.message);
      }

      aangevuld.push(sessie);
      console.log(`[sessiesAanvullen] ${userId} ${datum}: ${sessie.type} ${sessie.duur_min}min`);
    } catch (e) {
      console.error(`[sessiesAanvullen] ${userId} ${datum} mislukt:`, e.message);
    }
  }

  if (aangevuld.length > 0) {
    const huidigPlan = await kv.get(planKey);
    const bestaandeDatumsNu = new Set((huidigPlan.weekSessies?.sessies || []).map(s => s.datum));
    const uniekAangevuld = aangevuld.filter(s => !bestaandeDatumsNu.has(s.datum));
    if (uniekAangevuld.length > 0) {
      huidigPlan.weekSessies = {
        ...huidigPlan.weekSessies,
        sessies: [...(huidigPlan.weekSessies?.sessies || []), ...uniekAangevuld],
      };
      await kv.set(planKey, huidigPlan);
    }
  }

  // Verlengingen: bestaande sessies regenereren met uitgebreide duur tot het dag-maximum
  const verlengd = [];
  for (const { datum, maxMinuten } of verlengingen) {
    try {
      const bestaandeSessie = bestaandeSessies.find(s => s.datum === datum && !s.voltooid);
      if (!bestaandeSessie) {
        console.warn(`[sessiesAanvullen] verleng_sessie: geen niet-voltooide sessie gevonden voor ${datum}`);
        continue;
      }
      if (!maxMinuten) {
        console.warn(`[sessiesAanvullen] verleng_sessie: maxMinuten ontbreekt voor ${datum}, overgeslagen`);
        continue;
      }
      const dagNaamV = bestaandeSessie.dag || DAGNAMEN[new Date(datum).getDay()];
      const urenV = maxMinuten / 60;

      const overigeSessies = [...bestaandeSessies, ...aangevuld]
        .filter(s => s.datum !== datum && !s.voltooid);

      const kaderWeekVoorDag = kaderWeekVoorDatum(datum);
      const huidigeFase = kaderWeekVoorDag?.fase ?? 'basis';
      const weekInFase = weekInFaseVoorKaderWeek(kaderWeekVoorDag);
      const promptExtra = `\n\nVOLUMECORRECTIE — VERLENGING (harde instructie): Verleng deze sessie van ${bestaandeSessie.duur_min || "?"}min naar maximaal ${maxMinuten}min. Behoud het sessietype en de intensiteitsstructuur. Voeg Z2-volume toe aan het einde. De totale sessieduur mag ${maxMinuten}min NIET overschrijden.`;

      const sessie = await genereerSessieDag({
        kv, userId, datum, dagNaam: dagNaamV, uren: urenV,
        profiel, wellness, plan, overigeSessies,
        oudeSessie: bestaandeSessie,
        aanleiding: "beschikbaarheid_uren",
        promptExtra, huidigeFase, weekInFase, hrvProfiel, piekSprint,
        alleSessiesVoorKrachtCheck: [...bestaandeSessies, ...aangevuld],
      });
      if (bestaandeSessie.intervalsEventId) sessie.intervalsEventId = bestaandeSessie.intervalsEventId;
      if (bestaandeSessie.intentie) sessie.intentie = { ...bestaandeSessie.intentie, ...sessie.intentie };

      sessie.volumecorrectie = { aanleiding: "verleng_sessie", weekNr: aankomendeWeekNr };

      try {
        const zwo = segmentenNaarZwo(sessie.segmenten, sessie.titel, profiel.ftp || 265);
        const eventBody = {
          category: "WORKOUT",
          start_date_local: `${datum}T08:00:00`,
          name: sessie.titel || sessie.type,
          type: "Ride",
          moving_time: (sessie.duur_min || 90) * 60,
          ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
        };
        const result = await intervalsPost("/events", eventBody, creds);
        if (result.id) {
          sessie.intervalsEventId = result.id;
          if (result.icu_training_load) { sessie.tss = result.icu_training_load; sessie.tss_bron = "intervals_icu"; }
        }
      } catch (e) {
        console.warn(`[sessiesAanvullen] Intervals sync mislukt voor verlengd ${datum}:`, e.message);
      }

      verlengd.push(sessie);
      console.log(`[sessiesAanvullen] verleng_sessie ${userId} ${datum}: ${sessie.type} ${sessie.duur_min}min (max ${maxMinuten}min)`);
    } catch (e) {
      console.error(`[sessiesAanvullen] verleng_sessie ${userId} ${datum} mislukt:`, e.message);
    }
  }

  if (verlengd.length > 0) {
    const huidigPlan = await kv.get(planKey);
    const verlengdDatums = new Set(verlengd.map(s => s.datum));
    huidigPlan.weekSessies = {
      ...huidigPlan.weekSessies,
      sessies: [
        ...(huidigPlan.weekSessies?.sessies || []).filter(s => !verlengdDatums.has(s.datum)),
        ...verlengd,
      ],
    };
    await kv.set(planKey, huidigPlan);
  }

  return { status: "aangevuld", aantal: aangevuld.length, datums: aangevuld.map(s => s.datum), verlengd: verlengd.map(s => s.datum) };
}
