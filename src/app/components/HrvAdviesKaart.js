"use client";
import { useState } from "react";
import { T } from "../designTokens";

const KEUZES_ROOD_INTENSITEIT = [
  { id: "schrappen", label: "Training schrappen", sublabel: "Aanbevolen — je lichaam heeft rust nodig", aanbevolen: true },
  { id: "verlichten", label: "Lichter maken", sublabel: "Wordt omgezet naar een Z2-sessie", aanbevolen: false },
  { id: "verplaatsen", label: "Verplaatsen naar een andere dag", sublabel: "Kies een dag later deze week", aanbevolen: false },
  { id: "origineel", label: "Originele training volgen", sublabel: "De sessie voelt waarschijnlijk zwaarder dan normaal", aanbevolen: false },
];

const KEUZES_ROOD_AEROOB = [
  { id: "verlichten", label: "Verder verlichten", sublabel: "Wordt omgezet naar korte herstelrit", aanbevolen: true },
  { id: "origineel", label: "Z2-sessie zoals gepland", sublabel: "Z2 is al licht genoeg voor herstel", aanbevolen: false },
];

const KEUZES_GEEL_INTENSITEIT = [
  { id: "verlichten", label: "Iets lichter maken", sublabel: "Aanbevolen — iets kortere blokken, iets lager vermogen", aanbevolen: true },
  { id: "origineel", label: "Originele training volgen", sublabel: "", aanbevolen: false },
  { id: "verplaatsen", label: "Verplaatsen", sublabel: "", aanbevolen: false },
];

const BEVESTIGING = {
  schrappen: "Training geschrapt. Je plan past zich aan.",
  verlichten: "Sessie verlicht. Je nieuwe training staat klaar.",
  origineel: "Succes! Vul daarna je RPE in — dat helpt ons jouw patroon te leren.",
};

export function bepaalKeuzes(zone, notificatieType) {
  if (notificatieType === "rood_intensiteit" || (zone === "rood" && notificatieType !== "rood_aeroob")) return KEUZES_ROOD_INTENSITEIT;
  if (notificatieType === "rood_aeroob") return KEUZES_ROOD_AEROOB;
  return KEUZES_GEEL_INTENSITEIT;
}

export default function HrvAdviesKaart({ zone, keuzes, onKeuze, rpeVoorspelling, isVerwerkt, postActie }) {
  const [keuzeGemaakt, setKeuzeGemaakt] = useState(isVerwerkt ? "verwerkt" : null);
  const [isLaden, setIsLaden] = useState(false);

  const accentKleur = zone === "rood" ? "oklch(0.65 0.2 25)" : "oklch(0.72 0.13 70)";
  const achtergrond = zone === "rood" ? "oklch(0.97 0.03 25)" : "oklch(0.97 0.04 70)";
  const rand = zone === "rood" ? "oklch(0.88 0.08 25)" : "oklch(0.88 0.08 70)";

  // B1: rood is al automatisch toegepast (geen bevestiging vooraf) — deze
  // variant vervangt de keuzelijst door een constatering + een expliciete
  // correctiemogelijkheid achteraf. Zelfde laag-structuur als de statische
  // bevestigingsview hieronder (achtergrond/rand/radius/padding), aangevuld
  // met een knop.
  if (postActie) {
    return (
      <div style={{ background: "oklch(0.96 0.04 168)", border: "1px solid oklch(0.88 0.06 168)", borderRadius: T.cardRadius, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>&#x2705;</span>
          <p style={{ margin: 0, font: "600 14px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.35 0.06 168)" }}>
            Je herstel was laag — we hebben je training vandaag omgezet naar een herstelrit.
          </p>
        </div>
        <button
          disabled={isLaden}
          onClick={async () => {
            setIsLaden(true);
            await onKeuze("origineel");
            setIsLaden(false);
          }}
          style={{
            width: "100%", padding: "13px 16px", borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left",
            background: "#fff", opacity: isLaden ? 0.6 : 1,
          }}
        >
          <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: "oklch(0.35 0.06 168)" }}>
            Toch doorzetten met origineel plan
          </div>
        </button>
      </div>
    );
  }

  if (keuzeGemaakt) {
    return (
      <div style={{ background: "oklch(0.96 0.04 168)", border: "1px solid oklch(0.88 0.06 168)", borderRadius: T.cardRadius, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>&#x2705;</span>
          <p style={{ margin: 0, font: "600 14px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.35 0.06 168)" }}>
            {BEVESTIGING[keuzeGemaakt] || "Keuze opgeslagen."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: achtergrond, border: `1.5px solid ${rand}`, borderRadius: T.cardRadius, padding: "20px 20px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentKleur, flexShrink: 0 }} />
        <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: "oklch(0.3 0.04 40)" }}>
          {zone === "rood" ? "Je herstel is laag vandaag" : "Je herstel is iets lager dan normaal"}
        </span>
      </div>

      {rpeVoorspelling && (
        <p style={{ margin: "0 0 14px", font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.04 40)" }}>
          {rpeVoorspelling}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(keuzes || []).map(k => (
          <button
            key={k.id}
            disabled={isLaden}
            onClick={async () => {
              if (k.id === "verplaatsen") {
                setIsLaden(true);
                await onKeuze(k.id);
                setIsLaden(false);
                setKeuzeGemaakt(k.id);
                return;
              }
              setIsLaden(true);
              await onKeuze(k.id);
              setIsLaden(false);
              setKeuzeGemaakt(k.id);
            }}
            style={{
              width: "100%", padding: "13px 16px", borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left",
              background: k.aanbevolen ? "oklch(0.92 0.06 168)" : T.cardBg,
              opacity: isLaden ? 0.6 : 1,
            }}
          >
            <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: k.aanbevolen ? "oklch(0.3 0.08 168)" : T.text }}>
              {k.label}
            </div>
            {k.sublabel && (
              <div style={{ font: "600 12px var(--font-nunito), sans-serif", color: k.aanbevolen ? "oklch(0.45 0.06 168)" : T.textSec, marginTop: 2 }}>
                {k.sublabel}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
