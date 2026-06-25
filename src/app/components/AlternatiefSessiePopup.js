"use client";
import { useState } from "react";
import { T } from "../designTokens";

const REDENEN = [
  { id: "hitte", label: "Te warm buiten" },
  { id: "vermoeid", label: "Benen voelen zwaar" },
  { id: "weinig_tijd", label: "Minder tijd" },
  { id: "motivatie", label: "Geen zin in dit type" },
];

export default function AlternatiefSessiePopup({ onBevestig, onAnnuleer, hrvZone }) {
  const [gekozenReden, setGekozenReden] = useState(null);
  const [isLaden, setIsLaden] = useState(false);

  async function handleBevestig() {
    setIsLaden(true);
    await onBevestig({ reden: gekozenReden });
    setIsLaden(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      padding: "0 0 env(safe-area-inset-bottom, 0px)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onAnnuleer(); }}>
      <div style={{
        width: "100%", maxWidth: 540,
        background: T.cardBg, borderRadius: "28px 28px 0 0",
        padding: "28px 24px calc(24px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
      }}>
        <h2 style={{ margin: "0 0 8px", font: "800 20px var(--font-nunito), sans-serif", color: T.text }}>
          Andere training vandaag?
        </h2>
        <p style={{ margin: "0 0 20px", font: "600 14px/1.5 var(--font-nunito), sans-serif", color: T.textSec }}>
          Je sessie wordt vervangen door een alternatief dat past bij je weekdoelen.
        </p>

        {hrvZone === "rood" && (
          <p style={{ margin: "0 0 16px", padding: "10px 14px", borderRadius: 14, background: "oklch(0.95 0.02 25)", font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.15 25)" }}>
            Je HRV is vandaag significant lager dan normaal. We raden een lichtere sessie aan of adviseren rust.
          </p>
        )}
        {hrvZone === "geel" && (
          <p style={{ margin: "0 0 16px", padding: "10px 14px", borderRadius: 14, background: "oklch(0.96 0.03 70)", font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.1 70)" }}>
            Je HRV is iets lager dan normaal. We kiezen automatisch de lichtere variant van je sessie.
          </p>
        )}

        <p style={{ margin: "0 0 10px", font: "700 12px var(--font-nunito), sans-serif", color: T.textTert, letterSpacing: 0.5 }}>
          Waarom wil je iets anders? (optioneel)
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {REDENEN.map(r => (
            <button
              key={r.id}
              onClick={() => setGekozenReden(gekozenReden === r.id ? null : r.id)}
              style={{
                padding: "8px 14px", borderRadius: 999, border: "1.5px solid",
                borderColor: gekozenReden === r.id ? "oklch(0.55 0.12 248)" : T.cardBorder,
                background: gekozenReden === r.id ? "oklch(0.95 0.03 248)" : T.cardBg,
                color: gekozenReden === r.id ? "oklch(0.4 0.1 248)" : T.textSec,
                font: "700 13px var(--font-nunito), sans-serif",
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onAnnuleer}
            disabled={isLaden}
            style={{
              flex: 1, padding: 15, borderRadius: T.pillRadius,
              border: `1.5px solid ${T.cardBorder}`, background: T.cardBg,
              color: T.textSec, font: "700 14px var(--font-nunito), sans-serif",
              cursor: "pointer", opacity: isLaden ? 0.5 : 1,
            }}
          >
            Annuleren
          </button>
          <button
            onClick={handleBevestig}
            disabled={isLaden}
            style={{
              flex: 1, padding: 15, borderRadius: T.pillRadius,
              border: "none", background: T.slate,
              color: "oklch(0.97 0.01 84)", font: "700 14px var(--font-nunito), sans-serif",
              cursor: "pointer", opacity: isLaden ? 0.6 : 1,
            }}
          >
            {isLaden ? "Bezig..." : "Ja, andere training"}
          </button>
        </div>
      </div>
    </div>
  );
}
