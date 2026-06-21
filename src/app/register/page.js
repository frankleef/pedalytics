"use client";
import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import Turnstile from "../components/Turnstile";

export default function RegisterPage() {
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bevestig, setBevestig] = useState("");
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [toestemming, setToestemming] = useState(false);
  const [fout, setFout] = useState("");
  const [laden, setLaden] = useState(false);

  const handleTurnstile = useCallback((token) => setTurnstileToken(token), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFout("");
    if (password.length < 8) { setFout("Kies een wachtwoord van minimaal 8 tekens"); return; }
    if (password !== bevestig) { setFout("De wachtwoorden komen niet overeen"); return; }
    if (!toestemming) { setFout("Geef toestemming voor het verwerken van gezondheidsgegevens"); return; }
    if (!turnstileToken) { setFout("Bevestig dat je geen robot bent"); return; }
    setLaden(true);
    try {
      const resp = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam, email, password, turnstileToken, toestemming }),
      });
      const data = await resp.json();
      if (!data.success) { setFout(data.error || "Registratie mislukt"); setLaden(false); return; }
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.ok) window.location.href = "/";
      else setFout("Account aangemaakt, maar inloggen mislukt. Probeer handmatig in te loggen.");
    } catch (e) {
      setFout("Er ging iets mis. Probeer opnieuw.");
    }
    setLaden(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.962 0.012 84)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-nunito), 'Nunito', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(40,90,140,0.28)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 14.5l4-7 3.5 4.5L15 6l5 8.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ margin: 0, font: "800 28px var(--font-nunito), 'Nunito', sans-serif", letterSpacing: -0.4, color: "oklch(0.27 0.02 70)" }}>Account aanmaken</h1>
          <p style={{ margin: "8px 0 0", font: "600 14px var(--font-nunito), 'Nunito', sans-serif", color: "oklch(0.5 0.02 74)" }}>Gratis · begin je trainingsplan in een paar stappen</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "28px 24px", border: "1px solid oklch(0.93 0.01 82)", boxShadow: "0 2px 14px rgba(60,45,20,0.05)" }}>
          {fout && <div style={{ background: "oklch(0.97 0.03 28)", border: "1px solid oklch(0.88 0.06 28)", borderRadius: 14, padding: "12px 14px", marginBottom: 16, font: "600 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.12 28)" }}>{fout}</div>}

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>Naam</span>
            <input type="text" value={naam} onChange={e => setNaam(e.target.value)} required autoComplete="name" placeholder="Jouw voornaam"
              style={{ width: "100%", padding: "13px 16px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 15px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box" }} />
          </label>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>E-mailadres</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="naam@voorbeeld.nl"
              style={{ width: "100%", padding: "13px 16px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 15px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box" }} />
          </label>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>Wachtwoord</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" placeholder="Minimaal 8 tekens"
              style={{ width: "100%", padding: "13px 16px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 15px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box" }} />
          </label>

          <label style={{ display: "block", marginBottom: 24 }}>
            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>Bevestig wachtwoord</span>
            <input type="password" value={bevestig} onChange={e => setBevestig(e.target.value)} required autoComplete="new-password" placeholder="Herhaal je wachtwoord"
              style={{ width: "100%", padding: "13px 16px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 15px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box" }} />
          </label>

          <label onClick={() => setToestemming(!toestemming)} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", marginBottom: 16, padding: "14px 16px", borderRadius: 16, background: "oklch(0.965 0.012 84)" }}>
            <div style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 5, border: toestemming ? "none" : "2px solid oklch(0.78 0.014 80)", background: toestemming ? "oklch(0.64 0.14 248)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              {toestemming && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{ font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.35 0.02 70)" }}>
              Ik geef toestemming voor het ophalen en verwerken van mijn gezondheidsgegevens (HRV, hartslag, slaap) via intervals.icu, conform het{" "}
              <a href="/privacybeleid" onClick={e => e.stopPropagation()} style={{ color: "oklch(0.5 0.14 248)", textDecoration: "underline" }}>privacybeleid</a>.
            </span>
          </label>

          <Turnstile onVerify={handleTurnstile} />

          <button type="submit" disabled={laden || !turnstileToken}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: turnstileToken ? "oklch(0.24 0.012 70)" : "oklch(0.88 0.014 80)", color: turnstileToken ? "oklch(0.97 0.01 84)" : "oklch(0.6 0.02 75)", font: "800 16px var(--font-nunito), sans-serif", cursor: laden || !turnstileToken ? "not-allowed" : "pointer", opacity: laden ? 0.6 : 1, letterSpacing: 0.2 }}>
            {laden ? "Account aanmaken..." : "Registreren"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/login" style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.14 248)", textDecoration: "none" }}>
            Al een account? Inloggen
          </a>
        </div>
      </div>
    </div>
  );
}
