"use client";
import { T } from "../designTokens";

export const SEIZOENSDUUR_MIN = 13;
export const SEIZOENSDUUR_MAX = 20;

/**
 * Berekent de auto-suggestie voor seizoensduur: relatief aan de evenementdatum
 * bij "uithoudingsvermogen" (enige doel met event_datum), anders een vaste
 * middenwaarde. Geclamped naar [SEIZOENSDUUR_MIN, SEIZOENSDUUR_MAX].
 */
export function berekenSuggestieWeken(doel, eventDatum) {
  if (doel === "uithoudingsvermogen" && eventDatum) {
    const dagenTotEvenement = Math.round((new Date(eventDatum) - new Date()) / 86400000);
    const wekenTotEvenement = Math.round(dagenTotEvenement / 7);
    const suggestie = Math.max(SEIZOENSDUUR_MIN, Math.min(SEIZOENSDUUR_MAX, wekenTotEvenement));
    const hint = wekenTotEvenement < SEIZOENSDUUR_MIN
      ? `Je hebt minder dan ${SEIZOENSDUUR_MIN} weken tot je evenement — we plannen een volledig plan van ${SEIZOENSDUUR_MIN} weken`
      : "Gebaseerd op je evenementdatum";
    return { suggestie, hint };
  }
  return { suggestie: 16, hint: "Gemiddelde planlengte — pas aan als je een voorkeur hebt" };
}

export default function SeizoensduurStepper({ weken, onWijzig, hint }) {
  const bump = (delta) => {
    onWijzig(Math.max(SEIZOENSDUUR_MIN, Math.min(SEIZOENSDUUR_MAX, weken + delta)));
  };
  const aanMin = weken <= SEIZOENSDUUR_MIN;
  const aanMax = weken >= SEIZOENSDUUR_MAX;

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "18px 20px", border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.textSec }}>Seizoensduur</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button type="button" onClick={() => bump(-1)} disabled={aanMin}
            style={{ width: 34, height: 34, borderRadius: "50%", background: T.subtleFill, border: "1px solid oklch(0.9 0.012 82)", display: "flex", alignItems: "center", justifyContent: "center", cursor: aanMin ? "not-allowed" : "pointer", opacity: aanMin ? 0.4 : 1 }}>
            <div style={{ width: 13, height: 2.5, borderRadius: 2, background: "oklch(0.4 0.02 72)" }} />
          </button>
          <div style={{ minWidth: 84, textAlign: "center", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
            <span style={{ font: "600 26px var(--font-fredoka), sans-serif", color: T.text }}>{weken}</span>
            <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>weken</span>
          </div>
          <button type="button" onClick={() => bump(1)} disabled={aanMax}
            style={{ width: 34, height: 34, borderRadius: "50%", background: aanMax ? T.subtleFill : T.slate, display: "flex", alignItems: "center", justifyContent: "center", cursor: aanMax ? "not-allowed" : "pointer", position: "relative", opacity: aanMax ? 0.4 : 1 }}>
            <div style={{ width: 13, height: 2.5, borderRadius: 2, background: aanMax ? "oklch(0.4 0.02 72)" : "oklch(0.97 0.01 84)" }} />
            <div style={{ width: 2.5, height: 13, borderRadius: 2, background: aanMax ? "oklch(0.4 0.02 72)" : "oklch(0.97 0.01 84)", position: "absolute" }} />
          </button>
        </div>
      </div>
      {hint && (
        <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)", marginTop: 10 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
