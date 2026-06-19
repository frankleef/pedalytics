"use client";

export function berekenWeekStatus(seizoensplan, ritten, dagelijkseData) {
  if (!seizoensplan?.kader || !seizoensplan?.startdatum) return null;

  const startDatum = new Date(seizoensplan.startdatum);
  const nu = new Date();
  const huidigeWeek = Math.max(1, Math.ceil((nu - startDatum) / (7 * 86400000)));

  const kaderWeek = seizoensplan.kader?.find(w => w.week === huidigeWeek);
  if (!kaderWeek) return null;

  // Werkelijke TSS afgelopen 7 dagen
  const weekGeleden = new Date(nu - 7 * 86400000);
  const rittenDezeWeek = (ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= weekGeleden);
  const werkelijkeTss = Math.round(rittenDezeWeek.reduce((s, r) => s + (r.tss || 0), 0));
  const geplandeTss = kaderWeek.tss_doel || 0;
  const tssRatio = geplandeTss > 0 ? werkelijkeTss / geplandeTss : null;

  // Gemiddelde RPE
  const rpeRitten = rittenDezeWeek.filter(r => r.rpe);
  const gemRpe = rpeRitten.length > 0 ? +(rpeRitten.reduce((s, r) => s + r.rpe, 0) / rpeRitten.length).toFixed(1) : null;

  // HRV trend (laatste 5 dagen)
  const recenteHrv = (dagelijkseData || []).filter(d => d.hrv).slice(-5);
  let hrvTrend = "stabiel";
  if (recenteHrv.length >= 3) {
    const eerste = recenteHrv.slice(0, 2).reduce((s, d) => s + d.hrv, 0) / 2;
    const laatste = recenteHrv.slice(-2).reduce((s, d) => s + d.hrv, 0) / 2;
    if (laatste < eerste - 3) hrvTrend = "dalend";
    else if (laatste > eerste + 3) hrvTrend = "stijgend";
  }

  // Aanpassingsadvies
  let aanpassing = null;
  let aanpassingKleur = "#60a5fa";
  if (tssRatio !== null) {
    if (tssRatio < 0.8 && gemRpe && gemRpe > 7) {
      aanpassing = "Plan was te zwaar — volgende week TSS verlagen met 10%";
      aanpassingKleur = "#ef4444";
    } else if (tssRatio < 0.8 && gemRpe && gemRpe < 5) {
      aanpassing = "Externe factoren (weer, druk) — geen aanpassing nodig";
      aanpassingKleur = "#fbbf24";
    } else if (tssRatio > 0.95 && gemRpe && gemRpe < 5) {
      aanpassing = "Plan was te licht — volgende week TSS verhogen met 5%";
      aanpassingKleur = "#4ade80";
    } else if (tssRatio >= 0.8 && tssRatio <= 1.1) {
      aanpassing = "Goed uitgevoerd — plan volgen";
      aanpassingKleur = "#4ade80";
    }
  }
  if (hrvTrend === "dalend") {
    aanpassing = "HRV dalend (3+ dagen) — intensiteit uitstellen, focus op herstel";
    aanpassingKleur = "#f97316";
  }

  return {
    huidigeWeek,
    fase: kaderWeek.fase,
    focus: kaderWeek.focus,
    geplandeTss,
    werkelijkeTss,
    tssRatio,
    gemRpe,
    hrvTrend,
    aanpassing,
    aanpassingKleur,
    rittenDezeWeek: rittenDezeWeek.length,
  };
}

export default function WeekVergelijkingPanel({ status }) {
  if (!status) return null;

  const tssKleur = status.tssRatio >= 0.9 ? "#4ade80" : status.tssRatio >= 0.7 ? "#fbbf24" : "#ef4444";
  const tssLabel = status.tssRatio >= 0.9 ? "Op schema" : status.tssRatio >= 0.7 ? "Iets achter" : "Flink achter";
  const hrvKleur = status.hrvTrend === "stijgend" ? "#4ade80" : status.hrvTrend === "dalend" ? "#ef4444" : "#60a5fa";
  const faseKleuren = { basis: "#60a5fa", sweetspot: "#fbbf24", drempel: "#f97316", consolidatie: "#4ade80", test: "#a78bfa", herstel: "#94a3b8" };

  return (
    <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Week {status.huidigeWeek}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: faseKleuren[status.fase] || "#94a3b8" }}>
            {status.fase?.charAt(0).toUpperCase() + status.fase?.slice(1)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: tssKleur }}>
            {status.tssRatio !== null ? `${Math.round(status.tssRatio * 100)}%` : "—"}
          </div>
          <div style={{ fontSize: 9, color: "#64748b" }}>{tssLabel}</div>
        </div>
      </div>

      {/* TSS vergelijking */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { l: "Gepland", v: status.geplandeTss, e: "TSS", k: "#64748b" },
          { l: "Werkelijk", v: status.werkelijkeTss, e: "TSS", k: tssKleur },
          { l: "Ritten", v: status.rittenDezeWeek, e: "", k: "#94a3b8" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#07111d", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.k }}>{s.v}<span style={{ fontSize: 9, color: s.k + "aa" }}> {s.e}</span></div>
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Voortgangsbalk */}
      <div style={{ background: "#1e293b", borderRadius: 6, height: 8, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (status.tssRatio || 0) * 100)}%`, background: tssKleur, height: 8, borderRadius: 6 }} />
      </div>

      {/* RPE + HRV */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {status.gemRpe !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>RPE gem.</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: status.gemRpe >= 8 ? "#ef4444" : status.gemRpe >= 6 ? "#fbbf24" : "#4ade80" }}>
              {status.gemRpe}/10
            </span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>HRV</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: hrvKleur }}>
            {status.hrvTrend === "stijgend" ? "↗ stijgend" : status.hrvTrend === "dalend" ? "↘ dalend" : "→ stabiel"}
          </span>
        </div>
      </div>

      {/* Aanpassing */}
      {status.aanpassing && (
        <div style={{ fontSize: 12, color: status.aanpassingKleur, lineHeight: 1.5, background: status.aanpassingKleur + "15", borderRadius: 8, padding: "8px 10px", borderLeft: `3px solid ${status.aanpassingKleur}` }}>
          {status.aanpassing}
        </div>
      )}
    </div>
  );
}
