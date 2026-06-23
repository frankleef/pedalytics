import { haalGebruikersLocatie } from "./locatie";
import { getKV } from "./kv";

const HITTE_DELTA_DREMPEL = 6;

export async function haalRitTemperatuur(userId, startTijdIso, duurMinuten) {
  try {
    const { lat, lon } = await haalGebruikersLocatie(userId);
    const ritDatum = startTijdIso.slice(0, 10);
    const vandaag = new Date().toISOString().slice(0, 10);

    let url;
    if (ritDatum < vandaag) {
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${ritDatum}&end_date=${ritDatum}&hourly=apparent_temperature&timezone=Europe%2FAmsterdam`;
    } else {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&past_days=1&forecast_days=0&hourly=apparent_temperature&timezone=Europe%2FAmsterdam`;
    }

    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Open-Meteo status ${res.status}`);
    const data = await res.json();

    const startUur = new Date(startTijdIso).getHours();
    const eindUur = Math.min(23, startUur + Math.ceil(duurMinuten / 60));

    const temps = ritDatum < vandaag
      ? data.hourly.apparent_temperature.slice(startUur, eindUur + 1)
      : data.hourly.apparent_temperature.slice(24 + startUur, 24 + eindUur + 1);

    if (!temps.length) throw new Error("Geen temperatuurdata voor ritperiode");

    const gemiddeld = temps.reduce((a, b) => a + b, 0) / temps.length;
    return { apparent_temp_celsius: Math.round(gemiddeld * 10) / 10 };
  } catch (err) {
    console.error("[hitte] Temperatuurfetch mislukt:", err.message);
    return { apparent_temp_celsius: null };
  }
}

export function berekenTempBaseline(decouplingEntries) {
  const zesWekenGeleden = Date.now() - 6 * 7 * 86400000;
  const relevant = decouplingEntries
    .filter(e => e.apparent_temp_celsius != null && new Date(e.startTijd).getTime() > zesWekenGeleden)
    .sort((a, b) => new Date(b.startTijd) - new Date(a.startTijd))
    .slice(0, 14);
  if (!relevant.length) return null;
  return Math.round((relevant.reduce((s, e) => s + e.apparent_temp_celsius, 0) / relevant.length) * 10) / 10;
}

export function berekenHitteVlag(apparentTemp, baseline) {
  if (apparentTemp == null || baseline == null) return false;
  return (apparentTemp - baseline) >= HITTE_DELTA_DREMPEL;
}

export async function migreerHitteTemperatuur() {
  const kv = getKV();
  const keys = await kv.keys("decoupling:*");

  for (const sleutel of keys || []) {
    const data = await kv.get(sleutel);
    if (data?.apparent_temp_celsius !== undefined) continue;
    if (!data?.startTijd || !data?.duurMinuten || !data?.userId) continue;

    const { apparent_temp_celsius } = await haalRitTemperatuur(data.userId, data.startTijd, data.duurMinuten);
    await kv.set(sleutel, { ...data, apparent_temp_celsius });
    await new Promise(r => setTimeout(r, 200));
  }
  console.log("[migratie] Hitte-temperatuur migratie voltooid");
}
