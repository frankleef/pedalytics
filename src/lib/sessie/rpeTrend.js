import { getKV } from "../kv";

/**
 * Berekent de gewogen RPE-delta-trend over de laatste 10 ritten.
 * Laatste 3 ritten wegen 1.5×.
 */
export async function berekenRpeTrend(userId) {
  const kv = getKV();
  const plan = await kv.get(`${userId}:seizoensplan`);
  const sessies = plan?.weekSessies?.sessies || [];

  const deltas = sessies
    .filter(s => s.rpe_delta != null && s.datum)
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, 10)
    .map(s => s.rpe_delta);

  if (deltas.length < 5) return null;

  const gewogen = deltas.map((d, i) => ({ waarde: d, gewicht: i < 3 ? 1.5 : 1.0 }));
  const totaalGewicht = gewogen.reduce((s, g) => s + g.gewicht, 0);
  const gewogenGem = gewogen.reduce((s, g) => s + g.waarde * g.gewicht, 0) / totaalGewicht;

  const afgerond = Math.round(gewogenGem * 10) / 10;
  await kv.set(`rpe_trend:${userId}`, afgerond, { ex: 8 * 86400 });
  return afgerond;
}

/**
 * Verwerkt de RPE-trend en past het plan aan bij over-/onderstimulering.
 */
export async function verwerkRpeTrend(userId, trend) {
  if (trend === null) return null;
  const kv = getKV();

  if (trend > 1.5) {
    await kv.set(`rpe_overbelasting:${userId}`, true, { ex: 7 * 86400 });
    await kv.del(`rpe_onderstimulering:${userId}`);

    const plan = await kv.get(`${userId}:seizoensplan`);
    if (plan?.weekSessies?.sessies) {
      const vandaag = new Date().toISOString().slice(0, 10);
      plan.weekSessies.sessies = plan.weekSessies.sessies.map(s => {
        if (s.voltooid || s.datum <= vandaag) return s;
        if (s.intentie?.tss_range) {
          s.intentie = { ...s.intentie, tss_range: {
            min: Math.round(s.intentie.tss_range.min * 0.88),
            max: Math.round(s.intentie.tss_range.max * 0.88),
          }};
        }
        return s;
      });
      await kv.set(`${userId}:seizoensplan`, plan);
    }

    return "overbelasting";
  }

  if (trend < -1.5) {
    await kv.set(`rpe_onderstimulering:${userId}`, true, { ex: 7 * 86400 });
    await kv.del(`rpe_overbelasting:${userId}`);

    const plan = await kv.get(`${userId}:seizoensplan`);
    if (plan?.weekSessies?.sessies) {
      const vandaag = new Date().toISOString().slice(0, 10);
      plan.weekSessies.sessies = plan.weekSessies.sessies.map(s => {
        if (s.voltooid || s.datum <= vandaag) return s;
        if (s.intentie?.tss_range) {
          s.intentie = { ...s.intentie, tss_range: {
            min: Math.round(s.intentie.tss_range.min * 1.06),
            max: Math.round(s.intentie.tss_range.max * 1.06),
          }};
        }
        return s;
      });
      await kv.set(`${userId}:seizoensplan`, plan);
    }

    return "onderstimulering";
  }

  await kv.del(`rpe_overbelasting:${userId}`);
  await kv.del(`rpe_onderstimulering:${userId}`);
  return "normaal";
}
