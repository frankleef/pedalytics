// Blok A: monotonie/strain (Foster-methode) — signaal voor te weinig variatie
// in de dagelijkse trainingsbelasting, los van TSB (dat kijkt naar niveau,
// niet naar spreiding). Geen lokale KV-tijdreeks: per-dag-TSS wordt bij elke
// weekconstructie on-demand opgehaald (zelfde /activities-aanroeppatroon als
// haalActueleTssDezeWeek, volumeCorrectie.js:59-77), met behoud van
// per-dag-granulariteit i.p.v. gesumd tot één weektotaal.

import { getIntervalsCredentials } from "../users";
import { intervalsGet } from "../intervals";
import { datumOffset } from "../datum";

/**
 * Dagelijkse TSS (icu_training_load, Ride/VirtualRide) over de laatste
 * `dagen` dagen (incl. vandaag), chronologisch, met expliciete 0 voor elke
 * dag zonder matchende activiteit. Fail-open naar null zonder credentials of
 * bij een fout — de caller behandelt null als "geen trigger" (zie
 * weekSessiesDeterministisch.js).
 * @param {string} userId
 * @param {number} [dagen]
 * @returns {Promise<number[]|null>} exact `dagen` lang, chronologisch
 */
export async function haalDagelijkseTssReeks(userId, dagen = 7) {
  try {
    const creds = await getIntervalsCredentials(userId);
    if (!creds) return null;

    const activiteiten = await intervalsGet("/activities", {
      oldest: datumOffset(-(dagen - 1)),
      newest: datumOffset(0),
      fields: "icu_training_load,type,start_date_local",
    }, creds);

    const tssPerDatum = {};
    for (const a of activiteiten || []) {
      if (a.type !== "Ride" && a.type !== "VirtualRide") continue;
      const datum = a.start_date_local?.slice(0, 10);
      if (!datum) continue;
      tssPerDatum[datum] = (tssPerDatum[datum] || 0) + (a.icu_training_load || 0);
    }

    const reeks = [];
    for (let i = dagen - 1; i >= 0; i--) {
      const datum = datumOffset(-i);
      reeks.push(tssPerDatum[datum] || 0);
    }
    return reeks;
  } catch {
    return null;
  }
}

/**
 * Foster-monotonie/strain over een per-dag-TSS-reeks.
 *
 * standaarddeviatie: POPULATIE-vorm (som van kwadratische afwijkingen / N,
 * niet / (N-1)) — bewuste keuze, geen steekproef-stdev. `dagelijkseTss`
 * beschrijft een compleet, afgebakend venster van precies N dagen (niet een
 * steekproef uit een grotere populatie), dus de populatie-vorm is hier de
 * correcte lezing. Dit raakt de triggerdrempel merkbaar: populatie-stdev is
 * kleiner dan steekproef-stdev (factor sqrt((N-1)/N) ≈ 0,926 bij N=7), dus
 * monotonie (gemiddelde/stdev) valt met deze keuze systematisch iets HOGER
 * uit dan met de steekproefvorm — bij eenzelfde reeks bereikt de populatie-
 * vorm de 2.0-drempel dus iets eerder.
 *
 * strain: Foster's oorspronkelijke vorm is weekbelasting × monotonie, waarbij
 * weekbelasting de SOM van de dagelijkse TSS over het venster is (niet het
 * gemiddelde) — hier dus `som(dagelijkseTss) * monotonie`, gelijk aan
 * `gemiddelde * dagen * monotonie`.
 *
 * @param {number[]} dagelijkseTss
 * @returns {{gemiddelde: number, standaarddeviatie: number, monotonie: number, strain: number, trigger: boolean}}
 */
export function berekenMonotonieEnStrain(dagelijkseTss) {
  const dagen = dagelijkseTss.length;
  const som = dagelijkseTss.reduce((s, v) => s + v, 0);
  const gemiddelde = dagen > 0 ? som / dagen : 0;

  const kwadratischeAfwijkingen = dagelijkseTss.reduce((s, v) => s + (v - gemiddelde) ** 2, 0);
  const standaarddeviatie = dagen > 0 ? Math.sqrt(kwadratischeAfwijkingen / dagen) : 0;

  // standaarddeviatie === 0 (elke dag exact dezelfde TSS, inclusief de
  // volledig-rust-week 0-0-0-0-0-0-0): monotonie is dan wiskundig oneindig,
  // maar een reeks van uitsluitend nullen (geen enkele training) is geen
  // "te weinig variatie in belasting"-signaal — er ís geen belasting om
  // monotoon te zijn. Expliciet: bij gemiddelde === 0 geen trigger; bij een
  // positief gemiddelde met stdev 0 (elke dag exact dezelfde, niet-nul TSS)
  // is monotonie wél degelijk maximaal problematisch, dus trigger.
  const monotonie = standaarddeviatie === 0
    ? (gemiddelde === 0 ? 0 : Infinity)
    : gemiddelde / standaarddeviatie;

  const strain = som * monotonie;
  const trigger = monotonie > 2.0;

  return { gemiddelde, standaarddeviatie, monotonie, strain, trigger };
}
