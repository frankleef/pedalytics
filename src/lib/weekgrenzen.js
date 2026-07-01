export function getMaandagVanWeek(datum) {
  const d = new Date(datum)
  const dag = d.getDay()  // 0 = zondag, 1 = maandag, ...
  const diffNaarMaandag = dag === 0 ? -6 : 1 - dag
  d.setDate(d.getDate() + diffNaarMaandag)
  d.setHours(0, 0, 0, 0)
  return d
}

export function weeknummerVoorDatum(datum, startdatum) {
  const startMaandag = getMaandagVanWeek(startdatum)
  const dagVerschil = Math.floor(
    (new Date(datum) - startMaandag) / (24 * 60 * 60 * 1000)
  )
  return Math.max(1, Math.floor(dagVerschil / 7) + 1)
}

/**
 * Kaderweek (uit plan.kader) die een gegeven datum bestrijkt.
 * Valt terug op de eerste kaderweek als er geen startdatum is of de datum
 * buiten het gedefinieerde kader valt.
 */
export function kaderWeekVoorDatum(datum, kader, startdatum) {
  if (!kader?.length) return null;
  if (!startdatum) return kader[0] || null;
  const weekNr = weeknummerVoorDatum(datum, startdatum);
  return kader.find(w => w.week === weekNr) || kader[0] || null;
}

/** 1-based week-binnen-fase-teller voor een gegeven kaderweek. */
export function weekInFaseVoorKaderWeek(kaderWeek, kader) {
  if (!kaderWeek || !kader) return 1;
  const sorted = [...kader].sort((a, b) => a.week - b.week);
  const fase = kaderWeek.fase;
  let teller = 0;
  for (const w of sorted) {
    if (w.fase === fase) teller++;
    if (w.week === kaderWeek.week) return teller;
  }
  return 1;
}

/** Combineert kaderWeekVoorDatum + weekInFaseVoorKaderWeek voor het gangbare geval. */
export function weekInFaseVoorDatum(datum, kader, startdatum) {
  const kaderWeek = kaderWeekVoorDatum(datum, kader, startdatum);
  return weekInFaseVoorKaderWeek(kaderWeek, kader);
}

export function tssDoelWeek1(normaalWeekdoel, startdatum) {
  const start = new Date(startdatum)
  start.setHours(0, 0, 0, 0)
  const startMaandag = getMaandagVanWeek(startdatum)
  const eersteZondag = new Date(startMaandag)
  eersteZondag.setDate(eersteZondag.getDate() + 6)
  eersteZondag.setHours(23, 59, 59, 999)
  const beschikbareDagen = Math.round(
    (eersteZondag - start) / (24 * 60 * 60 * 1000)
  )
  return Math.round(normaalWeekdoel * (beschikbareDagen / 7))
}
