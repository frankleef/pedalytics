"use client";
import { useState } from "react";
import { T } from "../designTokens";
import BeschikbaarheidEditor from "./BeschikbaarheidEditor";

const DOELEN = [
  { id: "ftp_verhogen", icon: "⚡", naam: "FTP verhogen", beschrijving: "Gestructureerde drempel- en VO2max training om meer vermogen te leveren", standaardWeken: 12 },
  { id: "evenement", icon: "🏁", naam: "Trainen voor evenement", beschrijving: "Alles werkt toe naar één datum met taper in de laatste week", standaardWeken: 12 },
  { id: "z2_sneller", icon: "🚴", naam: "Sneller in Z2", beschrijving: "Meer watt bij gelijke hartslag — aerobe efficiëntie verbeteren", standaardWeken: 12 },
  { id: "fitheid", icon: "💪", naam: "Algemene fitheid", beschrijving: "Geleidelijk volume opbouwen zonder specifieke piek", standaardWeken: 12 },
  { id: "herstel", icon: "🔄", naam: "Herstel & consolidatie", beschrijving: "Lagere belasting, HRV optimaliseren na intensief blok", standaardWeken: 4 },
];

const EVENEMENT_TYPES = [
  { id: "granfondo", label: "Granfondo / Toertocht" },
  { id: "wedstrijd", label: "Wedstrijd / Criterium" },
  { id: "klimrit", label: "Klimrit / Bergrit" },
  { id: "sociaal", label: "Sociale rit / Groepsrit" },
];

export default function SeizoenWizard({ profiel, wellness, onVoltooid }) {
  const [stap, setStap] = useState(1);
  const [doel, setDoel] = useState(null);
  const [config, setConfig] = useState({ weken: 12, evenementNaam: "", evenementDatum: "", evenementType: "granfondo", streefSnelheid: 31 });
  const [beschikbaarheidData, setBeschikbaarheidData] = useState(null);

  const gekozenDoel = DOELEN.find(d => d.id === doel);
  const verwachteFtp = (weken) => `${Math.round(profiel.ftp * (1 + weken * 0.004))}-${Math.round(profiel.ftp * (1 + weken * 0.007))}W`;

  const slaDoelOp = () => {
    const ctl = wellness ? Math.round(wellness.ctl || 0) : 0;
    onVoltooid({
      doel,
      doel_label: gekozenDoel.naam,
      doel_icon: gekozenDoel.icon,
      tijdshorizon_weken: config.weken,
      huidige_ftp: profiel.ftp,
      huidige_ctl: ctl,
      startdatum: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })(),
      config: { ...config },
      beschikbaarheid: beschikbaarheidData?.beschikbaar || {},
      urenPerDag: beschikbaarheidData?.uren || {},
    });
  };

  // Progress bar
  const ProgressBar = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {[1, 2, 3].map(s => (
        <div key={s} style={{ flex: 1, height: 6, borderRadius: 3,
          background: s < stap ? T.slate : s === stap ? T.gradient : "oklch(0.91 0.012 82)" }} />
      ))}
    </div>
  );

  // Footer buttons
  const Footer = ({ onTerug, onVolgende, volgendeLabel = "Volgende", disabled = false }) => (
    <div style={{ display: "flex", gap: 11, marginTop: 20 }}>
      {onTerug && (
        <button onClick={onTerug}
          style={{ flexShrink: 0, padding: "15px 22px", borderRadius: T.pillRadius, border: "1.5px solid oklch(0.86 0.014 80)", background: "transparent", color: "oklch(0.4 0.02 72)", font: "800 15px var(--font-nunito), sans-serif", cursor: "pointer" }}>
          Terug
        </button>
      )}
      <button onClick={onVolgende} disabled={disabled}
        style={{ flex: 1, border: "none", cursor: disabled ? "not-allowed" : "pointer", padding: 15, borderRadius: T.pillRadius, background: disabled ? "oklch(0.88 0.014 80)" : T.slate, color: disabled ? T.textTert : "oklch(0.97 0.01 84)", font: "800 15.5px var(--font-nunito), sans-serif", letterSpacing: 0.2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {volgendeLabel}
        {volgendeLabel !== "Doel opslaan" && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px`, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          {stap > 1 ? (
            <button onClick={() => setStap(s => s - 1)} style={{ width: 42, height: 42, borderRadius: "50%", background: T.cardBg, border: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: T.text }}>‹</button>
          ) : <div style={{ width: 42 }} />}
          <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.textSec }}>Stap {stap} van 3</span>
          <div style={{ width: 42 }} />
        </div>

        <ProgressBar />

        {/* ══ STAP 1: Doel kiezen + instellen ══ */}
        {stap === 1 && (
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Seizoensdoel</span>
              <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Wat wil je bereiken?</h1>
              <p style={{ margin: 0, font: "600 14px/1.45 var(--font-nunito), sans-serif", color: T.textSec }}>Kies je primaire doel. Je kunt dit later altijd aanpassen.</p>
            </div>

            {DOELEN.map(d => (
              <div key={d.id} onClick={() => { setDoel(d.id); setConfig(p => ({ ...p, weken: d.standaardWeken })); }}
                style={{ display: "flex", gap: 14, alignItems: "center", padding: 16, background: T.cardBg,
                  border: `1.5px solid ${doel === d.id ? T.gradientA : T.cardBorder}`,
                  borderRadius: 20, marginBottom: 10, cursor: "pointer", boxShadow: doel === d.id ? "0 2px 14px rgba(60,45,20,0.08)" : T.cardShadow }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{d.icon}</div>
                <div>
                  <div style={{ font: "700 15px var(--font-nunito), sans-serif", color: T.text }}>{d.naam}</div>
                  <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>{d.beschrijving}</div>
                </div>
              </div>
            ))}

            {/* Doel-specifieke config */}
            {doel === "ftp_verhogen" && (
              <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", border: `1px solid ${T.cardBorder}`, marginTop: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>Tijdshorizon</span>
                  <span style={{ font: "600 16px var(--font-fredoka), sans-serif", color: T.text }}>{config.weken} weken</span>
                </div>
                <input type="range" min={8} max={16} value={config.weken}
                  onChange={e => setConfig(p => ({ ...p, weken: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: "oklch(0.64 0.14 248)" }} />
                <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)", marginTop: 8 }}>
                  Verwachting: FTP {profiel.ftp}W → {verwachteFtp(config.weken)}
                </div>
              </div>
            )}

            {doel === "evenement" && (
              <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", border: `1px solid ${T.cardBorder}`, marginTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6, display: "block" }}>Evenement naam</span>
                  <input type="text" value={config.evenementNaam} onChange={e => setConfig(p => ({ ...p, evenementNaam: e.target.value }))} placeholder="bijv. Amstel Gold Race"
                    style={{ width: "100%", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 12, color: T.text, font: "600 14px var(--font-nunito), sans-serif", boxSizing: "border-box", outline: "none" }} />
                </div>
                <div>
                  <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6, display: "block" }}>Datum</span>
                  <input type="date" value={config.evenementDatum} onChange={e => { const wk = Math.max(4, Math.min(24, Math.ceil((new Date(e.target.value) - new Date()) / (7 * 86400000)))); setConfig(p => ({ ...p, evenementDatum: e.target.value, weken: wk })); }}
                    style={{ width: "100%", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 12, color: T.text, font: "600 14px var(--font-nunito), sans-serif", boxSizing: "border-box", outline: "none" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {EVENEMENT_TYPES.map(t => (
                    <button key={t.id} onClick={() => setConfig(p => ({ ...p, evenementType: t.id }))}
                      style={{ padding: "10px 12px", background: config.evenementType === t.id ? T.subtleFill : "transparent", border: `1px solid ${config.evenementType === t.id ? T.gradientA : T.cardBorder}`, borderRadius: 12, color: T.text, font: "600 12px var(--font-nunito), sans-serif", cursor: "pointer", textAlign: "left" }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(doel === "z2_sneller" || doel === "fitheid" || doel === "herstel") && (
              <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", border: `1px solid ${T.cardBorder}`, marginTop: 6 }}>
                {doel === "z2_sneller" && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>Streefsnelheid</span>
                      <span style={{ font: "600 16px var(--font-fredoka), sans-serif", color: T.text }}>{config.streefSnelheid} km/u</span>
                    </div>
                    <input type="range" min={28} max={38} step={0.5} value={config.streefSnelheid} onChange={e => setConfig(p => ({ ...p, streefSnelheid: Number(e.target.value) }))}
                      style={{ width: "100%", accentColor: "oklch(0.64 0.14 248)" }} />
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>Tijdshorizon</span>
                  <span style={{ font: "600 16px var(--font-fredoka), sans-serif", color: T.text }}>{config.weken} weken</span>
                </div>
                <input type="range" min={doel === "herstel" ? 2 : 8} max={doel === "herstel" ? 6 : 16} value={config.weken} onChange={e => setConfig(p => ({ ...p, weken: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: "oklch(0.64 0.14 248)" }} />
              </div>
            )}

            <Footer onVolgende={() => { if (doel) setStap(2); }} disabled={!doel} />
          </div>
        )}

        {/* ══ STAP 2: Beschikbaarheid ══ */}
        {stap === 2 && (
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Seizoensdoel · Beschikbaarheid</span>
              <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Wanneer kun je trainen?</h1>
              <p style={{ margin: 0, font: "600 14px/1.45 var(--font-nunito), sans-serif", color: T.textSec }}>Zet je vaste trainingsdagen aan en geef per dag aan hoeveel tijd je hebt. Je kunt dit later altijd aanpassen.</p>
            </div>

            <BeschikbaarheidEditor
              initieel={{ beschikbaar: beschikbaarheidData?.beschikbaar, uren: beschikbaarheidData?.uren }}
              onWijzig={setBeschikbaarheidData}
            />

            <Footer onTerug={() => setStap(1)} onVolgende={() => setStap(3)} />
          </div>
        )}

        {/* ══ STAP 3: Samenvatting + opslaan ══ */}
        {stap === 3 && (
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Seizoensdoel · Overzicht</span>
              <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Klaar om te starten</h1>
              <p style={{ margin: 0, font: "600 14px/1.45 var(--font-nunito), sans-serif", color: T.textSec }}>Controleer je plan. Na opslaan genereert de coach je eerste trainingsweek.</p>
            </div>

            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px", border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${T.divider}` }}>
                <div style={{ fontSize: 32 }}>{gekozenDoel?.icon}</div>
                <div>
                  <div style={{ font: "700 17px var(--font-nunito), sans-serif", color: T.text }}>{gekozenDoel?.naam}</div>
                  <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>{config.weken} weken</div>
                </div>
              </div>

              {doel === "ftp_verhogen" && (
                <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 12 }}>
                  Verwachting: FTP {profiel.ftp}W → {verwachteFtp(config.weken)}
                </div>
              )}
              {doel === "evenement" && config.evenementNaam && (
                <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 12 }}>
                  🏁 {config.evenementNaam} op {config.evenementDatum}
                </div>
              )}

              {beschikbaarheidData?.beschikbaar && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(beschikbaarheidData.beschikbaar).filter(([, v]) => v).map(([dag]) => (
                    <div key={dag} style={{ padding: "6px 12px", borderRadius: T.pillRadius, background: T.subtleFill, font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>
                      {dag.slice(0, 2)} · {beschikbaarheidData.uren?.[dag] || 1.5}u
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Footer onTerug={() => setStap(2)} onVolgende={slaDoelOp} volgendeLabel="Doel opslaan" />
          </div>
        )}
      </div>
    </div>
  );
}
