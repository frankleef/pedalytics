"use client";
import { useState, useEffect } from "react";
import { T, STATUS, getStatus } from "../designTokens";
import { berekenHerstelScore } from "./HerstelStatus";
import { berekenDagAdvies } from "./DagAdvies";
import InfoTooltip from "./InfoTooltip";
import ScaleInput from "./ScaleInput";
import BalanceRing from "./home/BalanceRing";
import WeekStrip from "./home/WeekStrip";
import SessionCard from "./home/SessionCard";
import InsightCard from "./home/InsightCard";
import SharedHeader from "./SharedHeader";
import { vandaagISO as getVandaag, datumISO, datumOffset } from "@/lib/datum";
import SessieUitkomstKaart from "./SessieUitkomstKaart";
import { classificeerRit, ritMatchesSessie } from "@/lib/rittype";

const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const FILTERS = ["Vandaag", "Deze week", "Herstel", "Belasting"];

export default function HomeTab({ profiel, wellenessHuidig, vandaagInvoer, dagelijkseData, voortgang, seizoensplan, weekSessies, weekSessiesLaden, beschikbaar, onOpenWorkout, onEditBeschikbaarheid, onOpenProfiel }) {
  const [filter, setFilter] = useState(0);
  const [checkin, setCheckin] = useState(null);
  const [checkinLaden, setCheckinLaden] = useState(true);
  const [weer, setWeer] = useState(null);

  useEffect(() => {
    fetch("/api/checkin").then(r => r.json()).then(d => {
      if (d.success && d.data) setCheckin(d.data.score);
    }).catch(() => {}).finally(() => setCheckinLaden(false));
    fetch("/api/weer").then(r => r.json()).then(d => {
      if (d.success) setWeer(d.data);
    }).catch(() => {});
  }, []);
  const hrvBasislijn = profiel?.hrv_basislijn || 58;
  const hrBasislijn = profiel?.hr_basislijn || 49;
  const tsb = wellenessHuidig ? Math.round((wellenessHuidig.ctl || 0) - (wellenessHuidig.atl || 0)) : null;

  const { score } = berekenHerstelScore({
    hrv: vandaagInvoer?.hrv, hrvBasislijn,
    rusthartslag: vandaagInvoer?.rusthartslag, rusthartslagBasislijn: hrBasislijn,
    tsb, slaapScore: vandaagInvoer?.slaapScore, checkin,
  });
  const statusKey = getStatus(score);
  const st = STATUS[statusKey];

  const nu = new Date();
  const vandaagISO = getVandaag();
  const dagVolgorde = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
  const vandaagDagIdx = nu.getDay() === 0 ? 6 : nu.getDay() - 1;

  const FASE_NAMEN = { basis: "Opbouw", sweetspot: "Sweetspot", drempel: "Drempel", consolidatie: "Consolidatie", test: "Testweek", herstel: "Herstel" };
  const seizoenStart = seizoensplan?.startdatum ? new Date(seizoensplan.startdatum) : null;
  const weekNr = seizoenStart ? Math.max(1, Math.ceil((Date.now() - seizoenStart.getTime()) / (7 * 86400000)) || 1) : null;
  const totaalWeken = seizoensplan?.tijdshorizon_weken || seizoensplan?.kader?.length || null;
  const huidigeFase = weekNr && seizoensplan?.kader ? seizoensplan.kader.find(w => w.week === weekNr) || seizoensplan.kader[seizoensplan.kader.length - 1] : null;
  const faseLabel = huidigeFase ? `${FASE_NAMEN[huidigeFase.fase] || huidigeFase.fase} · Week ${weekNr} van ${totaalWeken}` : null;

  const morgenISO = datumOffset(1);
  const sessieMorgen = (weekSessies?.sessies || []).find(s => s.datum === morgenISO && s.type !== "rust");

  // Streak: weken op rij met minstens 1 rit
  const streakWeeks = (() => {
    const ritten = voortgang?.ritten || [];
    if (ritten.length === 0) return 0;
    let streak = 0;
    const huidigeWeekMa = new Date(nu); huidigeWeekMa.setDate(nu.getDate() - ((nu.getDay() + 6) % 7)); huidigeWeekMa.setHours(0,0,0,0);
    for (let w = 0; w < 52; w++) {
      const weekStart = new Date(huidigeWeekMa); weekStart.setDate(huidigeWeekMa.getDate() - w * 7);
      const weekEind = new Date(weekStart); weekEind.setDate(weekStart.getDate() + 7);
      const heeftRit = ritten.some(r => r.datum_iso && r.datum_iso >= datumISO(weekStart) && r.datum_iso < datumISO(weekEind));
      if (heeftRit) streak++;
      else break;
    }
    return streak;
  })();

  // PR-teaser: beste recente PR uit power curve vergelijking
  const prTeaser = (() => {
    const DUREN = [{ sec: 5, label: "5s sprint" }, { sec: 60, label: "1 min" }, { sec: 300, label: "5 min" }, { sec: 1200, label: "20 min" }];
    const ritten = voortgang?.ritten || [];
    const grens14 = new Date(Date.now() - 14 * 86400000);
    const recent = ritten.filter(r => r.datum_iso && new Date(r.datum_iso) >= grens14);
    const ouder = ritten.filter(r => r.datum_iso && new Date(r.datum_iso) < grens14);
    if (recent.length === 0 || ouder.length === 0) return null;
    const best = (rs) => { const b = {}; rs.forEach(r => { if (!r.max_watt && !r.wattage) return; DUREN.forEach(d => { const v = d.sec <= 15 ? (r.max_watt || r.wattage) : r.wattage; if (v && r.duur_min * 60 >= d.sec && v > (b[d.sec] || 0)) b[d.sec] = v; }); }); return b; };
    const nu2 = best(recent); const was = best(ouder);
    let beste = null;
    DUREN.forEach(d => { const delta = (nu2[d.sec] || 0) - (was[d.sec] || 0); if (delta > 0 && (!beste || delta > beste.delta)) beste = { ...d, watt: nu2[d.sec], delta }; });
    return beste;
  })();

  const eerstvolgende = (() => {
    const sessies = weekSessies?.sessies?.filter(s => s.type !== "rust") || [];
    const metDatum = sessies.filter(s => s.datum && s.datum >= vandaagISO);
    if (metDatum.length > 0) return metDatum.sort((a, b) => a.datum.localeCompare(b.datum))[0];
    return sessies
      .map(s => ({ ...s, dagIdx: dagVolgorde.indexOf(s.dag) }))
      .filter(s => s.dagIdx >= vandaagDagIdx)
      .sort((a, b) => a.dagIdx - b.dagIdx)[0] || null;
  })();
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px` }}>

        <SharedHeader onAvatarClick={onOpenProfiel} />

        {/* Fase/week eyebrow */}
        {faseLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.gradient }} />
            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>{faseLabel}</span>
          </div>
        )}

        {/* Status headline */}
        {(() => {
          const ritVandaag = (voortgang?.ritten || []).find(r => r.datum_iso === vandaagISO);
          const headlineFn = ritVandaag && st.headlineNaRit ? st.headlineNaRit : st.headline;
          return (
            <h1 style={{ margin: "0 0 20px", font: "800 27px/1.22 var(--font-nunito), sans-serif", letterSpacing: -0.4, textWrap: "pretty", color: st.color }}>
              {headlineFn("Frank")}
            </h1>
          );
        })()}

        {/* Streak badge */}
        {streakWeeks >= 2 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", padding: "8px 14px 8px 11px", borderRadius: 999, background: "linear-gradient(135deg, oklch(0.95 0.035 70), oklch(0.93 0.045 45))", border: "1px solid oklch(0.88 0.05 60)", marginBottom: 16 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2c1.5 3.5-1 5-2 7-1.2 2.4.3 4 2 4 1.8 0 3-1.4 2.4-3.4C17 12 18 14.5 18 16.5 18 20 15.3 22 12 22S6 20 6 16.5C6 12 9.5 9 12 2z" fill="oklch(0.66 0.16 45)"/><path d="M12 22c-1.8 0-3-1.3-3-3 0-1.7 1.3-2.6 2-3.8.7 1.2 1.2 1.6 1.6 2.6.5 1.3-.2 2.2 1.4 2.2-.5 1.2-1.2 2-2 2z" fill="oklch(0.82 0.13 75)"/></svg>
            <span style={{ font: "800 13px var(--font-nunito), sans-serif", color: "oklch(0.45 0.1 45)" }}>{streakWeeks} weken op rij getraind</span>
          </div>
        )}

        {/* Weer-widget */}
        {weer && (
          <div style={{ background: T.cardBg, borderRadius: 20, padding: "14px 18px", boxShadow: "0 1px 8px rgba(60,45,20,0.03)", border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ font: "600 28px var(--font-fredoka), sans-serif", color: T.text }}>{weer.temp}°</span>
                <div>
                  <div style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.text }}>{weer.conditie}</div>
                  <div style={{ font: "600 11px var(--font-nunito), sans-serif", color: T.textSec }}>
                    💧 {weer.neerslagKans}% · 💨 {weer.wind} km/u
                  </div>
                </div>
              </div>
            </div>
            {weer.neerslagMiddag > 50 && eerstvolgende && !((voortgang?.ritten || []).find(r => r.datum_iso === vandaagISO)) && (
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 12, background: "oklch(0.96 0.04 82)", font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.48 0.11 66)" }}>
                ☔ Regen verwacht vanmiddag — plan je buitenrit liever voor de ochtend
              </div>
            )}
          </div>
        )}

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 9, overflowX: "auto", margin: `0 -${T.pad}px 22px`, padding: `2px ${T.pad}px 6px` }}>
          {FILTERS.map((label, i) => (
            <div key={label} onClick={() => setFilter(i)} style={{
              flex: "none", padding: "9px 17px", borderRadius: T.pillRadius, cursor: "pointer",
              font: "700 13.5px var(--font-nunito), sans-serif",
              ...(i === filter
                ? { background: T.slate, color: "oklch(0.97 0.01 84)" }
                : { background: "transparent", border: "1.5px solid oklch(0.86 0.014 80)", color: "oklch(0.42 0.02 72)" }),
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Balance card — wisselt per filter */}
        {filter === 0 && (
          <BalanceRing
            vandaagInvoer={vandaagInvoer}
            tsb={tsb}
            slaapScore={vandaagInvoer?.slaapScore}
            wellenessHuidig={wellenessHuidig}
            hrvBasislijn={hrvBasislijn}
            hrBasislijn={hrBasislijn}
            checkin={checkin}
          />
        )}

        {filter === 1 && (() => {
          const week = (dagelijkseData || []).slice(-7);
          const weekTsbArr = week.filter(d => d.tsb != null);
          const weekTsb = weekTsbArr.length > 0 ? Math.round(weekTsbArr.reduce((s, d) => s + d.tsb, 0) / weekTsbArr.length) : null;
          const weekCtl = week.filter(d => d.ctl != null);
          const gemCtl = weekCtl.length > 0 ? Math.round(weekCtl.reduce((s, d) => s + d.ctl, 0) / weekCtl.length) : null;
          const weekAtl = week.filter(d => d.atl != null);
          const gemAtl = weekAtl.length > 0 ? Math.round(weekAtl.reduce((s, d) => s + d.atl, 0) / weekAtl.length) : null;
          const weekHrv = week.filter(d => d.hrv);
          const gemHrv = weekHrv.length > 0 ? Math.round(weekHrv.reduce((s, d) => s + d.hrv, 0) / weekHrv.length) : null;
          const weekHr = week.filter(d => d.rusthartslag);
          const gemHr = weekHr.length > 0 ? Math.round(weekHr.reduce((s, d) => s + d.rusthartslag, 0) / weekHr.length) : null;
          const weekSlaap = week.filter(d => d.slaapScore);
          const gemSlaap = weekSlaap.length > 0 ? Math.round(weekSlaap.reduce((s, d) => s + d.slaapScore, 0) / weekSlaap.length) : null;

          const { score: weekScore } = berekenHerstelScore({ hrv: gemHrv, hrvBasislijn, rusthartslag: gemHr, rusthartslagBasislijn: hrBasislijn, tsb: weekTsb, slaapScore: gemSlaap });
          const weekStatusKey = getStatus(weekScore);
          const weekSt = STATUS[weekStatusKey];

          return (
            <BalanceRing
              vandaagInvoer={{ hrv: gemHrv, rusthartslag: gemHr, slaapScore: gemSlaap }}
              tsb={weekTsb}
              slaapScore={gemSlaap}
              wellenessHuidig={gemCtl != null ? { ctl: gemCtl, atl: gemAtl } : wellenessHuidig}
              hrvBasislijn={hrvBasislijn}
              hrBasislijn={hrBasislijn}
              label="Weekgemiddelde"
            />
          );
        })()}

        {filter === 2 && (() => {
          const hrv = vandaagInvoer?.hrv;
          const hr = vandaagInvoer?.rusthartslag;
          const slaap = vandaagInvoer?.slaapScore;
          const slaapUren = vandaagInvoer?.slaapUren;
          const hrvDelta = hrv ? hrv - hrvBasislijn : null;
          const hrDelta = hr ? hr - hrBasislijn : null;

          return (
            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "22px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
              <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Hersteldata</span>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                {[
                  { label: "HRV", value: hrv ?? "—", unit: hrv ? "ms" : "", sub: `basislijn ${hrvBasislijn}`, delta: hrvDelta, good: hrvDelta != null && hrvDelta >= 0 },
                  { label: "Rusthartslag", value: hr ?? "—", unit: hr ? "bpm" : "", sub: `basislijn ${hrBasislijn}`, delta: hrDelta, good: hrDelta != null && hrDelta <= 0 },
                  { label: "Slaap", value: slaap ?? "—", unit: slaap ? "" : "", sub: slaapUren ? `${slaapUren}u` : "", delta: null, good: null },
                ].map((m, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "14px 10px", borderRadius: T.tileRadius, background: T.subtleFill, alignItems: "center" }}>
                    <span style={{ font: "600 28px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{m.value}<span style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.textSec }}>{m.unit}</span></span>
                    <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{m.label}</span>
                    {m.delta != null && (
                      <span style={{ font: "700 11px var(--font-nunito), sans-serif", color: m.good ? "oklch(0.5 0.13 162)" : "oklch(0.56 0.13 55)" }}>
                        {m.delta > 0 ? "+" : ""}{Math.round(m.delta)}
                      </span>
                    )}
                    {m.sub && <span style={{ font: "600 10px var(--font-nunito), sans-serif", color: T.textTert }}>{m.sub}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {filter === 3 && (() => {
          const ctl = wellenessHuidig ? Math.round(wellenessHuidig.ctl || 0) : null;
          const atl = wellenessHuidig ? Math.round(wellenessHuidig.atl || 0) : null;
          const tsbVal = ctl != null && atl != null ? ctl - atl : null;
          const stKey = getStatus(score);
          const stObj = STATUS[stKey];

          return (
            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "22px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
              <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Trainingsbelasting</span>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                {[
                  { label: "Fitheid", sub: "CTL", value: ctl ?? "—", desc: "Langetermijn belasting", color: T.text, key: "ctl" },
                  { label: "Vermoeidheid", sub: "ATL", value: atl ?? "—", desc: "Kortetermijn belasting", color: T.text, key: "atl" },
                  { label: "Vorm", sub: "TSB", value: tsbVal != null ? (tsbVal > 0 ? `+${tsbVal}` : tsbVal) : "—", desc: tsbVal != null ? (tsbVal > 5 ? "Uitgerust" : tsbVal >= -10 ? "In balans" : tsbVal >= -20 ? "Vermoeid" : "Overbelast") : "", color: stObj?.dot || T.text, key: "vorm" },
                ].map((m, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "14px 10px", borderRadius: T.tileRadius, background: T.subtleFill, alignItems: "center" }}>
                    <span style={{ font: "600 28px var(--font-fredoka), sans-serif", lineHeight: 1, color: m.color }}>{m.value}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)" }}>{m.label}</span>
                      <InfoTooltip metricKey={m.key} />
                    </div>
                    <span style={{ font: "700 10px var(--font-nunito), sans-serif", letterSpacing: 0.5, color: T.textTert }}>{m.sub}</span>
                    {m.desc && <span style={{ font: "600 10px var(--font-nunito), sans-serif", color: T.textTert }}>{m.desc}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Ochtend check-in */}
        {!checkinLaden && !checkin && (
          <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
            <ScaleInput
              value={0}
              max={5}
              question="Hoe voel je je vandaag?"
              leftLabel="Slecht"
              rightLabel="Top"
              onChange={(val) => {
                setCheckin(val);
                fetch("/api/checkin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: val }) });
              }}
            />
          </div>
        )}

        {/* Week strip */}
        <WeekStrip beschikbaar={beschikbaar} weekSessies={weekSessies} weekSessiesLaden={weekSessiesLaden} onEdit={onEditBeschikbaarheid} />

        {/* PR teaser */}
        {prTeaser && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 22, padding: "13px 16px", background: T.cardBg, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 12, background: "oklch(0.95 0.035 80)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="oklch(0.72 0.12 68)"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ font: "800 10.5px var(--font-nunito), sans-serif", letterSpacing: 0.8, color: T.textTert }}>NIEUW RECORD</span>
              <span style={{ font: "700 14px var(--font-nunito), sans-serif", color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prTeaser.label}</span>
            </div>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ font: "600 21px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{prTeaser.watt}<span style={{ font: "700 11px var(--font-nunito), sans-serif", color: T.textSec, marginLeft: 1 }}>W</span></span>
              <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 9px", borderRadius: 999, background: "oklch(0.93 0.045 168)" }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="oklch(0.46 0.12 165)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ font: "800 11px var(--font-nunito), sans-serif", color: "oklch(0.46 0.12 165)" }}>+{prTeaser.delta}W</span>
              </div>
            </div>
          </div>
        )}

        {/* Today's session — voltooide rit of vooruitblik */}
        {weekSessiesLaden ? (
          <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "28px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>⏳</div>
            <div style={{ font: "600 14px var(--font-nunito), sans-serif", color: T.textSec }}>Sessies worden gegenereerd...</div>
          </div>
        ) : (() => {
          const ftp = profiel?.ftp || 265;
          const ritVandaag = (voortgang?.ritten || []).find(r => r.datum_iso === vandaagISO);
          const sessieVandaag = (weekSessies?.sessies || []).find(s => s.datum === vandaagISO);
          if (ritVandaag) {
            const cls = classificeerRit(ritVandaag, ftp);
            let mode = "unplanned";
            if (sessieVandaag && ritVandaag) mode = ritMatchesSessie(cls, sessieVandaag.type) ? "matched" : "deviated";
            else if (!sessieVandaag && ritVandaag) mode = "unplanned";
            return (
              <SessieUitkomstKaart
                mode={mode} rit={ritVandaag} sessie={sessieVandaag} ritCls={cls} compact
                onTap={() => onOpenWorkout?.({ datum: vandaagISO })}
              />
            );
          }
          return (
            <>
              <SessionCard sessie={eerstvolgende} ftp={ftp} onOpen={onOpenWorkout} />
              {eerstvolgende?.intervalsEventId && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -10, marginBottom: 16, padding: "0 4px" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="oklch(0.5 0.13 162)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)" }}>Gesynchroniseerd naar Wahoo</span>
                </div>
              )}
            </>
          );
        })()}

        {/* Morgen-teaser */}
        {sessieMorgen && !(voortgang?.ritten || []).find(r => r.datum_iso === vandaagISO) && (
          <div onClick={() => onOpenWorkout?.({ datum: morgenISO })}
            style={{ background: T.cardBg, borderRadius: 20, padding: "14px 16px", boxShadow: "0 1px 8px rgba(60,45,20,0.03)", border: `1px solid ${T.cardBorder}`, marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 12, background: T.subtleFill, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke={T.textSec} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13px var(--font-nunito), sans-serif", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Morgen: {sessieMorgen.titel}
              </div>
              <div style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>
                {sessieMorgen.duur_min ? `${Math.round(sessieMorgen.duur_min)}min` : ""}{sessieMorgen.vermogen ? ` · ${sessieMorgen.vermogen}` : ""}
              </div>
            </div>
          </div>
        )}

        {/* AI Insight */}
        <InsightCard
          vandaagInvoer={vandaagInvoer}
          dagelijkseData={dagelijkseData}
          hrvBasislijn={hrvBasislijn}
          hrBasislijn={hrBasislijn}
        />
      </div>
    </div>
  );
}
