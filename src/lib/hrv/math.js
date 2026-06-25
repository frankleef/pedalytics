export function gemiddelde(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function standaardDeviatie(arr) {
  if (!arr || arr.length < 2) return 0;
  const avg = gemiddelde(arr);
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function pearsonCorrelatie(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 3) return 0;
  const n = x.length;
  const avgX = gemiddelde(x);
  const avgY = gemiddelde(y);
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - avgX;
    const dy = y[i] - avgY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}
