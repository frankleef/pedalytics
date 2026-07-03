import { logEvent } from "../posthog";

/**
 * Cap sessie.duur_min op maxMinuten. Schaalt tss en tss_range proportioneel mee.
 * Logt een waarschuwing als segmenten-som afwijkt na de cap.
 *
 * @returns {boolean} true als er gecapt is, false als de duur al binnen het maximum lag.
 */
export function capSessieDuur(sessie, maxMinuten, logPrefix = "", userId = null) {
  const oorspronkelijkeDuur = sessie.duur_min;
  if (!oorspronkelijkeDuur || !maxMinuten || oorspronkelijkeDuur <= maxMinuten) return false;

  const ratio = maxMinuten / oorspronkelijkeDuur;
  const prefix = logPrefix ? `[${logPrefix}]` : "";
  console.warn(`${prefix} duur gecapt ${oorspronkelijkeDuur}→${maxMinuten}min`);
  const tssVoorCap = sessie.tss;

  if (sessie.tss) sessie.tss = Math.round(sessie.tss * ratio);
  if (sessie.intentie?.tss_range) {
    sessie.intentie.tss_range.min = Math.round(sessie.intentie.tss_range.min * ratio);
    sessie.intentie.tss_range.max = Math.round(sessie.intentie.tss_range.max * ratio);
  }
  sessie.duur_min = maxMinuten;

  if (sessie.segmenten?.length) {
    const somSec = sessie.segmenten.reduce((s, seg) => s + (seg.blokDuurSeconden || 0), 0);
    if (Math.abs(Math.round(somSec / 60) - maxMinuten) > 2) {
      console.warn(`${prefix} segmenten-som (${Math.round(somSec / 60)}min) wijkt af van gecapte duur (${maxMinuten}min)`);
    }
  }

  logEvent("duur_cap_toegepast", userId, {
    sessietype: sessie.intentie?.sessietype ?? sessie.type ?? null,
    oorspronkelijkeDuur,
    gecapteDuur: maxMinuten,
    tssVoorCap,
    tssNaCap: sessie.tss,
  });

  return true;
}
