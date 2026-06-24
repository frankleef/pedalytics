"use client";
import { useState, useEffect } from "react";
import { T, STATUS, getStatus } from "../designTokens";
import { berekenHerstelScore } from "./HerstelStatus";
import { berekenDagAdvies } from "./DagAdvies";
import InfoTooltip from "./InfoTooltip";
import ScaleInput from "./ScaleInput";
import SessionCard from "./home/SessionCard";
import InsightCard from "./home/InsightCard";
import SharedHeader from "./SharedHeader";
import { vandaagISO as getVandaag, datumISO, datumOffset } from "@/lib/datum";
import SessieUitkomstKaart from "./SessieUitkomstKaart";
import SeizoenSamenvattingKaart from "./SeizoenSamenvattingKaart";
import GereedheidConditieKaart from "./GereedheidConditieKaart";
import { classificeerRit, ritMatchesSessie } from "@/lib/rittype";

const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];

export default function HomeTab({ profiel, wellenessHuidig, vandaagInvoer, dagelijkseData, voortgang, seizoensplan, weekSessies, weekSessiesLaden, beschikbaar, onOpenWorkout, onEditBeschikbaarheid, onOpenProfiel }) {
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
  const [prTeaser, setPrTeaser] = useState(null);
  useEffect(() => {
    fetch("/api/intervals/power-curves?periode=42d&vorige=84d").then(r => r.json()).then(d => {
      if (!d.success) return;
      const DUREN = [{ sec: 5, label: "5s sprint" }, { sec: 60, label: "1 min" }, { sec: 300, label: "5 min" }, { sec: 1200, label: "20 min" }];
      let beste = null;
      DUREN.forEach(dur => {
        const nu = (d.huidig || []).find(p => p.sec === dur.sec)?.watt || 0;
        const was = (d.vorig || []).find(p => p.sec === dur.sec)?.watt || 0;
        if (nu > 0 && was > 0) {
          const delta = nu - was;
          if (delta > 0 && (!beste || delta > beste.delta)) beste = { ...dur, watt: nu, delta };
        }
      });
      setPrTeaser(beste);
    }).catch(() => {});
  }, []);

  const eerstvolgende = (() => {
    const sessies = weekSessies?.sessies?.filter(s => s.type !== "rust") || [];
    const metDatum = sessies.filter(s => s.datum && s.datum >= vandaagISO);
    if (metDatum.length > 0) return metDatum.sort((a, b) => a.datum.localeCompare(b.datum))[0];
    return sessies
      .map(s => ({ ...s, dagIdx: dagVolgorde.indexOf(s.dag) }))
      .filter(s => s.dagIdx >= vandaagDagIdx)
      .sort((a, b) => a.dagIdx - b.dagIdx)[0] || null;
  })();

  // Sync health-check: toon banner alleen als:
  // - geen wellness-data in 3+ dagen EN er een geplande sessie gemist is (geen rustweek)
  // - NIET als het gewoon een rustweek is zonder geplande sessies
  const [syncBannerWeg, setSyncBannerWeg] = useState(false);
  const syncGap = (() => {
    const data = dagelijkseData || [];
    if (data.length === 0) return false;
    const laatste = data[data.length - 1];
    const laatsteDatum = laatste?.datum?.replace("/", "-") || laatste?.id?.split("T")[0];
    if (!laatsteDatum) return false;
    const diff = (Date.now() - new Date(laatsteDatum.length === 5 ? `2026-${laatsteDatum}` : laatsteDatum).getTime()) / 86400000;
    if (diff <= 3) return false;
    // Check of er geplande sessies waren in de gap-periode (niet alleen een rustweek)
    const sessies = weekSessies?.sessies || [];
    const heeftGeplandInGap = sessies.some(s => s.datum && !s.voltooid && new Date(s.datum) < new Date());
    return heeftGeplandInGap;
  })();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px` }}>

        <SharedHeader onAvatarClick={onOpenProfiel} />

        {/* Sync health banner */}
        {syncGap && !syncBannerWeg && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "14px 16px", borderRadius: 18, background: "oklch(0.97 0.022 78)", border: "1px solid oklch(0.9 0.05 75)", marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 4l9 16H3z" fill="oklch(0.92 0.05 75)" stroke="oklch(0.72 0.13 70)" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="oklch(0.55 0.11 65)" strokeWidth="2" strokeLinecap="round"/></svg>
            <div style={{ flex: 1 }}>
              <div style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.48 0.1 62)", marginBottom: 3 }}>Geen nieuwe data in 3+ dagen</div>
              <div style={{ font: "600 12px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>
                Controleer je Garmin/WHOOP-koppeling in intervals.icu.{" "}
                <a href="https://intervals.icu/settings" target="_blank" rel="noopener" style={{ color: "oklch(0.55 0.13 200)", fontWeight: 800, textDecoration: "none" }}>Instellingen →</a>
              </div>
            </div>
            <button onClick={() => setSyncBannerWeg(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="oklch(0.55 0.05 70)" strokeWidth="2.2" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}

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

        {/* Seizoen afgerond */}
        {seizoensplan?.seizoen_afgerond && (
          <SeizoenSamenvattingKaart plan={seizoensplan} profiel={profiel} onNieuwSeizoeen={() => { window.location.href = "/nieuw-seizoen"; }} />
        )}

        {/* Today's session — primaire positie, direct onder headline */}
        {!seizoensplan?.seizoen_afgerond && weekSessiesLaden ? (
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
            if (sessieVandaag && ritVandaag) mode = ritMatchesSessie(cls, sessieVandaag.type, ritVandaag, sessieVandaag) ? "matched" : "deviated";
            else if (!sessieVandaag && ritVandaag) mode = "unplanned";
            return (
              <SessieUitkomstKaart
                mode={mode} rit={ritVandaag} sessie={sessieVandaag} ritCls={cls} compact
                onTap={() => onOpenWorkout?.({ datum: vandaagISO })}
              />
            );
          }
          if (eerstvolgende) {
            return (
              <>
                <SessionCard sessie={eerstvolgende} ftp={ftp} onOpen={onOpenWorkout} beschikbaar={beschikbaar} weer={weer} />
                {eerstvolgende?.intervalsEventId && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -10, marginBottom: 16, padding: "0 4px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="oklch(0.5 0.13 162)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: "oklch(0.5 0.13 162)" }}>Gesynchroniseerd naar je fietscomputer</span>
                  </div>
                )}
              </>
            );
          }
          return (
            <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "22px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
              <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Vandaag · rust</span>
              <h2 style={{ margin: "6px 0 8px", font: "700 20px var(--font-nunito), sans-serif", color: T.text }}>Rustdag — herstel is training.</h2>
              <p style={{ margin: 0, font: "600 13px/1.5 var(--font-nunito), sans-serif", color: T.textSec }}>Je lichaam past zich aan tijdens rust, niet tijdens de inspanning zelf. Vandaag geen training is de juiste keuze.</p>
            </div>
          );
        })()}



        {/* Ochtend check-in */}
        {!checkinLaden && !checkin && (
          <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 22px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
            <ScaleInput value={0} max={5} question="Hoe voel je je vandaag?" leftLabel="Slecht" rightLabel="Top"
              onChange={(val) => { setCheckin(val); fetch("/api/checkin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: val }) }); }} />
          </div>
        )}

        {/* Gereedheid & Conditie */}
        <GereedheidConditieKaart
          balansScore={score}
          ctl={wellenessHuidig ? Math.round(wellenessHuidig.ctl || 0) : null}
          atl={wellenessHuidig ? Math.round(wellenessHuidig.atl || 0) : null}
          tsb={tsb}
        />

        {/* Sync health banner — onderaan, laagste prioriteit */}
        {syncGap && !syncBannerWeg && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "14px 16px", borderRadius: 18, background: "oklch(0.97 0.022 78)", border: "1px solid oklch(0.9 0.05 75)", marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 4l9 16H3z" fill="oklch(0.92 0.05 75)" stroke="oklch(0.72 0.13 70)" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="oklch(0.55 0.11 65)" strokeWidth="2" strokeLinecap="round"/></svg>
            <div style={{ flex: 1 }}>
              <div style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.48 0.1 62)", marginBottom: 3 }}>Geen nieuwe data in 3+ dagen</div>
              <div style={{ font: "600 12px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>
                Controleer je Garmin/WHOOP-koppeling in intervals.icu.{" "}
                <a href="https://intervals.icu/settings" target="_blank" rel="noopener" style={{ color: "oklch(0.55 0.13 200)", fontWeight: 800, textDecoration: "none" }}>Instellingen →</a>
              </div>
            </div>
            <button onClick={() => setSyncBannerWeg(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="oklch(0.55 0.05 70)" strokeWidth="2.2" strokeLinecap="round"/></svg>
            </button>
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
