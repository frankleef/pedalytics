"use client";
import { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { T } from "../designTokens";

const CARD = { background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 };
const EYEBROW = { font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.3, color: "oklch(0.62 0.015 75)", textTransform: "uppercase" };
const TICK = { fontSize: 9, fontFamily: "var(--font-nunito), sans-serif", fill: T.textTert };

// Categorische kleuren voor archetype-identiteit binnen één sessietype-balk —
// vaste volgorde (nooit herschikt op rang), rood weggelaten om niet te botsen
// met de rood="fout"-status hieronder in Generatie-betrouwbaarheid. Gevalideerd
// (CVD-veilig) met de dataviz-validator tegen deze kaart-achtergrond.
const CATEGORISCH = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e87ba4", "#eb6834"];
// Status-kleuren — hergebruikt uit T (accent groen) en de amber/rood die de rest
// van de admin-UI al gebruikt, zodat kleurbetekenis consistent blijft.
const STATUS_GOED = T.accent, STATUS_GOED_TXT = T.accentText;
const STATUS_WAARSCHUWING = "oklch(0.74 0.13 95)";
const STATUS_FOUT = "oklch(0.58 0.11 28)";

// Puur client-side (geen import uit lib/volumeCorrectie — die trekt server-only
// modules als getKV/web-push mee in de client-bundle). Zelfde ISO 8601-formule.
function isoWeekLabel(datumStr) {
  if (!datumStr) return "";
  const d = new Date(datumStr);
  const dag = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dag);
  const startJaar = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - startJaar) / 86400000 + 1) / 7);
  return `W${week}`;
}

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

function KpiStrip({ kpis }) {
  if (!kpis) return null;
  const tegels = [
    { label: "Actieve sporters", waarde: kpis.actieveSporters },
    { label: "Sessies gegenereerd · 30d", waarde: kpis.sessiesGegenereerd30d },
    { label: "Gem. voltooiingsratio · 30d", waarde: kpis.gemVoltooiingsratio30d != null ? `${kpis.gemVoltooiingsratio30d}%` : null },
    { label: "Generatiefouten · 30d", waarde: kpis.generatieFouten30d, kleur: kpis.generatieFouten30d > 0 ? STATUS_FOUT : undefined },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
      {tegels.map(t => (
        <div key={t.label} style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "16px 17px", boxShadow: T.cardShadow, display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={{ font: "700 10.5px var(--font-mono, monospace)", letterSpacing: 0.8, color: "oklch(0.6 0.012 76)", textTransform: "uppercase" }}>{t.label}</span>
          <span style={{ font: "800 30px var(--font-nunito), sans-serif", letterSpacing: -1, lineHeight: 0.9, color: t.kleur || "oklch(0.31 0.012 66)" }}>{t.waarde ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function ArchetypeRotatieKaart({ resultaat }) {
  if (resultaat?.error) return <div style={CARD}><span style={EYEBROW}>Archetyperotatie</span><FoutStaat fout={resultaat.error} /></div>;
  const rows = resultaat?.data || [];
  if (rows.length === 0) return <div style={CARD}><span style={EYEBROW}>Archetyperotatie</span><LegeStaat tekst="Nog geen sessie_gegenereerd-events in de laatste 30 dagen." /></div>;

  const perSessietype = {};
  for (const r of rows) {
    (perSessietype[r.sessietype] ||= []).push(r);
  }
  const aantalOvergerepresenteerd = Object.values(perSessietype).filter(archetypes => {
    const totaal = archetypes.reduce((s, a) => s + a.aantal, 0);
    const top = Math.max(...archetypes.map(a => a.aantal));
    return totaal > 0 && top / totaal > 0.5;
  }).length;

  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={EYEBROW}>Archetyperotatie · laatste 30 dagen</span>
        {aantalOvergerepresenteerd > 0 && (
          <span style={{ background: "oklch(0.96 0.035 85)", color: "oklch(0.5 0.09 72)", borderRadius: 999, padding: "4px 11px", fontSize: 11, fontWeight: 800 }}>
            ⚠ {aantalOvergerepresenteerd} type{aantalOvergerepresenteerd > 1 ? "n" : ""} overgerepresenteerd
          </span>
        )}
      </div>
      {Object.entries(perSessietype).map(([sessietype, archetypes]) => {
        const totaal = archetypes.reduce((s, a) => s + a.aantal, 0);
        const gesorteerd = [...archetypes].sort((a, b) => b.aantal - a.aantal);
        const roodVlag = totaal > 0 && gesorteerd[0].aantal / totaal > 0.5;
        return (
          <div key={sessietype} style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, font: "700 13px var(--font-nunito), sans-serif", color: T.text }}>
                {sessietype}
                {roodVlag && <span style={{ background: "oklch(0.96 0.035 85)", color: "oklch(0.5 0.09 72)", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 800 }}>⚠ {gesorteerd[0].archetype_id} &gt;50%</span>}
              </div>
              <span style={{ font: "600 11.5px var(--font-mono, monospace)", color: T.textTert }}>{totaal} totaal</span>
            </div>
            <div style={{ display: "flex", gap: 2, height: 14, borderRadius: 6, overflow: "hidden", background: "oklch(0.94 0.008 84)", marginTop: 8 }}>
              {gesorteerd.map((a, i) => (
                <div key={a.archetype_id} style={{ width: `${(a.aantal / totaal) * 100}%`, background: CATEGORISCH[i % CATEGORISCH.length] }} title={`${a.archetype_id}: ${a.aantal} (${Math.round((a.aantal / totaal) * 100)}%)`} />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8 }}>
              {gesorteerd.map((a, i) => (
                <div key={a.archetype_id} style={{ display: "flex", alignItems: "center", gap: 6, font: "600 11.5px var(--font-nunito), sans-serif" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: CATEGORISCH[i % CATEGORISCH.length], flex: "none" }} />
                  <span style={{ fontFamily: "var(--font-mono, monospace)", color: T.textSec }}>{a.archetype_id}</span>
                  <span style={{ color: T.text, fontWeight: 700 }}>{Math.round((a.aantal / totaal) * 100)}%</span>
                </div>
              ))}
            </div>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 12 }}>
        {Object.entries(perSessietype).map(([sessietype, { voltooid, overgeslagen }]) => {
          const totaal = voltooid + overgeslagen;
          const pct = totaal > 0 ? Math.round((voltooid / totaal) * 100) : 0;
          return (
            <div key={sessietype} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>{sessietype}</span>
                <span style={{ font: "600 11.5px var(--font-mono, monospace)", color: T.textTert }}>
                  {voltooid}/{totaal} · <span style={{ fontWeight: 700, color: pct >= 70 ? STATUS_GOED_TXT : pct >= 40 ? "oklch(0.5 0.1 80)" : STATUS_FOUT }}>{pct}%</span>
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "oklch(0.93 0.008 82)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct >= 70 ? STATUS_GOED : pct >= 40 ? STATUS_WAARSCHUWING : STATUS_FOUT, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GeneratieBetrouwbaarheidKaart({ resultaat }) {
  if (resultaat?.error) return <div style={CARD}><span style={EYEBROW}>Generatie-betrouwbaarheid</span><FoutStaat fout={resultaat.error} /></div>;
  const rows = resultaat?.data || [];

  const perDag = {};
  for (const r of rows) {
    const d = (perDag[r.dag?.slice(0, 10)] ||= { fouten: 0, duurCap: 0 });
    if (r.event === "duur_cap_toegepast") d.duurCap += r.aantal;
    else d.fouten += r.aantal;
  }

  // Volledig 30-daags rooster (ook dagen zonder events tellen mee als "schoon").
  const dagen = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dagen.push(d.toISOString().slice(0, 10));
  }

  let schoon = 0, duurCapDagen = 0, foutDagen = 0;
  const cellen = dagen.map(dag => {
    const info = perDag[dag];
    const status = info?.fouten > 0 ? "fout" : info?.duurCap > 0 ? "duur_cap" : "schoon";
    if (status === "fout") foutDagen++; else if (status === "duur_cap") duurCapDagen++; else schoon++;
    return { dag, status, info };
  });

  const kleur = { schoon: STATUS_GOED, duur_cap: STATUS_WAARSCHUWING, fout: STATUS_FOUT };

  return (
    <div style={CARD}>
      <span style={EYEBROW}>Generatie-betrouwbaarheid · laatste 30 dagen</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
        {cellen.map(c => (
          <div
            key={c.dag}
            title={`${c.dag}: ${c.info?.fouten || 0} fout(en) · ${c.info?.duurCap || 0} duur-cap(s)`}
            style={{ width: 20, height: 20, borderRadius: 5, background: kleur[c.status] }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
        {[["schoon", schoon, STATUS_GOED], ["duur-cap", duurCapDagen, STATUS_WAARSCHUWING], ["fout", foutDagen, STATUS_FOUT]].map(([label, aantal, kl]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ font: "800 20px var(--font-nunito), sans-serif", color: "oklch(0.36 0.012 68)" }}>{aantal}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: kl }} />{label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TssProgressieKaart({ resultaat }) {
  if (resultaat?.error) return <div style={CARD}><span style={EYEBROW}>TSS-progressie</span><FoutStaat fout={resultaat.error} /></div>;
  const rows = (resultaat?.data || []).map(r => ({ ...r, weekLabel: isoWeekLabel(r.week) }));
  if (rows.length === 0) return <div style={CARD}><span style={EYEBROW}>TSS-progressie</span><LegeStaat tekst="Nog geen data — sessie_voltooid wordt momenteel niet gelogd." /></div>;

  return (
    <div style={CARD}>
      <span style={EYEBROW}>TSS-progressie · per week</span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={rows} margin={{ top: 8, right: 5, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
          <XAxis dataKey="weekLabel" tick={TICK} tickLine={false} axisLine={false} />
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
  const rows = (resultaat?.data || []).map(r => ({ ...r, weekLabel: isoWeekLabel(r.week) }));
  if (rows.length === 0) return <div style={CARD}><span style={EYEBROW}>Uitvoeringsscore-trend</span><LegeStaat tekst="Nog geen data — sessie_voltooid wordt momenteel niet gelogd." /></div>;

  return (
    <div style={CARD}>
      <span style={EYEBROW}>Uitvoeringsscore-trend · per week</span>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={rows} margin={{ top: 8, right: 5, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.012 82)" vertical={false} />
          <XAxis dataKey="weekLabel" tick={TICK} tickLine={false} axisLine={false} />
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
    <div style={{ padding: "24px 30px 40px", font: "600 14px var(--font-nunito), sans-serif", color: T.text }}>
      {!data && <p style={{ color: T.textTert }}>Laden…</p>}
      {data && (
        <>
          <KpiStrip kpis={data.kpis} />
          <ArchetypeRotatieKaart resultaat={data.archetypeRotatie} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <VoltooiingsratioKaart resultaat={data.voltooiingsratio} />
            <GeneratieBetrouwbaarheidKaart resultaat={data.generatieBetrouwbaarheid} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <TssProgressieKaart resultaat={data.tssProgressie} />
            <UitvoeringsscoreTrendKaart resultaat={data.uitvoeringsscoreTrend} />
          </div>
        </>
      )}
    </div>
  );
}
