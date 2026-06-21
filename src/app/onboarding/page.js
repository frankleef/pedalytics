"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ToestemmingPage() {
  const [akkoord, setAkkoord] = useState(false);
  const [laden, setLaden] = useState(false);
  const [alToestemming, setAlToestemming] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/onboarding/intervals").then(r => r.json()).then(d => {
      if (d.success) {
        if (d.heeftKey) { router.push("/"); return; }
        if (d.heeftToestemming) { setAlToestemming(true); router.push("/onboarding/intervals"); }
      }
    }).catch(() => {});
  }, []);

  const handleDoorGaan = async () => {
    if (!akkoord) return;
    setLaden(true);
    const resp = await fetch("/api/onboarding/toestemming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ akkoord: true, versie: "1.0-concept" }),
    });
    const data = await resp.json();
    if (data.success) router.push("/onboarding/intervals");
    setLaden(false);
  };

  if (alToestemming) return null;

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.962 0.012 84)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-nunito), 'Nunito', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(40,90,140,0.28)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ margin: 0, font: "800 26px var(--font-nunito), sans-serif", letterSpacing: -0.4, color: "oklch(0.27 0.02 70)" }}>Gezondheidsgegevens</h1>
          <p style={{ margin: "8px 0 0", font: "600 14px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>
            Om je trainingsplan persoonlijk te maken, hebben we toegang nodig tot een aantal gegevens van je fietscomputer.
          </p>
        </div>

        <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "24px 22px", border: "1px solid oklch(0.93 0.01 82)", boxShadow: "0 2px 14px rgba(60,45,20,0.05)" }}>
          <div style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.2, color: "oklch(0.6 0.02 75)", textTransform: "uppercase", marginBottom: 14 }}>Wat we ophalen</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {[
              { icoon: "❤️", titel: "Hartslag & HRV", uitleg: "Rusthartslag en hartslagvariabiliteit voor herstelstatus" },
              { icoon: "⚡", titel: "Vermogen & cadans", uitleg: "Wattage per rit voor trainingsbelasting en voortgang" },
              { icoon: "😴", titel: "Slaapdata", uitleg: "Slaapscore en -duur van je Garmin voor herstelberekening" },
              { icoon: "📊", titel: "Trainingsbelasting", uitleg: "CTL, ATL en TSB berekend door intervals.icu" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 20, lineHeight: 1.4 }}>{item.icoon}</span>
                <div>
                  <div style={{ font: "700 14px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)" }}>{item.titel}</div>
                  <div style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>{item.uitleg}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "oklch(0.965 0.012 84)", borderRadius: 16, padding: "14px 16px", marginBottom: 20, font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.02 72)" }}>
            Deze gegevens worden uitsluitend gebruikt om je trainingsadvies te personaliseren. Ze worden niet gedeeld met derden en zijn versleuteld opgeslagen. Je kunt de koppeling op elk moment intrekken via je profiel.
          </div>

          <label onClick={() => setAkkoord(!akkoord)} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", marginBottom: 22 }}>
            <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, border: akkoord ? "none" : "2px solid oklch(0.78 0.014 80)", background: akkoord ? "oklch(0.64 0.14 248)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              {akkoord && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{ font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.3 0.02 70)" }}>
              Ik geef toestemming voor het ophalen en verwerken van bovenstaande gezondheidsgegevens via intervals.icu, conform het{" "}
              <a href="/privacybeleid" style={{ color: "oklch(0.5 0.14 248)", textDecoration: "underline" }}>privacybeleid</a>.
            </span>
          </label>

          <button onClick={handleDoorGaan} disabled={!akkoord || laden}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: akkoord ? "oklch(0.24 0.012 70)" : "oklch(0.88 0.014 80)", color: akkoord ? "oklch(0.97 0.01 84)" : "oklch(0.6 0.02 75)", font: "800 16px var(--font-nunito), sans-serif", cursor: akkoord && !laden ? "pointer" : "not-allowed", letterSpacing: 0.2, transition: "background 0.2s" }}>
            {laden ? "Opslaan..." : "Doorgaan naar koppeling"}
          </button>
        </div>
      </div>
    </div>
  );
}
