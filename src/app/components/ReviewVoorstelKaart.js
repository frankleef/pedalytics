"use client";
import { useEffect, useState } from "react";
import { T } from "../designTokens";
import { haalReviewVoorstellenOp, reageerOpVoorstel } from "./reviewVoorstelActies";

// Blok F, fase 5. Zelfde visuele laag als HrvAdviesKaart (T.cardRadius,
// T.cardBg, achtergrond/rand/padding-structuur), maar — in tegenstelling tot
// HrvAdviesKaart, dat puur presentational is en zijn data als props van de
// al-geladen sessie-state van de ouder krijgt — haalt deze component ZELF
// zijn data op: review_voorstel:${userId} maakt geen deel uit van het
// seizoensplan/de al-geladen sessie-state, dus er is geen bestaande prop-bron
// om op te leunen. Zie verificatierapport voor de volledige onderbouwing.
export default function ReviewVoorstelKaart({ onPlanWijziging }) {
  const [voorstellen, setVoorstellen] = useState([]);
  const [bezigMet, setBezigMet] = useState(null); // datum van het item dat een actie verwerkt

  useEffect(() => {
    haalReviewVoorstellenOp().then(setVoorstellen).catch(() => {});
  }, []);

  async function reageer(item, actie) {
    setBezigMet(item.datum);
    try {
      const data = await reageerOpVoorstel(item, actie);
      if (data.success) {
        setVoorstellen(v => v.filter(x => x.datum !== item.datum));
        if (actie === "toepassen") onPlanWijziging?.();
      }
    } finally {
      setBezigMet(null);
    }
  }

  // Geen voorstel (lege/verlopen key): niets tonen, geen lege-staat, geen layoutverschuiving.
  if (voorstellen.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
      {voorstellen.map(item => (
        <div
          key={item.datum}
          style={{ background: "oklch(0.97 0.03 250)", border: "1.5px solid oklch(0.88 0.06 250)", borderRadius: T.cardRadius, padding: "18px 20px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "oklch(0.6 0.15 250)", flexShrink: 0 }} />
            <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: "oklch(0.3 0.04 40)" }}>
              Voorstel voor {item.datum} ({item.huidigSessietype})
            </span>
          </div>

          <p style={{ margin: "0 0 14px", font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.04 40)" }}>
            {item.voorgesteldeAanpassing}
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={bezigMet === item.datum}
              onClick={() => reageer(item, "toepassen")}
              style={{
                flex: 1, padding: "13px 16px", borderRadius: 16, border: "none", cursor: "pointer",
                background: "oklch(0.6 0.15 250)", color: "#fff",
                font: "700 14px var(--font-nunito), sans-serif",
                opacity: bezigMet === item.datum ? 0.6 : 1,
              }}
            >
              Toepassen
            </button>
            <button
              disabled={bezigMet === item.datum}
              onClick={() => reageer(item, "negeren")}
              style={{
                flex: 1, padding: "13px 16px", borderRadius: 16, border: `1.5px solid ${T.cardBorder}`, cursor: "pointer",
                background: T.cardBg, color: T.text,
                font: "700 14px var(--font-nunito), sans-serif",
                opacity: bezigMet === item.datum ? 0.6 : 1,
              }}
            >
              Negeren
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
