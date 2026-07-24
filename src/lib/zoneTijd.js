// Zet ruwe zonetijden (rechtstreeks van intervals.icu, per rit) en geplande
// segmenten om naar rijen voor de "Tijd per zone"-kaart. Zonegrenzen (%FTP)
// komen bij voorkeur uit het live intervals.icu-profiel (power_zones) — dat
// zijn de zones waarmee intervals.icu de rit zelf al heeft ingedeeld. Zonder
// eigen configuratie vallen we terug op de Coggan-standaardgrenzen (vgl.
// zoneKleur in designTokens.js).

const NL_ZONE_NAMEN = {
  "Active Recovery": "Herstel", "Endurance": "Duur", "Tempo": "Tempo",
  "Threshold": "Drempel", "VO2 Max": "VO2max", "Anaerobic": "Anaeroob",
  "Neuromuscular": "Neuromusculair",
};

const STANDAARD_ZONEGRENZEN = [55, 75, 90, 105, 120, 150];
const ZONE_AANTAL = 7;

export function zoneNaam(idx, powerZoneNames) {
  const raw = powerZoneNames?.[idx];
  if (!raw) return `Zone ${idx + 1}`;
  return NL_ZONE_NAMEN[raw] || raw;
}

export function zoneIndexVoorPct(pct, powerZones) {
  const grenzen = powerZones?.length ? powerZones : STANDAARD_ZONEGRENZEN;
  for (let i = 0; i < grenzen.length; i++) {
    if (pct <= grenzen[i]) return i;
  }
  return grenzen.length;
}

export function fmtZoneTijd(minuten) {
  const t = Math.round(minuten);
  if (t < 60) return `${t}m`;
  const h = Math.floor(t / 60), r = t % 60;
  return `${h}u${r ? ` ${r}m` : ""}`;
}

// zoneSecs: {Z1: secs, Z2: secs, ...} — live opgehaald per rit uit intervals.icu
// plannedItems: optioneel [{ pct, minuten }], afgeleid van de sessie-segmenten
export function bouwZoneRijen({ zoneSecs, plannedItems, powerZones, powerZoneNames, kleuren }) {
  const actual = Array(ZONE_AANTAL).fill(0);
  Object.entries(zoneSecs || {}).forEach(([id, secs]) => {
    const idx = parseInt(id.slice(1), 10) - 1;
    if (idx >= 0 && idx < ZONE_AANTAL) actual[idx] += (secs || 0) / 60;
  });

  const planned = Array(ZONE_AANTAL).fill(0);
  (plannedItems || []).forEach(({ pct, minuten }) => {
    const idx = zoneIndexVoorPct(pct, powerZones);
    if (idx < ZONE_AANTAL) planned[idx] += minuten;
  });

  const max = Math.max(1, ...actual, ...planned);
  const rows = [];
  for (let i = 0; i < ZONE_AANTAL; i++) {
    if (actual[i] < 0.5 && planned[i] < 0.5) continue;
    rows.push({
      n: i + 1,
      label: zoneNaam(i, powerZoneNames),
      color: kleuren?.[i] || kleuren?.[kleuren.length - 1],
      actTime: fmtZoneTijd(actual[i]),
      planTime: fmtZoneTijd(planned[i]),
      actPct: `${Math.round((actual[i] / max) * 100)}%`,
      planPct: `${Math.round((planned[i] / max) * 100)}%`,
    });
  }
  return rows;
}
