// Deterministische staart-toevoeging aan een bestaande, al gegenereerde sessie:
// verkort de kern proportioneel en plakt een nieuw staartblok aan het einde.
// Vervangt wat voorheen een aparte Claude-aanroep was (sprint-staartjes,
// tempo-afsluiter-volumecorrectie) — pure segment-surgery op reeds berekende
// segmenten, geen nieuwe LLM-aanroep. De caller is verantwoordelijk voor de
// gebruikelijke nabewerking (normaliseerSessieSegmenten/voegVerwachtRpeToe/
// corrigeerSessieTss), zoals ook elders in sessiesAanvullen.js na segment-
// aanpassingen gebeurt.

import { berekenWattagesVanBlokken } from "../sessie-generatie";
import { rondSessieAf } from "./duurAfronding";

function vervangStaartVanSessie(sessie, ftp, staartBlokkenRuw) {
  const sessietype = sessie.intentie?.sessietype ?? sessie.type;
  const staartSegmenten = berekenWattagesVanBlokken(staartBlokkenRuw, ftp, sessietype);
  const staartTotaalSec = staartSegmenten.reduce((s, seg) => s + seg.blokDuurSeconden, 0);

  const huidigeSegmenten = sessie.segmenten || [];
  const huidigeTotaalSec = huidigeSegmenten.reduce((s, seg) => s + (seg.blokDuurSeconden || 0), 0);
  const nieuweKernTotaalSec = Math.max(0, huidigeTotaalSec - staartTotaalSec);
  const ratio = huidigeTotaalSec > 0 ? nieuweKernTotaalSec / huidigeTotaalSec : 0;

  const ingekorteSegmenten = huidigeSegmenten
    .map(seg => ({ ...seg, blokDuurSeconden: Math.round((seg.blokDuurSeconden || 0) * ratio) }))
    .filter(seg => seg.blokDuurSeconden > 0);

  const { segmenten, duur_min } = rondSessieAf([...ingekorteSegmenten, ...staartSegmenten]);
  sessie.segmenten = segmenten;
  sessie.duur_min = duur_min;
  return sessie;
}

const SPRINT_STAART_REPS = 4;
const SPRINT_DUUR_SEC = 10;
const SPRINT_HERSTEL_SEC = 140; // 4x [10s + 140s] = 600s = 10 min totale staart

/**
 * Voegt sprint-staartjes toe: 4x [10s @ Z7 (~200% FTP) + 140s Z2-herstel],
 * zoals voorheen via een Claude-promptinstructie ("3-5 herhalingen van
 * 10-15 sec maximaal @ Z7, elk gevolgd door 2-3 min Z2 herstel", kern
 * 8-10 min korter). Zet ook de intentie-vlaggen die de rest van de codebase
 * verwacht (heeft_sprint_staartjes, Z7 in toegestane_zones).
 *
 * @param {object} sessie - een reeds gegenereerde sessie (segmenten, intentie)
 * @param {number} ftp
 * @returns {object} dezelfde sessie, gemuteerd
 */
export function voegSprintStaartjesToe(sessie, ftp) {
  vervangStaartVanSessie(sessie, ftp, [
    { type: 'werk',    zone: 'Z7', pct_ftp: 200, blokDuurSeconden: SPRINT_DUUR_SEC,    reps: SPRINT_STAART_REPS },
    { type: 'herstel', zone: 'Z2', pct_ftp: 63,  blokDuurSeconden: SPRINT_HERSTEL_SEC, reps: SPRINT_STAART_REPS },
  ]);
  if (sessie.intentie) {
    sessie.intentie.heeft_sprint_staartjes = true;
    if (!sessie.intentie.toegestane_zones?.includes('Z7')) {
      sessie.intentie.toegestane_zones = [...(sessie.intentie.toegestane_zones || ['Z2']), 'Z7'];
    }
  }
  return sessie;
}

const TEMPO_AFSLUITER_DUUR_MIN_DEFAULT = 18;

/**
 * Voegt een Z3-tempo-afsluiter toe (15-20 min @ ~82% FTP), zoals voorheen via
 * een Claude-promptinstructie voor de tempo-afsluiter-volumecorrectie.
 *
 * @param {object} sessie - een reeds gegenereerde sessie (segmenten, intentie)
 * @param {number} ftp
 * @param {number} [duurMin] - lengte van de afsluiter in minuten (15-20, default 18)
 * @returns {object} dezelfde sessie, gemuteerd
 */
export function voegTempoAfsluiterToe(sessie, ftp, duurMin = TEMPO_AFSLUITER_DUUR_MIN_DEFAULT) {
  vervangStaartVanSessie(sessie, ftp, [
    { type: 'werk', zone: 'Z3', pct_ftp: 82, blokDuurSeconden: Math.round(duurMin * 60) },
  ]);
  return sessie;
}

/**
 * Verlengt een reeds gegenereerde sessie met een los Z2-blok aan het einde —
 * in tegenstelling tot vervangStaartVanSessie() hierboven wordt de bestaande
 * kern NIET ingekort, de totale duur groeit gewoon. Bedoeld voor sessietypes
 * met een eigen effectieve-urenplafond (SESSIETYPE_MAX_EFFECTIEVE_UREN in
 * weekSolver.js, bv. kracht_lage_cadans: 1,5u): als er meer tijd beschikbaar
 * is dan dat plafond, hoeft die rest niet onbenut te blijven — het wordt als
 * aanvullend Z2-duurvolume aangeplakt i.p.v. simpelweg weggegooid.
 *
 * @param {object} sessie - een reeds gegenereerde sessie (segmenten, intentie)
 * @param {number} ftp
 * @param {number} verlengingMin - lengte van het Z2-staartblok in minuten
 * @returns {object} dezelfde sessie, gemuteerd
 */
export function voegZ2VerlengingToe(sessie, ftp, verlengingMin) {
  const sessietype = sessie.intentie?.sessietype ?? sessie.type;
  const staartSegmenten = berekenWattagesVanBlokken(
    [{ type: 'werk', zone: 'Z2', pct_ftp: 63, blokDuurSeconden: Math.round(verlengingMin * 60) }],
    ftp,
    sessietype
  );
  const { segmenten, duur_min } = rondSessieAf([...(sessie.segmenten || []), ...staartSegmenten]);
  sessie.segmenten = segmenten;
  sessie.duur_min = duur_min;
  return sessie;
}
