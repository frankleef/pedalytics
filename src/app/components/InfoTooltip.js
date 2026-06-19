"use client";
import { useState } from "react";
import { METRICS } from "../metricsGlossary";

export default function InfoTooltip({ metricKey }) {
  const [open, setOpen] = useState(false);
  const m = METRICS[metricKey];
  if (!m) return null;

  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{ width: 16, height: 16, flexShrink: 0, borderRadius: "50%", border: "1.5px solid oklch(0.74 0.02 75)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <span style={{ font: "800 10px var(--font-fredoka), sans-serif", lineHeight: 1, color: "oklch(0.62 0.02 75)" }}>i</span>
      </div>

      {open && (
        <>
          <style>{`
            @keyframes pdl-pop-in { from { opacity: 0; transform: translate(-50%,-50%) scale(0.92); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
            @keyframes pdl-veil-in { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(38,27,12,0.34)", animation: "pdl-veil-in 0.2s ease both" }} />
          <div style={{ position: "fixed", left: "50%", top: "50%", zIndex: 901, width: 330, maxWidth: "calc(100vw - 40px)", background: "oklch(0.99 0.006 84)", borderRadius: 24, boxShadow: "0 18px 50px rgba(40,30,15,0.28)", padding: "20px 22px 22px", animation: "pdl-pop-in 0.24s cubic-bezier(0.22,1,0.36,1) both", transform: "translate(-50%,-50%)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 13, background: m.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ font: "600 19px var(--font-fredoka), sans-serif", lineHeight: 1, color: m.color }}>i</span>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, paddingTop: 1 }}>
                <span style={{ font: "700 18.5px var(--font-nunito), sans-serif", letterSpacing: -0.2, color: "oklch(0.27 0.02 70)" }}>{m.title}</span>
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: m.color }}>{m.tag}</span>
              </div>
              <div onClick={() => setOpen(false)}
                style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "50%", background: "oklch(0.95 0.012 84)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="oklch(0.45 0.02 72)" strokeWidth="2.6" strokeLinecap="round"/></svg>
              </div>
            </div>
            <p style={{ margin: 0, font: "600 14.5px/1.55 var(--font-nunito), sans-serif", color: "oklch(0.42 0.02 72)", textWrap: "pretty" }}>{m.body}</p>
          </div>
        </>
      )}
    </>
  );
}
