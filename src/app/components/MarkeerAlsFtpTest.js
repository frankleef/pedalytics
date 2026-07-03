"use client";
import { useState } from "react";
import { T } from "../designTokens";

/**
 * Trigger + inline-bevestiging voor "markeer deze rit als FTP-test" — voor
 * een al gereden, niet vooraf geplande rit die verkeerd herkend wordt (bv.
 * als sweetspot, omdat classificeerRit() puur op genormaliseerd vermogen over
 * de hele rit werkt en dus geen ramp-test-signatuur herkent).
 *
 * @param {string} datum
 * @param {string} activiteitId - intervals.icu-activiteit-id van de gematchte rit
 * @param {(nieuweSessie: object) => void} onGemarkeerd
 */
export default function MarkeerAlsFtpTest({ datum, activiteitId, onGemarkeerd }) {
  const [open, setOpen] = useState(false);
  const [verwerkFtp, setVerwerkFtp] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  if (!activiteitId) return null;

  async function bevestig() {
    setBezig(true);
    setFout(null);
    try {
      const resp = await fetch("/api/sessie/markeer-als-test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datum, activiteitId, sessietype: "ramp_test", verwerkFtp }),
      });
      const data = await resp.json();
      if (!data.success) { setFout(data.error || "Markeren mislukt"); return; }
      onGemarkeerd(data.data);
      setOpen(false);
    } catch {
      setFout("Markeren mislukt");
    } finally {
      setBezig(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: T.pillRadius, border: `1.5px solid ${T.cardBorder}`, background: T.cardBg, color: T.textSec, font: "700 12.5px var(--font-nunito), sans-serif", cursor: "pointer", marginBottom: 16 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke={T.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Markeer als FTP-test
      </button>
    );
  }

  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: T.tileRadius, padding: 16, marginBottom: 16 }}>
      <p style={{ margin: "0 0 12px", font: "600 13px/1.5 var(--font-nunito), sans-serif", color: T.text }}>
        Deze rit wordt gelabeld als ramp-test-sessie voor {datum}.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={verwerkFtp} onChange={(e) => setVerwerkFtp(e.target.checked)} style={{ width: 16, height: 16 }} />
        <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec }}>FTP automatisch bijwerken op basis van deze rit</span>
      </label>
      {fout && <p style={{ margin: "0 0 12px", font: "600 12.5px var(--font-nunito), sans-serif", color: "oklch(0.5 0.15 25)" }}>{fout}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setOpen(false)} disabled={bezig} style={{ flex: 1, padding: 11, borderRadius: T.pillRadius, border: `1.5px solid ${T.cardBorder}`, background: T.cardBg, color: T.textSec, font: "700 13px var(--font-nunito), sans-serif", cursor: "pointer", opacity: bezig ? 0.6 : 1 }}>
          Annuleren
        </button>
        <button onClick={bevestig} disabled={bezig} style={{ flex: 1, padding: 11, borderRadius: T.pillRadius, border: "none", background: T.slate, color: "oklch(0.97 0.01 84)", font: "700 13px var(--font-nunito), sans-serif", cursor: "pointer", opacity: bezig ? 0.6 : 1 }}>
          {bezig ? "Bezig..." : "Bevestigen"}
        </button>
      </div>
    </div>
  );
}
