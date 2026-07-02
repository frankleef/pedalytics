"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { T } from "../../../../../designTokens";
import ArchetypeBuilder from "../../../../../components/admin/ArchetypeBuilder";

export default function ArchetypeBewerken() {
  const router = useRouter();
  const params = useParams();
  const { sessietype, id } = params;

  const [archetype, setArchetype] = useState(undefined);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    fetch("/api/admin/archetypes").then(r => r.json()).then(d => {
      if (!d.success) { setFout(d.error); return; }
      const gevonden = (d.data[sessietype] || []).find(a => a.id === id);
      setArchetype(gevonden ?? null);
    }).catch(e => setFout(e.message));
  }, [sessietype, id]);

  if (fout) return <div style={{ minHeight: "100vh", background: T.bg, padding: 40, textAlign: "center", color: "#dc2626" }}>{fout}</div>;
  if (archetype === undefined) return <div style={{ minHeight: "100vh", background: T.bg, padding: 40, textAlign: "center", color: T.textTert }}>Laden…</div>;
  if (archetype === null) return <div style={{ minHeight: "100vh", background: T.bg, padding: 40, textAlign: "center", color: T.textSec }}>Archetype "{id}" niet gevonden in sessietype "{sessietype}".</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <ArchetypeBuilder
        sessietype={sessietype}
        archetypeInitial={archetype}
        onOpgeslagen={() => router.push("/admin/archetypes")}
      />
    </div>
  );
}
