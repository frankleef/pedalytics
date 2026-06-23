"use client";
import { useState } from "react";
import { T } from "../designTokens";

const NIVEAUS = [
  { id: "starter", icon: "🚲", naam: "Starter", beschrijving: "Minder dan 1 jaar regelmatig fietsen, geen gestructureerde training" },
  { id: "recreatief", icon: "🚴", naam: "Recreatief", beschrijving: "1–3 jaar ervaring, soms wedstrijden of sportieve tochten" },
  { id: "getraind", icon: "🏆", naam: "Getraind", beschrijving: "3+ jaar, regelmatig gestructureerde training of competitie" },
];

export default function NiveauWisselModal({ huidigNiveau, onBevestig, onAnnuleer }) {
  const [gekozen, setGekozen] = useState(null);
  const [laden, setLaden] = useState(false);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 540, background: T.bg, borderRadius: "28px 28px 0 0", padding: "24px 22px 32px" }}>
        <h2 style={{ margin: "0 0 16px", font: "800 22px var(--font-nunito), sans-serif", color: T.text }}>Niveau wijzigen</h2>

        {NIVEAUS.map(n => (
          <div key={n.id} onClick={() => { if (n.id !== huidigNiveau) setGekozen(n.id); }}
            style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, background: T.cardBg,
              border: `1.5px solid ${gekozen === n.id ? T.gradientA : T.cardBorder}`,
              opacity: n.id === huidigNiveau ? 0.4 : 1,
              borderRadius: 18, marginBottom: 8, cursor: n.id === huidigNiveau ? "default" : "pointer" }}>
            <span style={{ fontSize: 24 }}>{n.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text }}>{n.naam}</div>
              <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>{n.beschrijving}</div>
            </div>
            {n.id === huidigNiveau && <span style={{ font: "600 11px var(--font-nunito), sans-serif", color: T.textTert }}>huidig</span>}
          </div>
        ))}

        {gekozen && (
          <div style={{ background: "oklch(0.96 0.05 82)", border: "1px solid oklch(0.85 0.08 78)", borderRadius: 16, padding: "12px 14px", marginTop: 12, font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.42 0.04 65)" }}>
            Je plan wordt aangepast aan je nieuwe niveau. Sessies vanaf volgende week worden opnieuw gegenereerd. De lopende week blijft ongewijzigd.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onAnnuleer} style={{ flex: 1, padding: 14, borderRadius: T.pillRadius, border: "1.5px solid oklch(0.86 0.014 80)", background: "transparent", color: T.textSec, font: "800 14px var(--font-nunito), sans-serif", cursor: "pointer" }}>Annuleer</button>
          <button onClick={() => { setLaden(true); onBevestig(gekozen); }} disabled={!gekozen || laden}
            style={{ flex: 1, padding: 14, borderRadius: T.pillRadius, border: "none", background: gekozen ? T.slate : "oklch(0.88 0.014 80)", color: gekozen ? "oklch(0.97 0.01 84)" : T.textTert, font: "800 14px var(--font-nunito), sans-serif", cursor: gekozen ? "pointer" : "not-allowed", opacity: laden ? 0.6 : 1 }}>
            {laden ? "Bezig..." : "Bevestig wijziging"}
          </button>
        </div>
      </div>
    </div>
  );
}
