"use client";
import { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { T } from "../designTokens";

const CARD = { background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 };
const EYEBROW = { font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.3, color: "oklch(0.62 0.015 75)", textTransform: "uppercase" };
const TICK = { fontSize: 9, fontFamily: "var(--font-nunito), sans-serif", fill: T.textTert };

function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.slate, borderRadius: 10, padding: "6px 12px", font: "700 12px var(--font-nunito), sans-serif", color: "#fff" }}>
      <div style={{ marginBottom: 2, opacity: 0.7 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || "#fff" }}>{p.name}: {p.value}</div>)}
    </div>
  );
}

function LegeStaat({ tekst }) {
  return <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, margin: "8px 0 0" }}>{tekst}</p>;
}

function FoutStaat({ fout }) {
  return <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: "#dc2626", margin: "8px 0 0" }}>Query mislukt: {fout}</p>;
}

function ArchetypeRotatieKaart({ resultaat }) {
  if (resultaat?.error) return <div style={CARD}><span style={EYEBROW}>Archetyperotatie</span><FoutStaat fout={resultaat.error} /></div>;
  const rows = resultaat?.data || [];
  if (rows.length === 0) return <div style={CARD}><span style={EYEBROW}>Archetyperotatie</span><LegeStaat tekst="Nog geen sessie_gegenereerd-events in de laatste 30 dagen." /></div>;

  const perSessietype = {};
  for (const r of rows) {
    (perSessietype[r.sessietype] ||= []).push(r);
  }

  return (
    <div style={CARD}>
      <span style={EYEBROW}>Archetyperotatie · laatste 30 dagen</span>
      {Object.entries(perSessietype).map(([sessietype, archetypes]) => {
        const totaal = archetypes.reduce((s, a) => s + a.aantal, 0);
        const gesorteerd = [...archetypes].sort((a, b) => b.aantal - a.aantal);
        const roodVlag = totaal > 0 && gesorteerd[0].aantal / totaal > 0.5;
        return (
          <div key={sessietype} style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, font: "700 13px var(--font-nunito), sans-serif", color: T.text }}>
              {sessietype}
              {roodVlag && <span style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>⚠ {gesorteerd[0].archetype_id} &gt;50%</span>}
            </div>
            {gesorteerd.map(a => (
              <div key={a.archetype_id} style={{ display: "flex", justifyContent: "space-between", font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, padding: "3px 0" }}>
                <span>{a.archetype_id}</span>
                <span>{a.aantal} ({Math.round((a.aantal / totaal) * 100)}%)</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function VoltooiingsratioKaart({ resultaat }) {
  if (resultaat?.error) return <div style={CARD}><span style={EYEBROW}>Voltooiingsratio</span><FoutStaat fout={resultaat.error} /></div>;
  const rows = resultaat?.data || [];
  if (rows.length === 0) return <div style={CARD}><span style={EYEBROW}>Voltooiingsratio</span><LegeStaat tekst="Nog geen data — sessie_voltooid wordt momenteel niet gelogd (geen server-side vaststelpunt beschikbaar)." /></div>;

  const perSessietype = {};
  for (const r of rows) {
    const s = (perSessietype[r.sessietype] ||= { voltooid: 0, overgeslagen: 0 });
    if (r.event === "sessie_voltooid") s.voltooid += r.aantal;
    else s.overgeslagen += r.aantal;
  }

  return (
    <div style={CARD}>
      <span style={EYEBROW}>Voltooiingsratio · laatste 30 dagen</span>
      {Object.entries(perSessietype).map(([sessietype, { voltooid, overgeslagen }]) => {
        const totaal = voltooid + overgeslagen;
        const pct = totaal > 0 ? Math.round((voltooid / totaal) * 100) : 0;
        return (
          <div key={sessietype} style={{ display: "flex", justifyContent: "space-between", font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, padding: "5px 0" }}>
            <span>{sessietype}</span>
            <span>{pct}% ({voltooid}/{totaal})</span>
          </div>
        );
      })}
    </div>
  );
}

function GeneratieBetrouwbaarheidKaart({ resultaat }) {
  if (resultaat?.error) return <div style={CARD}><span style={EYEBROW}>Generatie-betrouwbaarheid</span><FoutStaat fout={resultaat.error} /></div>;
  const rows = resultaat?.data || [];
  if (rows.length === 0) return <div style={CARD}><span style={EYEBROW}>Generatie-betrouwbaarheid</span><LegeStaat tekst="Geen fouten of duur-caps in de laatste 30 dagen." /></div>;

  const perDag = {};
  for (const r of rows) {
    const d = (perDag[r.dag] ||= { fouten: 0, duurCap: 0 });
    if (r.event === "duur_cap_toegepast") d.duurCap += r.aantal;
    else d.fouten += r.aantal;
  }
  const dagen = Object.keys(perDag).sort();

  return (
    <div style={CARD}>
      <span style={EYEBROW}>Generatie-betrouwbaarheid · laatste 30 dagen</span>
      {dagen.map(dag => (
        <div key={dag} style={{ display: "flex", justifyContent: "space-between", font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, padding: "5px 0" }}>
          <span>{dag}</span>
          <span>{perDag[dag].fouten} fout(en) · {perDag[dag].duurCap} duur-cap(s)</span>
        </div>
      ))}
    </div>
  );
}

function TssProgressieKaart({ resultaat }) {
  if (resultaat?.error) return <div style={CARD}><span style={EYEBROW}>TSS-progressie</span><FoutStaat fout={resultaat.error} /></div>;
  const rows = resultaat?.data || [];
  if (rows.length === 0) return <div style={CARD}><span style={EYEBROW}>TSS-progressie</span><LegeStaat tekst="Nog geen data — sessie_voltooid wordt momenteel niet gelogd." /></div>;

  return (
    <div style={CARD}>
      <span style={EYEBROW}>TSS-progressie · per week</span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={rows} margin={{ top: 8, right: 5, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
          <XAxis dataKey="week" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Line dataKey="tss_werkelijk" stroke="oklch(0.64 0.14 248)" strokeWidth={2.5} dot={{ r: 3 }} name="Werkelijk" />
          <Line dataKey="tss_doel" stroke="oklch(0.72 0.015 75)" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Doel" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function UitvoeringsscoreTrendKaart({ resultaat }) {
  if (resultaat?.error) return <div style={CARD}><span style={EYEBROW}>Uitvoeringsscore-trend</span><FoutStaat fout={resultaat.error} /></div>;
  const rows = resultaat?.data || [];
  if (rows.length === 0) return <div style={CARD}><span style={EYEBROW}>Uitvoeringsscore-trend</span><LegeStaat tekst="Nog geen data — sessie_voltooid wordt momenteel niet gelogd." /></div>;

  return (
    <div style={CARD}>
      <span style={EYEBROW}>Uitvoeringsscore-trend · per week</span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={rows} margin={{ top: 8, right: 5, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
          <XAxis dataKey="week" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Line dataKey="gem_uitvoeringsscore" stroke="oklch(0.64 0.14 248)" strokeWidth={2.5} dot={{ r: 3 }} name="Gem. score" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    fetch("/api/admin/observability")
      .then(r => r.json())
      .then(d => { if (d.error) setFout(d.error); else setData(d); })
      .catch(e => setFout(e.message));
  }, []);

  if (fout) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textSec }}>{fout === "Forbidden" ? "Geen toegang." : fout}</div>;
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 60px", font: "600 14px var(--font-nunito), sans-serif", color: T.text }}>
      {!data && <p style={{ color: T.textTert }}>Laden…</p>}
      {data && (
        <>
          <ArchetypeRotatieKaart resultaat={data.archetypeRotatie} />
          <VoltooiingsratioKaart resultaat={data.voltooiingsratio} />
          <GeneratieBetrouwbaarheidKaart resultaat={data.generatieBetrouwbaarheid} />
          <TssProgressieKaart resultaat={data.tssProgressie} />
          <UitvoeringsscoreTrendKaart resultaat={data.uitvoeringsscoreTrend} />
        </>
      )}
    </div>
  );
}
