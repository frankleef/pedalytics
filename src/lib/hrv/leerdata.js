import { getKV } from "../kv";
import { pearsonCorrelatie } from "./math";

export async function registreerHrvObservatie(userId, observatie) {
  const kv = getKV();
  const key = `hrv-observaties:${userId}`;
  const bestaand = (await kv.get(key)) || [];
  const arr = Array.isArray(bestaand) ? bestaand : JSON.parse(bestaand);

  // checkin_score erbij pakken op het moment van registreren — de HRV-keuze
  // wordt dezelfde dag gemaakt als de check-in, dus de 2-dagen-TTL van die
  // key (api/checkin/route.js) is hier nooit een probleem.
  let checkinScore = observatie.checkin_score;
  if (checkinScore == null && observatie.datum) {
    const checkin = await kv.get(`${userId}:checkin:${observatie.datum}`);
    checkinScore = checkin?.score ?? null;
  }

  arr.push({ ...observatie, checkin_score: checkinScore, timestamp: new Date().toISOString() });

  const gecapped = arr.slice(-365);
  await kv.set(key, gecapped);
}

// rpe_delta is pas bekend ná de rit (als de sporter zijn RPE invult) — dus
// altijd later dan het moment van registreerHrvObservatie. Vult 'm in op de
// meest recente nog-onvolledige observatie voor die datum.
export async function patchHrvObservatieMetRpeDelta(userId, datum, rpeDelta) {
  const kv = getKV();
  const key = `hrv-observaties:${userId}`;
  const bestaand = (await kv.get(key)) || [];
  const arr = Array.isArray(bestaand) ? bestaand : JSON.parse(bestaand);

  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].datum === datum && arr[i].rpe_delta == null) {
      arr[i].rpe_delta = rpeDelta;
      await kv.set(key, arr);
      return true;
    }
  }
  return false;
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
