// Puur, side-effect-vrij: "is dit sessietype fysiologisch zwaar" + de 48u-
// afstandsregel die daarop bouwt. Losgetrokken uit compliance.js (die zelf
// meldingen.js importeert, wat via pushNotify.js -> web-push -> https-proxy-
// agent Node-only 'net'/'tls' nodig heeft) omdat conflictResolutie.js —
// aangeroepen vanuit src/app/AppClient.js, dus onderdeel van de CLIENT-bundle
// — alleen deze twee pure functies nodig heeft, niet de rest van
// compliance.js. Zonder deze scheiding trekt webpack het hele meldingen.js/
// web-push-pad de client-bundle in en faalt de build op 'tls'/'net'
// ("Module not found"). compliance.js importeert deze twee functies hieronder
// terug (re-export) zodat geen van zijn overige ~15 aanroepers hoeft te
// wijzigen.
const ZWARE_SESSIETYPES_HERSTEL = new Set([
  "sweetspot_intervallen",
  "drempel_intervallen",
  "vo2max_intervallen",
  "sprint_neuraal",
  "kracht_lage_cadans",
]);

/**
 * Of dit sessietype fysiologisch zwaar genoeg is om als startpunt voor een
 * hersteltijd-telling (B2) te gelden.
 * @param {string|null|undefined} sessietype
 * @returns {boolean}
 */
export function isZwareSessieVoorHerstel(sessietype) {
  return ZWARE_SESSIETYPES_HERSTEL.has(sessietype);
}

/**
 * B5: of kandidaatDatum minder dan 48u verwijderd is van een ANDERE zware
 * sessie in het plan (los van welke die zelf is — dit checkt tegen ALLE
 * zware datums, niet alleen de meest recente).
 * @param {object} plan
 * @param {string} kandidaatDatum - ISO-datum
 * @returns {boolean}
 */
export function isBinnen48uVanAndereZwareSessie(plan, kandidaatDatum) {
  for (const s of plan?.weekSessies?.sessies || []) {
    if (!s.datum || s.datum === kandidaatDatum) continue;
    if (!isZwareSessieVoorHerstel(s.intentie?.sessietype)) continue;
    const verschilUren = Math.abs(new Date(s.datum) - new Date(kandidaatDatum)) / 3600000;
    if (verschilUren < 48) return true;
  }
  return false;
}
