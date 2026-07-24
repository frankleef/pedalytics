"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import { berekenPlanNaleving, berekenPolarisatie } from "@/lib/trainingsgedrag";
import { ResponsiveContainer, LineChart, Line } from "recharts";

// Home-scherm Fitheid-kaart (traag, wekelijks signaal — EF per band, aerobe
// decoupling, trainingsgedrag), vervangt FitnessprogressieKaart. Zie
// Pedalytics_Home_Fitheid_v2_dc.html voor het design. EF-per-band en
// trainingsgedrag-meetkant waren al volledig gebouwd (lib/ef.js,
// lib/sessie/distributie.js) — deze kaart voegt alleen weergave + de
// ontbrekende 8-weken decoupling-aggregatie en fitnessDataReady-gate toe
// (lib/decoupling.js:haalDecouplingReeks, lib/fitnessprogressie.js:
// bepaalFitnessDataGereed).

const EF_BANDEN = [
  { key: "z2", label: "Z2 · Duurrit", kort: "Z2", kleur: "oklch(0.72 0.06 235)" },
  { key: "sweetspot", label: "Sweetspot", kort: "Sweetspot", kleur: "oklch(0.67 0.058 150)" },
  { key: "drempel", label: "Drempel", kort: "Drempel", kleur: "oklch(0.72 0.08 80)" },
  { key: "vo2max", label: "VO2max", kort: "VO2max", kleur: "oklch(0.6 0.1 30)" },
];

function formatNl(v, decimalen = 2) {
  if (v == null) return "—";
  return v.toFixed(decimalen).replace(".", ",");
}

function MiniSpark({ data, kleur, breedte = 56, hoogte = 22 }) {
  if (!data || data.length < 2) return <div style={{ width: breedte, height: hoogte }} />;
  return (
    <div style={{ width: breedte, height: hoogte }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={kleur} strokeWidth={2.2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BigSpark({ data, kleur, hoogte = 64 }) {
  if (!data || data.length < 2) {
    return <div style={{ height: hoogte, display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>Onvoldoende punten voor een grafiek</div>;
  }
  return (
    <div style={{ height: hoogte }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Line type="monotone" dataKey="v" stroke={kleur} strokeWidth={2.4} dot={{ r: 2.5, fill: kleur, stroke: "#fff", strokeWidth: 1 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const GRENS_VENSTER_DAGEN = 56; // 8 weken, zelfde venster als haalDecouplingReeks

export default function FitheidKaart({ voortgang, weekSessies, seizoenStart }) {
  const [efData, setEfData] = useState(null);
  const [fitProg, setFitProg] = useState(null);
  const [geladen, setGeladen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/ef-trend").then(r => r.json()).catch(() => null),
      fetch("/api/plan/fitnessprogressie").then(r => r.json()).catch(() => null),
    ]).then(([ef, fp]) => {
      if (ef?.success) setEfData(ef);
      if (fp?.success) setFitProg(fp);
    }).finally(() => setGeladen(true));
  }, []);

  if (!geladen) return null;

  const gereed = fitProg?.fitnessDataGereed || { ready: false, wekenVerzameld: 0, wekenNodig: 8, pct: 0 };

  const grens = seizoenStart || new Date(Date.now() - GRENS_VENSTER_DAGEN * 86400000);
  const { pct: z1z2Pct } = berekenPolarisatie(voortgang?.ritten, grens);
  const { pct: planNaleving } = berekenPlanNaleving(weekSessies, voortgang?.ritten, grens);

  const decouplingReeks = fitProg?.decouplingReeks || [];
  const decSparkData = decouplingReeks.map(p => ({ v: p.waarde }));
  const decLaatste = decouplingReeks.length ? decouplingReeks[decouplingReeks.length - 1].waarde : null;
  const decEerste = decouplingReeks.length ? decouplingReeks[0].waarde : null;
  const decDelta = decLaatste != null && decEerste != null ? Math.round((decLaatste - decEerste) * 10) / 10 : null;

  const efBanden = EF_BANDEN.map(b => {
    const bandData = efData?.data?.[b.key];
    const punten = bandData?.punten || [];
    const laatste = punten.length ? punten[punten.length - 1].ef : null;
    const eerste = punten.length ? punten[0].ef : null;
    const deltaPct = laatste != null && eerste != null && eerste !== 0 ? Math.round(((laatste - eerste) / eerste) * 100) : null;
    return { ...b, punten, laatste, deltaPct, trend: bandData?.trend ?? null };
  });
  const z2Band = efBanden.find(b => b.key === "z2");

  const efRichting = (() => {
    const richtingen = efBanden.filter(b => b.trend != null).map(b => Math.sign(b.trend));
    if (richtingen.length === 0) return "—";
    if (richtingen.every(r => r > 0)) return "alle +";
    if (richtingen.every(r => r < 0)) return "alle −";
    if (richtingen.every(r => r === 0)) return "stabiel";
    return "gemengd";
  })();

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Fitheid</span>
          <div onClick={() => setInfoOpen(true)} style={{ width: 17, height: 17, flexShrink: 0, borderRadius: "50%", border: `1.5px solid ${T.textTert}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <span style={{ font: "700 10px var(--font-nunito), sans-serif", lineHeight: 1, color: T.textSec }}>i</span>
          </div>
        </div>
        {gereed.ready && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: T.pillRadius, background: T.accentBg }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent }} />
            <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.accentText }}>Vooruitgang</span>
          </div>
        )}
      </div>

      {gereed.ready ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 14, background: T.subtleFill }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.text }}>EF per band</span>
              <span style={{ display: "block", font: "500 11px var(--font-nunito), sans-serif", color: T.textTert }}>Z2 · Sweetspot · Drempel · VO2max</span>
            </div>
            <MiniSpark data={z2Band?.punten?.map(p => ({ v: p.ef }))} kleur={T.accent} />
            <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.accentText, flex: "none" }}>{efRichting}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 14, background: T.subtleFill }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.text }}>Aerobe decoupling</span>
              <span style={{ display: "block", font: "500 11px var(--font-nunito), sans-serif", color: T.textTert }}>Hartslagdrift Z2-duurritten</span>
            </div>
            <span style={{ font: "700 15px var(--font-nunito), sans-serif", letterSpacing: -0.2, color: T.text, flex: "none" }}>{decLaatste != null ? `${formatNl(decLaatste, 1)}%` : "—"}</span>
            {decDelta != null && (
              <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: decDelta <= 0 ? T.accentText : T.textSec, flex: "none" }}>
                {decDelta > 0 ? "+" : decDelta < 0 ? "−" : ""}{formatNl(Math.abs(decDelta), 1)}pp
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 14, background: T.subtleFill }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.text }}>Trainingsgedrag</span>
              <span style={{ display: "block", font: "500 11px var(--font-nunito), sans-serif", color: T.textTert }}>{z1z2Pct}% rustig · {100 - z1z2Pct}% pittig · doel 80/20</span>
            </div>
            <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: T.textSec, flex: "none" }}>{planNaleving}% gereden</span>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "12px 10px 6px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "oklch(0.955 0.02 235)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l5-5 3.5 3 6-7" stroke="oklch(0.55 0.07 235)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.5 3.5" />
                <circle cx="19" cy="6" r="2.2" fill={T.accent} />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: 250 }}>
              <span style={{ font: "700 15.5px var(--font-nunito), sans-serif", color: T.text }}>Nog te weinig data</span>
              <span style={{ font: "500 12.5px/1.45 var(--font-nunito), sans-serif", color: T.textSec }}>
                We verzamelen rustig verder — kom over {Math.max(1, gereed.wekenNodig - gereed.wekenVerzameld)} weken terug voor je eerste fitheidstrend.
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>{gereed.wekenVerzameld} van de {gereed.wekenNodig} weken verzameld</span>
              <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.08 235)" }}>{gereed.pct}%</span>
            </div>
            <div style={{ width: "100%", height: 7, borderRadius: 999, background: T.divider, overflow: "hidden" }}>
              <div style={{ width: `${gereed.pct}%`, height: "100%", borderRadius: 999, background: T.accent }} />
            </div>
          </div>
        </div>
      )}

      {infoOpen && (
        <>
          <div onClick={() => setInfoOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(38,27,12,0.34)" }} />
          <div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 901, width: 338, maxWidth: "calc(100vw - 40px)", maxHeight: "80vh", overflowY: "auto", background: T.cardBg, borderRadius: 24, border: `1px solid ${T.cardBorder}`, boxShadow: "0 24px 60px rgba(28,32,45,0.28)", padding: "20px 20px 22px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 13, background: "oklch(0.955 0.02 235)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ font: "700 18px var(--font-fredoka), sans-serif", lineHeight: 1, color: "oklch(0.5 0.08 235)" }}>i</span>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, paddingTop: 1 }}>
                <span style={{ font: "700 18px var(--font-nunito), sans-serif", letterSpacing: -0.2, color: T.text }}>Fitheid in detail</span>
                <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.08 235)" }}>Drie signalen, elk over zijn eigen periode</span>
              </div>
              <div onClick={() => setInfoOpen(false)} style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "50%", background: T.subtleFill, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke={T.textSec} strokeWidth="2.6" strokeLinecap="round" /></svg>
              </div>
            </div>

            <span style={{ display: "block", font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase", marginBottom: 10 }}>EF per band · 8 weken</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {efBanden.map(b => (
                <div key={b.key} style={{ background: T.subtleFill, borderRadius: 16, padding: "12px 14px 11px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: b.kleur }} />
                      <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec, textTransform: "uppercase" }}>{b.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ font: "700 16px var(--font-fredoka), sans-serif", color: T.text }}>{formatNl(b.laatste)}</span>
                      {b.deltaPct != null && (
                        <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: b.deltaPct >= 0 ? T.accentText : T.textSec }}>{b.deltaPct > 0 ? "+" : ""}{b.deltaPct}%</span>
                      )}
                    </div>
                  </div>
                  <BigSpark data={b.punten.map(p => ({ v: p.ef }))} kleur={b.kleur} hoogte={56} />
                </div>
              ))}
            </div>
            <p style={{ margin: "0 0 18px", font: "500 12px/1.5 var(--font-nunito), sans-serif", color: T.textTert }}>Efficiency Factor (genormaliseerd vermogen ÷ gemiddelde hartslag), per intensiteitsband los bijgehouden. De banden worden nooit onderling vergeleken.</p>

            <span style={{ display: "block", font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase", marginBottom: 10 }}>Aerobe decoupling</span>
            <div style={{ background: T.subtleFill, borderRadius: 16, padding: "14px 14px 12px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ font: "700 25px var(--font-fredoka), sans-serif", letterSpacing: -0.4, color: T.text }}>{decLaatste != null ? `${formatNl(decLaatste, 1)}%` : "—"}</span>
                {decDelta != null && (
                  <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: decDelta <= 0 ? T.accentText : T.textSec }}>
                    {decDelta > 0 ? "+" : decDelta < 0 ? "−" : ""}{formatNl(Math.abs(decDelta), 1)}pp over {gereed.wekenNodig} wk
                  </span>
                )}
              </div>
              <BigSpark data={decSparkData} kleur="oklch(0.55 0.08 235)" hoogte={86} />
              <p style={{ margin: "8px 0 0", font: "500 12px/1.5 var(--font-nunito), sans-serif", color: T.textTert }}>Hartslagdrift binnen je Z2-duurritten — hoe lager, hoe steviger je aerobe basis.</p>
            </div>

            <span style={{ display: "block", font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase", marginBottom: 10 }}>Trainingsgedrag</span>
            <div style={{ background: T.subtleFill, borderRadius: 16, padding: "14px 14px 13px" }}>
              <div style={{ display: "flex", width: "100%", height: 16, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${z1z2Pct}%`, height: "100%", background: "oklch(0.75 0.05 232)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ font: "700 10px var(--font-nunito), sans-serif", color: "oklch(0.36 0.06 232)" }}>{z1z2Pct}%</span>
                </div>
                <div style={{ width: `${100 - z1z2Pct}%`, height: "100%", background: "oklch(0.72 0.08 80)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>Z1–Z2 · rustig vs Z3–Z5 · pittig</span>
                <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>doel 80/20</span>
              </div>
              <div style={{ paddingTop: 10, borderTop: `1px solid ${T.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.text }}>Sessies daadwerkelijk gereden</span>
                <span style={{ font: "700 17px var(--font-nunito), sans-serif", color: T.text }}>{planNaleving}%</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
