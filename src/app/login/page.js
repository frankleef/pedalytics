"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
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
    <div style={{ minHeight: "100vh", background: "oklch(0.962 0.012 84)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-nunito), 'Nunito', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(40,90,140,0.28)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 14.5l4-7 3.5 4.5L15 6l5 8.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ margin: 0, font: "800 28px var(--font-nunito), 'Nunito', sans-serif", letterSpacing: -0.4, color: "oklch(0.27 0.02 70)" }}>Pedalytics</h1>
          <p style={{ margin: "8px 0 0", font: "600 14px var(--font-nunito), 'Nunito', sans-serif", color: "oklch(0.5 0.02 74)" }}>Log in om verder te gaan</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: "oklch(0.99 0.006 84)", borderRadius: 28, padding: "28px 24px", border: "1px solid oklch(0.93 0.01 82)", boxShadow: "0 2px 14px rgba(60,45,20,0.05)" }}>
          {fout && <div style={{ background: "oklch(0.97 0.03 28)", border: "1px solid oklch(0.88 0.06 28)", borderRadius: 14, padding: "12px 14px", marginBottom: 16, font: "600 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.12 28)" }}>{fout}</div>}

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>E-mailadres</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="naam@voorbeeld.nl"
              style={{ width: "100%", padding: "13px 16px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 15px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box" }} />
          </label>

          <label style={{ display: "block", marginBottom: 24 }}>
            <span style={{ font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", display: "block", marginBottom: 6 }}>Wachtwoord</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
              style={{ width: "100%", padding: "13px 16px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.965 0.012 84)", font: "600 15px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)", outline: "none", boxSizing: "border-box" }} />
          </label>

          <button type="submit" disabled={laden}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: "oklch(0.24 0.012 70)", color: "oklch(0.97 0.01 84)", font: "800 16px var(--font-nunito), sans-serif", cursor: laden ? "not-allowed" : "pointer", opacity: laden ? 0.6 : 1, letterSpacing: 0.2 }}>
            {laden ? "Inloggen..." : "Inloggen"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 0" }}>
            <div style={{ flex: 1, height: 1, background: "oklch(0.91 0.012 82)" }} />
            <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.6 0.02 75)" }}>of</span>
            <div style={{ flex: 1, height: 1, background: "oklch(0.91 0.012 82)" }} />
          </div>

          <button type="button" onClick={() => signIn("google", { callbackUrl: from })}
            style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 999, border: "1.5px solid oklch(0.88 0.014 80)", background: "transparent", font: "700 15px var(--font-nunito), sans-serif", color: "oklch(0.3 0.02 70)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Doorgaan met Google
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/register" style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.14 248)", textDecoration: "none" }}>
            Nog geen account? Registreer
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
