"use client";
import { T } from "../designTokens";

export default function LegeKoppelStaat({ context = "data" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 30px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "oklch(0.94 0.03 235)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="oklch(0.5 0.1 235)" strokeWidth="2.2" strokeLinecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="oklch(0.5 0.1 235)" strokeWidth="2.2" strokeLinecap="round"/></svg>
      </div>
      <h2 style={{ margin: "0 0 8px", font: "800 20px var(--font-nunito), sans-serif", color: T.text }}>Nog niet gekoppeld</h2>
      <p style={{ margin: "0 0 20px", font: "600 14px/1.5 var(--font-nunito), sans-serif", color: T.textSec, maxWidth: 280 }}>
        Koppel je intervals.icu-account om je {context === "training" ? "trainingsschema" : context === "voortgang" ? "voortgang en trends" : "trainingsdata en herstelstatus"} te zien.
      </p>
      <a href="/onboarding/intervals" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: 999, background: T.slate, color: "oklch(0.97 0.01 84)", font: "800 15px var(--font-nunito), sans-serif", textDecoration: "none", letterSpacing: 0.2 }}>
        Koppel intervals.icu
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </a>
      <a href="/onboarding" style={{ display: "block", marginTop: 14, font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.5 0.14 248)", textDecoration: "none" }}>
        Hulp nodig bij het koppelen?
      </a>
    </div>
  );
}
