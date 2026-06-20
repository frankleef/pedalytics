"use client";
import { useState, useEffect } from "react";
import { T, STATUS, getStatus } from "../designTokens";
import { berekenHerstelScore } from "./HerstelStatus";
import InfoTooltip from "./InfoTooltip";
import SharedHeader from "./SharedHeader";
import { classificeerRit, ritMatchesSessie } from "@/lib/rittype";

function HrvChart({ hrvPunten, basislijn, gH, gW, gPadT, drawH, mn, mx, xI, yH, lijn, gridWaarden, labelInterval }) {
  const [hover, setHover] = useState(null);

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>HRV trend</span>
        <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>basislijn {basislijn}ms</span>
      </div>
      <div style={{ position: "relative" }}>
        <svg width="100%" viewBox={`0 0 ${gW} ${gH}`} style={{ display: "block" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * gW;
            const idx = Math.round((x / gW) * (hrvPunten.length - 1));
            if (idx >= 0 && idx < hrvPunten.length) setHover(idx);
          }}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.touches[0].clientX - rect.left) / rect.width) * gW;
            const idx = Math.round((x / gW) * (hrvPunten.length - 1));
            if (idx >= 0 && idx < hrvPunten.length) setHover(idx);
          }}
          onTouchEnd={() => setHover(null)}>
          {gridWaarden.map((v, i) => (
            <g key={i}>
              <line x1="0" y1={yH(v)} x2={gW} y2={yH(v)} stroke="oklch(0.93 0.012 82)" strokeWidth="0.8" />
              <text x={gW - 2} y={yH(v) - 4} textAnchor="end" fill={T.textTert} style={{ font: "600 8px var(--font-nunito), sans-serif" }}>{v}</text>
            </g>
          ))}
          <line x1="0" y1={yH(basislijn)} x2={gW} y2={yH(basislijn)} stroke="oklch(0.64 0.14 248)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
          <path d={lijn} fill="none" stroke="oklch(0.64 0.12 280)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {hover != null && (
            <>
              <circle cx={xI(hover)} cy={yH(hrvPunten[hover].hrv)} r="5" fill="oklch(0.64 0.12 280)" stroke={T.cardBg} strokeWidth="2" />
              <line x1={xI(hover)} y1={gPadT} x2={xI(hover)} y2={gH - 22} stroke="oklch(0.64 0.12 280)" strokeWidth="1" opacity="0.3" />
            </>
          )}
          {hrvPunten.map((p, i) => {
            if (i !== 0 && i !== hrvPunten.length - 1 && i % labelInterval !== 0) return null;
            const d = p.datum.slice(5).replace("-", "/");
            return <text key={i} x={xI(i)} y={gH - 6} textAnchor="middle" fill={T.textTert} style={{ font: "600 8px var(--font-nunito), sans-serif" }}>{d}</text>;
          })}
        </svg>
        {hover != null && (
          <div style={{
            position: "absolute", left: `${(xI(hover) / gW) * 100}%`, top: `${(yH(hrvPunten[hover].hrv) / gH) * 100 - 12}%`,
            transform: "translate(-50%, -100%)", background: T.slate, color: "#fff", borderRadius: 10, padding: "5px 10px",
            font: "700 12px var(--font-nunito), sans-serif", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5,
          }}>
            {hrvPunten[hover].hrv}ms · {hrvPunten[hover].datum.slice(5).replace("-", "/")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VoortgangTab({ profiel, wellness, wellenessHuidig, voortgang, seizoensplan, onOpenProfiel, weekSessies }) {
  const [periode, setPeriode] = useState(8);
  const [ftpHistorie, setFtpHistorie] = useState([]);

  useEffect(() => {
    fetch("/api/ftp-historie").then(r => r.json()).then(d => {
      if (d.success && d.data) setFtpHistorie(d.data);
    }).catch(() => {});
  }, []);

  const ftp = profiel?.ftp || 265;
  const gewicht = profiel?.gewicht || 87;
  const wkg = (ftp / gewicht).toFixed(1);

  // CTL/ATL/TSB data over gekozen periode
  const weken = periode;
  const wellnessData = (wellness || []).slice(-weken * 7);
  const weekPunten = [];
  for (let w = 0; w < weken; w++) {
    const start = w * 7;
    const eind = Math.min(start + 7, wellnessData.length);
    const weekSlice = wellnessData.slice(start, eind);
    if (weekSlice.length === 0) continue;
    const laatste = weekSlice[weekSlice.length - 1];
    weekPunten.push({
      week: `w${w + 1}`,
      label: w === weken - 1 ? "nu" : `w${w + 1}`,
      ctl: Math.round(laatste.ctl || 0),
      atl: Math.round(laatste.atl || 0),
    });
  }

  const huidigCtl = wellenessHuidig ? Math.round(wellenessHuidig.ctl || 0) : null;
  const eersteCtl = weekPunten.length > 0 ? weekPunten[0].ctl : null;
  const ctlDelta = huidigCtl != null && eersteCtl != null ? huidigCtl - eersteCtl : null;

  // Power curve data
  const soloRitten = voortgang?.ritten?.filter(r => r.solo && r.wattage) || [];

  // SVG chart helpers
  const chartW = 346, chartH = 140, padL = 0, padR = 0, padT = 10, padB = 24;
  const w = chartW - padL - padR;
  const h = chartH - padT - padB;

  const dagPunten = wellnessData.filter(d => d.ctl != null && d.atl != null).map(d => ({
    datum: d.id?.split("T")[0] || "",
    ctl: Math.round(d.ctl),
    atl: Math.round(d.atl),
  }));

  function buildCtlChart() {
    if (dagPunten.length < 3) return null;
    const allVals = dagPunten.flatMap(p => [p.ctl, p.atl]);
    const mn = Math.min(...allVals) - 4;
    const mx = Math.max(...allVals) + 4;
    const xS = (i) => padL + (i / (dagPunten.length - 1)) * w;
    const yS = (v) => padT + h - ((v - mn) / (mx - mn)) * h;

    const ctlPath = dagPunten.map((p, i) => `${i === 0 ? "M" : "L"}${xS(i).toFixed(1)},${yS(p.ctl).toFixed(1)}`).join(" ");
    const atlPath = dagPunten.map((p, i) => `${i === 0 ? "M" : "L"}${xS(i).toFixed(1)},${yS(p.atl).toFixed(1)}`).join(" ");
    const bandPath = dagPunten.map((p, i) => `${i === 0 ? "M" : "L"}${xS(i).toFixed(1)},${yS(p.ctl).toFixed(1)}`).join(" ")
      + dagPunten.slice().reverse().map((p, i) => `L${xS(dagPunten.length - 1 - i).toFixed(1)},${yS(p.atl).toFixed(1)}`).join(" ") + "Z";

    const lastX = xS(dagPunten.length - 1);
    const lastCtlY = yS(dagPunten[dagPunten.length - 1].ctl);

    const labelInterval = Math.max(1, Math.floor(dagPunten.length / 6));
    const labels = dagPunten.filter((_, i) => i === 0 || i === dagPunten.length - 1 || i % labelInterval === 0);

    return (
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="ctlGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.64 0.14 248)" />
            <stop offset="100%" stopColor="oklch(0.79 0.14 168)" />
          </linearGradient>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.79 0.14 168)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="oklch(0.64 0.14 248)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={padL} y1={padT + h * (1 - f)} x2={padL + w} y2={padT + h * (1 - f)} stroke="oklch(0.93 0.012 82)" strokeWidth="0.8" />
        ))}
        <path d={bandPath} fill="url(#bandGrad)" />
        <path d={atlPath} fill="none" stroke="oklch(0.58 0.02 75)" strokeWidth="2" strokeLinejoin="round" />
        <path d={ctlPath} fill="none" stroke="url(#ctlGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastCtlY} r="6" fill={T.cardBg} stroke="oklch(0.79 0.14 168)" strokeWidth="2.5" />
        {labels.map((p) => {
          const i = dagPunten.indexOf(p);
          const d = p.datum.slice(5).replace("-", "/");
          return <text key={i} x={xS(i)} y={chartH - 4} textAnchor="middle" style={{ font: "600 9px var(--font-nunito), sans-serif", fill: T.textTert }}>{d}</text>;
        })}
      </svg>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px` }}>

        <SharedHeader onAvatarClick={onOpenProfiel} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert, textTransform: "uppercase" }}>Jouw ontwikkeling</span>
            <h1 style={{ margin: "4px 0 0", font: "800 24px var(--font-nunito), sans-serif", color: T.text }}>Voortgang</h1>
          </div>
          <button onClick={() => setPeriode(p => p === 8 ? 6 : p === 6 ? 12 : 8)}
            style={{ padding: "7px 14px", borderRadius: T.pillRadius, background: T.cardBg, border: `1px solid ${T.cardBorder}`, font: "700 13px var(--font-nunito), sans-serif", color: T.textSec, cursor: "pointer" }}>
            {periode} weken ▾
          </button>
        </div>

        {/* CTL/ATL/TSB hero chart */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Fitheid & vermoeidheid</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                {huidigCtl != null && <span style={{ font: "600 38px var(--font-fredoka), sans-serif", color: T.text }}>{huidigCtl}</span>}
                {ctlDelta != null && (
                  <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: ctlDelta >= 0 ? "#2F9468" : "#9C5848" }}>
                    CTL {ctlDelta >= 0 ? "↑" : "↓"} {ctlDelta >= 0 ? "+" : ""}{ctlDelta} / {periode}wk
                  </span>
                )}
              </div>
            </div>
            {ctlDelta != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: T.pillRadius, background: T.subtleFill }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ctlDelta >= 0 ? "#3FA877" : "#A55842" }} />
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{ctlDelta >= 0 ? "Opbouwend" : "Dalend"}</span>
              </div>
            )}
          </div>

          {buildCtlChart()}

          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 18, height: 5, borderRadius: 3, background: T.gradient }} />
              <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>CTL</span>
              <InfoTooltip metricKey="ctl" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 18, height: 2, background: "oklch(0.58 0.02 75)" }} />
              <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>ATL</span>
              <InfoTooltip metricKey="atl" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: "oklch(0.79 0.14 168)", opacity: 0.3 }} />
              <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>Vorm</span>
              <InfoTooltip metricKey="vorm" />
            </div>
          </div>
        </div>

        {/* FTP card */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Huidige FTP</span>
              <InfoTooltip metricKey="ftp" />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <span style={{ font: "600 56px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{ftp}</span>
              <span style={{ font: "600 20px var(--font-fredoka), sans-serif", color: T.textSec }}>W</span>
            </div>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.textSec }}>{wkg} W/kg</span>
          </div>
        </div>

        {/* Power curve */}
        {soloRitten.length > 2 && (
          <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div>
                <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Power curve</span>
                <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>Beste vermogen per duur · {periode * 7} dagen</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 14, height: 4, borderRadius: 2, background: T.gradient }} />
                  <span style={{ font: "600 10px var(--font-nunito), sans-serif", color: T.textTert }}>Nu</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 14, height: 2, borderTop: "2px dashed oklch(0.58 0.02 75)" }} />
                  <span style={{ font: "600 10px var(--font-nunito), sans-serif", color: T.textTert }}>Vorig</span>
                </div>
              </div>
            </div>

            {/* Power curve SVG — logaritmische x-as */}
            {(() => {
              const TIJDEN = [
                { sec: 5, label: "5s" }, { sec: 15, label: "15s" }, { sec: 30, label: "30s" }, { sec: 60, label: "1m" },
                { sec: 180, label: "3m" }, { sec: 300, label: "5m" }, { sec: 600, label: "10m" },
                { sec: 1200, label: "20m" }, { sec: 3600, label: "60m" },
              ];
              const nu = new Date();
              const grens = new Date(nu - periode * 7 * 86400000);
              const vorigeGrens = new Date(grens - periode * 7 * 86400000);

              const bouwCurve = (ritten) => {
                const bests = {};
                TIJDEN.forEach(t => { bests[t.sec] = 0; });
                ritten.forEach(r => {
                  if (!r.wattage || !r.duur_min) return;
                  const duurSec = r.duur_min * 60;
                  const np = r.np || r.wattage;
                  const maxW = r.max_watt || Math.round(np * 1.3);

                  TIJDEN.forEach(t => {
                    if (duurSec < t.sec) return;
                    let geschat;
                    if (t.sec <= 15) geschat = maxW;
                    else if (t.sec <= 30) geschat = Math.round(maxW * 0.90);
                    else if (t.sec <= 60) geschat = Math.round(maxW * 0.80);
                    else if (t.sec <= 180) geschat = Math.round(maxW * 0.68);
                    else geschat = np;
                    if (geschat > (bests[t.sec] || 0)) bests[t.sec] = geschat;
                  });
                });
                const result = TIJDEN.map(t => ({ ...t, watt: bests[t.sec] || 0 }));
                for (let i = 1; i < result.length; i++) {
                  if (result[i].watt > 0 && result[i - 1].watt > 0 && result[i].watt > result[i - 1].watt) {
                    result[i].watt = result[i - 1].watt;
                  }
                }
                return result;
              };

              const huidigeRitten = soloRitten.filter(r => new Date(r.datum_iso) >= grens);
              const vorigeRitten = soloRitten.filter(r => { const d = new Date(r.datum_iso); return d >= vorigeGrens && d < grens; });
              const huidig = bouwCurve(huidigeRitten);
              const vorig = bouwCurve(vorigeRitten);
              const huidigMetData = huidig.filter(p => p.watt > 0);

              if (huidigMetData.length < 2) return <div style={{ padding: 20, textAlign: "center", color: T.textTert, font: "600 13px var(--font-nunito), sans-serif" }}>Onvoldoende data</div>;

              const pcH = 140, pcW = 346, labelH = 18, chartH = pcH - labelH;
              const allW = [...huidigMetData.map(p => p.watt), ...vorig.filter(p => p.watt > 0).map(p => p.watt)];
              const mnW = Math.min(...allW) * 0.85;
              const mxW = Math.max(...allW) * 1.05;
              const logMin = Math.log(TIJDEN[0].sec);
              const logMax = Math.log(TIJDEN[TIJDEN.length - 1].sec);
              const xLog = (sec) => ((Math.log(sec) - logMin) / (logMax - logMin)) * pcW;
              const yS = (v) => chartH - ((v - mnW) / (mxW - mnW)) * (chartH - 10);

              const hPath = huidigMetData.map((p, i) => `${i === 0 ? "M" : "L"}${xLog(p.sec).toFixed(1)},${yS(p.watt).toFixed(1)}`).join(" ");
              const hArea = hPath + `L${xLog(huidigMetData[huidigMetData.length - 1].sec).toFixed(1)},${chartH}L${xLog(huidigMetData[0].sec).toFixed(1)},${chartH}Z`;
              const vorigMetData = vorig.filter(p => p.watt > 0);
              const vPath = vorigMetData.length >= 2 ? vorigMetData.map((p, i) => `${i === 0 ? "M" : "L"}${xLog(p.sec).toFixed(1)},${yS(p.watt).toFixed(1)}`).join(" ") : null;

              const highlights = [
                { sec: 5, titel: "Sprint", fallback: 15 },
                { sec: 60, titel: "Kort", fallback: 180 },
                { sec: 300, titel: "Duur", fallback: 600 },
              ].map(h => {
                const punt = huidig.find(p => p.sec === h.sec && p.watt > 0) || huidig.find(p => p.sec === h.fallback && p.watt > 0);
                return punt ? { ...punt, titel: h.titel } : { titel: h.titel, label: h.sec <= 60 ? `${h.sec}s` : `${h.sec / 60}m`, watt: 0 };
              });

              return (
                <>
                  <svg width="100%" viewBox={`0 0 ${pcW} ${pcH}`} style={{ display: "block", marginTop: 10, overflow: "visible" }}>
                    <defs>
                      <linearGradient id="pcGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="oklch(0.64 0.14 248)" />
                        <stop offset="100%" stopColor="oklch(0.79 0.14 168)" />
                      </linearGradient>
                      <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.79 0.14 168)" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="oklch(0.64 0.14 248)" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    {vPath && <path d={vPath} fill="none" stroke="oklch(0.58 0.02 75)" strokeWidth="2" strokeDasharray="4 4" />}
                    <path d={hArea} fill="url(#pcFill)" />
                    <path d={hPath} fill="none" stroke="url(#pcGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    {TIJDEN.map((t, i) => {
                      const heeftData = huidig.find(p => p.sec === t.sec)?.watt > 0;
                      return (
                        <text key={i} x={xLog(t.sec)} y={pcH - 2} textAnchor="middle" fill={heeftData ? T.textSec : T.textTert} style={{ font: `600 ${heeftData ? 9 : 8}px var(--font-nunito), sans-serif` }}>
                          {t.label}
                        </text>
                      );
                    })}
                  </svg>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {highlights.map((p, i) => (
                      <div key={i} style={{ flex: 1, background: T.subtleFill, borderRadius: 14, padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ font: "600 22px var(--font-fredoka), sans-serif", color: p.watt > 0 ? T.text : T.textTert }}>
                          {p.watt > 0 ? <>{p.watt}<span style={{ font: "600 12px var(--font-fredoka), sans-serif", color: T.textSec }}>w</span></> : "—"}
                        </div>
                        <div style={{ font: "600 11px var(--font-nunito), sans-serif", color: T.textSec }}>{p.titel} · {p.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* FTP-progressie */}
        {ftpHistorie.length >= 2 && (() => {
          const grens = new Date(Date.now() - periode * 7 * 86400000);
          const punten = ftpHistorie.filter(h => new Date(h.datum) >= grens);
          if (punten.length < 2) return null;

          const doelFtp = seizoensplan?.streefwaarde ? (() => {
            const m = seizoensplan.streefwaarde.match(/(\d+)\s*[-–]\s*(\d+)\s*W/i);
            return m ? Math.max(Number(m[1]), Number(m[2])) : null;
          })() : null;
          const startFtp = punten[0].ftp;

          const gH = 100, gW = 346;
          const allFtp = punten.map(p => p.ftp);
          if (doelFtp) allFtp.push(doelFtp);
          const mn = Math.min(...allFtp) - 5;
          const mx = Math.max(...allFtp) + 5;
          const tMin = new Date(punten[0].datum).getTime();
          const tMax = new Date(punten[punten.length - 1].datum).getTime() || tMin + 1;
          const xT = (d) => ((new Date(d).getTime() - tMin) / (tMax - tMin)) * gW;
          const yF = (v) => gH - 12 - ((v - mn) / (mx - mn)) * (gH - 22);

          const lijn = punten.map((p, i) => `${i === 0 ? "M" : "L"}${xT(p.datum).toFixed(1)},${yF(p.ftp).toFixed(1)}`).join(" ");

          return (
            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>FTP progressie</span>
                  <InfoTooltip metricKey="ftp" />
                </div>
                <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: punten[punten.length - 1].ftp >= startFtp ? "#2F9468" : "#9C5848" }}>
                  {punten[punten.length - 1].ftp >= startFtp ? "+" : ""}{punten[punten.length - 1].ftp - startFtp}W
                </span>
              </div>
              <svg width="100%" viewBox={`0 0 ${gW} ${gH}`} style={{ display: "block" }}>
                <defs>
                  <linearGradient id="ftpGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="oklch(0.64 0.14 248)" />
                    <stop offset="100%" stopColor="oklch(0.79 0.14 168)" />
                  </linearGradient>
                </defs>
                {doelFtp && <line x1="0" y1={yF(doelFtp)} x2={gW} y2={yF(doelFtp)} stroke="oklch(0.6 0.13 165)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />}
                <path d={lijn} fill="none" stroke="url(#ftpGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                {punten.map((p, i) => <circle key={i} cx={xT(p.datum)} cy={yF(p.ftp)} r="4" fill="oklch(0.64 0.14 248)" />)}
                {doelFtp && <text x={gW - 2} y={yF(doelFtp) - 6} textAnchor="end" fill="oklch(0.6 0.13 165)" style={{ font: "600 9px var(--font-nunito), sans-serif" }}>Doel {doelFtp}W</text>}
              </svg>
            </div>
          );
        })()}

        {/* HRV-baseline-trend */}
        {wellnessData.length > 7 && (() => {
          const hrvPunten = wellnessData.filter(d => d.hrv).map(d => ({ datum: d.id?.split("T")[0] || d.datum, hrv: d.hrv }));
          if (hrvPunten.length < 5) return null;

          const gH = 110, gW = 346, gPadB = 22, gPadT = 8;
          const drawH = gH - gPadB - gPadT;
          const allH = hrvPunten.map(p => p.hrv);
          const mn = Math.min(...allH) - 5;
          const mx = Math.max(...allH) + 5;
          const basislijn = profiel?.hrv_basislijn || Math.round(allH.reduce((s, v) => s + v, 0) / allH.length);
          const xI = (i) => (i / (hrvPunten.length - 1)) * gW;
          const yH = (v) => gPadT + drawH - ((v - mn) / (mx - mn)) * drawH;

          const lijn = hrvPunten.map((p, i) => `${i === 0 ? "M" : "L"}${xI(i).toFixed(1)},${yH(p.hrv).toFixed(1)}`).join(" ");

          const gridWaarden = [mn, mn + (mx - mn) * 0.33, mn + (mx - mn) * 0.66, mx].map(Math.round);
          const labelInterval = Math.max(1, Math.floor(hrvPunten.length / 6));

          return (
            <HrvChart hrvPunten={hrvPunten} basislijn={basislijn} gH={gH} gW={gW} gPadT={gPadT} drawH={drawH} mn={mn} mx={mx} xI={xI} yH={yH} lijn={lijn} gridWaarden={gridWaarden} labelInterval={labelInterval} />
          );
        })()}

        {/* Polarisatie-naleving */}
        {(() => {
          const grens = new Date(Date.now() - periode * 7 * 86400000);
          const relevanteRitten = (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grens && r.wattage);
          if (relevanteRitten.length < 3) return null;

          const wekenMap = {};
          relevanteRitten.forEach(r => {
            const d = new Date(r.datum_iso);
            const maandag = new Date(d); maandag.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            const weekKey = maandag.toISOString().split("T")[0];
            if (!wekenMap[weekKey]) wekenMap[weekKey] = [];
            wekenMap[weekKey].push(r);
          });

          const weken = Object.entries(wekenMap).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([week, ritten]) => {
            const z2Count = ritten.filter(r => {
              const ifVal = r.np ? r.np / ftp : r.wattage / ftp;
              return ifVal <= 0.76;
            }).length;
            const totaal = ritten.length;
            const pct = totaal > 0 ? Math.round((z2Count / totaal) * 100) : 0;
            return { week: week.slice(5).replace("-", "/"), pct, z2: z2Count, totaal };
          });

          if (weken.length < 2) return null;
          const gemPct = Math.round(weken.reduce((s, w) => s + w.pct, 0) / weken.length);

          return (
            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Polarisatie</span>
                <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: gemPct >= 75 ? "oklch(0.5 0.13 162)" : "oklch(0.55 0.11 92)" }}>gem. {gemPct}% Z1-Z2</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {weken.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ font: "600 9px var(--font-nunito), sans-serif", color: T.textTert, width: 34, textAlign: "right" }}>{w.week}</span>
                    <div style={{ flex: 1, height: 14, borderRadius: 7, background: "oklch(0.94 0.02 75)", position: "relative", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${w.pct}%`, borderRadius: 7, background: "oklch(0.70 0.12 240)" }} />
                      <div style={{ position: "absolute", left: "80%", top: 0, bottom: 0, width: 1.5, background: "oklch(0.5 0.02 74)", opacity: 0.5 }} />
                    </div>
                    <span style={{ font: "600 10px var(--font-nunito), sans-serif", color: T.textSec, width: 28 }}>{w.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Plan-naleving-trend */}
        {(() => {
          const grens = new Date(Date.now() - periode * 7 * 86400000);
          const sessies = weekSessies?.sessies || [];
          const ritten = (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grens);
          if (sessies.length < 2 && ritten.length < 2) return null;

          const wekenMap = {};
          const startDatum = seizoensplan?.startdatum;

          sessies.filter(s => s.datum && new Date(s.datum) >= grens && !s.voltooid).forEach(s => {
            const d = new Date(s.datum);
            const maandag = new Date(d); maandag.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            const weekKey = maandag.toISOString().split("T")[0];
            if (!wekenMap[weekKey]) wekenMap[weekKey] = { matched: 0, deviated: 0, missed: 0, totaal: 0 };
            const rit = ritten.find(r => r.datum_iso === s.datum);
            if (rit) {
              const cls = classificeerRit(rit, ftp);
              if (ritMatchesSessie(cls, s.type)) wekenMap[weekKey].matched++;
              else wekenMap[weekKey].deviated++;
            } else if (new Date(s.datum) < new Date()) {
              wekenMap[weekKey].missed++;
            }
            wekenMap[weekKey].totaal++;
          });

          const weken = Object.entries(wekenMap).sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([week, d]) => ({
            week: week.slice(5).replace("-", "/"),
            ...d,
            pct: d.totaal > 0 ? Math.round((d.matched / d.totaal) * 100) : 0,
          }));

          if (weken.length < 2) return null;
          const gemPct = Math.round(weken.reduce((s, w) => s + w.pct, 0) / weken.length);
          const maxH = 60;

          return (
            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Plan-naleving</span>
                <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: gemPct >= 70 ? "oklch(0.5 0.13 162)" : "oklch(0.55 0.11 92)" }}>gem. {gemPct}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: maxH + 20 }}>
                {weken.map((w, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: maxH }}>
                      {w.totaal > 0 && (
                        <div style={{ width: "100%", borderRadius: "5px 5px 2px 2px", overflow: "hidden", height: Math.max(4, (w.pct / 100) * maxH) }}>
                          <div style={{ height: "100%", background: w.matched > 0 ? "oklch(0.6 0.13 165)" : w.deviated > 0 ? "oklch(0.72 0.13 70)" : "oklch(0.72 0.015 75)" }} />
                        </div>
                      )}
                    </div>
                    <span style={{ font: "600 8px var(--font-nunito), sans-serif", color: T.textTert }}>{w.week}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                {[
                  { label: "Gematcht", color: "oklch(0.6 0.13 165)" },
                  { label: "Afgeweken", color: "oklch(0.72 0.13 70)" },
                  { label: "Gemist", color: "oklch(0.72 0.015 75)" },
                ].map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                    <span style={{ font: "600 10px var(--font-nunito), sans-serif", color: T.textSec }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* PR/mijlpaal-feed */}
        {(() => {
          const grens = new Date(Date.now() - periode * 7 * 86400000);
          const vorigeGrens = new Date(grens - periode * 7 * 86400000);
          const huidigeRitten = soloRitten.filter(r => new Date(r.datum_iso) >= grens);
          const vorigeRitten = soloRitten.filter(r => { const d = new Date(r.datum_iso); return d >= vorigeGrens && d < grens; });

          const DUREN = [
            { sec: 5, label: "5s sprint" }, { sec: 60, label: "1 min" },
            { sec: 300, label: "5 min" }, { sec: 1200, label: "20 min" },
          ];

          const bestPerDuur = (ritten) => {
            const bests = {};
            ritten.forEach(r => {
              if (!r.wattage || !r.duur_min) return;
              const maxW = r.max_watt || Math.round((r.np || r.wattage) * 1.3);
              const np = r.np || r.wattage;
              DUREN.forEach(d => {
                if (r.duur_min * 60 < d.sec) return;
                let geschat;
                if (d.sec <= 15) geschat = maxW;
                else if (d.sec <= 60) geschat = Math.round(maxW * 0.80);
                else geschat = np;
                if (geschat > (bests[d.sec] || 0)) bests[d.sec] = geschat;
              });
            });
            return bests;
          };

          const huidig = bestPerDuur(huidigeRitten);
          const vorig = bestPerDuur(vorigeRitten);

          const prs = DUREN.map(d => {
            const nu = huidig[d.sec] || 0;
            const was = vorig[d.sec] || 0;
            if (!nu) return null;
            const delta = was > 0 ? nu - was : null;
            return { ...d, watt: nu, delta, isPR: delta != null && delta > 0 };
          }).filter(Boolean);

          if (prs.length === 0) return null;

          return (
            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
              <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase", display: "block", marginBottom: 14 }}>Best efforts</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {prs.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: p.isPR ? "oklch(0.93 0.05 70)" : T.subtleFill, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 16 }}>{p.isPR ? "⭐" : "⚡"}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text }}>{p.label}</div>
                      <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>
                        {p.isPR ? `Nieuw PR deze periode` : `Beste ${periode} weken`}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ font: "600 20px var(--font-fredoka), sans-serif", color: T.text }}>{p.watt}<span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>w</span></span>
                      {p.delta != null && (
                        <span style={{ padding: "3px 8px", borderRadius: 999, font: "800 11px var(--font-nunito), sans-serif",
                          background: p.delta > 0 ? "oklch(0.93 0.05 162)" : p.delta < 0 ? "oklch(0.95 0.03 35)" : T.subtleFill,
                          color: p.delta > 0 ? "oklch(0.4 0.13 162)" : p.delta < 0 ? "oklch(0.5 0.12 35)" : T.textSec,
                        }}>
                          {p.delta > 0 ? "+" : ""}{p.delta}W
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
