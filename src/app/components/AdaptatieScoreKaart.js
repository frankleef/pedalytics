"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import { ADAPTATIE_CONFIG, DOMINANT_LABEL } from "@/lib/adaptatie";

export default function AdaptatieScoreKaart({ weekTss, doelTss, fase, weekNr, weektype }) {
  const [adaptatieScore, setAdaptatieScore] = useState(null);
  const [uitklap, setUitklap] = useState(false);
  const [hitteMelding, setHitteMelding] = useState(false);

  useEffect(() => {
    fetch("/api/plan/adaptatie-score").then(r => r.json()).then(d => {
      if (d.success && d.data) setAdaptatieScore(d.data);
      if (d.hitteMelding) setHitteMelding(true);
    }).catch(() => {});
  }, []);

  const tssPct = doelTss > 0 ? Math.min(100, Math.round((weekTss / doelTss) * 100)) : 0;

  // Status bepalen: uit adaptatie-score als beschikbaar, anders uit TSS-compliance
  const tssStatus = doelTss > 0
    ? (tssPct > 120 ? "iets_teveel" : tssPct > 90 ? "optimaal" : tssPct > 60 ? "iets_te_weinig" : "te_weinig")
    : "optimaal";
  const effectieveScore = adaptatieScore || { status: tssStatus, dominant: null };
  const cfg = ADAPTATIE_CONFIG[effectieveScore.status] || ADAPTATIE_CONFIG.optimaal;
  const dominantTekst = adaptatieScore ? (DOMINANT_LABEL[adaptatieScore.dominant] || null) : null;

  return (
    <div style={{ background: T.cardBg, borderRadius: 24, padding: "15px 17px 16px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 18 }}>
      {fase && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid oklch(0.93 0.01 82)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.gradient }} />
            <span style={{ font: "700 13.5px var(--font-nunito), sans-serif", color: T.text }}>{fase}</span>
          </div>
          <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec, padding: "4px 10px", borderRadius: T.pillRadius, background: T.subtleFill }}>Week {weekNr} · {weektype}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: T.pillRadius, background: T.subtleFill }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.kleur }} />
          <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{cfg.label}</span>
        </div>
      </div>
      <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 10 }}>{cfg.subtekst}</div>

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
      {hitteMelding && (
        <div style={{ font: "600 12px/1.5 var(--font-nunito), sans-serif", color: T.textSec, marginTop: 8, paddingTop: 8, borderTop: `1px solid oklch(0.93 0.01 82)` }}>
          Je recente ritten waren overwegend in warme omstandigheden. De aerobe trend is tijdelijk minder betrouwbaar — dit herstelt zich zodra de omstandigheden normaliseren.
        </div>
      )}
    </div>
  );
}
