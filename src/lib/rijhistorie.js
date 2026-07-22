export const GEMIDDELDE_IF_BASIS = 0.65;

export function berekenGemiddeldeUrenPerWeek(activiteiten) {
  if (!activiteiten?.length) return null;
  const weekMap = {};
  for (const act of activiteiten) {
    const d = new Date(act.start_date_local);
    const dag = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const maandag = new Date(d);
    maandag.setDate(d.getDate() - dag);
    const key = maandag.toISOString().split("T")[0];
    weekMap[key] = (weekMap[key] ?? 0) + (act.moving_time ?? 0);
  }
  const weken = Object.values(weekMap);
  if (!weken.length) return null;
  return weken.reduce((a, b) => a + b, 0) / weken.length / 3600;
}

export function berekenStartTss(urenPerWeek, ctlHuidig) {
  if (!urenPerWeek) return ctlHuidig ? Math.round(ctlHuidig * 5) : 200;
  let startTss = urenPerWeek * Math.pow(GEMIDDELDE_IF_BASIS, 2) * 100;
  if (ctlHuidig && startTss > ctlHuidig * 8) startTss = ctlHuidig * 6;
  return Math.round(startTss);
}
