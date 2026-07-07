"use client";
import { useState, useEffect } from "react";
import { T, STATUS, getStatus } from "../designTokens";
import { berekenHerstelScore } from "./HerstelStatus";
import { berekenDagAdvies } from "./DagAdvies";
import InfoTooltip from "./InfoTooltip";
import CheckinModal from "./CheckinModal";
import InsightCard from "./home/InsightCard";
import SharedHeader from "./SharedHeader";
import WorkoutViz from "./WorkoutViz";
import { vandaagISO as getVandaag, datumISO, datumOffset } from "@/lib/datum";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import SessieUitkomstKaart from "./SessieUitkomstKaart";
import SeizoenSamenvattingKaart from "./SeizoenSamenvattingKaart";
import GereedheidConditieKaart from "./GereedheidConditieKaart";
import { classificeerRit } from "@/lib/rittype";

const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];

export default function HomeTab({ profiel, wellenessHuidig, vandaagInvoer, dagelijkseData, voortgang, seizoensplan, weekSessies, weekSessiesLaden, beschikbaar, weerData, initialCheckin, onCheckinWijziging, onOpenWorkout, onEditBeschikbaarheid, onOpenProfiel, onOpenMeldingen, heeftOngelezenMeldingen }) {
  const [checkin, setCheckin] = useState(initialCheckin !== undefined ? initialCheckin : null);
  const [checkinLaden, setCheckinLaden] = useState(initialCheckin === undefined);
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [checkinWaarde, setCheckinWaarde] = useState(0);
  const weer = weerData ?? null;

  const bevestigCheckin = (val) => {
    setCheckin(val);
    onCheckinWijziging?.(val);
    fetch("/api/checkin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: val }) });
    setCheckinModalOpen(false);
  };

  useEffect(() => {
    if (initialCheckin !== undefined && checkinLaden) {
      setCheckin(initialCheckin);
      setCheckinLaden(false);
    }
  }, [initialCheckin]);
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
  const weekNr = seizoenStart && seizoensplan?.startdatum ? weeknummerVoorDatum(new Date(), seizoensplan.startdatum) : null;
  const totaalWeken = seizoensplan?.tijdshorizon_weken || seizoensplan?.kader?.length || null;
  const huidigeFase = weekNr && seizoensplan?.kader ? seizoensplan.kader.find(w => w.week === weekNr) || seizoensplan.kader[seizoensplan.kader.length - 1] : null;
  const faseNaam = huidigeFase?.weektype === "herstel" ? "Herstel" : (FASE_NAMEN[huidigeFase?.fase] || huidigeFase?.fase);
  const faseLabel = huidigeFase ? `${faseNaam} · Week ${weekNr} van ${totaalWeken}` : null;

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
  const ritVandaag = (voortgang?.ritten || []).find(r => r.datum_iso === vandaagISO);
  const readinessParagraaf = (() => {
    const headlineFn = ritVandaag && st.headlineNaRit ? st.headlineNaRit : st.headline;
    const hitteCtx = weer?.hitte ? { hitte: true, temp: weer.apparentTemp ?? weer.temp } : null;
    return headlineFn("Frank", hitteCtx);
  })();

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

        <SharedHeader onAvatarClick={onOpenProfiel} onMeldingenClick={onOpenMeldingen} heeftOngelezenMeldingen={heeftOngelezenMeldingen} />

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

        {/* Fase-progressie */}
        {faseLabel && weekNr && totaalWeken && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>{faseLabel}</span>
              <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textTert }}>{Math.round((weekNr / totaalWeken) * 100)}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: T.divider, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.round((weekNr / totaalWeken) * 100))}%`, height: "100%", borderRadius: 999, background: T.slate }} />
            </div>
          </div>
        )}


        {/* Seizoen afgerond */}
        {seizoensplan?.seizoen_afgerond && (
          <SeizoenSamenvattingKaart plan={seizoensplan} profiel={profiel} onNieuwSeizoeen={() => { window.location.href = "/nieuw-seizoen"; }} />
        )}

        {/* Sessie-preview — compact, linkt naar Sessie-tab */}
        {!seizoensplan?.seizoen_afgerond && weekSessiesLaden ? (
          <div style={{ background: T.cardBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: 20, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textSec }}>Sessies laden...</div>
          </div>
        ) : (() => {
          const ftp = profiel?.ftp || 265;
          const sessieVandaag = (weekSessies?.sessies || []).find(s => s.datum === vandaagISO);
          if (ritVandaag) {
            const cls = classificeerRit(ritVandaag, ftp);
            const mode = sessieVandaag ? "uitgevoerd" : "unplanned";
            return (
              <SessieUitkomstKaart
                mode={mode} rit={ritVandaag} sessie={sessieVandaag} ritCls={cls} compact
                onTap={() => onOpenWorkout?.({ datum: vandaagISO })}
              />
            );
          }
          if (eerstvolgende) {
            const isVandaag = eerstvolgende.datum === vandaagISO;

            // Vandaag, nog niet gereden — volledige "sessie vandaag"-kaart
            if (isVandaag) {
              const duurStr = eerstvolgende.duur_min ? `${Math.floor(eerstvolgende.duur_min / 60)}u ${String(eerstvolgende.duur_min % 60).padStart(2, "0")}m` : "—";
              const aantalBlokken = (eerstvolgende.segmenten || []).filter(s => s.type !== "warmup" && s.type !== "cooldown").length;
              return (
                <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "20px 20px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ font: "700 11px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: T.textTert, textTransform: "uppercase" }}>Vandaag · sessie</span>
                      <span style={{ font: "700 19px var(--font-nunito), sans-serif", letterSpacing: -0.3, color: T.text }}>{eerstvolgende.titel}</span>
                    </div>
                    <div style={{ flex: "none", padding: "5px 11px", borderRadius: 8, background: T.subtleFill, font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>FTP {ftp}W</div>
                  </div>

                  {eerstvolgende.segmenten && (
                    <div style={{ marginBottom: 16 }}>
                      <WorkoutViz segmenten={eerstvolgende.segmenten} hoogte={44} ftp={ftp} toonFtpLijn={false} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 22, marginBottom: 18 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ font: "700 16px var(--font-fredoka), sans-serif", color: T.text }}>{duurStr}</span><span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>Duur</span></div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ font: "700 16px var(--font-fredoka), sans-serif", color: T.text }}>{eerstvolgende.tss || "—"}</span><span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>TSS</span></div>
                    {aantalBlokken > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ font: "700 16px var(--font-fredoka), sans-serif", color: T.text }}>{aantalBlokken}</span><span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>Blokken</span></div>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenWorkout?.(eerstvolgende)}
                    style={{ width: "100%", cursor: "pointer", border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", padding: 15, borderRadius: 14, font: "700 15px var(--font-nunito), sans-serif", letterSpacing: 0.1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    Bekijk sessie
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              );
            }

            // Toekomstige dag — compacte preview
            const dagWeer = eerstvolgende.datum && weer?.forecast?.[eerstvolgende.datum] ? weer.forecast[eerstvolgende.datum] : weer;
            const weerIcoon = dagWeer ? (() => {
              const t = dagWeer.temp;
              const c = dagWeer.conditie || "";
              return t <= 5 ? "🥶" : t >= 28 ? "🔥" : /regen|buien|motregen/i.test(c) ? "🌧️" : /bewolkt/i.test(c) ? "☁️" : /mistig|rijp/i.test(c) ? "🌫️" : /onweer/i.test(c) ? "⛈️" : /sneeuw/i.test(c) ? "❄️" : /helder/i.test(c) ? "☀️" : "⛅";
            })() : null;
            return (
              <button
                onClick={() => onOpenWorkout?.(eerstvolgende)}
                style={{
                  width: "100%", background: T.cardBg,
                  border: `1.5px solid ${T.cardBorder}`, borderRadius: 20,
                  padding: "12px 16px", display: "flex", alignItems: "center",
                  justifyContent: "space-between", cursor: "pointer", textAlign: "left",
                  marginBottom: 16,
                }}
              >
                <div>
                  <span style={{
                    font: "700 11px/1 var(--font-nunito), sans-serif", letterSpacing: "1.2px",
                    color: T.textTert, textTransform: "uppercase",
                    display: "block", marginBottom: 4,
                  }}>
                    {eerstvolgende.dag?.toUpperCase() || "SESSIE"} · SESSIE
                  </span>
                  <span style={{ font: "700 14px/1.3 var(--font-nunito), sans-serif", color: T.text, display: "block" }}>
                    {eerstvolgende.titel}
                  </span>
                  <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, display: "block", marginTop: 2 }}>
                    {eerstvolgende.duur_min ? `${Math.floor(eerstvolgende.duur_min / 60)}u${String(eerstvolgende.duur_min % 60).padStart(2, "0")}` : ""}{eerstvolgende.tss ? ` · ${eerstvolgende.tss} TSS` : ""}
                    {dagWeer ? ` · ${weerIcoon} ${dagWeer.temp}°` : ""}
                  </span>
                </div>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M9 5l7 7-7 7" stroke={T.textTert} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            );
          }
          return (
            <div style={{ background: T.cardBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: 20, padding: "12px 16px", marginBottom: 16 }}>
              <span style={{ font: "700 11px var(--font-nunito), sans-serif", letterSpacing: "1.2px", color: T.textTert, textTransform: "uppercase" }}>
                VANDAAG · RUST
              </span>
              <p style={{ font: "700 14px/1.3 var(--font-nunito), sans-serif", color: T.text, margin: "4px 0 0" }}>
                Rustdag — herstel is training.
              </p>
            </div>
          );
        })()}



        {/* Ochtend check-in */}
        {!checkinLaden && !checkin && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
            <span style={{ font: "600 14px var(--font-nunito), sans-serif", color: T.text }}>Hoe voel je je vandaag?</span>
            <button
              onClick={() => { setCheckinWaarde(0); setCheckinModalOpen(true); }}
              style={{ flex: "none", cursor: "pointer", border: "none", background: T.subtleFill, color: T.text, padding: "10px 16px", borderRadius: 999, font: "700 13px var(--font-nunito), sans-serif" }}
            >
              Check-in
            </button>
          </div>
        )}

        {checkinModalOpen && (
          <CheckinModal
            value={checkinWaarde}
            onChange={setCheckinWaarde}
            onConfirm={() => bevestigCheckin(checkinWaarde)}
            onClose={() => setCheckinModalOpen(false)}
          />
        )}

        {/* Gereedheid & Conditie */}
        <GereedheidConditieKaart
          balansScore={score}
          ctl={wellenessHuidig ? Math.round(wellenessHuidig.ctl || 0) : null}
          atl={wellenessHuidig ? Math.round(wellenessHuidig.atl || 0) : null}
          tsb={tsb}
          paragraaf={readinessParagraaf}
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
