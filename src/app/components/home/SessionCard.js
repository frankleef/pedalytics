"use client";
import { T } from "../../designTokens";
import WorkoutViz from "../WorkoutViz";

export default function SessionCard({ sessie, ftp, onOpen, beschikbaar }) {
  if (!sessie) return null;

  const dagVolgorde = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
  const dagKort = ["M","D","W","D","V","Z","Z"];
  const vandaagIdx = new Date().getDay();
  const vandaagDagIdx = vandaagIdx === 0 ? 6 : vandaagIdx - 1;
  const sessieDagIdx = dagVolgorde.indexOf(sessie.dag);
  const isVandaag = sessieDagIdx === vandaagDagIdx;
  const dagLabel = isVandaag ? "Vandaag" : sessie.dag;

  const heeftSegmenten = sessie.segmenten && sessie.segmenten.length > 0;
  const isInterval = sessie.type === "sweetspot" || sessie.type === "interval" || sessie.type === "ftp_test";
  const duurStr = sessie.duur_min ? `${Math.floor(sessie.duur_min / 60)}u ${String(sessie.duur_min % 60).padStart(2, "0")}m` : null;
  const blokken = sessie.segmenten?.filter(s => (s.vermogenMin ?? 0) > 80 && s.type !== "warmup" && s.type !== "cooldown").length;

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
      {/* Weekdots */}
      {beschikbaar && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 14 }}>
          {dagVolgorde.map((dag, i) => {
            const isTrain = !!beschikbaar[dag];
            const isHuidig = i === vandaagDagIdx;
            return (
              <div key={dag} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ font: "700 9px var(--font-nunito), sans-serif", color: T.textTert }}>{dagKort[i]}</span>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: isTrain ? T.gradient : "transparent",
                  border: isTrain ? "none" : `1.5px solid oklch(0.86 0.014 80)`,
                  boxShadow: isHuidig ? `0 0 0 2px ${T.slate}` : "none",
                }} />
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>{dagLabel} · Sessie</span>
        {ftp && <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>FTP {ftp}W</span>}
      </div>

      <h2 style={{ margin: "2px 0 12px", font: "700 21px var(--font-nunito), sans-serif", letterSpacing: -0.2, color: T.text }}>{sessie.titel}</h2>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 18, marginBottom: 18 }}>
        {duurStr && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: T.text }}>{duurStr}</span>
            <span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>Duur</span>
          </div>
        )}
        {sessie.tss && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: T.text }}>{sessie.tss}</span>
            <span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>TSS</span>
          </div>
        )}
        {isInterval && blokken > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: T.text }}>{blokken}</span>
            <span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>Blokken</span>
          </div>
        )}
      </div>

      {/* Workout viz */}
      {heeftSegmenten ? (
        <div style={{ background: T.subtleFill, borderRadius: T.tileRadius, padding: "12px 12px 10px" }}>
          <WorkoutViz segmenten={sessie.segmenten} hoogte={90} ftp={ftp} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11, paddingTop: 10, borderTop: `1px solid ${T.divider}` }}>
            {[["Z1", T.z1], ["Z2", T.z2], ["Z3", T.z3], ["Z4", T.z4], ["Z5", T.z5]].map(([l, k]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: k }} />
                <span style={{ font: "700 10.5px var(--font-nunito), sans-serif", color: T.textSec }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: T.subtleFill, borderRadius: T.tileRadius, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 48, borderRadius: 8, background: `linear-gradient(180deg, oklch(0.74 0.12 238), oklch(0.70 0.12 240))` }} />
          <span style={{ font: "600 12.5px/1.4 var(--font-nunito), sans-serif", color: T.textSec, width: 120 }}>
            Constante inspanning — bouw je aerobe basis op.
          </span>
        </div>
      )}

      {(sessie.reden || sessie.waarom_vandaag) && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid oklch(0.91 0.012 82)` }}>
          <span style={{ font: "800 10px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Waarom vandaag</span>
          <p style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", margin: "4px 0 0" }}>{sessie.waarom_vandaag || sessie.reden}</p>
        </div>
      )}

      <button onClick={() => onOpen?.(sessie)}
        style={{ marginTop: 16, width: "100%", border: "none", cursor: "pointer", padding: 15, borderRadius: T.pillRadius, background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 15px var(--font-nunito), sans-serif", letterSpacing: 0.2 }}>
        Start sessie
      </button>
    </div>
  );
}
