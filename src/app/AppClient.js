"use client";
import { useState, useEffect, useCallback } from "react";
import SeizoenWizard from "./components/SeizoenWizard";
import HomeTab from "./components/HomeTab";
import VoortgangTab from "./components/VoortgangTab";
import CoachTab from "./components/CoachTab";
import BottomNav from "./components/BottomNav";
import BeschikbaarheidScherm from "./components/BeschikbaarheidScherm";
import SchemaTab from "./components/SchemaTab";
import PlanGenereren from "./components/PlanGenereren";
import SeizoensplanOverzicht from "./components/SeizoensplanOverzicht";
import ProfielScherm from "./components/ProfielScherm";
import { startJob, startJobRobuust, pollJob } from "@/lib/jobClient";
import { vandaagISO as getVandaag, datumISO, datumOffset } from "@/lib/datum";
import LegeKoppelStaat from "./components/LegeKoppelStaat";
import { demoProfiel, demoSeizoensplan, demoWellness, demoRitten } from "@/lib/demoData";

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
  const [fout, setFout] = useState(null);
  const [succesMelding, setSuccesMelding] = useState(null);
  const [profielOpen, setProfielOpen] = useState(false);
  const [nietGekoppeld, setNietGekoppeld] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "ochtend" || params.get("tab") === "vandaag") setTab(0);
    if (params.get("tab") === "coach") setTab(3);
    if (params.get("tab") === "voortgang" || params.get("tab") === "vorm") setTab(2);
    if (params.get("tab") === "schema" || params.get("tab") === "sessie") {
      setTab(1);
      const datumParam = params.get("datum");
      if (datumParam) {
        const nu = new Date();
        const vandaagIdx = nu.getDay() === 0 ? 6 : nu.getDay() - 1;
        const datumDag = new Date(datumParam);
        const datumIdx = datumDag.getDay() === 0 ? 6 : datumDag.getDay() - 1;
        setSchemaDagOffset(datumIdx - vandaagIdx);
      }
    }

    // Service worker navigatie via postMessage (deep links vanuit push-notificaties)
    const swHandler = (event) => {
      if (event.data?.type === "NAVIGATE" && event.data.url) {
        const url = new URL(event.data.url, window.location.origin);
        const p = url.searchParams;
        if (p.get("tab") === "schema") {
          setTab(1);
          const d = p.get("datum");
          if (d) {
            const nu2 = new Date();
            const vi = nu2.getDay() === 0 ? 6 : nu2.getDay() - 1;
            const di = new Date(d).getDay() === 0 ? 6 : new Date(d).getDay() - 1;
            setSchemaDagOffset(di - vi);
          }
        }
      }
    };
    navigator.serviceWorker?.addEventListener("message", swHandler);

    fetch("/api/intervals/profiel").then(r => r.json()).then(d => {
      if (d.success && d.data) {
        setProfiel(p => ({ ...p, ...d.data }));
        // Profiel OK → laad plan
        fetch("/api/plan").then(r => r.json()).then(pd => {
          if (pd.success && pd.data) {
            setSeizoensplan(pd.data);
            if (pd.data.beschikbaarheid) setBeschikbaar(pd.data.beschikbaarheid);
            if (pd.data.urenPerDag) setUrenPerDag(pd.data.urenPerDag);
            if (pd.data.weekSessies) setWeekSessies(pd.data.weekSessies);
            if (pd.data.planStatus === "genereren") {
              setPlanStap("genereren");
              setPlanVoortgang(pd.data.kader ? 4 : 0);
              if (!pd.data.kader) setPlanHerstart(true);
            }
          } else setTab(1);
        }).catch(() => setTab(1));
      } else if (d.notLinked) {
        setNietGekoppeld(true);
        setProfiel(demoProfiel);
        setSeizoensplan(demoSeizoensplan);
        setWeekSessies(demoSeizoensplan.weekSessies);
        setWellness(demoWellness);
        setVoortgang({ ritten: demoRitten });
      }
    }).catch(() => {});
    laadDagelijkseData();
    laadRecenteRitten();

    return () => navigator.serviceWorker?.removeEventListener("message", swHandler);
  }, []);

  useEffect(() => {
    if (seizoensplan?.kader && !weekSessies && !weekSessiesLaden) {
      const dagen = Object.entries(seizoensplan.beschikbaarheid || beschikbaar || {}).filter(([, v]) => v).map(([k]) => k);
      if (dagen.length > 0) genereerWeekSessies(dagen);
    }
  }, [seizoensplan?.kader]);

  const [planHerstart, setPlanHerstart] = useState(false);
  useEffect(() => {
    if (planHerstart && planStap === "genereren" && seizoensplan?.doel && !seizoensplan?.kader) {
      setPlanHerstart(false);
      genereerSeizoensplan(seizoensplan);
    }
  }, [planHerstart, planStap, seizoensplan?.kader]);

  useEffect(() => {
    if (planStap === "genereren" && planVoortgang >= 4 && weekSessies) {
      setPlanStap("overzicht");
    }
  }, [planStap, planVoortgang, weekSessies]);

  const laadDagelijkseData = useCallback(async () => {
    try {
      const resp = await fetch("/api/intervals/wellness?oldest=" + datumOffset(-30));
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

  const laadRecenteRitten = useCallback(async () => {
    try {
      const oldest = datumOffset(-30);
      const actResp = await fetch(`/api/intervals/activities?oldest=${oldest}`);
      const actData = await actResp.json();
      if (!actData.success) return;
      const ritten = (actData.data || [])
        .filter(a => a.type === "Ride" || a.type === "VirtualRide")
        .map(a => ({
          id: a.id, naam: a.name,
          datum: new Date(a.start_date_local).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" }),
          datum_iso: a.start_date_local?.split("T")[0], type: a.type,
          start_date_local: a.start_date_local || null,
          afstand: a.distance ? Math.round(a.distance / 1000) : null,
          duur_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
          snelheid: a.average_speed ? Math.round(a.average_speed * 3.6 * 10) / 10 : null,
          wattage: a.icu_weighted_avg_watts || a.average_watts || null,
          np: a.icu_weighted_avg_watts || null, avgWatts: a.average_watts || null,
          hartslag: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          tss: a.icu_training_load || null, rpe: a.icu_rpe || null,
          max_watt: a.max_watts || null, strava_id: a.strava_id || null,
          zoneTijden: a.icu_zone_times || null,
          solo: true,
        }));
      setVoortgang(prev => ({ ...(prev || {}), ritten }));
    } catch (e) { console.error("Recente ritten laden:", e); }
  }, []);

  const laadVoortgang = useCallback(async () => {
    setLaadtVoortgang(true);
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
          start_date_local: a.start_date_local || null,
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
          zoneTijden: a.icu_zone_times || null,
        }));

      const soloRitten = ritten.filter(r => r.snelheid);

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
    const { DOELPROFIELEN, faseInstellingen } = require("@/lib/seizoen/doelprofielen");
    const { bouwWeekvolgorde } = require("@/lib/seizoen/faseDuren");

    const totaalWeken = doelConfig.tijdshorizon_weken || 16;
    const ctl = doelConfig.huidige_ctl || 45;
    const baseTss = Math.round(ctl * 5);
    const doelType = doelConfig.seizoensdoel?.type || doelConfig.doel || "ftp";
    const doelProfiel = DOELPROFIELEN[doelType] || DOELPROFIELEN.ftp;
    const niveau = doelConfig.ervaringsniveau || "recreatief";
    const niveauOpbouw = { starter: 0.05, recreatief: 0.10, getraind: 0.15 }[niveau] || 0.10;
    const opbouwPct = doelProfiel.tss_opbouw_pct ?? niveauOpbouw;
    const taperPct = doelProfiel.taper_tss_pct || 0.45;

    const weekVolgorde = bouwWeekvolgorde(totaalWeken, doelType, niveau);

    let vorigOpbouwTss = baseTss;
    let piekTss = baseTss;

    return weekVolgorde.map((wk) => {
      const faseInfo = faseInstellingen(doelProfiel, wk.fase);
      let tss_doel;

      if (wk.weektype === "herstel") {
        tss_doel = Math.round(piekTss * taperPct);
        vorigOpbouwTss = baseTss;
        piekTss = baseTss;
      } else if (wk.fase === "consolidatie") {
        tss_doel = Math.round(piekTss * 0.58);
      } else if (wk.fase === "test") {
        tss_doel = Math.round(piekTss * 0.40);
      } else {
        tss_doel = wk.weeknummer === 1 ? baseTss : Math.round(vorigOpbouwTss * (1 + opbouwPct));
        tss_doel = Math.min(tss_doel, Math.round(baseTss * 1.8));
        vorigOpbouwTss = tss_doel;
        piekTss = Math.max(piekTss, tss_doel);
      }

      return {
        week: wk.weeknummer,
        fase: wk.fase,
        weektype: wk.weektype,
        tss_doel,
        focus: faseInfo ? `${faseInfo.sessietypes.slice(0, 3).join(", ")}` : "Z2 volume",
        z1z2_doel: faseInfo?.z1z2_doel || 0.80,
        max_intensiteit: faseInfo?.max_intensiteit_per_week ?? 1,
        sessietypes: faseInfo?.sessietypes || ["z2_vlak", "z2_variabel", "z1_herstel"],
      };
    });
  };

  const genereerSeizoensplan = useCallback(async (doelConfig) => {
    setPlanStap("genereren");
    setPlanVoortgang(0);
    const planMetStatus = { ...doelConfig, planStatus: "genereren" };
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(planMetStatus) });
    try {
      const kader = bouwKader(doelConfig);
      setPlanVoortgang(1);

      // Start-profiel berekenen uit rijhistorie
      let startProfiel = null;
      try {
        const { berekenGemiddeldeUrenPerWeek, berekenStartTss } = require("@/lib/rijhistorie");
        const zesWekenGeleden = new Date(Date.now() - 42 * 86400000).toISOString().slice(0, 10);
        const [actResp, wellResp] = await Promise.all([
          fetch(`/api/intervals/activities?oldest=${zesWekenGeleden}`).then(r => r.json()).catch(() => null),
          fetch("/api/intervals/wellness?oldest=" + new Date(Date.now() - 86400000).toISOString().slice(0, 10)).then(r => r.json()).catch(() => null),
        ]);
        const activiteiten = actResp?.success ? actResp.data : null;
        const wellnessData = wellResp?.success ? wellResp.data : null;
        const urenPerWeek = berekenGemiddeldeUrenPerWeek(activiteiten);
        const ctlHuidig = wellnessData?.length > 0 ? wellnessData[wellnessData.length - 1]?.ctl : null;
        const gewichtKg = PROFIEL.gewicht || null;
        startProfiel = {
          historisch_uren_per_week: urenPerWeek ? Math.round(urenPerWeek * 10) / 10 : null,
          ctl_bij_start: ctlHuidig ? Math.round(ctlHuidig) : null,
          gewicht_kg: gewichtKg,
          start_tss_week: berekenStartTss(urenPerWeek, ctlHuidig),
          w_per_kg: PROFIEL.ftp && gewichtKg ? Math.round((PROFIEL.ftp / gewichtKg) * 10) / 10 : null,
        };
      } catch (e) { console.warn("Start-profiel berekening mislukt:", e); }

      setPlanVoortgang(2);
      const job = await startJob("seizoensplan", { profiel: PROFIEL, doelConfig, kader });
      const plan = job.result || await pollJob(job.jobId, { interval: 5000 });
      setPlanVoortgang(3);
      const volledigPlan = { ...doelConfig, kader, ...plan, ...(startProfiel ? { start_profiel: startProfiel } : {}), planStatus: undefined };
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
      const vandaagISO = getVandaag();
      const bestaandeSessies = weekSessies?.sessies || [];
      const bewaardeSessies = [];
      (voortgang?.ritten || []).forEach(rit => {
        if (!rit.datum_iso) return;
        const match = bestaandeSessies.find(s => s.datum === rit.datum_iso || (!s.datum && s.dag === DAGNAMEN[new Date(rit.datum_iso).getDay()]));
        if (match && rit.datum_iso <= vandaagISO) bewaardeSessies.push({ ...match, datum: rit.datum_iso, voltooid: true });
      });

      const veertienDagenGeleden = new Date(Date.now() - 14 * 86400000);
      const trimVoortgang = voortgang ? { ritten: (voortgang.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= veertienDagenGeleden) } : null;
      const trimDagelijks = (dagelijkseData || []).slice(-14);
      const job = await startJob("weekSessies", {
        profiel: PROFIEL, wellness: wellenessHuidig, dagelijkseData: trimDagelijks, voortgang: trimVoortgang,
        seizoensplan: { ...seizoensplan, weekSessies: undefined }, weekSessies, urenPerDag, beschikbareDagen,
      });
      const result = job.result || await pollJob(job.jobId, { interval: 5000, timeout: 180000 });

      if (!result.sessies || result.sessies.length === 0) {
        setWeekSessies({ sessies: bewaardeSessies, tss_totaal: 0 });
        if (!stil) setWeekSessiesLaden(false);
        return;
      }

      if (!seizoensplan.gestart && result.sessies.length > 0) {
        const bijgewerktPlan = { ...seizoensplan, startdatum: result.sessies[0].datum || vandaagISO, gestart: true };
        setSeizoensplan(bijgewerktPlan);
        fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bijgewerktPlan) });
      }

      const nieuweSessies = result.sessies;
      const oudeEventIds = {};
      bestaandeSessies.forEach(s => { if (s.intervalsEventId && s.datum) oudeEventIds[s.datum] = s.intervalsEventId; });
      nieuweSessies.forEach(s => { if (oudeEventIds[s.datum]) s.intervalsEventId = oudeEventIds[s.datum]; });

      if (nieuweSessies.length > 0) {
        try {
          const syncResp = await fetch("/api/intervals/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessies: nieuweSessies, ftp: PROFIEL.ftp }) });
          const syncData = await syncResp.json();
          if (syncData.success && syncData.data) syncData.data.forEach(evt => { const s = nieuweSessies.find(s => s.datum === evt.datum); if (s) { s.intervalsEventId = evt.id; if (evt.icu_training_load) { s.tss = evt.icu_training_load; s.tss_bron = "intervals_icu"; } } });
        } catch (e) { console.error("Intervals.icu sync:", e); }
      }

      const alleSessies = [...bewaardeSessies, ...nieuweSessies];
      const nieuweWeekSessies = { ...result, sessies: alleSessies };
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

  const genereerSessieDagViaJob = useCallback(async (datum, dagNaam, uren, { overigeSessies, oudeSessie, aanleiding = "beschikbaarheid_nieuw" } = {}) => {
    if (!seizoensplan?.kader) return null;
    const oSessies = overigeSessies || (weekSessies?.sessies || []).filter(s => s.datum !== datum && !s.voltooid);
    try {
      const trimDagelijks = (dagelijkseData || []).slice(-7);
      const zevenDagenGeleden = new Date(Date.now() - 7 * 86400000);
      const trimVoortgang = voortgang ? { ritten: (voortgang.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= zevenDagenGeleden) } : null;
      const sessie = await startJobRobuust("sessieDag", {
        profiel: PROFIEL, wellness: wellenessHuidig, dagelijkseData: trimDagelijks, voortgang: trimVoortgang,
        seizoensplan: { ...seizoensplan, weekSessies: undefined }, overigeSessies: oSessies, datum, dagNaam, uren, oudeSessie: oudeSessie || null, aanleiding,
      });

      if (oudeSessie?.intervalsEventId) sessie.intervalsEventId = oudeSessie.intervalsEventId;
      try {
        const syncResp = await fetch("/api/intervals/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessies: [sessie], ftp: PROFIEL.ftp }) });
        const syncData = await syncResp.json();
        if (syncData.success && syncData.data?.[0]) { sessie.intervalsEventId = syncData.data[0].id; if (syncData.data[0].icu_training_load) { sessie.tss = syncData.data[0].icu_training_load; sessie.tss_bron = "intervals_icu"; } }
      } catch {}

      return sessie;
    } catch (e) {
      console.error("Sessie genereren mislukt:", datum, e);
      return null;
    }
  }, [seizoensplan, weekSessies, wellenessHuidig, dagelijkseData, voortgang]);

  const checkImpact = useCallback(async (gewijzigdeDatums, actueleSessies) => {
    const sessies = actueleSessies || weekSessies?.sessies || [];
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

    let huidigeSessies = [...sessies];
    for (const datum of conflicten) {
      const sessie = huidigeSessies.find(s => s.datum === datum);
      if (sessie && !sessie.voltooid) {
        const dagNaam = DAGNAMEN[new Date(datum).getDay()];
        const uren = urenPerDag[dagNaam] || 1.5;
        const nieuweSessie = await genereerSessieDagViaJob(datum, dagNaam, uren, { oudeSessie: sessie, aanleiding: "fase_2_conflict" });
        if (nieuweSessie) {
          huidigeSessies = [...huidigeSessies.filter(s => s.datum !== datum), nieuweSessie];
          const nieuweWeekSessies = { ...weekSessies, sessies: huidigeSessies };
          setWeekSessies(nieuweWeekSessies);
          const bijgewerkt = { ...seizoensplan, weekSessies: nieuweWeekSessies };
          setSeizoensplan(bijgewerkt);
          fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bijgewerkt) });
        }
      }
    }
  }, [weekSessies, seizoensplan, urenPerDag, genereerSessieDagViaJob]);

  const handleBeschikbaarheidOpslaan = useCallback(async (data) => {
    const oudeBeschikbaar = beschikbaar;
    const oudeUren = urenPerDag;
    const nieuwBeschikbaar = data.beschikbaar;
    const nieuwUren = data.uren;

    setBeschikbaar(nieuwBeschikbaar);
    setUrenPerDag(nieuwUren);
    setBeschikbaarheidSchermOpen(false);

    // Sla beschikbaarheid/uren direct op — sessiegeneratie kan daarna minuten duren
    fetch("/api/plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...seizoensplan, beschikbaarheid: nieuwBeschikbaar, urenPerDag: nieuwUren }),
    });

    const nu = new Date();
    const vandaagISO = getVandaag();
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
    const verwijderdeSessies = [];

    const ritDatums = new Set((voortgang?.ritten || []).map(r => r.datum_iso).filter(Boolean));

    for (const dag of verwijderd) {
      for (let i = 0; i <= 10; i++) {
        const d = new Date(nu); d.setDate(nu.getDate() + i);
        if (DAGNAMEN[d.getDay()] === dag && datumISO(d) >= vandaagISO) {
          const datum = datumISO(d);
          if (ritDatums.has(datum)) continue;
          const sessie = lokaalSessies.find(s => s.datum === datum && !s.voltooid);
          if (sessie) {
            if (sessie.intervalsEventId) teVerwijderenEventIds.push(sessie.intervalsEventId);
            verwijderdeSessies.push(sessie);
            lokaalSessies = lokaalSessies.filter(s => s.datum !== datum);
          }
          gewijzigdeDatums.push(datum);
        }
      }
    }

    setWeekSessies({ ...weekSessies, sessies: lokaalSessies });

    teVerwijderenEventIds.forEach(id => {
      fetch(`/api/intervals/events/${id}`, { method: "DELETE" }).catch(() => {});
    });

    // Verplaatsingsdetectie: koppel verwijderde sessies aan nieuwe dagen
    const isVerplaatsing = verwijderdeSessies.length > 0 && toegevoegd.length > 0;
    const verplaatsIntentiePool = isVerplaatsing ? [...verwijderdeSessies] : [];

    console.log("[Beschikbaarheid] Diff:", { verwijderd, toegevoegd, urenGewijzigd, verplaatsing: isVerplaatsing ? verwijderdeSessies.map(s => s.type) : "nee" });
    const toeTeVoegen = [...toegevoegd, ...urenGewijzigd];
    for (const dag of toeTeVoegen) {
      for (let i = 0; i <= 10; i++) {
        const d = new Date(nu); d.setDate(nu.getDate() + i);
        if (DAGNAMEN[d.getDay()] === dag && datumISO(d) >= vandaagISO) {
          const datum = datumISO(d);
          if (ritDatums.has(datum)) continue;
          const uren = nieuwUren[dag] || 1.5;
          const bestaandeSessie = lokaalSessies.find(s => s.datum === datum && !s.voltooid);
          const overigeSessies = lokaalSessies.filter(s => s.datum !== datum && !s.voltooid);
          gewijzigdeDatums.push(datum);

          let oudeSessie = bestaandeSessie;
          let beschAanleiding = bestaandeSessie ? "beschikbaarheid_uren" : "beschikbaarheid_nieuw";

          // Bij verplaatsing: gebruik de intentie van de verwijderde sessie
          if (!bestaandeSessie && verplaatsIntentiePool.length > 0) {
            oudeSessie = verplaatsIntentiePool.shift();
            beschAanleiding = "beschikbaarheid_verplaatsing";
            console.log("[Beschikbaarheid] Verplaatsing:", oudeSessie.type, "→", dag, "(intentie:", oudeSessie.intentie?.sessietype || oudeSessie.type, ")");
          } else {
            console.log("[Beschikbaarheid] Genereer sessie voor:", datum, dag, uren, "uur", bestaandeSessie ? `(vervangt ${bestaandeSessie.type})` : "(nieuw)");
          }

          const sessie = await genereerSessieDagViaJob(datum, dag, uren, { overigeSessies, oudeSessie, aanleiding: beschAanleiding });
          if (sessie) {
            lokaalSessies = [...lokaalSessies.filter(s => s.datum !== datum), sessie];
            setWeekSessies({ ...weekSessies, sessies: lokaalSessies });
            console.log("[Beschikbaarheid] Sessie toegevoegd:", sessie.type, sessie.titel);
          } else {
            setFout(`Sessie voor ${dag} ${datum} mislukt`);
          }
        }
      }
    }

    // Weekpatroon-validatie: check of elke geraakte week nog variëteit heeft
    if (gewijzigdeDatums.length > 0 && seizoensplan?.kader) {
      try {
        const { valideerWeekpatroon, kiesBesteDagVoorRol, bepaalIntentieVoorRol } = await import("@/lib/sessie/weekpatroon");
        const seizoenStart = seizoensplan.startdatum ? new Date(seizoensplan.startdatum) : null;
        const geraakteWeken = new Set();
        gewijzigdeDatums.forEach(d => {
          const dt = new Date(d); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
          geraakteWeken.add(datumISO(dt));
        });

        for (const weekStart of geraakteWeken) {
          const weekEind = new Date(new Date(weekStart).getTime() + 7 * 86400000);
          const weekSessiesLijst = lokaalSessies.filter(s => s.datum >= weekStart && s.datum < datumISO(weekEind));
          const dagenSinds = seizoenStart ? (new Date(weekStart) - seizoenStart) / 86400000 : 0;
          const weekNr = Math.max(1, Math.ceil(dagenSinds / 7) + 1);
          const kaderWeek = seizoensplan.kader.find(w => w.week === weekNr) || seizoensplan.kader[0];

          const validatie = valideerWeekpatroon(weekSessiesLijst, kaderWeek);
          if (!validatie.geldig && validatie.ontbrekendeRollen.length > 0) {
            console.log("[Weekpatroon] Week", weekStart, "mist:", validatie.ontbrekendeRollen);
            const kandidaat = kiesBesteDagVoorRol(weekSessiesLijst, validatie.ontbrekendeRollen[0], nieuwUren);
            if (kandidaat) {
              const nieuweIntentie = bepaalIntentieVoorRol(validatie.ontbrekendeRollen[0], kaderWeek.fase);
              const oudeSessieMetIntentie = { ...kandidaat, intentie: nieuweIntentie };
              console.log("[Weekpatroon] Corrigeer", kandidaat.datum, "→", nieuweIntentie.sessietype);
              const uren = nieuwUren[kandidaat.dag || DAGNAMEN[new Date(kandidaat.datum).getDay()]] || 1.5;
              const overige = lokaalSessies.filter(s => s.datum !== kandidaat.datum && !s.voltooid);
              const gecorrigeerd = await genereerSessieDagViaJob(kandidaat.datum, kandidaat.dag || DAGNAMEN[new Date(kandidaat.datum).getDay()], uren, {
                overigeSessies: overige, oudeSessie: oudeSessieMetIntentie, aanleiding: "weekpatroon_correctie",
              });
              if (gecorrigeerd) {
                lokaalSessies = [...lokaalSessies.filter(s => s.datum !== kandidaat.datum), gecorrigeerd];
                console.log("[Weekpatroon] Gecorrigeerd:", gecorrigeerd.type, gecorrigeerd.titel);
              }
            }
          }
        }
      } catch (e) { console.error("[Weekpatroon] Validatie mislukt:", e); }

      // Waarom-teksten van buurdagen vernieuwen
      try {
        const { vernieuwWaaromTekstenWeek } = await import("@/lib/sessie/waaromTekst");
        const bijgewerkt = await vernieuwWaaromTekstenWeek(lokaalSessies, gewijzigdeDatums);
        if (bijgewerkt.length > 0) console.log("[WaaromTekst] Vernieuwd voor:", bijgewerkt.join(", "));
      } catch (e) { console.error("[WaaromTekst] Vernieuwing mislukt:", e); }
    }

    // Volumecorrectie-geldigheidscheck: beschikbaarheid gewijzigd → ongeldig geworden sessies herplannen
    const huidigeBeschikbareDagen = Object.values(nieuwBeschikbaar).filter(Boolean).length;
    const ongeldigeSessies = lokaalSessies.filter(s =>
      s.volumecorrectie &&
      s.volumecorrectie.beschikbareDagen !== huidigeBeschikbareDagen &&
      !s.voltooid && !ritDatums.has(s.datum)
    );
    if (ongeldigeSessies.length > 0) {
      console.log("[VolumecorrectieHereval] Ongeldig geworden sessies:", ongeldigeSessies.map(s => s.datum));
      const ongeldigeDatums = new Set(ongeldigeSessies.map(s => s.datum));
      ongeldigeSessies.forEach(s => {
        if (s.intervalsEventId) fetch(`/api/intervals/events/${s.intervalsEventId}`, { method: "DELETE" }).catch(() => {});
      });
      lokaalSessies = lokaalSessies.filter(s => !ongeldigeDatums.has(s.datum) || s.voltooid);

      const tussenPlan = { ...seizoensplan, beschikbaarheid: nieuwBeschikbaar, urenPerDag: nieuwUren, weekSessies: { ...weekSessies, sessies: lokaalSessies } };
      setWeekSessies(tussenPlan.weekSessies);
      setSeizoensplan(tussenPlan);
      await fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tussenPlan) });

      try {
        const herevalResp = await fetch("/api/volumecorrectie/hereval", { method: "POST" });
        if (herevalResp.ok) {
          const planResp = await fetch("/api/plan");
          if (planResp.ok) {
            const bijgewerktPlan = await planResp.json();
            if (bijgewerktPlan?.weekSessies) setWeekSessies(bijgewerktPlan.weekSessies);
            if (bijgewerktPlan) setSeizoensplan(bijgewerktPlan);
          }
        }
      } catch (e) { console.error("[VolumecorrectieHereval] mislukt:", e); }
      return;
    }

    const eindWeekSessies = { ...weekSessies, sessies: lokaalSessies };
    setWeekSessies(eindWeekSessies);
    const eindPlan = { ...seizoensplan, beschikbaarheid: nieuwBeschikbaar, urenPerDag: nieuwUren, weekSessies: eindWeekSessies };
    setSeizoensplan(eindPlan);
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eindPlan) });

    if (gewijzigdeDatums.length > 0) {
      checkImpact(gewijzigdeDatums, lokaalSessies).catch(e => console.error("Impact check:", e));
    }
  }, [beschikbaar, urenPerDag, seizoensplan, weekSessies, genereerSessieDagViaJob, checkImpact]);

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

  const handleAlternatiefSessie = useCallback(async (datum, reden) => {
    const sessies = weekSessies?.sessies || [];
    const sessie = sessies.find(s => s.datum === datum && !s.voltooid);
    if (!sessie?.intentie) return;

    const { bepaalNieuweIntentie } = await import("@/lib/sessie/alternatief");
    const dagenSindsStart = seizoensplan?.startdatum ? Math.max(0, (new Date(datum).getTime() - new Date(seizoensplan.startdatum).getTime()) / 86400000) : 0;
    const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
    const kaderWeek = seizoensplan?.kader?.find(w => w.week === weekNr) || seizoensplan?.kader?.[0];
    const fase = kaderWeek?.fase || "basis";

    const nieuweIntentie = bepaalNieuweIntentie(sessie.intentie, reden, fase, sessie.hrv_zone ?? null);
    if (!nieuweIntentie) return;

    const DAGNAMEN_LOC = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
    const dagNaam = DAGNAMEN_LOC[new Date(datum).getDay()];
    const uren = urenPerDag[dagNaam] || 1.5;
    const overigeSessies = sessies.filter(s => s.datum !== datum && !s.voltooid);
    const oudeSessieMetIntentie = { ...sessie, intentie: nieuweIntentie };

    console.log("[Alternatief] Start:", datum, sessie.intentie.sessietype, "→", nieuweIntentie.sessietype, "reden:", reden);

    const nieuweSessie = await genereerSessieDagViaJob(datum, dagNaam, uren, {
      overigeSessies, oudeSessie: oudeSessieMetIntentie, aanleiding: "alternatief_verzoek",
    });

    if (!nieuweSessie) {
      setFout("Alternatieve sessie genereren mislukt");
      return;
    }

    let lokaalSessies = [...sessies.filter(s => s.datum !== datum), nieuweSessie];
    setWeekSessies({ ...weekSessies, sessies: lokaalSessies });
    console.log("[Alternatief] Nieuwe sessie:", nieuweSessie.type, nieuweSessie.titel);

    // Weekpatroon-validatie (hergebruik logica van beschikbaarheidswijziging)
    if (seizoensplan?.kader) {
      try {
        const { valideerWeekpatroon, kiesBesteDagVoorRol, bepaalIntentieVoorRol } = await import("@/lib/sessie/weekpatroon");
        const weekStart = new Date(datum);
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        const weekStartISO = datumISO(weekStart);
        const weekEind = new Date(weekStart.getTime() + 7 * 86400000);
        const weekSessiesLijst = lokaalSessies.filter(s => s.datum >= weekStartISO && s.datum < datumISO(weekEind));

        const validatie = valideerWeekpatroon(weekSessiesLijst, kaderWeek);
        if (!validatie.geldig && validatie.ontbrekendeRollen.length > 0) {
          console.log("[Alternatief] Weekpatroon mist:", validatie.ontbrekendeRollen);
          const kandidaat = kiesBesteDagVoorRol(weekSessiesLijst, validatie.ontbrekendeRollen[0], urenPerDag);
          if (kandidaat) {
            const rolIntentie = bepaalIntentieVoorRol(validatie.ontbrekendeRollen[0], fase);
            const kandidaatDag = DAGNAMEN_LOC[new Date(kandidaat.datum).getDay()];
            const kandidaatUren = urenPerDag[kandidaatDag] || 1.5;
            const overige = lokaalSessies.filter(s => s.datum !== kandidaat.datum && !s.voltooid);
            console.log("[Alternatief] Weekpatroon-correctie:", kandidaat.datum, "→", rolIntentie.sessietype);
            const gecorrigeerd = await genereerSessieDagViaJob(kandidaat.datum, kandidaatDag, kandidaatUren, {
              overigeSessies: overige, oudeSessie: { ...kandidaat, intentie: rolIntentie }, aanleiding: "weekpatroon_correctie",
            });
            if (gecorrigeerd) {
              lokaalSessies = [...lokaalSessies.filter(s => s.datum !== kandidaat.datum), gecorrigeerd];
              console.log("[Alternatief] Gecorrigeerd:", gecorrigeerd.type, gecorrigeerd.titel);
            }
          }
        }
      } catch (e) { console.error("[Alternatief] Weekpatroon-validatie mislukt:", e); }

      // Waarom-teksten buurdagen vernieuwen
      try {
        const { vernieuwWaaromTekstenWeek } = await import("@/lib/sessie/waaromTekst");
        const bijgewerkt = await vernieuwWaaromTekstenWeek(lokaalSessies, [datum]);
        if (bijgewerkt.length > 0) console.log("[Alternatief] WaaromTekst vernieuwd:", bijgewerkt.join(", "));
      } catch (e) { console.error("[Alternatief] WaaromTekst mislukt:", e); }
    }

    const eindWeekSessies = { ...weekSessies, sessies: lokaalSessies };
    setWeekSessies(eindWeekSessies);
    const eindPlan = { ...seizoensplan, weekSessies: eindWeekSessies };
    setSeizoensplan(eindPlan);
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eindPlan) });
  }, [weekSessies, seizoensplan, urenPerDag, genereerSessieDagViaJob]);

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

      {profielOpen && (
        <ProfielScherm
          profiel={profiel}
          seizoensplan={seizoensplan}
          onTerug={() => setProfielOpen(false)}
          onUitloggen={() => { import("next-auth/react").then(m => m.signOut({ callbackUrl: "/login" })); }}
          onPlanWijziging={() => {
            fetch("/api/plan").then(r => r.json()).then(pd => {
              if (pd.success && pd.data) { setSeizoensplan(pd.data); if (pd.data.weekSessies) setWeekSessies(pd.data.weekSessies); }
            });
          }}
        />
      )}

      {/* Full-screen flows: geen wrapper, geen bottom-nav */}
      {planStap === "genereren" && (
        <PlanGenereren />
      )}

      {planStap === "overzicht" && (
        <SeizoensplanOverzicht plan={seizoensplan} onDoorGaan={() => setPlanStap(null)} />
      )}

      {!planStap && !seizoensplan && !nietGekoppeld && tab === 1 && (
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

          {/* Demo-banner als niet gekoppeld */}
          {nietGekoppeld && (
            <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 16, background: "oklch(0.95 0.022 248)", border: "1px solid oklch(0.9 0.03 240)", marginBottom: 14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" stroke="oklch(0.55 0.09 248)" strokeWidth="2"/><path d="M12 8v4l2.5 1.5" stroke="oklch(0.55 0.09 248)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ flex: 1, font: "600 12.5px var(--font-nunito), sans-serif", color: "oklch(0.4 0.06 248)" }}>Dit is een voorbeeldomgeving</span>
                <a href="/onboarding/intervals" style={{ flexShrink: 0, font: "800 12px var(--font-nunito), sans-serif", color: "oklch(0.97 0.01 84)", background: "oklch(0.55 0.12 248)", padding: "6px 12px", borderRadius: 999, textDecoration: "none" }}>Koppelen</a>
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
              onOpenProfiel={() => setProfielOpen(true)}
            />
          )}

          {seizoensplan && tab === 1 && (
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
              onOpenProfiel={() => setProfielOpen(true)}
              onEditBeschikbaarheid={() => setBeschikbaarheidSchermOpen(true)}
              onAlternatiefSessie={handleAlternatiefSessie}
              onPlanWijziging={() => {
                fetch("/api/plan").then(r => r.json()).then(pd => {
                  if (pd.success && pd.data) {
                    setSeizoensplan(pd.data);
                    if (pd.data.weekSessies) setWeekSessies(pd.data.weekSessies);
                  }
                });
              }}
            />
          )}

          {tab === 2 && (
            <VoortgangTab
              profiel={profiel}
              wellness={wellness}
              wellenessHuidig={wellenessHuidig}
              voortgang={voortgang}
              seizoensplan={seizoensplan}
              weekSessies={weekSessies}
              onOpenProfiel={() => setProfielOpen(true)}
            />
          )}

          {tab === 3 && (
            <CoachTab
              seizoensplan={seizoensplan}
              onOpenProfiel={() => setProfielOpen(true)}
            />
          )}

          <BottomNav activeTab={tab} onTabChange={(i) => { setTab(i); if (i === 1) setSchemaDagOffset(0); if (i === 2) laadVoortgang(); }} />
        </>
      )}
    </div>
  );
}
