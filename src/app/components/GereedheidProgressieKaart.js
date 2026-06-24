"use client";
import { useState, useEffect } from "react";
import { T, STATUS, getStatus } from "../designTokens";
import InfoTooltip from "./InfoTooltip";

const PROGRESSIE_STATUS = {
  groeit: { label: "Conditie groeit", kleur: "oklch(0.5 0.13 162)" },
  optimaal: { label: "Optimale belasting", kleur: "oklch(0.6 0.13 165)" },
  letop: { label: "Let op herstel", kleur: "oklch(0.56 0.13 55)" },
  overbelasting: { label: "Overbelasting", kleur: "oklch(0.52 0.1 28)" },
};

function progStatus(adaptatieScore) {
  if (adaptatieScore == null) return null;
  if (adaptatieScore > 0.15) return "groeit";
  if (adaptatieScore >= -0.15) return "optimaal";
  if (adaptatieScore >= -0.5) return "letop";
  return "overbelasting";
}

export default function GereedheidProgressieKaart({ balansScore, ctl, atl, tsb, adaptatieScore }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [adaptatie, setAdaptatie] = useState(adaptatieScore);

  useEffect(() => {
    if (adaptatieScore == null) {
      fetch("/api/plan/adaptatie-score").then(r => r.json()).then(d => {
        if (d.success && d.data?.score != null) setAdaptatie(d.data.score);
      }).catch(() => {});
    }
  }, []);

  const statusKey = getStatus(balansScore ?? 50);
  const st = STATUS[statusKey];
  const scoreVal = balansScore ?? 50;

  const R = 36, C = 2 * Math.PI * R;
  const offset = C * (1 - scoreVal / 100);

  const pStatus = progStatus(adaptatie);
  const pCfg = pStatus ? PROGRESSIE_STATUS[pStatus] : null;

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>

      {/* Gereedheid */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Gereedheid</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: T.pillRadius, background: T.subtleFill }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot }} />
          <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{st.label}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 10 }}>
        {/* Ring */}
        <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
          <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
            <defs>
              <linearGradient id="gpRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={st.ringA} />
                <stop offset="100%" stopColor={st.ringB} />
              </linearGradient>
            </defs>
            <circle cx="44" cy="44" r={R} fill="none" stroke="oklch(0.93 0.012 84)" strokeWidth="8" />
            <circle cx="44" cy="44" r={R} fill="none" stroke="url(#gpRingGrad)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ font: "600 30px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{scoreVal}</span>
            <span style={{ font: "700 9.5px var(--font-nunito), sans-serif", letterSpacing: 0.5, color: T.textTert }}>SCORE</span>
          </div>
        </div>

        {/* Label + subtekst */}
        <div style={{ flex: 1 }}>
          <div style={{ font: "800 16px var(--font-nunito), sans-serif", color: st.color, marginBottom: 4 }}>{st.label}</div>
          <div style={{ font: "600 12.5px/1.45 var(--font-nunito), sans-serif", color: "oklch(0.5 0.03 72)" }}>
            {STATUS[statusKey]?.headline ? "" : ""}{st.label === "Vol gas" ? "Je lichaam is klaar voor een zware training." : st.label === "Goed om te gaan" ? "Je lichaam is klaar voor een goede training vandaag." : st.label === "Doe het rustig aan" ? "Train, maar houd de intensiteit laag." : st.label === "Herstel eerst" ? "Een lichtere dag of rust is vandaag verstandig." : "Je lichaam vraagt om rust — sla de training over."}
          </div>
        </div>
      </div>

      {/* Details toggle */}
      <button onClick={() => setDetailsOpen(!detailsOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: detailsOpen ? 10 : 0 }}>
        {detailsOpen ? "Verberg ▲" : "▾ Details"}
      </button>
      {detailsOpen && (
        <div style={{ display: "flex", alignItems: "stretch", gap: 10, marginTop: 6 }}>
          {[
            { label: "Fitheid", sub: "CTL", value: ctl ?? "—", color: T.text },
            { label: "Vermoeidheid", sub: "ATL", value: atl ?? "—", color: T.text },
            { label: "Vorm", sub: "TSB", value: tsb != null ? (tsb > 0 ? `+${tsb}` : tsb) : "—", color: st.dot },
          ].map((m, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "12px 4px", borderRadius: T.tileRadius, background: T.subtleFill }}>
              <span style={{ font: "600 22px var(--font-fredoka), sans-serif", lineHeight: 1, color: m.color }}>{m.value}</span>
              <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{m.label}</span>
              <span style={{ font: "700 10px var(--font-nunito), sans-serif", letterSpacing: 0.5, color: T.textTert }}>{m.sub}</span>
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "oklch(0.93 0.01 82)", margin: "14px 0" }} />

      {/* Progressie */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Progressie</span>
          <button onClick={() => setInfoOpen(true)} style={{ width: 22, height: 22, borderRadius: "50%", background: "oklch(0.93 0.01 82)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="oklch(0.5 0.02 74)" strokeWidth="2"/><path d="M12 16v-4M12 8h.01" stroke="oklch(0.5 0.02 74)" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        {pCfg && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: T.pillRadius, background: T.subtleFill }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: pCfg.kleur }} />
            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{pCfg.label}</span>
          </div>
        )}
        {!pCfg && <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>Nog te weinig data</span>}
      </div>

      {/* Info overlay */}
      {infoOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,10,0.55)", zIndex: 50, display: "flex", alignItems: "flex-end" }} onClick={() => setInfoOpen(false)}>
          <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: "28px 28px 0 0", padding: "22px 22px 26px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 18px", font: "800 18px var(--font-nunito), sans-serif", color: T.text }}>Hoe werkt de progressiescore?</h3>
            {[
              { titel: "Gevoel (RPE-trend)", tekst: "Hoe zwaar voelden je ritten de afgelopen 2 weken aan vergeleken met de verwachting? Als training makkelijker wordt bij gelijke belasting, groei je." },
              { titel: "HRV-trend", tekst: "Je hartslagvariabiliteit vergeleken met jouw persoonlijke 28-daagse gemiddelde. Een stijgende trend wijst op herstel en aanpassing." },
              { titel: "Opbouw (TSS)", tekst: "TSS meet de totale zwaarte van een rit op basis van duur en intensiteit. Optimale opbouw: 3–7 TSS-punten per week." },
              { titel: "Aerobe basis", tekst: "Hoe efficiënt werkt je hart bij lage intensiteit? Gemeten via hartslagstijging tijdens Z2-ritten (cardiac decoupling)." },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text, marginBottom: 3 }}>{item.titel}</div>
                <div style={{ font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: T.textSec }}>{item.tekst}</div>
              </div>
            ))}
            <button onClick={() => setInfoOpen(false)} style={{ width: "100%", padding: 14, borderRadius: T.pillRadius, border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 14.5px var(--font-nunito), sans-serif", cursor: "pointer", marginTop: 6 }}>Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
