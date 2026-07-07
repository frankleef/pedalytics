"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import SeizoenWizard from "./components/SeizoenWizard";
import HomeTab from "./components/HomeTab";
import VoortgangTab from "./components/VoortgangTab";
import BottomNav from "./components/BottomNav";
import BeschikbaarheidScherm from "./components/BeschikbaarheidScherm";
import SchemaTab from "./components/SchemaTab";
import PlanGenereren from "./components/PlanGenereren";
import SeizoensplanOverzicht from "./components/SeizoensplanOverzicht";
import ProfielScherm from "./components/ProfielScherm";
import MeldingenScherm from "./components/MeldingenScherm";
import { startJob, startJobRobuust, pollJob } from "@/lib/jobClient";
import { genereerSeizoensMetadata } from "@/lib/seizoen/metadata";
import { vandaagISO as getVandaag, datumISO, datumOffset } from "@/lib/datum";
import LegeKoppelStaat from "./components/LegeKoppelStaat";
import { demoProfiel, demoSeizoensplan, demoWellness, demoRitten } from "@/lib/demoData";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { bouwKader } from "@/lib/seizoen/bouwKader";
import { detecteerWeekConflicten, degradeerSessie, corrigeerWeekBudget } from "@/lib/sessie/conflictResolutie";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";

const PROFIEL_DEFAULT = { ftp: 265, lt_hr: 184, max_hr: 200, gewicht: 90, hrv_basislijn: 58, hr_basislijn: 49, doel: "31+ km/u gemiddeld solo in Z2" };

function TerugToast({ zichtbaar }) {
  if (!zichtbaar) return null;
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: "oklch(0.24 0.012 70)", color: "white",
      padding: "10px 20px", borderRadius: 999,
      font: "700 14px var(--font-nunito), sans-serif",
      zIndex: 9999, pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      Druk nogmaals terug om de app te sluiten
    </div>
  );
}

function checkHerstelpatroon(sessies, ritDatums) {
  const gesorteerd = [...sessies]
    .filter(s => !s.voltooid && !ritDatums.has(s.datum))
    .sort((a, b) => new Date(a.datum) - new Date(b.datum));

  const conflicten = [];
  for (let i = 0; i < gesorteerd.length - 1; i++) {
    const huidige = gesorteerd[i];
    const volgende = gesorteerd[i + 1];
    const dagVerschil = (new Date(volgende.datum) - new Date(huidige.datum)) / (1000 * 60 * 60 * 24);
    const tssCurrent = huidige.tss ?? huidige.tss_schatting ?? 0;
    const tssNext = volgende.tss ?? volgende.tss_schatting ?? 0;

    if (dagVerschil === 1 && tssCurrent > 50 && tssNext > 50) {
      const huidigZ2 = (huidige.intentie?.sessietype || "").startsWith("z2");
      const volgendeZ2 = (volgende.intentie?.sessietype || "").startsWith("z2");
      if (huidigZ2 && volgendeZ2 && tssCurrent < 70 && tssNext < 70) continue;

      const lichter = tssCurrent <= tssNext ? huidige : volgende;
      const zwaar = tssCurrent <= tssNext ? volgende : huidige;
      conflicten.push({ zwaar, lichter });
    }
  }
  return conflicten;
}

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
  const [meldingenOpen, setMeldingenOpen] = useState(false);
  const [heeftOngelezenMeldingen, setHeeftOngelezenMeldingen] = useState(false);
  const [nietGekoppeld, setNietGekoppeld] = useState(false);
  const [weerData, setWeerData] = useState(null);
  const [checkinScore, setCheckinScore] = useState(undefined);
  const [toastZichtbaar, setToastZichtbaar] = useState(false);
  // Eén keer opgehaald bij het laden van de app — nodig als parameter voor de
  // pure, client-side archetype-functies (bepaalNieuweIntentie/degradeerSessie/
  // solveWeek), die zelf geen KV-toegang hebben. Zie sessie-archetypes.js.
  const [archetypesData, setArchetypesData] = useState(null);

  const tabHistoryRef = useRef([]);
  const backPressTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const closingModalRef = useRef(false);
  const profielOpenRef = useRef(false);
  const meldingenOpenRef = useRef(false);
  const beschikbaarheidOpenRef = useRef(false);
  const beschikbaarheidGeneratieIdRef = useRef(null);

  useEffect(() => { profielOpenRef.current = profielOpen; }, [profielOpen]);
  useEffect(() => { meldingenOpenRef.current = meldingenOpen; }, [meldingenOpen]);
  useEffect(() => { beschikbaarheidOpenRef.current = beschikbaarheidSchermOpen; }, [beschikbaarheidSchermOpen]);

  function toonToast() {
    setToastZichtbaar(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastZichtbaar(false), 2000);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    history.replaceState({ tab: "home" }, "", window.location.pathname);
  }, []);

  useEffect(() => {
    function handlePopState() {
      if (closingModalRef.current) { closingModalRef.current = false; return; }
      if (profielOpenRef.current) { setProfielOpen(false); return; }
      if (meldingenOpenRef.current) { setMeldingenOpen(false); laadOngelezenMeldingen(); return; }
      if (beschikbaarheidOpenRef.current) { setBeschikbaarheidSchermOpen(false); return; }
      if (tabHistoryRef.current.length > 0) {
        const vorigeTab = tabHistoryRef.current.pop();
        setTab(vorigeTab);
        if (tabHistoryRef.current.length > 0) {
          history.pushState({ tab: vorigeTab }, "", window.location.pathname);
        }
        return;
      }
      if (backPressTimerRef.current) {
        clearTimeout(backPressTimerRef.current);
        backPressTimerRef.current = null;
      } else {
        toonToast();
        history.pushState(null, "", window.location.pathname);
        backPressTimerRef.current = setTimeout(() => { backPressTimerRef.current = null; }, 2000);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "ochtend" || params.get("tab") === "vandaag") setTab(0);
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
      if (d.intervalsAuthFailed) {
        window.location.href = "/onboarding/intervals?herstel=1";
        return;
      }
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
    laadOngelezenMeldingen();
    fetch("/api/archetypes").then(r => r.json()).then(d => { if (d.success) setArchetypesData(d.data); }).catch(() => {});
    fetch("/api/weer").then(r => r.json()).then(d => { if (d.success) setWeerData(d.data); }).catch(() => {});
    fetch("/api/checkin").then(r => r.json()).then(d => { setCheckinScore(d.success && d.data ? d.data.score : null); }).catch(() => { setCheckinScore(null); });

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
      const plan = genereerSeizoensMetadata({
        seizoensdoel: doelConfig.seizoensdoel,
        kader,
        ervaringsniveau: doelConfig.ervaringsniveau,
        ftp: doelConfig.huidige_ftp,
        startProfiel,
        urenPerDag: doelConfig.urenPerDag,
      });
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

      const bewaardeDatums = new Set(bewaardeSessies.map(s => s.datum));
      const alleSessies = [...bewaardeSessies, ...nieuweSessies.filter(s => !bewaardeDatums.has(s.datum))];
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

  // Reactief conflict-vangnet: scant na elke sessie-wijziging de hele week (vast +
  // gewijzigd) op (a) twee zware sessies binnen 48u, (b) week-TSS >15% boven doel.
  // Lost dit deterministisch op — geen Claude, geen job-omweg — door de
  // conflicterende dag te degraderen naar een lichtere variant (48u-conflict) of
  // door pasBudgetToe()'s kortingslogica over de hele week toe te passen
  // (budget-conflict). Als geen van beide het conflict daadwerkelijk oplost, wordt
  // dat expliciet gelogd i.p.v. stil (of via een LLM) opgevangen.
  const hersolveWeekConflicten = useCallback(async (gewijzigdeDatums, actueleSessies) => {
    const sessies = actueleSessies || weekSessies?.sessies || [];
    if (sessies.length < 2) return;

    const weekNr = weeknummerVoorDatum(new Date(), seizoensplan.startdatum);
    const kaderWeek = seizoensplan.kader?.find(w => w.week === weekNr) || seizoensplan.kader?.[0];

    const { conflictDatums, budgetConflictDatum, tssTarget } = detecteerWeekConflicten(sessies, kaderWeek, gewijzigdeDatums);
    if (conflictDatums.length === 0) return;

    let huidigeSessies = [...sessies];
    const teVerwijderenEventIds = [];
    const onopgelost = [];

    const syncNaarIntervals = async (sessie) => {
      try {
        await fetch("/api/intervals/events", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessies: [sessie], ftp: PROFIEL.ftp }),
        });
      } catch (e) { console.warn("[Conflict] Intervals-sync mislukt:", e); }
    };

    // Rapporteert een al opgeloste conflict-actie aan het meldingencentrum —
    // bouwt geen nieuwe beslislogica, legt alleen de zojuist genomen
    // beslissing vast (zie src/app/api/meldingen/log-conflict/route.js).
    const logConflictMelding = (datum, actie) => {
      fetch("/api/meldingen/log-conflict", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datum, actie }),
      }).catch(e => console.warn("[Conflict] Melding-aanmaak mislukt:", e));
    };

    // 48u-conflicten: degradeer naar de lichtste variant van hetzelfde archetype.
    const dagen48u = conflictDatums.filter(d => d !== budgetConflictDatum);
    for (const datum of dagen48u) {
      const sessie = huidigeSessies.find(s => s.datum === datum);
      if (!sessie || sessie.voltooid) continue;

      const nieuweSessie = degradeerSessie(archetypesData, sessie, PROFIEL.ftp);
      if (nieuweSessie) {
        normaliseerSessieSegmenten(nieuweSessie);
        voegVerwachtRpeToe(nieuweSessie);
        corrigeerSessieTss(nieuweSessie);
        huidigeSessies = [...huidigeSessies.filter(s => s.datum !== datum), nieuweSessie];
        console.log("[Conflict] 48u-conflict opgelost door degraderen:", datum, sessie.variant_id, "→", nieuweSessie.variant_id);
        await syncNaarIntervals(nieuweSessie);
        logConflictMelding(datum, "gedegradeerd");
      } else {
        onopgelost.push(`${datum} (48u-conflict, geen lichtere variant beschikbaar)`);
      }
    }

    // Budget-conflict: kort over de hele week (vast + gewijzigd), zelfde
    // kortingsvolgorde als pasBudgetToe (korte Z2-dagen eerst, kernstimulus/
    // secundair nooit op duur gekort).
    if (budgetConflictDatum) {
      const resultaten = corrigeerWeekBudget(huidigeSessies, tssTarget);
      for (const { datum, actie, sessie: nieuweSessie } of resultaten) {
        if (actie === "ongewijzigd") continue;
        const oude = huidigeSessies.find(s => s.datum === datum);
        if (actie === "verwijderd") {
          if (oude?.intervalsEventId) teVerwijderenEventIds.push(oude.intervalsEventId);
          huidigeSessies = huidigeSessies.filter(s => s.datum !== datum);
          console.log("[Conflict] Budget-conflict: dag verwijderd (onder minimumduur na korten):", datum);
        } else if (actie === "gekort") {
          normaliseerSessieSegmenten(nieuweSessie);
          voegVerwachtRpeToe(nieuweSessie);
          corrigeerSessieTss(nieuweSessie);
          huidigeSessies = [...huidigeSessies.filter(s => s.datum !== datum), nieuweSessie];
          console.log("[Conflict] Budget-conflict: dag gekort:", datum, oude?.duur_min, "→", nieuweSessie.duur_min);
          await syncNaarIntervals(nieuweSessie);
          logConflictMelding(datum, "gekort");
        }
      }
      const nieuweWeekTss = huidigeSessies.reduce((s, x) => s + (x.tss || 0), 0);
      if (nieuweWeekTss > tssTarget * 1.15) {
        onopgelost.push(`${budgetConflictDatum} (budget-conflict, ${nieuweWeekTss} > ${Math.round(tssTarget * 1.15)} zelfs na korten)`);
      }
    }

    teVerwijderenEventIds.forEach(id => {
      fetch(`/api/intervals/events/${id}`, { method: "DELETE" }).catch(() => {});
    });

    if (onopgelost.length > 0) {
      console.warn("[Conflict] Onopgeloste conflicten (geen automatische fix mogelijk):", onopgelost.join(", "));
    }

    const nieuweWeekSessies = { ...weekSessies, sessies: huidigeSessies };
    setWeekSessies(nieuweWeekSessies);
    const bijgewerkt = { ...seizoensplan, weekSessies: nieuweWeekSessies };
    setSeizoensplan(bijgewerkt);
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bijgewerkt) });
  }, [weekSessies, seizoensplan, archetypesData]);

  const handleBeschikbaarheidOpslaan = useCallback(async (data) => {
    const generatieId = `${Date.now()}-${Math.random()}`;
    beschikbaarheidGeneratieIdRef.current = generatieId;

    const oudeBeschikbaar = beschikbaar;
    const oudeUren = urenPerDag;
    const nieuwBeschikbaar = data.beschikbaar;
    const nieuwUren = data.uren;

    setBeschikbaar(nieuwBeschikbaar);
    setUrenPerDag(nieuwUren);
    closingModalRef.current = true;
    history.back();
    setBeschikbaarheidSchermOpen(false);

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

    // Sla beschikbaarheid én al gecorrigeerde sessies direct op als één atomaire write.
    // lokaalSessies bevat de verwijderde sessies al niet meer — een refresh ziet nooit stale data.
    fetch("/api/plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...seizoensplan,
        beschikbaarheid: nieuwBeschikbaar,
        urenPerDag: nieuwUren,
        weekSessies: { ...weekSessies, sessies: lokaalSessies },
      }),
    });

    setWeekSessies({ ...weekSessies, sessies: lokaalSessies });

    teVerwijderenEventIds.forEach(id => {
      fetch(`/api/intervals/events/${id}`, { method: "DELETE" }).catch(() => {});
    });

    // Herstelpatroon-check: als opeenvolgende sessies met hoge TSS overblijven, verlicht de lichtste
    if (verwijderd.length > 0) {
      const conflicten = checkHerstelpatroon(lokaalSessies, ritDatums);
      if (conflicten.length > 0) {
        console.log("[Herstelpatroon] Conflicten:", conflicten.map(c => `${c.zwaar.datum}+${c.lichter.datum}`));
        const alGecorrigeerd = new Set();
        for (const { lichter } of conflicten) {
          if (alGecorrigeerd.has(lichter.datum)) continue;
          alGecorrigeerd.add(lichter.datum);
          const dag = lichter.dag || DAGNAMEN[new Date(lichter.datum).getDay()];
          const uren = nieuwUren[dag] || oudeUren[dag] || 1.5;
          if (lichter.intervalsEventId) fetch(`/api/intervals/events/${lichter.intervalsEventId}`, { method: "DELETE" }).catch(() => {});
          const overige = lokaalSessies.filter(s => s.datum !== lichter.datum && !s.voltooid);
          const gecorrigeerd = await genereerSessieDagViaJob(lichter.datum, dag, uren, {
            overigeSessies: overige,
            oudeSessie: lichter,
            aanleiding: "herstelpatroon_correctie",
          });
          if (gecorrigeerd) {
            lokaalSessies = [...lokaalSessies.filter(s => s.datum !== lichter.datum), gecorrigeerd];
            console.log("[Herstelpatroon] Gecorrigeerd:", lichter.datum, lichter.type, "→", gecorrigeerd.type, gecorrigeerd.titel);
          }
        }
        setWeekSessies({ ...weekSessies, sessies: lokaalSessies });
      }
    }

    // Verplaatsingsdetectie: koppel verwijderde sessies aan nieuwe dagen
    const isVerplaatsing = verwijderdeSessies.length > 0 && toegevoegd.length > 0;
    const verplaatsIntentiePool = isVerplaatsing ? [...verwijderdeSessies] : [];

    console.log("[Beschikbaarheid] Diff:", { verwijderd, toegevoegd, urenGewijzigd, verplaatsing: isVerplaatsing ? verwijderdeSessies.map(s => s.type) : "nee" });

    // Uren gewijzigd: verwijder bestaande sessies zodat server-side aanvullen ze opnieuw genereert
    for (const dag of urenGewijzigd) {
      for (let i = 0; i <= 10; i++) {
        const d = new Date(nu); d.setDate(nu.getDate() + i);
        if (DAGNAMEN[d.getDay()] === dag && datumISO(d) >= vandaagISO) {
          const datum = datumISO(d);
          if (ritDatums.has(datum)) continue;
          const sessie = lokaalSessies.find(s => s.datum === datum && !s.voltooid);
          if (sessie) {
            if (sessie.intervalsEventId) fetch(`/api/intervals/events/${sessie.intervalsEventId}`, { method: "DELETE" }).catch(() => {});
            lokaalSessies = lokaalSessies.filter(s => s.datum !== datum);
            gewijzigdeDatums.push(datum);
          }
        }
      }
    }

    // Nieuw toegevoegde dagen: genereer sessie client-side (via job)
    const { maxTrainingsdagenPerWeek, heeftTeLangReeks } = await import("@/lib/trainingsfrequentie");

    // Hulp: maandag-ISO voor daggroepering
    function weekMaandagISO(isoDate) {
      const d = new Date(isoDate);
      const dag = d.getDay();
      d.setDate(d.getDate() + (dag === 0 ? -6 : 1 - dag));
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }

    for (const dag of toegevoegd) {
      if (beschikbaarheidGeneratieIdRef.current !== generatieId) {
        console.log("[Beschikbaarheid] Generatie geannuleerd — nieuwere beschikbaarheidssave gestart");
        return;
      }
      for (let i = 0; i <= 10; i++) {
        const d = new Date(nu); d.setDate(nu.getDate() + i);
        if (DAGNAMEN[d.getDay()] === dag && datumISO(d) >= vandaagISO) {
          const datum = datumISO(d);
          if (ritDatums.has(datum)) continue;
          const uren = nieuwUren[dag] || 1.5;
          const bestaandeSessie = lokaalSessies.find(s => s.datum === datum && !s.voltooid);
          const overigeSessies = lokaalSessies.filter(s => s.datum !== datum && !s.voltooid);
          gewijzigdeDatums.push(datum);

          // Frequentie-check: kaderweek opzoeken voor dit datum
          const mISO = weekMaandagISO(datum);
          const weekNr = seizoensplan.startdatum ? weeknummerVoorDatum(datum, seizoensplan.startdatum) : 1;
          const aankomendWeek = seizoensplan.kader?.find(w => w.week === weekNr) || seizoensplan.kader?.[0];
          const ctl = wellenessHuidig?.icu_ctl ?? seizoensplan.huidige_ctl ?? 40;
          const trainingsfrequentie = aankomendWeek?.trainingsfrequentie ?? maxTrainingsdagenPerWeek(ctl);

          // Frequentie-check: alleen sessies in dezelfde kalenderweek (excl. mobiliteit)
          const sessiesDezeWeekFreq = lokaalSessies.filter(s =>
            !s.voltooid && s.datum && weekMaandagISO(s.datum) === mISO &&
            s.type !== "herstel_mobiliteit" && s.intentie?.sessietype !== "herstel_mobiliteit"
          );
          const reedsGepland = sessiesDezeWeekFreq.length;

          if (!bestaandeSessie && reedsGepland >= trainingsfrequentie) {
            console.log(`[Beschikbaarheid] ${datum} (${dag}): rustdag — frequentie ${trainingsfrequentie} al bereikt (${reedsGepland} sessies)`);
            continue;
          }

          let beschAanleiding = bestaandeSessie ? "beschikbaarheid_uren" : "beschikbaarheid_nieuw";
          let oudeSessie = bestaandeSessie;

          // Reeks-check: alle sessies (weekgrens kan worden overschreden)
          const alleSessiesVoorReeks = lokaalSessies.filter(s => !s.voltooid && s.datum);
          if (!bestaandeSessie && heeftTeLangReeks(alleSessiesVoorReeks, { datum, type: "kandidaat" })) {
            beschAanleiding = "herstelpatroon_correctie";
            console.log(`[Beschikbaarheid] ${datum} (${dag}): opeenvolgend — aanleiding → herstelpatroon_correctie`);
          }

          if (!bestaandeSessie && verplaatsIntentiePool.length > 0) {
            oudeSessie = verplaatsIntentiePool.shift();
            beschAanleiding = "beschikbaarheid_verplaatsing";
            console.log("[Beschikbaarheid] Verplaatsing:", oudeSessie.type, "→", dag, "(intentie:", oudeSessie.intentie?.sessietype || oudeSessie.type, ")");
          } else if (!bestaandeSessie && beschAanleiding !== "herstelpatroon_correctie") {
            console.log("[Beschikbaarheid] Genereer sessie voor:", datum, dag, uren, "uur (nieuw)");
          } else if (bestaandeSessie) {
            console.log("[Beschikbaarheid] Genereer sessie voor:", datum, dag, uren, "uur", `(vervangt ${bestaandeSessie.type})`);
          }

          // Z3-naar-Z2 ruil: in de basisperiode vervalt de reden voor een Z3-afsluiter
          // zodra een extra dag beschikbaar komt — meer Z2-volume is fysiologisch superieur.
          let overigeSessiesVoorGeneratie = overigeSessies;
          if (!bestaandeSessie && beschAanleiding === "beschikbaarheid_nieuw" && uren >= 1 && aankomendWeek?.fase === "basis") {
            const sessiesDezeWeek = lokaalSessies.filter(
              s => !s.voltooid && s.datum && weekMaandagISO(s.datum) === mISO
            );
            const z2TssNieuweDag = Math.round(uren * 0.65 * 0.65 * 100);

            if (z2TssNieuweDag >= 40) {
              // Detectie: volumecorrectie-afsluiter = z2_vlak/z2_duur sessie waarbij
              // het laatste segment Z3 is, alle overige Z1/Z2, en Z3-blok ≤ 25 min.
              function isVolumeCorrectieAfsluiter(s) {
                const segs = s.segmenten ?? [];
                if (segs.length < 2) return false;
                const sessietype = s.intentie?.sessietype || s.type;
                if (sessietype !== "z2_duur") return false;
                const laatste = segs[segs.length - 1];
                if (laatste.zone !== "Z3") return false;
                if (!segs.slice(0, -1).every(seg => ["Z1", "Z2"].includes(seg.zone))) return false;
                if ((laatste.blokDuurSeconden ?? 0) > 25 * 60) return false;
                return true;
              }

              const z3Kandidaat = sessiesDezeWeek.find(isVolumeCorrectieAfsluiter);

              if (z3Kandidaat) {
                const z3Blok = z3Kandidaat.segmenten[z3Kandidaat.segmenten.length - 1];
                const z3DuurUur = (z3Blok.blokDuurSeconden ?? 0) / 3600;
                const z3GemVermogen = ((z3Blok.vermogenMin ?? 0) + (z3Blok.vermogenMax ?? 0)) / 2;
                const ftp = PROFIEL.ftp || 265;
                const z3If = z3GemVermogen > 0 ? z3GemVermogen / ftp : 0.82;
                const z3BlokTss = z3Blok.tss_schatting ?? Math.round(z3DuurUur * z3If * z3If * 100);
                const huidigeTssWeek = sessiesDezeWeek.reduce(
                  (som, s) => som + (s.tss || s.tss_schatting || 0), 0
                );
                const weekDoelTss = aankomendWeek.tss_doel || 300;
                const ruimte = weekDoelTss - (huidigeTssWeek - z3BlokTss);

                if (ruimte >= z2TssNieuweDag) {
                  console.log(`[Z3Ruil] ${z3Kandidaat.datum}: Z3-blok ${z3BlokTss} TSS verwijderd → ruimte ${ruimte} voor Z2 ${z2TssNieuweDag} TSS op ${datum}`);

                  // Segmenten zonder het Z3-blok (defensief gekloot om mutaties te vermijden)
                  const gesplitsteSegmenten = z3Kandidaat.segmenten.slice(0, -1).map(seg => ({ ...seg }));
                  const MIN_DUUR_SEC = 60 * 60;
                  let restDuurSec = gesplitsteSegmenten.reduce((s, seg) => s + (seg.blokDuurSeconden || 0), 0);

                  // Verleng langste Z2-segment als resterende duur < 60 min
                  if (restDuurSec < MIN_DUUR_SEC) {
                    let maxIdx = -1, maxDuur = 0;
                    gesplitsteSegmenten.forEach((seg, i) => {
                      if (seg.zone === "Z2" && (seg.blokDuurSeconden || 0) > maxDuur) {
                        maxDuur = seg.blokDuurSeconden || 0; maxIdx = i;
                      }
                    });
                    if (maxIdx >= 0) {
                      gesplitsteSegmenten[maxIdx].blokDuurSeconden += MIN_DUUR_SEC - restDuurSec;
                      restDuurSec = MIN_DUUR_SEC;
                    }
                  }

                  const nieuwTss = Math.max(0, (z3Kandidaat.tss || z3Kandidaat.tss_schatting || 0) - z3BlokTss);
                  const gewijzigdeSessie = {
                    ...z3Kandidaat,
                    segmenten: gesplitsteSegmenten,
                    duur_min: Math.round(restDuurSec / 60),
                    tss: nieuwTss,
                    tss_schatting: nieuwTss,
                  };

                  lokaalSessies = lokaalSessies.map(s => s.datum === z3Kandidaat.datum ? gewijzigdeSessie : s);
                  overigeSessiesVoorGeneratie = lokaalSessies.filter(s => s.datum !== datum && !s.voltooid);
                  setWeekSessies({ ...weekSessies, sessies: lokaalSessies });

                  // Intervals.icu event bijwerken voor de gewijzigde sessie
                  try {
                    await fetch("/api/intervals/events", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sessies: [gewijzigdeSessie], ftp: PROFIEL.ftp }),
                    });
                  } catch (e) { console.warn("[Z3Ruil] Intervals update mislukt:", e); }

                  beschAanleiding = "beschikbaarheid_nieuw_z2_ruil";
                }
              }
            }
          }

          // Geen herbruikbare intentie (geen bestaande sessie, geen match uit de
          // verplaatsingspool) — dit betekent dat het sessietype nog niet bekend
          // is. Dat besliste voorheen Claude; genereerSessieDagViaJob doet dat
          // niet meer (genereerSessieDag gooit nu een fout zonder intentie). Deze
          // dag wordt in plaats daarvan server-side ingevuld door de deterministische
          // solveWeek()-gebaseerde /api/sessies/aanvullen-aanroep aan het einde van
          // deze functie (die loopt hoe dan ook altijd, zie verderop).
          if (!oudeSessie) {
            console.log(`[Beschikbaarheid] ${datum} (${dag}): geen herbruikbare intentie — wordt server-side ingevuld via /api/sessies/aanvullen`);
            continue;
          }

          const sessie = await genereerSessieDagViaJob(datum, dag, uren, { overigeSessies: overigeSessiesVoorGeneratie, oudeSessie, aanleiding: beschAanleiding });
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
          const weekNr = seizoensplan?.startdatum ? weeknummerVoorDatum(weekStart, seizoensplan.startdatum) : 1;
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
    }

    if (beschikbaarheidGeneratieIdRef.current !== generatieId) {
      console.log("[Beschikbaarheid] Eindopslaan geannuleerd — nieuwere beschikbaarheidssave gestart");
      return;
    }

    const eindWeekSessies = { ...weekSessies, sessies: lokaalSessies };
    setWeekSessies(eindWeekSessies);
    const eindPlan = { ...seizoensplan, beschikbaarheid: nieuwBeschikbaar, urenPerDag: nieuwUren, weekSessies: eindWeekSessies };
    setSeizoensplan(eindPlan);
    await fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eindPlan) });

    // Server-side aanvullen: vult alle ontbrekende sessies op beschikbare dagen in.
    // Altijd aanroepen — ook als geen diff, zodat eerder verwijderde sessies worden hersteld.
    // vulSessiesAanVoorGebruiker keert snel terug als er niets ontbreekt.
    try {
      const aanvulResp = await fetch("/api/sessies/aanvullen", { method: "POST" });
      if (aanvulResp.ok) {
        const planResp = await fetch("/api/plan");
        if (planResp.ok) {
          const pd = await planResp.json();
          if (pd?.success && pd?.data) {
            if (pd.data.weekSessies) setWeekSessies(pd.data.weekSessies);
            setSeizoensplan(pd.data);
          }
        }
      }
    } catch (e) { console.error("[BeschikbaarheidAanvullen] mislukt:", e); }

    if (gewijzigdeDatums.length > 0) {
      hersolveWeekConflicten(gewijzigdeDatums, lokaalSessies).catch(e => console.error("Conflict-resolutie:", e));
    }
  }, [beschikbaar, urenPerDag, seizoensplan, weekSessies, genereerSessieDagViaJob, hersolveWeekConflicten]);

  const openProfiel = useCallback(() => {
    if (typeof window !== "undefined") history.pushState({ modal: "profiel" }, "", window.location.pathname);
    setProfielOpen(true);
  }, []);

  const laadOngelezenMeldingen = useCallback(() => {
    fetch("/api/meldingen?ongelezen=1").then(r => r.json()).then(d => {
      if (d.success) setHeeftOngelezenMeldingen((d.data || []).length > 0);
    }).catch(() => {});
  }, []);

  const openMeldingen = useCallback(() => {
    if (typeof window !== "undefined") history.pushState({ modal: "meldingen" }, "", window.location.pathname);
    setMeldingenOpen(true);
  }, []);

  // Vertaalt een melding-deeplink (bv. "/schema?datum=2026-07-09") naar
  // client-side tab-navigatie — er bestaan geen /schema,/voortgang,/profiel-
  // routes, alles loopt via de tab-state hieronder (zelfde berekening als de
  // bestaande ?tab=schema&datum=...-deeplink-parser verderop in dit bestand).
  const navigeerNaarDeeplink = useCallback((deeplink) => {
    if (!deeplink) return;
    const [pad, queryString] = deeplink.split("?");
    const params = new URLSearchParams(queryString || "");
    if (pad === "/schema") {
      setTab(1);
      const datumParam = params.get("datum");
      if (datumParam) {
        const nu = new Date();
        const vandaagIdx = nu.getDay() === 0 ? 6 : nu.getDay() - 1;
        const datumDag = new Date(datumParam);
        const datumIdx = datumDag.getDay() === 0 ? 6 : datumDag.getDay() - 1;
        setSchemaDagOffset(datumIdx - vandaagIdx);
      }
    } else if (pad === "/voortgang") {
      setTab(2);
    } else if (pad === "/profiel") {
      openProfiel();
    } else {
      setTab(0);
    }
  }, [openProfiel]);

  const openBeschikbaarheid = useCallback(() => {
    if (typeof window !== "undefined") history.pushState({ modal: "beschikbaarheid" }, "", window.location.pathname);
    setBeschikbaarheidSchermOpen(true);
  }, []);

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

  // Sectie 51-D: PUT /api/sessie/kies heeft de sessie al volledig gegenereerd EN
  // opgeslagen (plan + ZWO-sync naar intervals.icu) — deze handler hoeft alleen
  // de lokale React-state bij te werken zodat de kaart meteen ververst, geen
  // aparte PUT /api/plan nodig (in tegenstelling tot de vervangen alternatief-flow).
  const handleSessieGekozen = useCallback((datum, nieuweSessie) => {
    const sessies = weekSessies?.sessies || [];
    const eindWeekSessies = { ...weekSessies, sessies: [...sessies.filter(s => s.datum !== datum), nieuweSessie] };
    setWeekSessies(eindWeekSessies);
    setSeizoensplan({ ...seizoensplan, weekSessies: eindWeekSessies });
  }, [weekSessies, seizoensplan]);

  return (
    <div style={{ minHeight: "100vh", fontFamily: "var(--font-nunito), 'Nunito', sans-serif" }}>

      {beschikbaarheidSchermOpen && (
        <BeschikbaarheidScherm
          beschikbaar={beschikbaar}
          urenPerDag={urenPerDag}
          onTerug={() => history.back()}
          onOpslaan={handleBeschikbaarheidOpslaan}
        />
      )}

      {meldingenOpen && (
        <MeldingenScherm
          onTerug={() => history.back()}
          onNavigeer={navigeerNaarDeeplink}
        />
      )}

      {profielOpen && (
        <ProfielScherm
          profiel={profiel}
          seizoensplan={seizoensplan}
          weerData={weerData}
          initialCheckin={checkinScore}
          onCheckinWijziging={(val) => setCheckinScore(val)}
          onTerug={() => history.back()}
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
              weerData={weerData}
              initialCheckin={checkinScore}
              onCheckinWijziging={(val) => setCheckinScore(val)}
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
              onOpenProfiel={openProfiel}
              onOpenMeldingen={openMeldingen}
              heeftOngelezenMeldingen={heeftOngelezenMeldingen}
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
              weerData={weerData}
              onRpeSaved={handleRpeSaved}
              onOpenProfiel={openProfiel}
              onOpenMeldingen={openMeldingen}
              heeftOngelezenMeldingen={heeftOngelezenMeldingen}
              onEditBeschikbaarheid={openBeschikbaarheid}
              onSessieGekozen={handleSessieGekozen}
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
              onOpenProfiel={openProfiel}
              onOpenMeldingen={openMeldingen}
              heeftOngelezenMeldingen={heeftOngelezenMeldingen}
            />
          )}

          <BottomNav activeTab={tab} onTabChange={(i) => {
            if (i !== tab) {
              tabHistoryRef.current.push(tab);
              history.pushState({ tab }, "", window.location.pathname);
            }
            setTab(i);
            if (i === 1) setSchemaDagOffset(0);
            if (i === 2) laadVoortgang();
          }} />
        </>
      )}
      <TerugToast zichtbaar={toastZichtbaar} />
    </div>
  );
}
