"use client";
import { T } from "../designTokens";
import { CONDITIE_UITLEG } from "@/lib/conditie";

// Uitleg-bottomsheet voor de conditiescore — gedeeld door GereedheidConditieKaart
// (home) en AdaptatieScoreKaart (schema), want beide tonen dezelfde score.
export default function ConditieUitlegModal({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "oklch(0.2 0.01 262 / 0.42)", zIndex: 50, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: T.cardBg, borderRadius: "28px 28px 0 0", padding: "22px 22px 26px", width: "100%" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 18px", font: "700 18px var(--font-nunito), sans-serif", color: T.text }}>Hoe werkt de conditiescore?</h3>
        {CONDITIE_UITLEG.map((item, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text, marginBottom: 3 }}>{item.titel}</div>
            <div style={{ font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: T.textSec }}>{item.tekst}</div>
          </div>
        ))}
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: T.pillRadius, border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", font: "700 14.5px var(--font-nunito), sans-serif", cursor: "pointer", marginTop: 6 }}>Sluiten</button>
      </div>
    </div>
  );
}
