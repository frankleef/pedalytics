"use client";
import { T } from "../designTokens";

export default function SharedHeader({ onAvatarClick }) {
  const nu = new Date();
  const dagRuw = nu.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  const dagNl = dagRuw.charAt(0).toUpperCase() + dagRuw.slice(1);
  const uur = nu.getHours();
  const groet = uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
        <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>{dagNl}</span>
        <span style={{ font: "700 23px var(--font-nunito), sans-serif", letterSpacing: -0.4, color: T.text }}>{groet}, Frank</span>
      </div>
      <button onClick={onAvatarClick} aria-label="Open profiel"
        style={{ flex: "none", width: 48, height: 48, padding: 0, border: `1px solid ${T.cardBorder}`, cursor: "pointer", borderRadius: "50%", background: T.subtleFill, display: "flex", alignItems: "center", justifyContent: "center", font: "700 18px var(--font-fredoka), sans-serif", color: "oklch(0.4 0.01 262)" }}>
        F
      </button>
    </div>
  );
}
