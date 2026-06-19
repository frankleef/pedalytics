// lib/workoutText.js — segmenten → intervals.icu workout tekst-syntax

export function segmentenNaarTekst(segmenten, ftp) {
  if (!segmenten || segmenten.length === 0) return "";
  const ftpW = ftp || 265;

  const main = segmenten.filter(s => s.type !== "warmup" && s.type !== "cooldown");
  if (main.length === 0) return "";

  const sigKey = (seg) => {
    const pct = seg.vermogenMin != null && seg.vermogenMax != null
      ? (seg.vermogenMin + seg.vermogenMax) / 2
      : 50;
    return `${seg.type}:${Math.round(pct)}:${seg.duur_min}`;
  };

  const patternSig = (arr, start, len) =>
    arr.slice(start, start + len).map(sigKey).join("|");

  const groups = [];
  let i = 0;

  while (i < main.length) {
    let found = false;
    for (let patLen = Math.min(5, Math.floor((main.length - i) / 2)); patLen >= 1; patLen--) {
      const sig = patternSig(main, i, patLen);
      let reps = 1;
      while (i + reps * patLen + patLen <= main.length &&
             patternSig(main, i + reps * patLen, patLen) === sig) {
        reps++;
      }
      if (reps >= 2) {
        groups.push({ reps, segments: main.slice(i, i + patLen) });
        i += reps * patLen;
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ reps: 1, segments: [main[i]] });
      i++;
    }
  }

  const lines = [];
  for (const group of groups) {
    if (group.reps > 1) {
      lines.push(`${group.reps}x`);
      for (const seg of group.segments) {
        lines.push(`- ${segLijn(seg, ftpW)}`);
      }
    } else {
      for (const seg of group.segments) {
        lines.push(`- ${segLijn(seg, ftpW)}`);
      }
    }
  }

  return lines.join("\n");
}

function segLijn(seg, ftpW) {
  const minW = Math.round((seg.vermogenMin || 50) * ftpW / 100);
  const maxW = Math.round((seg.vermogenMax || 75) * ftpW / 100);
  const duur = seg.duur_min || 1;
  const label = seg.label || seg.type || "";
  return `${duur}m ${minW}-${maxW}w ${label}`.trim();
}
