// Segmenten → ZWO (Zwift Workout XML) voor intervals.icu upload.
// SteadyState krijgt PowerLow/PowerHigh (onze ±5% range).
// IntervalsT (herhaalde sets) krijgt OnPower/OffPower (midpoint, range niet ondersteund in ZWO repeats).

export function segmentenNaarZwo(segmenten, naam, ftpW = 265) {
  if (!segmenten || segmenten.length === 0) return null;

  const main = segmenten.filter(s => s.type !== "warmup" && s.type !== "cooldown");
  if (main.length === 0) return null;

  const groups = detecteerRepeats(main);
  const stappen = groups.map(g => groepNaarZwo(g, ftpW)).join("\n    ");

  return `<workout_file>
  <author>Kesto</author>
  <name>${escXml(naam || "Workout")}</name>
  <sportType>bike</sportType>
  <workout>
    ${stappen}
  </workout>
</workout_file>`;
}

function detecteerRepeats(segs) {
  const sigKey = (s) => `${s.type}:${s.vermogenMin}:${s.vermogenMax}:${s.blokDuurSeconden || s.duur_min}`;
  const patSig = (arr, start, len) => arr.slice(start, start + len).map(sigKey).join("|");

  const groups = [];
  let i = 0;
  while (i < segs.length) {
    let found = false;
    for (let patLen = Math.min(5, Math.floor((segs.length - i) / 2)); patLen >= 1; patLen--) {
      const sig = patSig(segs, i, patLen);
      let reps = 1;
      while (i + reps * patLen + patLen <= segs.length && patSig(segs, i + reps * patLen, patLen) === sig) reps++;
      if (reps >= 2) {
        groups.push({ reps, segments: segs.slice(i, i + patLen) });
        i += reps * patLen;
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ reps: 1, segments: [segs[i]] });
      i++;
    }
  }
  return groups;
}

function groepNaarZwo(group, ftpW) {
  if (group.reps > 1 && group.segments.length === 2) {
    const on = group.segments[0];
    const off = group.segments[1];
    const onDur = on.blokDuurSeconden || (on.duur_min || 1) * 60;
    const offDur = off.blokDuurSeconden || (off.duur_min || 1) * 60;
    const onPower = midpoint(on, ftpW);
    const offPower = midpoint(off, ftpW);
    return `<IntervalsT Repeat="${group.reps}" OnDuration="${onDur}" OnPower="${onPower}" OffDuration="${offDur}" OffPower="${offPower}" />`;
  }

  if (group.reps > 1) {
    const steps = group.segments.map(s => `      ${steadyState(s, ftpW)}`).join("\n");
    return `<!-- ${group.reps}x herhaald -->\n${Array(group.reps).fill(steps).join("\n")}`;
  }

  return steadyState(group.segments[0], ftpW);
}

function steadyState(seg, ftpW) {
  const dur = seg.blokDuurSeconden || (seg.duur_min || 1) * 60;
  const low = toFtpFractie(seg.vermogenMin ?? 50, seg.eenheid, ftpW);
  const high = toFtpFractie(seg.vermogenMax ?? 75, seg.eenheid, ftpW);
  const cadansAttr = seg.cadans_rpm
    ? ` cadence="${Math.round((seg.cadans_rpm.min + seg.cadans_rpm.max) / 2 || seg.cadans_rpm.max || 53)}"`
    : (seg.cadansMin ? ` cadence="${Math.round((seg.cadansMin + seg.cadansMax) / 2)}"` : "");
  return `<SteadyState Duration="${dur}" PowerLow="${low}" PowerHigh="${high}"${cadansAttr} />`;
}

function toFtpFractie(waarde, eenheid, ftpW = 265) {
  if (eenheid === "watts") return +(waarde / ftpW).toFixed(3);
  return waarde / 100;
}

function midpoint(seg, ftpW) {
  const min = toFtpFractie(seg.vermogenMin || 50, seg.eenheid, ftpW);
  const max = toFtpFractie(seg.vermogenMax || 75, seg.eenheid, ftpW);
  return ((min + max) / 2).toFixed(3);
}

function escXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Sectie 51-B-I: ramp_test is het eerste sessietype dat in absolute watts is
// gedefinieerd (start 100W, +20W/min) i.p.v. pct_ftp-relatief — alle andere
// sessietypes lopen via segmentenNaarZwo() hierboven, ongewijzigd. ZWO's
// Power-attribuut is altijd een FTP-fractie, dus elke stap wordt hier omgerekend
// t.o.v. de FTP die de caller meegeeft (huidige intervals.icu-FTP, geen
// hardcoded waarde).
//
// ZWO kent geen "ga door tot falen"-eindconditie: we genereren stappen ruim
// voorbij een fysiologisch plausibel maximum (520W) zodat de rijder in de
// praktijk altijd eerder stopt en de workout zelf op het apparaat beëindigt —
// gangbare aanpak bij custom ramp-test-ZWO's.
const RAMP_TEST_MAX_WATT = 520;

export function rampTestNaarZwo(protocol, naam, ftpW = 265) {
  if (!protocol) return null;
  const { warmup, ramp, cooldown } = protocol;

  const warmupDuur = (warmup?.duur_min ?? 5) * 60;
  const cooldownDuur = (cooldown?.duur_min ?? 5) * 60;
  const startWatt = ramp?.start_watt ?? 100;
  const stapWatt = ramp?.increment_watt_per_min ?? 20;

  const stappen = [];
  for (let watt = startWatt; watt <= RAMP_TEST_MAX_WATT; watt += stapWatt) {
    const fractie = +(watt / ftpW).toFixed(3);
    stappen.push(`    <SteadyState Duration="60" Power="${fractie}" pace="0" />`);
  }

  return `<workout_file>
  <author>Kesto</author>
  <name>${escXml(naam || "Ramp Test")}</name>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="${warmupDuur}" PowerLow="0.5" PowerHigh="0.7" />
${stappen.join("\n")}
    <Cooldown Duration="${cooldownDuur}" PowerLow="0.5" PowerHigh="0.3" />
  </workout>
</workout_file>`;
}

/**
 * Sessie → ZWO, met een aparte tak voor ramp_test (protocol-object, absolute
 * watts) naast het bestaande segmenten-pad (pct_ftp-relatief). Alle bestaande
 * callers van segmentenNaarZwo() kunnen hiernaar overstappen zonder gedragswijziging
 * voor niet-ramp_test-sessies.
 */
export function sessieNaarZwo(sessie, ftpW = 265) {
  if (sessie?.protocol) return rampTestNaarZwo(sessie.protocol, sessie.titel, ftpW);
  return segmentenNaarZwo(sessie?.segmenten, sessie?.titel, ftpW);
}
