"use client";
import { T, STATUS, getStatus } from "../../designTokens";
import { berekenHerstelScore } from "../HerstelStatus";
import InfoTooltip from "../InfoTooltip";

export default function BalanceRing({ vandaagInvoer, tsb, slaapScore, wellenessHuidig, hrvBasislijn, hrBasislijn, label, checkin }) {
  const { score, signalen } = berekenHerstelScore({
    hrv: vandaagInvoer?.hrv,
    hrvBasislijn: hrvBasislijn || 58,
    rusthartslag: vandaagInvoer?.rusthartslag,
    rusthartslagBasislijn: hrBasislijn || 49,
    tsb,
    slaapScore,
    checkin,
  });

  const statusKey = getStatus(score);
  const st = STATUS[statusKey];
  const ctl = wellenessHuidig ? Math.round(wellenessHuidig.ctl || 0) : null;
  const atl = wellenessHuidig ? Math.round(wellenessHuidig.atl || 0) : null;
  const tsbVal = ctl != null && atl != null ? ctl - atl : null;

  const R = 93;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - score / 100);

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "24px 22px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ font: "800 12px var(--font-nunito), 'Nunito', sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>{label || "Trainingsbalans"}</span>
          <InfoTooltip metricKey="balansscore" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: T.pillRadius, background: T.subtleFill }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot }} />
          <span style={{ font: "700 12px var(--font-nunito), 'Nunito', sans-serif", color: "oklch(0.4 0.02 72)" }}>{st.label}</span>
        </div>
      </div>

      {/* Ring */}
      <div style={{ position: "relative", width: 210, height: 210, margin: "6px auto 10px" }}>
        <svg width="210" height="210" viewBox="0 0 210 210" style={{ transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={st.ringA} />
              <stop offset="100%" stopColor={st.ringB} />
            </linearGradient>
          </defs>
          <circle cx="105" cy="105" r={R} fill="none" stroke={T.cardBorder} strokeWidth="16" />
          <circle cx="105" cy="105" r={R} fill="none" stroke="url(#ringGrad)" strokeWidth="16"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <span style={{ font: "600 12px var(--font-nunito), 'Nunito', sans-serif", color: T.textSec }}>Balansscore</span>
          <span style={{ font: "600 62px var(--font-fredoka), 'Fredoka', sans-serif", lineHeight: 0.95, color: T.text }}>{score}</span>
          <span style={{ font: "700 13px var(--font-nunito), 'Nunito', sans-serif", color: st.dot, marginTop: 2 }}>
            Vorm {tsbVal != null ? (tsbVal > 0 ? `+${tsbVal}` : tsbVal) : "—"}
          </span>
        </div>
      </div>

      {/* CTL / ATL / TSB triplet */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 10 }}>
        {[
          { label: "Fitheid", sub: "CTL", value: ctl ?? "—", color: T.text, key: "ctl" },
          { label: "Vermoeidheid", sub: "ATL", value: atl ?? "—", color: T.text, key: "atl" },
          { label: "Vorm", sub: "TSB", value: tsbVal != null ? (tsbVal > 0 ? `+${tsbVal}` : tsbVal) : "—", color: st.dot, key: "vorm" },
        ].map((m, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "12px 4px", borderRadius: T.tileRadius, background: T.subtleFill }}>
            <span style={{ font: "600 30px var(--font-fredoka), 'Fredoka', sans-serif", lineHeight: 1, color: m.color }}>{m.value}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ font: "700 12px var(--font-nunito), 'Nunito', sans-serif", color: "oklch(0.4 0.02 72)" }}>{m.label}</span>
              <InfoTooltip metricKey={m.key} />
            </div>
            <span style={{ font: "700 10px var(--font-nunito), 'Nunito', sans-serif", letterSpacing: 0.5, color: T.textTert }}>{m.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
