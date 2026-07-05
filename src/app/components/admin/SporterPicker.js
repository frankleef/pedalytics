"use client";
import { useState, useEffect } from "react";
import { T } from "../../designTokens";

export default function SporterPicker({ value, onChange }) {
  const [sporters, setSporters] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    fetch("/api/admin/sporters").then(r => r.json()).then(d => {
      if (!d.success) { setFout(d.error || "Laden mislukt"); return; }
      setSporters(d.data);
      if (!value && d.data.length > 0) onChange(d.data[0].id);
    }).catch(e => setFout(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (fout) return <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: "#dc2626" }}>{fout}</span>;

  return (
    <select
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      disabled={!sporters}
      style={{
        border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: "9px 12px",
        font: "700 13px var(--font-nunito), sans-serif", color: T.text, background: T.cardBg,
      }}
    >
      {!sporters && <option>Laden…</option>}
      {sporters?.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}
