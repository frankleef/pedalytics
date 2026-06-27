"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

function classificeerRitType(rit) {
  if (!rit.wattage || !rit.zone_verdeling) return "overig";
  const z4z5 = (rit.zone_verdeling[3] || 0) + (rit.zone_verdeling[4] || 0);
  if (z4z5 >= 15) return "interval";
  if ((rit.zone_verdeling[1] || 0) >= 60) return "duurrit";
  return "overig";
}

export function berekenRpeFeedback(ritten, weken = 4) {
  const cutoff = new Date(Date.now() - weken * 7 * 86400000);
  const recent = (ritten || []).filter(r => r.rpe && r.datum_iso && new Date(r.datum_iso) >= cutoff);

  const perType = { duurrit: [], interval: [], overig: [] };
  recent.forEach(r => {
    const type = classificeerRitType(r);
    perType[type].push(r);
  });

  const gemRpe = (arr) => arr.length > 0 ? Math.ceil(arr.reduce((s, r) => s + r.rpe, 0) / arr.length) : null;

  const duurRpe = gemRpe(perType.duurrit);
  const intervalRpe = gemRpe(perType.interval);

  const aanpassingen = [];

  if (duurRpe && duurRpe > 7 && perType.duurrit.length >= 3) {
    aanpassingen.push({
      type: "z2_verlaging",
      kleur: "#fbbf24",
      tekst: `Duurritten voelen zwaar (RPE ${duurRpe}/10). Overweeg Z2-vermogen met 5W te verlagen.`,
    });
  }

  if (intervalRpe && intervalRpe < 5 && perType.interval.length >= 2) {
    aanpassingen.push({
      type: "interval_verhoging",
      kleur: "#4ade80",
      tekst: `Intervallen voelen licht (RPE ${intervalRpe}/10). Doelintensiteit kan omhoog.`,
    });
  }

  if (intervalRpe && intervalRpe > 8 && perType.interval.length >= 2) {
    aanpassingen.push({
      type: "interval_verlaging",
      kleur: "#ef4444",
      tekst: `Intervallen zijn erg zwaar (RPE ${intervalRpe}/10). Terug naar sweetspot-intensiteit.`,
    });
  }

  return {
    duurrit: { rpe: duurRpe, aantal: perType.duurrit.length },
    interval: { rpe: intervalRpe, aantal: perType.interval.length },
    overig: { rpe: gemRpe(perType.overig), aantal: perType.overig.length },
    aanpassingen,
    rpePerWeek: berekenRpePerWeek(ritten),
  };
}

function berekenRpePerWeek(ritten, weken = 6) {
  const result = [];
  for (let w = weken - 1; w >= 0; w--) {
    const weekStart = new Date(Date.now() - (w + 1) * 7 * 86400000);
    const weekEind = new Date(Date.now() - w * 7 * 86400000);
    const weekRitten = (ritten || []).filter(r => {
      if (!r.rpe || !r.datum_iso) return false;
      const d = new Date(r.datum_iso);
      return d >= weekStart && d < weekEind;
    });
    const gem = weekRitten.length > 0 ? Math.ceil(weekRitten.reduce((s, r) => s + r.rpe, 0) / weekRitten.length) : null;
    result.push({ week: `W${weken - w}`, rpe: gem, aantal: weekRitten.length });
  }
  return result;
}

export default function RpeFeedbackPanel({ ritten }) {
  const feedback = berekenRpeFeedback(ritten);
  if (!feedback.duurrit.rpe && !feedback.interval.rpe) return null;

  const tooltipStyle = { background: "#0e1521", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 };

  return (
    <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>RPE feedback</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>Hoe zwaar voelen trainingen — laatste 4 weken</div>

      {/* RPE per type */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { l: "Duurritten", rpe: feedback.duurrit.rpe, n: feedback.duurrit.aantal, k: "#60a5fa" },
          { l: "Intervallen", rpe: feedback.interval.rpe, n: feedback.interval.aantal, k: "#f97316" },
          { l: "Overig", rpe: feedback.overig.rpe, n: feedback.overig.aantal, k: "#94a3b8" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#07111d", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.rpe ? (s.rpe >= 8 ? "#ef4444" : s.rpe >= 6 ? "#fbbf24" : "#4ade80") : "#475569" }}>
              {s.rpe || "—"}
            </div>
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{s.l} ({s.n})</div>
          </div>
        ))}
      </div>

      {/* RPE trend per week */}
      {feedback.rpePerWeek.filter(w => w.rpe).length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>RPE trend per week</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={feedback.rpePerWeek} barCategoryGap="25%">
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 9 }} />
              <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 9 }} width={25} tickCount={3} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "RPE gem."]} />
              <ReferenceLine y={7} stroke="#fbbf2440" strokeDasharray="4 3" />
              <Bar dataKey="rpe" radius={[3, 3, 0, 0]}>
                {feedback.rpePerWeek.map((w, i) => (
                  <Cell key={i} fill={w.rpe ? (w.rpe >= 8 ? "#ef4444" : w.rpe >= 6 ? "#fbbf24" : "#4ade80") : "#1e293b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aanpassingen */}
      {feedback.aanpassingen.map((a, i) => (
        <div key={i} style={{ fontSize: 12, color: a.kleur, lineHeight: 1.5, background: a.kleur + "15", borderRadius: 8, padding: "8px 10px", borderLeft: `3px solid ${a.kleur}`, marginBottom: i < feedback.aanpassingen.length - 1 ? 8 : 0 }}>
          {a.tekst}
        </div>
      ))}

      {feedback.aanpassingen.length === 0 && (
        <div style={{ fontSize: 11, color: "#475569" }}>
          Geen aanpassingen nodig — RPE is in balans met de trainingsbelasting.
        </div>
      )}
    </div>
  );
}
