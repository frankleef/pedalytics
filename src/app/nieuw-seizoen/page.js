"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import BeschikbaarheidEditor from "../components/BeschikbaarheidEditor";
import PlanGenereren from "../components/PlanGenereren";
import { startJob, pollJob } from "@/lib/jobClient";

const DOELEN = [
  { id: "ftp", icon: "⚡", naam: "FTP verhogen", beschrijving: "Meer wattage aan de drempel" },
  { id: "aerobe_basis", icon: "🫁", naam: "Betere aerobe basis", beschrijving: "Efficiënter rijden op lage intensiteit" },
  { id: "klimmen", icon: "⛰️", naam: "Klimmen & W/kg", beschrijving: "Meer vermogen per kilo" },
  { id: "uithoudingsvermogen", icon: "🏔️", naam: "Lange ritten", beschrijving: "Gran fondo of meerdaagse afmaken" },
  { id: "sprint", icon: "🚀", naam: "Snelheid & sprint", beschrijving: "Piekvermogen en eindspurt" },
];

export default function NieuwSeizoensPage() {
  const [stap, setStap] = useState(1);
  const [plan, setPlan] = useState(null);
  const [profiel, setProfiel] = useState(null);
  const [doel, setDoel] = useState(null);
  const [beschikbaarheidData, setBeschikbaarheidData] = useState(null);
  const [genereert, setGenereert] = useState(false);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    fetch("/api/plan").then(r => r.json()).then(d => {
      if (d.success && d.data) {
        setPlan(d.data);
        setDoel(d.data.seizoensdoel?.type || "ftp");
        setBeschikbaarheidData({ beschikbaar: d.data.beschikbaarheid || {}, uren: d.data.urenPerDag || {} });
      }
    });
    fetch("/api/intervals/profiel").then(r => r.json()).then(d => {
      if (d.success && d.data) setProfiel(d.data);
    });
  }, []);

  const ftpDelta = plan?.start_ftp && profiel?.ftp ? profiel.ftp - plan.start_ftp : null;

  const startGeneratie = async () => {
    setGenereert(true);
    setFout(null);
    try {
      // Archiveer huidig plan
      await fetch("/api/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _archiveer: true, startdatum: plan?.startdatum }),
      });

      // Genereer nieuw plan
      const nieuwPlan = {
        doel,
        doel_label: DOELEN.find(d => d.id === doel)?.naam,
        doel_icon: DOELEN.find(d => d.id === doel)?.icon,
        seizoensdoel: { type: doel },
        tijdshorizon_weken: 13,
        huidige_ftp: profiel?.ftp || 265,
        huidige_ctl: 0,
        ervaringsniveau: plan?.ervaringsniveau || "recreatief",
        startdatum: new Date().toISOString().slice(0, 10),
        beschikbaarheid: beschikbaarheidData?.beschikbaar || {},
        urenPerDag: beschikbaarheidData?.uren || {},
      };

      await fetch("/api/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nieuwPlan),
      });

      window.location.href = "/?tab=schema";
    } catch (e) {
      setFout(e.message);
      setGenereert(false);
    }
  };

  if (genereert) return <PlanGenereren />;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px`, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          {stap > 1 ? (
            <button onClick={() => setStap(s => s - 1)} style={{ width: 42, height: 42, borderRadius: "50%", background: T.cardBg, border: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: T.text }}>‹</button>
          ) : <div style={{ width: 42 }} />}
          <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.textSec }}>Stap {stap} van 2</span>
          <div style={{ width: 42 }} />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ flex: 1, height: 6, borderRadius: 3, background: s < stap ? T.slate : s === stap ? T.gradient : "oklch(0.91 0.012 82)" }} />
          ))}
        </div>

        {stap === 1 && (
          <div style={{ flex: 1 }}>
            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Nieuw seizoen</span>
            <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Kies je doel</h1>

            {ftpDelta != null && (
              <p style={{ margin: "0 0 16px", font: "600 14px/1.45 var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)" }}>
                Je hebt dit seizoen {ftpDelta >= 0 ? "+" : ""}{ftpDelta}W gewonnen. Je nieuwe startpunt is {profiel?.ftp}W.
              </p>
            )}

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

            <div style={{ display: "flex", gap: 11, marginTop: 20 }}>
              <button onClick={() => { if (doel) setStap(2); }} disabled={!doel}
                style={{ flex: 1, border: "none", cursor: doel ? "pointer" : "not-allowed", padding: 15, borderRadius: T.pillRadius, background: doel ? T.slate : "oklch(0.88 0.014 80)", color: doel ? "oklch(0.97 0.01 84)" : T.textTert, font: "800 15.5px var(--font-nunito), sans-serif" }}>
                Volgende
              </button>
            </div>
          </div>
        )}

        {stap === 2 && (
          <div style={{ flex: 1 }}>
            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Nieuw seizoen · Beschikbaarheid</span>
            <h1 style={{ margin: "6px 0 8px", font: "800 27px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: T.text }}>Bevestig je beschikbaarheid</h1>
            <p style={{ margin: "0 0 16px", font: "600 14px/1.45 var(--font-nunito), sans-serif", color: T.textSec }}>Je vorige beschikbaarheid is overgenomen. Pas aan of ga verder.</p>

            <BeschikbaarheidEditor
              initieel={{ beschikbaar: beschikbaarheidData?.beschikbaar, uren: beschikbaarheidData?.uren }}
              onWijzig={setBeschikbaarheidData}
            />

            {fout && <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: "oklch(0.55 0.16 28)", marginTop: 10 }}>{fout}</div>}

            <div style={{ display: "flex", gap: 11, marginTop: 20 }}>
              <button onClick={() => setStap(1)} style={{ flexShrink: 0, padding: "15px 22px", borderRadius: T.pillRadius, border: "1.5px solid oklch(0.86 0.014 80)", background: "transparent", color: "oklch(0.4 0.02 72)", font: "800 15px var(--font-nunito), sans-serif", cursor: "pointer" }}>Terug</button>
              <button onClick={startGeneratie}
                style={{ flex: 1, border: "none", cursor: "pointer", padding: 15, borderRadius: T.pillRadius, background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 15.5px var(--font-nunito), sans-serif" }}>
                Genereer plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
