"use client";

const ZONES = [
  { naam: "Z1", label: "Herstel", k: "#4ade80", min: 0, max: 128 },
  { naam: "Z2", label: "Duur", k: "#60a5fa", min: 128, max: 156 },
  { naam: "Z3", label: "Tempo", k: "#fbbf24", min: 156, max: 175 },
  { naam: "Z4", label: "Drempel", k: "#f97316", min: 175, max: 184 },
  { naam: "Z5", label: "VO2max", k: "#ef4444", min: 184, max: 999 },
];

function classificeerRit(verdeling) {
  if (!verdeling) return null;
  const z2pct = verdeling[1] || 0;
  const z3pct = verdeling[2] || 0;
  const z4pct = verdeling[3] || 0;
  const z5pct = verdeling[4] || 0;
  const zwaar = z4pct + z5pct;
  const grijs = z3pct;

  if (z2pct >= 75) return { label: "Duurrit ✓", k: "#4ade80", advies: null };
  if (zwaar >= 15 && grijs < 20) return { label: "Intervalrit ⚡", k: "#f97316", advies: null };
  if (grijs >= 25) return { label: "Gemengd ⚠️", k: "#fbbf24", advies: "Te veel Z3 — houd volgende duurrit onder 155 bpm" };
  return { label: "Gemengd", k: "#fbbf24", advies: null };
}

function ZoneStaaf({ zone, pct }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
      <div style={{ width: 24, fontSize: 10, color: zone.k, fontWeight: 700, flexShrink: 0 }}>{zone.naam}</div>
      <div style={{ flex: 1, background: "#1e293b", borderRadius: 3, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: zone.k, height: 8, borderRadius: 3,
          transition: "width 0.5s", opacity: pct < 2 ? 0.3 : 1 }} />
      </div>
      <div style={{ width: 32, fontSize: 10, color: pct > 5 ? zone.k : "#475569",
        fontWeight: pct > 5 ? 700 : 400, textAlign: "right", flexShrink: 0 }}>
        {pct > 0 ? `${pct}%` : ""}
      </div>
    </div>
  );
}

export default function ZoneVerdelingPanel({ ritten }) {
  // Filter ritten met voldoende data, meest recent eerst
  const metZones = ritten
    .filter(r => r.zone_verdeling && r.snelheid)
    .slice(0, 8);

  // Gemiddelde Z2% over recente ritten
  const gemZ2 = metZones.length > 0
    ? Math.round(metZones.reduce((s, r) => s + (r.zone_verdeling[1] || 0), 0) / metZones.length)
    : null;

  if (metZones.length === 0) {
    // Toon toch de legenda en uitleg
    return (
      <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
          Hartslagzones per rit
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Zones worden geladen zodra ritten met hartslag beschikbaar zijn van intervals.icu.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>
            Hartslagzones per rit
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Doel: {">"} 75% in Z2 bij duurritten
          </div>
        </div>
        {gemZ2 !== null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: gemZ2 >= 65 ? "#4ade80" : gemZ2 >= 50 ? "#fbbf24" : "#ef4444" }}>
              {gemZ2}%
            </div>
            <div style={{ fontSize: 10, color: "#64748b" }}>gem. Z2</div>
          </div>
        )}
      </div>

      {metZones.map((rit, i) => {
        const classificatie = classificeerRit(rit.zone_verdeling);
        return (
          <div key={i} style={{ marginBottom: 14, paddingBottom: 14,
            borderBottom: i < metZones.length - 1 ? "1px solid #1e293b" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{rit.datum}</span>
                <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}>{rit.naam}</span>
              </div>
              {classificatie && (
                <span style={{ fontSize: 11, color: classificatie.k, fontWeight: 700 }}>
                  {classificatie.label}
                </span>
              )}
            </div>

            {ZONES.map((zone, zi) => {
              const pct = Math.round(rit.zone_verdeling[zi] || 0);
              return <ZoneStaaf key={zi} zone={zone} pct={pct} />;
            })}

            {classificatie?.advies && (
              <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 6, padding: "4px 8px",
                background: "#fbbf2415", borderRadius: 6, borderLeft: "2px solid #fbbf24" }}>
                💡 {classificatie.advies}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
