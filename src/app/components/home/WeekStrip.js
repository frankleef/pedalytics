"use client";
import { T } from "../../designTokens";

const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const DAG_KORT = ["Ma","Di","Wo","Do","Vr","Za","Zo"];

export default function WeekStrip({ beschikbaar, weekSessies, weekSessiesLaden, onEdit }) {
  const vandaagIdx = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const nu = new Date();
  const maandag = new Date(nu);
  maandag.setDate(nu.getDate() - vandaagIdx);
  maandag.setHours(0, 0, 0, 0);

  const sessieLookup = {};
  if (weekSessies?.sessies) {
    DAGEN.forEach((dag, i) => {
      const dagDatum = new Date(maandag);
      dagDatum.setDate(maandag.getDate() + i);
      const iso = dagDatum.toISOString().split("T")[0];
      const sessie = weekSessies.sessies.find(s => s.datum === iso && s.type !== "rust")
        || weekSessies.sessies.find(s => !s.datum && s.dag === dag && s.type !== "rust");
      if (sessie) sessieLookup[dag] = sessie;
    });
  }

  const aantalTrain = DAGEN.filter(d => sessieLookup[d]).length || DAGEN.filter(d => beschikbaar?.[d]).length;
  const aantalRust = 7 - aantalTrain;

  return (
    <div onClick={onEdit} style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "18px 18px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, marginBottom: 16, cursor: onEdit ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15, padding: "0 4px" }}>
        <span style={{ font: "800 12px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: T.textTert, textTransform: "uppercase" }}>Beschikbaarheid</span>
        <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: T.textSec }}>
          {weekSessiesLaden ? "Sessies laden..." : `${aantalTrain} sessies · ${aantalRust} rust`}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        {DAGEN.map((dag, i) => {
          const isTrain = !!sessieLookup[dag] || !!beschikbaar?.[dag];
          const isVandaag = i === vandaagIdx;

          return (
            <div key={dag} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, flex: 1 }}>
              <span style={{ font: "700 11.5px var(--font-nunito), sans-serif", color: "oklch(0.55 0.02 75)" }}>{DAG_KORT[i]}</span>
              <div style={{ position: "relative", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isVandaag && (
                  <div style={{ position: "absolute", inset: -5, borderRadius: "50%", border: `2px solid ${T.text}` }} />
                )}
                {isTrain ? (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.gradient, boxShadow: "0 4px 10px rgba(60,120,150,0.22)" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.subtleFill, border: "1.5px solid oklch(0.88 0.014 80)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 13, height: 3, borderRadius: 2, background: "oklch(0.68 0.015 75)" }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
