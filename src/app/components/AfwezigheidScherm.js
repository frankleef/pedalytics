"use client";
import { useState, useEffect, useRef } from "react";
import { T } from "../designTokens";

const REDENEN = [
  { id: "ziek", icon: "🤒", naam: "Ziek" },
  { id: "vakantie", icon: "🌴", naam: "Vakantie" },
  { id: "anders", icon: "🗓️", naam: "Anders" },
];

function vandaagISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDatumLeesbaar(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

const REDEN_LABEL = Object.fromEntries(REDENEN.map(r => [r.id, r.naam]));

/**
 * Afwezigheid melden (nieuw) of een bestaande actieve periode beheren
 * (bewerken) — zelfde scherm, twee modi. Bewerk-modus toont geen invoerform,
 * alleen de huidige periode + sluiten/annuleren-acties (de backend kent geen
 * "wijzig datums/reden"-endpoint, alleen aanmaken/sluiten/annuleren).
 *
 * @param {"nieuw"|"bewerken"} modus
 * @param {object|null} periode - vereist bij modus="bewerken"
 * @param {() => void} onTerug
 * @param {() => void} onOpgeslagen - na succesvol aanmaken (modus="nieuw")
 * @param {() => void} onGesloten - na succesvol afsluiten (modus="bewerken", open-eind ziek)
 * @param {() => void} onGeannuleerd - na succesvol annuleren (modus="bewerken")
 */
export default function AfwezigheidScherm({ modus = "nieuw", periode = null, onTerug, onOpgeslagen, onGesloten, onGeannuleerd }) {
  const [reden, setReden] = useState(null);
  const [startDatum, setStartDatum] = useState(vandaagISO());
  const [eindDatum, setEindDatum] = useState(vandaagISO());
  const [openEinde, setOpenEinde] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fout, setFout] = useState(null);
  const [bezig, setBezig] = useState(false);
  const previewTimerRef = useRef(null);

  useEffect(() => {
    if (modus !== "nieuw") return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    if (!startDatum || (!openEinde && !eindDatum)) { setPreview(null); return; }
    previewTimerRef.current = setTimeout(() => {
      fetch("/api/afwezigheid/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDatum, eindDatum: openEinde ? null : eindDatum }),
      }).then(r => r.json()).then(d => { if (d.success) setPreview(d.data.aantal); }).catch(() => {});
    }, 350);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [modus, startDatum, eindDatum, openEinde]);

  async function bevestig() {
    setFout(null);
    setBezig(true);
    try {
      const resp = await fetch("/api/afwezigheid", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDatum, eindDatum: openEinde ? null : eindDatum, reden }),
      });
      const data = await resp.json();
      if (!resp.ok) { setFout(data); setBezig(false); return; }
      onOpgeslagen?.(data.data);
    } catch (e) {
      setFout({ error: "Opslaan mislukt — probeer het opnieuw." });
      setBezig(false);
    }
  }

  async function sluitPeriode() {
    setFout(null);
    setBezig(true);
    try {
      const resp = await fetch(`/api/afwezigheid/${periode.periodeId}/sluiten`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) { setFout(data); setBezig(false); return; }
      onGesloten?.(data.data);
    } catch (e) {
      setFout({ error: "Afsluiten mislukt — probeer het opnieuw." });
      setBezig(false);
    }
  }

  async function annuleerPeriode() {
    setFout(null);
    setBezig(true);
    try {
      const resp = await fetch(`/api/afwezigheid/${periode.periodeId}/annuleren`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) { setFout(data); setBezig(false); return; }
      onGeannuleerd?.(data.data);
    } catch (e) {
      setFout({ error: "Annuleren mislukt — probeer het opnieuw." });
      setBezig(false);
    }
  }

  const kanBevestigen = reden && startDatum && (openEinde || eindDatum);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, color: T.text, fontFamily: T.font, zIndex: 100, overflowY: "auto" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px`, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={onTerug} style={{ width: 42, height: 42, borderRadius: "50%", background: T.cardBg, border: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: T.text }}>‹</button>
          <span style={{ font: "700 16px var(--font-nunito), sans-serif", color: T.text }}>Afwezigheid</span>
          <div style={{ width: 42 }} />
        </div>

        {modus === "nieuw" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Afwezigheid</span>
              <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Even geen training?</h1>
              <p style={{ margin: 0, font: "600 14px/1.45 var(--font-nunito), sans-serif", color: T.textSec }}>Geen probleem — we passen je schema aan en helpen je rustig weer op te bouwen zodra je terug bent.</p>
            </div>

            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 8, display: "block" }}>Wat is de reden?</span>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {REDENEN.map(r => (
                <div key={r.id} onClick={() => setReden(r.id)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", background: T.cardBg,
                    border: `1.5px solid ${reden === r.id ? T.gradientA : T.cardBorder}`,
                    borderRadius: 18, cursor: "pointer", boxShadow: reden === r.id ? "0 2px 14px rgba(60,45,20,0.08)" : T.cardShadow }}>
                  <span style={{ fontSize: 26 }}>{r.icon}</span>
                  <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.text }}>{r.naam}</span>
                </div>
              ))}
            </div>

            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", border: `1px solid ${T.cardBorder}`, marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6, display: "block" }}>Vanaf</span>
                <input type="date" value={startDatum} onChange={e => setStartDatum(e.target.value)}
                  style={{ width: "100%", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 12, color: T.text, font: "600 14px var(--font-nunito), sans-serif", boxSizing: "border-box", outline: "none" }} />
              </div>

              {reden === "ziek" && (
                <div onClick={() => setOpenEinde(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>Ik weet nog niet hoe lang</span>
                  <div style={{ width: 48, height: 28, flexShrink: 0, borderRadius: T.pillRadius, background: openEinde ? T.slate : "oklch(0.88 0.014 80)", display: "flex", alignItems: "center", justifyContent: openEinde ? "flex-end" : "flex-start", padding: 3 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.cardBg, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </div>
                </div>
              )}

              {!openEinde && (
                <div>
                  <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6, display: "block" }}>Tot en met</span>
                  <input type="date" value={eindDatum} onChange={e => setEindDatum(e.target.value)} min={startDatum}
                    style={{ width: "100%", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 12, color: T.text, font: "600 14px var(--font-nunito), sans-serif", boxSizing: "border-box", outline: "none" }} />
                </div>
              )}

              {kanBevestigen && (
                <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, paddingTop: 2 }}>
                  {preview === null
                    ? "Bezig met controleren…"
                    : preview === 0
                      ? "Geen geplande sessies in deze periode."
                      : `${preview} geplande ${preview === 1 ? "sessie wordt" : "sessies worden"} verwijderd uit je schema.`}
                </div>
              )}
            </div>

            {fout && (
              <div style={{ background: "oklch(0.96 0.04 28)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ margin: 0, font: "700 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.1 25)" }}>{fout.error}</p>
                {fout.conflict && (
                  <p style={{ margin: "6px 0 0", font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.1 25)" }}>
                    Bestaande periode: {REDEN_LABEL[fout.conflict.reden] || fout.conflict.reden} van {formatDatumLeesbaar(fout.conflict.startDatum)}
                    {fout.conflict.eindDatum ? ` t/m ${formatDatumLeesbaar(fout.conflict.eindDatum)}` : " (geen einddatum ingesteld)"}.
                  </p>
                )}
              </div>
            )}

            <div style={{ marginTop: "auto", paddingTop: 12 }}>
              <button onClick={bevestig} disabled={!kanBevestigen || bezig}
                style={{ width: "100%", border: "none", cursor: kanBevestigen && !bezig ? "pointer" : "not-allowed", padding: 16, borderRadius: T.pillRadius, background: kanBevestigen && !bezig ? T.slate : "oklch(0.88 0.014 80)", color: kanBevestigen && !bezig ? "oklch(0.97 0.01 84)" : T.textTert, font: "800 16px var(--font-nunito), sans-serif", letterSpacing: 0.2 }}>
                {bezig ? "Bezig..." : "Bevestigen"}
              </button>
            </div>
          </>
        )}

        {modus === "bewerken" && periode && (
          <>
            <div style={{ marginBottom: 20 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Afwezigheid</span>
              <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Je huidige periode</h1>
            </div>

            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px", border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>{REDENEN.find(r => r.id === periode.reden)?.icon || "🗓️"}</span>
                <div>
                  <div style={{ font: "700 16px var(--font-nunito), sans-serif", color: T.text }}>{REDEN_LABEL[periode.reden] || periode.reden}</div>
                  <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>
                    Vanaf {formatDatumLeesbaar(periode.startDatum)}
                    {periode.eindDatum ? ` t/m ${formatDatumLeesbaar(periode.eindDatum)}` : " — geen einddatum ingesteld"}
                  </div>
                </div>
              </div>
            </div>

            {fout && (
              <div style={{ background: "oklch(0.96 0.04 28)", border: "1px solid oklch(0.85 0.08 25)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ margin: 0, font: "700 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.1 25)" }}>{fout.error}</p>
              </div>
            )}

            <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {periode.reden === "ziek" && periode.eindDatum === null && (
                <button onClick={sluitPeriode} disabled={bezig}
                  style={{ width: "100%", border: "none", cursor: bezig ? "not-allowed" : "pointer", padding: 16, borderRadius: T.pillRadius, background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 16px var(--font-nunito), sans-serif", letterSpacing: 0.2 }}>
                  {bezig ? "Bezig..." : "Ik ben weer beter"}
                </button>
              )}
              <button onClick={annuleerPeriode} disabled={bezig}
                style={{ width: "100%", border: `1.5px solid oklch(0.86 0.014 80)`, cursor: bezig ? "not-allowed" : "pointer", padding: 15, borderRadius: T.pillRadius, background: "transparent", color: T.textSec, font: "800 14px var(--font-nunito), sans-serif" }}>
                Periode annuleren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
