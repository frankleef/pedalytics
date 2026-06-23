"use client";
import { zoneKleur, T } from "../designTokens";

export default function WorkoutViz({ segmenten, hoogte = 90, ftp, opacity, werkelijkWatts }) {
  if (!segmenten || segmenten.length === 0) return null;

  const ftpW = ftp || 265;
  const maxScale = 130;
  const ftpLineBottom = (100 / maxScale) * 100;

  const totaalMin = segmenten.reduce((s, seg) => s + (seg.duur_min || 0), 0);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", height: hoogte, gap: 1.5, borderRadius: 6, overflow: "hidden", opacity: opacity ?? 1 }}>
      <div style={{ position: "absolute", bottom: `${ftpLineBottom}%`, left: 0, right: 0, borderTop: `1.5px dashed oklch(0.6 0.02 75)`, zIndex: 2 }}>
        <span style={{ position: "absolute", right: 0, top: -8, font: "700 9px var(--font-nunito), sans-serif", color: T.textTert, background: T.subtleFill, padding: "1px 5px", borderRadius: 4 }}>FTP {ftpW}W</span>
      </div>

      {segmenten.map((seg, i) => {
        const midPct = seg.vermogenMin != null && seg.vermogenMax != null
          ? (seg.vermogenMin + seg.vermogenMax) / 2
          : 50;
        const hPct = Math.max(6, (midPct / maxScale) * 100);
        const kleur = zoneKleur(midPct);
        const isWarmupCooldown = seg.type === "warmup" || seg.type === "cooldown";
        const wattLabel = seg.vermogenMin != null && seg.vermogenMax != null
          ? `${Math.round(seg.vermogenMin * ftpW / 100)}-${Math.round(seg.vermogenMax * ftpW / 100)}W`
          : `${Math.round(midPct * ftpW / 100)}W`;

        return (
          <div key={i} style={{ flexGrow: seg.duur_min || 1, flexBasis: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
            title={`${seg.label || seg.type} · ${seg.duur_min}min · ${wattLabel}`}>
            <div style={{
              height: `${hPct}%`,
              background: isWarmupCooldown
                ? `linear-gradient(to ${seg.type === "warmup" ? "top" : "bottom"}, ${kleur}30, ${kleur})`
                : kleur,
              borderRadius: "3px 3px 1px 1px",
              minWidth: 3,
            }} />
          </div>
        );
      })}

      {werkelijkWatts && werkelijkWatts.length > 0 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 3, overflow: "visible" }}>
          <polyline
            points={werkelijkWatts.map((w, i) => {
              const x = (i / (werkelijkWatts.length - 1)) * 100;
              const pct = (w / ftpW) * 100;
              const y = 100 - Math.min(100, (pct / maxScale) * 100);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ")}
            fill="none" stroke="oklch(0.3 0.02 70)" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}

export function WerkelijkViz({ watts, ftp, hoogte = 170 }) {
  if (!watts || watts.length < 10) return null;

  const ftpW = ftp || 265;
  const maxScale = 130;
  const ftpLineBottom = (100 / maxScale) * 100;

  const bucketSize = Math.max(1, Math.floor(watts.length / 60));
  const buckets = [];
  for (let i = 0; i < watts.length; i += bucketSize) {
    const slice = watts.slice(i, i + bucketSize);
    const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
    buckets.push(avg);
  }

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", height: hoogte, gap: 1, borderRadius: 6, overflow: "hidden" }}>
      <div style={{ position: "absolute", bottom: `${ftpLineBottom}%`, left: 0, right: 0, borderTop: `1.5px dashed oklch(0.6 0.02 75)`, zIndex: 2 }}>
        <span style={{ position: "absolute", right: 0, top: -8, font: "700 9px var(--font-nunito), sans-serif", color: T.textTert, background: T.subtleFill, padding: "1px 5px", borderRadius: 4 }}>FTP {ftpW}W</span>
      </div>
      {buckets.map((w, i) => {
        const pct = (w / ftpW) * 100;
        const hPct = Math.max(3, Math.min(100, (pct / maxScale) * 100));
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
            <div style={{ height: `${hPct}%`, background: zoneKleur(pct), borderRadius: "2px 2px 0 0", minWidth: 2 }} />
          </div>
        );
      })}
    </div>
  );
}
