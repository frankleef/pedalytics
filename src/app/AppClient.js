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
import ProfielScherm from "./components/ProfielScherm";
import { startJob, pollJob } from "@/lib/jobClient";

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
  const [profielOpen, setProfielOpen] = useState(false);

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
          if (!d.data.kader) setPlanHerstart(true);
        }
      } else setTab(1);
    }).catch(() => setTab(1));
    laadDagelijkseData();
    laadRecenteRitten();
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

  const laadRecenteRitten = useCallback(async () => {
    try {
      const oldest = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const actResp = await fetch(`/api/intervals/activities?oldest=${oldest}`);
      const actData = await actResp.json();
      if (!actData.success) return;
      const ritten = (actData.data || [])
        .filter(a => a.type === "Ride" || a.type === "VirtualRide")
        .map(a => ({
          id: a.id, naam: a.name,
          datum: new Date(a.start_date_local).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" }),
          datum_iso: a.start_date_local?.split("T")[0], type: a.type,
          afstand: a.distance ? Math.round(a.distance / 1000) : null,
          duur_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
          snelheid: a.average_speed ? Math.round(a.average_speed * 3.6 * 10) / 10 : null,
          wattage: a.icu_weighted_avg_watts || a.average_watts || null,
          np: a.icu_weighted_avg_watts || null, avgWatts: a.average_watts || null,
          hartslag: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          tss: a.icu_training_load || null, rpe: a.icu_rpe || null,
          max_watt: a.max_watts || null, strava_id: a.strava_id || null,
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
      setPlanVoortgang(2);
      const jobId = await startJob("seizoensplan", { profiel: PROFIEL, doelConfig, kader });
      const plan = await pollJob(jobId, { interval: 3000 });
      setPlanVoortgang(3);
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
      const vandaagISO = new Date().toISOString().split("T")[0];
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
      const jobId = await startJob("weekSessies", {
        profiel: PROFIEL, wellness: wellenessHuidig, dagelijkseData: trimDagelijks, voortgang: trimVoortgang,
        seizoensplan: { ...seizoensplan, weekSessies: undefined }, weekSessies, urenPerDag, beschikbareDagen,
      });
      const result = await pollJob(jobId, { interval: 3000, timeout: 180000 });

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
          if (syncData.success && syncData.data) syncData.data.forEach(evt => { const s = nieuweSessies.find(s => s.datum === evt.datum); if (s) s.intervalsEventId = evt.id; });
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

  const genereerSessieDagViaJob = useCallback(async (datum, dagNaam, uren, { overigeSessies, oudeSessie } = {}) => {
    if (!seizoensplan?.kader) return null;
    const oSessies = overigeSessies || (weekSessies?.sessies || []).filter(s => s.datum !== datum && !s.voltooid);
    try {
      const trimDagelijks = (dagelijkseData || []).slice(-7);
      const zevenDagenGeleden = new Date(Date.now() - 7 * 86400000);
      const trimVoortgang = voortgang ? { ritten: (voortgang.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= zevenDagenGeleden) } : null;
      const jobId = await startJob("sessieDag", {
        profiel: PROFIEL, wellness: wellenessHuidig, dagelijkseData: trimDagelijks, voortgang: trimVoortgang,
        seizoensplan: { ...seizoensplan, weekSessies: undefined }, overigeSessies: oSessies, datum, dagNaam, uren, oudeSessie: oudeSessie || null,
      });
      const sessie = await pollJob(jobId, { interval: 2500, timeout: 60000 });

      if (oudeSessie?.intervalsEventId) sessie.intervalsEventId = oudeSessie.intervalsEventId;
      try {
        const syncResp = await fetch("/api/intervals/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessies: [sessie], ftp: PROFIEL.ftp }) });
        const syncData = await syncResp.json();
        if (syncData.success && syncData.data?.[0]) sessie.intervalsEventId = syncData.data[0].id;
      } catch {}

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
        const sessie = await genereerSessieDagViaJob(datum, dagNaam, uren);
        if (sessie) {
          const alleSessies = [...(weekSessies?.sessies || []).filter(s => s.datum !== datum), sessie];
          const nieuweWeekSessies = { ...weekSessies, sessies: alleSessies };
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
    const tussenPlan = { ...seizoensplan, beschikbaarheid: nieuwBeschikbaar, urenPerDag: nieuwUren, weekSessies: tussenWeekSessies };
    setSeizoensplan(tussenPlan);
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tussenPlan) });

    teVerwijderenEventIds.forEach(id => {
      fetch(`/api/intervals/events/${id}`, { method: "DELETE" }).catch(() => {});
    });

    console.log("[Beschikbaarheid] Diff:", { verwijderd, toegevoegd, urenGewijzigd });
    const toeTeVoegen = [...toegevoegd, ...urenGewijzigd];
    for (const dag of toeTeVoegen) {
      for (let i = 0; i <= 10; i++) {
        const d = new Date(nu); d.setDate(nu.getDate() + i);
        if (DAGNAMEN[d.getDay()] === dag && d.toISOString().split("T")[0] >= vandaagISO) {
          const datum = d.toISOString().split("T")[0];
          const uren = nieuwUren[dag] || 1.5;
          const oudeSessie = lokaalSessies.find(s => s.datum === datum && !s.voltooid);
          const overigeSessies = lokaalSessies.filter(s => s.datum !== datum && !s.voltooid);
          gewijzigdeDatums.push(datum);
          console.log("[Beschikbaarheid] Genereer sessie voor:", datum, dag, uren, "uur", oudeSessie ? `(vervangt ${oudeSessie.type})` : "(nieuw)");

          const sessie = await genereerSessieDagViaJob(datum, dag, uren, { overigeSessies, oudeSessie });
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

    const eindWeekSessies = { ...weekSessies, sessies: lokaalSessies };
    setWeekSessies(eindWeekSessies);
    const eindPlan = { ...seizoensplan, beschikbaarheid: nieuwBeschikbaar, urenPerDag: nieuwUren, weekSessies: eindWeekSessies };
    setSeizoensplan(eindPlan);
    fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eindPlan) });

    if (gewijzigdeDatums.length > 0) {
      checkImpact(gewijzigdeDatums).catch(e => console.error("Impact check:", e));
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
          stravaAuth={stravaAuth}
          onTerug={() => setProfielOpen(false)}
          onUitloggen={() => { fetch("/api/logout-all", { method: "POST" }).then(() => window.location.href = "/login"); }}
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
              onOpenProfiel={() => setProfielOpen(true)}
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
              onOpenProfiel={() => setProfielOpen(true)}
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

          <BottomNav activeTab={tab} onTabChange={(i) => { setTab(i); if (i === 1) setSchemaDagOffset(0); if (i === 2) laadVoortgang(); }} />
        </>
      )}
    </div>
  );
}
