"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Cell } from "recharts";

export default function TSSWeekPanel({ ritten, schema, ctl }) {
  if (!ritten) return null;

  const nu = new Date();
  const maandag = new Date(nu);
  maandag.setDate(nu.getDate() - nu.getDay() + 1);
  maandag.setHours(0, 0, 0, 0);

  const rittenDezeWeek = ritten.filter(r => r.datum_iso && new Date(r.datum_iso) >= maandag);
  const tssDezeWeek = Math.round(rittenDezeWeek.reduce((s, r) => s + (r.tss || 0), 0));

  const tssDoel = schema?.schema
    ? schema.schema.reduce((s, dag) => s + (dag.tss_doel || 0), 0)
    : null;

  // CTL-based target range
  const ctlWaarde = Math.round(ctl || 0);
  const tssLaag = ctlWaarde ? Math.round(ctlWaarde * 5) : null;
  const tssIdeaal = ctlWaarde ? Math.round(ctlWaarde * 7) : null;
  const tssHoog = ctlWaarde ? Math.round(ctlWaarde * 9) : null;
  const doelTss = tssDoel || tssIdeaal;

  const pct = doelTss ? Math.min(100, Math.round((tssDezeWeek / doelTss) * 100)) : null;

  const DAGNAMEN = ["Ma","Di","Wo","Do","Vr","Za","Zo"];
  const vandaagIdx = nu.getDay() === 0 ? 6 : nu.getDay() - 1;

  const dagData = DAGNAMEN.map((dag, i) => {
    let tss = 0;
    rittenDezeWeek.forEach(r => {
      const d = new Date(r.datum_iso).getDay();
      const idx = d === 0 ? 6 : d - 1;
      if (idx === i) tss += r.tss || 0;
    });
    let doel = 0;
    schema?.schema?.forEach(s => {
      const idx = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"].indexOf(s.dag);
      if (idx === i && s.tss_doel) doel = s.tss_doel;
    });
    return { dag, tss: Math.round(tss), doel, isVandaag: i === vandaagIdx, isGeweest: i < vandaagIdx };
  });

  const statusKleur = pct >= 100 ? "#4ade80" : pct >= 70 ? "#60a5fa" : pct >= 40 ? "#fbbf24" : "#e2e8f0";

  return (
    <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
        TSS deze week
      </div>

      {/* Totaal + range */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, color: statusKleur, letterSpacing: -2 }}>
            {tssDezeWeek}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {doelTss ? `van ${doelTss} TSS` : "TSS tot nu toe"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {pct !== null && (
            <div style={{ fontSize: 22, fontWeight: 800, color: statusKleur }}>{pct}%</div>
          )}
          {tssLaag && (
            <div style={{ fontSize: 10, color: "#475569" }}>range {tssLaag}–{tssHoog}</div>
          )}
        </div>
      </div>

      {/* Voortgangsbalk met range */}
      {doelTss && (
        <div style={{ position: "relative", background: "#1e293b", borderRadius: 6, height: 12, marginBottom: 14, overflow: "hidden" }}>
          {tssLaag && (
            <div style={{
              position: "absolute", left: `${(tssLaag / tssHoog) * 100}%`, right: `${100 - (tssIdeaal / tssHoog) * 100}%`,
              top: 0, bottom: 0, background: "#4ade8015", borderLeft: "1px dashed #4ade8040", borderRight: "1px dashed #4ade8040",
            }} />
          )}
          <div style={{
            width: `${Math.min(100, tssHoog ? (tssDezeWeek / tssHoog) * 100 : pct)}%`,
            background: tssDezeWeek > tssHoog ? "#ef4444" : tssDezeWeek >= tssLaag ? "#4ade80" : "#3b82f6",
            height: 12, borderRadius: 6,
          }} />
        </div>
      )}

      {/* Per dag met Recharts */}
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={dagData} barCategoryGap="20%">
          <XAxis dataKey="dag" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 10 }} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v, name) => [v, name === "tss" ? "TSS" : "Doel"]}
          />
          {dagData.some(d => d.doel > 0) && (
            <Bar dataKey="doel" fill="#1e293b" stroke="#374151" strokeWidth={1} radius={[3, 3, 0, 0]} />
          )}
          <Bar dataKey="tss" radius={[3, 3, 0, 0]}>
            {dagData.map((d, i) => (
              <Cell key={i} fill={
                d.tss === 0 ? "transparent" :
                d.doel > 0 && d.tss >= d.doel * 0.9 ? "#4ade80" :
                d.isVandaag ? "#3b82f6" :
                d.isGeweest ? "#1d4ed8" : "#1e293b"
              } />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legenda */}
      <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
        {tssLaag && (
          <div style={{ fontSize: 10, color: "#475569" }}>
            Ideaal: {tssLaag}–{tssIdeaal} TSS/week (CTL {ctlWaarde} × 5-7)
          </div>
        )}
      </div>
    </div>
  );
}
