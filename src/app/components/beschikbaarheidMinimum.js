// JSX-vrij, zodat dit los van BeschikbaarheidEditor.js getest kan worden —
// dit project heeft geen jsdom/@testing-library/react (vitest.config.js draait
// environment: 'node'), zelfde opzet als reviewVoorstelActies.js naast
// ReviewVoorstelKaart.js.
import { GEMIDDELDE_IF_BASIS } from "@/lib/rijhistorie";

// Representatieve IF per fase — gebruikt om het TSS-weekdoel van de huidige
// kaderweek terug te rekenen naar een minimum aantal beschikbare uren.
// Basis hergebruikt GEMIDDELDE_IF_BASIS (rijhistorie.js) als enige bron van
// waarheid; sweetspot/drempel/vo2max zijn vastgestelde aannames, consolidatie/
// test/taper vallen conservatief terug op 0.70.
export const IF_PER_FASE = {
  basis: GEMIDDELDE_IF_BASIS,
  sweetspot: 0.91,
  drempel: 1.00,
  vo2max: 1.13,
  consolidatie: 0.70,
  test: 0.70,
  taper: 0.70,
};

export function berekenMinimumUren(weekTssDoel, fase) {
  const IF = IF_PER_FASE[fase] ?? 0.70;
  return weekTssDoel / (IF ** 2 * 100);
}

// Welke variant van de permanente richtlijn-regel getoond moet worden.
// null: geen weekTssDoel bekend (bv. de wizard, buiten scherm A) — regel
// blijft dan volledig verborgen, exact zoals vóór deze wijziging.
export function bepaalMinimumUrenVariant(total, minimumUren) {
  if (minimumUren == null) return null;
  return total < minimumUren ? "waarschuwing" : "richtlijn";
}
