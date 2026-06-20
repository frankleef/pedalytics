"use client";
import { T } from "../designTokens";
import InfoTooltip from "./InfoTooltip";

const SESSIE_LABELS = { duur_lang: "Duurrit", duur_variabel: "Variabele duurrit", duur_middel: "Duurrit", sweetspot: "Sweet spot", interval: "Interval", herstel: "Herstelrit", drempel: "Drempel", vo2max: "VO2max", tempo: "Tempo" };

const MODE_CONFIG = {
  matched: {
    bg: "oklch(0.955 0.04 162)", border: "oklch(0.84 0.07 162)", dot: "oklch(0.6 0.13 165)",
    titel: "Uitgevoerd zoals gepland", sub: "Goede match met je geplande sessie",
    titelKleur: "oklch(0.4 0.1 162)", subKleur: "oklch(0.5 0.06 162)",
    icon: <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>,
  },
  deviated: {
    bg: "oklch(0.96 0.05 82)", border: "oklch(0.85 0.08 78)", dot: "oklch(0.72 0.13 70)",
    titel: "Andere rit dan gepland", sub: "Telt gewoon mee voor je belasting",
    titelKleur: "oklch(0.48 0.11 66)", subKleur: "oklch(0.56 0.08 70)",
    icon: <><path d="M12 3L2 20h20L12 3z" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round"/><path d="M12 10v4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/><circle cx="12" cy="17" r="0.4" fill="#fff" stroke="#fff" strokeWidth="1.4"/></>,
  },
  unplanned: {
    bg: "oklch(0.97 0.012 84)", border: T.divider, dot: "oklch(0.55 0.07 215)",
    titel: "Ongeplande rit", sub: "Meegenomen in je weekbelasting",
    titelKleur: T.text, subKleur: T.textSec,
    icon: <><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.2"/><path d="M12 8v4l2.5 1.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></>,
  },
};

function StatusBanner({ mode }) {
  const cfg = MODE_CONFIG[mode];
  if (!cfg) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 18, padding: "13px 15px", marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "50%", background: cfg.dot, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">{cfg.icon}</svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: cfg.titelKleur }}>{cfg.titel}</span>
        <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: cfg.subKleur }}>{cfg.sub}</span>
      </div>
    </div>
  );
}

function KerngetallenTiles({ rit, sessie, toonPlan }) {
  if (!rit) return null;
  const duurStr = rit.duur_min ? `${Math.floor(rit.duur_min / 60)}u ${String(rit.duur_min % 60).padStart(2, "0")}m` : "—";
  const planDuurStr = sessie?.duur_min ? `${Math.floor(sessie.duur_min / 60)}u ${String(sessie.duur_min % 60).padStart(2, "0")}m` : null;
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      {[
        { label: "Duur", value: duurStr, plan: toonPlan && planDuurStr ? `plan ${planDuurStr}` : null },
        { label: "TSS", value: rit.tss || "—", plan: toonPlan && sessie?.tss ? `plan ${sessie.tss}` : null, infoKey: "tss" },
        { label: "Gem. vermogen", value: rit.wattage ? `${rit.wattage}` : "—", unit: "w", plan: toonPlan && sessie?.vermogen ? `plan ${sessie.vermogen}` : null, infoKey: "vermogen" },
      ].map((m, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "14px 13px", borderRadius: 18, background: T.cardBg, border: `1px solid ${T.cardBorder}`, boxShadow: "0 2px 10px rgba(60,45,20,0.04)" }}>
          <span style={{ font: "600 23px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{m.value}{m.unit && <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>{m.unit}</span>}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>{m.label}</span>
            {m.infoKey && <InfoTooltip metricKey={m.infoKey} />}
          </div>
          {m.plan && <span style={{ font: "700 10.5px var(--font-nunito), sans-serif", color: T.textTert }}>{m.plan}</span>}
        </div>
      ))}
    </div>
  );
}

export { StatusBanner, KerngetallenTiles, MODE_CONFIG, SESSIE_LABELS };

export default function SessieUitkomstKaart({ mode, rit, sessie, ritCls, compact = false, onTap }) {
  const cfg = MODE_CONFIG[mode];
  if (!cfg || !rit) return null;

  if (compact) {
    return (
      <div onClick={onTap} style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16, cursor: onTap ? "pointer" : "default" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, flexShrink: 0, borderRadius: "50%", background: cfg.dot, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">{cfg.icon}</svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {rit.naam || ritCls?.label || "Rit"}
            </div>
            <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: cfg.titelKleur }}>{cfg.titel}</div>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M9 5l7 7-7 7" stroke={T.textTert} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Duur", value: rit.duur_min ? `${Math.round(rit.duur_min)}min` : "—" },
            { label: "TSS", value: rit.tss || "—" },
            { label: "Vermogen", value: rit.wattage ? `${rit.wattage}W` : "—" },
            ...(rit.rpe ? [{ label: "RPE", value: `${rit.rpe}/10` }] : []),
          ].map((m, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 4px", borderRadius: 12, background: T.subtleFill }}>
              <span style={{ font: "600 17px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{m.value}</span>
              <span style={{ font: "700 10px var(--font-nunito), sans-serif", color: T.textSec }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <StatusBanner mode={mode} />
      <KerngetallenTiles rit={rit} sessie={sessie} toonPlan={mode === "matched"} />
    </div>
  );
}
