"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { T, SLATE, STATUS, getStatus, zoneKleur } from "../designTokens";
import { berekenHerstelScore } from "./HerstelStatus";
import WorkoutViz, { WerkelijkViz } from "./WorkoutViz";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { classificeerRit } from "@/lib/rittype";
import { datumISO } from "@/lib/datum";
import InfoTooltip from "./InfoTooltip";
import ScaleInput from "./ScaleInput";
import { isRpeAanpasbaar, berekenVerwachtRpe } from "@/lib/sessie/rpe";
import { berekenNP } from "@/lib/np";
import SharedHeader from "./SharedHeader";
import { KerngetallenTiles, StatusBanner } from "./SessieUitkomstKaart";
import AdaptatieScoreKaart from "./AdaptatieScoreKaart"; // TSS+fase kaart op Schema
import AlternatiefSessiePopup from "./AlternatiefSessiePopup";
import HrvAdviesKaart, { bepaalKeuzes } from "./HrvAdviesKaart";

const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const DAG_KORT = ["ZO","MA","DI","WO","DO","VR","ZA"];
const RPE_LABELS = ["","Heel licht","Licht","Matig licht","Matig","Matig zwaar","Zwaar","Zwaar+","Erg zwaar","Maximaal-","Maximaal"];

const DOT_KLEUREN = {
  uitgevoerd: "oklch(0.55 0.01 250)",
  unplanned: "oklch(0.55 0.07 215)",
  missed: "oklch(0.72 0.015 75)",
  planned: "oklch(0.74 0.05 200)",
  rest: "transparent",
  buiten_planperiode: "oklch(0.55 0.07 215)",
};

// Legacy fallback: sessies gegenereerd vóór 24 juni 2026 hebben geen eenheid-veld.
// De >100-heuristiek werkt voor alle bestaande data (FTP-gebaseerde %waarden
// liggen altijd onder 100, wattages altijd boven).
// TODO: retroactieve migratie overwegen als legacy sessies <5% van totaal zijn.
function segIsWatts(seg) {
  if (seg.eenheid === "watts") return true;
  if (seg.eenheid === "pctFTP") return false;
  return seg.vermogenMin != null && seg.vermogenMin > 100;
}

function segMidPct(seg) {
  if (seg.vermogenMin != null && seg.vermogenMax != null) {
    if (segIsWatts(seg)) return ((seg.vermogenMin + seg.vermogenMax) / 2 / (seg._ftpRef || 265)) * 100;
    return (seg.vermogenMin + seg.vermogenMax) / 2;
  }
  return 50;
}

function segWattRange(seg, ftpW) {
  if (seg.vermogenMin != null && seg.vermogenMax != null) {
    if (segIsWatts(seg)) return `${seg.vermogenMin}–${seg.vermogenMax} W`;
    return `${Math.round(seg.vermogenMin * ftpW / 100)}–${Math.round(seg.vermogenMax * ftpW / 100)} W`;
  }
  return `${Math.round(50 * ftpW / 100)} W`;
}

function segTimeStr(min) {
  const totalSec = Math.round(min * 60);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`;
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
    const zoneLabel = zn <= 2 ? "Z" + zn : zn === 3 ? "Tempo" : zn === 4 ? "Drempel" : "VO2max";
    const label = seg.label?.replace(/\s*\d+$/, "") || zoneLabel;
    const cadans = seg.cadans_rpm && typeof seg.cadans_rpm === "object" && seg.cadans_rpm.max ? `${seg.cadans_rpm.min || "?"}–${seg.cadans_rpm.max} rpm` : null;
    const duurMin = seg.duur_min || (seg.blokDuurSeconden ? seg.blokDuurSeconden / 60 : 0);
    return { title: label, zone: zn, rpe: segRpeRange(pct), time: segTimeStr(duurMin), watt: segWattRange(seg, ftpW), bg: BLOCK_BG[zn], cadans };
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

function bepaalMode(offset, sessie, rit, planStartISO) {
  const isVerleden = offset < 0;
  const isVandaagMetRit = offset === 0 && rit;
  if (!isVerleden && !isVandaagMetRit) return sessie ? "planned" : "rest";
  if (rit && planStartISO && rit.datum_iso < planStartISO && !sessie) return "buiten_planperiode";
  if (sessie && rit) return "uitgevoerd";
  if (!sessie && rit) return "unplanned";
  if (sessie && !rit) {
    // Pas "missed" tonen als het voorbij 06:00 de volgende ochtend is
    if (offset === -1 && new Date().getHours() < 6) return "planned";
    return "missed";
  }
  return "rest";
}

const DIMENSIE_LABELS = {
  duur: "Duur",
  belasting: "Belasting",
  intensiteit: "Intensiteit",
  zonedistributie: "Zonedistributie",
  rpe: "RPE",
};

function DimensiesUitklapper({ dimensies }) {
  const [open, setOpen] = useState(false);
  const beschikbaar = Object.entries(dimensies).filter(([, d]) => d.score !== null);
  if (beschikbaar.length === 0) return null;
  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`, marginBottom: 16, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "none", border: "none", cursor: "pointer" }}
      >
        <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.text }}>Dimensies</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <path d="M6 9l6 6 6-6" stroke={T.textSec} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {beschikbaar.map(([key, d]) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>{DIMENSIE_LABELS[key] || key}</span>
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.38 0.01 250)" }}>{Math.round(d.score * 10) / 10}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "oklch(0.91 0.006 250)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${d.score * 10}%`, borderRadius: 3, background: "oklch(0.55 0.01 250)", transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchemaTab({
  seizoensplan, weekSessies, weekSessiesLaden, beschikbaar, voortgang,
  profiel, wellenessHuidig, vandaagInvoer, onEditBeschikbaarheid, initialDagOffset,
  onRpeSaved, onOpenProfiel, onPlanWijziging, onAlternatiefSessie, weerData,
}) {
  const [selectedIdx, setSelectedIdx] = useState(10 + (initialDagOffset || 0));
  const [rpeWaarde, setRpeWaarde] = useState(6);
  const weerForecast = weerData?.forecast || {};
  const [rpeOpslaan, setRpeOpslaan] = useState(false);
  const [rpeOpgeslagen, setRpeOpgeslagen] = useState({});
  const [rpeBewerken, setRpeBewerken] = useState(false);
  const [streamsCache, setStreamsCache] = useState({});
  const [streamsLaden, setStreamsLaden] = useState(null);
  const [deviceTipWeg, setDeviceTipWeg] = useState(() => typeof window !== "undefined" && localStorage.getItem("deviceTipGezien") === "1");
  const [hitteData, setHitteData] = useState({});
  const [toontAlternatiefPopup, setToontAlternatiefPopup] = useState(false);
  const [alternatiefLaden, setAlternatiefLaden] = useState(false);
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
    const mode = bepaalMode(offset, sessie, rit, planStartISO);
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
        const watts = data?.data?.watts?.data || data?.watts || [];
        if (watts.length > 0) {
          setStreamsCache(p => ({ ...p, [gematchteRit.id]: watts }));
        }
      })
      .catch(e => console.error("Streams laden:", e))
      .finally(() => setStreamsLaden(null));
  }, [gematchteRit?.id]);

  // Fetch hitte-data voor de gematchte rit
  useEffect(() => {
    if (!gematchteRit?.id || hitteData[gematchteRit.id]) return;
    fetch(`/api/plan/hitte?ritId=${gematchteRit.id}`).then(r => r.json()).then(d => {
      if (d.success && d.data) setHitteData(p => ({ ...p, [gematchteRit.id]: d.data }));
    }).catch(() => {});
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

  // TSS rollend 7 dagen
  const grensISO = datumISO(new Date(nu.getTime() - 6 * 86400000));
  const rittenRollend7d = (voortgang?.ritten || []).filter(r => r.datum_iso && r.datum_iso >= grensISO);
  const werkelijkTss = Math.round(rittenRollend7d.reduce((s, r) => s + (r.tss || 0), 0));
  const weekNr = seizoensplan?.startdatum ? weeknummerVoorDatum(new Date(), seizoensplan.startdatum) : 1;
  const kaderWeek = seizoensplan?.kader?.find(w => w.week === weekNr) || seizoensplan?.kader?.[0];
  const doelTss = kaderWeek?.tss_doel || 0;

  // Session metrics
  const duurStr = sessie?.duur_min ? `${Math.floor(sessie.duur_min / 60)}u ${String(sessie.duur_min % 60).padStart(2, "0")}m` : null;
  const segDuur = (seg) => seg.duur_min || (seg.blokDuurSeconden ? seg.blokDuurSeconden / 60 : 0);
  const gemVermogen = sessie?.segmenten?.length > 0
    ? Math.round(sessie.segmenten.reduce((s, seg) => s + segMidPct(seg) * segDuur(seg), 0) / sessie.segmenten.reduce((s, seg) => s + segDuur(seg), 0) * ftp / 100)
    : null;
  const totaalMin = sessie?.segmenten?.reduce((s, seg) => s + segDuur(seg), 0) || sessie?.duur_min || 0;
  const tijdMarkers = totaalMin > 0 ? [0, 0.25, 0.5, 0.75, 1].map(p => { const min = Math.round(totaalMin * p); return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`; }) : [];
  const blockGroups = bouwBlockGroups(sessie?.segmenten, ftp);
  const sessieLabel = sessie ? (SESSIE_LABELS[sessie.type] || sessie.type) : "";

  const ritDuurStr = gematchteRit?.duur_min ? `${Math.floor(gematchteRit.duur_min / 60)}u ${String(gematchteRit.duur_min % 60).padStart(2, "0")}m` : null;
  const ritTijdMarkers = gematchteRit?.duur_min > 0 ? [0, 0.25, 0.5, 0.75, 1].map(p => { const min = Math.round(gematchteRit.duur_min * p); return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`; }) : [];

  // Reusable RPE component
  const renderRpe = () => {
    if (!gematchteRit) return null;
    const aanpasbaar = isRpeAanpasbaar(gematchteRit.start_date_local);
    // Primaire bron: icu_weighted_avg_watts (NP, server-side berekend door intervals.icu).
    // Fallback: zelf NP berekenen uit de ruwe streams als de aggregate-waarde nog niet
    // beschikbaar is (intervals.icu-verwerkingstiming bij verse ritten).
    const npVoorRpe = gematchteRit.wattage
      ?? (werkelijkWatts?.length >= 30 ? berekenNP(werkelijkWatts) : null);
    const verwachtRpeWerkelijk = (npVoorRpe && gematchteRit.duur_min)
      ? berekenVerwachtRpe(npVoorRpe / ftp, gematchteRit.duur_min)
      : null;
    // Geen fallback naar sessie.verwacht_rpe — dat vergelijkt tegen de GEPLANDE intensiteit,
    // niet de gereden. Liever geen delta tonen dan een misleidende delta.
    const verwachtRpeDisplay = verwachtRpeWerkelijk;

    const handleRpeSave = async (waarde) => {
      setRpeOpslaan(true);
      try {
        const resp = await fetch(`/api/intervals/workouts/${gematchteRit.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rpe: waarde }) });
        const data = await resp.json();
        if (data.success) {
          setRpeOpgeslagen(p => ({ ...p, [gematchteRit.id]: waarde }));
          onRpeSaved?.(gematchteRit.id, waarde);
          setRpeBewerken(false);
        }
      } catch (e) { console.error("RPE opslaan:", e); }
      setRpeOpslaan(false);
    };

    return (
      <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "18px 20px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
        {huidigeRpe != null && !rpeBewerken ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>RPE</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)" }}>Opgeslagen</span>
                {aanpasbaar && (
                  <button
                    onClick={() => { setRpeWaarde(huidigeRpe); setRpeBewerken(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, border: `1.5px solid ${T.cardBorder}`, background: T.cardBg, color: T.textSec, font: "700 11px var(--font-nunito), sans-serif", cursor: "pointer" }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Aanpassen
                  </button>
                )}
              </div>
            </div>
            <ScaleInput value={huidigeRpe} max={10} onChange={() => {}} leftLabel="Heel licht" rightLabel="Maximaal" />
          </>
        ) : huidigeRpe != null && rpeBewerken ? (
          <>
            <ScaleInput
              value={rpeWaarde}
              max={10}
              question="Pas je RPE aan"
              leftLabel="Heel licht"
              rightLabel="Maximaal"
              onChange={setRpeWaarde}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => setRpeBewerken(false)}
                style={{ flex: 1, padding: 14, borderRadius: T.pillRadius, border: `1.5px solid ${T.cardBorder}`, background: T.cardBg, color: T.textSec, font: "700 14px var(--font-nunito), sans-serif", cursor: "pointer" }}
              >
                Annuleren
              </button>
              <button
                disabled={rpeOpslaan}
                onClick={() => handleRpeSave(rpeWaarde)}
                style={{ flex: 1, border: "none", cursor: "pointer", padding: 14, borderRadius: T.pillRadius, background: T.slate, color: "oklch(0.97 0.01 84)", font: "700 14px var(--font-nunito), sans-serif", opacity: rpeOpslaan ? 0.6 : 1 }}
              >
                {rpeOpslaan ? "Opslaan..." : "RPE opslaan"}
              </button>
            </div>
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
            <button disabled={rpeOpslaan} onClick={() => handleRpeSave(rpeWaarde)} style={{ width: "100%", marginTop: 14, border: "none", cursor: "pointer", padding: 14, borderRadius: T.pillRadius, background: T.slate, color: "oklch(0.97 0.01 84)", font: "700 14px var(--font-nunito), sans-serif", opacity: rpeOpslaan ? 0.6 : 1 }}>
              {rpeOpslaan ? "Opslaan..." : "RPE opslaan"}
            </button>
          </>
        )}
        {huidigeRpe != null && !rpeBewerken && verwachtRpeDisplay != null && (() => {
          const delta = huidigeRpe - verwachtRpeDisplay;
          const tekst = delta <= -2 ? "Lichter dan verwacht — goed teken dat je herstel op orde is."
            : delta <= -0.5 ? "Iets lichter dan gepland — dat is prima."
            : delta <= 0.4 ? "Precies zoals verwacht."
            : delta <= 1.9 ? "Iets zwaarder dan gepland — normaal, maar houd het in de gaten."
            : "Duidelijk zwaarder dan verwacht — let op je herstel.";
          return (
            <div style={{ marginTop: 10, font: "600 12px/1.5 var(--font-nunito), sans-serif", color: delta > 1.5 ? "oklch(0.55 0.11 30)" : delta < -1 ? "oklch(0.5 0.11 165)" : T.textSec }}>
              {tekst} (verwacht: {Math.ceil(verwachtRpeDisplay)})
            </div>
          );
        })()}
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
    if (!werkelijkWatts || werkelijkWatts.length < 10) {
      if (!streamsLaden) return <div style={{ padding: "20px 0", font: "600 13px var(--font-nunito), sans-serif", color: T.textTert, textAlign: "center" }}>Geen vermogensdata beschikbaar voor deze rit</div>;
      return null;
    }
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

        <AdaptatieScoreKaart weekTss={werkelijkTss} doelTss={doelTss} fase={kaderWeek?.fase} weekNr={weekNr} weektype={kaderWeek?.weektype} onEditBeschikbaarheid={onEditBeschikbaarheid} />

        {/* ══ PLANNED ══ */}
        {mode === "planned" && sessie && (
          <div>
            {sessie.hrv_zone && ["rood", "geel"].includes(sessie.hrv_zone) && !sessie.hrv_keuze_gemaakt && dayOffset === 0 && (
              <HrvAdviesKaart
                zone={sessie.hrv_zone}
                keuzes={bepaalKeuzes(sessie.hrv_zone, sessie.hrv_zone === "rood" ? (["drempel_intervallen","sweetspot_intervallen","sweetspot_lang","vo2max_intervallen","vo2max_lang","vo2max_kort","microbursts","sprint_neuraal","kracht_lage_cadans","race_simulatie"].includes(sessie.intentie?.sessietype) ? "rood_intensiteit" : "rood_aeroob") : "geel_intensiteit")}
                onKeuze={async (keuze) => {
                  await fetch("/api/hrv/keuze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datum: cur.iso, keuze }) });
                  onPlanWijziging?.();
                }}
                rpeVoorspelling={null}
                isVerwerkt={false}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert, textTransform: "uppercase" }}>{sessieLabel.toUpperCase()}</span>
              {(() => {
                const dw = cur?.iso && weerForecast[cur.iso];
                if (!dw) return null;
                const c = dw.conditie || "";
                const icoon = dw.temp <= 5 ? "🥶" : dw.temp >= 28 ? "🔥" : /regen|buien|motregen/i.test(c) ? "🌧️" : /bewolkt/i.test(c) ? "☁️" : /mistig/i.test(c) ? "🌫️" : /onweer/i.test(c) ? "⛈️" : /sneeuw/i.test(c) ? "❄️" : /helder/i.test(c) ? "☀️" : "⛅";
                return <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>{icoon} {dw.temp}° · 💨 {dw.wind} km/u</span>;
              })()}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "5px 0 18px" }}>
              <h1 style={{ margin: 0, flex: 1, font: "800 28px/1.18 var(--font-nunito), sans-serif", letterSpacing: -0.5, textWrap: "pretty", color: T.text }}>{sessie.titel}</h1>
              {onAlternatiefSessie && !alternatiefLaden && (
                <button
                  onClick={() => setToontAlternatiefPopup(true)}
                  aria-label="Andere training vandaag"
                  style={{ flexShrink: 0, marginTop: 4, width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${T.cardBorder}`, background: T.cardBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4v5h5M20 20v-5h-5" stroke={T.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 005.64 5.64L4 9m16 6l-1.64 3.36A9 9 0 013.51 15" stroke={T.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              )}
              {alternatiefLaden && (
                <div style={{ flexShrink: 0, marginTop: 4, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 18, height: 18, border: `2px solid ${T.cardBorder}`, borderTopColor: T.textSec, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              {[
                { label: "Duur", value: duurStr || "—" },
                { label: "TSS", value: sessie.tss || "—", infoKey: "tss" },
                sessie.verwacht_rpe ? { label: "Verwacht gevoel", value: `${Math.max(1, Math.ceil(sessie.verwacht_rpe) - 1)}–${Math.min(10, Math.ceil(sessie.verwacht_rpe) + 1)}` } : { label: "Gem. vermogen", value: gemVermogen ? `${gemVermogen}` : "—", unit: "w", infoKey: "vermogen" },
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
                          <div style={{ display: "flex", marginTop: 0 }}>
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
                          {b.cadans && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                              <span style={{ font: "800 9.5px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: "rgba(255,255,255,0.74)" }}>CADANS</span>
                              <span style={{ font: "600 15px var(--font-fredoka), sans-serif", color: "oklch(0.85 0.08 200)", whiteSpace: "nowrap" }}>↓ {b.cadans}</span>
                            </div>
                          )}
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

            {/* Rest-waarschuwingskaart */}
            {sessie.rest_waarschuwing && (
              <div style={{ background: "oklch(0.96 0.05 82)", border: "1.5px solid oklch(0.85 0.08 78)", borderRadius: T.cardRadius, padding: "22px 22px 24px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 22, lineHeight: 1.2, flexShrink: 0 }}>&#x26A0;&#xFE0F;</span>
                  <div>
                    <div style={{ font: "800 15px var(--font-nunito), sans-serif", color: "oklch(0.35 0.06 60)", marginBottom: 6 }}>Je herstel is vandaag onvoldoende voor een training</div>
                    <p style={{ margin: 0, font: "600 13.5px/1.55 var(--font-nunito), sans-serif", color: "oklch(0.42 0.04 65)" }}>
                      Op basis van je slaap, HRV en hoe je je voelt is volledige rust vandaag waarschijnlijk beter dan zelfs een lichte training. We hebben de sessie vervangen door een korte herstelrit.
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const resp = await fetch("/api/checkin", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ datum: sessie.datum }),
                      });
                      if (resp.ok) {
                        onPlanWijziging?.();
                      }
                    } catch (e) { console.error("Advies opvolgen mislukt:", e); }
                  }}
                  style={{ width: "100%", padding: "14px 20px", borderRadius: T.pillRadius, border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 14.5px var(--font-nunito), sans-serif", cursor: "pointer", letterSpacing: 0.2 }}>
                  Advies opvolgen — dag overslaan
                </button>
              </div>
            )}

            {(sessie.waarom_vandaag || sessie.reden) && (
              <div style={{ background: SLATE.bg, borderRadius: T.cardRadius, padding: "22px 22px 24px", boxShadow: SLATE.shadow, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px var(--font-fredoka), sans-serif", color: "oklch(0.2 0.03 245)" }}>P</div>
                  <span style={{ font: "800 11.5px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: SLATE.label }}>{dayOffset === 0 ? "WAAROM VANDAAG" : `WAAROM ${bekekeDagNaam.toUpperCase()}`}</span>
                </div>
                <p style={{ margin: "0 0 16px", font: "600 15px/1.5 var(--font-nunito), sans-serif", color: SLATE.text, textWrap: "pretty" }}>{sessie.waarom_vandaag || sessie.reden}</p>
                {sessie.check_in_aangepast && sessie.check_in_modulatie && (
                  <p style={{ margin: "0 0 16px", font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.75 0.06 168)" }}>
                    We hebben je sessie {sessie.check_in_modulatie} gemaakt op basis van je hersteldata van vanochtend.
                  </p>
                )}
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

            {(sessie.intentie?.sessietype === "herstel_mobiliteit" || sessie.sessietype === "herstel_mobiliteit") && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "oklch(0.96 0.04 168)", border: "1px solid oklch(0.88 0.06 168)", borderRadius: T.cardRadius, padding: "18px 20px", marginBottom: 16 }}>
                <span style={{ fontSize: 24, lineHeight: 1.2, flexShrink: 0 }}>&#x1F9D8;</span>
                <div>
                  <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: "oklch(0.35 0.06 168)", marginBottom: 5 }}>Na je rit: mobiliteitswerk</div>
                  <p style={{ margin: 0, font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.04 168)" }}>
                    10–15 minuten stretching of schuimrollen helpt je herstel versnellen. Focus op heupen, hamstrings en kuiten.
                  </p>
                </div>
              </div>
            )}

            {sessie.intervalsEventId && !deviceTipWeg && (
              <div style={{ background: "oklch(0.955 0.03 220)", border: "1px solid oklch(0.85 0.06 220)", borderRadius: 18, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>&#x2139;&#xFE0F;</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.35 0.06 220)", marginBottom: 4 }}>Fietscomputer-koppeling</div>
                  <div style={{ font: "600 12px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.04 220)" }}>
                    Deze sessie staat in intervals.icu. Om hem op je fietscomputer te krijgen: koppel je toestel in intervals.icu-instellingen en vink "upload workouts" aan.
                  </div>
                </div>
                <button onClick={() => { setWahooTipWeg(true); localStorage.setItem("deviceTipGezien", "1"); }}
                  style={{ background: "none", border: "none", cursor: "pointer", font: "600 11px var(--font-nunito), sans-serif", color: "oklch(0.55 0.04 220)", padding: "2px 6px", flexShrink: 0 }}>Begrepen</button>
              </div>
            )}
          </div>
        )}

        {/* ══ UITGEVOERD (geplande rit voltooid) ══ */}
        {mode === "uitgevoerd" && (
          <div>
            {sessie && (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: gematchteRit?.naam ? 0 : 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert, textTransform: "uppercase" }}>{sessieLabel.toUpperCase()}</span>
                    <h1 style={{ margin: "5px 0 0", font: "800 28px/1.18 var(--font-nunito), sans-serif", letterSpacing: -0.5, textWrap: "pretty", color: T.text }}>{sessie.titel}</h1>
                  </div>
                  {sessie?.uitvoeringsScore?.score != null && (
                    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, paddingTop: 2 }}>
                      <span style={{ font: "800 22px var(--font-fredoka), sans-serif", lineHeight: 1, color: "oklch(0.38 0.01 250)" }}>{sessie.uitvoeringsScore.score}</span>
                      <span style={{ font: "600 11px var(--font-nunito), sans-serif", color: "oklch(0.5 0.01 250)", whiteSpace: "nowrap" }}>{sessie.uitvoeringsScore.label}</span>
                    </div>
                  )}
                </div>
                {gematchteRit?.naam && <p style={{ margin: "4px 0 18px", font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>{gematchteRit.naam}</p>}
              </>
            )}

            {hitteData[gematchteRit?.id]?.hitte_gecorrigeerd && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "oklch(0.96 0.05 82)", marginBottom: 12 }}>
                <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.48 0.1 62)" }}>🌡️ Hitte-rit · {hitteData[gematchteRit.id].apparent_temp_celsius ?? hitteData[gematchteRit.id].temperatuur_celsius}°C{hitteData[gematchteRit.id].temp_baseline ? ` (+${Math.round(hitteData[gematchteRit.id].apparent_temp_celsius - hitteData[gematchteRit.id].temp_baseline)}°C)` : ""}</span>
                <InfoTooltip metricKey="hitte" />
              </div>
            )}

            {renderRitMetrics(!!sessie)}

            {renderWerkelijkGrafiek()}

            {/* Dimensies uitklapper */}
            {sessie?.uitvoeringsScore?.dimensies && (
              <DimensiesUitklapper dimensies={sessie.uitvoeringsScore.dimensies} />
            )}

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

      {toontAlternatiefPopup && (
        <AlternatiefSessiePopup
          hrvZone={sessie?.hrv_zone}
          onBevestig={async ({ reden }) => {
            setToontAlternatiefPopup(false);
            setAlternatiefLaden(true);
            try {
              await onAlternatiefSessie(cur.iso, reden);
            } finally {
              setAlternatiefLaden(false);
            }
          }}
          onAnnuleer={() => setToontAlternatiefPopup(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
