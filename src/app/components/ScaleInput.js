"use client";
import { T } from "../designTokens";

export default function ScaleInput({ value, onChange, max = 5, question, leftLabel, rightLabel }) {
  const dense = max > 6;
  const gap = dense ? 7 : 11;
  const fontSize = dense ? 15 : 21;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {question && (
        <div style={{ font: "800 17px/1.3 var(--font-nunito), sans-serif", letterSpacing: -0.2, color: T.text, textWrap: "pretty" }}>{question}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap }}>
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          const isSel = n === value;
          return (
            <button key={n} onClick={() => onChange(n)}
              style={{
                flex: 1, aspectRatio: "1", padding: 0, borderRadius: "50%", cursor: "pointer",
                background: isSel ? T.gradient : T.subtleFill,
                border: isSel ? "1.5px solid transparent" : "1.5px solid oklch(0.88 0.014 80)",
                color: isSel ? "oklch(0.99 0.01 95)" : "oklch(0.52 0.02 74)",
                boxShadow: isSel ? "0 5px 14px rgba(60,120,150,0.30)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                font: `600 ${fontSize}px var(--font-fredoka), sans-serif`, lineHeight: 1,
                transition: "transform 0.12s ease, box-shadow 0.12s ease",
                WebkitTapHighlightColor: "transparent",
              }}>
              {n}
            </button>
          );
        })}
      </div>
      {(leftLabel || rightLabel) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: -3 }}>
          <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>{leftLabel}</span>
          <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
