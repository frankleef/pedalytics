"use client";
import { useState } from "react";
import { T } from "../designTokens";

const DAGEN = [
  { key: "Ma", full: "Maandag" },
  { key: "Di", full: "Dinsdag" },
  { key: "Wo", full: "Woensdag" },
  { key: "Do", full: "Donderdag" },
  { key: "Vr", full: "Vrijdag" },
  { key: "Za", full: "Zaterdag" },
  { key: "Zo", full: "Zondag" },
];

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

export default function BeschikbaarheidEditor({ initieel, onWijzig }) {
  const [days, setDays] = useState(() =>
    DAGEN.map(d => ({
      ...d,
      on: initieel?.beschikbaar?.[d.full] || false,
      hours: initieel?.uren?.[d.full] || 1.5,
    }))
  );

  const toggle = (i) => {
    setDays(prev => {
      const next = prev.map((d, j) => j === i ? { ...d, on: !d.on } : d);
      onWijzig?.(toPersist(next));
      return next;
    });
  };

  const bump = (i, delta, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    setDays(prev => {
      const next = prev.map((d, j) => j === i ? { ...d, hours: Math.round(Math.max(0.5, Math.min(6, d.hours + delta)) * 2) / 2 } : d);
      onWijzig?.(toPersist(next));
      return next;
    });
  };

  const toPersist = (d) => ({
    beschikbaar: Object.fromEntries(d.filter(x => x.on).map(x => [x.full, true])),
    uren: Object.fromEntries(d.map(x => [x.full, x.hours])),
  });

  const active = days.filter(d => d.on);
  const total = active.reduce((a, d) => a + d.hours, 0);

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {days.map((day, i) => (
          <div key={day.key} onClick={() => toggle(i)}
            style={{ background: T.cardBg, borderRadius: 20, border: `1px solid ${T.cardBorder}`, boxShadow: "0 2px 10px rgba(60,45,20,0.04)", padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              {/* Indicator */}
              {day.on ? (
                <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: "50%", background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", font: "800 13px var(--font-nunito), sans-serif", color: "#fff", boxShadow: "0 4px 10px rgba(60,120,150,0.22)" }}>{day.key}</div>
              ) : (
                <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: "50%", background: T.subtleFill, border: "1.5px solid oklch(0.88 0.014 80)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 14, height: 3, borderRadius: 2, background: "oklch(0.68 0.015 75)" }} />
                </div>
              )}
              {/* Name + status */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ font: "700 16px var(--font-nunito), sans-serif", color: "oklch(0.3 0.02 70)" }}>{day.full}</span>
                {day.on ? (
                  <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)" }}>Trainingsdag</span>
                ) : (
                  <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textTert }}>Rustdag</span>
                )}
              </div>
              {/* Toggle */}
              <div style={{ width: 48, height: 28, flexShrink: 0, borderRadius: T.pillRadius, background: day.on ? T.slate : "oklch(0.88 0.014 80)", display: "flex", alignItems: "center", justifyContent: day.on ? "flex-end" : "flex-start", padding: 3 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.cardBg, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
            </div>
            {/* Hours stepper */}
            {day.on && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13, paddingTop: 13, borderTop: `1px solid ${T.cardBorder}` }}>
                <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>Beschikbare tijd</span>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button onClick={(e) => bump(i, -0.5, e)}
                    style={{ width: 34, height: 34, borderRadius: "50%", background: T.subtleFill, border: `1px solid oklch(0.9 0.012 82)`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <div style={{ width: 13, height: 2.5, borderRadius: 2, background: "oklch(0.4 0.02 72)" }} />
                  </button>
                  <div style={{ minWidth: 62, textAlign: "center", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
                    <span style={{ font: "600 22px var(--font-fredoka), sans-serif", color: T.text }}>{fmt(day.hours)}</span>
                    <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>uur</span>
                  </div>
                  <button onClick={(e) => bump(i, 0.5, e)}
                    style={{ width: 34, height: 34, borderRadius: "50%", background: T.slate, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                    <div style={{ width: 13, height: 2.5, borderRadius: 2, background: "oklch(0.97 0.01 84)" }} />
                    <div style={{ width: 2.5, height: 13, borderRadius: 2, background: "oklch(0.97 0.01 84)", position: "absolute" }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "0 4px" }}>
        <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>{active.length} trainingsdagen</span>
        <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text }}>{fmt(total)} uur / week</span>
      </div>
    </div>
  );
}
