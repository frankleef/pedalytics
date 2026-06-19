"use client";
import { useState } from "react";
import { T, STATUS, getStatus } from "../designTokens";
import { berekenHerstelScore } from "./HerstelStatus";
import InfoTooltip from "./InfoTooltip";

export default function VoortgangTab({ profiel, wellness, wellenessHuidig, voortgang, seizoensplan }) {
  const [periode, setPeriode] = useState(8);

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

  function buildCtlChart() {
    if (weekPunten.length < 2) return null;
    const allVals = weekPunten.flatMap(p => [p.ctl, p.atl]);
    const mn = Math.min(...allVals) - 6;
    const mx = Math.max(...allVals) + 6;
    const xS = (i) => padL + (i / (weekPunten.length - 1)) * w;
    const yS = (v) => padT + h - ((v - mn) / (mx - mn)) * h;

    const ctlPath = weekPunten.map((p, i) => `${i === 0 ? "M" : "L"}${xS(i)},${yS(p.ctl)}`).join(" ");
    const atlPath = weekPunten.map((p, i) => `${i === 0 ? "M" : "L"}${xS(i)},${yS(p.atl)}`).join(" ");
    const bandPath = weekPunten.map((p, i) => `${i === 0 ? "M" : "L"}${xS(i)},${yS(p.ctl)}`).join(" ")
      + weekPunten.slice().reverse().map((p, i) => `L${xS(weekPunten.length - 1 - i)},${yS(p.atl)}`).join(" ") + "Z";

    const lastX = xS(weekPunten.length - 1);
    const lastCtlY = yS(weekPunten[weekPunten.length - 1].ctl);

    return (
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="ctlGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.64 0.14 248)" />
            <stop offset="100%" stopColor="oklch(0.79 0.14 168)" />
          </linearGradient>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.79 0.14 168)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="oklch(0.64 0.14 248)" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={padL} y1={padT + h * (1 - f)} x2={padL + w} y2={padT + h * (1 - f)} stroke="oklch(0.92 0.012 82)" strokeWidth="1" />
        ))}
        <path d={bandPath} fill="url(#bandGrad)" />
        <path d={atlPath} fill="none" stroke="oklch(0.58 0.02 75)" strokeWidth="2" strokeLinejoin="round" />
        <path d={ctlPath} fill="none" stroke="url(#ctlGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastCtlY} r="6" fill={T.cardBg} stroke="oklch(0.79 0.14 168)" strokeWidth="2.5" />
        {weekPunten.map((p, i) => (
          <text key={i} x={xS(i)} y={chartH - 4} textAnchor="middle" style={{ font: `${p.label === "nu" ? "800" : "600"} 10px var(--font-nunito), sans-serif`, fill: p.label === "nu" ? T.text : T.textTert }}>
            {p.label}
          </text>
        ))}
      </svg>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px` }}>

        {/* Header */}
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
                  TIJDEN.forEach(t => {
                    if (duurSec >= t.sec && r.wattage > (bests[t.sec] || 0)) {
                      bests[t.sec] = r.wattage;
                    }
                  });
                  if (r.max_watt) {
                    [5, 15, 30].forEach(sec => {
                      if (r.max_watt > (bests[sec] || 0)) bests[sec] = r.max_watt;
                    });
                  }
                });
                return TIJDEN.map(t => ({ ...t, watt: bests[t.sec] || 0 }));
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
      </div>
    </div>
  );
}
