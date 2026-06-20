// Server-side prompt-bouwers voor sessiegeneratie.
// Elke functie retourneert { prompt, system, max_tokens }.

import { vandaagISO, datumISO } from "./datum";
const ZWAAR_TYPES = ["sweetspot", "interval", "drempel", "vo2max"];

function bouwWeekrol(overigeSessies, kaderWeek, uren) {
  const aantalZwaar = overigeSessies.filter(s => ZWAAR_TYPES.includes(s.type)).length;
  const aantalZ2 = overigeSessies.filter(s => ["duur_lang", "duur_variabel", "herstel"].includes(s.type)).length;
  const totaal = overigeSessies.length;

  if (aantalZwaar >= 2) return `Deze week heeft al ${aantalZwaar} intensiteitsdagen. Dit slot moet een Z2-duurrit of herstelrit worden (80/20 polarisatie).`;
  if (aantalZwaar === 1 && aantalZ2 >= 2) return `Er is al 1 intensiteitsdag en ${aantalZ2} Z2-dag(en). Dit slot kan een tweede intensiteitsdag worden als TSB en HRV het toelaten, of een Z2/variabele duurrit als extra volume.`;
  if (aantalZwaar === 0 && totaal >= 1) return `Er zijn nog geen intensiteitsdagen deze week. Dit slot zou bij voorkeur de eerste intensiteitsdag moeten zijn (sweetspot of interval), passend bij de fase "${kaderWeek.fase}".`;
  if (totaal === 0) return `Dit is de eerste sessie van de week. Kies op basis van de fase "${kaderWeek.fase}" en de beschikbare ${uren} uur.`;
  return `Er ${aantalZwaar === 1 ? "is 1 intensiteitsdag" : "zijn geen intensiteitsdagen"} en ${aantalZ2} Z2-dag(en). Vul het weekpatroon aan op basis van wat ontbreekt.`;
}

export function bouwSeizoensplanPrompt({ profiel, doelConfig, kader }) {
  const week1 = kader[0];
  const week2 = kader[1];
  return {
    prompt: `Genereer concrete trainingssessies voor week 1 en 2 van een fietsplan.

PROFIEL: FTP ${doelConfig.huidige_ftp}W | LT ${profiel.lt_hr} bpm | Max HR ${profiel.max_hr} bpm | ${profiel.gewicht} kg | CTL ~${doelConfig.huidige_ctl} | Eerste seizoen
DOEL: ${doelConfig.doel_label}

WEEK 1: fase=${week1.fase}, TSS-doel=${week1.tss_doel}, focus=${week1.focus}
WEEK 2: fase=${week2.fase}, TSS-doel=${week2.tss_doel}, focus=${week2.focus}

Maak 3 fietssessies per week. Verdeel over de week met rustdagen ertussen.

Geef JSON:
{
  "samenvatting": "2-3 zinnen over de aanpak",
  "streefwaarde": "bijv. 280-290W na 12 weken",
  "detail_weken": [
    {
      "week": 1, "fase": "${week1.fase}", "weekdoel": "...",
      "sessies": [
        { "dag": "Dinsdag", "type": "duur_lang|sweetspot|interval|herstel|ftp_test", "titel": "...", "tss": 90, "duur_min": 150, "vermogen": "170-195W", "hartslag": "<152 bpm", "reden": "..." }
      ]
    },
    {
      "week": 2, "fase": "${week2.fase}", "weekdoel": "...",
      "sessies": [...]
    }
  ]
}
Alleen JSON.`,
    system: "Je bent een professionele fietscoach. Geef concrete sessies in JSON. Nederlands.",
    max_tokens: 3000,
  };
}

export function bouwWeekSessiesPrompt({ profiel, wellness, dagelijkseData, voortgang, seizoensplan, weekSessies, urenPerDag, beschikbareDagen }) {
  const DAGNAMEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
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

  return {
    prompt: `Maak concrete trainingssessies voor een wielrenner voor de komende 10 dagen.

PROFIEL: FTP ${profiel.ftp}W | LT ${profiel.lt_hr} bpm | Max HR ${profiel.max_hr} bpm | ${profiel.gewicht} kg | Eerste seizoen

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
- Huidige fase: ${kaderWeek.fase} — ${kaderWeek.focus} (TSS-doel ${kaderWeek.tss_doel}/week)
${kaderWeek2 !== kaderWeek ? `- Volgende fase: ${kaderWeek2.fase} — ${kaderWeek2.focus} (TSS-doel ${kaderWeek2.tss_doel}/week)` : ""}

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
- 80/20 polarisatie | Max ~150 TSS per sessie
- Geef bij elke sessie een concrete, data-gedreven reden

SESSIETYPES:
- duur_lang: vlakke Z2 duurrit (68-76% FTP constant)
- duur_variabel: afwisselende Z2/Z3 blokken (Z2 = 68-76% FTP, Z3 = 76-85% FTP, NOOIT hoger)
- sweetspot: 88-93% FTP blokken met herstel ertussen
- interval: 95-120% FTP blokken met herstel ertussen
- herstel: laag vermogen (50-60% FTP)

SEGMENTEN-FORMAAT:
- GEEN warmup of cooldown segmenten genereren
- Gebruik vermogenMin en vermogenMax (in %FTP) per segment
- Bij intervallen: afwisselende werk/herstel-blokken

Geef JSON:
{
  "weekdoel": "...",
  "sessies": [{ "datum": "...", "dag": "...", "type": "...", "titel": "...", "tss": ..., "duur_min": ..., "vermogen": "...", "reden": "...", "segmenten": [...] }],
  "tss_totaal": ...
}
Alleen JSON.`,
    system: "Je bent een professionele fietscoach. Genereer gepersonaliseerde sessies met gedetailleerde workout-segmenten. Nederlands, alleen JSON.",
    max_tokens: 6000,
    voltooideDatams: [...voltooideDatams],
  };
}

export function bouwSessieDagPrompt({ profiel, wellness, dagelijkseData, voortgang, seizoensplan, overigeSessies, datum, dagNaam, uren, oudeSessie }) {
  const ftp = profiel.ftp || 265;
  const ctl = wellness?.ctl || seizoensplan.huidige_ctl || 45;
  const atl = wellness?.atl || 0;
  const tsb = Math.round(ctl - atl);

  const dagenSindsStart = seizoensplan?.startdatum ? Math.max(0, (Date.now() - new Date(seizoensplan.startdatum).getTime()) / 86400000) : 0;
  const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
  const kaderWeek = seizoensplan.kader?.find(w => w.week === weekNr) || seizoensplan.kader?.[0] || { fase: "basis", tss_doel: 250, focus: "Z2 volume" };

  const weekTssNu = overigeSessies.reduce((s, sess) => s + (sess.tss || 0), 0);
  const tssRuimte = kaderWeek.tss_doel - weekTssNu;
  const bestaande = overigeSessies
    .map(s => `  ${s.datum} (${s.dag}): ${s.type}${ZWAAR_TYPES.includes(s.type) ? " [ZWAAR]" : ""}, ${s.tss || "?"} TSS, ${s.duur_min || "?"}min`)
    .join("\n") || "Geen";

  const weekrol = bouwWeekrol(overigeSessies, kaderWeek, uren);

  const recenteHrv = (dagelijkseData || []).filter(d => d.hrv).slice(-5);
  let hrvInfo = "onbekend";
  if (recenteHrv.length > 0) {
    const laatsteHrv = recenteHrv[recenteHrv.length - 1].hrv;
    const eerste = recenteHrv.length >= 3 ? recenteHrv.slice(0, 2).reduce((s, d) => s + d.hrv, 0) / 2 : laatsteHrv;
    const laatste = recenteHrv.length >= 3 ? recenteHrv.slice(-2).reduce((s, d) => s + d.hrv, 0) / 2 : laatsteHrv;
    const trend = laatste < eerste - 3 ? "dalend" : laatste > eerste + 3 ? "stijgend" : "stabiel";
    hrvInfo = `${laatsteHrv}ms (basislijn ${profiel.hrv_basislijn || 58}) | trend: ${trend}`;
  }

  const zevenDagen = new Date(Date.now() - 7 * 86400000);
  const rittenMetRpe = (voortgang?.ritten || []).filter(r => r.rpe && r.datum_iso && new Date(r.datum_iso) >= zevenDagen);
  let rpeInfo = "geen data";
  if (rittenMetRpe.length >= 2) {
    const gem = +(rittenMetRpe.reduce((s, r) => s + r.rpe, 0) / rittenMetRpe.length).toFixed(1);
    rpeInfo = `gem ${gem}/10 (${gem > 7 ? "te zwaar — verlaag intensiteit" : gem < 4 ? "te licht — verhoog intensiteit" : "passend"})`;
  }

  let vorigeSessieContext = "";
  if (oudeSessie) {
    vorigeSessieContext = `
VORIGE SESSIE OP DEZE DAG (beschikbare uren zijn gewijzigd):
  Type: ${oudeSessie.type} | Titel: ${oudeSessie.titel} | Vermogen: ${oudeSessie.vermogen || "?"} | TSS: ${oudeSessie.tss || "?"} | Duur: ${oudeSessie.duur_min || "?"}min

BELANGRIJK: behoud hetzelfde sessietype en dezelfde vermogenszone als de vorige sessie. Pas ALLEEN de duur en TSS proportioneel aan op de nieuwe beschikbare tijd (${uren} uur). Wijzig het type NIET tenzij TSB of HRV daar expliciet aanleiding toe geeft.`;
  }

  return {
    prompt: `Maak één trainingssessie voor ${datum} (${dagNaam}), ${uren} uur beschikbaar.

PROFIEL: FTP ${ftp}W | LT ${profiel.lt_hr} bpm | Max HR ${profiel.max_hr} bpm | ${profiel.gewicht} kg | Eerste seizoen
CTL: ${Math.round(ctl)} | ATL: ${Math.round(atl)} | TSB: ${tsb}
HRV: ${hrvInfo}
RPE afgelopen week: ${rpeInfo}
Fase: ${kaderWeek.fase} — ${kaderWeek.focus} (TSS-doel ${kaderWeek.tss_doel}/week, reeds gepland: ${weekTssNu} TSS, ruimte: ${tssRuimte} TSS)

OVERIGE SESSIES DEZE WEEK (niet wijzigen, houd spreiding — [ZWAAR] = intensiteitsdag):
${bestaande}
${vorigeSessieContext}
ROL VAN DEZE DAG IN HET WEEKPATROON:
${weekrol}

REGELS:
- Duur past binnen ${uren} uur
${oudeSessie ? "- BEHOUD het sessietype en de vermogenszone van de vorige sessie — alleen duur/TSS aanpassen" : "- Volg de weekrol hierboven — die bepaalt welk type sessie hier past"}
- Min 1 rustdag tussen harde sessies (sweetspot/interval). Als TSB < -20 of HRV dalend: alleen Z2 of herstel
- Houd week-TSS onder ${kaderWeek.tss_doel} totaal
- GEEN warmup/cooldown segmenten, hoofdinspanning vult hele duur
- Gebruik vermogenMin/vermogenMax in %FTP per segment
- Geef een concrete, data-gedreven reden

SESSIETYPES: duur_lang | duur_variabel | sweetspot | interval | herstel

Geef JSON (alleen het sessie-object, geen array):
{ "datum": "${datum}", "dag": "${dagNaam}", "type": "...", "titel": "...", "tss": ..., "duur_min": ..., "vermogen": "...", "reden": "...", "segmenten": [...] }
Alleen JSON.`,
    system: "Je bent een professionele fietscoach. Genereer één gepersonaliseerde sessie met gedetailleerde workout-segmenten. Nederlands, alleen JSON.",
    max_tokens: 3000,
  };
}
