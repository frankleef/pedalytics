// D5: individuele CP/W'-kalibratie van interval-/rustduur voor VO2max/
// anaerobe archetypes. Vermogen zelf blijft ongewijzigd (geauteerde pct_ftp
// uit sessie-varianten.js, ongemoeid door berekenWattagesVanBlokken) — alleen
// de DUUR van het werk-/rustblok wordt individueel bepaald via een Skiba-
// W'bal-simulatie op de renner's actuele CP/W' (D4, cpWprime.js), i.p.v. de
// vaste duur_pct/duur_sec_vast van het archetype.
//
// Sessietype-scope: alleen vo2max_intervallen en z6_anaeroob (VO2max/anaerobe
// herhalingen-boven-CP-met-tussenrust). NIET sprint_neuraal (Z7, alactisch/
// neuraal — een apart, nog niet gebouwd kalibratiepad, zie de D5-trace over
// piek_sprint_vermogen) en niet sweetspot/drempel (geen archetype-structuur
// van herhalingen boven CP met tussenrust in dezelfde zin).
export const WBAL_KALIBRATIE_SESSIETYPES = new Set(["vo2max_intervallen", "z6_anaeroob"]);

// Veiligheidsplafond tegen een oneindige lus als werkVermogen/rustVermogen
// toevallig (bijna) gelijk aan CP liggen — dan nadert de depletie/reconstitutie
// asymptotisch 0 en zou de simulatie anders nooit de drempel bereiken.
const MAX_SIMULATIE_SEC = 3600;

/**
 * Skiba-differentiaalmodel, per seconde gesimuleerd — zelfde formule als live
 * nagerekend en vergeleken met intervals.icu se icu_intervals[].wbal_start/
 * wbal_end in de D5-trace:
 *   depletie:      W'bal -= (P - CP)                       per seconde, P > CP
 *   reconstitutie: W'bal = W' - (W' - W'bal) * exp(-1/tau)  per seconde, P < CP
 *                  tau = W' / (CP - P_recovery)
 *
 * @param {object} params
 * @param {number} params.cp - kritisch vermogen (W)
 * @param {number} params.wPrime - anaerobe capaciteit (J)
 * @param {number} params.werkVermogen - archetype-vermogen van het werkblok (W)
 * @param {number} params.rustVermogen - archetype-vermogen van het rustblok (W; 0 = passieve rust)
 * @param {number} params.depletiePct - % van W' dat tijdens het werkblok verbruikt mag worden (bv. 60)
 * @param {number} params.herstelPct - % van W' dat tijdens de rust hersteld moet zijn (bv. 75)
 * @returns {{intervalDuurSec: number, rustDuurSec: number}|null} null bij een
 *   fysiologisch niet-simuleerbare combinatie (werkVermogen <= cp, rustVermogen
 *   >= cp, of het veiligheidsplafond geraakt) — fail-open, caller valt terug
 *   op de archetype-standaardduur.
 */
export function berekenWbalKalibratie({ cp, wPrime, werkVermogen, rustVermogen, depletiePct, herstelPct }) {
  if (cp == null || wPrime == null || !(cp > 0) || !(wPrime > 0)) return null;
  if (!(werkVermogen > cp)) return null; // geen depletie mogelijk op of onder CP
  if (!(rustVermogen < cp)) return null; // geen reconstitutie mogelijk op of boven CP

  const depletieDrempel = wPrime * (1 - depletiePct / 100);
  const herstelDrempel = wPrime * (herstelPct / 100);

  let wbal = wPrime;
  let intervalDuurSec = 0;
  while (wbal > depletieDrempel && intervalDuurSec < MAX_SIMULATIE_SEC) {
    wbal -= (werkVermogen - cp);
    intervalDuurSec++;
  }
  if (wbal > depletieDrempel) return null;

  const tau = wPrime / (cp - rustVermogen);
  wbal = depletieDrempel;
  let rustDuurSec = 0;
  while (wbal < herstelDrempel && rustDuurSec < MAX_SIMULATIE_SEC) {
    wbal = wPrime - (wPrime - wbal) * Math.exp(-1 / tau);
    rustDuurSec++;
  }
  if (wbal < herstelDrempel) return null;

  return { intervalDuurSec, rustDuurSec };
}

/**
 * Past de W'bal-kalibratie toe op een reeds geschaalde blokkenlijst
 * (schaalVariant()-output, vóór berekenWattagesVanBlokken): zoekt werk/
 * herstel-paren met dezelfde reps>1 (de herhaalde interval/rust-cyclus —
 * zelfde interleaving-aanname als berekenWattagesVanBlokken se eigen "twee
 * opeenvolgende platte entries met dezelfde reps-waarde"-documentatie), en
 * overschrijft hun blokDuurSeconden met de gesimuleerde waarde. Bewaart de
 * oorspronkelijke (archetype-standaard) duur op standaardBlokDuurSeconden
 * voor de transparantie-UI (SchemaTab.js).
 *
 * Niet-VO2max/anaerobe sessietypes en blokken buiten een reps-paar (warm-up,
 * losse afsluitende rust) blijven volledig ongewijzigd. Fail-open: ontbreken
 * CP/W' of levert de simulatie geen geldig resultaat op, dan blijft dat paar
 * exact zoals schaalVariant() het opleverde — geen standaardBlokDuurSeconden-
 * veld, dus geen afwijking-UI.
 *
 * @param {Array} blokken - schaalVariant()-output
 * @param {string} sessietype
 * @param {number} ftp
 * @param {{criticalPower: number, wPrime: number}|null} cpWprime
 * @param {{depletiePct: number, herstelPct: number}} drempels
 * @returns {Array} nieuwe blokkenlijst (ongekalibreerde blokken ongewijzigd teruggegeven)
 */
export function pasWbalKalibratieToe(blokken, sessietype, ftp, cpWprime, drempels) {
  if (!WBAL_KALIBRATIE_SESSIETYPES.has(sessietype)) return blokken;
  if (!cpWprime?.criticalPower || !cpWprime?.wPrime || !ftp || !drempels) return blokken;

  const resultaat = [...blokken];
  for (let i = 0; i < resultaat.length - 1; i++) {
    const werkBlok = resultaat[i];
    const herstelBlok = resultaat[i + 1];
    if (werkBlok.type !== "werk" || herstelBlok.type !== "herstel") continue;
    const reps = werkBlok.reps ?? 1;
    if (reps <= 1 || herstelBlok.reps !== reps) continue;

    const werkVermogen = ftp * (werkBlok.pct_ftp / 100);
    const rustVermogen = ftp * (herstelBlok.pct_ftp / 100);

    const kalibratie = berekenWbalKalibratie({
      cp: cpWprime.criticalPower, wPrime: cpWprime.wPrime,
      werkVermogen, rustVermogen,
      depletiePct: drempels.depletiePct, herstelPct: drempels.herstelPct,
    });
    if (!kalibratie) continue; // fail-open: dit paar blijft de archetype-standaard

    resultaat[i] = { ...werkBlok, standaardBlokDuurSeconden: werkBlok.blokDuurSeconden, blokDuurSeconden: kalibratie.intervalDuurSec };
    resultaat[i + 1] = { ...herstelBlok, standaardBlokDuurSeconden: herstelBlok.blokDuurSeconden, blokDuurSeconden: kalibratie.rustDuurSec };
  }
  return resultaat;
}
