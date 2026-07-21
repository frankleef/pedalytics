"use client";
import { useState, useEffect, useCallback } from "react";
import { T } from "../../designTokens";
import { vandaagISO } from "@/lib/datum";
import SporterPicker from "../../components/admin/SporterPicker";

const CARD = { background: T.cardBg, borderRadius: T.cardRadius, padding: "18px 20px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}` };
const EYEBROW = { font: "700 10.5px var(--font-nunito), sans-serif", letterSpacing: 1.3, color: "oklch(0.62 0.015 75)", textTransform: "uppercase", display: "block" };
const KNOP_PRIMAIR = { border: "none", borderRadius: 999, background: T.slate, color: "#f7f3eb", padding: "9px 16px", font: "700 12.5px var(--font-nunito), sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const KNOP_SEC = { border: `1.5px solid ${T.cardBorder}`, borderRadius: 999, background: T.cardBg, color: T.textSec, padding: "7px 13px", font: "700 12px var(--font-nunito), sans-serif", cursor: "pointer", whiteSpace: "nowrap" };

function StatusChip({ status }) {
  const styles = {
    geslaagd: { bg: T.accentBg, fg: T.accentText, label: "Geslaagd" },
    let_op: { bg: "oklch(0.96 0.03 90)", fg: "oklch(0.5 0.1 80)", label: "Let op" },
    mislukt: { bg: "oklch(0.96 0.03 28)", fg: "oklch(0.52 0.13 28)", label: "Mislukt" },
    done: { bg: T.accentBg, fg: T.accentText, label: "Klaar" },
    failed: { bg: "oklch(0.96 0.03 28)", fg: "oklch(0.52 0.13 28)", label: "Mislukt" },
    onbekend: { bg: "oklch(0.96 0.006 84)", fg: T.textTert, label: "Nog nooit gedraaid" },
  };
  const s = styles[status] || styles.onbekend;
  return <span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: "3px 10px", font: "800 11px var(--font-nunito), sans-serif" }}>{s.label}</span>;
}

function formatDuur(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function formatTijd(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CRON_CONFIG = [
  { naam: "morning", label: "Ochtend-routine", route: "POST /api/cron/morning", schema: "dagelijks ~06:00", beschrijving: "check-in-push, HRV-dagnotificatie, HRV-trendcheck per actieve sporter" },
  { naam: "sync", label: "Intervals-sync", route: "POST /api/cron/sync", schema: "elk uur", beschrijving: "nieuwe ritten ophalen; sessie afronden + uitvoeringsscore; conditiescore; decoupling; RPE-trend; FTP-sync; fase-overgang; volume-evaluatie" },
  { naam: "sessies-aanvullen", label: "Sessies aanvullen", route: "POST /api/cron/sessies-aanvullen", schema: "dagelijks ~03:00", beschrijving: "vulSessiesAanVoorGebruiker per sporter tot de horizon" },
  { naam: "review", label: "Periodieke AI-review", route: "POST /api/cron/review", schema: "2x/dag (extern via QStash, niet in deze repo geconfigureerd)", beschrijving: "verzamelReviewContext + Claude-voorstel + valideerReviewVoorstel per actieve sporter; geaccepteerde voorstellen naar review_voorstel:{userId}" },
];

const ONDERHOUD_GROEPEN = [
  {
    groep: "Herberekeningen — alle sporters",
    acties: [
      { actie: "herbereken-sessies", label: "Herbereken sessies", scope: "alle sporters", beschrijving: "Toekomstige sessies opnieuw genereren met de huidige methode.", confirm: true },
      { actie: "rond-sessieduren-af", label: "Rond sessieduren af", scope: "alle sporters", beschrijving: "Blokken naar hele minuten en sessieduur naar een veelvoud van 5 min afronden, zonder de sessie zelf opnieuw te genereren.", confirm: true },
      { actie: "herbereken-conditiescore", label: "Herbereken conditiescore", scope: "alle sporters", beschrijving: "Conditie-/belastingscore opnieuw berekenen.", confirm: true },
      { actie: "herbereken-fitnessprogressie", label: "Herbereken fitnessprogressie", scope: "alle sporters", beschrijving: "CTL-/decoupling-trend (los van de dagelijkse conditiescore) opnieuw berekenen en naar fitnessprogressie:{userId} wegschrijven.", confirm: true },
      { actie: "herbereken-hrv-profiel", label: "Herbereken HRV-profiel", scope: "alle sporters", beschrijving: "HRV-basislijn en drempels opnieuw berekenen.", confirm: true },
      { actie: "herbereken-rpe-gisteren", label: "Herbereken RPE gisteren", scope: "alle sporters", beschrijving: "Verwacht-RPE en RPE-delta van gisteren herberekenen.", confirm: true },
    ],
  },
  {
    groep: "Regeneratie — per sporter",
    acties: [
      { actie: "regenereer-toekomstige-sessies", label: "Regenereer toekomstige sessies", scope: "per sporter", perSporter: true, beschrijving: "Toekomstige sessies van de gekozen sporter opnieuw genereren." },
      { actie: "reset-en-regenereer", label: "Reset & regenereer", scope: "per sporter · destructief", perSporter: true, confirm: true, beschrijving: "Wist niet-voltooide toekomstige sessies + Intervals-events, draait daarna volumecorrectie + aanvullen." },
    ],
  },
  {
    groep: "Migraties — eenmalig",
    acties: [
      { actie: "migreer-16-weken", label: "Migreer naar 16 weken", scope: "eenmalig", confirm: true, beschrijving: "Herschrijft het seizoensplan naar het 16-weken-formaat." },
      { actie: "migreer-archetypes-naar-kv", label: "Migreer archetypes naar KV", scope: "eenmalig", confirm: true, direct: true, beschrijving: "Voegt sessie-archetypes.js en sessie-varianten.js samen naar KV." },
    ],
  },
  {
    groep: "Test & overig — per sporter",
    acties: [
      { actie: "test-volumecorrectie", label: "Test volumecorrectie", scope: "per sporter · dry-run", perSporter: true, beschrijving: "Draait vulSessiesAanVoorGebruiker zonder iets op te slaan." },
      { actie: "sprint-staartje-activeer", label: "Sprint-staartje activeren", scope: "per sporter + datum", perSporter: true, needsDatum: true, beschrijving: "Voegt sprint-staartjes toe aan de sessie op de gekozen datum." },
    ],
  },
];

function CronCard({ config, status, onDraaien, bezig }) {
  const s = status || {};
  return (
    <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ font: "800 15px var(--font-nunito), sans-serif", color: "oklch(0.32 0.012 66)" }}>{config.label}</span>
          <StatusChip status={s.status || "onbekend"} />
        </div>
        <span style={{ font: "600 12px var(--font-mono, monospace)", color: "oklch(0.6 0.012 76)" }}>{config.route}</span>
        <p style={{ margin: "2px 0 0", font: "500 12.5px/1.5 var(--font-nunito), sans-serif", color: "oklch(0.5 0.012 74)", maxWidth: 520 }}>{config.beschrijving}</p>
      </div>
      <div style={{ display: "flex", gap: 24, flex: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ font: "700 9.5px var(--font-nunito), sans-serif", letterSpacing: 0.6, color: "oklch(0.66 0.012 78)", textTransform: "uppercase" }}>Schema</span>
          <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: "oklch(0.38 0.012 70)" }}>{config.schema}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ font: "700 9.5px var(--font-nunito), sans-serif", letterSpacing: 0.6, color: "oklch(0.66 0.012 78)", textTransform: "uppercase" }}>Laatste run</span>
          <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: "oklch(0.38 0.012 70)" }}>{formatTijd(s.startedAt)} · {formatDuur(s.durationMs)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ font: "700 9.5px var(--font-nunito), sans-serif", letterSpacing: 0.6, color: "oklch(0.66 0.012 78)", textTransform: "uppercase" }}>Verwerkt</span>
          <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: "oklch(0.38 0.012 70)" }}>{s.verwerkt ?? "—"}</span>
        </div>
      </div>
      <button onClick={onDraaien} disabled={bezig} style={{ ...KNOP_PRIMAIR, opacity: bezig ? 0.6 : 1 }}>
        {bezig ? "Bezig…" : "Nu draaien"}
      </button>
    </div>
  );
}

export default function JobsEnCron() {
  const [cronStatus, setCronStatus] = useState(null);
  const [cronBezig, setCronBezig] = useState(null);
  const [genJobs, setGenJobs] = useState(null);
  const [genJobsFout, setGenJobsFout] = useState(null);
  const [sporterId, setSporterId] = useState("");
  const [datum, setDatum] = useState(() => vandaagISO());
  const [actieBezig, setActieBezig] = useState(null);
  const [actieResultaat, setActieResultaat] = useState({});

  const laadCronStatus = useCallback(() => {
    fetch("/api/admin/cron-status").then(r => r.json()).then(d => { if (d.success) setCronStatus(d.data); });
  }, []);
  const laadGenJobs = useCallback(() => {
    fetch("/api/admin/jobs?limit=50").then(r => r.json()).then(d => {
      if (d.success) setGenJobs(d.data); else setGenJobsFout(d.error || "Laden mislukt");
    }).catch(e => setGenJobsFout(e.message));
  }, []);

  useEffect(() => { laadCronStatus(); laadGenJobs(); }, [laadCronStatus, laadGenJobs]);

  async function draaiCronNu(naam) {
    setCronBezig(naam);
    try {
      await fetch("/api/admin/trigger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie: `cron-${naam}` }),
      });
      laadCronStatus();
      laadGenJobs();
    } finally {
      setCronBezig(null);
    }
  }

  async function voerActieUit(actieConfig) {
    if (actieConfig.confirm && !confirm(`"${actieConfig.label}" (${actieConfig.scope}) uitvoeren?`)) return;
    if (actieConfig.perSporter && !sporterId) { alert("Kies eerst een sporter."); return; }

    setActieBezig(actieConfig.actie);
    try {
      let resp;
      if (actieConfig.direct) {
        resp = await fetch(`/api/admin/${actieConfig.actie}`, { method: "POST" });
      } else {
        resp = await fetch("/api/admin/trigger", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actie: actieConfig.actie, userId: actieConfig.perSporter ? sporterId : undefined, datum: actieConfig.needsDatum ? datum : undefined }),
        });
      }
      const data = await resp.json().catch(() => ({ error: "Ongeldig antwoord" }));
      setActieResultaat(prev => ({ ...prev, [actieConfig.actie]: data }));
      laadGenJobs();
    } catch (e) {
      setActieResultaat(prev => ({ ...prev, [actieConfig.actie]: { error: e.message } }));
    } finally {
      setActieBezig(null);
    }
  }

  const perSporterActies = ONDERHOUD_GROEPEN.some(g => g.acties.some(a => a.perSporter));

  return (
    <div style={{ padding: "24px 30px 40px", display: "flex", flexDirection: "column", gap: 26, font: "600 14px var(--font-nunito), sans-serif", color: T.text }}>

      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <span style={EYEBROW}>Geplande taken · cron via QStash</span>
        {CRON_CONFIG.map(c => (
          <CronCard key={c.naam} config={c} status={cronStatus?.[c.naam]} onDraaien={() => draaiCronNu(c.naam)} bezig={cronBezig === c.naam} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={EYEBROW}>Generatietaken · queue (genjob)</span>
          <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: "oklch(0.58 0.012 74)" }}>TTL 5 min — oudere jobs verdwijnen uit de lijst</span>
        </div>
        <div style={{ ...CARD, padding: 0, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 110px 100px 1fr 70px 100px", gap: 14, padding: "11px 18px", minWidth: 640, background: "oklch(0.97 0.008 86)", borderBottom: `1px solid ${T.cardBorder}`, font: "700 9.5px var(--font-nunito), sans-serif", letterSpacing: 0.7, color: "oklch(0.6 0.012 76)", textTransform: "uppercase" }}>
            <span>Job-id</span><span>Type</span><span>Sporter</span><span>Resultaat</span><span>Duur</span><span>Tijd</span>
          </div>
          {genJobsFout && <div style={{ padding: 16, color: "#dc2626", fontSize: 13 }}>{genJobsFout}</div>}
          {genJobs && genJobs.length === 0 && <div style={{ padding: 16, color: T.textTert, fontSize: 13 }}>Geen recente jobs.</div>}
          {!genJobs && !genJobsFout && <div style={{ padding: 16, color: T.textTert, fontSize: 13 }}>Laden…</div>}
          {genJobs?.map((j, i) => (
            <div key={j.jobId} style={{ display: "grid", gridTemplateColumns: "160px 110px 100px 1fr 70px 100px", gap: 14, padding: "12px 18px", minWidth: 640, borderBottom: i < genJobs.length - 1 ? `1px solid ${T.divider}` : "none", alignItems: "center" }}>
              <span style={{ font: "600 11.5px var(--font-mono, monospace)", color: "oklch(0.55 0.012 74)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.jobId}</span>
              <span style={{ font: "700 11.5px var(--font-nunito), sans-serif", color: "oklch(0.5 0.06 250)" }}>{j.type}</span>
              <span style={{ font: "600 12.5px var(--font-nunito), sans-serif", color: T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.userId || "—"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusChip status={j.status} />
                <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {j.status === "failed" ? j.error : (j.result?.titel ? `${j.result.titel} · TSS ${j.result.tss ?? "—"}` : "")}
                </span>
              </div>
              <span style={{ font: "600 11.5px var(--font-mono, monospace)", color: "oklch(0.55 0.012 74)" }}>{formatDuur(j.durationMs)}</span>
              <span style={{ font: "600 11.5px var(--font-mono, monospace)", color: "oklch(0.6 0.012 76)" }}>{formatTijd(j.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={EYEBROW}>Onderhoud & migraties · handmatige acties</span>
          {perSporterActies && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ font: "600 12px var(--font-nunito), sans-serif", color: T.textSec }}>Sporter voor per-sporter-acties:</span>
              <SporterPicker value={sporterId} onChange={setSporterId} />
            </div>
          )}
        </div>
        <div className="admin-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {ONDERHOUD_GROEPEN.map(grp => (
            <div key={grp.groep} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ font: "800 13.5px var(--font-nunito), sans-serif", color: "oklch(0.34 0.012 66)" }}>{grp.groep}</span>
              {grp.acties.map(a => {
                const resultaat = actieResultaat[a.actie];
                return (
                  <div key={a.actie} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ font: "700 13px var(--font-nunito), sans-serif", color: "oklch(0.34 0.012 66)" }}>{a.label}</span>
                          <span style={{ font: "700 10px var(--font-mono, monospace)", color: "oklch(0.6 0.012 76)", background: "oklch(0.96 0.006 84)", padding: "2px 8px", borderRadius: 999 }}>{a.scope}</span>
                        </div>
                        <p style={{ margin: 0, font: "500 12px/1.45 var(--font-nunito), sans-serif", color: "oklch(0.52 0.012 74)" }}>{a.beschrijving}</p>
                        {a.needsDatum && (
                          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={{ marginTop: 4, border: `1.5px solid ${T.cardBorder}`, borderRadius: 10, padding: "6px 10px", font: "700 12px var(--font-nunito), sans-serif", color: T.text, background: T.cardBg, width: 150 }} />
                        )}
                      </div>
                      <button onClick={() => voerActieUit(a)} disabled={actieBezig === a.actie} style={{ ...KNOP_SEC, flex: "none", opacity: actieBezig === a.actie ? 0.6 : 1 }}>
                        {actieBezig === a.actie ? "…" : "Draaien"}
                      </button>
                    </div>
                    {resultaat && (
                      <pre style={{ margin: 0, background: "oklch(0.97 0.006 84)", borderRadius: 10, padding: "8px 10px", fontSize: 11, color: T.textSec, overflowX: "auto", maxHeight: 160 }}>
                        {JSON.stringify(resultaat, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
