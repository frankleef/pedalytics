// ZWO-bestand (Zwift workout XML) → blok-formaat compatibel met sessie-varianten.js.
// Pure functie, geen I/O. Zie sectie archetype-admin.

import { afleidZonePositie } from "../migratie/afleidZonePositie";

// Onder deze FTP-fractie is een blok herstel, erboven werk. sessie-varianten.js
// gebruikt consequent pct_ftp: 63 voor herstelblokken — 0.60 ligt daar net onder
// en blijft binnen de Z2-bandbreedte (55-75%), dus geen tegenstrijdige drempel.
const HERSTEL_DREMPEL_FRACTIE = 0.60;

const ONDERSTEUNDE_STAP_ELEMENTEN = new Set([
  "SteadyState", "IntervalsT", "FreeRide", "Ramp", "Warmup", "Cooldown",
]);

function parseAttributen(attrString) {
  const attrs = {};
  const re = /([\w:]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(attrString))) attrs[m[1]] = m[2];
  return attrs;
}

function bouwBlok({ type, powerFractie, duurSec, reps }) {
  const pctFtp = Math.round(powerFractie * 100);
  const { zone } = afleidZonePositie(pctFtp, pctFtp);
  const blok = { type, zone, pct_ftp: pctFtp, duurSec };
  if (reps && reps > 1) blok.reps = reps;
  return blok;
}

function bepaalType(powerFractie) {
  return powerFractie < HERSTEL_DREMPEL_FRACTIE ? "herstel" : "werk";
}

/**
 * Parseert een ZWO-bestand (Zwift workout XML) naar het blok-formaat dat de
 * archetype-builder gebruikt.
 *
 * @param {string} xmlString
 * @returns {{ naam: string|null, blokken: Array, waarschuwingen: string[] }}
 */
export function parseZwo(xmlString) {
  const waarschuwingen = [];

  if (!xmlString || typeof xmlString !== "string" || !xmlString.trim()) {
    return { naam: null, blokken: [], waarschuwingen: ["Leeg of ontbrekend ZWO-bestand"] };
  }

  const naamMatch = xmlString.match(/<name>([^<]*)<\/name>/i);
  const naam = naamMatch ? naamMatch[1].trim() : null;

  const workoutMatch = xmlString.match(/<workout>([\s\S]*?)<\/workout>/i);
  if (!workoutMatch) {
    return { naam, blokken: [], waarschuwingen: ["Geen <workout>-element gevonden — ongeldig ZWO-bestand"] };
  }
  const workoutBody = workoutMatch[1];

  // Top-level stapelementen: <Tag attr="val" .../> — ZWO-stappen zijn altijd self-closing.
  const stapRegex = /<([A-Za-z_][\w:]*)\b([^>]*?)\/?>/g;
  const ruweStappen = [];
  let m;
  while ((m = stapRegex.exec(workoutBody))) {
    ruweStappen.push({ tag: m[1], attrs: parseAttributen(m[2]) });
  }

  const blokken = [];
  for (const { tag, attrs } of ruweStappen) {
    if (!ONDERSTEUNDE_STAP_ELEMENTEN.has(tag)) {
      waarschuwingen.push(`Onbekend element "${tag}" overgeslagen`);
      continue;
    }

    if (tag === "SteadyState") {
      const duurSec = Number(attrs.Duration);
      const power = Number(attrs.Power);
      if (!Number.isFinite(duurSec) || !Number.isFinite(power)) {
        waarschuwingen.push(`SteadyState met ontbrekende/ongeldige Duration of Power overgeslagen`);
        continue;
      }
      blokken.push(bouwBlok({ type: bepaalType(power), powerFractie: power, duurSec }));
    } else if (tag === "IntervalsT") {
      const reps = Number(attrs.Repeat);
      const onDuur = Number(attrs.OnDuration);
      const onPower = Number(attrs.OnPower);
      const offDuur = Number(attrs.OffDuration);
      const offPower = Number(attrs.OffPower);
      if (![reps, onDuur, onPower, offDuur, offPower].every(Number.isFinite)) {
        waarschuwingen.push(`IntervalsT met ontbrekende/ongeldige attributen overgeslagen`);
        continue;
      }
      blokken.push(bouwBlok({ type: bepaalType(onPower), powerFractie: onPower, duurSec: onDuur, reps }));
      blokken.push(bouwBlok({ type: bepaalType(offPower), powerFractie: offPower, duurSec: offDuur, reps }));
    } else if (tag === "Warmup" || tag === "Cooldown") {
      const duurSec = Number(attrs.Duration);
      const laag = Number(attrs.PowerLow);
      const hoog = Number(attrs.PowerHigh);
      if (!Number.isFinite(duurSec) || !Number.isFinite(laag) || !Number.isFinite(hoog)) {
        waarschuwingen.push(`${tag} met ontbrekende/ongeldige attributen overgeslagen`);
        continue;
      }
      const gemPower = (laag + hoog) / 2;
      waarschuwingen.push(`${tag} benaderd als vlak blok op het gemiddelde vermogen (${Math.round(gemPower * 100)}% FTP) — de oplopende/aflopende Ramp gaat verloren in dit blok-formaat`);
      blokken.push(bouwBlok({ type: bepaalType(gemPower), powerFractie: gemPower, duurSec }));
    } else {
      // FreeRide, Ramp: geen vast vermogen (of geen vermogen-instructie) — niet
      // representeerbaar in het pct_ftp-gebaseerde blok-formaat.
      waarschuwingen.push(`${tag}-element wordt niet ondersteund (geen vast doelvermogen) — overgeslagen`);
    }
  }

  if (blokken.length === 0) {
    waarschuwingen.push("Geen bruikbare blokken gevonden in dit ZWO-bestand");
    return { naam, blokken: [], waarschuwingen };
  }

  const totaalSec = blokken.reduce((s, b) => s + b.duurSec * (b.reps ?? 1), 0);
  const blokkenMetPct = blokken.map(({ duurSec, ...rest }) => ({
    ...rest,
    duur_pct: totaalSec > 0 ? duurSec / totaalSec : 0,
    duurSec, // referentie-duur in seconden zoals in het brondocument — handig voor de builder-preview
  }));

  return { naam, blokken: blokkenMetPct, waarschuwingen };
}
