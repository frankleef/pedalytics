"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import { berekenLangeRitMinimumMin } from "@/lib/langeRit";
import { bepaalMinimumUrenVariant, berekenStreefUrenSuggestie } from "./beschikbaarheidMinimum";
import { berekenGemiddeldeUrenPerWeek } from "@/lib/rijhistorie";
import { getMaandagVanWeek } from "@/lib/weekgrenzen";

// "Laatste 6 volledige weken" — 12 maanden bleek te verdunnend bij een atleet
// in opbouw (zie project-memory, diagnose-chunk).
const HISTORIE_WEKEN = 6;

const DAGEN = [
  { key: "Ma", full: "Maandag" },
  { key: "Di", full: "Dinsdag" },
  { key: "Wo", full: "Woensdag" },
  { key: "Do", full: "Donderdag" },
  { key: "Vr", full: "Vrijdag" },
  { key: "Za", full: "Zaterdag" },
  { key: "Zo", full: "Zondag" },
];

function fmtTijd(uren) {
  const heleUren = Math.floor(uren);
  const minuten = Math.round((uren - heleUren) * 60);
  return `${heleUren}:${String(minuten).padStart(2, "0")}`;
}

export default function BeschikbaarheidEditor({ initieel, onWijzig, weekTssDoel, fase, seizoensdoelType, ervaringsniveau, onStreefUrenGewijzigd }) {
  const [streefUren, setStreefUren] = useState(() => initieel?.streefUrenPerWeek ?? "");
  const [suggestieUren, setSuggestieUren] = useState(null);

  // Historische suggestie — alléén bij eerste gebruik (geen bestaand
  // streefUrenPerWeek op het plan), eenmalig bij mount. Zodra de gebruiker
  // een waarde heeft opgeslagen, bestaat initieel.streefUrenPerWeek al bij de
  // volgende render en wordt dit blok overgeslagen — nooit stilzwijgend
  // overschrijven.
  useEffect(() => {
    if (initieel?.streefUrenPerWeek != null) return;
    let actief = true;

    const laatsteVolledigeZondag = getMaandagVanWeek(new Date());
    laatsteVolledigeZondag.setDate(laatsteVolledigeZondag.getDate() - 1);
    const oudsteMaandag = new Date(laatsteVolledigeZondag);
    oudsteMaandag.setDate(oudsteMaandag.getDate() - (HISTORIE_WEKEN * 7 - 1));

    const oldest = oudsteMaandag.toISOString().slice(0, 10);
    const newest = laatsteVolledigeZondag.toISOString().slice(0, 10);

    fetch(`/api/intervals/activities?oldest=${oldest}&newest=${newest}`)
      .then(r => r.json())
      .then(d => {
        if (!actief || !d.success || !d.data) return;
        const gemiddelde = berekenGemiddeldeUrenPerWeek(d.data);
        const suggestie = berekenStreefUrenSuggestie(gemiddelde);
        if (suggestie == null) return;
        setSuggestieUren(suggestie);
        setStreefUren(prev => {
          if (prev !== "") return prev;
          onStreefUrenGewijzigd?.(suggestie);
          return suggestie;
        });
      })
      .catch(() => {});

    return () => { actief = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wijzigStreefUren = (waarde) => {
    setStreefUren(waarde);
    onStreefUrenGewijzigd?.(waarde === "" ? null : waarde);
  };

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

  const setUren = (i, value, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    setDays(prev => {
      const next = prev.map((d, j) => j === i ? { ...d, hours: value } : d);
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

  const minimumUren = streefUren === "" ? null : streefUren;
  const minimumUrenVariant = bepaalMinimumUrenVariant(total, minimumUren);

  const langeRitMinimumMin = weekTssDoel != null
    ? berekenLangeRitMinimumMin(seizoensdoelType, fase, ervaringsniveau)
    : null;
  const langsteActieveDagUren = active.length ? Math.max(...active.map(d => d.hours)) : 0;
  const toontLangeRitWaarschuwing = langeRitMinimumMin != null && langsteActieveDagUren * 60 < langeRitMinimumMin;

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
            {/* Hours slider */}
            {day.on && (
              <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${T.cardBorder}` }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>Beschikbare tijd</span>
                  <span style={{ font: "600 18px var(--font-fredoka), sans-serif", color: T.text }}>{fmtTijd(day.hours)} uur</span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={6}
                  step={0.25}
                  value={day.hours}
                  onChange={(e) => setUren(i, parseFloat(e.target.value), e)}
                  style={{ width: "100%", accentColor: T.slate, cursor: "pointer" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "0 4px" }}>
        <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>{active.length} trainingsdagen</span>
        <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text }}>{fmtTijd(total)} uur / week</span>
      </div>

      {/* Streefuren per week */}
      <div style={{ marginTop: 16, padding: "14px 16px", background: T.cardBg, borderRadius: 20, border: `1px solid ${T.cardBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.text }}>Streefuren per week</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              min={0}
              step={0.5}
              value={streefUren}
              onChange={(e) => wijzigStreefUren(e.target.value === "" ? "" : parseFloat(e.target.value))}
              placeholder="—"
              style={{ width: 64, padding: "8px 10px", borderRadius: 10, border: `1px solid ${T.cardBorder}`, font: "600 15px var(--font-fredoka), sans-serif", color: T.text, textAlign: "center" }}
            />
            <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>uur</span>
          </div>
        </div>
        {suggestieUren != null && streefUren === suggestieUren && (
          <div style={{ marginTop: 6, font: "600 11.5px/1.4 var(--font-nunito), sans-serif", color: T.textTert }}>
            Suggestie op basis van je laatste {HISTORIE_WEKEN} weken (+ marge) — pas gerust aan.
          </div>
        )}
      </div>

      {minimumUrenVariant === "waarschuwing" && (
        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 14, background: "oklch(0.96 0.03 70)", border: "1px solid oklch(0.85 0.06 65)" }}>
          <span style={{ font: "600 12.5px/1.4 var(--font-nunito), sans-serif", color: "oklch(0.42 0.1 55)" }}>
            Je hebt deze week minder tijd ingepland dan je streefdoel (± {fmtTijd(minimumUren)} uur nodig).
          </span>
        </div>
      )}

      {minimumUrenVariant === "richtlijn" && (
        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 14, background: T.subtleFill, border: `1px solid ${T.cardBorder}` }}>
          <span style={{ font: "600 12.5px/1.4 var(--font-nunito), sans-serif", color: T.textSec }}>
            Richtlijn: ± {fmtTijd(minimumUren)} uur deze week — dat haal je.
          </span>
        </div>
      )}

      {toontLangeRitWaarschuwing && (
        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 14, background: "oklch(0.96 0.03 70)", border: "1px solid oklch(0.85 0.06 65)" }}>
          <span style={{ font: "600 12.5px/1.4 var(--font-nunito), sans-serif", color: "oklch(0.42 0.1 55)" }}>
            Voor je huidige doel en fase is het ideaal om minstens één dag met ± {fmtTijd(langeRitMinimumMin / 60)} uur beschikbaar te hebben voor een lange rit.
          </span>
        </div>
      )}
    </div>
  );
}
