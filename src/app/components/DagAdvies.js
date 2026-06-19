"use client";

export function berekenDagAdvies({ hrv, rusthartslag, tsb, hrvBasislijn = 58, hrBasislijn = 49 }) {
  const hrvPct = hrv ? ((hrvBasislijn - hrv) / hrvBasislijn) * 100 : 0;
  const hrDelta = rusthartslag ? rusthartslag - hrBasislijn : 0;

  if (hrvPct > 20 || hrDelta > 8) {
    return {
      niveau: "rust",
      kleur: "#ef4444",
      icon: "🔴",
      titel: "Rust vandaag",
      advies: "Geen training vandaag. Je lichaam heeft herstel nodig.",
      detail: [
        hrv && hrvPct > 20 ? `HRV ${hrv} ms — ${Math.round(hrvPct)}% onder basislijn` : null,
        rusthartslag && hrDelta > 8 ? `Rusthartslag ${rusthartslag} bpm — ${hrDelta} boven basislijn` : null,
      ].filter(Boolean),
    };
  }

  if (hrvPct > 15 || hrDelta > 5) {
    return {
      niveau: "verschuif",
      kleur: "#f97316",
      icon: "🟠",
      titel: "Verschuif naar morgen",
      advies: "Sla vandaag over. De geplande sessie verschuift naar morgen.",
      detail: [
        hrv && hrvPct > 15 ? `HRV ${hrv} ms — ${Math.round(hrvPct)}% onder basislijn` : null,
        rusthartslag && hrDelta > 5 ? `Rusthartslag ${rusthartslag} bpm — ${hrDelta} boven basislijn` : null,
      ].filter(Boolean),
    };
  }

  if (hrvPct > 5 || hrDelta > 2) {
    return {
      niveau: "aanpassen",
      kleur: "#fbbf24",
      icon: "🟡",
      titel: "Pas licht aan",
      advies: "Rijd 20% korter dan gepland, houd hartslag 5 bpm lager.",
      detail: [
        hrv && hrvPct > 5 ? `HRV ${hrv} ms — ${Math.round(hrvPct)}% onder basislijn` : null,
        rusthartslag && hrDelta > 2 ? `Rusthartslag ${rusthartslag} bpm — ${hrDelta} boven basislijn` : null,
      ].filter(Boolean),
    };
  }

  return {
    niveau: "ga",
    kleur: "#4ade80",
    icon: "🟢",
    titel: "Ga zoals gepland",
    advies: tsb != null && tsb > 5
      ? "Je bent uitgerust en fit — ideaal moment voor een stevige training."
      : "Je lichaam is hersteld. Volg het geplande schema.",
    detail: [
      hrv ? `HRV ${hrv} ms — rond basislijn` : null,
      rusthartslag ? `Rusthartslag ${rusthartslag} bpm — normaal` : null,
    ].filter(Boolean),
  };
}

export default function DagAdviesPanel({ hrv, rusthartslag, tsb, geplandeTraining, hrvBasislijn = 58, hrBasislijn = 49 }) {
  const advies = berekenDagAdvies({ hrv, rusthartslag, tsb, hrvBasislijn, hrBasislijn });

  return (
    <div style={{ background: "#0e1521", border: `1px solid ${advies.kleur}40`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Advies vandaag</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: advies.kleur }}>{advies.icon} {advies.titel}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: advies.detail.length > 0 ? 10 : 0 }}>
        {advies.advies}
      </div>
      {advies.detail.length > 0 && (
        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
          {advies.detail.map((d, i) => <div key={i}>{d}</div>)}
        </div>
      )}
      {geplandeTraining && advies.niveau === "ga" && (
        <div style={{ marginTop: 10, background: "#07111d", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Geplande training</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>{geplandeTraining.titel}</div>
          {geplandeTraining.vermogen && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{geplandeTraining.duur_min && `${geplandeTraining.duur_min}min · `}{geplandeTraining.vermogen}</div>}
        </div>
      )}
      {geplandeTraining && advies.niveau === "aanpassen" && (
        <div style={{ marginTop: 10, background: "#07111d", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 2 }}>Aangepaste training</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{geplandeTraining.titel} (verkort)</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>20% korter, hartslag 5 bpm lager dan gepland</div>
        </div>
      )}
    </div>
  );
}
