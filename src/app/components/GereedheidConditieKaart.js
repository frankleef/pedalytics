"use client";
import { useState, useEffect } from "react";
import { T, STATUS, getStatus } from "../designTokens";
import { conditieInfoRegels } from "@/lib/conditie";

const PILL_KLEUREN = {
  groen: { bg: "oklch(0.96 0.02 150)", tekst: "oklch(0.52 0.062 150)", dot: "oklch(0.63 0.06 150)" },
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

export default function GereedheidConditieKaart({ balansScore, ctl, atl, tsb, conditieData, paragraaf }) {
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

  const pillKleur = condData?.pill?.kleur ? PILL_KLEUREN[condData.pill.kleur] : null;
  const infoRegels = condData ? conditieInfoRegels(condData.ctl_nu, condData.ctl_4w_geleden, condData.rpe_delta_trend) : {};

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

      <div style={{ height: 1, background: T.divider, margin: "16px 0" }} />

      {/* Conditie */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Conditie</span>
          <button onClick={() => setInfoOpen(true)} style={{ width: 22, height: 22, borderRadius: "50%", background: T.subtleFill, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={T.textSec} strokeWidth="2"/><path d="M12 16v-4M12 8h.01" stroke={T.textSec} strokeWidth="2" strokeLinecap="round"/></svg>
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
      {!condData?.pill && <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 8 }}>Meer ritten nodig — beschikbaar na 4 weken training.</div>}
      {hitteMelding && (
        <div style={{ font: "600 12px/1.5 var(--font-nunito), sans-serif", color: T.textSec, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.divider}` }}>
          Je recente ritten waren overwegend in warme omstandigheden. De aerobe trend is tijdelijk minder betrouwbaar — dit herstelt zich zodra de omstandigheden normaliseren.
        </div>
      )}

      {infoOpen && (
        <div style={{ position: "fixed", inset: 0, background: "oklch(0.2 0.01 262 / 0.42)", zIndex: 50, display: "flex", alignItems: "flex-end" }} onClick={() => setInfoOpen(false)}>
          <div style={{ background: T.cardBg, borderRadius: "28px 28px 0 0", padding: "22px 22px 26px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 18px", font: "700 18px var(--font-nunito), sans-serif", color: T.text }}>Hoe werkt de conditiescore?</h3>
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
            <button onClick={() => setInfoOpen(false)} style={{ width: "100%", padding: 14, borderRadius: T.pillRadius, border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", font: "700 14.5px var(--font-nunito), sans-serif", cursor: "pointer", marginTop: 6 }}>Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
