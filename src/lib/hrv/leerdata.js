import { getKV } from "../kv";
import { pearsonCorrelatie } from "./math";

export async function registreerHrvObservatie(userId, observatie) {
  const kv = getKV();
  const key = `hrv-observaties:${userId}`;
  const bestaand = (await kv.get(key)) || [];
  const arr = Array.isArray(bestaand) ? bestaand : JSON.parse(bestaand);

  arr.push({ ...observatie, timestamp: new Date().toISOString() });

  const gecapped = arr.slice(-365);
  await kv.set(key, gecapped);
}

export function herberekenGewichtenHrvCheckin(observaties, huidigGewichten) {
  const metBeide = observaties.filter(o =>
    o.hrv != null && o.checkin_score != null && o.rpe_delta != null
  );

  if (metBeide.length < 50) return huidigGewichten;

  const corHrv = pearsonCorrelatie(metBeide.map(o => o.hrv), metBeide.map(o => o.rpe_delta));
  const corCheckin = pearsonCorrelatie(metBeide.map(o => o.checkin_score), metBeide.map(o => o.rpe_delta));

  const totaal = Math.abs(corHrv) + Math.abs(corCheckin);
  if (totaal === 0) return huidigGewichten;

  const hrvGew = Math.round((Math.abs(corHrv) / totaal) * 100) / 100;
  const checkGew = Math.round((Math.abs(corCheckin) / totaal) * 100) / 100;

  return {
    hrv: hrvGew,
    checkin: checkGew,
    observaties: metBeide.length,
    gepersonaliseerd: true,
  };
}
