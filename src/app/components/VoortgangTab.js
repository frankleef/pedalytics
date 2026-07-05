"use client";
import { useState, useEffect } from "react";
import { T } from "../designTokens";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import SharedHeader from "./SharedHeader";
import InfoTooltip from "./InfoTooltip";
import { datumISO } from "@/lib/datum";
import { ResponsiveContainer, ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea } from "recharts";

const CARD = { background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 };
const EYEBROW = { font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.3, color: "oklch(0.62 0.015 75)", textTransform: "uppercase" };
const TICK = { fontSize: 9, fontFamily: "var(--font-nunito), sans-serif", fill: T.textTert };

function ChartTooltipContent({ active, payload, label, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.slate, borderRadius: 10, padding: "6px 12px", font: "700 12px var(--font-nunito), sans-serif", color: "#fff" }}>
      <div style={{ marginBottom: 2, opacity: 0.7 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || "#fff" }}>{p.name}: {p.value}{suffix}</div>)}
    </div>
  );
}

function seizoensdoelContextlijn({ huidigeFtp, doelFtp, startFtp, weekNr, tijdshorizon, rampRate }) {
  if (!doelFtp || !startFtp) return null;
  const restWeken = tijdshorizon - weekNr;
  const deltaNaarDoel = doelFtp - huidigeFtp;

  if (deltaNaarDoel <= 0) return `Doel bereikt — je bent ${Math.abs(deltaNaarDoel)}W voorbij je doelstelling.`;
  if (restWeken <= 2) return `Laatste ${restWeken} ${restWeken === 1 ? "week" : "weken"} — je seizoenstest nadert.`;

  const verwachteFtpWinst = restWeken * (rampRate ?? 0) * 0.8;
  const verwachtEindresultaat = huidigeFtp + verwachteFtpWinst;

  if (verwachtEindresultaat >= doelFtp) return `Als de huidige trend aanhoudt, kom je uit op ~${Math.round(verwachtEindresultaat)}W — op schema.`;
  return `Op de huidige koers eindig je rond ${Math.round(verwachtEindresultaat)}W. Nog ${deltaNaarDoel}W te gaan.`;
}

function ftpContextlijn({ huidigeFtp, startFtp }) {
  if (!startFtp) return null;
  const delta = huidigeFtp - startFtp;
  const pct = Math.round((delta / startFtp) * 100);
  if (delta <= 0) return "Je FTP is nog ongewijzigd dit seizoen.";
  if (delta < 5) return `Kleine stijging van ${delta}W — de basis wordt gelegd.`;
  return `${pct}% sterker dan bij de start van dit seizoen.`;
}

function conditieTrendContextlijn({ conditie, ctlDelta4w, aantalWeken }) {
  const weken = aantalWeken === 1 ? "week" : "weken";
  if (conditie === "groeit" && ctlDelta4w >= 8) return `Je fitheid stijgt sterk — ${ctlDelta4w} punten in 4 weken. Houd dit vast.`;
  if (conditie === "groeit") return `Je fitheid stijgt gestaag. ${aantalWeken} ${weken} op rij in de goede richting.`;
  if (conditie === "lichte_groei") return "Lichte groei — het gaat de goede kant op, maar er is ruimte voor meer stimulus.";
  if (conditie === "stabiel") return "Je fitheid houdt stand. Meer volume of intensiteit zou de groei aanzwengelen.";
  if (conditie === "lichte_daling") return "Kleine daling — normaal na een zware periode. Herstel goed en het keert terug.";
  return "Je fitheid daalt. Controleer je belasting en herstel de komende weken.";
}

function aerobeEfficiëntieContextlijn({ mediaan, trend }) {
  if (mediaan === null) return "Rijd meer Z2-ritten van >45 min om je aerobe efficiëntie te meten.";
  if (mediaan < 3) return "Uitstekende aerobe efficiëntie — je hart doet minimale extra moeite naarmate de rit vordert.";
  if (mediaan < 5 && trend === "dalend") return "Goede efficiëntie en nog aan het verbeteren — je Z2-basis wordt sterker.";
  if (mediaan < 5) return "Goede aerobe efficiëntie. Consistent Z2 rijden houdt dit op peil.";
  if (mediaan < 7 && trend === "dalend") return "Nog ruimte voor verbetering, maar de trend is goed — je lichaam past zich aan.";
  if (mediaan >= 7) return "Verhoogde decoupling — meer Z2-volume helpt de aerobe basis te versterken.";
  return `Je aerobe efficiëntie is ${trend === "dalend" ? "aan het verbeteren" : trend === "stijgend" ? "aan het verslechteren" : "stabiel"}.`;
}

function planNalevingContextlijn(pct) {
  if (pct >= 90) return "Uitstekende discipline — je mist bijna geen sessies.";
  if (pct >= 80) return "Goed. Minder dan één sessie per week gemist dit seizoen.";
  if (pct >= 65) return "Redelijk — meer consistentie zou de groei versnellen.";
  return "Veel gemiste sessies. Consistentie is de grootste hefboom voor verbetering.";
}

function polarisatieContextlijn(z1z2Pct) {
  if (z1z2Pct >= 83) return "Perfect gepolariseerd — je beschermt je aerobe basis goed.";
  if (z1z2Pct >= 75) return "Goed. Iets meer Z1–Z2 zou de aerobe basis verder versterken.";
  if (z1z2Pct >= 65) return "Te veel tijd in het midden — meer rustig of meer echt pittig.";
  return "Te veel intensiteit. Vervang middel-zone ritten door rustig Z2-werk.";
}

function npClient(watts) {
  if (!watts?.length || watts.length < 30) return null;
  const rolling = [];
  for (let i = 29; i < watts.length; i++) {
    let som = 0;
    for (let j = i - 29; j <= i; j++) som += watts[j];
    rolling.push(som / 30);
  }
  let som4 = 0;
  for (const w of rolling) som4 += Math.pow(w, 4);
  return Math.pow(som4 / rolling.length, 0.25);
}

function dcKleur(v) { return v >= 7 ? "oklch(0.55 0.18 25)" : v >= 5 ? "oklch(0.72 0.13 70)" : "oklch(0.45 0.13 162)"; }

const EF_BAND_LABELS = { z2: "Z2", sweetspot: "Sweetspot", drempel: "Drempel", vo2max: "VO2max" };

function efContextlijn({ trend, band, aantalRecent, minPunten }) {
  const naam = EF_BAND_LABELS[band];
  if (trend == null) return `Nog onvoldoende ${naam}-ritten voor een betrouwbare trend (${aantalRecent}/${minPunten} laatste 3 weken).`;
  if (trend > 0.005) return `Je efficiëntie op ${naam} verbetert — meer watt voor dezelfde hartslag bij dit intensiteitsniveau.`;
  if (trend < -0.005) return `Je efficiëntie op ${naam} daalt licht — let op vermoeidheid of herstel.`;
  return `Je efficiëntie op ${naam} is stabiel.`;
}

export default function VoortgangTab({ profiel, wellness, wellenessHuidig, voortgang, seizoensplan, onOpenProfiel, weekSessies }) {
  const [ftpHistorie, setFtpHistorie] = useState([]);
  const [conditieData, setConditieData] = useState(null);
  const [dcPunten, setDcPunten] = useState([]);
  const [efData, setEfData] = useState(null);
  const [efBand, setEfBand] = useState("z2");

  useEffect(() => {
    fetch("/api/ftp-historie").then(r => r.json()).then(d => { if (d.success && d.data) setFtpHistorie(d.data); }).catch(() => {});
    fetch("/api/plan/conditie-score").then(r => r.json()).then(d => { if (d.success && d.data) setConditieData(d.data); }).catch(() => {});
    fetch("/api/ef-trend").then(r => r.json()).then(d => { if (d.success && d.data) setEfData(d); }).catch(() => {});
  }, []);

  const ftp = profiel?.ftp || 265;
  const seizoenStart = seizoensplan?.startdatum ? new Date(seizoensplan.startdatum) : null;
  const seizoenWeken = seizoensplan?.tijdshorizon_weken || seizoensplan?.kader?.length || 13;
  const weekNr = seizoensplan?.startdatum ? weeknummerVoorDatum(new Date(), seizoensplan.startdatum) : null;

  const startFtp = (() => {
    if (seizoensplan?.start_ftp) return seizoensplan.start_ftp;
    if (ftpHistorie.length > 0 && seizoenStart) {
      const eersteNaStart = ftpHistorie.find(h => new Date(h.datum) >= seizoenStart);
      if (eersteNaStart) return eersteNaStart.ftp;
      return ftpHistorie[0]?.ftp || ftp;
    }
    return ftp;
  })();
  const doelFtp = seizoensplan?.seizoensdoel?.doel_ftp || null;
  const rampRate = conditieData?.ctl_ramp ?? null;

  // CTL-grafiek data — seizoenslang, alleen CTL
  const wellnessData = wellness || [];
  const dagPunten = wellnessData.filter(d => d.ctl != null).map(d => ({
    datum: (() => { const s = d.id?.split("T")[0] || ""; const [,m,dd] = s.split("-"); return m && dd ? `${dd}/${m}` : s; })(),
    ctl: Math.round(d.ctl),
    tsb: d.atl != null ? Math.round((d.ctl || 0) - (d.atl || 0)) : null,
  }));
  const huidigCtl = wellenessHuidig ? Math.round(wellenessHuidig.ctl || 0) : null;
  const ctlDelta4w = (() => {
    if (dagPunten.length < 28) return null;
    const vierWekenGeleden = dagPunten[dagPunten.length - 28]?.ctl;
    return huidigCtl != null && vierWekenGeleden != null ? huidigCtl - vierWekenGeleden : null;
  })();

  const conditieLabel = conditieData?.conditie || "onbekend";
  const aantalWekenGroei = (() => {
    if (!dagPunten.length || dagPunten.length < 14) return 1;
    let weken = 0;
    for (let w = 0; w < 12; w++) {
      const start = dagPunten.length - (w + 1) * 7;
      const eind = dagPunten.length - w * 7;
      if (start < 0) break;
      const weekStart = dagPunten[start]?.ctl;
      const weekEind = dagPunten[Math.min(eind, dagPunten.length) - 1]?.ctl;
      if (weekStart != null && weekEind != null && weekEind >= weekStart) weken++;
      else break;
    }
    return Math.max(1, weken);
  })();

  // Decoupling
  useEffect(() => {
    if (!voortgang?.ritten) return;
    const ftpVal = ftp;
    const z2Ritten = voortgang.ritten.filter(r => {
      if (!r.datum_iso || !r.duur_min || r.duur_min < 45) return false;
      const np = r.np || r.wattage;
      return np && (np / ftpVal) >= 0.55 && (np / ftpVal) <= 0.75;
    });
    if (z2Ritten.length < 2) { setDcPunten([]); return; }

    const fetchStreams = async () => {
      const pts = [];
      const gesorteerd = [...z2Ritten].sort((a, b) => a.datum_iso.localeCompare(b.datum_iso)).slice(-10);
      for (const rit of gesorteerd) {
        try {
          const resp = await fetch(`/api/intervals/activities/${rit.id}/streams`);
          const data = await resp.json();
          if (!data.success || !data.data) continue;
          const rawW = data.data.watts?.data || [], rawHr = data.data.heartrate?.data || [];
          const n = Math.min(rawW.length, rawHr.length);
          const watts = [], hr = [];
          for (let i = 0; i < n; i++) { if (rawW[i] > 0 && rawHr[i] > 0) { watts.push(rawW[i]); hr.push(rawHr[i]); } }
          if (watts.length < 2700) continue;
          const totaal = watts.reduce((a, w) => a + w, 0);
          let cum = 0, si = Math.floor(watts.length / 2);
          for (let i = 0; i < watts.length; i++) { cum += watts[i]; if (cum >= totaal / 2) { si = i; break; } }
          const np1 = npClient(watts.slice(0, si)), np2 = npClient(watts.slice(si));
          if (!np1 || !np2) continue;
          const hr1g = hr.slice(0, si).reduce((a, b) => a + b, 0) / si;
          const hr2g = hr.slice(si).reduce((a, b) => a + b, 0) / (hr.length - si);
          if (!hr1g || !hr2g) continue;
          const dc = ((np1 / hr1g - np2 / hr2g) / (np1 / hr1g)) * 100;
          const [, m, d] = rit.datum_iso.split("-");
          pts.push({ datum: `${d}/${m}`, decoupling: Math.round(dc * 10) / 10 });
        } catch {}
      }
      setDcPunten(pts);
    };
    fetchStreams();
  }, [voortgang?.ritten]);

  const dcWaarden = dcPunten.map(p => p.decoupling);
  const dcMediaan = dcWaarden.length >= 2 ? (() => { const s = [...dcWaarden].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 === 0 ? (s[m-1]+s[m])/2 : s[m]; })() : null;
  const dcTrend = (() => {
    if (dcWaarden.length < 4) return "stabiel";
    const n = Math.min(3, Math.floor(dcWaarden.length / 2));
    const vroeg = dcWaarden.slice(0, n), laat = dcWaarden.slice(-n);
    const delta = (laat.reduce((a,b)=>a+b,0)/laat.length) - (vroeg.reduce((a,b)=>a+b,0)/vroeg.length);
    return delta < -1 ? "dalend" : delta > 1 ? "stijgend" : "stabiel";
  })();

  // Plan-naleving
  const grens = seizoenStart || new Date(Date.now() - 8 * 7 * 86400000);
  const planSessies = (weekSessies?.sessies || []).filter(s => s.datum && new Date(s.datum) >= grens);
  const planRitten = (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grens);
  let matched = 0, totaalPlan = 0;
  planSessies.forEach(s => {
    if (new Date(s.datum) > new Date()) return;
    totaalPlan++;
    const rit = planRitten.find(r => r.datum_iso === s.datum);
    if (rit) matched++;
  });
  const planNaleving = totaalPlan > 0 ? Math.round((matched / totaalPlan) * 100) : 0;

  // Polarisatie
  const polData = { z12secs: 0, z35secs: 0 };
  (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= grens).forEach(r => {
    const zt = r.zoneTijden;
    if (!zt || !Array.isArray(zt)) return;
    zt.forEach(z => {
      if (z.id === "Z1" || z.id === "Z2") polData.z12secs += z.secs || 0;
      else polData.z35secs += z.secs || 0;
    });
  });
  const polTotaal = polData.z12secs + polData.z35secs;
  const z1z2Pct = polTotaal > 0 ? Math.round((polData.z12secs / polTotaal) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px` }}>
        <SharedHeader onAvatarClick={onOpenProfiel} />

        {/* Element 1 — Seizoensdoel hero */}
        {doelFtp && weekNr && (
          <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, padding: "20px 22px", marginBottom: 16 }}>
            <span style={EYEBROW}>
              SEIZOENSDOEL · WEEK {weekNr} VAN {seizoenWeken}
            </span>

            <div style={{ margin: "12px 0 8px", height: 8, borderRadius: 4, background: T.divider }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${Math.min(100, Math.max(0, ((ftp - startFtp) / (doelFtp - startFtp)) * 100))}%`,
                background: T.accent,
              }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>
                {startFtp}W start
              </span>
              <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.text }}>
                {ftp}W nu
              </span>
              <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>
                {doelFtp}W doel
              </span>
            </div>

            <p style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: T.textSec, margin: 0 }}>
              {seizoensdoelContextlijn({ huidigeFtp: ftp, doelFtp, startFtp, weekNr, tijdshorizon: seizoenWeken, rampRate })}
            </p>
          </div>
        )}

        {/* Element 2 — FTP-kaart (vereenvoudigd) */}
        <div style={{ ...CARD, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={EYEBROW}>Huidige FTP</span>
            <InfoTooltip metricKey="ftp" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span style={{ font: "600 56px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{ftp}</span>
            <span style={{ font: "600 20px var(--font-fredoka), sans-serif", color: T.textSec }}>W</span>
          </div>
          <p style={{ font: "600 13px/1.4 var(--font-nunito), sans-serif", color: T.textSec, margin: "8px 0 0" }}>
            {ftpContextlijn({ huidigeFtp: ftp, startFtp })}
          </p>
        </div>

        {/* Element 3 — Conditietrend (CTL only) */}
        {dagPunten.length >= 7 ? (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={EYEBROW}>Conditietrend</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                  {huidigCtl != null && <span style={{ font: "600 32px var(--font-fredoka), sans-serif", color: T.text }}>{huidigCtl}</span>}
                  {ctlDelta4w != null && <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: ctlDelta4w >= 0 ? T.accentText : "oklch(0.55 0.11 30)" }}>CTL {ctlDelta4w >= 0 ? "+" : ""}{ctlDelta4w} / 4wk</span>}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <ComposedChart data={dagPunten} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.divider} vertical={false} />
                <XAxis dataKey="datum" tick={TICK} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(dagPunten.length / 6))} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area dataKey="ctl" stroke="none" fill={T.accent} fillOpacity={0.15} />
                <Line dataKey="ctl" stroke={T.accent} strokeWidth={4} dot={false} name="CTL" />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 18, height: 5, borderRadius: 3, background: T.accent }} />
                <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>CTL (fitheid)</span>
                <InfoTooltip metricKey="ctl" />
              </div>
            </div>
            <p style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: T.textSec, margin: "10px 0 0" }}>
              {conditieTrendContextlijn({ conditie: conditieLabel, ctlDelta4w: ctlDelta4w ?? 0, aantalWeken: aantalWekenGroei })}
            </p>
          </div>
        ) : (
          <div style={{ ...CARD, padding: "20px 22px" }}>
            <span style={EYEBROW}>Conditietrend</span>
            <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, margin: "8px 0 0" }}>
              Nog te weinig data voor een betrouwbare conditietrend.
            </p>
          </div>
        )}

        {/* Element 4 — Aerobe efficiëntie (decoupling) */}
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <span style={EYEBROW}>Aerobe efficiëntie</span>
              <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2 }}>Cardiac decoupling · Z2-ritten</div>
            </div>
            {dcMediaan != null && (
              <span style={{ font: "600 22px var(--font-fredoka), sans-serif", color: dcKleur(dcMediaan) }}>
                {dcMediaan < 0 ? `−${Math.abs(dcMediaan)}` : Math.round(dcMediaan * 10) / 10}%
              </span>
            )}
          </div>

          {dcPunten.length >= 2 ? (
            <>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={dcPunten} margin={{ top: 8, right: 5, bottom: 0, left: -14 }}>
                  <ReferenceArea y1={5} y2={16} fill="oklch(0.97 0.025 75)" fillOpacity={0.4} />
                  <ReferenceArea y1={-6} y2={5} fill="oklch(0.95 0.03 165)" fillOpacity={0.3} />
                  <XAxis dataKey="datum" tick={TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit="%" />
                  <ReferenceLine y={5} stroke="oklch(0.6 0.13 165)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="decoupling" stroke={dcKleur(dcMediaan)} strokeWidth={2.5} dot={{ r: 3, fill: dcKleur(dcMediaan), stroke: "#fff", strokeWidth: 1.5 }} name="Decoupling" />
                </LineChart>
              </ResponsiveContainer>
              <p style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", margin: "10px 0 0" }}>
                {aerobeEfficiëntieContextlijn({ mediaan: dcMediaan, trend: dcTrend })}
              </p>
            </>
          ) : (
            <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, margin: "4px 0 0" }}>
              Rijd meer Z2-ritten van &gt;45 min om je aerobe efficiëntie te meten.
            </p>
          )}
        </div>

        {/* Element 4b — Efficiency Factor per intensiteitsband */}
        <div style={CARD}>
          <span style={EYEBROW}>Efficiency Factor</span>
          <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, marginTop: 2, marginBottom: 12 }}>
            NP / gem. hartslag — per intensiteitsband, niet onderling vergelijkbaar
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {Object.keys(EF_BAND_LABELS).map(band => (
              <button
                key={band}
                onClick={() => setEfBand(band)}
                style={{
                  border: "none", borderRadius: T.pillRadius, padding: "6px 12px", cursor: "pointer",
                  font: "800 12px var(--font-nunito), sans-serif",
                  background: efBand === band ? T.slate : T.subtleFill,
                  color: efBand === band ? T.cardBg : T.textSec,
                }}
              >
                {EF_BAND_LABELS[band]}
              </button>
            ))}
          </div>

          {(() => {
            const bandData = efData?.data?.[efBand];
            const punten = (bandData?.punten || []).map(p => {
              const [, m, d] = p.datum.split("-");
              return { datum: `${d}/${m}`, ef: p.ef };
            });
            const laatsteEf = punten.length ? punten[punten.length - 1].ef : null;

            if (!bandData || punten.length < 2) {
              return (
                <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec, margin: "4px 0 0" }}>
                  {efContextlijn({ trend: null, band: efBand, aantalRecent: bandData?.aantalRecent ?? 0, minPunten: efData?.minPuntenVoorTrend ?? 4 })}
                </p>
              );
            }

            return (
              <>
                {laatsteEf != null && (
                  <div style={{ font: "600 22px var(--font-fredoka), sans-serif", color: T.text, marginBottom: 4 }}>{laatsteEf.toFixed(2)}</div>
                )}
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={punten} margin={{ top: 8, right: 5, bottom: 0, left: -14 }}>
                    <XAxis dataKey="datum" tick={TICK} tickLine={false} axisLine={false} />
                    <YAxis tick={TICK} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="ef" stroke={T.accent} strokeWidth={2.5} dot={{ r: 3, fill: T.accent, stroke: "#fff", strokeWidth: 1.5 }} name="EF" />
                  </LineChart>
                </ResponsiveContainer>
                <p style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", margin: "10px 0 0" }}>
                  {bandData.voldoendeData
                    ? efContextlijn({ trend: bandData.trend, band: efBand })
                    : efContextlijn({ trend: null, band: efBand, aantalRecent: bandData.aantalRecent, minPunten: efData?.minPuntenVoorTrend ?? 4 })}
                </p>
              </>
            );
          })()}
        </div>

        {/* Element 5 — Trainingsgedrag (plan-naleving + polarisatie) */}
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, padding: "20px 22px", marginBottom: 16 }}>
          <span style={EYEBROW}>TRAININGSGEDRAG</span>

          {/* Plan-naleving */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>Plan gevolgd</span>
              <span style={{ font: "600 22px var(--font-fredoka), sans-serif", color: T.text }}>
                {totaalPlan > 0 ? `${planNaleving}%` : "–"}
              </span>
            </div>
            <p style={{ font: "600 12.5px/1.4 var(--font-nunito), sans-serif", color: T.textSec, margin: "4px 0 0" }}>
              {totaalPlan > 0 ? planNalevingContextlijn(planNaleving) : "Nog geen voltooide sessies om te vergelijken."}
            </p>
          </div>

          <div style={{ height: 1, background: T.divider, margin: "14px 0" }} />

          {/* Polarisatie */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>Rustig vs. pittig</span>
              <span style={{ font: "600 22px var(--font-fredoka), sans-serif", color: T.text }}>
                {polTotaal > 0 ? (
                  <>{z1z2Pct}%<span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textTert, marginLeft: 4 }}>Z1–Z2</span></>
                ) : "–"}
              </span>
            </div>
            <p style={{ font: "600 12.5px/1.4 var(--font-nunito), sans-serif", color: T.textSec, margin: "4px 0 0" }}>
              {polTotaal > 0 ? polarisatieContextlijn(z1z2Pct) : "Nog geen zonetijden beschikbaar."}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
