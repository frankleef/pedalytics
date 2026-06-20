// Segmenten → ZWO (Zwift Workout XML) voor intervals.icu upload.
// SteadyState krijgt PowerLow/PowerHigh (onze ±5% range).
// IntervalsT (herhaalde sets) krijgt OnPower/OffPower (midpoint, range niet ondersteund in ZWO repeats).

export function segmentenNaarZwo(segmenten, naam) {
  if (!segmenten || segmenten.length === 0) return null;

  const main = segmenten.filter(s => s.type !== "warmup" && s.type !== "cooldown");
  if (main.length === 0) return null;

  const groups = detecteerRepeats(main);
  const stappen = groups.map(groepNaarZwo).join("\n    ");

  return `<workout_file>
  <author>Pedalytics</author>
  <name>${escXml(naam || "Workout")}</name>
  <sportType>bike</sportType>
  <workout>
    ${stappen}
  </workout>
</workout_file>`;
}

function detecteerRepeats(segs) {
  const sigKey = (s) => `${s.type}:${s.vermogenMin}:${s.vermogenMax}:${s.duur_min}`;
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

function groepNaarZwo(group) {
  if (group.reps > 1 && group.segments.length === 2) {
    const on = group.segments[0];
    const off = group.segments[1];
    const onPower = midpoint(on);
    const offPower = midpoint(off);
    return `<IntervalsT Repeat="${group.reps}" OnDuration="${on.duur_min * 60}" OnPower="${onPower}" OffDuration="${off.duur_min * 60}" OffPower="${offPower}" />`;
  }

  if (group.reps > 1) {
    const steps = group.segments.map(s => `      ${steadyState(s)}`).join("\n");
    return `<!-- ${group.reps}x herhaald -->\n${Array(group.reps).fill(steps).join("\n")}`;
  }

  return steadyState(group.segments[0]);
}

function steadyState(seg) {
  const dur = (seg.duur_min || 1) * 60;
  const low = (seg.vermogenMin || 50) / 100;
  const high = (seg.vermogenMax || 75) / 100;
  return `<SteadyState Duration="${dur}" PowerLow="${low}" PowerHigh="${high}" />`;
}

function midpoint(seg) {
  const min = (seg.vermogenMin || 50) / 100;
  const max = (seg.vermogenMax || 75) / 100;
  return ((min + max) / 2).toFixed(3);
}

function escXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
