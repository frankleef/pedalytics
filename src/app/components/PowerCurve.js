"use client";
import { useState } from "react";

const TIJDEN = [
  { sec: 5, label: "5s" },
  { sec: 15, label: "15s" },
  { sec: 30, label: "30s" },
  { sec: 60, label: "1m" },
  { sec: 120, label: "2m" },
  { sec: 300, label: "5m" },
  { sec: 480, label: "8m" },
  { sec: 600, label: "10m" },
  { sec: 1200, label: "20m" },
  { sec: 2400, label: "40m" },
  { sec: 3600, label: "1u" },
];

// Rider types op basis van power curve profiel
function bepaalRiderType(curve) {
  if (!curve || curve.length < 4) return null;
  const sprint = curve.find(p => p.sec === 5)?.watt;
  const minuut = curve.find(p => p.sec === 60)?.watt;
  const vijfMin = curve.find(p => p.sec === 300)?.watt;
  const twintigMin = curve.find(p => p.sec === 1200)?.watt;
  if (!sprint || !vijfMin || !twintigMin) return null;
  const sprintRatio = sprint / vijfMin;
  const enduranceRatio = vijfMin / twintigMin;
  if (sprintRatio > 3.5) return { type: "Sprinter", icon: "⚡", k: "#f97316", beschrijving: "Explosief vermogen, uitblinker in korte inspanningen" };
  if (enduranceRatio < 1.15) return { type: "Klimmer/TT", icon: "🏔️", k: "#60a5fa", beschrijving: "Sterk duurvermogen, ideaal voor lange inspanningen" };
  if (sprintRatio > 2.8) return { type: "Puncheur", icon: "💪", k: "#a78bfa", beschrijving: "Combinatie van sprint en duurvermogen" };
  return { type: "All-rounder", icon: "🚴", k: "#4ade80", beschrijving: "Gebalanceerd profiel over alle tijdsduren" };
}

function PowerCurveGrafiek({ huidig, vergelijk }) {
  if (!huidig || huidig.length < 2) return null;

  const W = 300, H = 100;
  const pad = { t: 8, b: 22, l: 32, r: 12 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;

  const maxW = Math.max(...huidig.map(p => p.watt), ...(vergelijk || []).map(p => p.watt || 0)) * 1.05;
  const minW = Math.min(...huidig.map(p => p.watt)) * 0.85;

  // Log schaal voor tijdas
  const minSec = Math.log(huidig[0].sec);
  const maxSec = Math.log(huidig[huidig.length - 1].sec);

  const xS = sec => pad.l + ((Math.log(sec) - minSec) / (maxSec - minSec)) * w;
  const yS = watt => pad.t + h - ((watt - minW) / (maxW - minW)) * h;

  const lijn = (data, k, dikte = 2) =>
    <polyline fill="none" stroke={k} strokeWidth={dikte}
      points={data.map(p => `${xS(p.sec)},${yS(p.watt)}`).join(" ")} />;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {/* Y-as labels */}
      {[minW, (minW + maxW) / 2, maxW].map((v, i) => (
        <text key={i} x={pad.l - 4} y={yS(v) + 3} fontSize="8" fill="#475569" textAnchor="end">
          {Math.round(v)}
        </text>
      ))}
      {/* FTP lijn */}
      {(() => {
        const ftpY = yS(265);
        return ftpY > pad.t && ftpY < pad.t + h ? (
          <g>
            <line x1={pad.l} y1={ftpY} x2={W - pad.r} y2={ftpY}
              stroke="#f97316" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
            <text x={W - pad.r + 2} y={ftpY + 3} fontSize="7" fill="#f97316">FTP</text>
          </g>
        ) : null;
      })()}
      {/* Vergelijkingscurve */}
      {vergelijk && vergelijk.length > 1 && lijn(vergelijk, "#1e3a5f", 1.5)}
      {/* Huidige curve */}
      {lijn(huidig, "#60a5fa")}
      {/* Eindpunt */}
      <circle cx={xS(huidig[huidig.length - 1].sec)} cy={yS(huidig[huidig.length - 1].watt)} r="3" fill="#60a5fa" />
      {/* X-as labels */}
      {["5s","1m","5m","20m","1u"].map((l, i) => {
        const secMap = { "5s": 5, "1m": 60, "5m": 300, "20m": 1200, "1u": 3600 };
        const x = xS(secMap[l]);
        return x > pad.l && x < W - pad.r ? (
          <text key={i} x={x} y={H} fontSize="8" fill="#475569" textAnchor="middle">{l}</text>
        ) : null;
      })}
    </svg>
  );
}

export default function PowerCurvePanel({ activiteiten, ftp = 265 }) {
  const [periode, setPeriode] = useState("42d");

  // Bereken power curve uit best efforts van activiteiten
  const bouwCurve = (ritten) => {
    const bests = {};
    TIJDEN.forEach(t => { bests[t.sec] = 0; });

    ritten.forEach(rit => {
      if (!rit.best_efforts) return;
      rit.best_efforts.forEach(e => {
        const match = TIJDEN.find(t => Math.abs(t.sec - e.duur) < t.sec * 0.1);
        if (match && e.watt > (bests[match.sec] || 0)) {
          bests[match.sec] = e.watt;
        }
      });
      // Gebruik ook gemiddeld wattage als schatting
      if (rit.wattage && rit.duur_min) {
        const duurSec = rit.duur_min * 60;
        const dichtste = TIJDEN.reduce((prev, curr) =>
          Math.abs(curr.sec - duurSec) < Math.abs(prev.sec - duurSec) ? curr : prev
        );
        if (rit.wattage > (bests[dichtste.sec] || 0)) {
          bests[dichtste.sec] = rit.wattage;
        }
      }
    });

    return TIJDEN
      .filter(t => bests[t.sec] > 0)
      .map(t => ({ sec: t.sec, label: t.label, watt: bests[t.sec] }));
  };

  const nu = new Date();
  const periodeFilter = {
    "42d": new Date(nu - 42 * 86400000),
    "90d": new Date(nu - 90 * 86400000),
    "365d": new Date(nu - 365 * 86400000),
  };

  const huidigeRitten = activiteiten.filter(r =>
    r.wattage && new Date(r.datum_iso) >= periodeFilter[periode]
  );
  const vergelijkRitten = activiteiten.filter(r =>
    r.wattage && new Date(r.datum_iso) < periodeFilter[periode]
  );

  const huidigeCurve = bouwCurve(huidigeRitten);
  const vergelijkCurve = bouwCurve(vergelijkRitten);
  const riderType = bepaalRiderType(huidigeCurve);

  // W/kg berekenen
  const wkg = (watt) => (watt / 90).toFixed(2);

  return (
    <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>
            Power Curve
          </div>
          {riderType && (
            <div style={{ fontSize: 14, fontWeight: 700, color: riderType.k }}>
              {riderType.icon} {riderType.type}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["42d","6w"],["90d","3m"],["365d","1j"]].map(([v, l]) => (
            <button key={v} onClick={() => setPeriode(v)}
              style={{ padding: "4px 8px", background: periode === v ? "#1e3a5f" : "transparent",
                border: `1px solid ${periode === v ? "#3b82f6" : "#1e293b"}`,
                borderRadius: 6, color: periode === v ? "#60a5fa" : "#475569",
                fontSize: 11, cursor: "pointer" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {riderType && (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>{riderType.beschrijving}</div>
      )}

      {huidigeCurve.length > 1 ? (
        <>
          <PowerCurveGrafiek huidig={huidigeCurve} vergelijk={vergelijkCurve.length > 1 ? vergelijkCurve : null} />

          {vergelijkCurve.length > 1 && (
            <div style={{ display: "flex", gap: 12, marginTop: 6, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 16, height: 2, background: "#60a5fa" }} />
                <span style={{ fontSize: 10, color: "#64748b" }}>Huidig</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 16, height: 2, background: "#1e3a5f" }} />
                <span style={{ fontSize: 10, color: "#64748b" }}>Vorige periode</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 16, height: 2, background: "#f97316", borderTop: "1px dashed" }} />
                <span style={{ fontSize: 10, color: "#64748b" }}>FTP</span>
              </div>
            </div>
          )}

          {/* Tabel met beste vermogen per tijdsduur */}
          <div style={{ marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ color: "#64748b", borderBottom: "1px solid #1e293b" }}>
                  {["Duur","Best (W)","W/kg","% FTP","vs vorig"].map(h => (
                    <th key={h} style={{ padding: "4px", textAlign: "right", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {huidigeCurve.map((p, i) => {
                  const vergelijkPunt = vergelijkCurve.find(v => v.sec === p.sec);
                  const verschil = vergelijkPunt ? p.watt - vergelijkPunt.watt : null;
                  const pctFtp = Math.round((p.watt / ftp) * 100);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #0e1521" }}>
                      <td style={{ padding: "5px 4px", color: "#94a3b8", fontWeight: 600 }}>{p.label}</td>
                      <td style={{ padding: "5px 4px", textAlign: "right", color: "#60a5fa", fontWeight: 700 }}>{p.watt}</td>
                      <td style={{ padding: "5px 4px", textAlign: "right", color: "#94a3b8" }}>{wkg(p.watt)}</td>
                      <td style={{ padding: "5px 4px", textAlign: "right", color: pctFtp >= 100 ? "#f97316" : pctFtp >= 90 ? "#fbbf24" : "#94a3b8" }}>
                        {pctFtp}%
                      </td>
                      <td style={{ padding: "5px 4px", textAlign: "right" }}>
                        {verschil !== null ? (
                          <span style={{ color: verschil > 0 ? "#4ade80" : verschil < 0 ? "#ef4444" : "#475569", fontWeight: 600 }}>
                            {verschil > 0 ? "+" : ""}{verschil}W
                          </span>
                        ) : <span style={{ color: "#475569" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: "#64748b", padding: 16, textAlign: "center" }}>
          Niet genoeg vermogensdata voor power curve in deze periode.
        </div>
      )}
    </div>
  );
}
