"use client";
import { T } from "../designTokens";
import { ResponsiveContainer, LineChart, Line } from "recharts";

function MiniGrafiek({ label, data, dataKey, kleur, waarde, eenheid, status, statusKleur }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ font: "800 10px var(--font-nunito), sans-serif", letterSpacing: 1, color: T.textTert, textTransform: "uppercase" }}>{label}</span>
      <div style={{ height: 48 }}>
        {data.length >= 2 ? (
          <ResponsiveContainer width="100%" height={48}>
            <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line type="monotone" dataKey={dataKey} stroke={kleur} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 48, borderBottom: "1px dashed oklch(0.85 0.01 75)" }} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ font: "600 18px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{waarde}</span>
        <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>{eenheid}</span>
      </div>
      <span style={{ font: "600 11px var(--font-nunito), sans-serif", color: statusKleur }}>{status}</span>
    </div>
  );
}

export default function HerstelSignalenKaart({ dagelijkseData, decouplingPunten }) {
  const GROEN = "oklch(0.5 0.13 162)";
  const AMBER = "oklch(0.72 0.13 70)";
  const STABIEL = "oklch(0.5 0.02 74)";

  const recent14 = (dagelijkseData || []).slice(-14);

  // HRV
  const hrvData = recent14.filter(d => d.hrv).map((d, i) => ({ i, v: d.hrv }));
  const hrvWaarden = recent14.filter(d => d.hrv).map(d => d.hrv);
  const hrv7d = hrvWaarden.length >= 7 ? Math.round(hrvWaarden.slice(-7).reduce((a, b) => a + b, 0) / 7) : null;
  const hrv28d = hrvWaarden.length > 0 ? Math.round(hrvWaarden.reduce((a, b) => a + b, 0) / hrvWaarden.length) : null;
  const hrvPctDelta = hrv7d && hrv28d ? Math.round(((hrv7d - hrv28d) / hrv28d) * 100) : null;
  const hrvStatus = hrvPctDelta == null ? "–" : hrvPctDelta >= -5 ? "Stabiel" : hrvPctDelta >= -10 ? "Let op ↓" : "Gedaald ↓";
  const hrvKleur = hrvPctDelta == null ? STABIEL : hrvPctDelta >= -5 ? GROEN : AMBER;

  // RHR
  const rhrData = recent14.filter(d => d.restingHR).map((d, i) => ({ i, v: Math.round(d.restingHR) }));
  const rhrWaarden = recent14.filter(d => d.restingHR).map(d => d.restingHR);
  const rhrLaatste = rhrWaarden.length > 0 ? Math.round(rhrWaarden[rhrWaarden.length - 1]) : null;
  const rhr7d = rhrWaarden.length >= 7 ? rhrWaarden.slice(-7).reduce((a, b) => a + b, 0) / 7 : null;
  const rhr28d = rhrWaarden.length > 0 ? rhrWaarden.reduce((a, b) => a + b, 0) / rhrWaarden.length : null;
  const rhrDelta = rhr7d && rhr28d ? Math.round(rhr7d - rhr28d) : null;
  const rhrStatus = rhrDelta == null ? "–" : rhrDelta <= 2 ? "Stabiel" : rhrDelta <= 5 ? "Licht verhoogd" : "Verhoogd ↑";
  const rhrKleur = rhrDelta == null ? STABIEL : rhrDelta <= 2 ? GROEN : AMBER;

  // Decoupling
  const dcData = (decouplingPunten || []).slice(-6).map((d, i) => ({ i, v: d.decoupling }));
  const dcWaarden = (decouplingPunten || []).slice(-3).map(d => d.decoupling);
  const dcMediaan = dcWaarden.length >= 3 ? (() => { const s = [...dcWaarden].sort((a, b) => a - b); return s[1]; })() : null;
  const dcStatus = dcMediaan == null ? "–" : dcMediaan <= 5 ? "Goed" : dcMediaan <= 7 ? "Matig" : "Aandacht ↑";
  const dcKleur = dcMediaan == null ? STABIEL : dcMediaan <= 5 ? GROEN : AMBER;

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "18px 16px 16px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
      <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase", display: "block", marginBottom: 14 }}>Herstel & signalen</span>
      <div style={{ display: "flex", gap: 12 }}>
        <MiniGrafiek label="HRV" data={hrvData} dataKey="v" kleur="oklch(0.64 0.14 248)" waarde={hrv7d ?? "–"} eenheid="ms" status={hrvStatus} statusKleur={hrvKleur} />
        <MiniGrafiek label="Rustpols" data={rhrData} dataKey="v" kleur="oklch(0.58 0.02 75)" waarde={rhrLaatste ?? "–"} eenheid="bpm" status={rhrStatus} statusKleur={rhrKleur} />
        <MiniGrafiek label="Decoupling" data={dcData} dataKey="v" kleur="oklch(0.6 0.13 165)" waarde={dcMediaan != null ? dcMediaan.toFixed(1) : "–"} eenheid="%" status={dcStatus} statusKleur={dcKleur} />
      </div>
    </div>
  );
}
