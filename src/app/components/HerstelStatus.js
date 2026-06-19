"use client";

// Gecombineerde herstelstatus op basis van HRV, rusthartslag, TSB en slaap
export function berekenHerstelScore({ hrv, hrvBasislijn, rusthartslag, rusthartslagBasislijn, tsb, slaapScore }) {
  let score = 0;
  let signalen = [];

  // HRV (40% gewicht)
  if (hrv && hrvBasislijn) {
    const hrvPct = (hrv / hrvBasislijn) * 100;
    if (hrvPct >= 97) { score += 40; signalen.push({ label: "HRV uitstekend", k: "#4ade80" }); }
    else if (hrvPct >= 90) { score += 30; signalen.push({ label: "HRV goed", k: "#60a5fa" }); }
    else if (hrvPct >= 80) { score += 15; signalen.push({ label: "HRV matig", k: "#fbbf24" }); }
    else { score += 0; signalen.push({ label: "HRV laag ⚠️", k: "#ef4444" }); }
  }

  // Rusthartslag (30% gewicht)
  if (rusthartslag && rusthartslagBasislijn) {
    const hrDiff = rusthartslag - rusthartslagBasislijn;
    if (hrDiff <= 1) { score += 30; signalen.push({ label: "HR rust normaal", k: "#4ade80" }); }
    else if (hrDiff <= 3) { score += 20; signalen.push({ label: "HR rust licht verhoogd", k: "#fbbf24" }); }
    else if (hrDiff <= 6) { score += 8; signalen.push({ label: "HR rust verhoogd ⚠️", k: "#f97316" }); }
    else { score += 0; signalen.push({ label: "HR rust sterk verhoogd 🚨", k: "#ef4444" }); }
  }

  // TSB (20% gewicht)
  if (tsb !== undefined && tsb !== null) {
    if (tsb > 5) { score += 20; signalen.push({ label: "Vorm: uitgerust", k: "#4ade80" }); }
    else if (tsb >= -10) { score += 15; signalen.push({ label: "Vorm: in balans", k: "#60a5fa" }); }
    else if (tsb >= -20) { score += 8; signalen.push({ label: "Vorm: vermoeid", k: "#fbbf24" }); }
    else { score += 0; signalen.push({ label: "Vorm: overbelast 🚨", k: "#ef4444" }); }
  }

  // Slaap (10% gewicht)
  if (slaapScore) {
    if (slaapScore >= 85) { score += 10; signalen.push({ label: "Slaap uitstekend", k: "#4ade80" }); }
    else if (slaapScore >= 70) { score += 7; signalen.push({ label: "Slaap goed", k: "#60a5fa" }); }
    else if (slaapScore >= 55) { score += 3; signalen.push({ label: "Slaap matig", k: "#fbbf24" }); }
    else { score += 0; signalen.push({ label: "Slaap slecht ⚠️", k: "#ef4444" }); }
  }

  // Normaliseer naar max beschikbare signalen
  const aantalSignalen = [hrv, rusthartslag, tsb, slaapScore].filter(Boolean).length;
  const maxScore = aantalSignalen * 25; // ruwe normalisatie
  const normScore = aantalSignalen > 0 ? Math.round((score / (aantalSignalen === 4 ? 100 : maxScore)) * 100) : null;

  // Status bepalen
  let status;
  const s = normScore ?? score;
  if (s >= 80) status = { label: "Uitstekend herstel", icon: "🟢", k: "#4ade80", advies: "Klaar voor zware training of intervalrit" };
  else if (s >= 60) status = { label: "Goed herstel", icon: "🟡", k: "#60a5fa", advies: "Duurrit op Z2 of lichte intervaltraining" };
  else if (s >= 40) status = { label: "Matig herstel", icon: "🟠", k: "#fbbf24", advies: "Rustige Z2-rit of herstelrit — geen intervallen" };
  else status = { label: "Slecht herstel", icon: "🔴", k: "#ef4444", advies: "Rust vandaag — training maakt het erger" };

  return { score: s, status, signalen };
}

export default function HerstelStatusPanel({ dagelijkseData, tsb, slaapScore, hrvBasislijn = 58, hrBasislijn = 49 }) {
  if (!dagelijkseData || dagelijkseData.length === 0) return null;

  const vandaag = dagelijkseData[dagelijkseData.length - 1];
  const HRV_BASISLIJN = hrvBasislijn;
  const HR_BASISLIJN = hrBasislijn;

  const { score, status, signalen } = berekenHerstelScore({
    hrv: vandaag.hrv,
    hrvBasislijn: HRV_BASISLIJN,
    rusthartslag: vandaag.rusthartslag,
    rusthartslagBasislijn: HR_BASISLIJN,
    tsb,
    slaapScore,
  });

  // Trend van afgelopen 7 dagen
  const trend = dagelijkseData.slice(-7).map(d => {
    const { score: s } = berekenHerstelScore({
      hrv: d.hrv, hrvBasislijn: HRV_BASISLIJN,
      rusthartslag: d.rusthartslag, rusthartslagBasislijn: HR_BASISLIJN,
      tsb: d.tsb, slaapScore: d.slaapScore,
    });
    return { datum: d.datum, score: s };
  });

  const W = 280, H = 40;
  const maxS = 100, minS = 0;
  const trendLijn = trend.filter(t => t.score > 0);

  return (
    <div style={{ background: "#0e1521", border: `1px solid ${status.k}40`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
            Herstelstatus vandaag
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: status.k }}>
            {status.icon} {status.label}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, lineHeight: 1.5 }}>{status.advies}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: status.k, letterSpacing: -2 }}>{score}</div>
          <div style={{ fontSize: 10, color: "#64748b" }}>/ 100</div>
        </div>
      </div>

      {/* Signalen */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {signalen.map((s, i) => (
          <span key={i} style={{ fontSize: 11, color: s.k, background: s.k + "15",
            border: `1px solid ${s.k}30`, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
            {s.label}
          </span>
        ))}
      </div>

      {/* Huidige waarden */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { l: "HRV", v: vandaag.hrv ? `${vandaag.hrv} ms` : "—", basis: `basislijn ${HRV_BASISLIJN} ms`, k: "#a78bfa",
            delta: vandaag.hrv ? vandaag.hrv - HRV_BASISLIJN : null },
          { l: "Rusthartslag", v: vandaag.rusthartslag ? `${vandaag.rusthartslag} bpm` : "—",
            basis: `basislijn ${HR_BASISLIJN} bpm`, k: "#4ade80",
            delta: vandaag.rusthartslag ? vandaag.rusthartslag - HR_BASISLIJN : null, invertDelta: true },
        ].map((s, i) => (
          <div key={i} style={{ background: "#07111d", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.k }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{s.basis}</div>
            {s.delta !== null && (
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2,
                color: (s.invertDelta ? s.delta <= 0 : s.delta >= 0) ? "#4ade80" : "#ef4444" }}>
                {s.delta > 0 ? "+" : ""}{s.delta} {s.invertDelta ? "(lager is beter)" : "(hoger is beter)"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 7-daagse trend */}
      {trendLijn.length > 1 && (
        <div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>Hersteltrend — 7 dagen</div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
            <line x1={0} y1={H * 0.4} x2={W} y2={H * 0.4}
              stroke="#166534" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <polyline fill="none" stroke={status.k} strokeWidth="2"
              points={trendLijn.map((t, i) => {
                const x = (i / (trendLijn.length - 1)) * W;
                const y = H - ((t.score - minS) / (maxS - minS)) * H;
                return `${x},${y}`;
              }).join(" ")} />
            {trendLijn.map((t, i) => {
              const x = (i / (trendLijn.length - 1)) * W;
              const y = H - ((t.score - minS) / (maxS - minS)) * H;
              const dagK = t.score >= 80 ? "#4ade80" : t.score >= 60 ? "#60a5fa" : t.score >= 40 ? "#fbbf24" : "#ef4444";
              return <circle key={i} cx={x} cy={y} r="3" fill={dagK} />;
            })}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569", marginTop: 2 }}>
            {trendLijn.map((t, i) => <span key={i}>{t.datum}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
