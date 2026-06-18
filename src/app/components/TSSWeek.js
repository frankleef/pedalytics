"use client";

export default function TSSWeekPanel({ ritten, schema }) {
  if (!ritten) return null;

  // TSS deze week
  const nu = new Date();
  const maandag = new Date(nu);
  maandag.setDate(nu.getDate() - nu.getDay() + 1);
  maandag.setHours(0, 0, 0, 0);

  const rittenDezeWeek = ritten.filter(r => {
    if (!r.datum_iso) return false;
    return new Date(r.datum_iso) >= maandag;
  });

  const tssDezeWeek = Math.round(rittenDezeWeek.reduce((s, r) => s + (r.tss || 0), 0));

  // Doel TSS berekenen uit schema
  const tssDoel = schema?.schema
    ? schema.schema.reduce((s, dag) => s + (dag.tss_doel || 0), 0)
    : null;

  const pct = tssDoel ? Math.min(100, Math.round((tssDezeWeek / tssDoel) * 100)) : null;

  // TSS per dag deze week
  const DAGNAMEN = ["Ma","Di","Wo","Do","Vr","Za","Zo"];
  const tssPerDag = Array(7).fill(0);
  const doelPerDag = Array(7).fill(0);

  rittenDezeWeek.forEach(r => {
    const dag = new Date(r.datum_iso).getDay();
    const idx = dag === 0 ? 6 : dag - 1;
    tssPerDag[idx] += r.tss || 0;
  });

  schema?.schema?.forEach(dag => {
    const idx = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"].indexOf(dag.dag);
    if (idx >= 0 && dag.tss_doel) doelPerDag[idx] = dag.tss_doel;
  });

  const vandaagIdx = nu.getDay() === 0 ? 6 : nu.getDay() - 1;
  const maxTss = Math.max(...tssPerDag, ...doelPerDag, 100);

  return (
    <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
        TSS deze week
      </div>

      {/* Totaal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, color: pct >= 100 ? "#4ade80" : pct >= 75 ? "#60a5fa" : pct >= 50 ? "#fbbf24" : "#e2e8f0", letterSpacing: -2 }}>
            {tssDezeWeek}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {tssDoel ? `van doel ${tssDoel} TSS` : "TSS tot nu toe"}
          </div>
        </div>
        {pct !== null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: pct >= 100 ? "#4ade80" : "#94a3b8" }}>{pct}%</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>van weekdoel</div>
          </div>
        )}
      </div>

      {/* Voortgangsbalk */}
      {tssDoel && (
        <div style={{ background: "#1e293b", borderRadius: 6, height: 10, marginBottom: 14, overflow: "hidden" }}>
          <div style={{
            width: `${Math.min(100, pct)}%`,
            background: pct >= 100 ? "#4ade80" : pct >= 75 ? "#60a5fa" : "#3b82f6",
            height: 10, borderRadius: 6, transition: "width 0.8s",
          }} />
        </div>
      )}

      {/* Per dag staafdiagram */}
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 60 }}>
        {DAGNAMEN.map((dag, i) => {
          const isVandaag = i === vandaagIdx;
          const isGeweest = i < vandaagIdx;
          const tss = Math.round(tssPerDag[i]);
          const doel = doelPerDag[i];
          const staafH = tss > 0 ? Math.max(4, (tss / maxTss) * 56) : 0;
          const doelH = doel > 0 ? Math.max(2, (doel / maxTss) * 56) : 0;

          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              {tss > 0 && <div style={{ fontSize: 8, color: "#94a3b8", fontWeight: 600 }}>{tss}</div>}
              <div style={{ width: "100%", display: "flex", alignItems: "flex-end", gap: 1, height: 56 }}>
                {/* Doel staaf (licht) */}
                {doel > 0 && (
                  <div style={{ flex: 1, height: doelH, background: "#1e293b", borderRadius: "2px 2px 0 0", border: "1px solid #374151" }} />
                )}
                {/* Werkelijk staaf */}
                {tss > 0 && (
                  <div style={{ flex: 1, height: staafH,
                    background: tss >= doel * 0.9 ? "#4ade80" : isVandaag ? "#3b82f6" : isGeweest ? "#1d4ed8" : "#1e293b",
                    borderRadius: "2px 2px 0 0" }} />
                )}
              </div>
              <div style={{ fontSize: 9, color: isVandaag ? "#60a5fa" : "#475569", fontWeight: isVandaag ? 700 : 400 }}>
                {dag}
              </div>
            </div>
          );
        })}
      </div>

      {tssDoel && (
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 6, background: "#1e293b", border: "1px solid #374151", borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>Doel</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 6, background: "#1d4ed8", borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>Werkelijk</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 6, background: "#4ade80", borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>Doel gehaald</span>
          </div>
        </div>
      )}
    </div>
  );
}
