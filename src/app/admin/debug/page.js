"use client";
import { useState, useEffect, useCallback } from "react";
import { T } from "../../designTokens";
import { datumISO } from "@/lib/datum";
import SporterPicker from "../../components/admin/SporterPicker";
import { DEBUG_TOOLS } from "../../components/admin/debugTools";

// Eigen state per tool, gemount met key={tool.id} — zonder die remount blijft
// data van de vorige tool nog even in de state staan terwijl `tool` al is
// omgeschakeld (setActief ver­nieuwt de render vóór het effect de oude data
// wist), waardoor bv. HrvSysteemPanel data van DagIntentiePanel te zien kreeg
// en crashte op een ontbrekend veld.
function ToolPaneel({ tool, sporterId, datum }) {
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  const [laden, setLaden] = useState(false);

  const haalOp = useCallback(() => {
    if (tool.geenData || !sporterId) return;
    setLaden(true); setFout(null); setData(null);
    fetch(tool.route(sporterId, datum))
      .then(async r => {
        const body = await r.json();
        if (!r.ok || body.error) { setFout(body.error || `Fout (${r.status})`); return; }
        setData(body);
      })
      .catch(e => setFout(e.message))
      .finally(() => setLaden(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, sporterId, datum]);

  useEffect(() => { haalOp(); }, [haalOp]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ font: "800 17px var(--font-nunito), sans-serif", letterSpacing: -0.3, color: "oklch(0.3 0.012 66)" }}>{tool.naam}</span>
        {!tool.geenData && sporterId && (
          <span style={{ font: "600 12px var(--font-mono, monospace)", color: "oklch(0.6 0.012 76)" }}>{tool.route(sporterId, datum)}</span>
        )}
      </div>

      {tool.geenData ? (
        <tool.Panel />
      ) : !sporterId ? (
        <p style={{ color: T.textTert }}>Kies eerst een sporter.</p>
      ) : laden ? (
        <p style={{ color: T.textTert }}>Laden…</p>
      ) : fout ? (
        <div style={{ background: "oklch(0.96 0.03 28)", border: "1px solid oklch(0.88 0.06 28)", borderRadius: T.cardRadius, padding: 16, color: "oklch(0.5 0.13 28)", fontSize: 13 }}>{fout}</div>
      ) : data ? (
        <tool.Panel data={data} />
      ) : null}
    </div>
  );
}

export default function AdminDebug() {
  const [sporterId, setSporterId] = useState("");
  const [datum, setDatum] = useState(() => datumISO(new Date()));
  const [actief, setActief] = useState(DEBUG_TOOLS[0].id);

  const tool = DEBUG_TOOLS.find(t => t.id === actief);

  return (
    <div style={{ padding: "24px 30px 40px", font: "600 14px var(--font-nunito), sans-serif", color: T.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <SporterPicker value={sporterId} onChange={setSporterId} />
        <input
          type="date" value={datum} onChange={e => setDatum(e.target.value)}
          style={{ border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: "9px 12px", font: "700 13px var(--font-nunito), sans-serif", color: T.text, background: T.cardBg }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 22, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ font: "700 10.5px var(--font-nunito), sans-serif", letterSpacing: 1.3, color: "oklch(0.62 0.015 75)", textTransform: "uppercase", paddingBottom: 2 }}>Inspectie-tools</span>
          {DEBUG_TOOLS.map(t => {
            const isActief = t.id === actief;
            return (
              <div
                key={t.id}
                onClick={() => setActief(t.id)}
                style={{
                  borderRadius: 13, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                  background: isActief ? "oklch(0.965 0.008 84)" : "transparent",
                }}
              >
                {isActief && <span style={{ width: 4, height: 30, borderRadius: 999, background: T.accent, flex: "none" }} />}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.34 0.012 66)" }}>{t.naam}</span>
                  <span style={{ font: "500 11px/1.35 var(--font-nunito), sans-serif", color: "oklch(0.56 0.012 74)" }}>{t.beschrijving}</span>
                </div>
              </div>
            );
          })}
        </div>

        <ToolPaneel key={tool.id} tool={tool} sporterId={sporterId} datum={datum} />
      </div>
    </div>
  );
}
