"use client";
import { T, SLATE } from "../../designTokens";

export default function InsightCard({ vandaagInvoer, dagelijkseData, hrvBasislijn, hrBasislijn }) {
  const hrv = vandaagInvoer?.hrv;
  const rhr = vandaagInvoer?.rusthartslag;
  if (!hrv && !rhr) return null;

  const recenteHrv = (dagelijkseData || []).filter(d => d.hrv).slice(-7);
  const vorigeWeekHrv = recenteHrv.length >= 7 ? recenteHrv.slice(0, 3).reduce((s, d) => s + d.hrv, 0) / 3 : null;
  const hrvChange = vorigeWeekHrv && hrv ? Math.round(((hrv - vorigeWeekHrv) / vorigeWeekHrv) * 100) : null;

  const hrvTrend = (() => {
    if (recenteHrv.length < 3) return "stabiel";
    const eerste = recenteHrv.slice(0, 2).reduce((s, d) => s + d.hrv, 0) / 2;
    const laatste = recenteHrv.slice(-2).reduce((s, d) => s + d.hrv, 0) / 2;
    if (laatste < eerste - 3) return "dalend";
    if (laatste > eerste + 3) return "stijgend";
    return "stabiel";
  })();

  const rhrDelta = rhr ? rhr - (hrBasislijn || 49) : null;

  let inzicht;
  if (hrvTrend === "stijgend" && (!rhrDelta || rhrDelta <= 2)) {
    inzicht = "Je HRV is al 3 dagen stabiel en je rustpols daalt. Je lichaam pakt de belasting goed op — durf deze week één sleutelsessie extra te plannen.";
  } else if (hrvTrend === "dalend") {
    inzicht = "Je HRV toont een dalende trend. Neem vandaag een rustdag of lichte herstellingsrit — je lichaam herstelt niet optimaal.";
  } else if (rhrDelta && rhrDelta > 5) {
    inzicht = "Je rusthartslag is verhoogd. Dit kan wijzen op onvolledig herstel of externe stress. Houd het vandaag rustig.";
  } else {
    inzicht = "Je lichaam reageert goed op de huidige trainingsbelasting. Blijf consistent en vertrouw het proces.";
  }

  return (
    <div style={{ background: SLATE.bg, borderRadius: T.cardRadius, padding: "22px 22px 24px", boxShadow: SLATE.shadow }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
        <div style={{ width: 24, height: 24, borderRadius: 8, background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px var(--font-fredoka), sans-serif", color: "oklch(0.2 0.03 245)" }}>P</div>
        <span style={{ font: "800 11.5px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: SLATE.label }}>AI-INZICHT</span>
      </div>
      <p style={{ margin: "0 0 16px", font: "600 17px/1.45 var(--font-nunito), sans-serif", color: SLATE.text, textWrap: "pretty" }}>{inzicht}</p>
      <div style={{ display: "flex", gap: 10 }}>
        {hrvChange != null && (
          <div style={{ flex: 1, background: SLATE.tile, borderRadius: 14, padding: "11px 13px" }}>
            <div style={{ font: "600 19px var(--font-fredoka), sans-serif", color: SLATE.accent }}>{hrvChange > 0 ? "+" : ""}{hrvChange}%</div>
            <div style={{ font: "600 11px var(--font-nunito), sans-serif", color: "oklch(0.74 0.03 230)" }}>HRV vs vorige week</div>
          </div>
        )}
        {rhr && (
          <div style={{ flex: 1, background: SLATE.tile, borderRadius: 14, padding: "11px 13px" }}>
            <div style={{ font: "600 19px var(--font-fredoka), sans-serif", color: "oklch(0.9 0.012 200)" }}>{rhr} bpm</div>
            <div style={{ font: "600 11px var(--font-nunito), sans-serif", color: "oklch(0.74 0.03 230)" }}>Rustpols vanmorgen</div>
          </div>
        )}
      </div>
    </div>
  );
}
