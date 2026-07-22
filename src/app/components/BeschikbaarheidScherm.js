"use client";
import { useRef } from "react";
import { T } from "../designTokens";
import BeschikbaarheidEditor from "./BeschikbaarheidEditor";
import { kaderWeekVoorDatum } from "@/lib/weekgrenzen";

export default function BeschikbaarheidScherm({ beschikbaar, urenPerDag, kader, startdatum, seizoensdoelType, ervaringsniveau, onOpslaan, onTerug }) {
  const laatsteDataRef = useRef({ beschikbaar: beschikbaar || {}, uren: urenPerDag || {} });
  const huidigeWeek = kaderWeekVoorDatum(new Date(), kader, startdatum);
  const weekTssDoel = huidigeWeek?.tss_doel ?? null;

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, color: T.text, fontFamily: T.font, zIndex: 100, overflowY: "auto" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px`, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={onTerug} style={{ width: 42, height: 42, borderRadius: "50%", background: T.cardBg, border: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: T.text }}>‹</button>
          <span style={{ font: "700 16px var(--font-nunito), sans-serif", color: T.text }}>Beschikbaarheid</span>
          <div style={{ width: 42 }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Jouw trainingsweek</span>
          <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Beschikbaarheid aanpassen</h1>
        </div>

        <div style={{ flex: 1 }}>
          <BeschikbaarheidEditor
            initieel={{ beschikbaar, uren: urenPerDag }}
            onWijzig={(data) => { laatsteDataRef.current = data; }}
            weekTssDoel={weekTssDoel}
            fase={huidigeWeek?.fase}
            seizoensdoelType={seizoensdoelType}
            ervaringsniveau={ervaringsniveau}
          />
        </div>

        <button onClick={() => onOpslaan(laatsteDataRef.current)}
          style={{ width: "100%", marginTop: 20, border: "none", cursor: "pointer", padding: 16, borderRadius: T.pillRadius, background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 16px var(--font-nunito), sans-serif", letterSpacing: 0.2 }}>
          Opslaan
        </button>
      </div>
    </div>
  );
}
