"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import { ADAPTATIE_CONFIG, DOMINANT_LABEL } from "@/lib/adaptatie";

export default function AdaptatieScoreKaart({ weekTss, doelTss }) {
  const [adaptatieScore, setAdaptatieScore] = useState(null);
  const [uitklap, setUitklap] = useState(false);

  useEffect(() => {
    fetch("/api/plan/adaptatie-score").then(r => r.json()).then(d => {
      if (d.success && d.data) setAdaptatieScore(d.data);
    }).catch(() => {});
  }, []);

  const tssPct = doelTss > 0 ? Math.min(100, Math.round((weekTss / doelTss) * 100)) : 0;

  if (!adaptatieScore) {
    return (
      <div style={{ background: T.cardBg, borderRadius: 24, padding: "15px 17px 16px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
          <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>TSS afgelopen 7 dagen</span>
          <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>
            <span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: T.text }}>{weekTss}</span> / {doelTss}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: T.pillRadius, background: "oklch(0.93 0.012 84)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${tssPct}%`, borderRadius: T.pillRadius, background: T.gradient }} />
        </div>
      </div>
    );
  }

  const cfg = ADAPTATIE_CONFIG[adaptatieScore.status] || ADAPTATIE_CONFIG.optimaal;
  const dominantTekst = DOMINANT_LABEL[adaptatieScore.dominant] || null;

  return (
    <div style={{ background: T.cardBg, borderRadius: 24, padding: "15px 17px 16px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Adaptatie</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: T.pillRadius, background: T.subtleFill }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.kleur }} />
          <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{cfg.label}</span>
        </div>
      </div>
      <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 10 }}>{cfg.subtekst}</div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textTert }}>TSS 7d</span>
        <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>
          <span style={{ font: "600 17px var(--font-fredoka), sans-serif", color: T.text }}>{weekTss}</span> / {doelTss}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: T.pillRadius, background: "oklch(0.93 0.012 84)", overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${tssPct}%`, borderRadius: T.pillRadius, background: cfg.kleur }} />
      </div>

      {dominantTekst && (
        <button onClick={() => setUitklap(!uitklap)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.14 248)" }}>
          {uitklap ? "Verberg ▲" : "Waarom? ▼"}
        </button>
      )}
      {uitklap && dominantTekst && (
        <div style={{ font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: T.textSec, marginTop: 6 }}>
          {dominantTekst}
        </div>
      )}
    </div>
  );
}
