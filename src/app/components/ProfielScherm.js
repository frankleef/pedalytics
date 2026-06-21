"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import ScaleInput from "./ScaleInput";

const ZONE_KLEUREN = [
  "oklch(0.82 0.05 245)", "oklch(0.70 0.12 240)", "oklch(0.72 0.13 165)",
  "oklch(0.74 0.13 70)", "oklch(0.62 0.14 30)", "oklch(0.55 0.15 350)", "oklch(0.50 0.12 310)",
];

const NL_POWER_NAMEN = { "Active Recovery": "Herstel", "Endurance": "Duur", "Tempo": "Tempo", "Threshold": "Drempel", "VO2 Max": "VO2max", "Anaerobic": "Anaeroob", "Neuromuscular": "Neuromusculair" };
const NL_HR_NAMEN = { "Recovery": "Herstel", "Aerobic": "Aeroob", "Tempo": "Tempo", "SubThreshold": "Subdrempel", "SuperThreshold": "Superdrempel", "Aerobic Capacity": "Aerobe cap.", "Anaerobic": "Anaeroob" };

function bouwPowerZones(ftp, zones, namen) {
  if (!zones || zones.length === 0) return [];
  return zones.map((grens, i) => {
    const vorige = i === 0 ? 0 : zones[i - 1];
    const minW = Math.round(ftp * vorige / 100);
    const maxW = grens >= 999 ? null : Math.round(ftp * grens / 100);
    const naam = namen?.[i] ? (NL_POWER_NAMEN[namen[i]] || namen[i]) : `Zone ${i + 1}`;
    return {
      z: `Z${i + 1}`, naam,
      pct: maxW ? `${vorige}–${grens}%` : `${vorige}%+`,
      range: maxW ? `${minW}–${maxW} W` : `${minW}+ W`,
      color: ZONE_KLEUREN[i] || ZONE_KLEUREN[ZONE_KLEUREN.length - 1],
    };
  });
}

function bouwHrZones(hrZones, namen) {
  if (!hrZones || hrZones.length === 0) return [];
  return hrZones.map((grens, i) => {
    const vorige = i === 0 ? 0 : hrZones[i - 1];
    const naam = namen?.[i] ? (NL_HR_NAMEN[namen[i]] || namen[i]) : `Zone ${i + 1}`;
    return {
      z: `Z${i + 1}`, naam,
      pct: vorige > 0 ? `${vorige}–${grens} bpm` : `< ${grens} bpm`,
      range: `${vorige || "0"}–${grens} bpm`,
      color: ZONE_KLEUREN[i] || ZONE_KLEUREN[ZONE_KLEUREN.length - 1],
    };
  });
}

const STEDEN = [
  { stad: "Breda", lat: 51.59, lon: 4.78 },
  { stad: "Amsterdam", lat: 52.37, lon: 4.90 },
  { stad: "Rotterdam", lat: 51.92, lon: 4.48 },
  { stad: "Utrecht", lat: 52.09, lon: 5.12 },
  { stad: "Den Haag", lat: 52.08, lon: 4.30 },
  { stad: "Eindhoven", lat: 51.44, lon: 5.47 },
  { stad: "Tilburg", lat: 51.56, lon: 5.09 },
  { stad: "Groningen", lat: 53.22, lon: 6.57 },
  { stad: "Maastricht", lat: 50.85, lon: 5.69 },
  { stad: "Arnhem", lat: 51.98, lon: 5.91 },
];

export default function ProfielScherm({ profiel, onTerug, onUitloggen }) {
  const [checkin, setCheckin] = useState(null);
  const [weerStad, setWeerStad] = useState("Breda");

  useEffect(() => {
    fetch("/api/checkin").then(r => r.json()).then(d => {
      if (d.success && d.data) setCheckin(d.data.score);
    }).catch(() => {});
    fetch("/api/weer").then(r => r.json()).then(d => {
      if (d.success && d.data?.stad) setWeerStad(d.data.stad);
    }).catch(() => {});
  }, []);

  const ftp = profiel?.ftp || 265;
  const gewicht = profiel?.gewicht || 90;
  const wkg = (ftp / gewicht).toFixed(1);
  const maxHr = profiel?.max_hr || 200;
  const lthr = profiel?.lt_hr || 184;
  const restHr = profiel?.resting_hr ? Math.round(profiel.resting_hr) : (profiel?.hr_basislijn ? Math.round(profiel.hr_basislijn) : 49);
  const hrv = profiel?.hrv_basislijn || 58;

  const powerZones = bouwPowerZones(ftp, profiel?.power_zones, profiel?.power_zone_names);
  const hrZones = bouwHrZones(profiel?.hr_zones, profiel?.hr_zone_names);

  const diensten = [
    { naam: "intervals.icu", initiaal: "i", bg: "oklch(0.345 0.035 245)", kleur: "oklch(0.82 0.05 200)", verbonden: true, sub: "Trainingsdata & planning" },
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
          {powerZones.map((z, i) => <ZoneRij key={i} zone={z} isLaatste={i === powerZones.length - 1} />)}
        </div>

        {/* Hartslagzones */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 14px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert }}>HARTSLAGZONES</span>
            <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>Max {maxHr} bpm</span>
          </div>
          {hrZones.map((z, i) => <ZoneRij key={i} zone={z} isLaatste={i === hrZones.length - 1} />)}
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

        {/* Koppeling intrekken */}
        <button onClick={async () => {
          if (!confirm("Weet je zeker dat je de intervals.icu-koppeling wilt intrekken? De app stopt met het ophalen van nieuwe gezondheidsgegevens.")) return;
          await fetch("/api/onboarding/toestemming", { method: "DELETE" });
          window.location.href = "/onboarding";
        }}
          style={{ width: "100%", padding: "13px 16px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "transparent", cursor: "pointer", font: "700 13px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 16, textAlign: "center" }}>
          Intervals.icu-koppeling intrekken
        </button>

        {/* Weer-locatie */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, display: "block", marginBottom: 14 }}>WEER-LOCATIE</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STEDEN.map(s => (
              <button key={s.stad} onClick={() => {
                setWeerStad(s.stad);
                fetch("/api/weer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
              }}
                style={{
                  padding: "7px 14px", borderRadius: T.pillRadius, cursor: "pointer",
                  font: "700 12.5px var(--font-nunito), sans-serif",
                  ...(s.stad === weerStad
                    ? { background: T.slate, color: "oklch(0.97 0.01 84)", border: "none" }
                    : { background: "transparent", border: "1.5px solid oklch(0.86 0.014 80)", color: "oklch(0.42 0.02 72)" }),
                }}>
                {s.stad}
              </button>
            ))}
          </div>
        </div>

        {/* Gevoel vandaag */}
        <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, display: "block", marginBottom: 14 }}>GEVOEL VANDAAG</span>
          <ScaleInput
            value={checkin || 0}
            max={5}
            question={checkin ? null : "Hoe voel je je vandaag?"}
            leftLabel="Slecht"
            rightLabel="Top"
            onChange={(val) => {
              setCheckin(val);
              fetch("/api/checkin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: val }) });
            }}
          />
          {checkin && <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)", marginTop: 10 }}>Tik opnieuw om aan te passen</div>}
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
