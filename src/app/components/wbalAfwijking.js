// D5: transparantie-tekst voor CP/W'-gekalibreerde interval-/rustduur t.o.v.
// de archetype-standaardduur (segment.standaardBlokDuurSeconden, gezet door
// wbalSimulatie.js's pasWbalKalibratieToe). JSX-vrij bestand — zelfde reden
// als reviewVoorstelActies.js naast ReviewVoorstelKaart.js (Blok F, fase 5):
// dit project heeft geen jsdom/@testing-library/react en Vite kan een .js-
// bestand met JSX niet transformeren voor een test-import, dus deze pure
// tekstlogica staat apart van SchemaTab.js om los testbaar te blijven.

function formatDuurSec(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`;
}

/**
 * Bouwt de afwijking-tekst voor één sessiesegment, of null als er geen
 * (zinvolle) afwijking is — geen CP/W'-kalibratie toegepast op dit segment
 * (fail-open of niet-VO2max/anaerobe sessietype), of de gekalibreerde duur
 * is toevallig exact gelijk aan de standaardduur.
 * @param {object} seg - sessie.segmenten[]-item
 * @returns {string|null}
 */
export function bouwWbalAfwijkingTekst(seg) {
  if (!seg || seg.standaardBlokDuurSeconden == null) return null;
  if (seg.blokDuurSeconden === seg.standaardBlokDuurSeconden) return null;
  const label = seg.type === "herstel" ? "rust" : "interval";
  return `${label}: ${formatDuurSec(seg.blokDuurSeconden)} (standaard ${formatDuurSec(seg.standaardBlokDuurSeconden)}, CP/W'-gekalibreerd)`;
}
