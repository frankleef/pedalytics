"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { T } from "../../designTokens";
import { SESSIETYPE_LABELS, GELDIGE_SESSIETYPES_LIJST } from "../../components/admin/archetypeAdmin";

export default function ArchetypesOverzicht() {
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  const [verwijderBezig, setVerwijderBezig] = useState(null);

  function laad() {
    fetch("/api/admin/archetypes").then(r => r.json()).then(d => {
      if (d.success) setData(d.data);
      else setFout(d.error || "Laden mislukt");
    }).catch(e => setFout(e.message));
  }

  useEffect(() => { laad(); }, []);

  async function verwijder(sessietype, archetypeId) {
    if (!confirm(`Archetype "${archetypeId}" verwijderen?`)) return;
    setVerwijderBezig(archetypeId);
    try {
      const resp = await fetch(`/api/admin/archetypes/${sessietype}/${archetypeId}`, { method: "DELETE" });
      const d = await resp.json();
      if (!d.success) throw new Error(d.error);
      laad();
    } catch (e) {
      setFout(e.message);
    } finally {
      setVerwijderBezig(null);
    }
  }

  if (fout === "Forbidden" || fout === "Unauthorized") {
    return <div style={{ padding: 40, textAlign: "center", color: T.textSec }}>Geen toegang.</div>;
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 60px", font: "600 14px var(--font-nunito), sans-serif", color: T.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ font: "800 24px var(--font-nunito), sans-serif", margin: 0 }}>Sessie-archetypes</h1>
        <Link href="/admin/archetypes/nieuw" style={nieuwKnopStyle}>+ Nieuw archetype</Link>
      </div>

      {fout && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: 14, marginBottom: 16, color: "#dc2626", fontSize: 13 }}>{fout}</div>}
      {!data && !fout && <p style={{ color: T.textTert }}>Laden…</p>}

      {data && GELDIGE_SESSIETYPES_LIJST.map(sessietype => (
        <div key={sessietype} style={{ marginBottom: 22 }}>
          <h2 style={{ font: "800 14px var(--font-nunito), sans-serif", color: T.textSec, margin: "0 0 10px" }}>
            {SESSIETYPE_LABELS[sessietype]} <span style={{ color: T.textTert, fontWeight: 600 }}>({(data[sessietype] || []).length})</span>
          </h2>
          <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, overflow: "hidden", boxShadow: T.cardShadow }}>
            {(data[sessietype] || []).length === 0 && (
              <div style={{ padding: 16, color: T.textTert, fontSize: 13 }}>Nog geen archetypes.</div>
            )}
            {(data[sessietype] || []).map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: i < data[sessietype].length - 1 ? `1px solid ${T.divider}` : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.naam}</div>
                  <div style={{ fontSize: 12, color: T.textTert, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.structuur}</div>
                  <div style={{ fontSize: 11, color: T.textTert, marginTop: 2 }}>
                    {a.id} · TSS {a.tss_range?.[0]}-{a.tss_range?.[1]} · {(a.varianten || []).length} variant(en)
                    {a.aangemaakt_via && <> · {a.aangemaakt_via}</>}
                  </div>
                </div>
                <Link href={`/admin/archetypes/${sessietype}/${a.id}/bewerken`} style={secKnopStyle}>Bewerken</Link>
                <button onClick={() => verwijder(sessietype, a.id)} disabled={verwijderBezig === a.id} style={{ ...secKnopStyle, color: "#dc2626", borderColor: "#fecaca" }}>
                  {verwijderBezig === a.id ? "…" : "Verwijderen"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const nieuwKnopStyle = {
  padding: "10px 18px", borderRadius: 999, background: T.slate, color: "oklch(0.97 0.01 84)",
  font: "700 13px var(--font-nunito), sans-serif", textDecoration: "none",
};
const secKnopStyle = {
  padding: "8px 14px", borderRadius: 999, border: `1.5px solid ${T.cardBorder}`, background: T.cardBg,
  color: T.textSec, font: "700 12px var(--font-nunito), sans-serif", textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap",
};
