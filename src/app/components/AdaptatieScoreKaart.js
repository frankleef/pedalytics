"use client";
import { useState, useEffect } from "react";
import { T, CONDITIE_PILL_KLEUREN } from "../designTokens";
import { conditieInfoRegels } from "@/lib/conditie";
import ConditieUitlegModal from "./ConditieUitlegModal";

// Toont dezelfde conditiescore als de homepage-kaart (GereedheidConditieKaart)
// — vóór deze wijziging las deze kaart een aparte "adaptatiescore" die nergens
// werd berekend (dode code, altijd null) en dan onopgemerkt terugviel op een
// losse TSS-percentage-heuristiek. Dat gaf hier een ander (en minder betekenisvol)
// oordeel dan de homepage. Nu: één score, overal hetzelfde.
export default function AdaptatieScoreKaart({ weekTss, doelTss, fase, weekNr, weektype, onEditBeschikbaarheid, onOpenAfwezigheid, afwezigheidActief }) {
  const [condData, setCondData] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [hitteMelding, setHitteMelding] = useState(false);

  useEffect(() => {
    fetch("/api/plan/conditie-score").then(r => r.json()).then(d => {
      if (d.success && d.data) setCondData(d.data);
      if (d.hitteMelding) setHitteMelding(true);
    }).catch(() => {});
  }, []);

  const tssPct = doelTss > 0 ? Math.min(100, Math.round((weekTss / doelTss) * 100)) : 0;
  const pillKleur = condData?.pill?.kleur ? CONDITIE_PILL_KLEUREN[condData.pill.kleur] : null;
  const infoRegels = condData ? conditieInfoRegels(condData.ctl_nu, condData.ctl_4w_geleden, condData.rpe_delta_trend) : {};
  const balkKleur = pillKleur?.dot || "oklch(0.65 0.015 75)";

  return (
    <div style={{ background: T.cardBg, borderRadius: 24, padding: "15px 17px 16px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 18 }}>
      {(fase || onEditBeschikbaarheid || onOpenAfwezigheid) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid oklch(0.93 0.01 82)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {fase && (
              <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.slate }} />
                <span style={{ font: "700 13.5px var(--font-nunito), sans-serif", color: T.text }}>{fase.charAt(0).toUpperCase() + fase.slice(1)}</span>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {fase && (
              <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec, padding: "4px 10px", borderRadius: T.pillRadius, background: T.subtleFill }}>Week {weekNr} · {weektype}</span>
            )}
            {onEditBeschikbaarheid && (
              <button onClick={onEditBeschikbaarheid} aria-label="Beschikbaarheid aanpassen" style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid oklch(0.93 0.01 82)`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={T.textTert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={T.textTert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
            {onOpenAfwezigheid && (
              <button onClick={() => onOpenAfwezigheid(afwezigheidActief ? "bewerken" : "nieuw", afwezigheidActief || null)} aria-label={afwezigheidActief ? "Afwezigheid aanpassen" : "Afwezigheid melden"} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid oklch(0.93 0.01 82)`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="16" rx="3" stroke={T.textTert} strokeWidth="2"/><path d="M3.5 9h17M8 2.5v4M16 2.5v4" stroke={T.textTert} strokeWidth="2" strokeLinecap="round"/><path d="M9.5 14h5" stroke={T.textTert} strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {afwezigheidActief ? (
        <div style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: T.textSec, padding: "4px 0" }}>
          {afwezigheidActief.eindDatum
            ? `Geen trainingen gepland t/m ${new Date(afwezigheidActief.eindDatum).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}.`
            : "Geen trainingen gepland — geen einddatum ingesteld."}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            {pillKleur && condData?.pill ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: T.pillRadius, background: pillKleur.bg }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: pillKleur.dot }} />
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: pillKleur.tekst }}>{condData.pill.label}</span>
              </div>
            ) : (
              <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>Nog te weinig data</span>
            )}
            <button onClick={() => setInfoOpen(true)} aria-label="Uitleg conditiescore" style={{ width: 22, height: 22, borderRadius: "50%", background: T.subtleFill, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={T.textSec} strokeWidth="2"/><path d="M12 16v-4M12 8h.01" stroke={T.textSec} strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Data-gedreven verklaring i.p.v. een vaste subtekst — dezelfde regels als op de homepage */}
          {condData?.pill && (infoRegels.ctlRegel || infoRegels.rpeRegel) ? (
            <div style={{ marginBottom: 10 }}>
              {infoRegels.ctlRegel && <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>{infoRegels.ctlRegel}</div>}
              {infoRegels.rpeRegel && <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>{infoRegels.rpeRegel}</div>}
            </div>
          ) : (
            <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 10 }}>Meer ritten nodig — beschikbaar na 4 weken training.</div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textTert }}>TSS 7d</span>
            <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>
              <span style={{ font: "600 17px var(--font-fredoka), sans-serif", color: T.text }}>{weekTss}</span> / {doelTss}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: T.pillRadius, background: "oklch(0.93 0.012 84)", overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${tssPct}%`, borderRadius: T.pillRadius, background: balkKleur }} />
          </div>

          {hitteMelding && (
            <div style={{ font: "600 12px/1.5 var(--font-nunito), sans-serif", color: T.textSec, marginTop: 8, paddingTop: 8, borderTop: `1px solid oklch(0.93 0.01 82)` }}>
              Je recente ritten waren overwegend in warme omstandigheden. De aerobe trend is tijdelijk minder betrouwbaar — dit herstelt zich zodra de omstandigheden normaliseren.
            </div>
          )}
          <div style={{ font: "500 10.5px var(--font-nunito), sans-serif", color: T.textTert, marginTop: 8 }}>
            Combineert je huidige trainingsbelasting met de conditierichting — voor de losse trend, zie Fitnessprogressie op Vandaag.
          </div>
        </>
      )}

      {infoOpen && <ConditieUitlegModal onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
