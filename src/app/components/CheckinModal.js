"use client";
import { T } from "../designTokens";
import ScaleInput from "./ScaleInput";

export default function CheckinModal({ value, onChange, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "oklch(0.2 0.01 262 / 0.42)", zIndex: 60, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: T.cardBg, borderRadius: "30px 30px 0 0", padding: "14px 24px 30px", width: "100%", boxShadow: "0 -12px 40px rgba(20,24,40,0.22)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: T.cardBorder, margin: "0 auto 20px" }} />

        <span style={{ font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Ochtend check-in</span>
        <h2 style={{ margin: "8px 0 4px", font: "700 22px var(--font-nunito), sans-serif", letterSpacing: -0.4, color: T.text }}>Hoe voel je je vandaag?</h2>
        <p style={{ margin: "0 0 22px", font: "500 13.5px/1.5 var(--font-nunito), sans-serif", color: T.textSec }}>Je antwoord verfijnt het advies en de zwaarte van de sessie van vandaag.</p>

        <ScaleInput value={value} max={5} leftLabel="Slecht" rightLabel="Top" onChange={onChange} />

        <button
          disabled={!value}
          onClick={onConfirm}
          style={{ width: "100%", marginTop: 24, cursor: value ? "pointer" : "default", border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", padding: 16, borderRadius: 14, font: "700 15px var(--font-nunito), sans-serif", opacity: value ? 1 : 0.5 }}
        >
          Bevestigen
        </button>
      </div>
    </div>
  );
}
