import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet, intervalsPost } from "@/lib/intervals";
import { vandaagISO, datumISO, DAGNAMEN } from "@/lib/datum";
import { bouwSessieDagPrompt } from "@/lib/promptBuilder";
import { maxTrainingsdagenPerWeek, heeftTeLangReeks } from "@/lib/trainingsfrequentie";
import { segmentenNaarZwo } from "@/lib/workoutZwo";
import { normaliseerSessieSegmenten, valideerKrachtRestrictie } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";
import { berekenBlok, bouwZonesUitProfiel } from "@/lib/vermogensbereik";
import { claudeCall } from "@/lib/claude";

const VERBODEN_TYPES_VOLUMECORRECTIE = ["kracht_lage_cadans", "sprint_neuraal"];

export async function vulSessiesAanVoorGebruiker(userId, { aerobeDagen = [], tempoAfsluiters = [] } = {}) {
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
    const dagenSinds = Math.max(0, (new Date(isoDate) - new Date(plan.startdatum)) / 86400000);
    const weekNr = Math.max(1, Math.ceil(dagenSinds / 7));
    return plan.kader?.find(w => w.week === weekNr) || plan.kader?.[0] || null;
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

  const aangevuld = [];

  for (const { datum, dagNaam, uren } of ontbrekend) {
    try {
      const overigeSessies = [...bestaandeSessies, ...aangevuld]
        .filter(s => s.datum !== datum && !s.voltooid);

      const promptData = bouwSessieDagPrompt({
        profiel,
        wellness,
        dagelijkseData: [],
        voortgang: null,
        seizoensplan: { ...plan, weekSessies: undefined },
        overigeSessies,
        datum,
        dagNaam,
        uren,
        oudeSessie: null,
        aanleiding: aerobeDagen.includes(datum) ? "volumecorrectie_aerobe" : tempoAfsluiters.includes(datum) ? "volumecorrectie_tempo_afsluiter" : "beschikbaarheid_nieuw",
      });

      if (aerobeDagen.includes(datum)) {
        promptData.prompt += "\n\nVOLUMECORRECTIE — AEROBE COMPENSATIE: Deze sessie wordt toegevoegd als aerobe volumecompensatie op basis van een volumecorrectie-evaluatie. Het doel is extra aerobe stimulus. Gebruik uitsluitend sessietypes die primair het aerobe systeem trainen: z2_vlak, z2_variabel, of progressief. Gebruik geen kracht_lage_cadans, sprint_neuraal, microbursts of andere neuromusculaire sessietypes — die dienen een ander fysiologisch doel en zijn niet geschikt als volumecompensatie.";
      }

      if (tempoAfsluiters.includes(datum)) {
        const maxMinuten = Math.round(uren * 60);
        promptData.prompt += `\n\nVOLUMECORRECTIE — TEMPO-AFSLUITER (harde instructie): Voeg aan het einde van deze sessie een Z3-tempo-afsluiter toe van 15-20 minuten. Dit is een harde instructie vanuit de volumecorrectie-evaluatie — geen suggestie. De rest van de sessie blijft Z2. Zorg dat de totale sessieduur binnen ${maxMinuten} minuten blijft.`;
      }

      const raw = await claudeCall(promptData);
      const sessie = raw.sessie || raw.sessies?.[0] || raw;
      if (!sessie.datum) sessie.datum = datum;
      if (!sessie.dag) sessie.dag = dagNaam;
      normaliseerSessieSegmenten(sessie);
      voegVerwachtRpeToe(sessie);
      corrigeerSessieTss(sessie);

      // Deterministisch vangnet: verboden sessietypes bij volumecorrectie
      const isVolumeCorrectie = aerobeDagen.includes(datum) || tempoAfsluiters.includes(datum);
      if (isVolumeCorrectie) {
        const sessietype = sessie.intentie?.sessietype || sessie.sessietype || "";
        if (VERBODEN_TYPES_VOLUMECORRECTIE.includes(sessietype)) {
          const reden = `${sessietype} niet toegestaan bij volumecorrectie`;
          console.warn(`[sessiesAanvullen] ${userId} ${datum}: type-fix → z2_vlak (${reden})`);
          try {
            await kv.set(`volumecorrectie_type_fix:${userId}:${datum}`, { datum, vervangen: sessietype, door: "z2_vlak", reden }, { ex: 30 * 86400 });
          } catch {}
          sessie.type = "duur_variabel";
          sessie.titel = "Z2 Vlak — Volumecorrectie";
          if (sessie.intentie) {
            sessie.intentie.sessietype = "z2_vlak";
            sessie.intentie.rol = "aerobe_dag";
            sessie.intentie.toegestane_zones = ["Z2"];
          }
          sessie.duur_min = Math.round(uren * 60);
          sessie.segmenten = [{
            zone: "Z2",
            positie: "midden",
            blokDuurSeconden: sessie.duur_min * 60,
            isSpecifiek: false,
            sessietype: "z2_vlak",
          }];
          corrigeerSessieTss(sessie);
        }
      }

      // Centrale kracht-gate: max 1 kracht_lage_cadans per rollend 7-dagenvenster
      {
        const allesSessiesKracht = [...bestaandeSessies, ...aangevuld];
        const krachtCheck = valideerKrachtRestrictie(sessie, allesSessiesKracht);
        if (!krachtCheck.geldig) {
          console.warn(`[sessiesAanvullen] ${userId} ${datum}: kracht geblokkeerd — ${krachtCheck.reden} → z2_vlak`);
          try {
            await kv.set(`kracht_gate_fix:${userId}:${datum}`, { datum, reden: krachtCheck.reden, door: "z2_vlak" }, { ex: 30 * 86400 });
          } catch {}
          sessie.type = "duur_variabel";
          sessie.titel = "Z2 Vlak — Kracht geblokkeerd";
          if (sessie.intentie) {
            sessie.intentie.sessietype = "z2_vlak";
            sessie.intentie.rol = "aerobe_dag";
            sessie.intentie.toegestane_zones = ["Z2"];
          }
          sessie.duur_min = Math.round(uren * 60);
          sessie.segmenten = [{
            zone: "Z2",
            positie: "midden",
            blokDuurSeconden: sessie.duur_min * 60,
            isSpecifiek: false,
            sessietype: "z2_vlak",
          }];
          corrigeerSessieTss(sessie);
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

      if (profiel.power_zones && profiel.ftp) {
        try {
          const zones = bouwZonesUitProfiel(profiel.ftp, profiel.power_zones);
          const sessietype = sessie.intentie?.sessietype || sessie.sessietype || sessie.type;
          sessie.segmenten = (sessie.segmenten || []).map(seg =>
            seg.zone ? berekenBlok(seg, zones, profiel.ftp, piekSprint, sessietype) : seg
          );
        } catch (e) { console.warn(`[sessiesAanvullen] Vermogensbereik mislukt voor ${datum}:`, e.message); }
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
    huidigPlan.weekSessies = {
      ...huidigPlan.weekSessies,
      sessies: [...(huidigPlan.weekSessies?.sessies || []), ...aangevuld],
    };
    await kv.set(planKey, huidigPlan);
  }

  return { status: "aangevuld", aantal: aangevuld.length, datums: aangevuld.map(s => s.datum) };
}
