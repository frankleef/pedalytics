"use client";
import { useState, useEffect, useCallback } from "react";
import SeizoenWizard from "./components/SeizoenWizard";
import HomeTab from "./components/HomeTab";
import VoortgangTab from "./components/VoortgangTab";
import BottomNav from "./components/BottomNav";
import BeschikbaarheidScherm from "./components/BeschikbaarheidScherm";
import SchemaTab from "./components/SchemaTab";
import PlanGenereren from "./components/PlanGenereren";
import SeizoensplanOverzicht from "./components/SeizoensplanOverzicht";

const PROFIEL_DEFAULT = { ftp: 265, lt_hr: 184, max_hr: 200, gewicht: 90, hrv_basislijn: 58, hr_basislijn: 49, doel: "31+ km/u gemiddeld solo in Z2" };

export default function Page() {
  const [profiel, setProfiel] = useState(PROFIEL_DEFAULT);
  const PROFIEL = profiel;
  const HRV_BASISLIJN = profiel.hrv_basislijn;
  const HR_BASISLIJN = profiel.hr_basislijn;
  const [tab, setTab] = useState(0);
  const [beschikbaar, setBeschikbaar] = useState({});
  const [urenPerDag, setUrenPerDag] = useState({});
  const [voortgang, setVoortgang] = useState(null);
  const [wellness, setWellness] = useState(null);
  const [laadtVoortgang, setLaadtVoortgang] = useState(false);
  const [dagelijkseData, setDagelijkseData] = useState([]);
  const [vandaagInvoer, setVandaagInvoer] = useState(null);
  const [seizoensplan, setSeizoensplan] = useState(null);
  const [planStap, setPlanStap] = useState(null);
  const [planVoortgang, setPlanVoortgang] = useState(0);
  const [weekSessies, setWeekSessies] = useState(null);
  const [weekSessiesLaden, setWeekSessiesLaden] = useState(false);
  const [beschikbaarheidSchermOpen, setBeschikbaarheidSchermOpen] = useState(false);
  const [schemaDagOffset, setSchemaDagOffset] = useState(0);
  const [stravaAuth, setStravaAuth] = useState(null);
  const [fout, setFout] = useState(null);
  const [succesMelding, setSuccesMelding] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "ochtend") setTab(0);
    fetch("/api/intervals/profiel").then(r => r.json()).then(d => {
      if (d.success && d.data) setProfiel(p => ({ ...p, ...d.data }));
    }).catch(() => {});
    fetch("/api/plan").then(r => r.json()).then(d => {
      if (d.success && d.data) {
        setSeizoensplan(d.data);
        if (d.data.beschikbaarheid) setBeschikbaar(d.data.beschikbaarheid);
        if (d.data.urenPerDag) setUrenPerDag(d.data.urenPerDag);
        if (d.data.weekSessies) setWeekSessies(d.data.weekSessies);
        if (d.data.planStatus === "genereren") {
          setPlanStap("genereren");
          setPlanVoortgang(d.data.kader ? 4 : 0);
        }
      } else setTab(1);
    }).catch(() => setTab(1));
    laadDagelijkseData();
    laadVoortgang();
  }, []);

  useEffect(() => {
    if (seizoensplan?.kader && !weekSessies && !weekSessiesLaden) {
      const dagen = Object.entries(seizoensplan.beschikbaarheid || beschikbaar || {}).filter(([, v]) => v).map(([k]) => k);
      if (dagen.length > 0) genereerWeekSessies(dagen);
    }
  }, [seizoensplan?.kader]);

  useEffect(() => {
    if (planStap === "genereren" && seizoensplan?.doel && !seizoensplan?.kader) {
      genereerSeizoensplan(seizoensplan);
    }
  }, [planStap, seizoensplan?.kader]);

  useEffect(() => {
    if (planStap === "genereren" && planVoortgang >= 4 && weekSessies) {
      setPlanStap("overzicht");
    }
  }, [planStap, planVoortgang, weekSessies]);

  const laadDagelijkseData = useCallback(async () => {
    try {
      const resp = await fetch("/api/intervals/wellness?oldest=" +
        new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
      const data = await resp.json();
      if (data.success && data.data) {
        const verwerkt = data.data.map(d => ({
          datum: d.id?.split("T")[0]?.slice(5).replace("-", "/") || d.id,
          hrv: d.hrv,
          rusthartslag: d.restingHR,
          slaapScore: d.sleepScore,
          slaapUren: d.sleepSecs ? Math.round(d.sleepSecs / 360) / 10 : null,
          ctl: d.ctl,
          atl: d.atl,
          tsb: d.ctl && d.atl ? Math.round(d.ctl - d.atl) : null,
        }));
        setDagelijkseData(verwerkt);
        setWellness(data.data);
        if (verwerkt.length > 0) {
          const v = verwerkt[verwerkt.length - 1];
          if (v.hrv || v.rusthartslag) setVandaagInvoer(v);
        }
      }
    } catch (e) { console.error("Dagelijkse data laden:", e); }
  }, []);

  const laadVoortgang = useCallback(async () => {
    setLaadtVoortgang(true);
    setVoortgang(null);
    setFout(null);
    try {
      const actResp = await fetch("/api/intervals/activities?oldest=2026-01-01");
      const actData = await actResp.json();
      if (!actData.success) throw new Error(actData.error);

      const wellResp = await fetch("/api/intervals/wellness?oldest=2026-01-01");
      const wellData = await wellResp.json();
      if (wellData.success) setWellness(wellData.data);

      const ritten = (actData.data || [])
        .filter(a => a.type === "Ride" || a.type === "VirtualRide")
        .map(a => ({
          id: a.id,
          naam: a.name,
          datum: new Date(a.start_date_local).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" }),
          datum_iso: a.start_date_local?.split("T")[0],
          type: a.type,
          afstand: a.distance ? Math.round(a.distance / 1000) : null,
          duur_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
          snelheid: a.average_speed ? Math.round(a.average_speed * 3.6 * 10) / 10 : null,
          wattage: a.icu_weighted_avg_watts || a.average_watts || null,
          np: a.icu_weighted_avg_watts || null,
          avgWatts: a.average_watts || null,
          hartslag: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          eff: (a.icu_weighted_avg_watts && a.average_heartrate) ? Math.round((a.icu_weighted_avg_watts / a.average_heartrate) * 100) / 100 : null,
          tss: a.icu_training_load || null,
          ctl: a.icu_ctl || null,
          atl: a.icu_atl || null,
          tsb: a.icu_form || null,
          rpe: a.icu_rpe || null,
          max_hartslag: a.max_heartrate ? Math.round(a.max_heartrate) : null,
          max_watt: a.max_watts || null,
          hoogtemeters: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
          cadans: a.average_cadence ? Math.round(a.average_cadence) : null,
          calorieen: a.calories ? Math.round(a.calories) : null,
          strava_id: a.strava_id || null,
          athlete_count: null,
          solo: true,
          virtual: a.type === "VirtualRide",
          zone_verdeling: a.icu_hr_zone_times ? (() => {
            const totaal = a.icu_hr_zone_times.reduce((s, t) => s + t, 0);
            return totaal > 0 ? a.icu_hr_zone_times.map(t => Math.round((t / totaal) * 100)) : null;
          })() : null,
          power_zones: a.icu_power_zone_times ? (() => {
            const totaal = a.icu_power_zone_times.reduce((s, t) => s + t, 0);
            return totaal > 0 ? a.icu_power_zone_times.map(t => Math.round((t / totaal) * 100)) : null;
          })() : null,
        }));

      try {
        const stravaResp = await fetch("/api/strava/activities?after=2026-01-01");
        const stravaData = await stravaResp.json();
        if (stravaData.success) {
          setStravaAuth(true);
          ritten.forEach(r => {
            if (!r.strava_id) return;
            if (stravaData.data[r.strava_id]) {
              r.athlete_count = stravaData.data[r.strava_id].athlete_count;
              r.solo = r.athlete_count === 1;
            }
          });
        } else if (stravaData.authUrl) {
          window.location.href = "/api/strava/auth";
          return;
        }
      } catch (e) { console.log("Strava data niet beschikbaar:", e.message); }

      const soloRitten = ritten.filter(r => r.solo && r.snelheid);

      const maanden = {};
      soloRitten.forEach(r => {
        const maand = r.datum_iso?.slice(0, 7);
        if (!maand) return;
        if (!maanden[maand]) maanden[maand] = [];
        maanden[maand].push(r);
      });
      const Z2_MIN = 170, Z2_MAX = 220;
      const maandStats = Object.entries(maanden).sort().map(([maand, rs]) => {
        const z2Ritten = rs.filter(r => r.wattage >= Z2_MIN && r.wattage <= Z2_MAX && r.hartslag);
        return {
          maand,
          label: new Date(maand + "-01").toLocaleDateString("nl-NL", { month: "short" }),
          gem_snelheid: rs.filter(r => r.snelheid).length ? +(rs.filter(r => r.snelheid).reduce((s, r) => s + r.snelheid, 0) / rs.filter(r => r.snelheid).length).toFixed(1) : null,
          gem_eff: rs.filter(r => r.eff).length ? +(rs.filter(r => r.eff).reduce((s, r) => s + r.eff, 0) / rs.filter(r => r.eff).length).toFixed(2) : null,
          gem_wattage: rs.filter(r => r.wattage).length ? Math.round(rs.filter(r => r.wattage).reduce((s, r) => s + r.wattage, 0) / rs.filter(r => r.wattage).length) : null,
          gem_hr_z2: z2Ritten.length ? Math.round(z2Ritten.reduce((s, r) => s + r.hartslag, 0) / z2Ritten.length) : null,
          gem_watt_z2: z2Ritten.length ? Math.round(z2Ritten.reduce((s, r) => s + r.wattage, 0) / z2Ritten.length) : null,
          aantal_z2: z2Ritten.length,
          aantal: rs.length,
        };
      });

      setVoortgang({
        ritten,
        maandStats,
        seizoen_stats: {
          totaal_km: Math.round(ritten.filter(r => r.afstand).reduce((s, r) => s + r.afstand, 0)),
          totaal_ritten: ritten.length,
          totaal_solo: soloRitten.length,
          snelste_solo: soloRitten.length ? Math.max(...soloRitten.map(r => r.snelheid)) : 0,
          beste_eff: soloRitten.filter(r => r.eff).length ? Math.max(...soloRitten.filter(r => r.eff).map(r => r.eff)).toFixed(2) : 0,
        },
      });
    } catch (e) {
      setFout("Laden mislukt: " + e.message);
    }
    setLaadtVoortgang(false);
  }, []);

  const bouwKader = (doelConfig) => {
    const weken = doelConfig.tijdshorizon_weken || 12;
    const ctl = doelConfig.huidige_ctl || 45;
    const baseTss = Math.round(ctl * 5);
    const fasen = doelConfig.doel === "herstel"
      ? Array(weken).fill("herstel")
      : (() => {
        const f = [];
        for (let w = 1; w <= weken; w++) {
          if (w % 4 === 0) f.push("test");
          else if (w <= Math.ceil(weken * 0.25)) f.push("basis");
          else if (w <= Math.ceil(weken * 0.5)) f.push("sweetspot");
          else if (w <= Math.ceil(weken * 0.75)) f.push("drempel");
          else f.push("consolidatie");
        }
        return f;
      })();
    const tssMultiplier = { basis: 1, sweetspot: 1.1, drempel: 1.15, consolidatie: 1, test: 0.7, herstel: 0.6 };
    const focusTekst = {
      basis: "Z2 volume + sweetspot intro", sweetspot: "Sweetspot blokken (88-93% FTP)",
      drempel: "Drempel intervals (95-105% FTP)", consolidatie: "Drempel vasthouden, herstel",
      test: "Herstelweek + FTP-test", herstel: "Lage belasting, HRV optimaliseren",
    };
    return fasen.map((fase, i) => ({
      week: i + 1,
      fase,
      tss_doel: Math.round(baseTss * (tssMultiplier[fase] || 1) * (1 + i * 0.02)),
      focus: focusTekst[fase] || "",
    }));
  };

  const genereerSeizoensplan = useCallback(async (doelConfig) => {
    setPlanStap("genereren");
    setPlanVoortgang(0);
    const planMetStatus = { ...doelConfig, planStatus: "genereren" };
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(planMetStatus) });
    try {
      const kader = bouwKader(doelConfig);
      setPlanVoortgang(1);
      const week1 = kader[0];
      const week2 = kader[1];

      const prompt = `Genereer concrete trainingssessies voor week 1 en 2 van een fietsplan.

PROFIEL: FTP ${doelConfig.huidige_ftp}W | LT ${PROFIEL.lt_hr} bpm | Max HR ${PROFIEL.max_hr} bpm | ${PROFIEL.gewicht} kg | CTL ~${doelConfig.huidige_ctl} | Eerste seizoen
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
Alleen JSON.`;

      setPlanVoortgang(2);
      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, system: "Je bent een professionele fietscoach. Geef concrete sessies in JSON. Nederlands.", max_tokens: 3000 }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      setPlanVoortgang(3);
      const plan = JSON.parse(data.text.replace(/```json|```/g, "").trim());
      const volledigPlan = { ...doelConfig, kader, ...plan, planStatus: undefined };
      setSeizoensplan(volledigPlan);
      fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(volledigPlan) });
      setPlanVoortgang(4);
    } catch (e) {
      setFout("Plan genereren mislukt: " + e.message);
      setPlanStap(null);
    }
  }, []);

  const wellenessHuidig = wellness?.length > 0 ? wellness[wellness.length - 1] : null;

  const DAGNAMEN = ["Zondag","Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag"];

  const genereerWeekSessies = useCallback(async (beschikbareDagen, { stil = false } = {}) => {
    if (!seizoensplan?.kader) return;
    if (!stil) setWeekSessiesLaden(true);
    if (!stil) setFout(null);
    try {
      const ctl = wellenessHuidig?.ctl || seizoensplan.huidige_ctl || 45;
      const atl = wellenessHuidig?.atl || 0;
      const tsb = Math.round(ctl - atl);
      const maxDagen = ctl < 30 ? 2 : ctl < 40 ? 3 : ctl < 60 ? 4 : ctl < 80 ? 5 : 6;

      const nu = new Date();
      const vandaagISO = nu.toISOString().split("T")[0];

      // 10-dagenvenster: vandaag + 10 dagen vooruit
      const planDagen = [];
      for (let i = 0; i <= 10; i++) {
        const d = new Date(nu);
        d.setDate(nu.getDate() + i);
        const iso = d.toISOString().split("T")[0];
        const dagNaam = DAGNAMEN[d.getDay()];
        planDagen.push({ datum: iso, dag: dagNaam, beschikbaar: !!beschikbareDagen.includes(dagNaam), uren: urenPerDag[dagNaam] || 1.5 });
      }

      // Voltooide sessies: ritten die matchen met bestaande sessies
      const voltooideDatams = new Set();
      const bewaardeSessies = [];
      const bestaandeSessies = weekSessies?.sessies || [];
      (voortgang?.ritten || []).forEach(rit => {
        if (!rit.datum_iso) return;
        const matchSessie = bestaandeSessies.find(s =>
          s.datum === rit.datum_iso || (!s.datum && s.dag === DAGNAMEN[new Date(rit.datum_iso).getDay()])
        );
        if (matchSessie && rit.datum_iso <= vandaagISO) {
          voltooideDatams.add(rit.datum_iso);
          bewaardeSessies.push({ ...matchSessie, datum: rit.datum_iso, voltooid: true });
        }
      });

      // Beschikbare toekomstige dagen (niet voltooid)
      const tePlannenDagen = planDagen.filter(d => d.beschikbaar && !voltooideDatams.has(d.datum) && d.datum >= vandaagISO);

      if (tePlannenDagen.length === 0) {
        setWeekSessies({ sessies: bewaardeSessies, tss_totaal: 0 });
        setWeekSessiesLaden(false);
        return;
      }

      // Kaderweek(en) bepalen
      const dagenSindsStart = Math.max(0, (Date.now() - new Date(seizoensplan.startdatum).getTime()) / 86400000);
      const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
      const kaderWeek = seizoensplan.kader?.find(w => w.week === weekNr) || seizoensplan.kader?.[0] || { fase: "basis", tss_doel: 250, focus: "Z2 volume" };
      const kaderWeek2 = seizoensplan.kader?.find(w => w.week === weekNr + 1) || kaderWeek;

      // Recente ritten (context voor Claude)
      const weekGeleden = new Date(Date.now() - 7 * 86400000);
      const recenteRitten = (voortgang?.ritten || [])
        .filter(r => r.datum_iso && new Date(r.datum_iso) >= weekGeleden)
        .map(r => `${r.datum}: ${r.naam} | ${r.wattage || "?"}W | HR ${r.hartslag || "?"} | ${r.tss || "?"} TSS${r.rpe ? ` | RPE ${r.rpe}/10` : ""}`)
        .join("\n") || "Geen ritten afgelopen week";

      // Vorige week vergelijking
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

      // HRV trend
      const recenteHrv = (dagelijkseData || []).filter(d => d.hrv).slice(-5);
      let hrvTrend = "stabiel";
      if (recenteHrv.length >= 3) {
        const eerste = recenteHrv.slice(0, 2).reduce((s, d) => s + d.hrv, 0) / 2;
        const laatste = recenteHrv.slice(-2).reduce((s, d) => s + d.hrv, 0) / 2;
        if (laatste < eerste - 3) hrvTrend = "dalend";
        else if (laatste > eerste + 3) hrvTrend = "stijgend";
      }
      const hrvVandaag = recenteHrv.length > 0 ? recenteHrv[recenteHrv.length - 1].hrv : null;

      // RPE-analyse (14 dagen)
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

        // RPE per trainingstype
        const bestaandeSessies = weekSessies?.sessies || [];
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

        rpeAnalyse = `\nRPE-ANALYSE (afgelopen 14 dagen, ${rittenMetRpe.length} ritten):
- Gemiddelde RPE: ${gemRpe}/10
${tssRatio ? `- TSS-ratio (werkelijk/gepland): ${Math.round(tssRatio * 100)}%` : ""}
- Signaal: ${signaal}
- RPE per trainingstype:
${typeRegels}`;
      }

      const prompt = `Maak concrete trainingssessies voor een wielrenner voor de komende 10 dagen.

PROFIEL: FTP ${PROFIEL.ftp}W | LT ${PROFIEL.lt_hr} bpm | Max HR ${PROFIEL.max_hr} bpm | ${PROFIEL.gewicht} kg | Eerste seizoen

HUIDIGE STAAT:
- CTL: ${Math.round(ctl)} (fitheid) | ATL: ${Math.round(atl)} (vermoeidheid) | TSB: ${tsb} (vorm)
- HRV vandaag: ${hrvVandaag || "onbekend"} ms (basislijn ${HRV_BASISLIJN} ms) | HRV trend: ${hrvTrend}
- Rusthartslag: ${vandaagInvoer?.rusthartslag || "onbekend"} bpm (basislijn ${HR_BASISLIJN} bpm)

VORIGE WEEK:
${geplandeTssVorig > 0 ? `- Gepland: ${geplandeTssVorig} TSS | Werkelijk: ${werkelijkeTssVorig} TSS (${Math.round(werkelijkeTssVorig/geplandeTssVorig*100)}%)` : "- Geen data vorige week"}
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
- Als RPE per trainingstype "te zwaar" is: verlaag het doelvermogen voor dat type met 5-10%
- Als RPE per trainingstype "te licht" is: verhoog het doelvermogen voor dat type met 5%
- 80/20 polarisatie | Max ~150 TSS per sessie
- Geef bij elke sessie een concrete, data-gedreven reden

SESSIETYPES:
- duur_lang: vlakke Z2 duurrit (68-76% FTP constant)
- duur_variabel: afwisselende Z2/Z3 blokken (Z2 = 68-76% FTP, Z3 = 76-85% FTP, NOOIT hoger). Kies dit type als TSB > -5 en de vorige duurrit ook vlak Z2 was — zorgt voor afwisseling zonder extra belasting. Telt als Z2-volume voor de 80/20-verdeling
- sweetspot: 88-93% FTP blokken met herstel ertussen
- interval: 95-120% FTP blokken met herstel ertussen
- herstel: laag vermogen (50-60% FTP)

SEGMENTEN-FORMAAT:
- GEEN warmup of cooldown segmenten genereren — de hoofdinspanning vult de hele sessieduur
- Gebruik vermogenMin en vermogenMax (in %FTP) voor een doelrange per segment
- Bij intervallen: afwisselende werk/herstel-blokken

Geef JSON:
{
  "weekdoel": "...",
  "sessies": [
    {
      "datum": "2026-06-24",
      "dag": "Dinsdag",
      "type": "duur_lang",
      "titel": "Z2 duurrit",
      "tss": 85,
      "duur_min": 90,
      "vermogen": "170-195W",
      "hartslag": "<152 bpm",
      "beschrijving": "90 minuten Z2, focus op cadans 85-95",
      "reden": "Aerobe basis na rustdag gisteren",
      "segmenten": [
        { "type": "z2", "duur_min": 90, "vermogenMin": 68, "vermogenMax": 76, "label": "Z2 duur" }
      ]
    },
    {
      "datum": "2026-06-26",
      "dag": "Donderdag",
      "type": "duur_variabel",
      "titel": "Variabele duurrit",
      "tss": 80,
      "duur_min": 75,
      "vermogen": "180-225W",
      "hartslag": "<165 bpm",
      "beschrijving": "Afwisselend Z2 en Z3 blokken voor variatie",
      "reden": "TSB -3, vorige duurrit was vlak Z2, afwisseling",
      "segmenten": [
        { "type": "z2", "duur_min": 10, "vermogenMin": 68, "vermogenMax": 76, "label": "Z2 duur" },
        { "type": "tempo", "duur_min": 5, "vermogenMin": 76, "vermogenMax": 85, "label": "Z3 tempo" },
        { "type": "z2", "duur_min": 10, "vermogenMin": 68, "vermogenMax": 76, "label": "Z2 duur" },
        { "type": "tempo", "duur_min": 5, "vermogenMin": 76, "vermogenMax": 85, "label": "Z3 tempo" },
        { "type": "z2", "duur_min": 10, "vermogenMin": 68, "vermogenMax": 76, "label": "Z2 duur" },
        { "type": "tempo", "duur_min": 5, "vermogenMin": 76, "vermogenMax": 85, "label": "Z3 tempo" },
        { "type": "z2", "duur_min": 20, "vermogenMin": 68, "vermogenMax": 76, "label": "Z2 duur" }
      ]
    }
  ],
  "tss_totaal": 165,
  "opmerking": "optioneel"
}
Genereer nu sessies voor MIJN situatie. Alleen JSON.`;

      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, system: "Je bent een professionele fietscoach. Genereer gepersonaliseerde sessies met gedetailleerde workout-segmenten. Nederlands, alleen JSON.", max_tokens: 4000 }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      const result = JSON.parse(data.text.replace(/```json|```/g, "").trim());

      if (!seizoensplan.gestart && result.sessies?.length > 0) {
        const bijgewerktPlan = { ...seizoensplan, startdatum: result.sessies[0].datum || vandaagISO, gestart: true };
        setSeizoensplan(bijgewerktPlan);
        fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bijgewerktPlan) });
      }

      // Sync naar intervals.icu: event IDs overnemen van oude sessies voor updates
      const nieuweSessies = result.sessies || [];
      const oudeEventIds = {};
      bestaandeSessies.forEach(s => {
        if (s.intervalsEventId && s.datum) oudeEventIds[s.datum] = s.intervalsEventId;
      });
      nieuweSessies.forEach(s => {
        if (oudeEventIds[s.datum]) s.intervalsEventId = oudeEventIds[s.datum];
      });

      if (nieuweSessies.length > 0) {
        try {
          const syncResp = await fetch("/api/intervals/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessies: nieuweSessies, ftp: PROFIEL.ftp }),
          });
          const syncData = await syncResp.json();
          if (syncData.success && syncData.data) {
            syncData.data.forEach(evt => {
              const sessie = nieuweSessies.find(s => s.datum === evt.datum);
              if (sessie) sessie.intervalsEventId = evt.id;
            });
          }
        } catch (e) {
          console.error("Intervals.icu sync:", e);
        }
      }

      // Merge: bewaar voltooide sessies, voeg nieuwe toekomstige toe
      const alleSessies = [...bewaardeSessies, ...nieuweSessies];
      const nieuweWeekSessies = { ...result, sessies: alleSessies, fase: kaderWeek.fase };
      setWeekSessies(nieuweWeekSessies);
      const bijgewerkt = { ...seizoensplan, beschikbaarheid: Object.fromEntries(beschikbareDagen.map(d => [d, true])), urenPerDag, weekSessies: nieuweWeekSessies };
      setSeizoensplan(bijgewerkt);
      fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bijgewerkt) });
    } catch (e) {
      if (!stil) setFout("Sessies genereren mislukt: " + e.message);
      else console.error("Stille sessie-regeneratie mislukt:", e);
    }
    if (!stil) setWeekSessiesLaden(false);
  }, [seizoensplan, wellenessHuidig]);

  const verwijderSessie = useCallback(async (datum) => {
    const sessies = weekSessies?.sessies || [];
    const sessie = sessies.find(s => s.datum === datum);
    const nieuweSessies = sessies.filter(s => s.datum !== datum);
    const nieuweWeekSessies = { ...weekSessies, sessies: nieuweSessies };
    setWeekSessies(nieuweWeekSessies);
    const bijgewerkt = { ...seizoensplan, weekSessies: nieuweWeekSessies };
    setSeizoensplan(bijgewerkt);
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bijgewerkt) });
    if (sessie?.intervalsEventId) {
      fetch(`/api/intervals/events/${sessie.intervalsEventId}`, { method: "DELETE" }).catch(() => {});
    }
  }, [weekSessies, seizoensplan]);

  const genereerSessieDag = useCallback(async (datum, dagNaam, uren) => {
    if (!seizoensplan?.kader) return null;
    const ftp = PROFIEL.ftp;
    const ctl = wellenessHuidig?.ctl || seizoensplan.huidige_ctl || 45;
    const atl = wellenessHuidig?.atl || 0;
    const tsb = Math.round(ctl - atl);

    const dagenSindsStart = Math.max(0, (Date.now() - new Date(seizoensplan.startdatum).getTime()) / 86400000);
    const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
    const kaderWeek = seizoensplan.kader?.find(w => w.week === weekNr) || seizoensplan.kader?.[0] || { fase: "basis", tss_doel: 250, focus: "Z2 volume" };

    const zwaarTypes = ["sweetspot", "interval", "drempel", "vo2max"];
    const bestaandeSessies = (weekSessies?.sessies || []).filter(s => s.datum !== datum && !s.voltooid);
    const weekTssNu = bestaandeSessies.reduce((s, sess) => s + (sess.tss || 0), 0);
    const bestaande = bestaandeSessies
      .map(s => `  ${s.datum} (${s.dag}): ${s.type}${zwaarTypes.includes(s.type) ? " [ZWAAR]" : ""}, ${s.tss || "?"} TSS, ${s.duur_min || "?"}min`)
      .join("\n") || "Geen";

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

    const prompt = `Maak één trainingssessie voor ${datum} (${dagNaam}), ${uren} uur beschikbaar.

PROFIEL: FTP ${ftp}W | LT ${PROFIEL.lt_hr} bpm | Max HR ${PROFIEL.max_hr} bpm | ${PROFIEL.gewicht} kg | Eerste seizoen
CTL: ${Math.round(ctl)} | ATL: ${Math.round(atl)} | TSB: ${tsb}
HRV: ${hrvInfo}
RPE afgelopen week: ${rpeInfo}
Fase: ${kaderWeek.fase} — ${kaderWeek.focus} (TSS-doel ${kaderWeek.tss_doel}/week, reeds gepland: ${weekTssNu} TSS)

OVERIGE SESSIES DEZE WEEK (niet wijzigen, houd spreiding — [ZWAAR] = intensiteitsdag):
${bestaande}

REGELS:
- Duur past binnen ${uren} uur. Kies type op basis van fase, TSB, HRV en spreiding t.o.v. bestaande sessies
- Min 1 rustdag tussen harde sessies (sweetspot/interval). Als TSB < -20 of HRV dalend: alleen Z2 of herstel
- Houd week-TSS onder ${kaderWeek.tss_doel} totaal (er is al ${weekTssNu} gepland)
- 80/20 polarisatie: max 2 intensiteitsdagen per week
- GEEN warmup/cooldown segmenten, hoofdinspanning vult hele duur
- Gebruik vermogenMin/vermogenMax in %FTP per segment
- Geef een concrete, data-gedreven reden

SESSIETYPES: duur_lang | duur_variabel | sweetspot | interval | herstel

Geef JSON (alleen het sessie-object, geen array):
{ "datum": "${datum}", "dag": "${dagNaam}", "type": "...", "titel": "...", "tss": ..., "duur_min": ..., "vermogen": "...", "reden": "...", "segmenten": [...] }
Alleen JSON.`;

    try {
      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, system: "Je bent een professionele fietscoach. Genereer één gepersonaliseerde sessie met gedetailleerde workout-segmenten. Nederlands, alleen JSON.", max_tokens: 1500 }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      const sessie = JSON.parse(data.text.replace(/```json|```/g, "").trim());

      try {
        const syncResp = await fetch("/api/intervals/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessies: [sessie], ftp }),
        });
        const syncData = await syncResp.json();
        if (syncData.success && syncData.data?.[0]) {
          sessie.intervalsEventId = syncData.data[0].id;
        }
      } catch {}

      const alleSessies = [...(weekSessies?.sessies || []).filter(s => s.datum !== datum), sessie];
      const nieuweWeekSessies = { ...weekSessies, sessies: alleSessies };
      setWeekSessies(nieuweWeekSessies);
      const bijgewerkt = { ...seizoensplan, weekSessies: nieuweWeekSessies };
      setSeizoensplan(bijgewerkt);
      fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bijgewerkt) });
      return sessie;
    } catch (e) {
      console.error("Sessie genereren mislukt:", datum, e);
      return null;
    }
  }, [seizoensplan, weekSessies, wellenessHuidig, dagelijkseData, voortgang]);

  const checkImpact = useCallback(async (gewijzigdeDatums) => {
    const sessies = weekSessies?.sessies || [];
    if (sessies.length < 2) return;

    const dagenSindsStart = Math.max(0, (Date.now() - new Date(seizoensplan.startdatum).getTime()) / 86400000);
    const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
    const kaderWeek = seizoensplan.kader?.find(w => w.week === weekNr) || seizoensplan.kader?.[0];
    const tssTarget = kaderWeek?.tss_doel || 300;

    const zwareSessies = sessies.filter(s => ["sweetspot", "interval", "drempel", "vo2max"].includes(s.type));
    const conflicten = new Set();

    for (const s of zwareSessies) {
      if (!s.datum) continue;
      const d = new Date(s.datum);
      for (const andere of zwareSessies) {
        if (andere === s || !andere.datum) continue;
        const verschilUren = Math.abs(d - new Date(andere.datum)) / 3600000;
        if (verschilUren > 0 && verschilUren < 48) {
          const later = s.datum > andere.datum ? s.datum : andere.datum;
          if (gewijzigdeDatums.includes(later)) conflicten.add(later);
        }
      }
    }

    const weekTss = sessies.reduce((s, sess) => s + (sess.tss || 0), 0);
    if (weekTss > tssTarget * 1.15) {
      const laatstGepland = sessies.filter(s => !s.voltooid && gewijzigdeDatums.includes(s.datum)).sort((a, b) => (b.tss || 0) - (a.tss || 0))[0];
      if (laatstGepland) conflicten.add(laatstGepland.datum);
    }

    for (const datum of conflicten) {
      const sessie = sessies.find(s => s.datum === datum);
      if (sessie && !sessie.voltooid) {
        const dagNaam = DAGNAMEN[new Date(datum).getDay()];
        const uren = urenPerDag[dagNaam] || 1.5;
        await genereerSessieDag(datum, dagNaam, uren);
      }
    }
  }, [weekSessies, seizoensplan, urenPerDag, genereerSessieDag]);

  const handleBeschikbaarheidOpslaan = useCallback(async (data) => {
    const oudeBeschikbaar = beschikbaar;
    const oudeUren = urenPerDag;
    const nieuwBeschikbaar = data.beschikbaar;
    const nieuwUren = data.uren;

    setBeschikbaar(nieuwBeschikbaar);
    setUrenPerDag(nieuwUren);
    setBeschikbaarheidSchermOpen(false);

    const nu = new Date();
    const vandaagISO = nu.toISOString().split("T")[0];
    const alleDagen = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

    const verwijderd = [];
    const toegevoegd = [];
    const urenGewijzigd = [];

    for (const dag of alleDagen) {
      const wasAan = !!oudeBeschikbaar[dag];
      const isAan = !!nieuwBeschikbaar[dag];
      if (wasAan && !isAan) verwijderd.push(dag);
      else if (!wasAan && isAan) toegevoegd.push(dag);
      else if (isAan && (oudeUren[dag] || 1.5) !== (nieuwUren[dag] || 1.5)) urenGewijzigd.push(dag);
    }

    let lokaalSessies = [...(weekSessies?.sessies || [])];
    const teVerwijderenEventIds = [];
    const gewijzigdeDatums = [];

    for (const dag of verwijderd) {
      for (let i = 0; i <= 10; i++) {
        const d = new Date(nu); d.setDate(nu.getDate() + i);
        if (DAGNAMEN[d.getDay()] === dag && d.toISOString().split("T")[0] >= vandaagISO) {
          const datum = d.toISOString().split("T")[0];
          const sessie = lokaalSessies.find(s => s.datum === datum && !s.voltooid);
          if (sessie) {
            if (sessie.intervalsEventId) teVerwijderenEventIds.push(sessie.intervalsEventId);
            lokaalSessies = lokaalSessies.filter(s => s.datum !== datum);
          }
          gewijzigdeDatums.push(datum);
        }
      }
    }

    const tussenWeekSessies = { ...weekSessies, sessies: lokaalSessies };
    setWeekSessies(tussenWeekSessies);

    teVerwijderenEventIds.forEach(id => {
      fetch(`/api/intervals/events/${id}`, { method: "DELETE" }).catch(() => {});
    });

    const ftp = PROFIEL.ftp;
    const ctl = wellenessHuidig?.ctl || seizoensplan?.huidige_ctl || 45;
    const atl = wellenessHuidig?.atl || 0;
    const tsb = Math.round(ctl - atl);
    const dagenSindsStart = seizoensplan?.startdatum ? Math.max(0, (Date.now() - new Date(seizoensplan.startdatum).getTime()) / 86400000) : 0;
    const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
    const kaderWeek = seizoensplan?.kader?.find(w => w.week === weekNr) || seizoensplan?.kader?.[0] || { fase: "basis", tss_doel: 250, focus: "Z2 volume" };

    const zwaarTypes = ["sweetspot", "interval", "drempel", "vo2max"];
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

    for (const dag of [...toegevoegd, ...urenGewijzigd]) {
      for (let i = 0; i <= 10; i++) {
        const d = new Date(nu); d.setDate(nu.getDate() + i);
        if (DAGNAMEN[d.getDay()] === dag && d.toISOString().split("T")[0] >= vandaagISO) {
          const datum = d.toISOString().split("T")[0];
          const uren = nieuwUren[dag] || 1.5;
          gewijzigdeDatums.push(datum);

          const weekTssNu = lokaalSessies.reduce((s, sess) => s + (sess.tss || 0), 0);
          const bestaande = lokaalSessies
            .filter(s => s.datum !== datum && !s.voltooid)
            .map(s => `  ${s.datum} (${s.dag}): ${s.type}${zwaarTypes.includes(s.type) ? " [ZWAAR]" : ""}, ${s.tss || "?"} TSS, ${s.duur_min || "?"}min`)
            .join("\n") || "Geen";

          const prompt = `Maak één trainingssessie voor ${datum} (${dag}), ${uren} uur beschikbaar.

PROFIEL: FTP ${ftp}W | LT ${PROFIEL.lt_hr} bpm | Max HR ${PROFIEL.max_hr} bpm | ${PROFIEL.gewicht} kg | Eerste seizoen
CTL: ${Math.round(ctl)} | ATL: ${Math.round(atl)} | TSB: ${tsb}
HRV: ${hrvInfo}
RPE afgelopen week: ${rpeInfo}
Fase: ${kaderWeek.fase} — ${kaderWeek.focus} (TSS-doel ${kaderWeek.tss_doel}/week, reeds gepland: ${weekTssNu} TSS)

OVERIGE SESSIES DEZE WEEK (niet wijzigen, houd spreiding — [ZWAAR] = intensiteitsdag):
${bestaande}

REGELS:
- Duur past binnen ${uren} uur. Kies type op basis van fase, TSB, HRV en spreiding t.o.v. bestaande sessies
- Min 1 rustdag tussen harde sessies (sweetspot/interval). Als TSB < -20 of HRV dalend: alleen Z2 of herstel
- Houd week-TSS onder ${kaderWeek.tss_doel} totaal (er is al ${weekTssNu} gepland)
- 80/20 polarisatie: max 2 intensiteitsdagen per week
- GEEN warmup/cooldown segmenten, hoofdinspanning vult hele duur
- Gebruik vermogenMin/vermogenMax in %FTP per segment
- Geef een concrete, data-gedreven reden

SESSIETYPES: duur_lang | duur_variabel | sweetspot | interval | herstel

Geef JSON (alleen het sessie-object, geen array):
{ "datum": "${datum}", "dag": "${dag}", "type": "...", "titel": "...", "tss": ..., "duur_min": ..., "vermogen": "...", "reden": "...", "segmenten": [...] }
Alleen JSON.`;

          try {
            const resp = await fetch("/api/claude", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt, system: "Je bent een professionele fietscoach. Genereer één gepersonaliseerde sessie met gedetailleerde workout-segmenten. Nederlands, alleen JSON.", max_tokens: 1500 }),
            });
            const cData = await resp.json();
            if (!cData.success) throw new Error(cData.error);
            const sessie = JSON.parse(cData.text.replace(/```json|```/g, "").trim());

            try {
              const syncResp = await fetch("/api/intervals/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessies: [sessie], ftp }),
              });
              const syncData = await syncResp.json();
              if (syncData.success && syncData.data?.[0]) sessie.intervalsEventId = syncData.data[0].id;
            } catch {}

            lokaalSessies = [...lokaalSessies.filter(s => s.datum !== datum), sessie];
          } catch (e) {
            console.error("Sessie genereren mislukt:", datum, e);
          }
        }
      }
    }

    const eindWeekSessies = { ...weekSessies, sessies: lokaalSessies };
    setWeekSessies(eindWeekSessies);
    const eindPlan = { ...seizoensplan, beschikbaarheid: nieuwBeschikbaar, urenPerDag: nieuwUren, weekSessies: eindWeekSessies };
    setSeizoensplan(eindPlan);
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eindPlan) });

    if (gewijzigdeDatums.length > 0) {
      checkImpact(gewijzigdeDatums).catch(e => console.error("Impact check:", e));
    }
  }, [beschikbaar, urenPerDag, seizoensplan, weekSessies, wellenessHuidig, dagelijkseData, voortgang, checkImpact]);

  const handleRpeSaved = useCallback((ritId, rpeWaarde) => {
    if (!voortgang?.ritten) return;
    const rit = voortgang.ritten.find(r => r.id === ritId);
    if (rit) rit.rpe = rpeWaarde;

    const zevenDagenGeleden = new Date(Date.now() - 7 * 86400000);
    const recenteMetRpe = (voortgang?.ritten || []).filter(r => r.rpe && r.datum_iso && new Date(r.datum_iso) >= zevenDagenGeleden);
    if (recenteMetRpe.length >= 2) {
      const gemRpe = recenteMetRpe.reduce((s, r) => s + r.rpe, 0) / recenteMetRpe.length;
      if (gemRpe >= 8 || gemRpe <= 3) {
        const beschikbareDagen = Object.entries(beschikbaar).filter(([, v]) => v).map(([k]) => k);
        if (beschikbareDagen.length > 0) genereerWeekSessies(beschikbareDagen, { stil: true });
      }
    }
  }, [voortgang, beschikbaar, genereerWeekSessies]);

  return (
    <div style={{ minHeight: "100vh", fontFamily: "var(--font-nunito), 'Nunito', sans-serif" }}>

      {beschikbaarheidSchermOpen && (
        <BeschikbaarheidScherm
          beschikbaar={beschikbaar}
          urenPerDag={urenPerDag}
          onTerug={() => setBeschikbaarheidSchermOpen(false)}
          onOpslaan={handleBeschikbaarheidOpslaan}
        />
      )}

      {/* Full-screen flows: geen wrapper, geen bottom-nav */}
      {planStap === "genereren" && (
        <PlanGenereren />
      )}

      {planStap === "overzicht" && (
        <SeizoensplanOverzicht plan={seizoensplan} onDoorGaan={() => setPlanStap(null)} />
      )}

      {!planStap && !seizoensplan && tab === 1 && (
        <SeizoenWizard
          profiel={PROFIEL}
          wellness={wellenessHuidig}
          onVoltooid={(doelConfig) => {
            setSeizoensplan(doelConfig);
            setBeschikbaar(doelConfig.beschikbaarheid || {});
            setUrenPerDag(doelConfig.urenPerDag || {});
            genereerSeizoensplan(doelConfig);
          }}
        />
      )}

      {/* Normale app + bottom-nav */}
      {!planStap && seizoensplan && (
        <>
          {fout && (
            <div style={{ maxWidth: 540, margin: "0 auto", padding: "12px 14px 0" }}>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <div style={{ color: "#dc2626", fontSize: 13 }}>{fout}</div>
                <button onClick={() => setFout(null)} style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>Sluiten ×</button>
              </div>
            </div>
          )}
          {succesMelding && (
            <div style={{ maxWidth: 540, margin: "0 auto", padding: "12px 14px 0" }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <div style={{ color: "#16a34a", fontSize: 13, fontWeight: 600 }}>{succesMelding}</div>
              </div>
            </div>
          )}

          {tab === 0 && (
            <HomeTab
              profiel={profiel}
              wellenessHuidig={wellenessHuidig}
              vandaagInvoer={vandaagInvoer}
              dagelijkseData={dagelijkseData}
              voortgang={voortgang}
              seizoensplan={seizoensplan}
              weekSessies={weekSessies}
              weekSessiesLaden={weekSessiesLaden}
              beschikbaar={beschikbaar}
              onOpenWorkout={(sessie) => {
                if (sessie.datum) {
                  const nu = new Date(); nu.setHours(0,0,0,0);
                  const sessieDatum = new Date(sessie.datum); sessieDatum.setHours(0,0,0,0);
                  setSchemaDagOffset(Math.round((sessieDatum - nu) / 86400000));
                } else {
                  const dagVolgorde = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
                  const vandaagIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                  setSchemaDagOffset(dagVolgorde.indexOf(sessie.dag) - vandaagIdx);
                }
                setTab(1);
              }}
              onEditBeschikbaarheid={() => setBeschikbaarheidSchermOpen(true)}
            />
          )}

          {tab === 1 && (
            <SchemaTab
              key={schemaDagOffset}
              seizoensplan={seizoensplan}
              weekSessies={weekSessies}
              weekSessiesLaden={weekSessiesLaden}
              beschikbaar={beschikbaar}
              voortgang={voortgang}
              profiel={profiel}
              wellenessHuidig={wellenessHuidig}
              vandaagInvoer={vandaagInvoer}
              initialDagOffset={schemaDagOffset}
              onRpeSaved={handleRpeSaved}
            />
          )}

          {tab === 2 && (
            <VoortgangTab
              profiel={profiel}
              wellness={wellness}
              wellenessHuidig={wellenessHuidig}
              voortgang={voortgang}
              seizoensplan={seizoensplan}
            />
          )}

          <BottomNav activeTab={tab} onTabChange={(i) => { setTab(i); if (i === 1) setSchemaDagOffset(0); if (i === 2 && !voortgang) laadVoortgang(); }} />
        </>
      )}
    </div>
  );
}
