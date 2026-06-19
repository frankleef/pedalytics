"use client";
import { T } from "../designTokens";

export default function SharedHeader({ onAvatarClick }) {
  const nu = new Date();
  const dagNl = nu.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  const uur = nu.getHours();
  const groet = uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert }}>{dagNl}</span>
        <span style={{ font: "700 17px var(--font-nunito), sans-serif", color: "oklch(0.3 0.02 70)" }}>{groet} 👋</span>
      </div>
      <button onClick={onAvatarClick} aria-label="Open profiel"
        style={{ flex: "none", width: 46, height: 46, padding: 0, border: "none", cursor: "pointer", borderRadius: "50%", background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", font: "800 18px var(--font-fredoka), sans-serif", color: "#fff", boxShadow: "0 4px 12px rgba(40,90,140,0.28)" }}>
        F
      </button>
    </div>
  );
}
