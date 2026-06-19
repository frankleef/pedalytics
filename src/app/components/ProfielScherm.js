"use client";
import { T } from "../designTokens";

const ZONE_KLEUREN = ["oklch(0.82 0.05 245)", "oklch(0.70 0.12 240)", "oklch(0.72 0.13 165)", "oklch(0.74 0.13 70)", "oklch(0.62 0.14 30)"];
const ZONE_NAMEN = ["Herstel", "Duur", "Tempo", "Drempel", "VO2max"];

function bouwPowerZones(ftp) {
  const grenzen = [0.55, 0.75, 0.90, 1.05].map(p => Math.round(ftp * p));
  const pct = ["< 55%", "56–75%", "76–90%", "91–105%", "106%+"];
  const ranges = [
    `< ${grenzen[0]} W`, `${grenzen[0]}–${grenzen[1]} W`, `${grenzen[1] + 1}–${grenzen[2]} W`,
    `${grenzen[2] + 1}–${grenzen[3]} W`, `${grenzen[3] + 1}+ W`,
  ];
  return ZONE_NAMEN.map((naam, i) => ({ z: `Z${i + 1}`, naam, pct: pct[i], range: ranges[i], color: ZONE_KLEUREN[i] }));
}

function bouwHrZones(maxHr) {
  const grenzen = [0.68, 0.78, 0.85, 0.91].map(p => Math.round(maxHr * p));
  const pct = ["< 68%", "68–78%", "78–85%", "85–91%", "91%+"];
  const ranges = [
    `< ${grenzen[0]} bpm`, `${grenzen[0]}–${grenzen[1]} bpm`, `${grenzen[1] + 1}–${grenzen[2]} bpm`,
    `${grenzen[2] + 1}–${grenzen[3]} bpm`, `${grenzen[3] + 1}–${maxHr} bpm`,
  ];
  return ZONE_NAMEN.map((naam, i) => ({ z: `Z${i + 1}`, naam, pct: pct[i], range: ranges[i], color: ZONE_KLEUREN[i] }));
}

export default function ProfielScherm({ profiel, stravaAuth, onTerug, onUitloggen }) {
  const ftp = profiel?.ftp || 265;
  const gewicht = profiel?.gewicht || 90;
  const wkg = (ftp / gewicht).toFixed(1);
  const maxHr = profiel?.max_hr || 200;
  const lthr = profiel?.lt_hr || 184;
  const restHr = profiel?.hr_basislijn || 49;
  const hrv = profiel?.hrv_basislijn || 58;

  const powerZones = bouwPowerZones(ftp);
  const hrZones = bouwHrZones(maxHr);

  const diensten = [
    { naam: "intervals.icu", initiaal: "i", bg: "oklch(0.345 0.035 245)", kleur: "oklch(0.82 0.05 200)", verbonden: true, sub: "Trainingsdata & planning" },
    { naam: "Strava", initiaal: "S", bg: "oklch(0.345 0.035 245)", kleur: "oklch(0.82 0.08 60)", verbonden: !!stravaAuth, sub: stravaAuth ? "Automatisch importeren" : "Niet verbonden" },
    { naam: "Wahoo", initiaal: "W", bg: "oklch(0.96 0.012 84)", kleur: "oklch(0.62 0.02 75)", verbonden: false, sub: "Koppelen via intervals.icu" },
  ];

  const ZoneRij = ({ zone, isLaatste }) => (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0" }}>
        <div style={{ width: 4, height: 32, borderRadius: 3, background: zone.color, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ font: "700 14.5px var(--font-nunito), sans-serif", color: T.text }}>{zone.z} · {zone.naam}</span>
          <span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textTert }}>{zone.pct}</span>
        </div>
        <span style={{ font: "600 16px var(--font-fredoka), sans-serif", color: "oklch(0.32 0.02 70)", whiteSpace: "nowrap" }}>{zone.range}</span>
      </div>
      {!isLaatste && <div style={{ height: 1, background: T.divider }} />}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, color: T.text, fontFamily: T.font, zIndex: 100, overflowY: "auto" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `4px ${T.pad}px 28px` }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={onTerug} aria-label="Terug"
            style={{ width: 40, height: 40, padding: 0, border: `1px solid ${T.divider}`, borderRadius: "50%", background: T.cardBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(60,45,20,0.04)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="oklch(0.32 0.02 70)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert }}>PROFIEL</span>
          <div style={{ width: 40, height: 40 }} />
        </div>

        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 13, marginBottom: 22 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", font: "700 36px var(--font-fredoka), sans-serif", color: "#fff", boxShadow: "0 8px 22px rgba(40,90,140,0.30)" }}>F</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ font: "800 24px var(--font-nunito), sans-serif", letterSpacing: -0.4, color: T.text }}>Frank</span>
            <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>Eerste seizoen · 2026</span>
          </div>
        </div>

        {/* W/kg card */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "22px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert }}>VERMOGEN-GEWICHT</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ font: "600 56px var(--font-fredoka), sans-serif", lineHeight: 0.9, color: T.text }}>{wkg}</span>
              <span style={{ font: "700 17px var(--font-nunito), sans-serif", color: T.textSec }}>W/kg</span>
            </div>
            <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>Berekend uit FTP & gewicht</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
              <span style={{ font: "600 22px var(--font-fredoka), sans-serif", color: "oklch(0.34 0.02 70)" }}>{ftp}<span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>w</span></span>
              <span style={{ font: "700 10.5px var(--font-nunito), sans-serif", letterSpacing: 0.4, color: T.textTert }}>FTP</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
              <span style={{ font: "600 22px var(--font-fredoka), sans-serif", color: "oklch(0.34 0.02 70)" }}>{gewicht}<span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>kg</span></span>
              <span style={{ font: "700 10.5px var(--font-nunito), sans-serif", letterSpacing: 0.4, color: T.textTert }}>GEWICHT</span>
            </div>
          </div>
        </div>

        {/* Hartslaggegevens */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert }}>HARTSLAGGEGEVENS</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            {[
              { label: "Max HR", value: maxHr, unit: "bpm" },
              { label: "LTHR · drempel", value: lthr, unit: "bpm" },
              { label: "Rustpols · baseline", value: restHr, unit: "bpm" },
              { label: "HRV · baseline", value: hrv, unit: "ms" },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "14px 15px", borderRadius: T.tileRadius, background: T.subtleFill }}>
                <span style={{ font: "600 27px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{m.value}<span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}> {m.unit}</span></span>
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vermogenszones */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 14px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert }}>VERMOGENSZONES</span>
            <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>FTP {ftp}W</span>
          </div>
          {powerZones.map((z, i) => <ZoneRij key={i} zone={z} isLaatste={i === 4} />)}
        </div>

        {/* Hartslagzones */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 14px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert }}>HARTSLAGZONES</span>
            <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>Max {maxHr} bpm</span>
          </div>
          {hrZones.map((z, i) => <ZoneRij key={i} zone={z} isLaatste={i === 4} />)}
        </div>

        {/* Gekoppelde diensten */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 16px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert }}>GEKOPPELDE DIENSTEN</span>
          {diensten.map((d, i) => (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, padding: `${i === 0 ? 14 : 13}px 0 ${i === diensten.length - 1 ? 0 : 13}px` }}>
                <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 13, background: d.bg, border: d.verbonden ? "none" : `1px solid ${T.divider}`, display: "flex", alignItems: "center", justifyContent: "center", font: "700 16px var(--font-fredoka), sans-serif", color: d.kleur }}>{d.initiaal}</div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ font: "700 14.5px var(--font-nunito), sans-serif", color: d.verbonden ? T.text : "oklch(0.42 0.02 72)" }}>{d.naam}</span>
                  <span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textTert }}>{d.sub}</span>
                </div>
                {d.verbonden ? (
                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: "oklch(0.93 0.05 165)" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "oklch(0.6 0.13 165)" }} />
                    <span style={{ font: "800 11px var(--font-nunito), sans-serif", color: "oklch(0.45 0.13 162)" }}>Verbonden</span>
                  </div>
                ) : (
                  <span style={{ flexShrink: 0, font: "800 12px var(--font-nunito), sans-serif", color: T.textSec, padding: "8px 15px", borderRadius: 999, border: "1.5px solid oklch(0.86 0.014 80)" }}>Koppelen</span>
                )}
              </div>
              {i < diensten.length - 1 && <div style={{ height: 1, background: T.divider }} />}
            </div>
          ))}
        </div>

        {/* Uitloggen */}
        <button onClick={onUitloggen}
          style={{ width: "100%", border: "1px solid oklch(0.88 0.04 28)", borderRadius: 20, background: "oklch(0.98 0.015 30)", cursor: "pointer", padding: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 12H3m0 0l3.5-3.5M3 12l3.5 3.5" stroke="oklch(0.55 0.16 28)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ font: "800 14.5px var(--font-nunito), sans-serif", color: "oklch(0.55 0.16 28)" }}>Uitloggen</span>
        </button>
      </div>
    </div>
  );
}
