"use client";
import { T } from "../designTokens";

const FASE_CONFIG = {
  basis:         { zk: 2, zoneLabel: "Z1–Z2 · Aeroob",    focus: "Rustige duurritten die je aerobe motor en uithoudingsvermogen opbouwen." },
  sweetspot:     { zk: 3, zoneLabel: "Z3 · Sweetspot",     focus: "Langere sweetspot-blokken tillen je drempelvermogen omhoog." },
  drempel:       { zk: 4, zoneLabel: "Z4 · Drempel",       focus: "Stevige drempel- en VO2max-intervallen — de zwaarste fase." },
  consolidatie:  { zk: 5, zoneLabel: "Z4–Z5 · Scherpte",   focus: "Korte, scherpe inspanningen met meer herstel om de vorm vast te zetten." },
  test:          { zk: 1, zoneLabel: "Taper · FTP-test",   focus: "Afbouwen, fris worden en je nieuwe FTP testen." },
  herstel:       { zk: 1, zoneLabel: "Herstel",            focus: "Lage belasting, HRV optimaliseren." },
};

const ZONE_KLEUR = {
  1: "oklch(0.70 0.12 240)",
  2: "oklch(0.66 0.13 235)",
  3: "oklch(0.66 0.13 168)",
  4: "oklch(0.70 0.14 70)",
  5: "oklch(0.62 0.15 35)",
};

const FASE_NAMEN = { basis: "Basis", sweetspot: "Sweetspot", drempel: "Drempel", consolidatie: "Consolidatie", test: "Test", herstel: "Herstel" };

export default function SeizoensplanOverzicht({ plan, onDoorGaan }) {
  if (!plan?.kader) return null;

  const ftp = plan.huidige_ftp || 265;
  const weken = plan.tijdshorizon_weken || 12;

  const streef = plan.streefwaarde || `${Math.round(ftp * 1.05)}-${Math.round(ftp * 1.1)}W`;
  const rangeMatch = streef.match(/(\d+)\s*[-–]\s*(\d+)\s*W/i);
  const doelFtp = rangeMatch ? Math.max(Number(rangeMatch[1]), Number(rangeMatch[2])) : Math.round(ftp * 1.1);
  const verschil = doelFtp - ftp;

  const fasen = [];
  let huidige = null;
  plan.kader.forEach(w => {
    if (!huidige || huidige.fase !== w.fase) {
      huidige = { fase: w.fase, startWeek: w.week, eindWeek: w.week, tss: w.tss_doel };
      fasen.push(huidige);
    } else {
      huidige.eindWeek = w.week;
      huidige.tss = Math.round((huidige.tss + w.tss_doel) / 2);
    }
  });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, color: T.text, paddingBottom: 100 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `4px ${T.pad}px 24px` }}>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 5px 13px rgba(60,120,150,0.26)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert }}>SEIZOENSPLAN · {weken} WEKEN</span>
        </div>
        <h1 style={{ margin: "0 0 8px", font: "800 27px/1.18 var(--font-nunito), sans-serif", letterSpacing: -0.5, textWrap: "pretty", color: T.text }}>Je seizoensplan staat klaar</h1>
        {plan.samenvatting && (
          <p style={{ margin: 0, font: "600 14px/1.45 var(--font-nunito), sans-serif", color: T.textSec, textWrap: "pretty" }}>{plan.samenvatting}</p>
        )}
      </div>

      {/* Goal summary card (slate) */}
      <div style={{ background: "oklch(0.345 0.035 245)", borderRadius: 24, padding: "17px 19px", boxShadow: "0 10px 26px rgba(30,40,70,0.22)", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ font: "800 10.5px var(--font-nunito), sans-serif", letterSpacing: 1.3, color: "oklch(0.74 0.05 200)" }}>SEIZOENSDOEL · FTP</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ font: "600 15px var(--font-nunito), sans-serif", color: "oklch(0.78 0.03 210)" }}>{ftp}W</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="oklch(0.79 0.1 168)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ font: "600 26px var(--font-fredoka), sans-serif", lineHeight: 1, color: "#fff" }}>{doelFtp}W</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ font: "600 22px var(--font-fredoka), sans-serif", lineHeight: 1, color: "#fff" }}>+{verschil}W</span>
          <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: "oklch(0.74 0.05 200)" }}>in {weken} weken</span>
        </div>
      </div>

      {/* Phase timeline */}
      <span style={{ display: "block", font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, margin: "0 2px 14px" }}>FASE-OPBOUW</span>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {fasen.map((f, i) => {
          const cfg = FASE_CONFIG[f.fase] || FASE_CONFIG.basis;
          const color = ZONE_KLEUR[cfg.zk] || ZONE_KLEUR[2];
          const current = i === 0;
          const hasLine = i < fasen.length - 1;
          const weekLabel = f.startWeek === f.eindWeek ? `Week ${f.startWeek}` : `Week ${f.startWeek}–${f.eindWeek}`;

          return (
            <div key={i} style={{ display: "flex", gap: 15 }}>
              <div style={{ flex: "none", width: 30, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: current ? color : T.cardBg,
                  border: current ? "none" : `2.5px solid ${color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  font: "600 13px var(--font-fredoka), sans-serif",
                  color: current ? "#fff" : color,
                  zIndex: 2,
                  boxShadow: current ? "0 4px 11px rgba(40,30,15,0.18)" : "none",
                }}>{i + 1}</div>
                {hasLine && <div style={{ flex: 1, width: 2.5, borderRadius: 2, background: "oklch(0.88 0.014 80)", margin: "3px 0", minHeight: 30 }} />}
              </div>

              <div style={{
                flex: 1, marginBottom: 12,
                background: current ? "oklch(0.975 0.02 215)" : T.cardBg,
                borderRadius: 22, padding: "15px 17px 16px",
                border: current ? "1.5px solid oklch(0.78 0.07 220)" : `1px solid ${T.cardBorder}`,
                boxShadow: "0 2px 12px rgba(60,45,20,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <span style={{ font: "700 17px var(--font-nunito), sans-serif", color: T.text, whiteSpace: "nowrap" }}>{FASE_NAMEN[f.fase] || f.fase}</span>
                    {current && <span style={{ flex: "none", padding: "2px 9px", borderRadius: 999, background: "oklch(0.345 0.035 245)", color: "oklch(0.92 0.02 200)", font: "800 9px var(--font-nunito), sans-serif", letterSpacing: 0.8 }}>NU</span>}
                  </div>
                  <span style={{ flex: "none", font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>{weekLabel}</span>
                </div>

                <p style={{ margin: "0 0 13px", font: "600 12.5px/1.4 var(--font-nunito), sans-serif", color: "oklch(0.54 0.02 74)", textWrap: "pretty" }}>{f.fase === plan.kader[0]?.fase ? (plan.kader[0]?.focus || cfg.focus) : cfg.focus}</p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${current ? "oklch(0.88 0.03 220)" : T.divider}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
                    <span style={{ font: "700 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>{cfg.zoneLabel}</span>
                  </div>
                  <span style={{ font: "600 13px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>
                    <span style={{ font: "600 18px var(--font-fredoka), sans-serif", color }}>{f.tss}</span> TSS/wk
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* Sticky CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 22px 22px", background: `linear-gradient(180deg, rgba(252,250,245,0), ${T.bg} 38%)`, zIndex: 10 }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          <button onClick={onDoorGaan} style={{
            width: "100%", border: "none", cursor: "pointer", padding: 16,
            borderRadius: T.pillRadius, background: T.slate,
            color: "oklch(0.97 0.01 84)", font: "800 15.5px var(--font-nunito), sans-serif",
            letterSpacing: 0.2, display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          }}>
            Ga door naar week 1
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="oklch(0.97 0.01 84)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
