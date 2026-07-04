"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function IntervalsOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <IntervalsOnboardingInner />
    </Suspense>
  );
}

function IntervalsOnboardingInner() {
  const searchParams = useSearchParams();
  const isHerstel = searchParams.get("herstel") === "1";
  const [stap, setStap] = useState(isHerstel ? 2 : 1);
  const [heeftAccount, setHeeftAccount] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [toonKey, setToonKey] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | verifying | connected | warning | invalid | error
  const [statusData, setStatusData] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (isHerstel) return;
    fetch("/api/onboarding/intervals").then(r => r.json()).then(d => {
      if (d.success && d.heeftKey) router.push("/");
    }).catch(() => {});
  }, []);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setStatus("verifying");
    try {
      const resp = await fetch("/api/onboarding/intervals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await resp.json();
      if (!data.success) {
        setStatusData(data.error);
        setStatus(data.error?.includes("Ongeldig") || data.error?.includes("401") || data.error?.includes("403") ? "invalid" : "error");
        return;
      }
      setStatusData(data);
      setStatus(data.dataStatus === "verified_with_data" ? "connected" : "warning");
    } catch {
      setStatus("error"); setStatusData("Verbinding mislukt");
    }
  };

  const valideerEnConnect = (key) => {
    const k = key.trim();
    if (!k) return;
    if (k.startsWith("http")) { setStatus("invalid"); setStatusData("Dit lijkt een URL, niet een API-sleutel"); return; }
    if (k.length < 10) { setStatus("invalid"); setStatusData("API-sleutel is te kort"); return; }
    setApiKey(k);
    setStatus("verifying");
    fetch("/api/onboarding/intervals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: k }) })
      .then(r => r.json()).then(data => {
        if (!data.success) { setStatusData(data.error); setStatus(data.error?.includes("Ongeldig") || data.error?.includes("401") || data.error?.includes("403") ? "invalid" : "error"); return; }
        setStatusData(data);
        setStatus(data.dataStatus === "verified_with_data" ? "connected" : "warning");
      }).catch(() => { setStatus("error"); setStatusData("Verbinding mislukt"); });
  };

  const handlePlakken = async () => {
    try {
      const tekst = await navigator.clipboard.readText();
      if (tekst) valideerEnConnect(tekst);
    } catch {}
  };

  const handlePaste = (e) => {
    const tekst = e.clipboardData?.getData("text");
    if (tekst) { e.preventDefault(); valideerEnConnect(tekst); }
  };

  const handleBlur = () => {
    if (apiKey.trim() && status === "idle") valideerEnConnect(apiKey);
  };

  const [toonWelkom, setToonWelkom] = useState(false);
  const handleKlaar = () => {
    setToonWelkom(true);
    setTimeout(() => router.push("/"), 2200);
  };

  const handleOverslaan = async () => {
    await fetch("/api/onboarding/overslaan", { method: "POST" });
    router.push("/");
  };

  const isConnected = status === "connected" || status === "warning";

  if (toonWelkom) {
    return (
      <div style={{ minHeight: "100vh", background: "oklch(0.962 0.012 84)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-nunito), 'Nunito', sans-serif", textAlign: "center", padding: 30 }}>
        <div>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: "linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 28px rgba(40,90,140,0.3)" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ margin: "0 0 8px", font: "800 26px var(--font-nunito), sans-serif", color: "oklch(0.27 0.02 70)" }}>{isHerstel ? "Koppeling hersteld" : `Welkom, ${statusData?.naam || "atleet"}!`}</h1>
          <p style={{ margin: 0, font: "600 15px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>{isHerstel ? "Je intervals.icu-koppeling werkt weer. Je gaat terug naar je overzicht." : "Je coach staat klaar. Laten we je eerste doel instellen."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.962 0.012 84)", display: "flex", flexDirection: "column", fontFamily: "var(--font-nunito), 'Nunito', sans-serif", color: "oklch(0.27 0.02 70)" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "16px 22px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div onClick={() => (stap === 2 && !isHerstel) ? setStap(1) : router.back()} style={{ width: 42, height: 42, borderRadius: "50%", background: "oklch(0.99 0.006 84)", border: "1px solid oklch(0.91 0.012 82)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(60,45,20,0.05)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="oklch(0.3 0.02 70)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>{isHerstel ? "Koppeling herstellen" : `Stap ${stap} van 2`}</span>
          {!isHerstel && <span onClick={handleOverslaan} style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.55 0.13 200)", cursor: "pointer" }}>Overslaan</span>}
          {isHerstel && <span style={{ width: 60 }} />}
        </div>
        {/* Progress */}
        {!isHerstel && (
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: "linear-gradient(90deg, oklch(0.62 0.14 248), oklch(0.79 0.14 168))" }} />
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: stap === 2 ? "linear-gradient(90deg, oklch(0.62 0.14 248), oklch(0.79 0.14 168))" : "oklch(0.9 0.012 82)" }} />
          </div>
        )}
        <span style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1.6, color: "oklch(0.6 0.02 75)" }}>{isHerstel ? "INTERVALS.ICU HERSTELLEN" : "INTERVALS.ICU KOPPELEN"}</span>
        <h1 style={{ margin: "6px 0 8px", font: "800 26px/1.2 var(--font-nunito), sans-serif", letterSpacing: -0.5, color: "oklch(0.27 0.02 70)" }}>
          {isHerstel ? "Verbind opnieuw" : stap === 1 ? "Kopieer je API-sleutel" : "Plak je API-sleutel"}
        </h1>
        <p style={{ margin: "0 0 4px", font: "600 14px/1.45 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>
          {isHerstel
            ? "Je intervals.icu-koppeling werkt niet meer — bijvoorbeeld na het regenereren van je API-sleutel. Haal een nieuwe sleutel op en plak die hieronder."
            : stap === 1 ? "We gebruiken je intervals.icu-account om trainingsdata en herstelgegevens op te halen." : "Plak de API-sleutel die je zojuist hebt gekopieerd."}
        </p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
        {/* Expectation chip */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "oklch(0.95 0.022 248)", border: "1px solid oklch(0.9 0.03 240)", marginBottom: 18 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="oklch(0.55 0.09 248)" strokeWidth="2"/><path d="M12 8v4l2.5 1.5" stroke="oklch(0.55 0.09 248)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: "oklch(0.46 0.06 248)" }}>Ongeveer 2 minuten · in 2 stappen</span>
        </div>

        {stap === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Ja/Nee pills */}
            <div style={{ marginBottom: 4 }}>
              <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.4 0.02 72)", display: "block", marginBottom: 8 }}>Heb je al een intervals.icu-account?</span>
              <div style={{ display: "flex", gap: 8 }}>
                {["Ja", "Nee"].map(opt => (
                  <button key={opt} onClick={() => setHeeftAccount(opt === "Ja")}
                    style={{ padding: "9px 20px", borderRadius: 999, cursor: "pointer", font: "700 13.5px var(--font-nunito), sans-serif",
                      ...(heeftAccount === (opt === "Ja") ? { background: "oklch(0.24 0.012 70)", color: "oklch(0.97 0.01 84)", border: "none" } : { background: "transparent", border: "1.5px solid oklch(0.86 0.014 80)", color: "oklch(0.42 0.02 72)" }),
                    }}>{opt}</button>
                ))}
              </div>
            </div>

            {heeftAccount === false && (
              <div style={{ background: "oklch(0.965 0.012 84)", borderRadius: 16, padding: "14px 16px", font: "600 13px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.45 0.02 72)" }}>
                intervals.icu is een gratis trainingsplatform dat je Garmin/Wahoo-data verwerkt. Je hebt een account nodig om je trainingsgegevens aan Kesto te koppelen.
              </div>
            )}

            {/* Step explanation */}
            <div style={{ background: "oklch(0.99 0.006 84)", borderRadius: 24, padding: 20, boxShadow: "0 2px 14px rgba(60,45,20,0.05)", border: "1px solid oklch(0.93 0.01 82)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
                <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 13, background: "oklch(0.94 0.03 235)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 18px var(--font-fredoka), sans-serif", color: "oklch(0.46 0.1 248)" }}>1</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ font: "800 15.5px var(--font-nunito), sans-serif", color: "oklch(0.28 0.02 70)" }}>Open je intervals.icu-instellingen</span>
                  <span style={{ font: "600 13.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.52 0.02 74)" }}>Onderaan de instellingenpagina vind je je persoonlijke API-sleutel — kopieer die en kom hier terug voor stap 2.</span>
                </div>
              </div>
            </div>

            {/* Deeplink */}
            <a href="https://intervals.icu/settings" target="_blank" rel="noopener"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 16, borderRadius: 999, background: "oklch(0.24 0.012 70)", color: "oklch(0.97 0.01 84)", font: "800 15.5px var(--font-nunito), sans-serif", letterSpacing: 0.2 }}>
              Open intervals.icu-instellingen
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="oklch(0.97 0.01 84)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
            <p style={{ margin: "2px 4px 0", font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.58 0.02 75)", textAlign: "center" }}>Opent in een nieuw tabblad. Je blijft hier ingelogd.</p>
          </div>
        )}

        {stap === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isHerstel && (
              <a href="https://intervals.icu/settings" target="_blank" rel="noopener"
                style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 14, borderRadius: 999, background: "oklch(0.24 0.012 70)", color: "oklch(0.97 0.01 84)", font: "800 14.5px var(--font-nunito), sans-serif", letterSpacing: 0.2 }}>
                Open intervals.icu-instellingen
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="oklch(0.97 0.01 84)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <label style={{ font: "800 12.5px var(--font-nunito), sans-serif", letterSpacing: 0.3, color: "oklch(0.4 0.02 72)" }}>API-sleutel</label>
              <div style={{ position: "relative", display: "flex", gap: 8 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input type={toonKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} onPaste={handlePaste} onBlur={handleBlur} placeholder="Plak hier je API-sleutel" autoComplete="off"
                    style={{ width: "100%", padding: "16px 44px 16px 17px", borderRadius: 16, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.99 0.006 84)", font: "600 14.5px var(--font-nunito), sans-serif", color: "oklch(0.28 0.02 70)", outline: "none", boxSizing: "border-box", fontFamily: "monospace", letterSpacing: 0.3 }} />
                  <button type="button" onClick={() => setToonKey(!toonKey)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d={toonKey ? "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" : "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"} stroke="oklch(0.55 0.02 75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{toonKey && <circle cx="12" cy="12" r="3" stroke="oklch(0.55 0.02 75)" strokeWidth="2"/>}</svg>
                  </button>
                </div>
                <button type="button" onClick={handlePlakken} style={{ flexShrink: 0, padding: "0 14px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.014 80)", background: "oklch(0.99 0.006 84)", cursor: "pointer", font: "700 12px var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>
                  Plakken
                </button>
              </div>
              <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.58 0.02 75)" }}>Te vinden onderaan je intervals.icu-instellingenpagina.</span>
            </div>

            <button onClick={handleConnect} disabled={!apiKey.trim() || status === "verifying"}
              style={{ border: "none", cursor: apiKey.trim() && status !== "verifying" ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 16, borderRadius: 999, background: apiKey.trim() ? "oklch(0.24 0.012 70)" : "oklch(0.88 0.014 80)", color: apiKey.trim() ? "oklch(0.97 0.01 84)" : "oklch(0.6 0.02 75)", font: "800 15.5px var(--font-nunito), sans-serif", letterSpacing: 0.2 }}>
              {status === "verifying" ? "Verifiëren..." : "Koppelen"}
            </button>

            {/* Live status */}
            <div aria-live="polite" aria-atomic="true">
            {status === "verifying" && (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 16px", borderRadius: 18, background: "oklch(0.96 0.015 248)", border: "1px solid oklch(0.9 0.03 240)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}><path d="M12 3a9 9 0 1 0 9 9" stroke="oklch(0.55 0.09 248)" strokeWidth="2.4" strokeLinecap="round"/></svg>
                <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: "oklch(0.44 0.08 248)" }}>Bezig met verifiëren…</span>
              </div>
            )}
            {status === "connected" && (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 16px", borderRadius: 18, background: "oklch(0.96 0.03 165)", border: "1px solid oklch(0.88 0.05 165)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="oklch(0.6 0.13 165)"/><path d="M8 12.5l2.5 2.5L16 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: "oklch(0.42 0.12 162)" }}>Verbonden als {statusData?.naam || "atleet"} ✓</span>
              </div>
            )}
            {status === "invalid" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "15px 16px", borderRadius: 18, background: "oklch(0.97 0.03 28)", border: "1px solid oklch(0.9 0.05 30)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" stroke="oklch(0.55 0.12 28)" strokeWidth="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="oklch(0.55 0.12 28)" strokeWidth="2" strokeLinecap="round"/></svg>
                <div>
                  <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: "oklch(0.5 0.12 28)" }}>Ongeldige of verlopen API-sleutel</span>
                  <div style={{ font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)", marginTop: 3 }}>Controleer of je de volledige sleutel hebt gekopieerd uit intervals.icu-instellingen.</div>
                </div>
              </div>
            )}
            {status === "warning" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "15px 16px", borderRadius: 18, background: "oklch(0.97 0.022 78)", border: "1px solid oklch(0.9 0.05 75)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 4l9 16H3z" fill="oklch(0.92 0.05 75)" stroke="oklch(0.72 0.13 70)" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="oklch(0.55 0.11 65)" strokeWidth="2" strokeLinecap="round"/></svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: "oklch(0.48 0.1 62)" }}>Verbonden — maar nog geen hersteldata</span>
                  <span style={{ font: "600 12.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.02 74)" }}>
                    Controleer je Garmin/WHOOP-koppeling in intervals.icu.{" "}
                    <a href="https://intervals.icu/settings" target="_blank" rel="noopener" style={{ color: "oklch(0.55 0.13 200)", fontWeight: 800, textDecoration: "none" }}>Koppeling controleren →</a>
                  </span>
                </div>
              </div>
            )}
            {status === "error" && (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 16px", borderRadius: 18, background: "oklch(0.97 0.03 28)", border: "1px solid oklch(0.9 0.05 30)" }}>
                <span style={{ font: "800 14px var(--font-nunito), sans-serif", color: "oklch(0.5 0.12 28)" }}>{statusData || "Ongeldige API-key"}</span>
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {(!isHerstel || isConnected) && (
        <div style={{ flexShrink: 0, padding: "14px 22px 22px", background: "oklch(0.99 0.006 84)", borderTop: "1px solid oklch(0.91 0.012 82)" }}>
          <div style={{ display: "flex", gap: 11 }}>
            {stap === 2 && !isHerstel && (
              <button onClick={() => setStap(1)} style={{ flexShrink: 0, padding: "15px 22px", borderRadius: 999, border: "1.5px solid oklch(0.86 0.014 80)", background: "transparent", color: "oklch(0.4 0.02 72)", font: "800 15px var(--font-nunito), sans-serif", cursor: "pointer" }}>Terug</button>
            )}
            <button onClick={stap === 1 ? () => setStap(2) : isConnected ? handleKlaar : handleOverslaan}
              style={{ flex: 1, border: "none", cursor: "pointer", padding: 15, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: (stap === 1 || isConnected) ? "oklch(0.24 0.012 70)" : "transparent",
                color: (stap === 1 || isConnected) ? "oklch(0.97 0.01 84)" : "oklch(0.5 0.02 74)",
                font: "800 15.5px var(--font-nunito), sans-serif", letterSpacing: 0.2,
              }}>
              {stap === 1 ? "Volgende" : isConnected ? "Klaar" : "Sla over voor nu"}
              {(stap === 1 || isConnected) && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid oklch(0.62 0.12 235); outline-offset: 2px; }
      `}</style>
    </div>
  );
}
