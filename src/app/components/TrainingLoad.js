"use client";
import { useState } from "react";

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
    const datumStr = huidigeDatum.toISOString().split("T")[0];
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

  const W = 320, H = 120;
  const pad = { t: 10, b: 22, l: 28, r: 14 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;

  const ctlV = data.map(d => d.ctl);
  const atlV = data.map(d => d.atl);
  const tsbV = data.map(d => d.tsb);
  const alles = [...ctlV, ...atlV, ...tsbV];
  const mn = Math.min(...alles) - 3;
  const mx = Math.max(...alles) + 3;

  const xS = i => pad.l + (i / (data.length - 1)) * w;
  const yS = v => pad.t + h - ((v - mn) / (mx - mn)) * h;

  const lijn = (vals, k) => (
    <polyline fill="none" stroke={k} strokeWidth="2"
      points={vals.map((v, i) => `${xS(i)},${yS(v)}`).join(" ")} />
  );

  const nulY = yS(0);
  const stap = Math.max(1, Math.floor(data.length / 5));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {/* Nullijn */}
      <line x1={pad.l} y1={nulY} x2={W - pad.r} y2={nulY}
        stroke="#374151" strokeWidth="1" strokeDasharray="4,3" />
      <text x={pad.l - 4} y={nulY + 3} fontSize="7" fill="#374151" textAnchor="end">0</text>

      {/* Positief/negatief zones */}
      <rect x={pad.l} y={pad.t} width={w} height={nulY - pad.t}
        fill="#4ade8008" />
      <rect x={pad.l} y={nulY} width={w} height={h - (nulY - pad.t)}
        fill="#ef444408" />

      {lijn(ctlV, "#60a5fa")}
      {lijn(atlV, "#f97316")}
      {lijn(tsbV, "#4ade80")}

      {/* Eindwaardes */}
      {[
        { v: ctlV, k: "#60a5fa" },
        { v: atlV, k: "#f97316" },
        { v: tsbV, k: "#4ade80" },
      ].map((s, i) => {
        const lv = s.v[s.v.length - 1];
        const lx = xS(s.v.length - 1);
        const ly = yS(lv);
        return (
          <g key={i}>
            <circle cx={lx} cy={ly} r="3" fill={s.k} />
            <text x={lx + 5} y={ly + 3} fontSize="9" fill={s.k} fontWeight="700">{lv}</text>
          </g>
        );
      })}

      {/* X-as labels */}
      {data.filter((_, i) => i % stap === 0).map((d, i) => {
        const idx = i * stap;
        const dag = new Date(d.datum);
        return (
          <text key={i} x={xS(idx)} y={H - 2} fontSize="8" fill="#475569" textAnchor="middle">
            {dag.getDate()}/{dag.getMonth() + 1}
          </text>
        );
      })}
    </svg>
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
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
          {afgelopenWeek.map((d, i) => {
            const hoogte = Math.max(3, (d.tss / maxTss) * 38);
            const dag = new Date(d.datum);
            const namen = ["Zo","Ma","Di","Wo","Do","Vr","Za"];
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                {d.tss > 0 && <div style={{ fontSize: 8, color: "#94a3b8" }}>{d.tss}</div>}
                <div style={{ width: "100%", height: hoogte,
                  background: d.tss > 80 ? "#f97316" : d.tss > 0 ? "#3b82f6" : "#1e293b",
                  borderRadius: "2px 2px 0 0" }} />
                <div style={{ fontSize: 8, color: "#475569" }}>{namen[dag.getDay()]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
