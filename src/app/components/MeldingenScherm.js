"use client";
import { useEffect, useState } from "react";
import { T } from "../designTokens";

const CATEGORIE_KLEUREN = {
  sessie:   { bg: T.subtleFill,              tekst: T.textSec,             dot: T.textTert },
  week:     { bg: "oklch(0.93 0.03 235)",    tekst: "oklch(0.38 0.09 245)", dot: "oklch(0.5 0.09 248)" },
  seizoen:  { bg: T.accentBg,                 tekst: T.accentText,          dot: T.accent },
  metingen: { bg: "oklch(0.95 0.03 310)",    tekst: "oklch(0.48 0.1 310)",  dot: "oklch(0.6 0.1 310)" },
  systeem:  { bg: "oklch(0.95 0.04 55)",     tekst: "oklch(0.45 0.1 50)",   dot: "oklch(0.63 0.12 52)" },
};
// kritieke_rust is qua urgentie zwaarder dan een gewone sessie-melding — krijgt
// daarom de gedempt-rode kleur i.p.v. de neutrale sessie-kleur.
const KLEUR_KRITIEKE_RUST = { bg: "oklch(0.95 0.04 28)", tekst: "oklch(0.45 0.1 25)", dot: "oklch(0.58 0.11 28)" };

function kleurVoorMelding(melding) {
  if (melding.type === "kritieke_rust") return KLEUR_KRITIEKE_RUST;
  return CATEGORIE_KLEUREN[melding.categorie] || CATEGORIE_KLEUREN.sessie;
}

const CATEGORIE_ICOON = {
  sessie: (kleur) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="17.5" r="3.2" stroke={kleur} strokeWidth="2" />
      <circle cx="18" cy="17.5" r="3.2" stroke={kleur} strokeWidth="2" />
      <path d="M6 17.5 10 9h4l4 8.5M9.5 9h5" stroke={kleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  week: (kleur) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" stroke={kleur} strokeWidth="2" />
      <path d="M3.5 9h17M8 2.5v4M16 2.5v4" stroke={kleur} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  seizoen: (kleur) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 15l5-5 4 4 7-8" stroke={kleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  metingen: (kleur) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 12h4l2 7 4-14 2 7h6" stroke={kleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  systeem: (kleur) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke={kleur} strokeWidth="2" />
      <path d="M12 8v5" stroke={kleur} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill={kleur} />
    </svg>
  ),
};

const FILTER_PILLS = [
  { key: null, label: "Alles" },
  { key: "sessie", label: "Sessie" },
  { key: "week", label: "Week" },
  { key: "seizoen", label: "Seizoen" },
  { key: "metingen", label: "Metingen" },
];

function formatTijd(iso) {
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function begindagVanWeek(datum) {
  const d = new Date(datum);
  const offset = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function groepeerOpDag(meldingen) {
  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const weekStart = begindagVanWeek(new Date());
  const groepen = { "Vandaag": [], "Deze week": [], "Eerder": [] };
  for (const m of meldingen) {
    const d = new Date(m.aangemaakt_op);
    const dDag = new Date(d); dDag.setHours(0, 0, 0, 0);
    if (dDag.getTime() === vandaag.getTime()) groepen["Vandaag"].push(m);
    else if (d >= weekStart) groepen["Deze week"].push(m);
    else groepen["Eerder"].push(m);
  }
  return Object.entries(groepen).filter(([, lijst]) => lijst.length > 0);
}

function MeldingKaart({ melding, onTik }) {
  const kleur = kleurVoorMelding(melding);
  return (
    <button onClick={() => onTik(melding)} style={{
      display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left",
      background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: T.tileRadius,
      padding: "13px 14px", cursor: "pointer",
    }}>
      <div style={{ flex: "none", width: 36, height: 36, borderRadius: "50%", background: kleur.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {(CATEGORIE_ICOON[melding.categorie] || CATEGORIE_ICOON.sessie)(kleur.tekst)}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {!melding.gelezen && <span style={{ flex: "none", width: 7, height: 7, borderRadius: "50%", background: kleur.dot }} />}
          <span style={{ font: "800 13.5px var(--font-nunito), sans-serif", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{melding.titel}</span>
        </div>
        <span style={{ font: "500 12.5px/1.4 var(--font-nunito), sans-serif", color: T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{melding.tekst}</span>
      </div>
      <span style={{ flex: "none", font: "600 11px var(--font-nunito), sans-serif", color: T.textTert }}>{formatTijd(melding.aangemaakt_op)}</span>
    </button>
  );
}

function DetailSheet({ melding, onSluiten, onNavigeer }) {
  const kleur = kleurVoorMelding(melding);
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom, 0px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onSluiten(); }}
    >
      <div style={{
        width: "100%", maxWidth: 540, maxHeight: "82vh", overflowY: "auto",
        background: T.cardBg, borderRadius: "28px 28px 0 0",
        padding: "10px 22px calc(24px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: T.divider, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: kleur.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {(CATEGORIE_ICOON[melding.categorie] || CATEGORIE_ICOON.sessie)(kleur.tekst)}
          </div>
          <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: kleur.tekst, textTransform: "uppercase" }}>{melding.categorie}</span>
        </div>
        <h2 style={{ margin: "0 0 10px", font: "800 20px var(--font-nunito), sans-serif", color: T.text }}>{melding.titel}</h2>
        <p style={{ margin: "0 0 16px", font: "500 14px/1.55 var(--font-nunito), sans-serif", color: T.textSec }}>{melding.tekst}</p>
        <span style={{ display: "block", marginBottom: 18, font: "600 11px var(--font-nunito), sans-serif", color: T.textTert }}>
          {formatTijd(melding.aangemaakt_op)} · {melding.bron}
        </span>
        {melding.deeplink && (
          <button
            onClick={() => { onNavigeer(melding.deeplink); onSluiten(); }}
            style={{ width: "100%", border: "none", borderRadius: T.pillRadius, background: T.slate, color: "#f7f3eb", padding: "13px 0", font: "700 14px var(--font-nunito), sans-serif", cursor: "pointer" }}>
            Bekijken
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Meldingencentrum: volledig-scherm overlay (zelfde patroon als ProfielScherm —
 * sluiten via history.back(), niet zelf history manipuleren) met filter-pills,
 * op-dag-gegroepeerde lijst en een detail-bottom-sheet per melding.
 *
 * @param {() => void} onTerug
 * @param {(deeplink: string) => void} onNavigeer - vertaalt een deeplink naar
 *   client-side tab-navigatie (er bestaan geen /schema,/voortgang,/profiel-routes)
 */
export default function MeldingenScherm({ onTerug, onNavigeer }) {
  const [meldingen, setMeldingen] = useState(null);
  const [filter, setFilter] = useState(null);
  const [detailMelding, setDetailMelding] = useState(null);

  useEffect(() => {
    fetch("/api/meldingen").then(r => r.json()).then(d => {
      if (d.success) setMeldingen(d.data);
    }).catch(() => setMeldingen([]));
  }, []);

  function markeerGelezen(id) {
    setMeldingen(prev => prev?.map(m => m.id === id ? { ...m, gelezen: true } : m) ?? prev);
    fetch(`/api/meldingen/${id}/lezen`, { method: "POST" }).catch(() => {});
  }

  function allesGelezen() {
    setMeldingen(prev => prev?.map(m => ({ ...m, gelezen: true })) ?? prev);
    fetch("/api/meldingen/alles-lezen", { method: "POST" }).catch(() => {});
  }

  function tikMelding(melding) {
    if (!melding.gelezen) markeerGelezen(melding.id);
    setDetailMelding(melding);
  }

  const gefilterd = (meldingen || []).filter(m => !filter || m.categorie === filter);
  const groepen = groepeerOpDag(gefilterd);
  const heeftOngelezen = (meldingen || []).some(m => !m.gelezen);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, color: T.text, fontFamily: T.font, zIndex: 100, overflowY: "auto" }}>
      <div style={{ padding: `${T.statusBarH}px ${T.pad}px 40px` }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onTerug} aria-label="Terug" style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke={T.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span style={{ font: "700 20px var(--font-nunito), sans-serif", color: T.text }}>Meldingen</span>
          </div>
          {heeftOngelezen && (
            <button onClick={allesGelezen} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", font: "700 12.5px var(--font-nunito), sans-serif", color: T.accentText }}>
              Alles gelezen
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18, paddingBottom: 2 }}>
          {FILTER_PILLS.map(p => {
            const actief = filter === p.key;
            return (
              <button key={p.label} onClick={() => setFilter(p.key)} style={{
                flex: "none", border: `1.5px solid ${actief ? T.slate : T.cardBorder}`, borderRadius: T.pillRadius,
                background: actief ? T.slate : T.cardBg, color: actief ? "#f7f3eb" : T.textSec,
                padding: "7px 15px", font: "700 12.5px var(--font-nunito), sans-serif", cursor: "pointer",
              }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {meldingen === null && (
          <div style={{ textAlign: "center", padding: "40px 0", color: T.textTert, font: "600 13px var(--font-nunito), sans-serif" }}>Laden…</div>
        )}
        {meldingen !== null && gefilterd.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: T.textTert, font: "600 13px var(--font-nunito), sans-serif" }}>Nog geen meldingen.</div>
        )}

        {groepen.map(([label, lijst]) => (
          <div key={label} style={{ marginBottom: 22 }}>
            <span style={{ display: "block", marginBottom: 10, font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>{label}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lijst.map(m => <MeldingKaart key={m.id} melding={m} onTik={tikMelding} />)}
            </div>
          </div>
        ))}
      </div>

      {detailMelding && (
        <DetailSheet melding={detailMelding} onSluiten={() => setDetailMelding(null)} onNavigeer={onNavigeer} />
      )}
    </div>
  );
}
