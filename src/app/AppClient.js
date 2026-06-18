"use client";
import { useState, useEffect, useCallback } from "react";
import TrainingLoadPanel, { berekenTrainingLoad, tsbStatus } from "./components/TrainingLoad";
import PowerCurvePanel from "./components/PowerCurve";
import ZoneVerdelingPanel from "./components/ZoneVerdeling";
import HerstelStatusPanel, { berekenHerstelScore } from "./components/HerstelStatus";
import TSSWeekPanel from "./components/TSSWeek";
import DagelijkseInvoer from "./components/DagelijkseInvoer";

const PROFIEL = { ftp: 265, lt_hr: 184, max_hr: 200, gewicht: 90, doel: "31+ km/u gemiddeld solo in Z2", strava_mcp: "https://mcp.strava.com/mcp" };
const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const GEVOEL_OPTIES = [
  { id: "top", label: "💪 Top", k: "#4ade80" },
  { id: "goed", label: "🙂 Goed", k: "#60a5fa" },
  { id: "matig", label: "😐 Matig", k: "#fbbf24" },
  { id: "moe", label: "😴 Moe", k: "#f97316" },
  { id: "slecht", label: "😞 Slecht", k: "#ef4444" },
];
const RPE_LABELS = ["","Heel licht","Licht","Matig licht","Matig","Matig zwaar","Zwaar","Zwaar+","Erg zwaar","Maximaal-","Maximaal"];
const HRV_BASISLIJN = 58;
const HR_BASISLIJN = 49;

function zoekZone(hr) {
  if (!hr) return null;
  if (hr < 128) return { n: "Z1", k: "#4ade80" };
  if (hr < 156) return { n: "Z2", k: "#60a5fa" };
  if (hr < 175) return { n: "Z3", k: "#fbbf24" };
  if (hr < 184) return { n: "Z4", k: "#f97316" };
  return { n: "Z5", k: "#ef4444" };
}

async function roepClaude(prompt, systeem) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: systeem, messages: [{ role: "user", content: prompt }] }),
  });
  const d = await r.json();
  return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}

function Chip({ k, tekst, klein }) {
  return <span style={{ background: k+"20", color: k, border: `1px solid ${k}40`, borderRadius: 6, padding: klein ? "1px 7px" : "3px 10px", fontSize: klein ? 11 : 12, fontWeight: 600, whiteSpace: "nowrap" }}>{tekst}</span>;
}

function Kaart({ children, accent, style={} }) {
  return <div style={{ background: "#0e1521", border: `1px solid ${accent||"#1e293b"}`, borderRadius: 14, padding: 16, ...style }}>{children}</div>;
}

function MiniSpark({ punten, k, hoogte=52 }) {
  if (!punten || punten.length < 2) return null;
  const vals = punten.map(p => p.v).filter(Boolean);
  if (vals.length < 2) return null;
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const breedte = 280;
  const coords = punten.filter(p => p.v).map((p, i) => {
    const x = (i / (punten.length - 1)) * breedte;
    const y = mx === mn ? hoogte/2 : hoogte - ((p.v - mn) / (mx - mn)) * hoogte;
    return `${x},${y}`;
  }).join(" ");
  const lv = vals[vals.length - 1];
  const lx = breedte;
  const ly = mx === mn ? hoogte/2 : hoogte - ((lv - mn) / (mx - mn)) * hoogte;
  return (
    <svg width="100%" viewBox={`0 0 ${breedte} ${hoogte + 12}`} style={{ overflow: "visible" }}>
      <polyline fill="none" stroke={k+"60"} strokeWidth="1.5" points={coords}/>
      <polyline fill="none" stroke={k} strokeWidth="2" points={coords}/>
      <circle cx={lx} cy={ly} r="4" fill={k}/>
      <text x={lx + 5} y={ly + 4} fontSize="9" fill={k} fontWeight="700">{lv}</text>
    </svg>
  );
}

export default function Page() {
  const [tab, setTab] = useState(0);
  const [beschikbaar, setBeschikbaar] = useState({});
  const [gevoel, setGevoel] = useState("goed");
  const [bijzonder, setBijzonder] = useState("");
  const [schema, setSchema] = useState(null);
  const [laadtSchema, setLaadtSchema] = useState(false);
  const [voortgang, setVoortgang] = useState(null);
  const [wellness, setWellness] = useState(null);
  const [laadtVoortgang, setLaadtVoortgang] = useState(false);
  const [rpeRitten, setRpeRitten] = useState([]);
  const [laadtRpe, setLaadtRpe] = useState(false);
  const [rpeOpgeslagen, setRpeOpgeslagen] = useState({});
  const [dagelijkseData, setDagelijkseData] = useState([]);
  const [vandaagInvoer, setVandaagInvoer] = useState(null);
  const [fout, setFout] = useState(null);
  const [succesMelding, setSuccesMelding] = useState(null);

  const TYPE_STIJL = {
    rust: { k: "#475569", icon: "😴" },
    herstel: { k: "#4ade80", icon: "🔄" },
    duur_lang: { k: "#60a5fa", icon: "🚴" },
    duur_middel: { k: "#818cf8", icon: "🚴" },
    interval: { k: "#f97316", icon: "⚡" },
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "rpe") { setTab(2); laadRpeRitten(); }
    if (params.get("tab") === "ochtend") setTab(0);
    // Laad dagelijkse data
    laadDagelijkseData();
  }, []);

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
          hartslag: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          eff: (a.icu_weighted_avg_watts && a.average_heartrate) ? Math.round((a.icu_weighted_avg_watts / a.average_heartrate) * 100) / 100 : null,
          tss: a.icu_training_load || null,
          ctl: a.icu_ctl || null,
          atl: a.icu_atl || null,
          tsb: a.icu_form || null,
          rpe: a.perceived_exertion || null,
          solo: (a.distance || 0) < 100000 && !["kamu","social","group","trek","utrecht","coffee"].some(w => a.name?.toLowerCase().includes(w)),
          virtual: a.type === "VirtualRide",
          // Hartslagzonenverdeling van intervals.icu
          zone_verdeling: a.icu_hr_zone_times ? (() => {
            const totaal = a.icu_hr_zone_times.reduce((s, t) => s + t, 0);
            return totaal > 0 ? a.icu_hr_zone_times.map(t => Math.round((t / totaal) * 100)) : null;
          })() : null,
        }));

      const soloRitten = ritten.filter(r => r.solo && r.snelheid);
      const eersteHalf = soloRitten.slice(0, Math.floor(soloRitten.length / 2));
      const tweedeHalf = soloRitten.slice(Math.floor(soloRitten.length / 2));
      const gem = (arr, veld) => arr.filter(r => r[veld]).length ? (arr.filter(r => r[veld]).reduce((s, r) => s + r[veld], 0) / arr.filter(r => r[veld]).length).toFixed(veld === "eff" ? 2 : 1) : 0;

      setVoortgang({
        ritten,
        seizoen_stats: {
          totaal_km: Math.round(ritten.filter(r => r.afstand).reduce((s, r) => s + r.afstand, 0)),
          totaal_ritten: ritten.length,
          snelste_solo: soloRitten.length ? Math.max(...soloRitten.map(r => r.snelheid)) : 0,
          gem_snelheid_vroeg: gem(eersteHalf, "snelheid"),
          gem_snelheid_recent: gem(tweedeHalf, "snelheid"),
          gem_eff_vroeg: gem(eersteHalf, "eff"),
          gem_eff_recent: gem(tweedeHalf, "eff"),
          beste_eff: soloRitten.filter(r => r.eff).length ? Math.max(...soloRitten.filter(r => r.eff).map(r => r.eff)).toFixed(2) : 0,
        },
      });
    } catch (e) {
      setFout("Laden mislukt: " + e.message);
    }
    setLaadtVoortgang(false);
  }, []);

  const laadRpeRitten = useCallback(async () => {
    setLaadtRpe(true);
    setFout(null);
    try {
      const resp = await fetch("/api/intervals/activities?oldest=" +
        new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0] + "&limit=10");
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      const ritten = (data.data || []).filter(a => a.type === "Ride" || a.type === "VirtualRide").slice(0, 7).map(a => ({
        id: a.id, naam: a.name,
        datum: new Date(a.start_date_local).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" }),
        afstand: a.distance ? Math.round(a.distance / 1000) : null,
        snelheid: a.average_speed ? Math.round(a.average_speed * 3.6 * 10) / 10 : null,
        wattage: a.icu_weighted_avg_watts || a.average_watts || null,
        duur_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
        rpe_bestaand: a.perceived_exertion || null,
      }));
      setRpeRitten(ritten);
      const bestaand = {};
      ritten.forEach(r => { if (r.rpe_bestaand) bestaand[r.id] = { rpe: r.rpe_bestaand }; });
      setRpeOpgeslagen(prev => ({ ...bestaand, ...prev }));
    } catch (e) { setFout("RPE laden mislukt: " + e.message); }
    setLaadtRpe(false);
  }, []);

  const slaRpeOp = async (id, rpe, gevoelRit, opmerking) => {
    try {
      const resp = await fetch(`/api/intervals/workouts/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rpe, gevoel: gevoelRit, opmerking }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      setRpeOpgeslagen(p => ({ ...p, [id]: { rpe, gevoel: gevoelRit, opmerking } }));
      setSuccesMelding("RPE opgeslagen in intervals.icu ✓");
      setTimeout(() => setSuccesMelding(null), 3000);
    } catch (e) { setFout("RPE opslaan mislukt: " + e.message); }
  };

  const genereerSchema = useCallback(async () => {
    setLaadtSchema(true);
    setSchema(null);
    setFout(null);
    try {
      const beschikbareDagen = DAGEN.filter(d => beschikbaar[d]).join(", ") || "geen opgegeven";
      const actResp = await fetch("/api/intervals/activities?oldest=" +
        new Date(Date.now() - 21 * 86400000).toISOString().split("T")[0] + "&limit=15");
      const actData = await actResp.json();
      const wellResp = await fetch("/api/intervals/wellness?oldest=" +
        new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]);
      const wellData = await wellResp.json();

      const rittenContext = actData.success ? actData.data.filter(a => a.type === "Ride" || a.type === "VirtualRide").slice(0, 8).map(a => {
        const rpe = rpeOpgeslagen[a.id]?.rpe || a.perceived_exertion;
        return `${new Date(a.start_date_local).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" })}: ${a.name} | ${a.icu_weighted_avg_watts || a.average_watts || "?"}W | HR ${Math.round(a.average_heartrate || 0)} bpm | ${Math.round((a.average_speed || 0) * 3.6 * 10) / 10} km/u${rpe ? ` | RPE ${rpe}/10` : ""}${a.icu_form ? ` | TSB ${Math.round(a.icu_form)}` : ""}`;
      }).join("\n") : "Geen data";

      const welln = wellData.success && wellData.data?.length > 0 ? wellData.data[wellData.data.length - 1] : null;
      const loadContext = welln ? `CTL: ${Math.round(welln.ctl || 0)} | ATL: ${Math.round(welln.atl || 0)} | TSB: ${Math.round((welln.ctl || 0) - (welln.atl || 0))} | HRV: ${welln.hrv || "onbekend"} ms | HR rust: ${welln.restingHR || "onbekend"} bpm` : "";

      // Vandaag ochtendmeting meesturen als beschikbaar
      const ochtendContext = vandaagInvoer ? `Ochtendmeting vandaag: HRV ${vandaagInvoer.hrv || "?"}ms (basislijn ${HRV_BASISLIJN}ms), rusthartslag ${vandaagInvoer.rusthartslag || "?"}bpm (basislijn ${HR_BASISLIJN}bpm)` : "";

      const prompt = `Maak een weekschema voor Frank op basis van deze intervals.icu data:

RECENTE RITTEN:
${rittenContext}

TRAININGSBELASTING:
${loadContext}

${ochtendContext ? ochtendContext + "\n\n" : ""}BESCHIKBARE DAGEN: ${beschikbareDagen}
HOE IK ME VOEL: ${gevoel}
BIJZONDERHEDEN: ${bijzonder || "geen"}

PROFIEL: FTP 265W | LT 184 bpm | Max HR 200 bpm | Gewicht 90 kg
DOEL: 31+ km/u solo in Z2
Z2: 128-156 bpm, 170-200W | Drempel: 175-184 bpm, 240-260W

REGELS:
- Max 3 fietsritten per week, min 1 rustdag ertussen
- 2 duurritten per 1 intervalrit
- Bij TSB onder -20 of gevoel "moe/slecht": geen intervallen
- Bij HRV meer dan 10% onder basislijn: intensiteit verlagen
- Bij rusthartslag meer dan 5 boven basislijn: rust of herstelrit

Geef JSON:
{
  "analyse": { "ctl": 43, "atl": 55, "tsb": -12, "vermoeidheid": "matig", "trend": "...", "aanbeveling": "..." },
  "schema": [{ "dag": "Maandag", "type": "rust|herstel|duur_lang|duur_middel|interval", "titel": "...", "duur": "2u30", "vermogen": "170-195W", "hartslag": "<152 bpm", "tss_doel": 65, "instructie": "..." }],
  "weekdoel": "...",
  "coaching_tip": "...",
  "naar_wahoo": [{ "dag": "Dinsdag", "naam": "Z2 Duurrit", "type": "duur_lang", "duurMin": 150, "beschrijving": "170-195W, <152 bpm", "aantalIntervals": null }]
}
Alleen JSON.`;

      const tekst = await roepClaude(prompt, "Je bent een professionele fietscoach. Analyseer data grondig en maak een data-gedreven schema. Antwoord in Nederlands, alleen JSON.");
      const resultaat = JSON.parse(tekst.replace(/```json|```/g, "").trim());
      setSchema(resultaat);
    } catch (e) { setFout("Schema genereren mislukt: " + e.message); }
    setLaadtSchema(false);
  }, [beschikbaar, gevoel, bijzonder, rpeOpgeslagen, vandaagInvoer]);


  const soloRitten = voortgang?.ritten?.filter(r => r.solo && r.snelheid) || [];
  const wellenessHuidig = wellness?.length > 0 ? wellness[wellness.length - 1] : null;
  const huidigTsb = wellenessHuidig ? Math.round((wellenessHuidig.ctl || 0) - (wellenessHuidig.atl || 0)) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#07111d", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg,#0a1628 0%,#07111d 60%)", borderBottom: "1px solid #1e293b", padding: "20px 16px 16px" }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#3b82f6", textTransform: "uppercase", marginBottom: 6 }}>Persoonlijke fietscoach</div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, marginBottom: 2 }}>Frank Levering</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{PROFIEL.doel}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip k="#3b82f6" tekst="FTP 265W" klein />
            <Chip k="#f97316" tekst="LT 184 bpm" klein />
            <Chip k="#4ade80" tekst="intervals.icu" klein />
            <Chip k="#a78bfa" tekst="→ Wahoo Bolt" klein />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#07111d", borderBottom: "1px solid #1e293b" }}>
        <div style={{ maxWidth: 540, margin: "0 auto", display: "flex" }}>
          {["🌅 Ochtend","📅 Schema","📈 Voortgang","⭐ RPE","⚙️"].map((t, i) => (
            <button key={i} onClick={() => { setTab(i); if (i === 3) laadRpeRitten(); if (i === 2 && !voortgang) laadVoortgang(); }}
              style={{ flex: 1, padding: "13px 2px", background: "none", border: "none",
                borderBottom: tab === i ? "2px solid #3b82f6" : "2px solid transparent",
                color: tab === i ? "#3b82f6" : "#475569", fontSize: 10, fontWeight: tab === i ? 700 : 400, cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "20px 14px" }}>

        {fout && (
          <Kaart accent="#7f1d1d" style={{ marginBottom: 12 }}>
            <div style={{ color: "#fca5a5", fontSize: 13 }}>{fout}</div>
            <button onClick={() => setFout(null)} style={{ marginTop: 6, fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>Sluiten ×</button>
          </Kaart>
        )}
        {succesMelding && (
          <Kaart accent="#166534" style={{ marginBottom: 12 }}>
            <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>{succesMelding}</div>
          </Kaart>
        )}

        {/* ══ TAB 0: OCHTEND ══ */}
        {tab === 0 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Ochtendmeting</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Vul dit elke ochtend in voor betere coaching</div>

            <DagelijkseInvoer
              laastOpgeslagen={vandaagInvoer}
              onOpslaan={data => { setVandaagInvoer(data); laadDagelijkseData(); }}
            />

            {/* Herstelstatus op basis van vandaag */}
            {(vandaagInvoer?.hrv || vandaagInvoer?.rusthartslag) && (
              <HerstelStatusPanel
                dagelijkseData={dagelijkseData}
                tsb={huidigTsb}
                slaapScore={vandaagInvoer?.slaapScore}
              />
            )}

            {/* TSS weekvoortgang */}
            {voortgang?.ritten && (
              <TSSWeekPanel ritten={voortgang.ritten} schema={schema} />
            )}

            {/* HRV trend afgelopen 2 weken */}
            {dagelijkseData.filter(d => d.hrv).length > 2 && (
              <Kaart style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>HRV & rusthartslag trend</div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>HRV (ms) — basislijn {HRV_BASISLIJN} ms</div>
                  <MiniSpark punten={dagelijkseData.filter(d => d.hrv).map(d => ({ v: d.hrv }))} k="#a78bfa" />
                </div>
                {dagelijkseData.filter(d => d.rusthartslag).length > 2 && (
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Rusthartslag (bpm) — basislijn {HR_BASISLIJN} bpm</div>
                    <MiniSpark punten={dagelijkseData.filter(d => d.rusthartslag).map(d => ({ v: d.rusthartslag }))} k="#4ade80" />
                  </div>
                )}
              </Kaart>
            )}

            {!voortgang && (
              <button onClick={laadVoortgang}
                style={{ width: "100%", padding: 14, background: "#1e293b", border: "1px solid #374151", borderRadius: 12, color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                📊 Laad trainingsdata voor TSS-overzicht
              </button>
            )}
          </div>
        )}

        {/* ══ TAB 1: SCHEMA ══ */}
        {tab === 1 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Weekplanning</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Schema wordt gepushed naar Wahoo Bolt</div>

            {/* Herstelstatus samenvatting */}
            {vandaagInvoer && (
              <Kaart accent={berekenHerstelScore({ hrv: vandaagInvoer.hrv, hrvBasislijn: HRV_BASISLIJN, rusthartslag: vandaagInvoer.rusthartslag, rusthartslagBasislijn: HR_BASISLIJN, tsb: huidigTsb }).status.k + "40"} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>Herstelstatus</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: berekenHerstelScore({ hrv: vandaagInvoer.hrv, hrvBasislijn: HRV_BASISLIJN, rusthartslag: vandaagInvoer.rusthartslag, rusthartslagBasislijn: HR_BASISLIJN, tsb: huidigTsb }).status.k }}>
                    {berekenHerstelScore({ hrv: vandaagInvoer.hrv, hrvBasislijn: HRV_BASISLIJN, rusthartslag: vandaagInvoer.rusthartslag, rusthartslagBasislijn: HR_BASISLIJN, tsb: huidigTsb }).status.icon} {berekenHerstelScore({ hrv: vandaagInvoer.hrv, hrvBasislijn: HRV_BASISLIJN, rusthartslag: vandaagInvoer.rusthartslag, rusthartslagBasislijn: HR_BASISLIJN, tsb: huidigTsb }).status.label}
                  </div>
                </div>
              </Kaart>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {DAGEN.map(dag => {
                const aan = !!beschikbaar[dag];
                return (
                  <button key={dag} onClick={() => setBeschikbaar(p => ({ ...p, [dag]: !p[dag] }))}
                    style={{ padding: "12px 10px", background: aan ? "#1e3a5f" : "#0e1521", border: `1.5px solid ${aan ? "#3b82f6" : "#1e293b"}`, borderRadius: 10, color: aan ? "#93c5fd" : "#475569", fontSize: 14, fontWeight: aan ? 700 : 400, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ marginRight: 6 }}>{aan ? "✓" : "○"}</span>{dag}
                  </button>
                );
              })}
            </div>

            <Kaart style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Hoe voel je je?</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {GEVOEL_OPTIES.map(g => (
                  <button key={g.id} onClick={() => setGevoel(g.id)}
                    style={{ padding: "7px 12px", background: gevoel === g.id ? g.k+"25" : "transparent", border: `1.5px solid ${gevoel === g.id ? g.k : "#1e293b"}`, borderRadius: 8, color: gevoel === g.id ? g.k : "#475569", fontSize: 12, fontWeight: gevoel === g.id ? 700 : 400, cursor: "pointer" }}>
                    {g.label}
                  </button>
                ))}
              </div>
            </Kaart>

            <Kaart style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Bijzonderheden</div>
              <textarea value={bijzonder} onChange={e => setBijzonder(e.target.value)}
                placeholder="Bijv: donderdag borrel, CrossFit dinsdag en donderdag..."
                style={{ width: "100%", background: "#07111d", border: "1px solid #1e293b", borderRadius: 8, padding: 10, color: "#cbd5e1", fontSize: 13, minHeight: 60, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
            </Kaart>

            <button onClick={genereerSchema} disabled={laadtSchema}
              style={{ width: "100%", padding: 16, background: laadtSchema ? "#1e293b" : "linear-gradient(135deg,#1d4ed8,#2563eb)", border: "none", borderRadius: 12, color: laadtSchema ? "#475569" : "white", fontSize: 15, fontWeight: 800, cursor: laadtSchema ? "not-allowed" : "pointer", marginBottom: schema ? 16 : 0 }}>
              {laadtSchema ? "⏳ intervals.icu analyseren..." : "🤖 Genereer weekschema"}
            </button>

            {schema && (
              <div>
                {schema.analyse && (
                  <Kaart accent="#1e3a5f" style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: "#3b82f6", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>intervals.icu analyse</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                      {[
                        { l: "CTL", v: schema.analyse.ctl, k: "#60a5fa" },
                        { l: "ATL", v: schema.analyse.atl, k: "#f97316" },
                        { l: "TSB", v: schema.analyse.tsb > 0 ? `+${schema.analyse.tsb}` : schema.analyse.tsb, k: schema.analyse.tsb > 0 ? "#4ade80" : "#fbbf24" },
                      ].map((s, i) => (
                        <div key={i} style={{ background: "#07111d", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: "#64748b" }}>{s.l}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: s.k }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, color: "#93c5fd", lineHeight: 1.6, marginBottom: 8 }}>{schema.analyse.trend}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", background: "#07111d", borderRadius: 8, padding: 10 }}>{schema.analyse.aanbeveling}</div>
                  </Kaart>
                )}

                {schema.weekdoel && (
                  <div style={{ background: "#0a2540", border: "1px solid #1e40af", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Weekdoel</div>
                    <div style={{ fontSize: 13, color: "#bfdbfe", lineHeight: 1.5 }}>{schema.weekdoel}</div>
                  </div>
                )}

                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Jouw weekschema</div>
                {schema.schema?.map((dag, i) => {
                  const st = TYPE_STIJL[dag.type] || { k: "#475569", icon: "📅" };
                  const isRust = dag.type === "rust";
                  return (
                    <Kaart key={i} accent={st.k+"50"} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isRust ? 0 : 10 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2, fontWeight: 700, letterSpacing: 1 }}>{dag.dag.toUpperCase()}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: st.k }}>{st.icon} {dag.titel}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {dag.tss_doel && !isRust && <Chip k="#a78bfa" tekst={`~${dag.tss_doel} TSS`} klein />}
                          {dag.duur && !isRust && <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>{dag.duur}</span>}
                        </div>
                      </div>
                      {!isRust && (
                        <>
                          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                            {dag.vermogen && <Chip k="#f97316" tekst={`⚡ ${dag.vermogen}`} klein />}
                            {dag.hartslag && <Chip k="#ef4444" tekst={`❤️ ${dag.hartslag}`} klein />}
                          </div>
                          {dag.instructie && <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, background: "#07111d", borderRadius: 8, padding: "8px 10px" }}>{dag.instructie}</div>}
                        </>
                      )}
                    </Kaart>
                  );
                })}


                {schema.coaching_tip && (
                  <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 10, padding: 14, marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>💡 Coach tip</div>
                    <div style={{ fontSize: 13, color: "#bbf7d0", lineHeight: 1.6 }}>{schema.coaching_tip}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 2: VOORTGANG ══ */}
        {tab === 2 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Seizoensoverzicht</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Data van intervals.icu — vanaf januari 2026</div>

            {!voortgang && !laadtVoortgang && (
              <button onClick={laadVoortgang}
                style={{ width: "100%", padding: 16, background: "linear-gradient(135deg,#1d4ed8,#2563eb)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                📊 Laad data van intervals.icu
              </button>
            )}

            {laadtVoortgang && (
              <Kaart style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>intervals.icu data ophalen...</div>
              </Kaart>
            )}

            {voortgang && (
              <div>
                {/* CTL/ATL/TSB */}
                {wellenessHuidig && (() => {
                  const ctl = Math.round(wellenessHuidig.ctl || 0);
                  const atl = Math.round(wellenessHuidig.atl || 0);
                  const tsb = Math.round(ctl - atl);
                  const st = tsbStatus(tsb);
                  return (
                    <Kaart accent="#1e3a5f" style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, letterSpacing: 2, color: "#3b82f6", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Trainingsbelasting</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: st.k, marginBottom: 10 }}>{st.icon} {st.label} — {st.advies}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[{ l: "CTL", sub: "Fitheid", v: ctl, k: "#60a5fa" }, { l: "ATL", sub: "Vermoeidheid", v: atl, k: "#f97316" }, { l: "TSB", sub: "Vorm", v: tsb > 0 ? `+${tsb}` : tsb, k: st.k }].map((s, i) => (
                          <div key={i} style={{ background: "#07111d", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{s.sub}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: s.k }}>{s.v}</div>
                            <div style={{ fontSize: 10, color: s.k+"80", fontWeight: 700 }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </Kaart>
                  );
                })()}

                {/* Power Curve */}
                <PowerCurvePanel activiteiten={voortgang.ritten} ftp={265} />

                {/* Hartslagzonenverdeling */}
                <ZoneVerdelingPanel ritten={voortgang.ritten.filter(r => r.solo).slice(-8)} />

                {/* Seizoen stats */}
                {voortgang.seizoen_stats && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {[{ l: "Totaal km", v: voortgang.seizoen_stats.totaal_km, e: "km", k: "#60a5fa" }, { l: "Ritten", v: voortgang.seizoen_stats.totaal_ritten, e: "", k: "#a78bfa" }, { l: "Snelste solo", v: voortgang.seizoen_stats.snelste_solo, e: "km/u", k: "#4ade80" }].map((s, i) => (
                        <Kaart key={i} style={{ padding: 12, textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: s.k }}>{s.v}<span style={{ fontSize: 11, color: s.k+"aa" }}> {s.e}</span></div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>{s.l}</div>
                        </Kaart>
                      ))}
                    </div>

                    <Kaart accent="#1e3a5f" style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>Progressie seizoen</div>
                      {[
                        { l: "Gem. snelheid", vroeg: voortgang.seizoen_stats.gem_snelheid_vroeg, nu: voortgang.seizoen_stats.gem_snelheid_recent, e: "km/u", k: "#60a5fa", doel: 31 },
                        { l: "Efficiëntie (W/bpm)", vroeg: voortgang.seizoen_stats.gem_eff_vroeg, nu: voortgang.seizoen_stats.gem_eff_recent, e: "", k: "#4ade80", doel: 1.55 },
                      ].map((m, i) => {
                        const winst = m.vroeg > 0 ? ((m.nu - m.vroeg) / m.vroeg * 100).toFixed(0) : 0;
                        const pct = Math.min(100, Math.max(0, ((m.nu - m.vroeg) / (m.doel - m.vroeg)) * 100));
                        return (
                          <div key={i} style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "#94a3b8" }}>{m.l}</span>
                              {winst > 0 && <span style={{ color: "#4ade80", fontWeight: 700 }}>+{winst}% 🔥</span>}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 5 }}>
                              <span>Begin: {m.vroeg} {m.e}</span>
                              <span>Nu: <strong style={{ color: m.k }}>{m.nu} {m.e}</strong></span>
                              <span>Doel: {m.doel} {m.e}</span>
                            </div>
                            <div style={{ background: "#1e293b", borderRadius: 4, height: 7 }}>
                              <div style={{ width: `${pct}%`, background: `linear-gradient(90deg,${m.k}80,${m.k})`, height: 7, borderRadius: 4 }} />
                            </div>
                          </div>
                        );
                      })}
                    </Kaart>
                  </>
                )}

                {/* Sparklines */}
                {soloRitten.length > 2 && (
                  <Kaart style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Trends — solo ritten</div>
                    {[
                      { punten: soloRitten.map(r => ({ v: r.snelheid })), k: "#60a5fa", l: "Snelheid (km/u)" },
                      { punten: soloRitten.filter(r => r.wattage).map(r => ({ v: r.wattage })), k: "#f97316", l: "Wattage (W)" },
                      { punten: soloRitten.filter(r => r.eff).map(r => ({ v: r.eff })), k: "#4ade80", l: "Efficiëntie (W/bpm)" },
                      { punten: soloRitten.filter(r => r.tss).map(r => ({ v: r.tss })), k: "#a78bfa", l: "TSS per rit" },
                    ].map((g, i) => (
                      <div key={i} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{g.l}</div>
                        <MiniSpark punten={g.punten} k={g.k} />
                      </div>
                    ))}
                  </Kaart>
                )}

                {/* Rittenlijst */}
                <Kaart>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Alle solo ritten</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ color: "#64748b", borderBottom: "1px solid #1e293b" }}>
                          {["Datum","km","km/u","W","bpm","W/bpm","TSS","RPE"].map(h => (
                            <th key={h} style={{ padding: "4px 4px", textAlign: "right", fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...soloRitten].reverse().slice(0, 20).map((r, i) => {
                          const z = zoekZone(r.hartslag);
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid #0e1521" }}>
                              <td style={{ padding: "5px 4px", color: "#64748b" }}>{r.datum}</td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: "#e2e8f0" }}>{r.afstand || "—"}</td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: "#60a5fa", fontWeight: 700 }}>{r.snelheid}</td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: "#f97316" }}>{r.wattage || "—"}</td>
                              <td style={{ padding: "5px 4px", textAlign: "right" }}>{z ? <span style={{ color: z.k }}>{r.hartslag}</span> : "—"}</td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: "#4ade80", fontWeight: 700 }}>{r.eff || "—"}</td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: "#a78bfa" }}>{r.tss || "—"}</td>
                              <td style={{ padding: "5px 4px", textAlign: "right" }}>
                                {r.rpe ? <span style={{ color: r.rpe >= 8 ? "#ef4444" : r.rpe >= 6 ? "#fbbf24" : "#4ade80", fontWeight: 700 }}>{r.rpe}</span> : <span style={{ color: "#475569" }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Kaart>

                <button onClick={laadVoortgang}
                  style={{ width: "100%", marginTop: 12, padding: 12, background: "transparent", border: "1px solid #1e293b", borderRadius: 10, color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                  🔄 Vernieuwen
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 3: RPE ══ */}
        {tab === 3 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>RPE invullen</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Wordt opgeslagen in intervals.icu</div>

            {laadtRpe && <Kaart style={{ textAlign: "center", padding: 32 }}><div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div><div style={{ color: "#64748b", fontSize: 13 }}>Ritten ophalen...</div></Kaart>}

            {!laadtRpe && rpeRitten.length === 0 && (
              <button onClick={laadRpeRitten}
                style={{ width: "100%", padding: 16, background: "linear-gradient(135deg,#1d4ed8,#2563eb)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                🚴 Laad recente ritten
              </button>
            )}

            {rpeRitten.map((rit, i) => (
              <RpeKaart key={rit.id || i} rit={rit} opgeslagen={rpeOpgeslagen[rit.id]}
                onOpslaan={(rpe, g, o) => slaRpeOp(rit.id, rpe, g, o)}
                gevoelOpties={GEVOEL_OPTIES} />
            ))}

            {rpeRitten.length > 0 && (
              <button onClick={laadRpeRitten}
                style={{ width: "100%", marginTop: 8, padding: 12, background: "transparent", border: "1px solid #1e293b", borderRadius: 10, color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                🔄 Vernieuwen
              </button>
            )}
          </div>
        )}

        {/* ══ TAB 4: INSTELLINGEN ══ */}
        {tab === 4 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Instellingen</div>

            <Kaart style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>Koppelingen</div>
              {[
                { naam: "intervals.icu", status: "API key in Vercel", k: "#4ade80" },
                { naam: "Wahoo ELEMNT Bolt", status: "Via intervals.icu", k: "#4ade80" },
              ].map((k, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e293b", fontSize: 13 }}>
                  <span style={{ color: "#e2e8f0" }}>{k.naam}</span>
                  <span style={{ color: k.k, fontSize: 12 }}>{k.status}</span>
                </div>
              ))}
            </Kaart>

            <Kaart style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 10 }}>Profiel</div>
              {[
                { l: "FTP", v: "265W", k: "#f97316" },
                { l: "Lactaatdrempel", v: "184 bpm", k: "#ef4444" },
                { l: "Max hartslag", v: "200 bpm", k: "#ef4444" },
                { l: "Gewicht", v: "90 kg", k: "#fbbf24" },
                { l: "HRV basislijn", v: `${HRV_BASISLIJN} ms`, k: "#a78bfa" },
                { l: "HR rust basislijn", v: `${HR_BASISLIJN} bpm`, k: "#4ade80" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e293b", fontSize: 13 }}>
                  <span style={{ color: "#94a3b8" }}>{r.l}</span>
                  <span style={{ color: r.k, fontWeight: 700 }}>{r.v}</span>
                </div>
              ))}
            </Kaart>

            <Kaart>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 10 }}>⚙️ Vercel environment variables</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.8, background: "#07111d", borderRadius: 8, padding: 10 }}>
                <code style={{ color: "#4ade80", fontSize: 11 }}>
                  INTERVALS_API_KEY=jouw_key<br />
                  INTERVALS_ATHLETE_ID=i594622<br />
                  STRAVA_WEBHOOK_VERIFY_TOKEN=fietscoach2026
                </code>
              </div>
            </Kaart>
          </div>
        )}

      </div>
    </div>
  );
}

function RpeKaart({ rit, opgeslagen, onOpslaan, gevoelOpties }) {
  const [lokaalRpe, setLokaalRpe] = useState(opgeslagen?.rpe || 6);
  const [lokaalGevoel, setLokaalGevoel] = useState(opgeslagen?.gevoel || "goed");
  const [lokaalOpmerking, setLokaalOpmerking] = useState(opgeslagen?.opmerking || "");
  const [open, setOpen] = useState(!opgeslagen);
  const RPE_LABELS = ["","Heel licht","Licht","Matig licht","Matig","Matig zwaar","Zwaar","Zwaar+","Erg zwaar","Maximaal-","Maximaal"];
  const k = lokaalRpe <= 3 ? "#4ade80" : lokaalRpe <= 5 ? "#60a5fa" : lokaalRpe <= 7 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ background: "#0e1521", border: `1px solid ${opgeslagen ? "#166534" : "#1e293b"}`, borderRadius: 14, padding: 16, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen(p => !p)}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{rit.datum}</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{rit.naam}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{rit.afstand}km · {rit.snelheid}km/u{rit.wattage ? ` · ${rit.wattage}W` : ""}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {opgeslagen ? <div><div style={{ fontSize: 22, fontWeight: 800, color: opgeslagen.rpe >= 8 ? "#ef4444" : opgeslagen.rpe >= 6 ? "#fbbf24" : "#4ade80" }}>{opgeslagen.rpe}</div><div style={{ fontSize: 10, color: "#4ade80" }}>RPE ✓</div></div>
            : <div style={{ fontSize: 11, color: "#f97316", fontWeight: 700 }}>Invullen →</div>}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 14, borderTop: "1px solid #1e293b", paddingTop: 14 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>RPE</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: k }}>{lokaalRpe}/10 — {RPE_LABELS[lokaalRpe]}</span>
            </div>
            <input type="range" min={1} max={10} value={lokaalRpe} onChange={e => setLokaalRpe(Number(e.target.value))} style={{ width: "100%", accentColor: k, height: 6 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Gevoel</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {gevoelOpties.map(g => (
                <button key={g.id} onClick={() => setLokaalGevoel(g.id)}
                  style={{ padding: "5px 10px", background: lokaalGevoel === g.id ? g.k+"25" : "transparent", border: `1px solid ${lokaalGevoel === g.id ? g.k : "#1e293b"}`, borderRadius: 7, color: lokaalGevoel === g.id ? g.k : "#475569", fontSize: 11, cursor: "pointer" }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <textarea value={lokaalOpmerking} onChange={e => setLokaalOpmerking(e.target.value)}
            placeholder="Opmerkingen: wind, benen zwaar..."
            style={{ width: "100%", background: "#07111d", border: "1px solid #1e293b", borderRadius: 8, padding: 10, color: "#cbd5e1", fontSize: 12, minHeight: 50, resize: "none", boxSizing: "border-box", outline: "none", marginBottom: 10 }} />
          <button onClick={() => { onOpslaan(lokaalRpe, lokaalGevoel, lokaalOpmerking); setOpen(false); }}
            style={{ width: "100%", padding: 12, background: "#166534", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ✓ Opslaan in intervals.icu
          </button>
        </div>
      )}
    </div>
  );
}
