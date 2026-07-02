"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { T } from "../../../designTokens";
import ArchetypeBuilder from "../../../components/admin/ArchetypeBuilder";
import { GELDIGE_SESSIETYPES_LIJST } from "../../../components/admin/archetypeAdmin";

export default function NieuwArchetype() {
  const router = useRouter();
  const [sessietype, setSessietype] = useState(GELDIGE_SESSIETYPES_LIJST[0]);
  const [modus, setModus] = useState("nieuw"); // 'nieuw' | 'variant'
  const [alleArchetypes, setAlleArchetypes] = useState(null);
  const [bestaandeArchetypeId, setBestaandeArchetypeId] = useState("");
  const [fout, setFout] = useState(null);

  useEffect(() => {
    if (modus !== "variant" || alleArchetypes) return;
    fetch("/api/admin/archetypes").then(r => r.json()).then(d => {
      if (d.success) setAlleArchetypes(d.data);
      else setFout(d.error);
    }).catch(e => setFout(e.message));
  }, [modus, alleArchetypes]);

  const kandidaten = alleArchetypes?.[sessietype] ?? [];
  const gekozenArchetype = kandidaten.find(a => a.id === bestaandeArchetypeId) ?? null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 0" }}>
      <div style={{ maxWidth: 480, margin: "0 auto 8px" }}>
        <div style={{ display: "flex", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 3, marginBottom: 4 }}>
          <button onClick={() => setModus("nieuw")} style={segButtonStyle(modus === "nieuw")}>Nieuw archetype</button>
          <button onClick={() => setModus("variant")} style={segButtonStyle(modus === "variant")}>Variant op bestaand archetype</button>
        </div>

        {modus === "variant" && (
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <select value={sessietype} onChange={e => { setSessietype(e.target.value); setBestaandeArchetypeId(""); }} style={selectStyle}>
              {GELDIGE_SESSIETYPES_LIJST.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={bestaandeArchetypeId} onChange={e => setBestaandeArchetypeId(e.target.value)} style={selectStyle} disabled={!alleArchetypes}>
              <option value="">{alleArchetypes ? "Kies een archetype…" : "Laden…"}</option>
              {kandidaten.map(a => <option key={a.id} value={a.id}>{a.naam}</option>)}
            </select>
          </div>
        )}
        {fout && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{fout}</div>}
      </div>

      {modus === "nieuw" && (
        <ArchetypeBuilder
          sessietype={sessietype}
          onSessietypeChange={setSessietype}
          archetypeInitial={null}
          onOpgeslagen={() => router.push("/admin/archetypes")}
        />
      )}

      {modus === "variant" && gekozenArchetype && (
        <ArchetypeBuilder
          key={gekozenArchetype.id}
          sessietype={sessietype}
          archetypeInitial={gekozenArchetype}
          autoNieuweVariant
          onOpgeslagen={() => router.push("/admin/archetypes")}
        />
      )}
    </div>
    </div>
  );
}

const segButtonStyle = (actief) => ({
  flex: 1, border: "none", background: actief ? T.slate : "transparent", color: actief ? "oklch(0.97 0.01 84)" : T.textSec,
  padding: "9px 10px", borderRadius: 9, font: "700 13px var(--font-nunito), sans-serif", cursor: "pointer",
});
const selectStyle = {
  flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.cardBorder}`, background: T.cardBg,
  color: T.text, font: "600 13px var(--font-nunito), sans-serif",
};
