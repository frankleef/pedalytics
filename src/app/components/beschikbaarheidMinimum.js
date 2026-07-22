// JSX-vrij, zodat dit los van BeschikbaarheidEditor.js getest kan worden —
// dit project heeft geen jsdom/@testing-library/react (vitest.config.js draait
// environment: 'node'), zelfde opzet als reviewVoorstelActies.js naast
// ReviewVoorstelKaart.js.

// Welke variant van de permanente richtlijn-regel getoond moet worden.
// minimumUren is hier het door de gebruiker zelf ingestelde streefUrenPerWeek
// (géén berekening meer — de eerdere IF-afgeleide berekenMinimumUren gaf
// onrealistische waarden, zie project-memory). null: nog geen streefdoel
// ingesteld — regel blijft dan volledig verborgen.
export function bepaalMinimumUrenVariant(total, minimumUren) {
  if (minimumUren == null) return null;
  return total < minimumUren ? "waarschuwing" : "richtlijn";
}

// Friel's vuistregel: eenmalige eerste-gebruik-suggestie = historisch
// gemiddelde (laatste 6 volledige weken, zie BeschikbaarheidEditor.js) + 10-
// 15% marge, midden van dat bereik. Afgerond op een half uur — kwartier-
// precisie is voor een streefdoel niet nodig.
export const STREEF_UREN_MARGE = 1.125;

export function berekenStreefUrenSuggestie(gemiddeldeUrenPerWeek) {
  if (gemiddeldeUrenPerWeek == null) return null;
  return Math.round(gemiddeldeUrenPerWeek * STREEF_UREN_MARGE * 2) / 2;
}
