"use client";
import { T, STATUS, getStatus } from "../designTokens";

const SUBTEKSTEN = {
  vol_gas: "Je lichaam is klaar voor een zware training.",
  goed: "Je lichaam is klaar voor een goede training vandaag.",
  rustig: "Train, maar houd de intensiteit laag.",
  herstel: "Een lichtere dag of rust is vandaag verstandig.",
  rust: "Je lichaam vraagt om rust — sla de training over.",
};

export default function GereedheidKaart({ balansScore, ctl, atl, tsb, paragraaf }) {
  const statusKey = getStatus(balansScore ?? 50);
  const st = STATUS[statusKey];
  const scoreVal = balansScore ?? 50;

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "22px 22px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>

      {/* Gereedheid */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Gereedheid vandaag</span>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: T.pillRadius, background: T.accentBg }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot }} />
          <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: st.color }}>{st.label}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 14 }}>
        <span style={{ font: "800 60px var(--font-fredoka), sans-serif", lineHeight: 0.82, letterSpacing: -2, color: T.text }}>{scoreVal}</span>
        <span style={{ font: "600 17px var(--font-nunito), sans-serif", color: T.textTert, paddingBottom: 6 }}>/ 100</span>
      </div>

      {/* Meter */}
      <div style={{ position: "relative", height: 10, borderRadius: 999, background: T.divider, marginBottom: 8 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${scoreVal}%`, borderRadius: 999, background: st.dot }} />
        <div style={{ position: "absolute", left: `${scoreVal}%`, top: "50%", width: 16, height: 16, borderRadius: "50%", background: T.cardBg, border: `3px solid ${st.dot}`, transform: "translate(-50%,-50%)", boxShadow: "0 1px 4px rgba(30,60,40,0.25)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ font: "600 11px var(--font-nunito), sans-serif", color: T.textTert }}>Rust nodig</span>
        <span style={{ font: "600 11px var(--font-nunito), sans-serif", color: T.textTert }}>Topvorm</span>
      </div>

      <p style={{ margin: "0 0 18px", font: "500 14.5px/1.55 var(--font-nunito), sans-serif", color: T.textSec }}>{paragraaf || SUBTEKSTEN[statusKey] || ""}</p>

      {/* Form triplet — altijd zichtbaar */}
      <div style={{ display: "flex", borderTop: `1px solid ${T.divider}`, paddingTop: 16 }}>
        {[
          { label: "Fitheid", value: ctl ?? "—" },
          { label: "Vermoeidheid", value: atl ?? "—" },
          { label: "Vorm", value: tsb != null ? (tsb > 0 ? `+${tsb}` : tsb) : "—", color: st.color },
        ].map((m, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? `1px solid ${T.divider}` : "none" }}>
            <span style={{ font: "700 24px var(--font-fredoka), sans-serif", letterSpacing: -0.5, lineHeight: 1, color: m.color || T.text }}>{m.value}</span>
            <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>{m.label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
