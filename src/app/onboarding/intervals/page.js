"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IntervalsOnboardingPage() {
  const [apiKey, setApiKey] = useState("");
  const [fout, setFout] = useState("");
  const [laden, setLaden] = useState(false);
  const [succes, setSucces] = useState(null);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFout("");
    if (!apiKey.trim()) { setFout("Vul je API-key in"); return; }
    setLaden(true);
    try {
      const resp = await fetch("/api/onboarding/intervals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await resp.json();
      if (!data.success) { setFout(data.error || "Koppeling mislukt"); setLaden(false); return; }
      setSucces(data);
      setTimeout(() => router.push("/"), 2000);
    } catch {
      setFout("Er ging iets mis. Probeer opnieuw.");
    }
    setLaden(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.962 0.012 84)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-nunito), 'Nunito', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(40,90,140,0.28)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 14.5l4-7 3.5 4.5L15 6l5 8.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ margin: 0, font: "800 26px var(--font-nunito), sans-serif", letterSpacing: -0.4, color: "oklch(0.27 0.02 70)" }}>Koppel intervals.icu</h1>
          <p style={{ margin: "8px 0 0", font: "600 14px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>
            Voer je API-key in om je trainingsdata te laden.
          </p>
        </div>

        {succes ? (
          <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "28px 24px", border: "1px solid oklch(0.93 0.01 82)", boxShadow: "0 2px 14px rgba(60,45,20,0.05)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "oklch(0.93 0.05 165)", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="oklch(0.5 0.13 162)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ font: "700 17px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)", marginBottom: 6 }}>Gekoppeld als {succes.naam}</div>
            <div style={{ font: "600 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>Athlete ID: {succes.athleteId} — je wordt doorgestuurd...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "28px 24px", border: "1px solid oklch(0.93 0.01 82)", boxShadow: "0 2px 14px rgba(60,45,20,0.05)" }}>
            {fout && <div style={{ background: "oklch(0.97 0.03 28)", border: "1px solid oklch(0.88 0.06 28)", borderRadius: 14, padding: "12px 14px", marginBottom: 16, font: "600 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.12 28)" }}>{fout}</div>}

            <div style={{ background: "oklch(0.965 0.012 84)", borderRadius: 16, padding: "14px 16px", marginBottom: 18, font: "600 12.5px/1.55 var(--font-nunito), sans-serif", color: "oklch(0.45 0.02 72)" }}>
              <strong style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: "oklch(0.3 0.02 70)" }}>Waar vind je je API-key?</strong><br/>
              intervals.icu → Instellingen (tandwiel) → scrol naar beneden → <em>Developer Settings</em> → kopieer de API-key.
            </div>

            <label style={{ display: "block", marginBottom: 24 }}>
              <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>API-key</span>
              <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required autoComplete="off" placeholder="Plak je API-key hier"
                style={{ width: "100%", padding: "13px 16px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 14px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
            </label>

            <button type="submit" disabled={laden}
              style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: "oklch(0.24 0.012 70)", color: "oklch(0.97 0.01 84)", font: "800 16px var(--font-nunito), sans-serif", cursor: laden ? "not-allowed" : "pointer", opacity: laden ? 0.6 : 1, letterSpacing: 0.2 }}>
              {laden ? "Verifiëren..." : "Koppelen"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
