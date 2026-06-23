"use client";
import { useState } from "react";
import { T } from "../designTokens";

const DOELEN = [
  { id: "ftp", icon: "⚡", naam: "FTP verhogen" },
  { id: "aerobe_basis", icon: "🫁", naam: "Betere aerobe basis" },
  { id: "klimmen", icon: "⛰️", naam: "Klimmen & W/kg" },
  { id: "uithoudingsvermogen", icon: "🏔️", naam: "Lange ritten" },
  { id: "sprint", icon: "🚀", naam: "Snelheid & sprint" },
];

export default function DoelWisselModal({ huidigDoel, wekenResterend, onBevestig, onAnnuleer }) {
  const [stap, setStap] = useState(1);
  const [gekozen, setGekozen] = useState(null);
  const [laden, setLaden] = useState(false);

  const huidigLabel = DOELEN.find(d => d.id === huidigDoel)?.naam || huidigDoel;
  const gekozenLabel = DOELEN.find(d => d.id === gekozen)?.naam || gekozen;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 540, background: T.bg, borderRadius: "28px 28px 0 0", padding: "24px 22px 32px", maxHeight: "85vh", overflowY: "auto" }}>

        {stap === 1 && (
          <>
            <h2 style={{ margin: "0 0 16px", font: "800 22px var(--font-nunito), sans-serif", color: T.text }}>Doel wijzigen</h2>

            {DOELEN.map(d => (
              <div key={d.id} onClick={() => { if (d.id !== huidigDoel) setGekozen(d.id); }}
                style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, background: T.cardBg,
                  border: `1.5px solid ${gekozen === d.id ? T.gradientA : T.cardBorder}`,
                  opacity: d.id === huidigDoel ? 0.4 : 1,
                  borderRadius: 18, marginBottom: 8, cursor: d.id === huidigDoel ? "default" : "pointer" }}>
                <span style={{ fontSize: 24 }}>{d.icon}</span>
                <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text }}>{d.naam}</span>
                {d.id === huidigDoel && <span style={{ font: "600 11px var(--font-nunito), sans-serif", color: T.textTert, marginLeft: "auto" }}>huidig</span>}
              </div>
            ))}

            {gekozen && (
              <div style={{ background: "oklch(0.96 0.05 82)", border: "1px solid oklch(0.85 0.08 78)", borderRadius: 16, padding: "12px 14px", marginTop: 12, font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.42 0.04 65)" }}>
                Je wijzigt je seizoensdoel. Sessies vanaf volgende week worden opnieuw gegenereerd op basis van {gekozenLabel} en de {wekenResterend} weken die je nog hebt.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={onAnnuleer} style={{ flex: 1, padding: 14, borderRadius: T.pillRadius, border: "1.5px solid oklch(0.86 0.014 80)", background: "transparent", color: T.textSec, font: "800 14px var(--font-nunito), sans-serif", cursor: "pointer" }}>Annuleer</button>
              <button onClick={() => { if (gekozen) setStap(2); }} disabled={!gekozen}
                style={{ flex: 1, padding: 14, borderRadius: T.pillRadius, border: "none", background: gekozen ? T.slate : "oklch(0.88 0.014 80)", color: gekozen ? "oklch(0.97 0.01 84)" : T.textTert, font: "800 14px var(--font-nunito), sans-serif", cursor: gekozen ? "pointer" : "not-allowed" }}>Volgende</button>
            </div>
          </>
        )}

        {stap === 2 && (
          <>
            <h2 style={{ margin: "0 0 16px", font: "800 22px var(--font-nunito), sans-serif", color: T.text }}>Bevestig wijziging</h2>
            <p style={{ margin: "0 0 20px", font: "600 15px/1.5 var(--font-nunito), sans-serif", color: T.textSec }}>
              Van <strong>{huidigLabel}</strong> naar <strong>{gekozenLabel}</strong> — {wekenResterend} weken resterend
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStap(1)} style={{ flex: 1, padding: 14, borderRadius: T.pillRadius, border: "1.5px solid oklch(0.86 0.014 80)", background: "transparent", color: T.textSec, font: "800 14px var(--font-nunito), sans-serif", cursor: "pointer" }}>Terug</button>
              <button onClick={() => { setLaden(true); onBevestig(gekozen); }} disabled={laden}
                style={{ flex: 1, padding: 14, borderRadius: T.pillRadius, border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 14px var(--font-nunito), sans-serif", cursor: "pointer", opacity: laden ? 0.6 : 1 }}>
                {laden ? "Bezig..." : "Bevestig wijziging"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
