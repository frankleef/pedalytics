// Rondt blokduren af op hele minuten (voor blokken >= 1 minuut) en de totale
// sessieduur op een veelvoud van 5 minuten — zodat een sessie nooit met een
// blok van bv. 9:48 of een totale duur van 23 min 53 sec wordt getoond.
// Sub-minuut blokken (sprints/microbursts) blijven bewust ongemoeid: afronden
// naar 60s zou hun fysiologische bedoeling (een korte, maximale uitbarsting)
// teniet doen — zie schaalVariant's isKortInherent-uitzondering, hetzelfde
// idee geldt hier.

const KORT_DREMPEL_SEC = 60;
const VIJF_MIN_SEC = 300;

function isHerstelOfZ1Z2(blok) {
  return blok.type === "herstel" || blok.zone === "Z1" || blok.zone === "Z2";
}

/**
 * Kernalgoritme: rondt elk niet-gepind blok van >= 1 minuut af op een veelvoud
 * van 60 seconden, en werkt het restverschil naar het 5-minutengrid weg in het
 * grootste vrije herstel/Z1/Z2-blok (of anders het grootste vrije blok).
 *
 * @param {Array} blokken - elk met .blokDuurSeconden en optioneel .reps (multiplier)
 * @param {(blok: object) => boolean} [isGepind] - blokken die nooit aangepast mogen
 *   worden (bv. duur_sec_vast, of al tegen hun archetype-maximum aan)
 * @param {number|null} [doelTotaalSecOverride] - de oorspronkelijk bedoelde
 *   sessieduur (in seconden) om naar te snappen. Zonder override wordt het
 *   dichtstbijzijnde 5-minutengrid van de al-afgeronde som gebruikt — bij
 *   veel blokken kan de opgetelde afrondingsruis dat punt dan een heel eind
 *   van de oorspronkelijke doelduur laten afdrijven, dus de aanroeper geeft
 *   de echte doelduur bij voorkeur expliciet mee.
 * @returns {{ blokken: Array, totaalSec: number }}
 */
function rondBlokDurenAf(blokken, isGepind = () => false, doelTotaalSecOverride = null) {
  const afgerond = blokken.map((b) => {
    if (isGepind(b) || (b.blokDuurSeconden ?? 0) < KORT_DREMPEL_SEC) return { ...b };
    return { ...b, blokDuurSeconden: Math.round(b.blokDuurSeconden / 60) * 60 };
  });

  const totaal = (lijst) => lijst.reduce((s, b) => s + (b.blokDuurSeconden || 0) * (b.reps ?? 1), 0);
  const huidigTotaal = totaal(afgerond);
  const referentie = doelTotaalSecOverride ?? huidigTotaal;
  const doelTotaal = Math.max(VIJF_MIN_SEC, Math.round(referentie / VIJF_MIN_SEC) * VIJF_MIN_SEC);
  const restSec = doelTotaal - huidigTotaal;

  if (restSec !== 0) {
    const kandidaten = afgerond
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => !isGepind(b) && (b.blokDuurSeconden || 0) >= KORT_DREMPEL_SEC);
    const herstelKandidaten = kandidaten.filter(({ b }) => isHerstelOfZ1Z2(b));
    const pool = herstelKandidaten.length > 0 ? herstelKandidaten : kandidaten;
    // Blokken zonder reps-multiplier krijgen voorrang: restSec (altijd een
    // veelvoud van 60) kan daar exact op worden toegepast. Bij een
    // reps-blok wordt restSec eerst over de herhalingen verdeeld — dat kan
    // per instantie afronden naar 0 en de hele correctie laten verdwijnen.
    const zonderReps = pool.filter(({ b }) => (b.reps ?? 1) <= 1);
    const eindPool = zonderReps.length > 0 ? zonderReps : pool;
    if (eindPool.length > 0) {
      const gekozen = eindPool.reduce((best, cur) =>
        cur.b.blokDuurSeconden * (cur.b.reps ?? 1) > best.b.blokDuurSeconden * (best.b.reps ?? 1) ? cur : best
      );
      const reps = gekozen.b.reps ?? 1;
      const restPerInstantie = Math.round(restSec / reps / 60) * 60;
      afgerond[gekozen.i] = { ...gekozen.b, blokDuurSeconden: Math.max(60, gekozen.b.blokDuurSeconden + restPerInstantie) };
    }
  }

  return { blokken: afgerond, totaalSec: totaal(afgerond) };
}

/**
 * Voor reeds geëxpandeerde, platte sessie-segmenten (elke reps-herhaling al
 * een eigen entry, dus geen .reps-multiplier meer) — gebruikt na elke latere
 * aanpassing van een bestaande sessie (check-in-modulatie, segment-staart-
 * vervanging, budgetconflict-inkorting) en om al opgeslagen sessies te
 * corrigeren.
 *
 * @param {Array} segmenten
 * @returns {{ segmenten: Array, duur_min: number }}
 */
export function rondSessieAf(segmenten) {
  if (!Array.isArray(segmenten) || segmenten.length === 0) {
    return { segmenten: segmenten ?? [], duur_min: 0 };
  }
  const { blokken, totaalSec } = rondBlokDurenAf(segmenten);
  return { segmenten: blokken, duur_min: Math.round(totaalSec / 60) };
}

/**
 * Voor de nog niet geëxpandeerde blokken direct na schaalVariant()/
 * voegWarmingUpToe() (dus vóór berekenWattagesVanBlokken) — behoudt .reps en
 * respecteert vaste (duur_sec_vast) en gecapte (archetype-maximum) blokken via
 * de meegegeven isGepind-predicate.
 *
 * @param {Array} geschaaldeBlokken
 * @param {(blok: object) => boolean} isGepind
 * @param {number} doelDuurSec - de oorspronkelijk gevraagde sessieduur in seconden
 * @returns {{ blokken: Array, totaalSec: number }}
 */
export function normaliseerGeschaaldeBlokDuren(geschaaldeBlokken, isGepind, doelDuurSec) {
  return rondBlokDurenAf(geschaaldeBlokken, isGepind, doelDuurSec);
}

/** Rondt een minutenwaarde af op het dichtstbijzijnde veelvoud van 5. */
export function rondDuurMinAf(duurMin) {
  return Math.max(5, Math.round(duurMin / 5) * 5);
}
