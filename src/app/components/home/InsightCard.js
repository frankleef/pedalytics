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
    <div style={{ background: SLATE.bg, borderRadius: T.cardRadius, padding: "20px 20px 20px", boxShadow: SLATE.shadow, border: `1px solid ${T.cardBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: T.slate, display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px var(--font-fredoka), sans-serif", color: "#fff" }}>P</div>
        <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: SLATE.label, textTransform: "uppercase", letterSpacing: 1.2 }}>Coach-notitie</span>
      </div>
      <p style={{ margin: "0 0 16px", font: "500 15px/1.55 var(--font-nunito), sans-serif", color: SLATE.text, textWrap: "pretty" }}>{inzicht}</p>
      <div style={{ display: "flex", gap: 10 }}>
        {hrvChange != null && (
          <div style={{ flex: 1, background: SLATE.tile, borderRadius: 14, padding: "13px 14px" }}>
            <div style={{ font: "700 19px var(--font-fredoka), sans-serif", letterSpacing: -0.4, color: SLATE.accent }}>{hrvChange > 0 ? "+" : ""}{hrvChange}%</div>
            <div style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 3 }}>HRV vs vorige week</div>
          </div>
        )}
        {rhr && (
          <div style={{ flex: 1, background: SLATE.tile, borderRadius: 14, padding: "13px 14px" }}>
            <div style={{ font: "700 19px var(--font-fredoka), sans-serif", letterSpacing: -0.4, color: T.text }}>{rhr} <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>bpm</span></div>
            <div style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 3 }}>Rustpols vanmorgen</div>
          </div>
        )}
      </div>
    </div>
  );
}
