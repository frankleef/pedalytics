/**
 * Berekent Normalized Power (NP) uit een ruwe vermogens-tijdreeks.
 * Algoritme: 30-seconden voortschrijdend gemiddelde → vierdemachtsweging → vierdemachtswortel.
 *
 * @param {number[]} wattsArray - vermogenswaarden, één per seconde
 * @returns {number|null} NP in watt (afgerond), of null bij onvoldoende data
 */
export function berekenNP(wattsArray) {
  if (!wattsArray?.length || wattsArray.length < 30) return null;
  const rolling = [];
  for (let i = 29; i < wattsArray.length; i++) {
    let som = 0;
    for (let j = i - 29; j <= i; j++) som += wattsArray[j];
    rolling.push(som / 30);
  }
  let som4 = 0;
  for (const w of rolling) som4 += Math.pow(w, 4);
  return Math.round(Math.pow(som4 / rolling.length, 0.25));
}
