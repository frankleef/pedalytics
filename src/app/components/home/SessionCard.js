"use client";
import { useState } from "react";
import { T } from "../../designTokens";
import WorkoutViz from "../WorkoutViz";

export default function SessionCard({ sessie, ftp, onOpen, beschikbaar, weer, weerForecast }) {
  const [waaromOpen, setWaaromOpen] = useState(false);
  if (!sessie) return null;

  const dagVolgorde = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
  const dagKort = ["M","D","W","D","V","Z","Z"];
  const vandaagIdx = new Date().getDay();
  const vandaagDagIdx = vandaagIdx === 0 ? 6 : vandaagIdx - 1;
  const sessieDagIdx = dagVolgorde.indexOf(sessie.dag);
  const isVandaag = sessieDagIdx === vandaagDagIdx;
  const dagLabel = isVandaag ? "Vandaag" : sessie.dag;

  const heeftSegmenten = sessie.segmenten && sessie.segmenten.length > 0;
  const heeftProtocol = !!sessie.protocol;
  const duurStr = sessie.duur_min ? `${Math.floor(sessie.duur_min / 60)}u ${String(sessie.duur_min % 60).padStart(2, "0")}m` : null;
  const waaromTekst = sessie.waarom_vandaag || sessie.reden;

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
        {(() => {
          const dagWeer = sessie.datum && weerForecast?.[sessie.datum] ? weerForecast[sessie.datum] : weer;
          if (!dagWeer) return null;
          const t = dagWeer.temp;
          const c = dagWeer.conditie || "";
          const w = dagWeer.wind;
          const icoon = t <= 5 ? "🥶" : t >= 28 ? "🔥" : /regen|buien|motregen/i.test(c) ? "🌧️" : /bewolkt/i.test(c) ? "☁️" : /mistig|rijp/i.test(c) ? "🌫️" : /onweer/i.test(c) ? "⛈️" : /sneeuw/i.test(c) ? "❄️" : /helder/i.test(c) ? "☀️" : "⛅";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>{icoon} {t}°</span>
              <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>💨 {w} km/u</span>
            </div>
          );
        })()}
      </div>

      {/* Klikbare titel */}
      <h2 onClick={() => onOpen?.(sessie)}
        style={{ margin: "2px 0 12px", font: "700 21px var(--font-nunito), sans-serif", letterSpacing: -0.2, color: T.text, cursor: "pointer" }}>
        {sessie.titel}
      </h2>

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
      </div>

      {/* Workout viz */}
      {heeftProtocol ? (
        <div style={{ background: T.subtleFill, borderRadius: T.tileRadius, padding: 14 }}>
          {[
            ["Warming-up", sessie.protocol.warmup],
            ["Ramp", sessie.protocol.ramp],
            ["Cooldown", sessie.protocol.cooldown],
          ].filter(([, fase]) => fase).map(([label, fase], i) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 0", borderTop: i > 0 ? `1px solid ${T.divider}` : "none",
            }}>
              <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.text, flexShrink: 0, marginRight: 12 }}>{label}</span>
              <span style={{ font: "600 11.5px/1.4 var(--font-nunito), sans-serif", color: T.textSec, textAlign: "right" }}>
                {fase.omschrijving}
              </span>
            </div>
          ))}
        </div>
      ) : heeftSegmenten ? (
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

      {/* Waarom vandaag — uitklapbaar */}
      {waaromTekst && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid oklch(0.91 0.012 82)` }}>
          <button onClick={() => setWaaromOpen(!waaromOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>
            {waaromOpen ? "Waarom vandaag ▲" : "Waarom vandaag ▼"}
          </button>
          {waaromOpen && (
            <p style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", margin: "6px 0 0" }}>{waaromTekst}</p>
          )}
        </div>
      )}
    </div>
  );
}
