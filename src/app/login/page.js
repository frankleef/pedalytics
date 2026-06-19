"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [laden, setLaden] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const from = searchParams.get("from") || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLaden(true);
    setError(null);
    try {
      const resp = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await resp.json();
      if (data.success) {
        router.push(from);
      } else {
        setError(data.error || "Onjuist wachtwoord");
      }
    } catch {
      setError("Verbinding mislukt");
    }
    setLaden(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.962 0.012 84)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", font: "700 24px 'Fredoka', sans-serif", color: "#fff", boxShadow: "0 6px 20px rgba(40,90,140,0.3)" }}>
          P
        </div>
        <h1 style={{ font: "800 24px 'Nunito', sans-serif", color: "oklch(0.27 0.02 70)", margin: "0 0 8px", letterSpacing: -0.3 }}>Pedalytics</h1>
        <p style={{ font: "600 14px 'Nunito', sans-serif", color: "oklch(0.5 0.02 74)", margin: "0 0 28px" }}>Voer je wachtwoord in om door te gaan</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Wachtwoord"
            autoFocus
            style={{ width: "100%", padding: "14px 18px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.99 0.006 84)", font: "600 15px 'Nunito', sans-serif", color: "oklch(0.27 0.02 70)", outline: "none", marginBottom: 12, boxSizing: "border-box" }}
          />
          {error && (
            <div style={{ font: "600 13px 'Nunito', sans-serif", color: "oklch(0.52 0.1 28)", marginBottom: 12 }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={laden || !password}
            style={{ width: "100%", padding: 15, borderRadius: 999, border: "none", cursor: laden ? "wait" : "pointer", background: "oklch(0.24 0.012 70)", color: "oklch(0.97 0.01 84)", font: "800 15px 'Nunito', sans-serif", letterSpacing: 0.2, opacity: laden || !password ? 0.5 : 1 }}>
            {laden ? "Inloggen..." : "Inloggen"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
