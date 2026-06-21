"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fout, setFout] = useState("");
  const [laden, setLaden] = useState(false);
  const params = useSearchParams();
  const from = params.get("from") || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFout("");
    setLaden(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) {
      window.location.href = from;
    } else {
      setFout("Onjuist e-mailadres of wachtwoord");
    }
    setLaden(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "28px 24px", border: "1px solid oklch(0.93 0.01 82)", boxShadow: "0 2px 14px rgba(60,45,20,0.05)" }}>
      {fout && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 12, marginBottom: 16, font: "600 13px 'Nunito'", color: "#dc2626" }}>{fout}</div>}

      <label style={{ display: "block", marginBottom: 16 }}>
        <span style={{ font: "700 12px 'Nunito'", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>E-mailadres</span>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 15px 'Nunito'", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box" }} />
      </label>

      <label style={{ display: "block", marginBottom: 24 }}>
        <span style={{ font: "700 12px 'Nunito'", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>Wachtwoord</span>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 15px 'Nunito'", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box" }} />
      </label>

      <button type="submit" disabled={laden}
        style={{ width: "100%", padding: 15, borderRadius: 999, border: "none", background: "oklch(0.24 0.012 70)", color: "oklch(0.97 0.01 84)", font: "800 16px 'Nunito'", cursor: laden ? "not-allowed" : "pointer", opacity: laden ? 0.6 : 1 }}>
        {laden ? "Inloggen..." : "Inloggen"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.962 0.012 84)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 14.5l4-7 3.5 4.5L15 6l5 8.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ margin: 0, font: "800 28px 'Nunito'", color: "oklch(0.27 0.02 70)" }}>Pedalytics</h1>
          <p style={{ margin: "6px 0 0", font: "600 14px 'Nunito'", color: "oklch(0.5 0.02 74)" }}>Log in om verder te gaan</p>
        </div>
        <Suspense><LoginForm /></Suspense>
      </div>
    </div>
  );
}
