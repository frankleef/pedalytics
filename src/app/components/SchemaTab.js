"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { T, SLATE, STATUS, getStatus, zoneKleur } from "../designTokens";
import { berekenHerstelScore } from "./HerstelStatus";
import WorkoutViz, { WerkelijkViz } from "./WorkoutViz";
import { classificeerRit, ritMatchesSessie } from "@/lib/rittype";
import { datumISO } from "@/lib/datum";
import InfoTooltip from "./InfoTooltip";
import ScaleInput from "./ScaleInput";
import SharedHeader from "./SharedHeader";
import { StatusBanner, KerngetallenTiles } from "./SessieUitkomstKaart";

const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const DAG_KORT = ["ZO","MA","DI","WO","DO","VR","ZA"];
const RPE_LABELS = ["","Heel licht","Licht","Matig licht","Matig","Matig zwaar","Zwaar","Zwaar+","Erg zwaar","Maximaal-","Maximaal"];

const DOT_KLEUREN = {
  matched: "oklch(0.6 0.13 165)",
  deviated: "oklch(0.72 0.13 70)",
  unplanned: "oklch(0.55 0.07 215)",
  missed: "oklch(0.72 0.015 75)",
  planned: "oklch(0.74 0.05 200)",
  rest: "transparent",
  buiten_planperiode: "oklch(0.55 0.07 215)",
};

function segMidPct(seg) {
  if (seg.vermogenMin != null && seg.vermogenMax != null) return (seg.vermogenMin + seg.vermogenMax) / 2;
  return seg.vermogen_pct || 50;
}

function segWattRange(seg, ftpW) {
  const r5 = x => Math.round(x / 5) * 5;
  if (seg.vermogenMin != null && seg.vermogenMax != null) {
    return `${Math.round(seg.vermogenMin * ftpW / 100)}–${Math.round(seg.vermogenMax * ftpW / 100)} W`;
  }
  const w = (seg.vermogen_pct || 50) * ftpW / 100;
  return `${r5(w * 0.95)}–${r5(w * 1.05)} W`;
}

function segTimeStr(min) {
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;
}

const BLOCK_BG = {
  1: "oklch(0.58 0.075 245)",
  2: "oklch(0.56 0.13 245)",
  3: "oklch(0.54 0.115 165)",
  4: "oklch(0.56 0.14 62)",
  5: "oklch(0.53 0.16 28)",
};

function segZoneNr(pct) {
  if (pct < 56) return 1;
  if (pct <= 75) return 2;
  if (pct <= 90) return 3;
  if (pct <= 106) return 4;
  return 5;
}

function segRpeRange(pct) {
  if (pct < 56) return "1–2";
  if (pct <= 65) return "2–3";
  if (pct <= 75) return "3–4";
  if (pct <= 85) return "5–6";
  if (pct <= 95) return "6–7";
  if (pct <= 106) return "7–8";
  if (pct <= 120) return "8–9";
  return "9–10";
}

function bouwBlockGroups(segmenten, ftp) {
  if (!segmenten || segmenten.length === 0) return [];
  const ftpW = ftp || 265;

  const warmups = [];
  const cooldowns = [];
  const main = [];
  segmenten.forEach(seg => {
    if (seg.type === "warmup") warmups.push(seg);
    else if (seg.type === "cooldown") cooldowns.push(seg);
    else main.push(seg);
  });

  const makeBlock = (seg) => {
    const pct = segMidPct(seg);
    const zn = segZoneNr(pct);
    const label = seg.type === "herstel" || seg.type === "rust" ? "Herstel" : (seg.label?.replace(/\s*\d+$/, "") || seg.type);
    return { title: label, zone: zn, rpe: segRpeRange(pct), time: segTimeStr(seg.duur_min), watt: segWattRange(seg, ftpW), bg: BLOCK_BG[zn] };
  };

  const sigKey = (seg) => {
    const pct = segMidPct(seg);
    return `${seg.type}:${Math.round(pct)}`;
  };

  // Build pattern signature for a slice of segments
  const patternSig = (arr, start, len) => arr.slice(start, start + len).map(sigKey).join("|");

  const sets = [];

  // Warmup
  warmups.forEach(seg => sets.push({ reps: 1, blocks: [makeBlock(seg)] }));

  // Main: detect repeating patterns
  let i = 0;
  while (i < main.length) {
    // Try pattern lengths from longest to shortest
    let found = false;
    for (let patLen = Math.min(5, Math.floor((main.length - i) / 2)); patLen >= 1; patLen--) {
      const sig = patternSig(main, i, patLen);
      let reps = 1;
      while (i + reps * patLen + patLen <= main.length && patternSig(main, i + reps * patLen, patLen) === sig) {
        reps++;
      }
      if (reps >= 2) {
        const blocks = main.slice(i, i + patLen).map(makeBlock);
        sets.push({ reps, blocks });
        i += reps * patLen;
        found = true;
        break;
      }
    }
    if (!found) {
      sets.push({ reps: 1, blocks: [makeBlock(main[i])] });
      i++;
    }
  }

  // Cooldown
  cooldowns.forEach(seg => sets.push({ reps: 1, blocks: [makeBlock(seg)] }));

  return sets.map(s => {
    const grouped = s.reps > 1;
    const topZone = Math.max(...s.blocks.map(b => b.zone));
    return { ...s, grouped, count: `${s.reps}×`, badgeColor: BLOCK_BG[topZone] };
  });
}

const SESSIE_LABELS = { duur_lang: "Duurrit", duur_variabel: "Variabele duurrit", duur_middel: "Duurrit", sweetspot: "Sweet spot", interval: "Interval", herstel: "Herstelrit", drempel: "Drempel", vo2max: "VO2max", tempo: "Tempo" };

function bepaalMode(offset, sessie, rit, ftp, planStartISO) {
  const isVerleden = offset < 0;
  const isVandaagMetRit = offset === 0 && rit;
  if (!isVerleden && !isVandaagMetRit) return sessie ? "planned" : "rest";
  if (rit && planStartISO && rit.datum_iso < planStartISO && !sessie) return "buiten_planperiode";
  if (sessie && rit) {
    const cls = classificeerRit(rit, ftp);
    return ritMatchesSessie(cls, sessie.type) ? "matched" : "deviated";
  }
  if (!sessie && rit) return "unplanned";
  if (sessie && !rit) return "missed";
  return "rest";
}

export default function SchemaTab({
  seizoensplan, weekSessies, weekSessiesLaden, beschikbaar, voortgang,
  profiel, wellenessHuidig, vandaagInvoer, onEditBeschikbaarheid, initialDagOffset,
  onRpeSaved, onOpenProfiel,
}) {
  const [selectedIdx, setSelectedIdx] = useState(10 + (initialDagOffset || 0));
  const [rpeWaarde, setRpeWaarde] = useState(6);
  const [rpeOpslaan, setRpeOpslaan] = useState(false);
  const [rpeOpgeslagen, setRpeOpgeslagen] = useState({});
  const [streamsCache, setStreamsCache] = useState({});
  const [streamsLaden, setStreamsLaden] = useState(null);
  const [wahooTipWeg, setWahooTipWeg] = useState(() => typeof window !== "undefined" && localStorage.getItem("wahooTipGezien") === "1");
  const stripRef = useRef(null);

  const nu = new Date();
  const ftp = profiel?.ftp || 265;
  const hrvBasislijn = profiel?.hrv_basislijn || 58;
  const hrBasislijn = profiel?.hr_basislijn || 49;
  const tsb = wellenessHuidig ? Math.round((wellenessHuidig.ctl || 0) - (wellenessHuidig.atl || 0)) : null;
  const planStartISO = seizoensplan?.startdatum || null;

  const { score } = berekenHerstelScore({
    hrv: vandaagInvoer?.hrv, hrvBasislijn,
    rusthartslag: vandaagInvoer?.rusthartslag, rusthartslagBasislijn: hrBasislijn,
    tsb, slaapScore: vandaagInvoer?.slaapScore,
  });
  const statusKey = getStatus(score);
  const st = STATUS[statusKey];

  // 21-day strip
  const stripData = [];
  for (let i = 0; i < 21; i++) {
    const offset = i - 10;
    const d = new Date(nu);
    d.setDate(nu.getDate() + offset);
    const iso = datumISO(d);
    const dagNaam = DAGEN[d.getDay() === 0 ? 6 : d.getDay() - 1];
    const sessie = weekSessies?.sessies?.find(s => s.datum === iso && s.type !== "rust")
      || weekSessies?.sessies?.find(s => !s.datum && s.dag === dagNaam && s.type !== "rust")
      || null;
    const rit = (voortgang?.ritten || []).find(r => r.datum_iso === iso);
    const mode = bepaalMode(offset, sessie, rit, ftp, planStartISO);
    stripData.push({ offset, datum: d, iso, dagNaam, wd: DAG_KORT[d.getDay()], date: d.getDate(), sessie, rit, mode });
  }

  const sel = Math.max(0, Math.min(20, selectedIdx));
  const cur = stripData[sel];
  const dayOffset = cur.offset;
  const bekekeDagNaam = cur.dagNaam;
  const sessie = cur.sessie;
  const gematchteRit = cur.rit;
  const mode = cur.mode;
  const huidigeRpe = rpeOpgeslagen[gematchteRit?.id] ?? gematchteRit?.rpe ?? null;
  const ritCls = gematchteRit ? classificeerRit(gematchteRit, ftp) : null;
  const werkelijkWatts = gematchteRit ? streamsCache[gematchteRit.id] : null;

  // Fetch activity streams for rides
  useEffect(() => {
    if (!gematchteRit || streamsCache[gematchteRit.id] || streamsLaden === gematchteRit.id) return;
    setStreamsLaden(gematchteRit.id);
    fetch(`/api/intervals/activities/${gematchteRit.id}/streams`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.watts?.length > 0) {
          setStreamsCache(p => ({ ...p, [gematchteRit.id]: data.watts }));
        }
      })
      .catch(e => console.error("Streams laden:", e))
      .finally(() => setStreamsLaden(null));
  }, [gematchteRit?.id]);

  // Center strip
  const centerStrip = useCallback((smooth) => {
    const el = stripRef.current;
    if (!el) return;
    const tile = el.querySelector('[data-sel="1"]');
    if (!tile) return;
    const cRect = el.getBoundingClientRect();
    const sRect = tile.getBoundingClientRect();
    const target = el.scrollLeft + (sRect.left - cRect.left) - (el.clientWidth / 2 - sRect.width / 2);
    el.scrollTo({ left: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => { [0, 120, 350].forEach(t => setTimeout(() => centerStrip(false), t)); }, []);
  useEffect(() => { centerStrip(true); }, [selectedIdx]);

  // TSS week card
  const vandaagDagIdx = nu.getDay() === 0 ? 6 : nu.getDay() - 1;
  const maandag = new Date(nu); maandag.setDate(nu.getDate() - vandaagDagIdx); maandag.setHours(0,0,0,0);
  const rittenDezeWeek = (voortgang?.ritten || []).filter(r => r.datum_iso && new Date(r.datum_iso) >= maandag);
  const werkelijkTss = Math.round(rittenDezeWeek.reduce((s, r) => s + (r.tss || 0), 0));
  const dagenSindsStart = seizoensplan?.startdatum ? Math.max(0, (Date.now() - new Date(seizoensplan.startdatum).getTime()) / 86400000) : 0;
  const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7) || 1);
  const kaderWeek = seizoensplan?.kader?.find(w => w.week === weekNr) || seizoensplan?.kader?.[0];
  const doelTss = weekSessies?.tss_totaal || kaderWeek?.tss_doel || 0;
  const tssPct = doelTss > 0 ? Math.min(100, Math.round((werkelijkTss / doelTss) * 100)) : 0;

  // Session metrics
  const duurStr = sessie?.duur_min ? `${Math.floor(sessie.duur_min / 60)}u ${String(sessie.duur_min % 60).padStart(2, "0")}m` : null;
  const gemVermogen = sessie?.segmenten?.length > 0
    ? Math.round(sessie.segmenten.reduce((s, seg) => s + segMidPct(seg) * (seg.duur_min || 0), 0) / sessie.segmenten.reduce((s, seg) => s + (seg.duur_min || 0), 0) * ftp / 100)
    : null;
  const totaalMin = sessie?.segmenten?.reduce((s, seg) => s + (seg.duur_min || 0), 0) || sessie?.duur_min || 0;
  const tijdMarkers = totaalMin > 0 ? [0, 0.25, 0.5, 0.75, 1].map(p => { const min = Math.round(totaalMin * p); return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`; }) : [];
  const blockGroups = bouwBlockGroups(sessie?.segmenten, ftp);
  const sessieLabel = sessie ? (SESSIE_LABELS[sessie.type] || sessie.type) : "";

  const ritDuurStr = gematchteRit?.duur_min ? `${Math.floor(gematchteRit.duur_min / 60)}u ${String(gematchteRit.duur_min % 60).padStart(2, "0")}m` : null;
  const ritTijdMarkers = gematchteRit?.duur_min > 0 ? [0, 0.25, 0.5, 0.75, 1].map(p => { const min = Math.round(gematchteRit.duur_min * p); return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`; }) : [];

  // Reusable RPE component
  const renderRpe = () => {
    if (!gematchteRit) return null;
    const waarde = huidigeRpe ?? rpeWaarde;
    return (
      <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "18px 20px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
        {huidigeRpe != null ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>RPE</span>
              <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)" }}>Opgeslagen</span>
            </div>
            <ScaleInput value={waarde} max={10} onChange={() => {}} leftLabel="Heel licht" rightLabel="Maximaal" />
          </>
        ) : (
          <>
            <ScaleInput
              value={rpeWaarde}
              max={10}
              question="Hoe voelde de rit?"
              leftLabel="Heel licht"
              rightLabel="Maximaal"
              onChange={setRpeWaarde}
            />
            <button disabled={rpeOpslaan} onClick={async () => {
              setRpeOpslaan(true);
              try {
                const resp = await fetch(`/api/intervals/workouts/${gematchteRit.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rpe: rpeWaarde }) });
                const data = await resp.json();
                if (data.success) { setRpeOpgeslagen(p => ({ ...p, [gematchteRit.id]: rpeWaarde })); onRpeSaved?.(gematchteRit.id, rpeWaarde); }
              } catch (e) { console.error("RPE opslaan:", e); }
              setRpeOpslaan(false);
            }} style={{ width: "100%", marginTop: 14, border: "none", cursor: "pointer", padding: 14, borderRadius: T.pillRadius, background: T.slate, color: "oklch(0.97 0.01 84)", font: "700 14px var(--font-nunito), sans-serif", opacity: rpeOpslaan ? 0.6 : 1 }}>
              {rpeOpslaan ? "Opslaan..." : "RPE opslaan"}
            </button>
          </>
        )}
      </div>
    );
  };

  const renderRitMetrics = (toonPlan) => {
    if (!gematchteRit) return null;
    return (
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Duur", value: ritDuurStr || "—", plan: toonPlan && duurStr ? `plan ${duurStr}` : null },
          { label: "TSS", value: gematchteRit.tss || "—", plan: toonPlan && sessie?.tss ? `plan ${sessie.tss}` : null, infoKey: "tss" },
          { label: "Gem. vermogen", value: gematchteRit.wattage ? `${gematchteRit.wattage}` : "—", unit: "w", plan: toonPlan && gemVermogen ? `plan ${gemVermogen}w` : null, infoKey: "vermogen" },
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
  };

  // Werkelijk-gereden grafiek kaart (voor deviated/unplanned/buiten_planperiode)
  const renderWerkelijkGrafiek = () => {
    if (!werkelijkWatts || werkelijkWatts.length < 10) return null;
    return (
      <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, padding: "0 2px" }}>
          <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Gereden vermogensprofiel</span>
          <span style={{ font: "700 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>FTP {ftp}W</span>
        </div>
        <WerkelijkViz watts={werkelijkWatts} ftp={ftp} hoogte={170} />
        {ritTijdMarkers.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 2px", marginBottom: 14 }}>
            {ritTijdMarkers.map((t, i) => <span key={i} style={{ font: "700 10px var(--font-nunito), sans-serif", color: T.textTert }}>{t}</span>)}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 13, borderTop: `1px solid ${T.divider}` }}>
          {[["Z1", T.z1], ["Z2", T.z2], ["Z3", T.z3], ["Z4", T.z4], ["Z5", T.z5]].map(([l, k]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: k }} />
              <span style={{ font: "700 10.5px var(--font-nunito), sans-serif", color: T.textSec }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (weekSessiesLaden) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
        <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <div style={{ font: "600 14px var(--font-nunito), sans-serif", color: T.textSec }}>Sessies worden gegenereerd...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "16px 0 28px" }}>

        <div style={{ padding: `0 ${T.pad}px` }}>
          <SharedHeader onAvatarClick={onOpenProfiel} />
        </div>

        {/* Day strip */}
        <div ref={stripRef} style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 0 18px", padding: "2px calc(50% - 26px) 6px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {stripData.map((t, i) => {
            const isSel = i === sel;
            const isToday = i === 10;
            return (
              <div key={i} data-sel={isSel ? "1" : "0"} onClick={() => setSelectedIdx(i)}
                style={{ flex: "none", width: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "9px 0 8px", borderRadius: 18, cursor: "pointer",
                  background: isSel ? T.slate : "transparent",
                  border: isSel ? `1.5px solid ${T.slate}` : isToday ? "1.5px solid oklch(0.78 0.07 220)" : "1.5px solid transparent",
                }}>
                <span style={{ font: "800 10px var(--font-nunito), sans-serif", letterSpacing: 0.5, color: isSel ? "oklch(0.78 0.02 84)" : "oklch(0.62 0.02 75)" }}>{t.wd}</span>
                <span style={{ font: "600 20px var(--font-fredoka), sans-serif", lineHeight: 1, color: isSel ? "oklch(0.97 0.01 84)" : "oklch(0.3 0.02 70)" }}>{t.date}</span>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: DOT_KLEUREN[t.mode] }} />
              </div>
            );
          })}
        </div>

        <div style={{ padding: `0 ${T.pad}px` }}>

        {/* TSS week card */}
        <div style={{ background: T.cardBg, borderRadius: 24, padding: "15px 17px 16px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>TSS deze week</span>
            <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>
              <span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: T.text }}>{werkelijkTss}</span> / {doelTss}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: T.pillRadius, background: "oklch(0.93 0.012 84)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${tssPct}%`, borderRadius: T.pillRadius, background: T.gradient }} />
          </div>
        </div>

        {/* ══ PLANNED ══ */}
        {mode === "planned" && sessie && (
          <div>
            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert, textTransform: "uppercase" }}>{sessieLabel.toUpperCase()}</span>
            <h1 style={{ margin: "5px 0 18px", font: "800 28px/1.18 var(--font-nunito), sans-serif", letterSpacing: -0.5, textWrap: "pretty", color: T.text }}>{sessie.titel}</h1>

            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              {[
                { label: "Duur", value: duurStr || "—" },
                { label: "TSS", value: sessie.tss || "—", infoKey: "tss" },
                { label: "Gem. vermogen", value: gemVermogen ? `${gemVermogen}` : "—", unit: "w", infoKey: "vermogen" },
              ].map((m, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "15px 14px", borderRadius: 18, background: T.cardBg, border: `1px solid ${T.cardBorder}`, boxShadow: "0 2px 10px rgba(60,45,20,0.04)" }}>
                  <span style={{ font: "600 27px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{m.value}{m.unit && <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.textSec }}>{m.unit}</span>}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>{m.label}</span>
                    {m.infoKey && <InfoTooltip metricKey={m.infoKey} />}
                  </div>
                </div>
              ))}
            </div>

            {sessie.segmenten && (
              <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, padding: "0 2px" }}>
                  <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Vermogensprofiel</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ font: "700 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>FTP {ftp}W</span>
                    <InfoTooltip metricKey="ftp" />
                  </div>
                </div>
                <WorkoutViz segmenten={sessie.segmenten} hoogte={170} ftp={ftp} />
                {tijdMarkers.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 2px", marginBottom: 14 }}>
                    {tijdMarkers.map((t, i) => <span key={i} style={{ font: "700 10px var(--font-nunito), sans-serif", color: T.textTert }}>{t}</span>)}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 13, borderTop: `1px solid ${T.divider}` }}>
                  {[["Z1", T.z1], ["Z2", T.z2], ["Z3", T.z3], ["Z4", T.z4], ["Z5", T.z5]].map(([l, k]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: k }} />
                      <span style={{ font: "700 10.5px var(--font-nunito), sans-serif", color: T.textSec }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {blockGroups.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 2px 0" }}>
                  <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Opbouw</span>
                  <span style={{ font: "700 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>FTP {ftp}W</span>
                </div>
                {blockGroups.map((g, gi) => (
                  <div key={gi} style={{ position: "relative", paddingRight: g.grouped ? 44 : 0 }}>
                    {g.grouped && (
                      <>
                        <div style={{ position: "absolute", top: 15, bottom: 15, right: 12, width: 3, borderRadius: 3, background: "rgba(38,27,12,0.20)", zIndex: 1 }} />
                        <div style={{ position: "absolute", top: 14, right: 12, width: 14, height: 3, borderRadius: 3, background: "rgba(38,27,12,0.20)", zIndex: 1 }} />
                        <div style={{ position: "absolute", bottom: 14, right: 12, width: 14, height: 3, borderRadius: 3, background: "rgba(38,27,12,0.20)", zIndex: 1 }} />
                      </>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {g.blocks.map((b, bi) => (
                        <div key={bi} style={{ position: "relative", zIndex: 2, background: b.bg, borderRadius: 20, padding: "16px 19px 15px", boxShadow: "0 4px 14px rgba(40,30,15,0.10)" }}>
                          <span style={{ font: "600 19px var(--font-fredoka), sans-serif", color: "oklch(0.99 0.01 95)", letterSpacing: 0.2 }}>{b.title}</span>
                          <div style={{ display: "flex", marginTop: 12 }}>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ font: "800 9.5px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: "rgba(255,255,255,0.74)" }}>RPE</span>
                              <span style={{ font: "600 20px var(--font-fredoka), sans-serif", lineHeight: 1, color: "oklch(0.99 0.01 95)" }}>{b.rpe}</span>
                            </div>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ font: "800 9.5px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: "rgba(255,255,255,0.74)" }}>TOTALE TIJD</span>
                              <span style={{ font: "600 20px var(--font-fredoka), sans-serif", lineHeight: 1, color: "oklch(0.99 0.01 95)" }}>{b.time}</span>
                            </div>
                          </div>
                          <div style={{ height: 1, background: "rgba(255,255,255,0.24)", margin: "13px 0 11px" }} />
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ font: "800 9.5px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: "rgba(255,255,255,0.74)" }}>VERMOGEN</span>
                            <span style={{ font: "600 18px var(--font-fredoka), sans-serif", color: "oklch(0.99 0.01 95)", whiteSpace: "nowrap" }}>{b.watt}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {g.grouped && (
                      <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 5, width: 40, height: 40, borderRadius: "50%", background: T.cardBg, boxShadow: "0 3px 11px rgba(40,30,15,0.18)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 15px var(--font-fredoka), sans-serif", color: g.badgeColor }}>
                        {g.count}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sessie.reden && (
              <div style={{ background: SLATE.bg, borderRadius: T.cardRadius, padding: "22px 22px 24px", boxShadow: SLATE.shadow, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px var(--font-fredoka), sans-serif", color: "oklch(0.2 0.03 245)" }}>P</div>
                  <span style={{ font: "800 11.5px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: SLATE.label }}>{dayOffset === 0 ? "WAAROM VANDAAG" : `WAAROM ${bekekeDagNaam.toUpperCase()}`}</span>
                </div>
                <p style={{ margin: "0 0 16px", font: "600 15px/1.5 var(--font-nunito), sans-serif", color: SLATE.text, textWrap: "pretty" }}>{sessie.reden}</p>
                <div style={{ display: "flex", gap: 10 }}>
                  {tsb != null && (
                    <div style={{ flex: 1, background: SLATE.tile, borderRadius: 14, padding: "11px 13px" }}>
                      <div style={{ font: "600 19px var(--font-fredoka), sans-serif", color: SLATE.accent }}>{tsb > 0 ? "+" : ""}{tsb} TSB</div>
                      <div style={{ font: "600 11px var(--font-nunito), sans-serif", color: "oklch(0.74 0.03 230)" }}>Vorm vandaag</div>
                    </div>
                  )}
                  <div style={{ flex: 1, background: SLATE.tile, borderRadius: 14, padding: "11px 13px" }}>
                    <div style={{ font: "600 19px var(--font-fredoka), sans-serif", color: SLATE.accent }}>{st.label}</div>
                    <div style={{ font: "600 11px var(--font-nunito), sans-serif", color: "oklch(0.74 0.03 230)" }}>Herstelstatus</div>
                  </div>
                </div>
                <p style={{ margin: "14px 0 0", font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.7 0.03 210)" }}>Voelt het zwaar? Pas de laatste set aan of verkort de sessie — luister naar je lichaam.</p>
              </div>
            )}

            {sessie.intervalsEventId && !wahooTipWeg && (
              <div style={{ background: "oklch(0.955 0.03 220)", border: "1px solid oklch(0.85 0.06 220)", borderRadius: 18, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>&#x2139;&#xFE0F;</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.35 0.06 220)", marginBottom: 4 }}>Wahoo-koppeling nodig</div>
                  <div style={{ font: "600 12px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.04 220)" }}>
                    Deze sessie staat in intervals.icu. Om hem op je Wahoo te krijgen: koppel Wahoo in intervals.icu-instellingen en vink "upload workouts" aan.
                  </div>
                </div>
                <button onClick={() => { setWahooTipWeg(true); localStorage.setItem("wahooTipGezien", "1"); }}
                  style={{ background: "none", border: "none", cursor: "pointer", font: "600 11px var(--font-nunito), sans-serif", color: "oklch(0.55 0.04 220)", padding: "2px 6px", flexShrink: 0 }}>Begrepen</button>
              </div>
            )}
          </div>
        )}

        {/* ══ MATCHED ══ */}
        {mode === "matched" && (
          <div>
            <StatusBanner mode="matched" />

            {sessie && (
              <>
                <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert, textTransform: "uppercase" }}>{sessieLabel.toUpperCase()}</span>
                <h1 style={{ margin: "5px 0 4px", font: "800 28px/1.18 var(--font-nunito), sans-serif", letterSpacing: -0.5, textWrap: "pretty", color: T.text }}>{sessie.titel}</h1>
                {gematchteRit?.naam && <p style={{ margin: "0 0 18px", font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>{gematchteRit.naam}</p>}
              </>
            )}

            {renderRitMetrics(true)}

            {sessie?.segmenten && (
              <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 18px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, padding: "0 2px" }}>
                  <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Gepland vs gereden</span>
                  <span style={{ font: "700 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>FTP {ftp}W</span>
                </div>
                <WorkoutViz segmenten={sessie.segmenten} hoogte={170} ftp={ftp} opacity={0.4} werkelijkWatts={werkelijkWatts} />
                <div style={{ display: "flex", gap: 18, paddingTop: 13, borderTop: `1px solid ${T.divider}`, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 13, height: 9, borderRadius: 2, background: "oklch(0.72 0.13 165)", opacity: 0.45 }} /><span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>Gepland</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 15, height: 2.5, borderRadius: 2, background: T.text }} /><span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec }}>Gereden</span></div>
                </div>
              </div>
            )}

            {renderRpe()}
          </div>
        )}

        {/* ══ DEVIATED ══ */}
        {mode === "deviated" && (
          <div>
            <StatusBanner mode="deviated" />

            {gematchteRit?.naam && <p style={{ margin: "0 0 12px", font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>{gematchteRit.naam}</p>}

            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, borderRadius: 16, background: T.cardBg, border: "1px dashed oklch(0.85 0.014 80)", padding: "13px 14px" }}>
                <div style={{ font: "800 9.5px var(--font-nunito), sans-serif", letterSpacing: 1, color: T.textTert, marginBottom: 5 }}>GEPLAND</div>
                <div style={{ font: "700 14.5px var(--font-nunito), sans-serif", color: "oklch(0.45 0.02 74)" }}>{sessie ? SESSIE_LABELS[sessie.type] || sessie.type : "—"}</div>
                <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>{sessie ? SESSIE_LABELS[sessie.type] || sessie.type : ""}</div>
              </div>
              <div style={{ flex: "none", display: "flex", alignItems: "center", color: T.textTert }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ flex: 1, borderRadius: 16, background: "oklch(0.96 0.05 82)", border: "1px solid oklch(0.85 0.08 78)", padding: "13px 14px" }}>
                <div style={{ font: "800 9.5px var(--font-nunito), sans-serif", letterSpacing: 1, color: "oklch(0.56 0.09 68)", marginBottom: 5 }}>GEREDEN</div>
                <div style={{ font: "700 14.5px var(--font-nunito), sans-serif", color: "oklch(0.4 0.06 66)" }}>{ritCls?.label || "Rit"}</div>
                <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.05 70)" }}>{ritCls?.label || ""}</div>
              </div>
            </div>

            {renderRitMetrics(false)}
            {renderWerkelijkGrafiek()}
            {renderRpe()}
          </div>
        )}

        {/* ══ UNPLANNED ══ */}
        {mode === "unplanned" && (
          <div>
            <StatusBanner mode="unplanned" />

            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert, textTransform: "uppercase" }}>GEDETECTEERD · {(ritCls?.label || "Rit").toUpperCase()}</span>
            <h1 style={{ margin: "5px 0 18px", font: "800 28px/1.18 var(--font-nunito), sans-serif", letterSpacing: -0.5, textWrap: "pretty", color: T.text }}>{gematchteRit?.naam || ritCls?.label || "Rit"}</h1>

            {renderRitMetrics(false)}
            {renderWerkelijkGrafiek()}
            {renderRpe()}
          </div>
        )}

        {/* ══ BUITEN PLANPERIODE ══ */}
        {mode === "buiten_planperiode" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: "oklch(0.97 0.012 84)", border: `1px solid ${T.divider}`, borderRadius: 18, padding: "13px 15px", marginBottom: 16 }}>
              <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "50%", background: "oklch(0.55 0.07 215)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="17" r="3.2" stroke="#fff" strokeWidth="2"/><circle cx="18" cy="17" r="3.2" stroke="#fff" strokeWidth="2"/><path d="M6 17l4-7h5l2 7M10 10h3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: T.text }}>Rit buiten planperiode</span>
                <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>Er was nog geen actief plan op deze dag</span>
              </div>
            </div>

            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert, textTransform: "uppercase" }}>GEDETECTEERD · {(ritCls?.label || "Rit").toUpperCase()}</span>
            <h1 style={{ margin: "5px 0 18px", font: "800 28px/1.18 var(--font-nunito), sans-serif", letterSpacing: -0.5, textWrap: "pretty", color: T.text }}>{gematchteRit?.naam || ritCls?.label || "Rit"}</h1>

            {renderRitMetrics(false)}
            {renderWerkelijkGrafiek()}
            {renderRpe()}
          </div>
        )}

        {/* ══ MISSED ══ */}
        {mode === "missed" && (
          <div style={{ minHeight: 430, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px 16px" }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", background: "oklch(0.97 0.012 84)", border: "1.5px dashed oklch(0.85 0.014 80)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22, boxShadow: "0 2px 16px rgba(60,45,20,0.04)" }}>
              <div style={{ width: 30, height: 4, borderRadius: 3, background: "oklch(0.72 0.015 75)" }} />
            </div>
            <h1 style={{ margin: "0 0 8px", font: "800 24px var(--font-nunito), sans-serif", letterSpacing: -0.3, color: "oklch(0.38 0.02 72)" }}>Geen rit gevonden voor deze sessie</h1>
            <p style={{ margin: "0 0 24px", font: "600 14.5px var(--font-nunito), sans-serif", color: T.textSec }}>Geen probleem — een gemiste sessie hoort erbij</p>
            {sessie && (
              <div style={{ maxWidth: 312, background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 24, padding: "17px 20px", boxShadow: T.cardShadow }}>
                <div style={{ font: "800 9.5px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, marginBottom: 8, textAlign: "left" }}>STOND GEPLAND</div>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 4, height: 32, borderRadius: 3, background: "oklch(0.72 0.13 165)", flex: "none", opacity: 0.6 }} />
                  <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ font: "700 14.5px var(--font-nunito), sans-serif", color: T.textSec }}>{sessie.titel || SESSIE_LABELS[sessie.type] || sessie.type}</span>
                    <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textTert }}>{duurStr || "?"} · {sessie.tss || "?"} TSS · gepland</span>
                  </div>
                </div>
              </div>
            )}
            <p style={{ maxWidth: 300, margin: "20px 0 0", font: "600 13px/1.5 var(--font-nunito), sans-serif", color: T.textSec, textWrap: "pretty" }}>Je plan past zich automatisch aan rond gemiste dagen. Geen actie nodig.</p>
          </div>
        )}

        {/* ══ REST ══ */}
        {mode === "rest" && (
          <div style={{ minHeight: 440, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "30px 16px" }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", background: "oklch(0.97 0.012 84)", border: "1.5px solid oklch(0.88 0.014 80)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 2px 16px rgba(60,45,20,0.045)" }}>
              <div style={{ width: 32, height: 5, borderRadius: 3, background: "oklch(0.68 0.015 75)" }} />
            </div>
            <h1 style={{ margin: "0 0 8px", font: "800 26px var(--font-nunito), sans-serif", letterSpacing: -0.3, color: "oklch(0.3 0.02 70)" }}>Rustdag</h1>
            <p style={{ margin: "0 0 28px", font: "600 14.5px var(--font-nunito), sans-serif", color: T.textSec }}>Herstel · geen sessie gepland</p>
            <div style={{ maxWidth: 306, background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 24, padding: "19px 22px", boxShadow: T.cardShadow }}>
              <p style={{ margin: 0, font: "600 14.5px/1.5 var(--font-nunito), sans-serif", color: T.textSec, textWrap: "pretty" }}>Rust is waar je sterker wordt. Je laat de belasting van deze week landen — niets te doen vandaag, en dat is precies de bedoeling.</p>
            </div>
          </div>
        )}

        </div>
      </div>

    </div>
  );
}
