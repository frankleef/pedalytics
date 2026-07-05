"use client";
import { useState, useEffect, useCallback } from "react";
import { T } from "../../../designTokens";
import { SESSIETYPE_LABELS } from "../../../components/admin/archetypeAdmin";
import { datumISO } from "@/lib/datum";

const CARD = { background: T.cardBg, borderRadius: T.cardRadius, padding: "18px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 };
const EYEBROW = { font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase", display: "block", marginBottom: 10 };
const RIJ = { display: "flex", justifyContent: "space-between", gap: 12, font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, padding: "5px 0" };
const LABEL_SESSIETYPE = (v) => v ? (SESSIETYPE_LABELS[v] || v) : "—";

function Rij({ label, waarde }) {
  return (
    <div style={RIJ}>
      <span style={{ color: T.textTert }}>{label}</span>
      <span style={{ color: T.text, fontWeight: 700, textAlign: "right" }}>{waarde ?? "—"}</span>
    </div>
  );
}

export default function DagIntentieDebug() {
  const [datum, setDatum] = useState(() => datumISO(new Date()));
  const [ingevoerdeDatum, setIngevoerdeDatum] = useState(datum);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  const [laden, setLaden] = useState(false);

  const haalOp = useCallback((d) => {
    setLaden(true);
    setFout(null);
    setData(null);
    fetch(`/api/debug/dag-intentie?datum=${d}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) { setFout(body.error || `Fout (${r.status})`); return; }
        setData(body);
      })
      .catch((e) => setFout(e.message))
      .finally(() => setLaden(false));
  }, []);

  useEffect(() => { haalOp(datum); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 60px", font: "600 14px var(--font-nunito), sans-serif", color: T.text }}>
      <h1 style={{ font: "800 24px var(--font-nunito), sans-serif", margin: "0 0 20px" }}>Dag-intentie debug</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); setDatum(ingevoerdeDatum); haalOp(ingevoerdeDatum); }}
        style={{ display: "flex", gap: 10, marginBottom: 20 }}
      >
        <input
          type="date"
          value={ingevoerdeDatum}
          onChange={(e) => setIngevoerdeDatum(e.target.value)}
          style={{ border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: "9px 12px", font: "700 13px var(--font-nunito), sans-serif", color: T.text, background: T.cardBg }}
        />
        <button type="submit" disabled={laden} style={{
          border: "none", borderRadius: 12, background: T.slate, color: T.cardBg, padding: "9px 18px",
          font: "800 13px var(--font-nunito), sans-serif", cursor: laden ? "default" : "pointer", opacity: laden ? 0.6 : 1,
        }}>
          {laden ? "Laden…" : "Opvragen"}
        </button>
      </form>

      {fout && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: T.cardRadius, padding: 16, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {fout}
        </div>
      )}

      {data && (
        <>
          {data.sessietype_afwijking && (
            <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: T.cardRadius, padding: "12px 16px", marginBottom: 16, color: "#dc2626", font: "800 13px var(--font-nunito), sans-serif" }}>
              ⚠ Sessietype-afwijking — gepland was &quot;{LABEL_SESSIETYPE(data.dag_intentie.sessietype)}&quot;, gegenereerd werd &quot;{LABEL_SESSIETYPE(data.gegenereerde_sessie.sessietype)}&quot;.
            </div>
          )}
          {!data.gepland_sessietype_beschikbaar && (
            <div style={{ background: T.subtleFill, borderRadius: T.cardRadius, padding: "10px 16px", marginBottom: 16, color: T.textTert, fontSize: 12.5 }}>
              Deze sessie is gegenereerd vóór dat afwijkingen apart bijgehouden werden — een eventuele afwijking t.o.v. het oorspronkelijke plan is voor deze datum niet meer zichtbaar.
            </div>
          )}

          <div style={CARD}>
            <span style={EYEBROW}>Dag-intentie</span>
            <Rij label="Rol" waarde={data.dag_intentie.rol} />
            <Rij label="Sessietype" waarde={LABEL_SESSIETYPE(data.dag_intentie.sessietype)} />
            <Rij label="Toegestane zones" waarde={data.dag_intentie.toegestane_zones?.join(", ")} />
            <Rij label="TSS-range" waarde={data.dag_intentie.tss_range ? `${data.dag_intentie.tss_range.min}–${data.dag_intentie.tss_range.max}` : null} />
            <Rij label="Toelichting" waarde={data.dag_intentie.toelichting} />
          </div>

          <div style={CARD}>
            <span style={EYEBROW}>Gegenereerde sessie</span>
            {!data.gegenereerde_sessie.archetype_id ? (
              <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textTert, margin: 0 }}>Nog niet gegenereerd.</p>
            ) : (
              <>
                <Rij label="Sessietype" waarde={LABEL_SESSIETYPE(data.gegenereerde_sessie.sessietype)} />
                <Rij label="Archetype" waarde={data.gegenereerde_sessie.archetype_id} />
                <Rij label="Duur" waarde={data.gegenereerde_sessie.duur_min ? `${data.gegenereerde_sessie.duur_min} min` : null} />
                <Rij label="TSS" waarde={data.gegenereerde_sessie.tss} />
                <Rij label="Aanleiding" waarde={data.gegenereerde_sessie.aanleiding ?? "niet beschikbaar"} />
              </>
            )}
          </div>

          <div style={CARD}>
            <span style={EYEBROW}>Recente archetypes (rotatie op moment van opvragen)</span>
            {data.recente_archetypes_op_moment_van_opvragen.length === 0 ? (
              <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textTert, margin: 0 }}>Geen rotatiedata.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.recente_archetypes_op_moment_van_opvragen.map((id, i) => (
                  <span key={i} style={{ background: T.subtleFill, borderRadius: T.pillRadius, padding: "5px 12px", font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>{id}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
