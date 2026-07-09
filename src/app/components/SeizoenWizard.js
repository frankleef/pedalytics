"use client";
import { useState } from "react";
import { T } from "../designTokens";
import BeschikbaarheidEditor from "./BeschikbaarheidEditor";
import SeizoensduurStepper, { berekenSuggestieWeken } from "./SeizoensduurStepper";

const DOELEN = [
  { id: "ftp", icon: "⚡", naam: "FTP verhogen", beschrijving: "Meer wattage aan de drempel — algemene prestatiesprong" },
  { id: "aerobe_basis", icon: "🫁", naam: "Betere aerobe basis", beschrijving: "Efficiënter rijden op lage intensiteit, verder komen zonder leeg te lopen" },
  { id: "klimmen", icon: "⛰️", naam: "Klimmen & W/kg", beschrijving: "Meer vermogen per kilo — de bergen in" },
  { id: "uithoudingsvermogen", icon: "🏔️", naam: "Lange ritten", beschrijving: "Een gran fondo, meerdaagse of lange tocht afmaken" },
  { id: "sprint", icon: "🚀", naam: "Snelheid & sprint", beschrijving: "Piekvermogen, aanvallen, eindspurt" },
];

const NIVEAUS = [
  { id: "starter", icon: "🚲", naam: "Starter", beschrijving: "Ik fiets minder dan een jaar regelmatig" },
  { id: "recreatief", icon: "🚴", naam: "Recreatief", beschrijving: "1–3 jaar ervaring, soms sportieve tochten" },
  { id: "getraind", icon: "🏆", naam: "Getraind", beschrijving: "3+ jaar, regelmatig structureel getraind" },
];

export default function SeizoenWizard({ profiel, wellness, onVoltooid }) {
  const [stap, setStap] = useState(1);
  const [doel, setDoel] = useState(null);
  const [doelExtra, setDoelExtra] = useState({ doel_ftp: null, doel_wkg: null, event_datum: null });
  const [config, setConfig] = useState({ weken: 13 });
  const [wekenHint, setWekenHint] = useState("");
  const [beschikbaarheidData, setBeschikbaarheidData] = useState(null);
  const [ervaringsniveau, setErvaringsniveau] = useState(null);

  const gekozenDoel = DOELEN.find(d => d.id === doel);
  const verwachteFtp = (weken) => `${Math.round(profiel.ftp * (1 + weken * 0.004))}-${Math.round(profiel.ftp * (1 + weken * 0.007))}W`;

  const berekenStartdatum = (eventDatum, weken) => {
    if (!eventDatum) return null;
    const event = new Date(eventDatum);
    const start = new Date(event);
    start.setDate(event.getDate() - weken * 7);
    return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
  };

  const slaDoelOp = () => {
    const ctl = wellness ? Math.round(wellness.ctl || 0) : 0;
    const seizoensdoel = { type: doel };
    if (doel === "ftp") seizoensdoel.doel_ftp = doelExtra.doel_ftp || Math.round(profiel.ftp * 1.1);
    if (doel === "klimmen") {
      seizoensdoel.doel_ftp = doelExtra.doel_ftp || Math.round(profiel.ftp * 1.1);
      seizoensdoel.doel_wkg = doelExtra.doel_wkg || null;
    }
    if (doel === "uithoudingsvermogen") seizoensdoel.event_datum = doelExtra.event_datum || null;

    const startdatum = (doel === "uithoudingsvermogen" && doelExtra.event_datum)
      ? berekenStartdatum(doelExtra.event_datum, config.weken)
      : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

    onVoltooid({
      doel,
      doel_label: gekozenDoel.naam,
      doel_icon: gekozenDoel.icon,
      seizoensdoel,
      tijdshorizon_weken: config.weken,
      huidige_ftp: profiel.ftp,
      huidige_ctl: ctl,
      ervaringsniveau: ervaringsniveau || "recreatief",
      startdatum,
      config: { ...config },
      beschikbaarheid: beschikbaarheidData?.beschikbaar || {},
      urenPerDag: beschikbaarheidData?.uren || {},
    });
  };

  // Progress bar
  const ProgressBar = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {[1, 2, 3, 4, 5].map(s => (
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
          <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.textSec }}>Stap {stap} van 5</span>
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
              <div key={d.id} onClick={() => setDoel(d.id)}
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

            {/* Doel-specifieke vervolgvelden */}
            {doel === "ftp" && (
              <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", border: `1px solid ${T.cardBorder}`, marginTop: 6 }}>
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6, display: "block" }}>Wat is je doel-FTP? (W) — optioneel</span>
                <input type="number" value={doelExtra.doel_ftp || ""} onChange={e => setDoelExtra(p => ({ ...p, doel_ftp: e.target.value ? Number(e.target.value) : null }))}
                  placeholder={String(Math.round(profiel.ftp * 1.1))}
                  style={{ width: "100%", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 12, color: T.text, font: "600 14px var(--font-nunito), sans-serif", boxSizing: "border-box", outline: "none" }} />
                <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)", marginTop: 8 }}>
                  Verwachting: FTP {profiel.ftp}W → {verwachteFtp(config.weken)}
                </div>
              </div>
            )}

            {doel === "klimmen" && (
              <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", border: `1px solid ${T.cardBorder}`, marginTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6, display: "block" }}>Doel-FTP (W) — optioneel</span>
                  <input type="number" value={doelExtra.doel_ftp || ""} onChange={e => setDoelExtra(p => ({ ...p, doel_ftp: e.target.value ? Number(e.target.value) : null }))}
                    placeholder={String(Math.round(profiel.ftp * 1.1))}
                    style={{ width: "100%", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 12, color: T.text, font: "600 14px var(--font-nunito), sans-serif", boxSizing: "border-box", outline: "none" }} />
                </div>
                <div>
                  <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6, display: "block" }}>Doel W/kg — optioneel</span>
                  <input type="number" step="0.1" value={doelExtra.doel_wkg || ""} onChange={e => setDoelExtra(p => ({ ...p, doel_wkg: e.target.value ? Number(e.target.value) : null }))}
                    placeholder={profiel.gewicht ? String(Math.round(profiel.ftp * 1.1 / profiel.gewicht * 10) / 10) : "4.0"}
                    style={{ width: "100%", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 12, color: T.text, font: "600 14px var(--font-nunito), sans-serif", boxSizing: "border-box", outline: "none" }} />
                </div>
              </div>
            )}

            {doel === "uithoudingsvermogen" && (
              <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", border: `1px solid ${T.cardBorder}`, marginTop: 6 }}>
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6, display: "block" }}>Wanneer is je evenement? — optioneel</span>
                <input type="date" value={doelExtra.event_datum || ""} onChange={e => setDoelExtra(p => ({ ...p, event_datum: e.target.value || null }))}
                  style={{ width: "100%", background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 12, color: T.text, font: "600 14px var(--font-nunito), sans-serif", boxSizing: "border-box", outline: "none" }} />
                {doelExtra.event_datum && (
                  <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)", marginTop: 8 }}>
                    Je plan start dan op {berekenStartdatum(doelExtra.event_datum, config.weken)}
                  </div>
                )}
              </div>
            )}

            <Footer onVolgende={() => {
              if (!doel) return;
              const { suggestie, hint } = berekenSuggestieWeken(doel, doelExtra.event_datum);
              setConfig(p => ({ ...p, weken: suggestie }));
              setWekenHint(hint);
              setStap(2);
            }} disabled={!doel} />
          </div>
        )}

        {/* ══ STAP 2: Seizoensduur ══ */}
        {stap === 2 && (
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Seizoensdoel · Seizoensduur</span>
              <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Hoe lang duurt je plan?</h1>
              <p style={{ margin: 0, font: "600 14px/1.45 var(--font-nunito), sans-serif", color: T.textSec }}>We stellen een lengte voor op basis van je doel. Pas aan indien gewenst.</p>
            </div>

            <SeizoensduurStepper
              weken={config.weken}
              onWijzig={(w) => setConfig(p => ({ ...p, weken: w }))}
              hint={wekenHint}
            />

            <Footer onTerug={() => setStap(1)} onVolgende={() => setStap(3)} />
          </div>
        )}

        {/* ══ STAP 3: Beschikbaarheid ══ */}
        {stap === 3 && (
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

            <Footer onTerug={() => setStap(2)} onVolgende={() => setStap(4)} />
          </div>
        )}

        {/* ══ STAP 4: Ervaringsniveau ══ */}
        {stap === 4 && (
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Seizoensdoel · Ervaringsniveau</span>
              <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Hoe ervaren ben je?</h1>
              <p style={{ margin: 0, font: "600 14px/1.45 var(--font-nunito), sans-serif", color: T.textSec }}>Dit bepaalt de opbouwsnelheid en intensiteitsverdeling van je plan.</p>
            </div>

            {NIVEAUS.map(n => (
              <div key={n.id} onClick={() => setErvaringsniveau(n.id)}
                style={{ display: "flex", gap: 14, alignItems: "center", padding: 16, background: T.cardBg,
                  border: `1.5px solid ${ervaringsniveau === n.id ? T.gradientA : T.cardBorder}`,
                  borderRadius: 20, marginBottom: 10, cursor: "pointer", boxShadow: ervaringsniveau === n.id ? "0 2px 14px rgba(60,45,20,0.08)" : T.cardShadow }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{n.icon}</div>
                <div>
                  <div style={{ font: "700 15px var(--font-nunito), sans-serif", color: T.text }}>{n.naam}</div>
                  <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>{n.beschrijving}</div>
                </div>
              </div>
            ))}

            <Footer onTerug={() => setStap(3)} onVolgende={() => { if (ervaringsniveau) setStap(5); }} disabled={!ervaringsniveau} />
          </div>
        )}

        {/* ══ STAP 5: Samenvatting + opslaan ══ */}
        {stap === 5 && (
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Seizoensdoel · overzicht</span>
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

              {doel === "ftp" && (
                <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 12 }}>
                  Doel: FTP {profiel.ftp}W → {doelExtra.doel_ftp || Math.round(profiel.ftp * 1.1)}W
                </div>
              )}
              {doel === "klimmen" && (
                <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 12 }}>
                  Doel: {doelExtra.doel_ftp || Math.round(profiel.ftp * 1.1)}W{doelExtra.doel_wkg ? ` · ${doelExtra.doel_wkg} W/kg` : ""}
                </div>
              )}
              {doel === "uithoudingsvermogen" && doelExtra.event_datum && (
                <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 12 }}>
                  Evenement: {doelExtra.event_datum} · start {berekenStartdatum(doelExtra.event_datum, config.weken)}
                </div>
              )}

              {beschikbaarheidData?.beschikbaar && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: ervaringsniveau ? 12 : 0 }}>
                  {Object.entries(beschikbaarheidData.beschikbaar).filter(([, v]) => v).map(([dag]) => (
                    <div key={dag} style={{ padding: "6px 12px", borderRadius: T.pillRadius, background: T.subtleFill, font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>
                      {dag.slice(0, 2)} · {beschikbaarheidData.uren?.[dag] || 1.5}u
                    </div>
                  ))}
                </div>
              )}

              {ervaringsniveau && (
                <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>
                  {NIVEAUS.find(n => n.id === ervaringsniveau)?.icon} {NIVEAUS.find(n => n.id === ervaringsniveau)?.naam}
                </div>
              )}
            </div>

            <Footer onTerug={() => setStap(4)} onVolgende={slaDoelOp} volgendeLabel="Doel opslaan" />
          </div>
        )}
      </div>
    </div>
  );
}
