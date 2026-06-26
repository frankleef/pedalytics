// Server-side prompt-bouwers voor sessiegeneratie.
// Elke functie retourneert { prompt, system, max_tokens }.

import { vandaagISO, datumISO, DAGNAMEN } from "./datum";
import { bouwSessieContext } from "./sessie/context";

function sessietypesVoorFase(fase, kaderWeek) {
  if (kaderWeek?.sessietypes?.length > 0) return kaderWeek.sessietypes.join(", ");
  const tabel = {
    basis: "z2_vlak, z2_variabel, z2_cadans, z2_heuvel, progressief, z1_herstel, herstel_mobiliteit — GEEN intensiteitssessies",
    sweetspot: "sweetspot_intervallen, sweetspot_lang, over_under, microbursts, z2_vlak, z2_variabel, z2_cadans, progressief, z1_herstel, herstel_mobiliteit",
    drempel: "drempel_intervallen, over_under, pyramide, vo2max_lang, vo2max_kort, z2_vlak, z2_variabel, progressief, z1_herstel, herstel_mobiliteit",
    consolidatie: "race_simulatie, drempel_intervallen, over_under, z2_variabel, z1_herstel, herstel_mobiliteit",
    test: "z2_vlak, ramp_test",
  };
  return tabel[fase] || tabel.basis;
}

function z1z2Doel(niveau) {
  return { starter: "90%", recreatief: "80%", getraind: "75%" }[niveau] || "80%";
}

export function bouwSeizoensplanPrompt({ profiel, doelConfig, kader }) {
  const { DOELPROFIELEN, fasetabelAlsTekst, doelInstructiesAlsTekst } = require("./seizoen/doelprofielen");
  const week1 = kader[0];
  const week2 = kader[1];
  const niveau = doelConfig.ervaringsniveau || "recreatief";
  const doelType = doelConfig.seizoensdoel?.type || doelConfig.doel || "ftp";
  const doelProfiel = DOELPROFIELEN[doelType] || DOELPROFIELEN.ftp;

  return {
    prompt: `Genereer concrete trainingssessies voor week 1 en 2 van een fietsplan.

SEIZOENSDOEL: ${doelType} — ${doelProfiel.naam}
Dit plan volgt uitsluitend de fasevolgorde, intensiteitsdistributie en sessietypes hieronder.

FASETABEL:
${fasetabelAlsTekst(doelProfiel)}

DOEL-SPECIFIEKE INSTRUCTIES:
${doelInstructiesAlsTekst(doelProfiel)}

PROFIEL: FTP ${doelConfig.huidige_ftp}W | LT ${profiel.lt_hr} bpm | Max HR ${profiel.max_hr} bpm | ${profiel.gewicht} kg | CTL ~${doelConfig.huidige_ctl} | Ervaringsniveau: ${niveau}
DOEL: ${doelConfig.doel_label}

START-TSS: ${doelConfig.start_profiel?.start_tss_week || 200} TSS voor week 1.
Na elke herstelweek begint de opbouw opnieuw vanaf deze waarde — niet cumulatief.

WEEKSTRUCTUUR (verplicht):
- 3:1-ritme: 3 opbouwweken gevolgd door 1 herstelweek, herhaald
- Opbouwweken: TSS stijgt ~${opbouwPct} per week
- Herstelweek TSS: 40-50% van de piekweek
- Week 1 weektype: ${week1.weektype}, Week 2 weektype: ${week2.weektype}

WEEK 1: fase=${week1.fase}, weektype=${week1.weektype}, TSS-doel=${week1.tss_doel}, focus=${week1.focus}
WEEK 2: fase=${week2.fase}, weektype=${week2.weektype}, TSS-doel=${week2.tss_doel}, focus=${week2.focus}

Maak 3 fietssessies per week. Verdeel over de week met rustdagen ertussen.

SESSIETYPES VOOR DEZE FASE:
- Week 1 (${week1.fase}): ${sessietypesVoorFase(week1.fase, week1)}
- Week 2 (${week2.fase}): ${sessietypesVoorFase(week2.fase, week2)}

DAG-INTENTIE (verplicht voor elke trainingsdag):
Elke sessie bevat een "intentie"-object met:
- rol: één van [intensiteitsdag, aerobe_dag, hersteldag, variabele_dag, ftp_test]
- sessietype: één van [sweetspot_intervallen, sweetspot_lang, drempel_intervallen, over_under, pyramide, vo2max_intervallen, vo2max_lang, vo2max_kort, microbursts, race_simulatie, progressief, sprint_neuraal, kracht_lage_cadans, z2_vlak, z2_variabel, z2_cadans, z2_heuvel, z2_tempo_teugjes, z2_steady, z2_lang, z2_embedded_sprint, sprint_peak_test, z1_herstel, herstel_actief, herstel_mobiliteit, ramp_test]
- toegestane_zones: array van zones die deze dag gebruikt mogen worden (bv. ["Z1", "Z2"])
- tss_range: { min, max } waarbinnen de TSS moet vallen
- toelichting: één zin over de rol van deze dag in het weekpatroon

INTENSITEITSDISTRIBUTIE:
- Z1-Z2 doel-aandeel: ${z1z2Doel(niveau)}
- Max intensiteitssessies per week: ${niveau === "starter" ? "1" : niveau === "getraind" ? "2" : "1-2"}

Geef JSON:
{
  "samenvatting": "2-3 zinnen over de aanpak",
  "streefwaarde": "bijv. 280-290W na 12 weken",
  "detail_weken": [
    {
      "week": 1, "fase": "${week1.fase}", "weektype": "${week1.weektype}", "weekdoel": "...",
      "sessies": [
        {
          "dag": "Dinsdag",
          "type": "duur_lang|duur_variabel|sweetspot|interval|herstel|ftp_test",
          "titel": "...", "tss": 90, "duur_min": 150,
          "vermogen": "170-195W", "hartslag": "<152 bpm", "reden": "...",
          "intentie": {
            "rol": "aerobe_dag",
            "sessietype": "z2_vlak",
            "toegestane_zones": ["Z1", "Z2"],
            "tss_range": { "min": 70, "max": 100 },
            "toelichting": "Aerobe basis opbouwen"
          }
        }
      ]
    },
    {
      "week": 2, "fase": "${week2.fase}", "weektype": "${week2.weektype}", "weekdoel": "...",
      "sessies": [...]
    }
  ]
}
Alleen JSON.`,
    system: "Je bent een professionele fietscoach. Geef concrete sessies in JSON met dag-intentie per sessie. Nederlands.",
    max_tokens: 4000,
  };
}

export function bouwWeekSessiesPrompt({ profiel, wellness, dagelijkseData, voortgang, seizoensplan, weekSessies, urenPerDag, beschikbareDagen }) {

  const ctl = wellness?.ctl || seizoensplan.huidige_ctl || 45;
  const atl = wellness?.atl || 0;
  const tsb = Math.round(ctl - atl);
  const maxDagen = ctl < 30 ? 2 : ctl < 40 ? 3 : ctl < 60 ? 4 : ctl < 80 ? 5 : 6;

  const nu = new Date();
  const vandaagISOStr = vandaagISO();

  const planDagen = [];
  for (let i = 0; i <= 10; i++) {
    const d = new Date(nu); d.setDate(nu.getDate() + i);
    const iso = datumISO(d);
    const dagNaam = DAGNAMEN[d.getDay()];
    planDagen.push({ datum: iso, dag: dagNaam, beschikbaar: !!beschikbareDagen.includes(dagNaam), uren: urenPerDag[dagNaam] || 1.5 });
  }

  const voltooideDatams = new Set();
  const bestaandeSessies = weekSessies?.sessies || [];
  (voortgang?.ritten || []).forEach(rit => {
    if (!rit.datum_iso) return;
    const match = bestaandeSessies.find(s => s.datum === rit.datum_iso || (!s.datum && s.dag === DAGNAMEN[new Date(rit.datum_iso).getDay()]));
    if (match && rit.datum_iso <= vandaagISOStr) voltooideDatams.add(rit.datum_iso);
  });

  const tePlannenDagen = planDagen.filter(d => d.beschikbaar && !voltooideDatams.has(d.datum) && d.datum >= vandaagISOStr);
  if (tePlannenDagen.length === 0) return null;

  const dagenSindsStart = Math.max(0, (Date.now() - new Date(seizoensplan.startdatum).getTime()) / 86400000);
  const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
  const kaderWeek = seizoensplan.kader?.find(w => w.week === weekNr) || seizoensplan.kader?.[0] || { fase: "basis", tss_doel: 250, focus: "Z2 volume" };
  const kaderWeek2 = seizoensplan.kader?.find(w => w.week === weekNr + 1) || kaderWeek;

  const weekGeleden = new Date(Date.now() - 7 * 86400000);
  const recenteRitten = (voortgang?.ritten || [])
    .filter(r => r.datum_iso && new Date(r.datum_iso) >= weekGeleden)
    .map(r => `${r.datum}: ${r.naam} | ${r.wattage || "?"}W | HR ${r.hartslag || "?"} | ${r.tss || "?"} TSS${r.rpe ? ` | RPE ${r.rpe}/10` : ""}`)
    .join("\n") || "Geen ritten afgelopen week";

  const vorigeKaderWeek = seizoensplan.kader.find(w => w.week === weekNr - 1);
  const vorigWeekRitten = (voortgang?.ritten || []).filter(r => {
    if (!r.datum_iso) return false;
    const d = new Date(r.datum_iso);
    return d >= new Date(Date.now() - 14 * 86400000) && d < weekGeleden;
  });
  const werkelijkeTssVorig = Math.round(vorigWeekRitten.reduce((s, r) => s + (r.tss || 0), 0));
  const geplandeTssVorig = vorigeKaderWeek?.tss_doel || 0;
  const rpeVorig = vorigWeekRitten.filter(r => r.rpe);
  const gemRpeVorig = rpeVorig.length > 0 ? (rpeVorig.reduce((s, r) => s + r.rpe, 0) / rpeVorig.length).toFixed(1) : null;

  const recenteHrv = (dagelijkseData || []).filter(d => d.hrv).slice(-5);
  let hrvTrend = "stabiel";
  if (recenteHrv.length >= 3) {
    const eerste = recenteHrv.slice(0, 2).reduce((s, d) => s + d.hrv, 0) / 2;
    const laatste = recenteHrv.slice(-2).reduce((s, d) => s + d.hrv, 0) / 2;
    if (laatste < eerste - 3) hrvTrend = "dalend";
    else if (laatste > eerste + 3) hrvTrend = "stijgend";
  }
  const hrvVandaag = recenteHrv.length > 0 ? recenteHrv[recenteHrv.length - 1].hrv : null;

  const veertienDagenGeleden = new Date(Date.now() - 14 * 86400000);
  const rittenMetRpe = (voortgang?.ritten || []).filter(r => r.rpe && r.datum_iso && new Date(r.datum_iso) >= veertienDagenGeleden);
  let rpeAnalyse = "";
  if (rittenMetRpe.length >= 2) {
    const gemRpe = +(rittenMetRpe.reduce((s, r) => s + r.rpe, 0) / rittenMetRpe.length).toFixed(1);
    const tssRatio = geplandeTssVorig > 0 ? +(werkelijkeTssVorig / geplandeTssVorig).toFixed(2) : null;
    let signaal = "passend";
    if (gemRpe > 7 && (!tssRatio || tssRatio < 1.1)) signaal = "STRUCTUREEL TE ZWAAR — verlaag intensiteit 10%";
    else if (gemRpe < 5 && (!tssRatio || tssRatio > 0.9)) signaal = "STRUCTUREEL TE LICHT — verhoog intensiteit 5-10%";
    else if (gemRpe > 7) signaal = "RPE hoog maar TSS ook hoog — monitoren";

    const rpePerType = {};
    rittenMetRpe.forEach(r => {
      const sessie = bestaandeSessies.find(s => s.datum === r.datum_iso || (!s.datum && s.dag === DAGNAMEN[new Date(r.datum_iso).getDay()]));
      const type = sessie?.type || "onbekend";
      if (!rpePerType[type]) rpePerType[type] = [];
      rpePerType[type].push(r.rpe);
    });
    const typeRegels = Object.entries(rpePerType).map(([type, rpeLijst]) => {
      const gem = +(rpeLijst.reduce((s, v) => s + v, 0) / rpeLijst.length).toFixed(1);
      const advies = gem > 7.5 ? "te zwaar, vermogen verlagen" : gem < 4 ? "te licht, vermogen verhogen" : "passend";
      return `  ${type}: gem RPE ${gem} (${rpeLijst.length} ritten) — ${advies}`;
    }).join("\n");

    rpeAnalyse = `\nRPE-ANALYSE (afgelopen 14 dagen, ${rittenMetRpe.length} ritten):\n- Gemiddelde RPE: ${gemRpe}/10\n${tssRatio ? `- TSS-ratio (werkelijk/gepland): ${Math.round(tssRatio * 100)}%\n` : ""}- Signaal: ${signaal}\n- RPE per trainingstype:\n${typeRegels}`;
  }

  const doelType = seizoensplan.seizoensdoel?.type || "ftp";

  return {
    prompt: `Maak concrete trainingssessies voor een wielrenner voor de komende 10 dagen.

SEIZOENSDOEL: ${doelType}

PROFIEL: FTP ${profiel.ftp}W | LT ${profiel.lt_hr} bpm | Max HR ${profiel.max_hr} bpm | ${profiel.gewicht} kg

HUIDIGE STAAT:
- CTL: ${Math.round(ctl)} (fitheid) | ATL: ${Math.round(atl)} (vermoeidheid) | TSB: ${tsb} (vorm)
- HRV vandaag: ${hrvVandaag || "onbekend"} ms (basislijn ${profiel.hrv_basislijn || 58} ms) | HRV trend: ${hrvTrend}
- Rusthartslag: ${wellness?.restingHR || "onbekend"} bpm (basislijn ${profiel.hr_basislijn || 49} bpm)

VORIGE WEEK:
${geplandeTssVorig > 0 ? `- Gepland: ${geplandeTssVorig} TSS | Werkelijk: ${werkelijkeTssVorig} TSS (${Math.round(werkelijkeTssVorig / geplandeTssVorig * 100)}%)` : "- Geen data vorige week"}
${gemRpeVorig ? `- Gemiddelde RPE: ${gemRpeVorig}/10` : ""}
${rpeAnalyse}
RECENTE RITTEN:
${recenteRitten}

PLANPERIODE:
- Huidige fase: ${kaderWeek.fase} — ${kaderWeek.focus} (TSS-doel ${kaderWeek.tss_doel}/week, weektype: ${kaderWeek.weektype || "opbouw"})
${kaderWeek2 !== kaderWeek ? `- Volgende fase: ${kaderWeek2.fase} — ${kaderWeek2.focus} (TSS-doel ${kaderWeek2.tss_doel}/week, weektype: ${kaderWeek2.weektype || "opbouw"})` : ""}
- Ervaringsniveau: ${seizoensplan.ervaringsniveau || "recreatief"}
- Toegestane sessietypes deze fase: ${sessietypesVoorFase(kaderWeek.fase, kaderWeek)}

BESCHIKBARE DAGEN (plan ALLEEN op deze datums):
${tePlannenDagen.map(d => `  ${d.datum} (${d.dag}): ${d.uren} uur`).join("\n")}

${voltooideDatams.size > 0 ? `AL VOLTOOID (NIET herplannen): ${[...voltooideDatams].join(", ")}` : ""}

REGELS:
- Jij kiest welke beschikbare dagen een training krijgen (max ${maxDagen} per week bij CTL ${Math.round(ctl)})
- DUUR: pas de trainingsduur aan op de beschikbare uren per dag. Nooit langer dan opgegeven
- Kies dagen met beste spreiding, min 1 rustdag tussen harde sessies
- SUPERCOMPENSATIE: plan harde sessies (sweetspot/interval) op dagen waar TSB tussen -5 en +10 zit
- Als TSB < -20: alleen Z2 of herstel, geen intensiteit
- Als HRV dalend: stel intensiteitsblok uit, focus op Z2
- Als vorige week RPE > 7 en TSS < 80%: verlaag deze week met 10%
- Z1-Z2 doel-aandeel: ${kaderWeek.z1z2_doel ? Math.round(kaderWeek.z1z2_doel * 100) + "%" : z1z2Doel(seizoensplan.ervaringsniveau || "recreatief")} | Max ~150 TSS per sessie
- Max intensiteitssessies deze week: ${kaderWeek.max_intensiteit ?? 1}
- Geef bij elke sessie een concrete, data-gedreven reden

SESSIETYPES:
- duur_lang: vlakke Z2 duurrit (68-76% FTP constant)
- duur_variabel: afwisselende Z2/Z3 blokken (Z2 = 68-76% FTP, Z3 = 76-85% FTP, NOOIT hoger). Herstelblokken in Z2
- sweetspot: 88-93% FTP blokken met Z2-herstel ertussen
- interval: 95-120% FTP blokken met Z2-herstel ertussen
- herstel: laag vermogen (50-60% FTP)
- over_under: sets van 2m @ 86-90% FTP (under) + 1m @ 103-107% FTP (over), 5m Z2 herstel tussen sets. TSS 70-90
- sprint_neuraal: 6-8x sprint 10-15s @ max (>150% FTP), 3-5m Z1 herstel. TSS 30-45. Nooit naast intensiteitsdag
- pyramide: oplopend+aflopend rondom drempel: 2m→4m→6m→4m→2m @ 95-105% FTP, Z2 herstel. TSS 75-100
- kracht_lage_cadans: 4-6x 5min @ 88-100% FTP met cadans_rpm {min:48, max:58}, 3min Z2 herstel ertussen (cadans terug naar 85-95 rpm). TSS 55-80. Voeg cadans_rpm toe aan de segmenten
- z2_embedded_sprint: Z2 duurrit met 4-6 ingebedde max sprints (10-15s), 5min Z1 herstel na elke sprint. TSS 50-70
- sprint_peak_test: 3x max sprint 10s, 5min Z1 rust ertussen. Eindtest voor sprint-doel

UITGEBREIDE SESSIETYPES (gebruik alleen op de aangegeven posities en fasen):
- sweetspot_lang: 2×20 of 3×15 min @ 88–93% FTP, 5 min herstel. Traint drempeluithoudingsvermogen. Sweetspot-fase, max 1× per 2 weken. Niet voor starters
- vo2max_lang: 3–4× 8–12 min @ 100–108% FTP, gelijke rusttijd (1:1). Seiler Long Intervals. Drempel-fase, klimmen-doel weken 9–11. Niet voor starters
- vo2max_kort: 40/20's of 30/15's: 20–40 sec @ 110–130% FTP + 10–20 sec Z1, herhaald 10–15× per serie, 2–4 series. Drempel-fase. Starters: alleen 30/15, max 2 series
- microbursts: 15/15's: 15 sec @ 110–120% FTP + 15 sec Z1, 15–20× per serie, 2–3 series. Klimmen/sprint-doel, na week 5. Niet voor starters
- race_simulatie: 30–40 min Z2 + 4–6× aanvallen (30–60 sec @ 130–150% FTP, 3–5 min herstel) + 15–20 min Z2 uitrijden. Consolidatie-fase. Alle niveaus
- progressief: oplopend per kwartier: Z1 → Z2 → Z3 → Z4 → Z1 uitrijden. Variabele dag in opbouwfase. Alle niveaus
- herstel_mobiliteit: 20–30 min Z1 + mobiliteitswerk-reminder. Herstelweken of na zware dag. Alle niveaus

OVERGANGSWEEK (overgangsfase):
Eén week tussen sweetspot en drempel. Twee intensiteitsdagen verplicht, minimaal 48u van elkaar:
- Dag 1: sweetspot_lang (langste sweetspot-blok van het plan, ≥20 min)
- Dag 2: drempel_intervallen (3×8 min @ 97–100% FTP, herstel 1:1) — conservatief
Alle overige dagen: Z1–Z2 polarized. TSS-doel: 80–85% van piekweek sweetspot.

CONSOLIDATIEWEEK (consolidatie):
TSS-doel: 55–60% van piekweek drempel. Eén intensiteitsdag: drempel_intervallen (2×12 min @ 95–100% FTP) of race_simulatie.
Aerobe dagen: langer dan opbouwweken, lage intensiteit Z1–Z2. Rustdagen: 2–3.

NEUROMUSCULAIRE PRIMING (FTP-doel, basisweek):
Plan sprint_neuraal als intensiteitsdag in week 1 en week 3 van elk basisblok.
Structuur: 60–75 min Z2 met 6–8 maximale sprints van 8–10 seconden, 3–4 min Z1-herstel.
Plan sprint_neuraal NOOIT adjacent aan een andere intensiteitsdag.

ZONE-RESTRICTIE — Z1 HERSTELBLOKKEN:
Z1 (<55% FTP) is ALLEEN toegestaan als herstelblok in: sprint_neuraal, vo2max_intervallen, vo2max_kort, microbursts, z2_embedded_sprint, sprint_peak_test.
In ALLE andere sessietypes gebruik je Z2 voor herstelblokken:
- kracht_lage_cadans: herstel → Z2 (positie "onder"), cadans terug naar 85-95 rpm
- sweetspot/drempel: herstel → Z2 (positie "midden")
- over_under: under-fase → Z3 (positie "onder"), herstel tussen sets → Z2
- pyramide: herstel → Z2 (positie "midden")
- duur_variabel: herstel → Z2 (positie "onder")
Z2-herstel houdt de aerobe stimulus actief. Z1 is uitsluitend voor volledig herstel na maximale inspanningen.

DAG-INTENTIE (verplicht voor elke trainingsdag):
Elke sessie moet een "intentie"-object bevatten met:
- rol: één van [intensiteitsdag, aerobe_dag, hersteldag, variabele_dag, ftp_test]
- sessietype: één van [sweetspot_intervallen, sweetspot_lang, drempel_intervallen, over_under, pyramide, vo2max_intervallen, vo2max_lang, vo2max_kort, microbursts, race_simulatie, progressief, sprint_neuraal, kracht_lage_cadans, z2_vlak, z2_variabel, z2_cadans, z2_heuvel, z2_tempo_teugjes, z2_steady, z2_lang, z2_embedded_sprint, sprint_peak_test, z1_herstel, herstel_actief, herstel_mobiliteit, ramp_test]
- toegestane_zones: array van zones (bv. ["Z1", "Z2"])
- tss_range: { min, max }
- toelichting: één zin over de rol van deze dag

SEGMENTEN-FORMAAT:
- GEEN warmup of cooldown segmenten genereren
- Per segment: geef zone (Z1-Z7), positie (onder/midden/boven, alleen Z1-Z4), blokDuurSeconden, isSpecifiek (boolean), sessietype. Geef GEEN vermogenMin/vermogenMax — die berekent de code
- Bij intervallen: afwisselende werk/herstel-blokken

Geef JSON:
{
  "weekdoel": "...",
  "sessies": [{
    "datum": "...", "dag": "...", "type": "...", "titel": "...", "tss": ..., "duur_min": ...,
    "vermogen": "...",
    "waarom_vandaag": "2-3 zinnen, max 60 woorden, coachende toon, tweede persoon. Waarom DEZE sessie op DEZE dag? Gebruik relatieve dagaanduidingen (gisteren, morgen), nooit vaste dagnamen. Benoem intensiteitsreden.",
    "segmenten": [...],
    "intentie": { "rol": "...", "sessietype": "...", "toegestane_zones": [...], "tss_range": { "min": ..., "max": ... }, "toelichting": "..." }
  }],
  "tss_totaal": ...
}
Alleen JSON.`,
    system: "Je bent een professionele fietscoach. Genereer gepersonaliseerde sessies met dag-intentie en gedetailleerde workout-segmenten. Nederlands, alleen JSON.",
    max_tokens: 8000,
    voltooideDatams: [...voltooideDatams],
  };
}

export function bouwSessieDagPrompt(params) {
  const ctx = bouwSessieContext(params);
  return bouwSessieDagPromptVanContext(ctx);
}

/**
 * Bouwt de prompt op basis van een vooraf geassembleerde SessieContext.
 * Dag-intentie is leidend als die aanwezig is — het type/zones worden niet veranderd.
 */
export function bouwSessieDagPromptVanContext(ctx) {
  const weekTssNu = ctx.tssRollend7d || 0;
  const tssRuimte = ctx.tssDoel - weekTssNu;

  const bestaande = ctx.overigeSessiesDezeWeek
    .map(s => `  ${s.datum} (${s.dag}): ${s.type}${s.isZwaar ? " [ZWAAR]" : ""}, ${s.tss || "?"} TSS, ${s.duur_min || "?"}min`)
    .join("\n") || "Geen";

  const weekrol = bouwWeekrolVanContext(ctx.overigeSessiesDezeWeek, ctx.fase, ctx.uren);

  const hrvInfo = ctx.hrvEnRhr?.hrv
    ? `${ctx.hrvEnRhr.hrv}ms (basislijn ${ctx.hrvEnRhr.basislijn_hrv}) | trend: ${ctx.hrvEnRhr.trend}`
    : ctx.isToekomst ? "n.v.t. (toekomstige dag)" : "onbekend";

  const rpeInfo = ctx.rpeTrend.aantal >= 2
    ? `gem ${ctx.rpeTrend.gemiddelde}/10 (${ctx.rpeTrend.trend === "hoog" ? "te zwaar — verlaag intensiteit" : ctx.rpeTrend.trend === "laag" ? "te licht — verhoog intensiteit" : "passend"})`
    : "geen data";

  // Z2-subtype context
  let z2SubtypeContext = "";
  if (ctx.z2Subtype) {
    z2SubtypeContext = `\nZ2 SUBTYPE VOOR DEZE SESSIE: ${ctx.z2Subtype.key}
Label: ${ctx.z2Subtype.label}
Beschrijving: ${ctx.z2Subtype.beschrijving}
Gebruik de segmentstructuur die bij dit subtype hoort.`;
  }

  // Intentie-sectie: leidend als aanwezig, anders laten bepalen
  let intentieInstructie;
  if (ctx.dagIntentie) {
    const isVerplaatsing = ctx.aanleiding === "beschikbaarheid_verplaatsing";
    intentieInstructie = `DAG-INTENTIE (${isVerplaatsing ? "voorkeur — behoud als het past" : "leidend — niet ter discussie"}):
Rol: ${ctx.dagIntentie.rol}
Sessietype: ${ctx.dagIntentie.sessietype}
Toegestane zones: ${(ctx.dagIntentie.toegestane_zones || []).join(", ")}
TSS-range: ${ctx.dagIntentie.tss_range?.min || "?"}–${ctx.dagIntentie.tss_range?.max || "?"}
Achtergrond: ${ctx.dagIntentie.toelichting || ""}${z2SubtypeContext}
${isVerplaatsing ? `
Deze sessie is VERPLAATST van een andere dag. Behoud het sessietype en de intentie,
tenzij er een conflict is met de overige geplande sessies deze week (bv. twee zware
sessies binnen 24u). Als je moet afwijken, geef dan een "intentie_afwijking" veld
in je response met de reden.` : `
Jouw taak: genereer een sessie die PAST BINNEN deze intentie.
Pas UITSLUITEND aan: duur, exact vermogensbereik binnen de toegestane zones, TSS binnen de opgegeven range.
Verander NOOIT: sessietype, zone-bandbreedte, of de intentie zelf.`}
Aanleiding voor deze aanroep: ${ctx.aanleiding}`;
  } else {
    intentieInstructie = `DAG-INTENTIE (verplicht — bepaal zelf):
Voeg een "intentie"-object toe met:
- rol: één van [intensiteitsdag, aerobe_dag, hersteldag, variabele_dag, ftp_test]
- sessietype: één van [sweetspot_intervallen, sweetspot_lang, drempel_intervallen, over_under, pyramide, vo2max_intervallen, vo2max_lang, vo2max_kort, microbursts, race_simulatie, progressief, sprint_neuraal, kracht_lage_cadans, z2_vlak, z2_variabel, z2_cadans, z2_heuvel, z2_tempo_teugjes, z2_steady, z2_lang, z2_embedded_sprint, sprint_peak_test, z1_herstel, herstel_actief, herstel_mobiliteit, ramp_test]
- toegestane_zones: array van zones (bv. ["Z1", "Z2"])
- tss_range: { min, max }
- toelichting: één zin over de rol van deze dag
Aanleiding: ${ctx.aanleiding}`;
  }

  let vorigeSessieContext = "";
  if (ctx.vorigeSessieOpDezeDag && (ctx.aanleiding === "beschikbaarheid_uren" || !ctx.dagIntentie)) {
    vorigeSessieContext = `
VORIGE SESSIE OP DEZE DAG (beschikbare uren zijn gewijzigd van ${ctx.vorigeSessieOpDezeDag.duur_min || "?"}min naar ${Math.round(ctx.uren * 60)}min):
  Type: ${ctx.vorigeSessieOpDezeDag.type} | Titel: ${ctx.vorigeSessieOpDezeDag.titel} | Vermogen: ${ctx.vorigeSessieOpDezeDag.vermogen || "?"} | TSS: ${ctx.vorigeSessieOpDezeDag.tss || "?"} | Duur: ${ctx.vorigeSessieOpDezeDag.duur_min || "?"}min

BELANGRIJK: behoud hetzelfde sessietype en dezelfde vermogenszone. Schaal de duur proportioneel naar de nieuwe beschikbare tijd. Pas het vermogen NIET aan.`;
  }

  let checkInContext = "";
  if (ctx.checkInVandaag) {
    checkInContext = `\nCHECK-IN VANDAAG: ${ctx.checkInVandaag}/5`;
  }

  let vo2maxContext = "";
  if (ctx.vo2maxTogestaan) {
    vo2maxContext = `\nVO2MAX-INTERVALLEN TOEGESTAAN: ja. Max 1x/week in drempelfase. Nooit direct na drempel/over-under. Verhouding: drempel 2x / VO2max 1x per opbouwweek. Vervangt één Z2-sessie, nooit een drempelsessie.
Spec: 4-6x 4-5min @ zone Z5, herstel 1:1, TSS 70-90, warm-up ≥10min progressief naar Z3.`;
  }

  let z6Context = "";
  if (ctx.doelType === "sprint" || ctx.doelType === "klimmen") {
    z6Context = "\nZ6 ANAEROBE BLOKKEN: toegestaan voor dit doel.";
  } else {
    z6Context = "\nZ6 ANAEROBE BLOKKEN: niet toegestaan — gebruik maximaal Z5.";
  }

  let rpeContext = "";
  if (ctx.rpeOverbelasting) {
    rpeContext = "\nRPE-TREND: overbelasting gedetecteerd. Genereer sessie aan de onderkant van de TSS-range en zone-bandbreedte.";
  } else if (ctx.rpeOnderstimulering) {
    rpeContext = "\nRPE-TREND: onderstimulering. Genereer sessie aan de bovenkant van de TSS-range.";
  }

  let herstelpatroonContext = "";
  if (ctx.aanleiding === "herstelpatroon_correctie") {
    herstelpatroonContext = "\nHERSTELPATROON-CORRECTIE: deze dag grenst aan een zware sessie en heeft onvoldoende herstel. Verlaag de intensiteit: kortere duur (−20–30%), vermogen naar onderkant van de zone, of schakel om naar z2_vlak als het sessietype zwaarder was. Behoud het sessietype als het al Z2 is — pas alleen duur en vermogen aan.";
  }

  let volumecorrectieRestrictieContext = "";
  if (ctx.aanleiding?.startsWith("volumecorrectie") || ctx.aanleiding === "herstelpatroon_correctie") {
    volumecorrectieRestrictieContext = "\nVOLUMECORRECTIE — SESSIETYPE RESTRICTIE: deze sessie wordt gegenereerd als onderdeel van een volumecorrectie. Het doel is uitsluitend aerobe stimulus. De volgende sessietypes zijn verboden voor deze aanroep: kracht_lage_cadans (neuromusculaire prikkel, geen aerobe volumecompensatie), sprint_neuraal (neuromusculaire prikkel, geen aerobe volumecompensatie). Gebruik uitsluitend: z2_vlak, z2_variabel, progressief. Als de volumecorrectie een tempo-afsluiter vereist: voeg een Z3-blok toe aan een z2_vlak of z2_variabel sessie — genereer geen apart kracht- of sprintsessietype.";
  }

  let distributieContext = "";
  if (ctx.distributieAfwijking) {
    const richting = ctx.distributieAfwijking.richting;
    if (richting === "te_intensief") {
      distributieContext = "\nDISTRIBUTIE-CORRECTIE: te intensief — genereer een vlakkere Z2-sessie, TSS 10% lager dan normaal.";
    } else if (richting === "te_rustig") {
      distributieContext = "\nDISTRIBUTIE-CORRECTIE: te rustig — verhoog Z3-aandeel licht, TSS 5% hoger dan normaal.";
    }
  }

  const methodeSectie = ctx.trainingsmethode
    ? `\n## Trainingsmethode\n\n${ctx.trainingsmethode.instructie}\n\nReden: ${ctx.trainingsmethode.reden}\n\nDe trainingsmethode stuurt HOE je de blokken opbouwt (herstelratio, blokduur, intensiteitsniveau binnen de zone). De dag-intentie hierboven stuurt WAT voor sessie het is (sessietype, zones, TSS). De methode verfijnt de intentie — de intentie overschrijft de methode nooit.\n`
    : "";

  return {
    prompt: `Maak één trainingssessie voor ${ctx.datum} (${ctx.dagVanDeWeek}), ${ctx.uren} uur beschikbaar.

${intentieInstructie}
${methodeSectie}
PROFIEL: FTP ${ctx.atleetProfiel.ftp}W | LT ${ctx.atleetProfiel.lt_hr} bpm | Max HR ${ctx.atleetProfiel.max_hr} bpm | ${ctx.atleetProfiel.gewicht} kg${ctx.wPerKg ? ` | W/kg ${ctx.wPerKg}` : ""}
${ctx.ctlAtlTsb ? `CTL: ${ctx.ctlAtlTsb.ctl} | ATL: ${ctx.ctlAtlTsb.atl} | TSB: ${ctx.ctlAtlTsb.tsb}` : "CTL/ATL/TSB: niet meegewogen (toekomstige dag — plan op basis van het weekschema, niet op dagvorm)"}
${ctx.isToekomst ? "" : `HRV: ${hrvInfo}`}
RPE afgelopen week: ${rpeInfo}${checkInContext}${rpeContext}${herstelpatroonContext}${volumecorrectieRestrictieContext}${distributieContext}${vo2maxContext}${z6Context}
Fase: ${ctx.fase} — ${ctx.focus} (TSS-doel ${ctx.tssDoel} per 7 dagen, weektype: ${ctx.weektype}, reeds gepland afgelopen 7d: ${weekTssNu} TSS, ruimte: ${tssRuimte} TSS)
Ervaringsniveau: ${ctx.atleetProfiel.ervaringsniveau}
Toegestane sessietypes deze fase: ${ctx.sessietypes ? ctx.sessietypes.join(", ") : sessietypesVoorFase(ctx.fase)}

OVERIGE SESSIES DEZE WEEK (niet wijzigen, houd spreiding — [ZWAAR] = intensiteitsdag):
${bestaande}
${vorigeSessieContext}
ROL VAN DEZE DAG IN HET WEEKPATROON:
${weekrol}

REGELS:
- Duur past binnen ${ctx.uren} uur
${ctx.dagIntentie ? "- Intentie is leidend — pas alleen duur/vermogen/TSS aan binnen de intentie-grenzen" : "- Volg de weekrol hierboven — die bepaalt welk type sessie hier past"}
- Min 1 rustdag tussen harde sessies${ctx.isToekomst ? "" : ". Als TSB < -20 of HRV dalend: alleen Z2 of herstel"}
- Houd week-TSS onder ${ctx.tssDoel} totaal
- GEEN warmup/cooldown segmenten, hoofdinspanning vult hele duur
- Per segment: geef zone (Z1-Z7), positie (onder/midden/boven), blokDuurSeconden, isSpecifiek, sessietype. GEEN vermogenMin/vermogenMax
- Geef een concrete, data-gedreven reden
- Z1-Z2 doel-aandeel: ${ctx.z1z2Doel ? Math.round(ctx.z1z2Doel * 100) + "%" : z1z2Doel(ctx.atleetProfiel.ervaringsniveau)}
- Max intensiteitssessies deze week: ${ctx.maxIntensiteit}
- Z1-RESTRICTIE: Z1 herstelblokken ALLEEN in sprint_neuraal, vo2max_intervallen, vo2max_kort, microbursts, z2_embedded_sprint. In alle andere sessietypes: gebruik Z2 voor herstelblokken (positie "onder" bij licht herstel, "midden" bij normaal herstel)

SESSIETYPES: duur_lang | duur_variabel | sweetspot | interval | herstel

Geef JSON (alleen het sessie-object, geen array):
{
  "datum": "${ctx.datum}", "dag": "${ctx.dagVanDeWeek}", "type": "...", "titel": "...", "tss": ..., "duur_min": ...,
  "vermogen": "...",
  "waarom_vandaag": "2-3 zinnen, max 60 woorden, coachende toon, tweede persoon. Leg uit waarom DEZE sessie op DEZE dag past. Refereer aan de positie in de week met relatieve aanduidingen (gisteren, morgen, eerder deze week) — nooit vaste dagnamen. Benoem de reden voor de gekozen intensiteit (herstel, faseopbouw, supercompensatie). Optioneel: coachende opmerking bij hoge intensiteit.",
  "segmenten": [...],
  "intentie": { "rol": "...", "sessietype": "...", "toegestane_zones": [...], "tss_range": { "min": ..., "max": ... }, "toelichting": "..." }
}
Alleen JSON.`,
    system: "Je bent een professionele fietscoach. Genereer één gepersonaliseerde sessie die past binnen de opgegeven dag-intentie. Nederlands, alleen JSON.",
    max_tokens: 4000,
  };
}

function bouwWeekrolVanContext(overigeSessies, fase, uren) {
  const aantalZwaar = overigeSessies.filter(s => s.isZwaar).length;
  const aantalVariabel = overigeSessies.filter(s => s.type === "duur_variabel" || s.intentie?.sessietype === "z2_variabel").length;
  const aantalVlak = overigeSessies.filter(s => s.type === "duur_lang" || s.intentie?.sessietype === "z2_vlak").length;
  const totaal = overigeSessies.length;

  let rol;
  if (aantalZwaar >= 2) {
    rol = `Deze week heeft al ${aantalZwaar} intensiteitsdagen. Dit slot moet een Z2-duurrit of herstelrit worden (polarisatie).`;
  } else if (aantalZwaar === 1) {
    rol = `Er is al 1 intensiteitsdag. Dit slot wordt een Z2-dag.`;
  } else if (totaal === 0) {
    rol = `Dit is de eerste sessie van de week. Kies op basis van de fase "${fase}" en de beschikbare ${uren} uur.`;
  } else {
    rol = `Er zijn ${totaal} sessie(s) gepland. Vul het weekpatroon aan passend bij de fase "${fase}".`;
  }

  // Variëteit afdwingen: wissel vlak en variabel af
  if (aantalVariabel > 0 && aantalVlak === 0) {
    rol += ` BELANGRIJK: er zijn al ${aantalVariabel} variabele Z2/Z3-sessie(s). Maak deze sessie een VLAKKE Z2-duurrit (duur_lang, constant 68–76% FTP, geen Z3-blokken) voor afwisseling.`;
  } else if (aantalVlak > 0 && aantalVariabel === 0 && totaal >= 1) {
    rol += ` Er is al ${aantalVlak} vlakke Z2-rit. Een variabele Z2/Z3-sessie (duur_variabel) zorgt voor afwisseling.`;
  }

  return rol;
}
