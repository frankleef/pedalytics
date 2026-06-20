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

const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const FILTERS = ["Vandaag", "Deze week", "Herstel", "Belasting"];

export default function HomeTab({ profiel, wellenessHuidig, vandaagInvoer, dagelijkseData, voortgang, seizoensplan, weekSessies, weekSessiesLaden, beschikbaar, onOpenWorkout, onEditBeschikbaarheid, onOpenProfiel }) {
  const [filter, setFilter] = useState(0);
  const [checkin, setCheckin] = useState(null);
  const [checkinLaden, setCheckinLaden] = useState(true);

  useEffect(() => {
    fetch("/api/checkin").then(r => r.json()).then(d => {
      if (d.success && d.data) setCheckin(d.data.score);
    }).catch(() => {}).finally(() => setCheckinLaden(false));
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
  const vandaagISO = nu.toISOString().split("T")[0];
  const dagVolgorde = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
  const vandaagDagIdx = nu.getDay() === 0 ? 6 : nu.getDay() - 1;

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

        {/* Status headline */}
        <h1 style={{ margin: "0 0 20px", font: "800 27px/1.22 var(--font-nunito), sans-serif", letterSpacing: -0.4, textWrap: "pretty", color: st.color }}>
          {st.headline("Frank")}
        </h1>

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

        {/* Today's session */}
        {weekSessiesLaden ? (
          <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "28px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>⏳</div>
            <div style={{ font: "600 14px var(--font-nunito), sans-serif", color: T.textSec }}>Sessies worden gegenereerd...</div>
          </div>
        ) : (
          <SessionCard sessie={eerstvolgende} ftp={profiel?.ftp} onOpen={onOpenWorkout} />
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
