import { getKV } from "../kv";
import { gemiddelde } from "./math";

/**
 * Baseline: gemiddelde HRV over de metingen buiten de laatste 3 dagen
 * (die 3 dagen horen bij de trend, niet bij de referentie).
 */
export function berekenHrvBaseline(hrv_metingen_14d) {
  const buitenRecente3d = (hrv_metingen_14d || []).slice(0, -3);
  if (buitenRecente3d.length < 7) return null;
  return gemiddelde(buitenRecente3d);
}

/**
 * Trend: laatste 7 dagen t.o.v. baseline, als percentage-afwijking.
 */
export function berekenHrvTrend(hrv_laatste_7d, baseline) {
  if (!baseline || (hrv_laatste_7d || []).length < 5) return null;
  const gemRecent = gemiddelde(hrv_laatste_7d);
  return ((gemRecent - baseline) / baseline) * 100;
}

/**
 * Verwerkt de HRV-trend en past het plan aan bij structureel verlaagde HRV.
 * Zelfde patroon als verwerkRpeTrend() (sectie 26-C) — zelfde TSS-factor
 * (×0.88), zelfde 7-dagen KV-vlag-TTL. Eénrichtingstrigger (alleen verlaagd,
 * geen "te hoog"-actie zoals RPE's onderstimulering-kant).
 *
 * Voorkomt dubbele TSS-verlaging als RPE-delta deze week al heeft
 * gereduceerd: als rpe_overbelasting al actief is, wordt de HRV-vlag wel
 * gezet (voor observability/sessiecontext) maar de TSS-range niet nogmaals
 * vermenigvuldigd.
 */
export async function verwerkHrvTrend(userId, trend) {
  if (trend === null) return null;
  const kv = getKV();

  if (trend < -15) {
    await kv.set(`hrv_overbelasting:${userId}`, true, { ex: 7 * 86400 });

    const rpeAlActief = await kv.get(`rpe_overbelasting:${userId}`);
    if (rpeAlActief) return "hrv_overbelasting_gecombineerd";

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

    return "hrv_overbelasting";
  }

  await kv.del(`hrv_overbelasting:${userId}`);
  return "normaal";
}
