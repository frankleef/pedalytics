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
