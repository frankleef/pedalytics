"use client";

// Samengestelde heuristiek, geen wetenschappelijk gestandaardiseerde formule.
// TSB, HRV-afwijking, RHR-afwijking en subjectieve check-in zijn elk individueel
// gevalideerde signalen, maar de combinatie tot één 0-100 score met onderstaande
// gewichten is een eigen keuze — vergelijkbaar met Whoop/Garmin/Oura readiness scores.
// Met check-in: TSB 40%, HRV 25%, RHR 10%, check-in 25%.
// Zonder check-in: TSB 50%, HRV 35%, RHR 15% (hernormalisatie).

const GEWICHT_TSB = 0.40;
const GEWICHT_HRV = 0.25;
const GEWICHT_RHR = 0.10;
const GEWICHT_CHECKIN = 0.25;

const TSB_MIN = -30;
const TSB_MAX = 15;
const HRV_AFWIJKING_MIN = -20; // percentage onder basislijn
const RHR_AFWIJKING_MAX = 10;  // bpm boven basislijn

function clamp01(val) { return Math.max(0, Math.min(1, val)); }

function tsbSubscore(tsb) {
  return clamp01((tsb - TSB_MIN) / (TSB_MAX - TSB_MIN));
}

function hrvSubscore(hrv, basislijn) {
  const afwijkingPct = ((hrv - basislijn) / basislijn) * 100;
  return clamp01((afwijkingPct - HRV_AFWIJKING_MIN) / (0 - HRV_AFWIJKING_MIN));
}

function rhrSubscore(rhr, basislijn) {
  const afwijking = rhr - basislijn;
  return clamp01(1 - afwijking / RHR_AFWIJKING_MAX);
}

function checkinSubscore(score) {
  return clamp01((score - 1) / 4);
}

export function berekenHerstelScore({ hrv, hrvBasislijn, rusthartslag, rusthartslagBasislijn, tsb, slaapScore, checkin }) {
  const subscores = [];
  const signalen = [];
  let gewichtTotaal = 0;
  let gewogenSom = 0;

  if (tsb != null) {
    const sub = tsbSubscore(tsb);
    subscores.push({ label: "TSB", sub, gewicht: GEWICHT_TSB });
    gewogenSom += sub * GEWICHT_TSB;
    gewichtTotaal += GEWICHT_TSB;

    const tsbLabel = tsb > 5 ? "Vorm: uitgerust" : tsb >= -10 ? "Vorm: in balans" : tsb >= -20 ? "Vorm: vermoeid" : "Vorm: overbelast";
    const tsbK = tsb > 5 ? "#4ade80" : tsb >= -10 ? "#60a5fa" : tsb >= -20 ? "#fbbf24" : "#ef4444";
    signalen.push({ label: tsbLabel, k: tsbK });
  }

  if (hrv && hrvBasislijn) {
    const sub = hrvSubscore(hrv, hrvBasislijn);
    subscores.push({ label: "HRV", sub, gewicht: GEWICHT_HRV });
    gewogenSom += sub * GEWICHT_HRV;
    gewichtTotaal += GEWICHT_HRV;

    const pct = ((hrv - hrvBasislijn) / hrvBasislijn) * 100;
    const hrvLabel = pct >= -3 ? "HRV rond basislijn" : pct >= -10 ? "HRV licht verlaagd" : "HRV sterk verlaagd";
    const hrvK = pct >= -3 ? "#4ade80" : pct >= -10 ? "#fbbf24" : "#ef4444";
    signalen.push({ label: hrvLabel, k: hrvK });
  }

  if (rusthartslag && rusthartslagBasislijn) {
    const sub = rhrSubscore(rusthartslag, rusthartslagBasislijn);
    subscores.push({ label: "RHR", sub, gewicht: GEWICHT_RHR });
    gewogenSom += sub * GEWICHT_RHR;
    gewichtTotaal += GEWICHT_RHR;

    const diff = rusthartslag - rusthartslagBasislijn;
    const rhrLabel = diff <= 2 ? "Rusthartslag normaal" : diff <= 5 ? "Rusthartslag licht verhoogd" : "Rusthartslag verhoogd";
    const rhrK = diff <= 2 ? "#4ade80" : diff <= 5 ? "#fbbf24" : "#ef4444";
    signalen.push({ label: rhrLabel, k: rhrK });
  }

  if (checkin && checkin >= 1 && checkin <= 5) {
    const sub = checkinSubscore(checkin);
    subscores.push({ label: "Check-in", sub, gewicht: GEWICHT_CHECKIN });
    gewogenSom += sub * GEWICHT_CHECKIN;
    gewichtTotaal += GEWICHT_CHECKIN;

    const ciLabel = checkin >= 4 ? "Gevoel: goed" : checkin === 3 ? "Gevoel: neutraal" : "Gevoel: moe";
    const ciK = checkin >= 4 ? "#4ade80" : checkin === 3 ? "#fbbf24" : "#ef4444";
    signalen.push({ label: ciLabel, k: ciK });
  }

  const score = gewichtTotaal > 0
    ? Math.round((gewogenSom / gewichtTotaal) * 100)
    : 50;

  let status;
  if (score >= 75) status = { label: "Uitstekend herstel", icon: "🟢", k: "#4ade80", advies: "Klaar voor zware training of intervalrit" };
  else if (score >= 50) status = { label: "Goed herstel", icon: "🟡", k: "#60a5fa", advies: "Duurrit op Z2 of lichte intervaltraining" };
  else if (score >= 30) status = { label: "Matig herstel", icon: "🟠", k: "#fbbf24", advies: "Rustige Z2-rit of herstelrit — geen intervallen" };
  else status = { label: "Slecht herstel", icon: "🔴", k: "#ef4444", advies: "Rust vandaag — training maakt het erger" };

  return { score, status, signalen, subscores };
}

export default function HerstelStatusPanel({ dagelijkseData, tsb, slaapScore, hrvBasislijn = 58, hrBasislijn = 49 }) {
  if (!dagelijkseData || dagelijkseData.length === 0) return null;

  const vandaag = dagelijkseData[dagelijkseData.length - 1];

  const { score, status, signalen } = berekenHerstelScore({
    hrv: vandaag.hrv,
    hrvBasislijn,
    rusthartslag: vandaag.rusthartslag,
    rusthartslagBasislijn: hrBasislijn,
    tsb,
    slaapScore,
  });

  const trend = dagelijkseData.slice(-7).map(d => {
    const { score: s } = berekenHerstelScore({
      hrv: d.hrv, hrvBasislijn,
      rusthartslag: d.rusthartslag, rusthartslagBasislijn: hrBasislijn,
      tsb: d.tsb, slaapScore: d.slaapScore,
    });
    return { datum: d.datum, score: s };
  });

  const W = 280, H = 40;
  const trendLijn = trend.filter(t => t.score > 0);

  return (
    <div style={{ background: "#0e1521", border: `1px solid ${status.k}40`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {signalen.map((s, i) => (
          <span key={i} style={{ fontSize: 11, color: s.k, background: s.k + "15",
            border: `1px solid ${s.k}30`, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
            {s.label}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { l: "HRV", v: vandaag.hrv ? `${vandaag.hrv} ms` : "—", basis: `basislijn ${hrvBasislijn} ms`, k: "#a78bfa",
            delta: vandaag.hrv ? vandaag.hrv - hrvBasislijn : null },
          { l: "Rusthartslag", v: vandaag.rusthartslag ? `${vandaag.rusthartslag} bpm` : "—",
            basis: `basislijn ${hrBasislijn} bpm`, k: "#4ade80",
            delta: vandaag.rusthartslag ? vandaag.rusthartslag - hrBasislijn : null, invertDelta: true },
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

      {trendLijn.length > 1 && (
        <div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>Hersteltrend — 7 dagen</div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
            <line x1={0} y1={H * 0.4} x2={W} y2={H * 0.4}
              stroke="#166534" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <polyline fill="none" stroke={status.k} strokeWidth="2"
              points={trendLijn.map((t, i) => {
                const x = (i / (trendLijn.length - 1)) * W;
                const y = H - (t.score / 100) * H;
                return `${x},${y}`;
              }).join(" ")} />
            {trendLijn.map((t, i) => {
              const x = (i / (trendLijn.length - 1)) * W;
              const y = H - (t.score / 100) * H;
              const dagK = t.score >= 75 ? "#4ade80" : t.score >= 50 ? "#60a5fa" : t.score >= 30 ? "#fbbf24" : "#ef4444";
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
