"use client";
import { useState, useEffect } from "react";
import { T, STATUS, getStatus } from "../designTokens";
import { conditieInfoRegels } from "@/lib/conditie";

const PILL_KLEUREN = {
  groen: { bg: "oklch(0.93 0.045 168)", tekst: "oklch(0.32 0.1 165)", dot: "oklch(0.46 0.12 165)" },
  geel: { bg: "oklch(0.95 0.04 90)", tekst: "oklch(0.45 0.1 85)", dot: "oklch(0.65 0.12 88)" },
  oranje: { bg: "oklch(0.95 0.04 55)", tekst: "oklch(0.45 0.1 50)", dot: "oklch(0.63 0.12 52)" },
  rood: { bg: "oklch(0.95 0.04 28)", tekst: "oklch(0.45 0.1 25)", dot: "oklch(0.58 0.11 28)" },
  blauw: { bg: "oklch(0.93 0.03 235)", tekst: "oklch(0.38 0.09 245)", dot: "oklch(0.5 0.09 248)" },
};

const SUBTEKSTEN = {
  vol_gas: "Je lichaam is klaar voor een zware training.",
  goed: "Je lichaam is klaar voor een goede training vandaag.",
  rustig: "Train, maar houd de intensiteit laag.",
  herstel: "Een lichtere dag of rust is vandaag verstandig.",
  rust: "Je lichaam vraagt om rust — sla de training over.",
};

export default function GereedheidConditieKaart({ balansScore, ctl, atl, tsb, conditieData }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [condData, setCondData] = useState(conditieData);
  const [hitteMelding, setHitteMelding] = useState(false);

  useEffect(() => {
    if (!condData) {
      fetch("/api/plan/conditie-score").then(r => r.json()).then(d => {
        if (d.success && d.data) setCondData(d.data);
        if (d.hitteMelding) setHitteMelding(true);
      }).catch(() => {});
    }
  }, []);

  const statusKey = getStatus(balansScore ?? 50);
  const st = STATUS[statusKey];
  const scoreVal = balansScore ?? 50;
  const R = 36, C = 2 * Math.PI * R;
  const offset = C * (1 - scoreVal / 100);

  const pillKleur = condData?.pill?.kleur ? PILL_KLEUREN[condData.pill.kleur] : null;
  const infoRegels = condData ? conditieInfoRegels(condData.ctl_nu, condData.ctl_4w_geleden, condData.rpe_delta_trend) : {};

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
        <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
          <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
            <defs><linearGradient id="gcRingGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={st.ringA} /><stop offset="100%" stopColor={st.ringB} /></linearGradient></defs>
            <circle cx="44" cy="44" r={R} fill="none" stroke="oklch(0.93 0.012 84)" strokeWidth="8" />
            <circle cx="44" cy="44" r={R} fill="none" stroke="url(#gcRingGrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ font: "600 30px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{scoreVal}</span>
            <span style={{ font: "700 9.5px var(--font-nunito), sans-serif", letterSpacing: 0.5, color: T.textTert }}>SCORE</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ font: "800 16px var(--font-nunito), sans-serif", color: st.color, marginBottom: 4 }}>{st.label}</div>
          <div style={{ font: "600 12.5px/1.45 var(--font-nunito), sans-serif", color: "oklch(0.5 0.03 72)" }}>{SUBTEKSTEN[statusKey] || ""}</div>
        </div>
      </div>

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

      <div style={{ height: 1, background: "oklch(0.93 0.01 82)", margin: "14px 0" }} />

      {/* Conditie */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Conditie</span>
          <button onClick={() => setInfoOpen(true)} style={{ width: 22, height: 22, borderRadius: "50%", background: "oklch(0.93 0.01 82)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="oklch(0.5 0.02 74)" strokeWidth="2"/><path d="M12 16v-4M12 8h.01" stroke="oklch(0.5 0.02 74)" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        {pillKleur && condData?.pill ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: T.pillRadius, background: pillKleur.bg }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: pillKleur.dot }} />
            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: pillKleur.tekst }}>{condData.pill.label}</span>
          </div>
        ) : (
          <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>Nog te weinig data</span>
        )}
      </div>

      {condData?.pill && (infoRegels.ctlRegel || infoRegels.rpeRegel) && (
        <div style={{ marginTop: 10 }}>
          {infoRegels.ctlRegel && <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>{infoRegels.ctlRegel}</div>}
          {infoRegels.rpeRegel && <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>{infoRegels.rpeRegel}</div>}
        </div>
      )}
      {!condData?.pill && <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", marginTop: 8 }}>Meer ritten nodig — beschikbaar na 4 weken training.</div>}
      {hitteMelding && (
        <div style={{ font: "600 12px/1.5 var(--font-nunito), sans-serif", color: T.textSec, marginTop: 8, paddingTop: 8, borderTop: `1px solid oklch(0.93 0.01 82)` }}>
          Je recente ritten waren overwegend in warme omstandigheden. De aerobe trend is tijdelijk minder betrouwbaar — dit herstelt zich zodra de omstandigheden normaliseren.
        </div>
      )}

      {infoOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,10,0.55)", zIndex: 50, display: "flex", alignItems: "flex-end" }} onClick={() => setInfoOpen(false)}>
          <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: "28px 28px 0 0", padding: "22px 22px 26px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 18px", font: "800 18px var(--font-nunito), sans-serif", color: T.text }}>Hoe werkt de conditiescore?</h3>
            {[
              { titel: "Belasting", tekst: "Hoe snel bouw je trainingsbelasting (CTL) op? Optimaal is 3-7 punten per week. Te snel = overbelasting, te langzaam = te weinig stimulus." },
              { titel: "Conditieontwikkeling", tekst: "Stijgt, stabiliseert of daalt je fitheid (CTL) over de afgelopen 4 weken? Dit is het primaire signaal." },
              { titel: "Gevoel (RPE-trend)", tekst: "Voelen je trainingen lichter of zwaarder aan dan verwacht? Als gelijke training makkelijker wordt, groei je." },
              { titel: "Aerobe basis", tekst: "Hoe efficiënt werkt je hart bij lage intensiteit? Gemeten via hartslagstijging tijdens Z2-ritten." },
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
