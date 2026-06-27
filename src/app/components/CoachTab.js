"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import SharedHeader from "./SharedHeader";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";

export default function CoachTab({ seizoensplan, onOpenProfiel }) {
  const [bericht, setBericht] = useState(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    fetch("/api/coach/dagelijks")
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setBericht(d.data); })
      .catch(() => setBericht({ error: true }))
      .finally(() => setLaden(false));
  }, []);

  const FASE_NAMEN = { basis: "Opbouw", sweetspot: "Sweetspot", drempel: "Drempel", consolidatie: "Consolidatie", test: "Testweek", herstel: "Herstel" };
  const seizoenStart = seizoensplan?.startdatum ? new Date(seizoensplan.startdatum) : null;
  const weekNr = seizoenStart && seizoensplan?.startdatum ? weeknummerVoorDatum(new Date(), seizoensplan.startdatum) : null;
  const totaalWeken = seizoensplan?.tijdshorizon_weken || seizoensplan?.kader?.length || null;
  const huidigeFase = weekNr && seizoensplan?.kader ? seizoensplan.kader.find(w => w.week === weekNr) || seizoensplan.kader[seizoensplan.kader.length - 1] : null;
  const fase = huidigeFase ? (FASE_NAMEN[huidigeFase.fase] || huidigeFase.fase) : null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px`, display: "flex", flexDirection: "column", gap: 16 }}>

        <SharedHeader onAvatarClick={onOpenProfiel} />

        {laden && (
          <>
            <div style={{ background: "oklch(0.24 0.012 70)", borderRadius: 28, height: 130, opacity: 0.4, animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, height: 90, opacity: 0.6, animation: "pulse 1.5s ease-in-out infinite" }} />
            <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
          </>
        )}

        {!laden && bericht?.error && (
          <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "18px 20px" }}>
            <p style={{ font: "600 14px var(--font-nunito), sans-serif", color: "oklch(0.55 0.02 74)", margin: 0 }}>
              Je coaching-bericht is tijdelijk niet beschikbaar. Probeer het later opnieuw.
            </p>
          </div>
        )}

        {!laden && bericht && !bericht.error && (
          <>
            {/* Dagelijks bericht */}
            <div style={{
              background: "oklch(0.24 0.012 70)", borderRadius: 28, padding: "20px 20px",
              color: "oklch(0.96 0.008 80)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  font: "800 14px var(--font-fredoka), sans-serif", color: "white",
                }}>P</div>
                <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: "1.3px",
                  color: "oklch(0.7 0.015 75)", textTransform: "uppercase" }}>
                  JOUW COACH · VANDAAG
                </span>
              </div>
              <p style={{ font: "600 15px/1.65 var(--font-nunito), sans-serif", margin: 0, color: "oklch(0.93 0.008 80)" }}>
                {bericht.dagelijks_bericht}
              </p>
            </div>

            {/* Seizoensduiding */}
            {bericht.seizoensduiding && bericht.seizoensduiding.length > 0 && (
              <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "18px 20px" }}>
                <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: "1.3px",
                  color: "oklch(0.62 0.015 75)", textTransform: "uppercase" }}>
                  {fase ? `${fase.toUpperCase()} · ` : ""}WEEK {weekNr} VAN {totaalWeken}
                </span>
                <p style={{ font: "600 14px/1.55 var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 70)",
                  margin: "8px 0 12px" }}>
                  {bericht.seizoensduiding}
                </p>
                {weekNr && totaalWeken && (
                  <div style={{ height: 6, borderRadius: 3, background: "oklch(0.93 0.012 82)" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.min(100, (weekNr / totaalWeken) * 100)}%`,
                      background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                )}
              </div>
            )}

            {/* Aandachtspunten */}
            {bericht.aandachtspunten?.length > 0 && (
              <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "18px 20px" }}>
                <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: "1.3px",
                  color: "oklch(0.62 0.015 75)", textTransform: "uppercase" }}>
                  LET OP
                </span>
                {bericht.aandachtspunten.map((punt, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 15, lineHeight: 1.4, flexShrink: 0 }}>⚠️</span>
                    <p style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.02 70)", margin: 0 }}>
                      {punt}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
