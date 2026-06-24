"use client";
import { T } from "../designTokens";

function StatusDot({ kleur }) {
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: kleur, flexShrink: 0 }} />;
}

function Tegel({ label, waarde, subtekst, kleur }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, padding: "14px 12px", borderRadius: 16, background: "oklch(0.965 0.012 84)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <StatusDot kleur={kleur} />
        <span style={{ font: "800 10px var(--font-nunito), sans-serif", letterSpacing: 1, color: T.textTert, textTransform: "uppercase" }}>{label}</span>
      </div>
      <span style={{ font: "600 22px var(--font-fredoka), sans-serif", lineHeight: 1, color: T.text }}>{waarde}</span>
      <span style={{ font: "600 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>{subtekst}</span>
    </div>
  );
}

export default function TrainingsCheckKaart({ polGem, planGem, planWeken, seizoensplan, voortgang }) {
  const GROEN = "oklch(0.6 0.13 165)";
  const AMBER = "oklch(0.72 0.13 70)";
  const GRIJS = "oklch(0.72 0.015 75)";

  // Polarisatie
  const polKleur = polGem >= 75 && polGem <= 85 ? GROEN : polGem >= 65 ? AMBER : GRIJS;

  // Plan naleving
  const planKleur = planGem >= 85 ? GROEN : planGem >= 65 ? AMBER : GRIJS;
  const planWekenAantal = planWeken?.length || 0;

  // Seizoensdoel
  const kader = seizoensplan?.kader || [];
  const seizoenStart = seizoensplan?.startdatum ? new Date(seizoensplan.startdatum) : null;
  const wekenVerstreken = seizoenStart ? Math.max(0, Math.floor((Date.now() - seizoenStart.getTime()) / (7 * 86400000))) : 0;
  const totaalWeken = seizoensplan?.tijdshorizon_weken || kader.length || 13;
  const totaalTssDoel = kader.reduce((s, w) => s + (w.tss_doel || 0), 0);
  const totaalTssWerkelijk = (voortgang?.ritten || [])
    .filter(r => r.datum_iso && seizoenStart && new Date(r.datum_iso) >= seizoenStart)
    .reduce((s, r) => s + (r.tss || 0), 0);
  const seizoenPct = totaalTssDoel > 0 ? Math.round((totaalTssWerkelijk / totaalTssDoel) * 100) : 0;
  const verwachtPct = totaalWeken > 0 ? Math.round((wekenVerstreken / totaalWeken) * 100) : 0;
  const seizoenKleur = seizoenPct >= verwachtPct - 10 ? GROEN : AMBER;

  // Consistentie
  const goedWeken = (() => {
    if (!planWeken?.length) return 0;
    let streak = 0;
    for (let i = planWeken.length - 1; i >= 0; i--) {
      if (planWeken[i].pct >= 75) streak++;
      else break;
    }
    return streak;
  })();
  const consKleur = goedWeken >= 3 ? GROEN : goedWeken >= 1 ? AMBER : GRIJS;

  return (
    <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "18px 16px 16px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
      <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase", display: "block", marginBottom: 14 }}>Trainingscheck</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Tegel label="Polarisatie" waarde={polGem > 0 ? `${polGem}%` : "– –"} subtekst={polGem > 0 ? `rustig · doel 80%` : "Nog te weinig data"} kleur={polGem > 0 ? polKleur : GRIJS} />
        <Tegel label="Plan gevolgd" waarde={planGem > 0 ? `${planGem}%` : "– –"} subtekst={planWekenAantal > 0 ? `gemiddeld · ${planWekenAantal} weken` : "Nog te weinig data"} kleur={planGem > 0 ? planKleur : GRIJS} />
        <Tegel label="Seizoensdoel" waarde={seizoenPct > 0 ? `${seizoenPct}%` : "– –"} subtekst={`week ${wekenVerstreken} van ${totaalWeken}`} kleur={seizoenPct > 0 ? seizoenKleur : GRIJS} />
        <Tegel label="Consistentie" waarde={goedWeken > 0 ? `${goedWeken} weken` : "– –"} subtekst={goedWeken > 0 ? "op rij compleet" : "Nog te weinig data"} kleur={consKleur} />
      </div>
    </div>
  );
}
