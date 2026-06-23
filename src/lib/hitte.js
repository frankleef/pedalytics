import { haalGebruikersLocatie } from "./locatie";

const HITTE_DREMPEL_CELSIUS = 28;

export async function haalRitTemperatuur(userId, startTijdIso, duurMinuten) {
  try {
    const { lat, lon } = await haalGebruikersLocatie(userId);
    const ritDatum = startTijdIso.slice(0, 10);
    const vandaag = new Date().toISOString().slice(0, 10);

    let url;
    if (ritDatum < vandaag) {
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${ritDatum}&end_date=${ritDatum}&hourly=temperature_2m&timezone=Europe%2FAmsterdam`;
    } else {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&past_days=1&forecast_days=0&hourly=temperature_2m&timezone=Europe%2FAmsterdam`;
    }

    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Open-Meteo status ${res.status}`);
    const data = await res.json();

    const startUur = new Date(startTijdIso).getHours();
    const eindUur = Math.min(23, startUur + Math.ceil(duurMinuten / 60));

    let temps;
    if (ritDatum < vandaag) {
      temps = data.hourly.temperature_2m.slice(startUur, eindUur + 1);
    } else {
      temps = data.hourly.temperature_2m.slice(24 + startUur, 24 + eindUur + 1);
    }

    if (!temps.length) throw new Error("Geen temperatuurdata voor ritperiode");

    const gemiddeld = temps.reduce((a, b) => a + b, 0) / temps.length;

    return {
      temperatuur_celsius: Math.round(gemiddeld * 10) / 10,
      hitte_gecorrigeerd: gemiddeld >= HITTE_DREMPEL_CELSIUS,
    };
  } catch (err) {
    console.error("[hitte] Temperatuurfetch mislukt:", err.message);
    return { temperatuur_celsius: null, hitte_gecorrigeerd: false };
  }
}
