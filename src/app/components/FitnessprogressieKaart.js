"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";

// Traag, wekelijks bijgewerkt trendsignaal — apart van de dagelijkse
// "Gereedheid vandaag"-kaart (GereedheidKaart), die TSB/HRV/RPE toont. Deze
// kaart beantwoordt "ben ik fitter geworden de afgelopen weken", niet "hoe
// fris ben ik vandaag" — zie fitnessprogressie-en-kracht-fase-check.md, Deel A.

const CTL_RICHTING_TEKST = {
  stijgend: "Je fitheid (CTL) stijgt gestaag",
  stabiel: "Je fitheid (CTL) is stabiel",
  dalend: "Je fitheid (CTL) daalt",
};
const CTL_RICHTING_KLEUR = {
  stijgend: "oklch(0.63 0.06 150)",
  stabiel: "oklch(0.6 0.012 76)",
  dalend: "oklch(0.58 0.11 28)",
};

const DECOUPLING_RICHTING_TEKST = {
  verbeterend: "Aerobe efficiëntie verbetert",
  stabiel: "Aerobe efficiëntie is stabiel",
  verslechterend: "Aerobe efficiëntie verslechtert",
};

export default function FitnessprogressieKaart() {
  const [data, setData] = useState(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    fetch("/api/plan/fitnessprogressie")
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setGeladen(true));
  }, []);

  if (!geladen) return null;

  const ctlTrend = data?.ctl_trend;
  const decouplingTrend = data?.decoupling_trend;

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
      <span style={{ font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>
        Fitnessprogressie
      </span>
      <p style={{ margin: "4px 0 16px", font: "500 12.5px/1.5 var(--font-nunito), sans-serif", color: T.textTert }}>
        Trend over de laatste weken — wekelijks bijgewerkt, los van je dagelijkse gereedheid.
      </p>

      {!data || ctlTrend?.status === "onvoldoende_data" ? (
        <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>
          Nog te weinig trainingsgeschiedenis voor een betrouwbare trend — beschikbaar na een paar weken training.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ font: "800 22px var(--font-fredoka), sans-serif", color: CTL_RICHTING_KLEUR[ctlTrend.richting] || T.text }}>
              {CTL_RICHTING_TEKST[ctlTrend.richting] || "Trend onbekend"}
            </span>
          </div>
          <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 14 }}>
            {ctlTrend.helling_per_week > 0 ? "+" : ""}{ctlTrend.helling_per_week} CTL-punten/week, over de laatste {ctlTrend.venster_dagen} dagen
          </div>

          <div style={{ height: 1, background: T.divider, margin: "4px 0 12px" }} />

          {decouplingTrend?.status === "onvoldoende_data" ? (
            <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textTert }}>
              Aerobe efficiëntie: onvoldoende lange Z2-ritten voor een betrouwbare trend ({decouplingTrend.aantal_punten}/10 nodig).
            </div>
          ) : (
            <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>
              {DECOUPLING_RICHTING_TEKST[decouplingTrend?.richting] || "Aerobe efficiëntie: onbekend"}
            </div>
          )}

          {data.ftp_test_markers?.some(m => m.datum) && (
            <div style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textTert, marginTop: 10 }}>
              FTP-tests: {data.ftp_test_markers.filter(m => m.datum).map(m => m.datum).join(", ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
