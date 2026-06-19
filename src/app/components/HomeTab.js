"use client";
import { T, STATUS, getStatus } from "../designTokens";
import { berekenHerstelScore } from "./HerstelStatus";
import { berekenDagAdvies } from "./DagAdvies";
import BalanceRing from "./home/BalanceRing";
import WeekStrip from "./home/WeekStrip";
import SessionCard from "./home/SessionCard";
import InsightCard from "./home/InsightCard";

const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];

export default function HomeTab({ profiel, wellenessHuidig, vandaagInvoer, dagelijkseData, voortgang, seizoensplan, weekSessies, weekSessiesLaden, beschikbaar, onOpenWorkout, onEditBeschikbaarheid }) {
  const hrvBasislijn = profiel?.hrv_basislijn || 58;
  const hrBasislijn = profiel?.hr_basislijn || 49;
  const tsb = wellenessHuidig ? Math.round((wellenessHuidig.ctl || 0) - (wellenessHuidig.atl || 0)) : null;

  const { score } = berekenHerstelScore({
    hrv: vandaagInvoer?.hrv, hrvBasislijn,
    rusthartslag: vandaagInvoer?.rusthartslag, rusthartslagBasislijn: hrBasislijn,
    tsb, slaapScore: vandaagInvoer?.slaapScore,
  });
  const statusKey = getStatus(score);
  const st = STATUS[statusKey];
  const naam = "Frank";

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
  const dagNl = nu.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  const uur = nu.getHours();
  const groet = uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, paddingBottom: T.navH + 20 }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: `16px ${T.pad}px 28px` }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: T.textTert }}>{dagNl}</span>
            <span style={{ font: "700 17px var(--font-nunito), sans-serif", color: "oklch(0.3 0.02 70)" }}>{groet} 👋</span>
          </div>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: T.gradient, display: "flex", alignItems: "center", justifyContent: "center", font: "800 18px var(--font-fredoka), sans-serif", color: "#fff", boxShadow: "0 4px 12px rgba(40,90,140,0.28)" }}>
            {naam[0]}
          </div>
        </div>

        {/* Status headline */}
        <h1 style={{ margin: "0 0 20px", font: "800 27px/1.22 var(--font-nunito), sans-serif", letterSpacing: -0.4, textWrap: "pretty", color: st.color }}>
          {st.headline(naam)}
        </h1>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 9, overflowX: "auto", margin: `0 -${T.pad}px 22px`, padding: `2px ${T.pad}px 6px` }}>
          {["Vandaag", "Deze week", "Herstel", "Belasting"].map((label, i) => (
            <div key={label} style={{
              flex: "none", padding: "9px 17px", borderRadius: T.pillRadius, cursor: "pointer",
              ...(i === 0
                ? { background: T.slate, color: "oklch(0.97 0.01 84)", font: "700 13.5px var(--font-nunito), sans-serif" }
                : { background: "transparent", border: "1.5px solid oklch(0.86 0.014 80)", color: "oklch(0.42 0.02 72)", font: "700 13.5px var(--font-nunito), sans-serif" }),
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Balance ring */}
        <BalanceRing
          vandaagInvoer={vandaagInvoer}
          tsb={tsb}
          slaapScore={vandaagInvoer?.slaapScore}
          wellenessHuidig={wellenessHuidig}
          hrvBasislijn={hrvBasislijn}
          hrBasislijn={hrBasislijn}
        />

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
