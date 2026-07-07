"use client";
import { T } from "../designTokens";

export default function SharedHeader({ onAvatarClick, onMeldingenClick, heeftOngelezenMeldingen = false }) {
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
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
        {onMeldingenClick && (
          <button onClick={onMeldingenClick} aria-label="Open meldingen"
            style={{ position: "relative", width: 36, height: 36, padding: 0, border: "none", cursor: "pointer", borderRadius: "50%", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 8.5c0-3.31-2.69-6-6-6s-6 2.69-6 6c0 5.5-2.5 6.5-2.5 8h17c0-1.5-2.5-2.5-2.5-8Z" stroke={T.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke={T.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {heeftOngelezenMeldingen && (
              <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: "oklch(0.6 0.13 28)", border: `1.5px solid ${T.bg}` }} />
            )}
          </button>
        )}
        <button onClick={onAvatarClick} aria-label="Open profiel"
          style={{ flex: "none", width: 48, height: 48, padding: 0, border: `1px solid ${T.cardBorder}`, cursor: "pointer", borderRadius: "50%", background: T.subtleFill, display: "flex", alignItems: "center", justifyContent: "center", font: "700 18px var(--font-fredoka), sans-serif", color: "oklch(0.4 0.01 262)" }}>
          F
        </button>
      </div>
    </div>
  );
}
