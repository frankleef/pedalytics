const VRIJHEID_FASEN = new Set(['sweetspot', 'drempel', 'vo2max']);

/**
 * Bepaalt of een dag een vrijheidsdag is (gemengd sessietype):
 * week 3 van een intensieve fase, tweede intensiteitsdag van de week.
 */
export function bepaalVrijheidsdag({ weekInFase, dagRol, fase } = {}) {
  if (!weekInFase || !dagRol || !fase) return false;
  return weekInFase === 3 && dagRol === 'tweede_intensiteit' && VRIJHEID_FASEN.has(fase);
}
