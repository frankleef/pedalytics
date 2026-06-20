"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import InfoTooltip from "./InfoTooltip";
import SharedHeader from "./SharedHeader";
import { classificeerRit, ritMatchesSessie } from "@/lib/rittype";
import { ResponsiveContainer, ComposedChart, LineChart, BarChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";

const CARD = { background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 };
const EYEBROW = { font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" };
const TICK = { fontSize: 9, fontFamily: "var(--font-nunito), sans-serif", fill: T.textTert };

function ChartTooltipContent({ active, payload, label, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.slate, borderRadius: 10, padding: "6px 12px", font: "700 12px var(--font-nunito), sans-serif", color: "#fff" }}>
      <div style={{ marginBottom: 2, opacity: 0.7 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || "#fff" }}>{p.name}: {p.value}{suffix}</div>)}
    </div>
  );
}

export default function VoortgangTab({ profiel, wellness, wellenessHuidig, voortgang, seizoensplan, onOpenProfiel, weekSessies }) {
  const [periode, setPeriode] = useState(8);
  const [ftpHistorie, setFtpHistorie] = useState([]);
  const [powerCurves, setPowerCurves] = useState(null);

  useEffect(() => {
    fetch("/api/ftp-historie").then(r => r.json()).then(d => { if (d.success && d.data) setFtpHistorie(d.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    const dagPeriode = periode * 7;
    const cur = `${dagPeriode}d`;
    const prev = `${dagPeriode * 2}d`;
    fetch(`/api/intervals/power-curves?periode=${cur}&vorige=${prev}`)
      .then(r => r.json()).then(d => { if (d.success) setPowerCurves(d); }).catch(() => {});
  }, [periode]);

  const ftp = profiel?.ftp || 265;
  const gewicht = profiel?.gewicht || 87;
  const wkg = (ftp / gewicht).toFixed(1);
  const grens = new Date(Date.now() - periode * 7 * 86400000);
  const vorigeGrens = new Date(grens - periode * 7 * 86400000);

  const wellnessData = (wellness || []).slice(-periode * 7);
  const dagPunten = wellnessData.filter(d => d.ctl != null && d.atl != null).map(d => ({
    datum: (() => { const s = d.id?.split("T")[0] || ""; const [,m,dd] = s.split("-"); return m && dd ? `${dd}/${m}` : s; })(),
    ctl: Math.round(d.ctl), atl: Math.round(d.atl), tsb: Math.round((d.ctl || 0) - (d.atl || 0)),
  }));

  const huidigCtl = wellenessHuidig ? Math.round(wellenessHuidig.ctl || 0) : null;
  const eersteCtl = dagPunten.length > 0 ? dagPunten[0].ctl : null;
  const ctlDelta = huidigCtl != null && eersteCtl != null ? huidigCtl - eersteCtl : null;

  const pcHuidig = powerCurves?.huidig || [];
  const pcVorig = powerCurves?.vorig || [];
  const pcData = pcHuidig.map((p, i) => ({ label: p.label, nu: p.watt || null, vorig: pcVorig[i]?.watt || null })).filter(d => d.nu || d.vorig);

  const highlights = [
    { sec: 5, titel: "Sprint", fallback: 15 },
    { sec: 60, titel: "Kort", fallback: 180 },
    { sec: 300, titel: "Duur", fallback: 600 },
  ].map(h => {
    const punt = pcHuidig.find(p => p.sec === h.sec && p.watt > 0) || pcHuidig.find(p => p.sec === h.fallback && p.watt > 0);
    return punt ? { ...punt, titel: h.titel } : { titel: h.titel, label: "", watt: 0 };
  });

  const hrvPunten = wellnessData.filter(d => d.hrv).map(d => ({ datum: (() => { const s = d.id?.split("T")[0] || ""; const [,m,dd] = s.split("-"); return m && dd ? `${dd}/${m}` : s; })(), hrv: d.hrv }));
  const hrvBasislijn = profiel?.hrv_basislijn || (hrvPunten.length > 0 ? Math.round(hrvPunten.reduce((s, p) => s + p.hrv, 0) / hrvPunten.length) : 58);

  // Polarisatie
  const polWekenMap = {};
  (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grens).forEach(r => {
    const zt = r.zoneTijden;
    if (!zt || !Array.isArray(zt) || zt.length === 0) return;
    const d = new Date(r.datum_iso); const ma = new Date(d); ma.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk = ma.toISOString().split("T")[0];
    if (!polWekenMap[wk]) polWekenMap[wk] = { z12secs: 0, z35secs: 0 };
    zt.forEach(z => {
      if (z.id === "Z1" || z.id === "Z2") polWekenMap[wk].z12secs += z.secs || 0;
      else polWekenMap[wk].z35secs += z.secs || 0;
    });
  });
  const polWeken = Object.entries(polWekenMap).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([w, d]) => {
    const [,m,dd] = w.split("-");
    const totaal = d.z12secs + d.z35secs;
    return { week: `${dd}/${m}`, z2: totaal > 0 ? Math.round((d.z12secs / totaal) * 100) : 0, z35: totaal > 0 ? Math.round((d.z35secs / totaal) * 100) : 0 };
  });
  const polGem = polWeken.length > 0 ? Math.round(polWeken.reduce((s, w) => s + w.z2, 0) / polWeken.length) : 0;

  // Plan-naleving
  const planWekenMap = {};
  const startDatum = seizoensplan?.startdatum;
  const planSessies = (weekSessies?.sessies || []).filter(s => s.datum && new Date(s.datum) >= grens && !s.voltooid && (!startDatum || s.datum >= startDatum));
  const planRitten = (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grens);
  planSessies.forEach(s => {
    const d = new Date(s.datum); const ma = new Date(d); ma.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk = ma.toISOString().split("T")[0];
    if (!planWekenMap[wk]) planWekenMap[wk] = { matched: 0, deviated: 0, missed: 0, totaal: 0 };
    const rit = planRitten.find(r => r.datum_iso === s.datum);
    if (rit) { const cls = classificeerRit(rit, ftp); ritMatchesSessie(cls, s.type) ? planWekenMap[wk].matched++ : planWekenMap[wk].deviated++; }
    else if (new Date(s.datum) < new Date()) planWekenMap[wk].missed++;
    planWekenMap[wk].totaal++;
  });
  const planWeken = Object.entries(planWekenMap).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([w, d]) => ({ week: (() => { const [,m,d] = w.split("-"); return `${d}/${m}`; })(), ...d, pct: d.totaal > 0 ? Math.round((d.matched / d.totaal) * 100) : 0 }));
  const planGem = planWeken.length > 0 ? Math.round(planWeken.reduce((s, w) => s + w.pct, 0) / planWeken.length) : 0;

  // Seizoensdoel-perspectief
  const kader = seizoensplan?.kader || [];
  const seizoenWeken = seizoensplan?.tijdshorizon_weken || kader.length || 12;
  const seizoenStart = seizoensplan?.startdatum ? new Date(seizoensplan.startdatum) : null;
  const wekenVerstreken = seizoenStart ? Math.max(0, Math.floor((Date.now() - seizoenStart.getTime()) / (7 * 86400000))) : 0;
  const wekenOver = Math.max(0, seizoenWeken - wekenVerstreken);
  const totaalTssDoel = kader.reduce((s, w) => s + (w.tss_doel || 0), 0);
  const totaalTssWerkelijk = (voortgang?.ritten || []).filter(r => r.datum_iso && seizoenStart && new Date(r.datum_iso) >= seizoenStart).reduce((s, r) => s + (r.tss || 0), 0);
  const tssPct = totaalTssDoel > 0 ? Math.min(100, Math.round((totaalTssWerkelijk / totaalTssDoel) * 100)) : 0;

  // Weekuren-trend
  const weekUrenMap = {};
  (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grens && r.duur_min).forEach(r => {
    const d = new Date(r.datum_iso); const ma = new Date(d); ma.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk = ma.toISOString().split("T")[0];
    weekUrenMap[wk] = (weekUrenMap[wk] || 0) + r.duur_min;
  });
  const weekUren = Object.entries(weekUrenMap).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([w, min]) => {
    const [,m,dd] = w.split("-"); return { week: `${dd}/${m}`, uren: +(min / 60).toFixed(1) };
  });

  // Trainingsconsistentie: dagen per week getraind
  const consWekenMap = {};
  (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grens).forEach(r => {
    const d = new Date(r.datum_iso); const ma = new Date(d); ma.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk = ma.toISOString().split("T")[0];
    if (!consWekenMap[wk]) consWekenMap[wk] = new Set();
    consWekenMap[wk].add(r.datum_iso);
  });
  const consWeken = Object.entries(consWekenMap).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([w, dagen]) => {
    const [,m,dd] = w.split("-"); return { week: `${dd}/${m}`, dagen: dagen.size };
  });
  const consGem = consWeken.length > 0 ? +(consWeken.reduce((s, w) => s + w.dagen, 0) / consWeken.length).toFixed(1) : 0;

  // RHR-trend
  const rhrPunten = wellnessData.filter(d => d.restingHR).map(d => ({ datum: (() => { const s = d.id?.split("T")[0] || ""; const [,m,dd] = s.split("-"); return m && dd ? `${dd}/${m}` : s; })(), rhr: Math.round(d.restingHR) }));
  const rhrBasislijn = profiel?.hr_basislijn ? Math.round(profiel.hr_basislijn) : (rhrPunten.length > 0 ? Math.round(rhrPunten.reduce((s, p) => s + p.rhr, 0) / rhrPunten.length) : 49);

  // Slaap-trend
  const slaapPunten = wellnessData.filter(d => d.sleepScore).map(d => ({ datum: (() => { const s = d.id?.split("T")[0] || ""; const [,m,dd] = s.split("-"); return m && dd ? `${dd}/${m}` : s; })(), score: d.sleepScore }));

  // PR feed — uit echte power curve data
  const prs = [{ sec: 5, label: "5s sprint" }, { sec: 60, label: "1 min" }, { sec: 300, label: "5 min" }, { sec: 1200, label: "20 min" }]
    .map(d => {
      const nu = pcHuidig.find(p => p.sec === d.sec)?.watt || 0;
      const was = pcVorig.find(p => p.sec === d.sec)?.watt || 0;
      if (!nu) return null;
      const delta = was > 0 ? nu - was : null;
      return { ...d, watt: nu, delta, isPR: delta != null && delta > 0 };
    }).filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px` }}>
        <SharedHeader onAvatarClick={onOpenProfiel} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <span style={EYEBROW}>Jouw ontwikkeling</span>
            <h1 style={{ margin: "4px 0 0", font: "800 24px var(--font-nunito), sans-serif", color: T.text }}>Voortgang</h1>
          </div>
          <button onClick={() => setPeriode(p => p === 8 ? 6 : p === 6 ? 12 : 8)}
            style={{ padding: "7px 14px", borderRadius: T.pillRadius, background: T.cardBg, border: `1px solid ${T.cardBorder}`, font: "700 13px var(--font-nunito), sans-serif", color: T.textSec, cursor: "pointer" }}>
            {periode} weken ▾
          </button>
        </div>

        {/* Hero: CTL/ATL/TSB */}
        {dagPunten.length >= 3 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <span style={EYEBROW}>Fitheid & vermoeidheid</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                  {huidigCtl != null && <span style={{ font: "600 38px var(--font-fredoka), sans-serif", color: T.text }}>{huidigCtl}</span>}
                  {ctlDelta != null && <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: ctlDelta >= 0 ? "#2F9468" : "#9C5848" }}>CTL {ctlDelta >= 0 ? "+" : ""}{ctlDelta} / {periode}wk</span>}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <ComposedChart data={dagPunten} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
                <XAxis dataKey="datum" tick={TICK} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(dagPunten.length / 6))} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area dataKey="ctl" stroke="none" fill="oklch(0.79 0.14 168)" fillOpacity={0.15} />
                <Line dataKey="ctl" stroke="oklch(0.64 0.14 248)" strokeWidth={5} dot={false} name="CTL" />
                <Line dataKey="atl" stroke="oklch(0.58 0.02 75)" strokeWidth={2} dot={false} name="ATL" />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 18, height: 5, borderRadius: 3, background: "oklch(0.64 0.14 248)" }} /><span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>CTL</span><InfoTooltip metricKey="ctl" /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 18, height: 2, background: "oklch(0.58 0.02 75)" }} /><span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>ATL</span><InfoTooltip metricKey="atl" /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "oklch(0.79 0.14 168)", opacity: 0.3 }} /><span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>Vorm</span><InfoTooltip metricKey="vorm" /></div>
            </div>
          </div>
        )}

        {/* FTP card */}
        <div style={{ ...CARD, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 22px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={EYEBROW}>Huidige FTP</span><InfoTooltip metricKey="ftp" /></div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <span style={{ font: "600 56px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{ftp}</span>
              <span style={{ font: "600 20px var(--font-fredoka), sans-serif", color: T.textSec }}>W</span>
            </div>
          </div>
          <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.textSec }}>{wkg} W/kg</span>
        </div>

        {/* Power curve */}
        {pcData.length >= 2 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div><span style={EYEBROW}>Power curve</span><div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>{periode * 7} dagen</div></div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={pcData} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
                <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltipContent suffix="W" />} />
                <Line dataKey="vorig" stroke="oklch(0.58 0.02 75)" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Vorig" connectNulls />
                <Line dataKey="nu" stroke="oklch(0.64 0.14 248)" strokeWidth={4} dot={false} name="Nu" connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {highlights.map((p, i) => (
                <div key={i} style={{ flex: 1, background: T.subtleFill, borderRadius: 14, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ font: "600 22px var(--font-fredoka), sans-serif", color: p.watt > 0 ? T.text : T.textTert }}>{p.watt > 0 ? <>{p.watt}<span style={{ font: "600 12px var(--font-fredoka), sans-serif", color: T.textSec }}>w</span></> : "—"}</div>
                  <div style={{ font: "600 11px var(--font-nunito), sans-serif", color: T.textSec }}>{p.titel}{p.label ? ` · ${p.label}` : ""}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HRV trend */}
        {hrvPunten.length >= 5 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={EYEBROW}>HRV trend</span>
              <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>basislijn {hrvBasislijn}ms</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={hrvPunten} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
                <XAxis dataKey="datum" tick={TICK} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(hrvPunten.length / 6))} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltipContent suffix="ms" />} />
                <ReferenceLine y={hrvBasislijn} stroke="oklch(0.64 0.14 248)" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Line dataKey="hrv" stroke="oklch(0.64 0.12 280)" strokeWidth={2.5} dot={false} name="HRV" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Polarisatie */}
        {polWeken.length >= 2 && (
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={EYEBROW}>Polarisatie</span>
                <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>80% rustig, 20% pittig</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: T.subtleFill }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: polGem >= 75 ? "oklch(0.6 0.13 165)" : "oklch(0.72 0.13 70)" }} />
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{polGem >= 75 ? "Op koers" : "Let op"}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={polWeken.length * 21 + 10}>
              <BarChart data={polWeken} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }} barSize={12}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="week" tick={TICK} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<ChartTooltipContent suffix="%" />} />
                <ReferenceLine x={80} stroke="oklch(0.45 0.02 70)" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: "80%", position: "top", style: { font: "800 9px var(--font-nunito), sans-serif", fill: "oklch(0.45 0.02 70)" } }} />
                <Bar dataKey="z2" stackId="pol" name="Z1–Z2" fill="oklch(0.8 0.07 232)" radius={[6, 0, 0, 6]} />
                <Bar dataKey="z35" stackId="pol" name="Z3–Z5" fill="oklch(0.74 0.13 52)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 14, height: 10, borderRadius: 3, background: "oklch(0.8 0.07 232)" }} />
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.42 0.02 72)" }}>Z1–Z2 · rustig</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 14, height: 10, borderRadius: 3, background: "oklch(0.74 0.13 52)" }} />
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.42 0.02 72)" }}>Z3–Z5 · pittig</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 14, height: 0, borderTop: "2px dashed oklch(0.45 0.02 70)" }} />
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.42 0.02 72)" }}>doel 80%</span>
              </div>
            </div>
          </div>
        )}

        {/* Plan-naleving */}
        {planWeken.length >= 2 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={EYEBROW}>Plan-naleving</span>
              <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: planGem >= 70 ? "oklch(0.5 0.13 162)" : "oklch(0.55 0.11 92)" }}>gem. {planGem}%</span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={planWeken} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="week" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={TICK} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltipContent suffix="%" />} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]} name="Naleving" barSize={20}>
                  {planWeken.map((w, i) => <Cell key={i} fill={w.matched > 0 ? "oklch(0.6 0.13 165)" : w.deviated > 0 ? "oklch(0.72 0.13 70)" : "oklch(0.72 0.015 75)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {[{ label: "Gematcht", color: "oklch(0.6 0.13 165)" }, { label: "Afgeweken", color: "oklch(0.72 0.13 70)" }, { label: "Gemist", color: "oklch(0.72 0.015 75)" }].map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} /><span style={{ font: "600 10px var(--font-nunito), sans-serif", color: T.textSec }}>{l.label}</span></div>
              ))}
            </div>
          </div>
        )}

        {/* PR feed */}
        {prs.length > 0 && (
          <div style={CARD}>
            <span style={{ ...EYEBROW, display: "block", marginBottom: 14 }}>Best efforts</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {prs.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: p.isPR ? "oklch(0.93 0.05 70)" : T.subtleFill, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 16 }}>{p.isPR ? "⭐" : "⚡"}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text }}>{p.label}</div>
                    <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>{p.isPR ? "Nieuw PR" : `Beste ${periode} wk`}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ font: "600 20px var(--font-fredoka), sans-serif", color: T.text }}>{p.watt}<span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>w</span></span>
                    {p.delta != null && (
                      <span style={{ padding: "3px 8px", borderRadius: 999, font: "800 11px var(--font-nunito), sans-serif",
                        background: p.delta > 0 ? "oklch(0.93 0.05 162)" : p.delta < 0 ? "oklch(0.95 0.03 35)" : T.subtleFill,
                        color: p.delta > 0 ? "oklch(0.4 0.13 162)" : p.delta < 0 ? "oklch(0.5 0.12 35)" : T.textSec,
                      }}>{p.delta > 0 ? "+" : ""}{p.delta}W</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seizoensdoel-perspectief */}
        {seizoenStart && kader.length > 0 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div><span style={EYEBROW}>Seizoensdoel</span><div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 3 }}>{seizoensplan?.doel_label || "FTP verhogen"}</div></div>
              <span style={{ font: "600 15px var(--font-fredoka), sans-serif", color: T.text }}>{wekenOver} <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>wk over</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>TSS-voortgang</span>
              <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}><span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: T.text }}>{Math.round(totaalTssWerkelijk)}</span> / {Math.round(totaalTssDoel)}</span>
            </div>
            <div style={{ height: 8, borderRadius: T.pillRadius, background: "oklch(0.93 0.012 84)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${tssPct}%`, borderRadius: T.pillRadius, background: T.gradient }} />
            </div>
            <div style={{ font: "600 11px var(--font-nunito), sans-serif", color: T.textTert, marginTop: 6, textAlign: "right" }}>{tssPct}% voltooid · week {wekenVerstreken} van {seizoenWeken}</div>
          </div>
        )}

        {/* Weekuren-trend */}
        {weekUren.length >= 2 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={EYEBROW}>Trainingsuren per week</span>
              <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>gem. {weekUren.length > 0 ? (weekUren.reduce((s, w) => s + w.uren, 0) / weekUren.length).toFixed(1) : 0}u</span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={weekUren} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="week" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltipContent suffix="u" />} />
                <Bar dataKey="uren" name="Uren" radius={[4, 4, 0, 0]} fill="oklch(0.70 0.12 240)" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Trainingsconsistentie */}
        {consWeken.length >= 2 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={EYEBROW}>Consistentie</span>
              <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>gem. {consGem} dagen/wk</span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={consWeken} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="week" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0, 7]} />
                <Tooltip content={<ChartTooltipContent suffix=" dagen" />} />
                <Bar dataKey="dagen" name="Dagen" radius={[4, 4, 0, 0]} barSize={20}>
                  {consWeken.map((w, i) => <Cell key={i} fill={w.dagen >= 3 ? "oklch(0.6 0.13 165)" : w.dagen >= 2 ? "oklch(0.72 0.13 70)" : "oklch(0.72 0.015 75)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* RHR-trend */}
        {rhrPunten.length >= 5 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={EYEBROW}>Rusthartslag trend</span>
              <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>basislijn {rhrBasislijn} bpm</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={rhrPunten} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
                <XAxis dataKey="datum" tick={TICK} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(rhrPunten.length / 6))} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltipContent suffix=" bpm" />} />
                <ReferenceLine y={rhrBasislijn} stroke="oklch(0.55 0.12 35)" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Line dataKey="rhr" stroke="oklch(0.55 0.12 35)" strokeWidth={2.5} dot={false} name="RHR" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Slaap-trend */}
        {slaapPunten.length >= 5 && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={EYEBROW}>Slaapscore trend</span>
              <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>gem. {Math.round(slaapPunten.reduce((s, p) => s + p.score, 0) / slaapPunten.length)}</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={slaapPunten} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
                <XAxis dataKey="datum" tick={TICK} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(slaapPunten.length / 6))} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={70} stroke="oklch(0.64 0.14 248)" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "Goed", position: "right", style: { font: "600 8px var(--font-nunito), sans-serif", fill: T.textTert } }} />
                <Line dataKey="score" stroke="oklch(0.64 0.12 280)" strokeWidth={2.5} dot={false} name="Slaap" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </div>
  );
}
