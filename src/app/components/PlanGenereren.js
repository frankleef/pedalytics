"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";

const BERICHTEN = [
  "Even geduld — we stellen je seizoensplan samen op basis van je doelen en beschikbaarheid.",
  "We verdelen je weken over vijf fases, van rustige basis tot scherpe pieken.",
  "Je trainingsbelasting wordt afgestemd op de dagen die je hebt opgegeven.",
  "Nu worden je eerste trainingssessies samengesteld met concrete vermogensdoelen.",
  "Bijna klaar — we leggen de laatste hand aan je eerste trainingsweek.",
];

const BERICHT_PCT = [12, 30, 50, 70, 88];

export default function PlanGenereren() {
  const [berichtIdx, setBerichtIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setBerichtIdx(i => Math.min(i + 1, BERICHTEN.length - 1));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const pct = BERICHT_PCT[Math.min(berichtIdx, BERICHT_PCT.length - 1)];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes pdl-spin { to { transform: rotate(360deg); } }
        @keyframes pdl-pulse { 0%, 100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(1.12); opacity: 0.12; } }
        @keyframes pdl-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes pdl-fade { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pdl-dot { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
      `}</style>

      <div style={{ maxWidth: 540, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 38px", textAlign: "center" }}>

        <div style={{ position: "relative", width: 132, height: 132, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 44 }}>
          <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: "radial-gradient(circle, oklch(0.79 0.14 168 / 0.5), transparent 68%)", animation: "pdl-pulse 2.4s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "7px solid oklch(0.93 0.012 84)" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168), oklch(0.64 0.14 248) 65%, transparent 65%)", WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 7px))", mask: "radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 7px))", animation: "pdl-spin 1.5s linear infinite" }} />
          <div style={{ width: 62, height: 62, borderRadius: 20, background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(60,120,150,0.3)", animation: "pdl-breathe 2.4s ease-in-out infinite" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M4 14.5l4-7 3.5 4.5L15 6l5 8.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>

        <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.7, color: "oklch(0.62 0.02 75)", marginBottom: 14 }}>JE SEIZOENSPLAN WORDT OPGESTELD</span>

        <div style={{ height: 96, display: "flex", alignItems: "flex-start", justifyContent: "center", width: "100%" }}>
          <p key={berichtIdx} style={{ margin: 0, font: "700 19.5px/1.36 var(--font-nunito), sans-serif", letterSpacing: -0.3, color: T.text, textWrap: "pretty", animation: "pdl-fade 0.5s ease both" }}>
            {BERICHTEN[berichtIdx]}
          </p>
        </div>

        <div style={{ width: 188, height: 6, borderRadius: 999, background: "oklch(0.91 0.012 84)", overflow: "hidden", marginTop: 26 }}>
          <div style={{ height: "100%", borderRadius: 999, background: T.gradient, width: `${pct}%`, transition: "width 1.2s ease" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 18 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "oklch(0.66 0.13 235)", animation: "pdl-dot 1.4s ease-in-out infinite" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "oklch(0.66 0.13 200)", animation: "pdl-dot 1.4s ease-in-out infinite 0.2s" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "oklch(0.72 0.13 168)", animation: "pdl-dot 1.4s ease-in-out infinite 0.4s" }} />
        </div>

        <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textTert, marginTop: 22 }}>Dit kan enkele minuten duren</span>
      </div>
    </div>
  );
}
