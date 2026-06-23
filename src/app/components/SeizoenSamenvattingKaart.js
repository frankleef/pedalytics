"use client";
import { T } from "../designTokens";

export default function SeizoenSamenvattingKaart({ plan, profiel, onNieuwSeizoeen }) {
  const huidigeFtp = profiel?.ftp || 265;
  const startFtp = plan?.start_ftp;
  const ftpDelta = startFtp ? huidigeFtp - startFtp : null;
  const pct = startFtp ? Math.round((ftpDelta / startFtp) * 100) : null;

  const sessies = plan?.weekSessies?.sessies || [];
  const voltooide = sessies.filter(s => s.voltooid);
  const wekenSet = new Set();
  voltooide.forEach(s => {
    if (s.datum) {
      const d = new Date(s.datum);
      const ma = new Date(d); ma.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      wekenSet.add(ma.toISOString().slice(0, 10));
    }
  });
  const actieveWeken = wekenSet.size;
  const totaalWeken = plan?.tijdshorizon_weken || plan?.kader?.length || 13;
  const totaalTss = voltooide.reduce((s, r) => s + (r.tss || 0), 0);
  const gemTss = actieveWeken > 0 ? Math.round(totaalTss / actieveWeken) : 0;

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "24px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>&#x1F389;</span>
        <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Seizoen afgerond</span>
      </div>

      {startFtp && ftpDelta != null ? (
        <div style={{ font: "700 20px var(--font-nunito), sans-serif", color: T.text, marginBottom: 8 }}>
          Van {startFtp}W naar {huidigeFtp}W — <span style={{ color: ftpDelta >= 0 ? "oklch(0.5 0.13 162)" : "oklch(0.55 0.11 30)" }}>
            {ftpDelta >= 0 ? "+" : ""}{ftpDelta}W ({pct >= 0 ? "+" : ""}{pct}%)
          </span>
        </div>
      ) : (
        <div style={{ font: "700 20px var(--font-nunito), sans-serif", color: T.text, marginBottom: 8 }}>
          Huidige FTP: {huidigeFtp}W
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>
          <span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: T.text }}>{actieveWeken}</span> van {totaalWeken} weken actief
        </div>
        <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>
          Gem. <span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: T.text }}>{gemTss}</span> TSS/week
        </div>
      </div>

      <button onClick={onNieuwSeizoeen}
        style={{ width: "100%", padding: 15, borderRadius: T.pillRadius, border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 15px var(--font-nunito), sans-serif", cursor: "pointer", letterSpacing: 0.2 }}>
        Start nieuw seizoen
      </button>
    </div>
  );
}
