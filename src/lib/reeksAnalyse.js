// Generieke, dependency-vrije array-analyse over numerieke tijdreeksen (bv.
// per-seconde vermogensdata). Geëxtraheerd uit VoortgangTab.js's npClient
// (die als eerste een rollend gemiddelde nodig had, venster 30 voor
// Normalized Power) zodat andere consumenten (E1: instorting.js, venster 60)
// dezelfde rollend-gemiddelde-kern hergebruiken i.p.v. herhalen — zelfde
// extractiepatroon als trend.js destijds uit ef.js's berekenEFTrend.
//
// Beide functies kennen geen sessie/vermogen/Kesto-domeinconcept — puur
// arrays in, arrays/indexen uit.

/**
 * Rollend gemiddelde over een numerieke reeks, venstergrootte `venster`.
 * Punt i in de output is het gemiddelde van reeks[i-venster+1..i] — de
 * eerste (venster-1) punten van de invoer leveren geen output op (er is nog
 * geen vol venster).
 * @param {number[]} reeks
 * @param {number} venster
 * @returns {number[]} lengte = max(0, reeks.length - venster + 1)
 */
export function rollendGemiddelde(reeks, venster) {
  if (!reeks?.length || reeks.length < venster) return [];
  const resultaat = [];
  for (let i = venster - 1; i < reeks.length; i++) {
    let som = 0;
    for (let j = i - venster + 1; j <= i; j++) som += reeks[j];
    resultaat.push(som / venster);
  }
  return resultaat;
}

/**
 * Vindt aaneengesloten periodes in `reeks` waar de waarde >= `drempel` is,
 * gefilterd op minimale lengte `minimaleDuurSeconden` (reeks wordt 1-op-1 als
 * seconden geïnterpreteerd — geen eigen tijd-as, dat is de verantwoordelijkheid
 * van de aanroeper). Retourneert de gevonden periodes zelf (start/eind-index
 * binnen `reeks`), niet alleen een boolean — in tegenstelling tot het
 * bestaande streak-patroon (trainingsfrequentie.js: heeftTeLangReeks), dat
 * alleen "kwam een reeks ooit voor" teruggeeft en op kalenderdag-domeinen
 * werkt, niet op numerieke arrays.
 * @param {number[]} reeks
 * @param {number} drempel
 * @param {number} minimaleDuurSeconden
 * @returns {{start: number, eind: number, duurSeconden: number}[]} eind is exclusief
 */
export function vindAaneengeslotenPeriodes(reeks, drempel, minimaleDuurSeconden) {
  const periodes = [];
  if (!reeks?.length) return periodes;

  let start = null;
  for (let i = 0; i <= reeks.length; i++) {
    const voldoet = i < reeks.length && reeks[i] >= drempel;
    if (voldoet && start === null) {
      start = i;
    } else if (!voldoet && start !== null) {
      const duurSeconden = i - start;
      if (duurSeconden >= minimaleDuurSeconden) periodes.push({ start, eind: i, duurSeconden });
      start = null;
    }
  }
  return periodes;
}
