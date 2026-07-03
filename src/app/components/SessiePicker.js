"use client";
import { useState, useEffect, useCallback } from "react";
import { T, zoneKleur } from "../designTokens";

// Sectie 51-D: labels/kleuren voor de categorie-lijst (stap 1). Puur UI-metadata
// — de daadwerkelijke lijst welke categorieën getoond worden komt van de server
// (GET /api/sessie/categorieen, al fase-gefilterd).
const CATEGORIE_META = {
  z2_duur: { naam: "Duurtraining · Z2", omschrijving: "Rustige duurrit, stabiel tempo", kleur: T.z2 },
  sweetspot_intervallen: { naam: "Sweetspot", omschrijving: "Net onder drempel, opbouwende intervallen", kleur: T.z3 },
  kracht_lage_cadans: { naam: "Kracht · lage cadans", omschrijving: "Krachtblokken, lage cadans", kleur: T.z3 },
  drempel_intervallen: { naam: "Drempel", omschrijving: "Intervallen op FTP-niveau", kleur: T.z4 },
  vo2max_intervallen: { naam: "VO2max", omschrijving: "Korte, zware intervallen", kleur: T.z5 },
  sprint_neuraal: { naam: "Sprint · neuraal", omschrijving: "Korte maximale sprints, veel rust", kleur: T.z7 },
  z6_anaeroob: { naam: "Z6 anaeroob", omschrijving: "Korte anaerobe pieken", kleur: T.z6 },
  gemengd: { naam: "Gemengd", omschrijving: "Vrije invulling binnen de week", kleur: T.gradientA },
  tests: { naam: "Tests", omschrijving: "Altijd beschikbaar, los van fase", kleur: "oklch(0.55 0.14 30)" },
};

function expandeerBlokken(blokken) {
  const resultaat = [];
  for (const b of blokken || []) {
    const reps = Math.max(1, b.reps ?? 1);
    for (let i = 0; i < reps; i++) resultaat.push(b);
  }
  return resultaat;
}

// Mini-vermogensprofiel (~26px), twee varianten (zie 51-D):
// - progressie: staafhoogte naar pct_ftp (zelfde idee als de grote VERMOGENSPROFIEL-
//   grafiek op Workout-detail, hier zonder FTP-lijn/as-labels)
// - cadans-variatie (blokken met cadans_rpm): vlakke Z2-staven + accentmarkers op
//   de momenten waar het cadans-blok wisselt
function VariantSparkline({ blokken }) {
  const segmenten = expandeerBlokken(blokken);
  if (segmenten.length === 0) return null;

  const isCadansVariatie = segmenten.some(s => s.cadans_rpm != null);

  if (isCadansVariatie) {
    let vorigeCadans = undefined;
    const markerPosities = [];
    segmenten.forEach((s, i) => {
      if (s.cadans_rpm != null && s.cadans_rpm !== vorigeCadans) {
        if (i > 0) markerPosities.push((i / segmenten.length) * 100);
        vorigeCadans = s.cadans_rpm;
      }
    });
    return (
      <div style={{ position: "relative", height: 26, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: "100%" }}>
          {segmenten.map((s, i) => (
            <div key={i} style={{ flex: "1 0 0", height: "65%", background: T.z2, borderRadius: "2px 2px 0 0" }} />
          ))}
        </div>
        {markerPosities.map((pct, i) => (
          <div key={i} style={{ position: "absolute", top: 0, left: `${pct}%`, width: 2, height: "100%", background: T.z3, borderRadius: 2 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 26, marginBottom: 8 }}>
      {segmenten.map((s, i) => {
        const hoogtePct = Math.max(15, Math.min(100, ((s.pct_ftp - 40) / (110 - 40)) * 100));
        return (
          <div key={i} style={{ flex: "1 0 0", height: `${hoogtePct}%`, background: zoneKleur(s.pct_ftp), borderRadius: "2px 2px 0 0" }} />
        );
      })}
    </div>
  );
}

function beschrijfFtpBereik(blokken) {
  const pcts = (blokken || []).map(b => b.pct_ftp).filter(p => p != null);
  if (pcts.length === 0) return null;
  const min = Math.min(...pcts), max = Math.max(...pcts);
  return min === max ? `${min}% FTP` : `${min}% → ${max}% FTP`;
}

function formatDuur(min) {
  if (!min) return null;
  const u = Math.floor(min / 60), m = min % 60;
  return u > 0 ? `${u}u ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function Sheet({ titel, subtitel, onTerug, onSluiten, kinderen, hoogteHint }) {
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
        {onTerug && (
          <button onClick={onTerug} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, marginBottom: 5, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke={T.textSec} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>{subtitel}</span>
          </button>
        )}
        {!onTerug && <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>SESSIE VERVANGEN</span>}
        <h2 style={{ margin: "5px 0 16px", font: "800 21px var(--font-nunito), sans-serif", color: T.text }}>{titel}</h2>
        {kinderen}
      </div>
    </div>
  );
}

/**
 * Sectie 51-D: handmatige sessie-picker. Vervangt het vorige reden-gebaseerde
 * "andere training?"-flow (AlternatiefSessiePopup) volledig — de gebruiker kiest
 * hier zelf een categorie en vervolgens een specifieke variant, i.p.v. dat het
 * systeem automatisch een alternatief bepaalt.
 *
 * @param {string} datum
 * @param {(nieuweSessie: object) => void} onGekozen
 * @param {() => void} onAnnuleer
 */
export default function SessiePicker({ datum, onGekozen, onAnnuleer }) {
  const [stap, setStap] = useState("categorieen");
  const [categorieen, setCategorieen] = useState(null);
  const [gekozenCategorie, setGekozenCategorie] = useState(null);
  const [varianten, setVarianten] = useState(null);
  const [beschikbareUren, setBeschikbareUren] = useState(null);
  const [laden, setLaden] = useState(true);
  const [kiezenBezig, setKiezenBezig] = useState(false);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    setLaden(true);
    setFout(null);
    fetch(`/api/sessie/categorieen?datum=${datum}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.success) {
          console.error("[SessiePicker] categorieën laden mislukt:", r.status, d?.error);
          setFout(d?.error || `Categorieën laden mislukt (${r.status})`);
          return;
        }
        setCategorieen(d.data.categorieen);
      })
      .catch((e) => {
        console.error("[SessiePicker] categorieën laden mislukt:", e);
        setFout("Categorieën laden mislukt");
      })
      .finally(() => setLaden(false));
  }, [datum]);

  const kiesCategorie = useCallback((categorie) => {
    setGekozenCategorie(categorie);
    setStap("varianten");
    setLaden(true);
    setFout(null);
    setVarianten(null);
    fetch(`/api/sessie/varianten?datum=${datum}&categorie=${categorie}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.success) {
          console.error("[SessiePicker] varianten laden mislukt:", r.status, d?.error);
          setFout(d?.error || `Varianten laden mislukt (${r.status})`);
          return;
        }
        setVarianten(d.data.varianten);
        setBeschikbareUren(d.data.beschikbareUren);
      })
      .catch((e) => {
        console.error("[SessiePicker] varianten laden mislukt:", e);
        setFout("Varianten laden mislukt");
      })
      .finally(() => setLaden(false));
  }, [datum]);

  const kiesVariant = useCallback(async (variant) => {
    if (kiezenBezig || variant.past_binnen_tijd === false) return;
    setKiezenBezig(true);
    setFout(null);
    try {
      const resp = await fetch("/api/sessie/kies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum, sessietype: variant.sessietype,
          archetype_id: variant.archetype_id, variant_id: variant.variant_id,
        }),
      });
      const data = await resp.json();
      if (!data.success) { setFout(data.error || "Sessie kiezen mislukt"); return; }
      onGekozen(data.data);
    } catch {
      setFout("Sessie kiezen mislukt");
    } finally {
      setKiezenBezig(false);
    }
  }, [datum, kiezenBezig, onGekozen]);

  if (stap === "categorieen") {
    const normaal = (categorieen || []).filter(c => c.categorie !== "tests");
    const tests = (categorieen || []).find(c => c.categorie === "tests");
    return (
      <Sheet titel="Kies een type" onSluiten={onAnnuleer}>
        {laden && <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>Laden...</p>}
        {fout && <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.15 25)" }}>{fout}</p>}
        {!laden && !fout && normaal.length === 0 && !tests && (
          <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>Geen categorieën beschikbaar.</p>
        )}
        {!laden && !fout && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {normaal.map(({ categorie }) => {
              const meta = CATEGORIE_META[categorie] || { naam: categorie, omschrijving: "", kleur: T.z2 };
              return (
                <button key={categorie} onClick={() => kiesCategorie(categorie)} style={{
                  display: "flex", alignItems: "center", gap: 13, padding: "13px 15px",
                  borderRadius: 18, background: T.cardBg, border: `1px solid ${T.cardBorder}`,
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: meta.kleur, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "700 14.5px var(--font-nunito), sans-serif", color: T.text }}>{meta.naam}</div>
                    <div style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>{meta.omschrijving}</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke={T.textTert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              );
            })}
            {tests && (
              <>
                <div style={{ height: 1, background: T.divider, margin: "5px 0" }} />
                <button onClick={() => kiesCategorie("tests")} style={{
                  display: "flex", alignItems: "center", gap: 13, padding: "13px 15px",
                  borderRadius: 18, background: T.cardBg, border: `1.5px solid ${CATEGORIE_META.tests.kleur}`,
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: CATEGORIE_META.tests.kleur, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="oklch(0.99 0.01 95)" /></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "700 14.5px var(--font-nunito), sans-serif", color: T.text }}>{CATEGORIE_META.tests.naam}</div>
                    <div style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>{CATEGORIE_META.tests.omschrijving}</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke={T.textTert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </>
            )}
          </div>
        )}
      </Sheet>
    );
  }

  const meta = CATEGORIE_META[gekozenCategorie] || { naam: gekozenCategorie };
  return (
    <Sheet titel="Kies een variant" subtitel={meta.naam?.toUpperCase()} onTerug={() => { setStap("categorieen"); setFout(null); }} onSluiten={onAnnuleer}>
      {beschikbareUren != null && (
        <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, display: "block", marginBottom: 16 }}>
          Beschikbaar vandaag: {formatDuur(Math.round(beschikbareUren * 60))}
        </span>
      )}
      {laden && <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>Laden...</p>}
      {fout && <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.15 25)" }}>{fout}</p>}
      {!laden && !fout && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {(varianten || []).map((v) => {
            const key = v.variant_id ?? v.sessietype;
            const magKiezen = v.past_binnen_tijd !== false;
            return (
              <button key={key} disabled={!magKiezen || kiezenBezig} onClick={() => kiesVariant(v)} style={{
                padding: "13px 16px 14px", borderRadius: 18, background: T.cardBg,
                border: `1px solid ${T.cardBorder}`, opacity: magKiezen ? 1 : 0.4,
                cursor: magKiezen ? "pointer" : "default", textAlign: "left", width: "100%",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
                  <span style={{ font: "700 15px var(--font-nunito), sans-serif", color: T.text }}>{v.naam}</span>
                  {v.duur_min_geschat && (
                    <span style={{ font: "800 12px var(--font-nunito), sans-serif", color: T.textSec }}>~{formatDuur(v.duur_min_geschat)}</span>
                  )}
                </div>
                {v.blokken && <VariantSparkline blokken={v.blokken} />}
                <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>
                  {magKiezen ? (v.blokken ? beschrijfFtpBereik(v.blokken) : v.omschrijving) : v.reden_uitgeschakeld}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
