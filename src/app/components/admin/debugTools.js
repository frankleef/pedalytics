"use client";
import { T } from "../../designTokens";
import { SESSIETYPE_LABELS } from "./archetypeAdmin";

export const Kaart = ({ titel, children, style }) => (
  <div style={{ background: T.cardBg, borderRadius: T.cardRadius, padding: "16px 18px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, display: "flex", flexDirection: "column", gap: 2, ...style }}>
    {titel && <span style={{ font: "700 10px var(--font-nunito), sans-serif", letterSpacing: 1, color: "oklch(0.62 0.015 75)", textTransform: "uppercase", marginBottom: 8 }}>{titel}</span>}
    {children}
  </div>
);

export const Rij = ({ label, waarde, kleur }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", font: "600 12.5px var(--font-nunito), sans-serif" }}>
    <span style={{ color: "oklch(0.6 0.012 76)" }}>{label}</span>
    <span style={{ color: kleur || T.text, fontWeight: 700, textAlign: "right" }}>{waarde ?? "—"}</span>
  </div>
);

export const Pill = ({ children }) => (
  <span style={{ background: "oklch(0.965 0.008 84)", borderRadius: 999, padding: "6px 13px", font: "700 11.5px var(--font-nunito), sans-serif", color: T.textSec }}>{children}</span>
);

const LEEG = ({ tekst }) => <p style={{ font: "600 13px var(--font-nunito), sans-serif", color: T.textTert, margin: 0 }}>{tekst}</p>;

const LABEL_SESSIETYPE = (v) => v ? (SESSIETYPE_LABELS[v] || v) : "—";

function DagIntentiePanel({ data }) {
  return (
    <>
      {data.sessietype_afwijking && (
        <div style={{ background: "oklch(0.96 0.03 28)", border: "1.5px solid oklch(0.88 0.06 28)", borderRadius: T.cardRadius, padding: "12px 16px", marginBottom: 14, color: "oklch(0.5 0.13 28)", font: "700 12.5px var(--font-nunito), sans-serif" }}>
          Sessietype-afwijking — gepland was &quot;{LABEL_SESSIETYPE(data.dag_intentie.sessietype)}&quot;, gegenereerd werd &quot;{LABEL_SESSIETYPE(data.gegenereerde_sessie.sessietype)}&quot;.
        </div>
      )}
      {!data.gepland_sessietype_beschikbaar && (
        <div style={{ background: "oklch(0.965 0.008 84)", borderRadius: T.cardRadius, padding: "10px 16px", marginBottom: 14, color: T.textTert, fontSize: 12.5 }}>
          Deze sessie is gegenereerd vóór dat afwijkingen apart bijgehouden werden.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Kaart titel="Dag-intentie">
          <Rij label="Rol" waarde={data.dag_intentie.rol} />
          <Rij label="Sessietype" waarde={LABEL_SESSIETYPE(data.dag_intentie.sessietype)} />
          <Rij label="Toegestane zones" waarde={data.dag_intentie.toegestane_zones?.join(", ")} />
          <Rij label="TSS-range" waarde={data.dag_intentie.tss_range ? `${data.dag_intentie.tss_range.min}–${data.dag_intentie.tss_range.max}` : null} />
          <Rij label="Toelichting" waarde={data.dag_intentie.toelichting} />
        </Kaart>
        <Kaart titel="Gegenereerde sessie">
          {!data.gegenereerde_sessie.archetype_id ? <LEEG tekst="Nog niet gegenereerd." /> : (
            <>
              <Rij label="Sessietype" waarde={LABEL_SESSIETYPE(data.gegenereerde_sessie.sessietype)} kleur={data.sessietype_afwijking ? "oklch(0.5 0.13 28)" : undefined} />
              <Rij label="Archetype" waarde={data.gegenereerde_sessie.archetype_id} />
              <Rij label="Duur / TSS" waarde={data.gegenereerde_sessie.duur_min ? `${data.gegenereerde_sessie.duur_min} min · ${data.gegenereerde_sessie.tss}` : null} />
              <Rij label="Aanleiding" waarde={data.gegenereerde_sessie.aanleiding ?? "niet beschikbaar"} />
            </>
          )}
        </Kaart>
      </div>
      <Kaart titel="Recente archetypes · rotatie op moment van opvragen">
        {data.recente_archetypes_op_moment_van_opvragen.length === 0 ? <LEEG tekst="Geen rotatiedata." /> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data.recente_archetypes_op_moment_van_opvragen.map((id, i) => <Pill key={i}>{id}</Pill>)}
          </div>
        )}
      </Kaart>
    </>
  );
}

function ConditiescoreHistoriePanel({ data }) {
  const rijen = [...(data.data || [])].reverse().slice(0, 20);
  return (
    <>
      <Kaart titel="Drempels" style={{ marginBottom: 14 }}>
        <Rij label="Ramp-rate optimaal" waarde={data.drempels?.ramp_optimaal} />
        <Rij label="CTL-groei" waarde={data.drempels?.ctl_groei} />
        <Rij label="RPE-delta-trend" waarde={data.rpe_delta_trend ?? "onbekend"} />
      </Kaart>
      <Kaart titel={`Historie · laatste ${rijen.length} dagen`}>
        {rijen.length === 0 ? <LEEG tekst="Geen data (minstens 28 dagen wellness nodig)." /> : rijen.map(r => (
          <Rij key={r.datum} label={r.datum} waarde={`CTL ${r.ctl} (Δ${r.ctl_delta ?? "—"}) · ramp ${r.ramp_rate ?? "—"} · score ${r.conditie_score ?? "—"} · ${r.pill_label}`} />
        ))}
      </Kaart>
    </>
  );
}

function HrvSysteemPanel({ data }) {
  const p = data.hrv_profiel, v = data.vandaag, n = data.notificatie;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Kaart titel="HRV-profiel">
          <Rij label="Aanwezig" waarde={p.aanwezig ? "ja" : "nee"} />
          <Rij label="Modus" waarde={p.modus} />
          <Rij label="Betrouwbaar" waarde={p.betrouwbaar ? "ja" : "nee"} />
          <Rij label="Basislijn 28d" waarde={p.basislijn_28d} />
          <Rij label="Rood / geel drempel" waarde={p.rood_drempel != null ? `${p.rood_drempel} / ${p.geel_drempel}` : null} />
          <Rij label="Gepersonaliseerd" waarde={p.gepersonaliseerd ? "ja" : "nee"} />
        </Kaart>
        <Kaart titel="Vandaag">
          <Rij label="HRV-waarde" waarde={v.hrv_waarde} />
          <Rij label="HRV-zone" waarde={v.hrv_zone_puur} />
          <Rij label="Check-in score" waarde={v.check_in_score} />
          <Rij label="Gecombineerde zone" waarde={v.gecombineerde_zone} />
          <Rij label="Sessie vandaag" waarde={v.sessie ? LABEL_SESSIETYPE(v.sessie.sessietype) : "geen"} />
        </Kaart>
      </div>
      <Kaart titel="Notificatiebesluit" style={{ marginBottom: 14 }}>
        <Rij label="Zou sturen" waarde={n.zou_sturen ? "ja" : "nee"} />
        <Rij label="Type" waarde={n.type} />
        <Rij label="Reden" waarde={n.reden} />
        <Rij label="Deze week" waarde={`${n.notificaties_deze_week}/${n.limiet}${n.limiet_bereikt ? " (limiet bereikt)" : ""}`} />
      </Kaart>
      <Kaart titel="Herstelsnelheid per sessietype">
        {(data.herstelsnelheid?.tabel || []).length === 0 ? <LEEG tekst="Geen eigen herstelsnelheid-data." /> : data.herstelsnelheid.tabel.map(r => (
          <Rij key={r.sessietype} label={LABEL_SESSIETYPE(r.sessietype)} waarde={`${r.dagen_gemeten}d · ${r.observaties} obs${r.betrouwbaar ? "" : " (op populatienorm)"}`} />
        ))}
      </Kaart>
    </>
  );
}

function HrvTrendHistoriePanel({ data }) {
  const rijen = [...(data.data || [])].reverse().slice(0, 20);
  return (
    <>
      <Kaart titel="Drempels" style={{ marginBottom: 14 }}>
        <Rij label="Trigger" waarde={data.drempels?.trigger} />
        <Rij label="Licht verlaagd" waarde={data.drempels?.licht_verlaagd} />
        <Rij label="Normaal" waarde={data.drempels?.normaal} />
      </Kaart>
      <Kaart titel={`Trend · laatste ${rijen.length} dagen`}>
        {rijen.length === 0 ? <LEEG tekst="Geen data." /> : rijen.map(r => (
          <Rij key={r.datum} label={r.datum} waarde={`HRV ${r.hrv} · baseline ${r.baseline ?? "—"} · trend ${r.trend ?? "—"}%${r.getriggerd ? " ⚠" : ""}`} kleur={r.getriggerd ? "oklch(0.52 0.13 28)" : undefined} />
        ))}
      </Kaart>
    </>
  );
}

function RpeCheckPanel({ data }) {
  const s = data.samenvatting;
  return (
    <>
      <Kaart titel="Samenvatting" style={{ marginBottom: 14 }}>
        <Rij label="Totaal ritten (365d)" waarde={s.totaal_ritten} />
        <Rij label="Met ICU-RPE" waarde={s.met_icu_rpe} />
        <Rij label="Met HRV én RPE" waarde={s.met_hrv_en_rpe} />
        <Rij label="Betrouwbaar na fix" waarde={s.betrouwbaar_na_fix ? "ja" : "nee"} />
      </Kaart>
      <Kaart titel="Recente observaties met beide">
        {(data.observaties_met_beide || []).length === 0 ? <LEEG tekst="Geen observaties met zowel HRV als RPE." /> : data.observaties_met_beide.map((o, i) => (
          <Rij key={i} label={`${o.datum} · ${o.activiteit_naam}`} waarde={`RPE ${o.icu_rpe} · HRV ${o.hrv}`} />
        ))}
      </Kaart>
    </>
  );
}

function VolumecorrectieLogPanel({ data }) {
  return (
    <>
      <Kaart titel="Wekelijkse volume-evaluaties" style={{ marginBottom: 14 }}>
        {(data.weekLogs || []).length === 0 ? <LEEG tekst="Geen weeklogs." /> : data.weekLogs.map(w => (
          <Rij key={w.weeknummer} label={`Week ${w.weeknummer} · ${w.uitgevoerd?.slice(0, 10)}`} waarde={`${w.richting} ${w.pct ? Math.round(w.pct * 100) + "%" : ""} · TSS ${w.oudTssDoel ?? "—"} → ${w.nieuwTssDoel ?? "—"}`} />
        ))}
      </Kaart>
      <Kaart titel="Blok-checks">
        {(data.blokLogs || []).length === 0 ? <LEEG tekst="Geen blok-logs." /> : data.blokLogs.map(b => (
          <Rij key={b.blokIndex} label={`Blok ${b.blokIndex} · ${b.uitgevoerd?.slice(0, 10)}`} waarde={`${b.richting} ${b.pct ? Math.round(b.pct * 100) + "%" : ""} · basis ${b.oudeBasis ?? "—"} → ${b.nieuweBasis ?? "—"}`} />
        ))}
      </Kaart>
    </>
  );
}

function PosthogTestPanel() {
  return (
    <button
      onClick={async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = "Versturen…";
        try {
          const r = await fetch("/api/debug/posthog-test");
          const d = await r.json();
          btn.textContent = d.success ? "Verstuurd ✓" : (d.error || "Mislukt");
        } catch (err) {
          btn.textContent = err.message;
        } finally {
          btn.disabled = false;
        }
      }}
      style={{ border: "none", borderRadius: 999, background: T.slate, color: "#f7f3eb", padding: "10px 18px", font: "700 13px var(--font-nunito), sans-serif", cursor: "pointer" }}
    >
      Verstuur test-event
    </button>
  );
}

export const DEBUG_TOOLS = [
  { id: "dag-intentie", naam: "Dag-intentie", beschrijving: "Gepland vs. gegenereerd sessietype, archetype, TSS, rotatie.", route: (userId, datum) => `/api/debug/dag-intentie?datum=${datum}&userId=${userId}`, Panel: DagIntentiePanel, needsDatum: true },
  { id: "conditiescore-historie", naam: "Conditiescore-historie", beschrijving: "Verloop conditie-/belastingscore, CTL-ramp, RPE-delta-trend.", route: (userId) => `/api/debug/conditiescore-historie?userId=${userId}`, Panel: ConditiescoreHistoriePanel },
  { id: "hrv-systeem", naam: "HRV-systeem", beschrijving: "HRV-profiel: basislijn, modus, betrouwbaar-vlag, datastatus.", route: (userId) => `/api/debug/hrv-systeem?userId=${userId}`, Panel: HrvSysteemPanel },
  { id: "hrv-trend-historie", naam: "HRV-trend-historie", beschrijving: "7d-vs-28d trend + genomen acties.", route: (userId) => `/api/debug/hrv-trend-historie?userId=${userId}`, Panel: HrvTrendHistoriePanel },
  { id: "rpe-check", naam: "RPE-check", beschrijving: "RPE-delta per rit en afgeleide trend.", route: (userId) => `/api/debug/rpe-check?userId=${userId}`, Panel: RpeCheckPanel },
  { id: "volumecorrectie-log", naam: "Volumecorrectie-log", beschrijving: "Wekelijkse volume-evaluaties + aanpassingen.", route: (userId) => `/api/debug/volumecorrectie-log?userId=${userId}`, Panel: VolumecorrectieLogPanel },
  { id: "posthog-test", naam: "PostHog-test", beschrijving: "Verstuurt test-event; toont of logging werkt.", geenData: true, Panel: PosthogTestPanel },
];
