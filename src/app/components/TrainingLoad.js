"use client";
import { useState } from "react";
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── TSS berekening per rit ───────────────────────────────────────────────────
export function berekenTSS(duurSeconden, gemWattage, ftp) {
  if (!duurSeconden || !gemWattage || !ftp) return 0;
  const if_ = gemWattage / ftp;
  return Math.round((duurSeconden * gemWattage * if_) / (ftp * 3600) * 100);
}

// ─── CTL/ATL/TSB over een reeks ritten ───────────────────────────────────────
export function berekenTrainingLoad(ritten, ftp = 265) {
  if (!ritten || ritten.length === 0) return [];

  const gesorteerd = [...ritten]
    .filter(r => r.wattage && r.duur_min)
    .sort((a, b) => new Date(a.datum_iso || a.datum) - new Date(b.datum_iso || b.datum));

  if (gesorteerd.length === 0) return [];

  // TSS per dag aggregeren
  const tssPerDag = {};
  gesorteerd.forEach(r => {
    const datum = r.datum_iso || r.datum;
    const tss = berekenTSS((r.duur_min || 0) * 60, r.wattage, ftp);
    tssPerDag[datum] = (tssPerDag[datum] || 0) + tss;
  });

  // Dagelijkse reeks genereren
  const datums = Object.keys(tssPerDag).sort();
  const eerste = new Date(datums[0]);
  const laatste = new Date(datums[datums.length - 1]);

  const resultaat = [];
  let ctl = 0, atl = 0;

  const huidigeDatum = new Date(eerste);
  while (huidigeDatum <= laatste) {
    const datumStr = `${huidigeDatum.getFullYear()}-${String(huidigeDatum.getMonth()+1).padStart(2,"0")}-${String(huidigeDatum.getDate()).padStart(2,"0")}`;
    const tss = tssPerDag[datumStr] || 0;

    ctl = ctl * (1 - 1/42) + tss * (1/42);
    atl = atl * (1 - 1/7)  + tss * (1/7);

    resultaat.push({
      datum: datumStr,
      tss: Math.round(tss),
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
    });

    huidigeDatum.setDate(huidigeDatum.getDate() + 1);
  }

  return resultaat;
}

// ─── TSB status ───────────────────────────────────────────────────────────────
export function tsbStatus(tsb) {
  if (tsb < -30) return { label: "Overbelast",    k: "#ef4444", icon: "🚨", advies: "Rust — blessurerisico is hoog" };
  if (tsb < -10) return { label: "Vermoeid",      k: "#f97316", icon: "😓", advies: "Trainingsblok — nog niet klaar om te pieken" };
  if (tsb <   5) return { label: "In balans",     k: "#fbbf24", icon: "⚖️", advies: "Goed trainingsmoment — lichaam reageert" };
  if (tsb <  25) return { label: "In vorm",       k: "#4ade80", icon: "🚀", advies: "Ideaal voor een PR of groepsrit!" };
  return           { label: "Te uitgerust",        k: "#60a5fa", icon: "😴", advies: "Meer trainen om fitheid vast te houden" };
}

// ─── Grafiek ──────────────────────────────────────────────────────────────────
function LoadGrafiek({ data }) {
  if (!data || data.length < 2) return null;

  const stap = Math.max(1, Math.floor(data.length / 6));
  const chartData = data.map((d, i) => ({
    ...d,
    label: i % stap === 0 ? `${new Date(d.datum).getDate()}/${new Date(d.datum).getMonth() + 1}` : "",
  }));

  const tooltipStyle = { background: "#0e1521", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 };

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 9 }} interval={0} />
        <YAxis hide />
        <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 3" />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={() => ""} formatter={(v, name) => {
          const labels = { ctl: "CTL", atl: "ATL", tsb: "TSB" };
          return [v, labels[name] || name];
        }} />
        <Line type="monotone" dataKey="ctl" stroke="#60a5fa" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="atl" stroke="#f97316" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="tsb" stroke="#4ade80" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Hoofd component ──────────────────────────────────────────────────────────
export default function TrainingLoadPanel({ ritten, ftp = 265 }) {
  const [uitlegOpen, setUitlegOpen] = useState(false);

  const loadData = berekenTrainingLoad(ritten, ftp);
  const huidig = loadData[loadData.length - 1];
  const status = huidig ? tsbStatus(huidig.tsb) : null;

  if (!huidig) {
    return (
      <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Niet genoeg data — ritten met vermogen en duur nodig voor CTL/ATL/TSB.
        </div>
      </div>
    );
  }

  const tssDezeWeek = loadData.slice(-7).reduce((s, d) => s + d.tss, 0);
  const piekCtl = Math.max(...loadData.map(d => d.ctl)).toFixed(1);
  const afgelopenWeek = loadData.slice(-7);
  const maxTss = Math.max(...afgelopenWeek.map(d => d.tss), 1);

  return (
    <div style={{ background: "#0e1521", border: `1px solid ${status.k}40`, borderRadius: 14, padding: 16, marginBottom: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
            Trainingsbelasting
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: status.k }}>
            {status.icon} {status.label}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{status.advies}</div>
        </div>
        <button onClick={() => setUitlegOpen(p => !p)}
          style={{ background: "#1e293b", border: "none", borderRadius: 8,
            padding: "6px 10px", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
          {uitlegOpen ? "Sluit" : "Uitleg"}
        </button>
      </div>

      {/* Uitleg */}
      {uitlegOpen && (
        <div style={{ background: "#07111d", borderRadius: 10, padding: 14, marginBottom: 14,
          fontSize: 12, color: "#94a3b8", lineHeight: 1.8, borderLeft: `3px solid #3b82f6` }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#60a5fa", fontWeight: 700 }}>CTL — Fitheid (42 dagen)</span><br />
            Hoe consistent je de afgelopen 6 weken hebt getraind. Stijgt langzaam bij regelmatig trainen, daalt langzaam bij rust. Dit is je "motor".
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#f97316", fontWeight: 700 }}>ATL — Vermoeidheid (7 dagen)</span><br />
            Hoe zwaar je de afgelopen week hebt getraind. Reageert snel — zware week = hoge ATL, twee rustdagen = ATL daalt.
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>TSB — Vorm (CTL min ATL)</span><br />
            De balans tussen fitheid en vermoeidheid. Negatief = je bent moe. Positief = je bent uitgerust én fit. Voor een PR wil je +5 tot +25.
          </div>
          <div style={{ borderTop: "1px solid #1e293b", paddingTop: 8 }}>
            <span style={{ color: "#e2e8f0", fontWeight: 700 }}>TSS per rit</span> = hoe zwaar een rit was ten opzichte van jouw FTP ({ftp}W). Eén uur op FTP = 100 TSS. Jouw Z2-ritten scoren typisch 60-90 TSS.
          </div>
        </div>
      )}

      {/* Drie getallen */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "CTL", waarde: huidig.ctl, sub: "Fitheid", k: "#60a5fa" },
          { label: "ATL", waarde: huidig.atl, sub: "Vermoeidheid", k: "#f97316" },
          {
            label: "TSB",
            waarde: huidig.tsb > 0 ? `+${huidig.tsb}` : `${huidig.tsb}`,
            sub: "Vorm",
            k: status.k
          },
        ].map((s, i) => (
          <div key={i} style={{ background: "#07111d", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{s.sub}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.k, letterSpacing: -1 }}>{s.waarde}</div>
            <div style={{ fontSize: 10, color: s.k+"80", fontWeight: 700, marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Extra stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "TSS vandaag", waarde: huidig.tss, k: "#e2e8f0" },
          { label: "TSS deze week", waarde: tssDezeWeek, k: "#e2e8f0" },
          { label: "Piek CTL", waarde: piekCtl, k: "#60a5fa" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#07111d", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.k }}>{s.waarde}</div>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        {[
          { k: "#60a5fa", l: "CTL fitheid" },
          { k: "#f97316", l: "ATL vermoeid" },
          { k: "#4ade80", l: "TSB vorm" },
        ].map((leg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 18, height: 2, background: leg.k, borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>{leg.l}</span>
          </div>
        ))}
      </div>

      {/* Grafiek */}
      <LoadGrafiek data={loadData} />

      {/* TSS staafjes afgelopen week */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>TSS per dag — afgelopen 7 dagen</div>
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={afgelopenWeek.map(d => {
            const dag = new Date(d.datum);
            return { dag: ["Zo","Ma","Di","Wo","Do","Vr","Za"][dag.getDay()], tss: d.tss };
          })} barCategoryGap="20%">
            <XAxis dataKey="dag" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 9 }} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 }} formatter={(v) => [v, "TSS"]} />
            <Bar dataKey="tss" radius={[3, 3, 0, 0]}>
              {afgelopenWeek.map((d, i) => (
                <Cell key={i} fill={d.tss > 80 ? "#f97316" : d.tss > 0 ? "#3b82f6" : "#1e293b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
