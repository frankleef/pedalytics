import { datumISO } from "./datum";

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

/**
 * Kalenderdatum (maandag) waarop de HUIDIGE fase van het plan begon.
 * "Huidige fase" = de fase van de kaderweek die vandaag bestrijkt
 * (kaderWeekVoorDatum). Fail-open naar null zonder kader/startdatum — bedoeld
 * voor D1 (compliance-poort), waar het ontbreken hiervan de poort simpelweg
 * niet laat afgaan i.p.v. een fout te gooien.
 * @param {object} plan - seizoensplan met .kader en .startdatum
 * @returns {Date|null}
 */
export function faseStartdatum(plan) {
  if (!plan?.kader?.length || !plan?.startdatum) return null;
  const huidigeKaderWeek = kaderWeekVoorDatum(new Date(), plan.kader, plan.startdatum);
  if (!huidigeKaderWeek) return null;
  const faseWeken = plan.kader.filter(w => w.fase === huidigeKaderWeek.fase);
  if (faseWeken.length === 0) return null;
  const eersteFaseWeekNr = Math.min(...faseWeken.map(w => w.week));
  const startMaandag = getMaandagVanWeek(plan.startdatum);
  const faseStart = new Date(startMaandag);
  faseStart.setDate(faseStart.getDate() + (eersteFaseWeekNr - 1) * 7);
  return faseStart;
}

/**
 * Fase-gebonden teller: leest veldnaam als "sinds start van de huidige fase".
 * Vergelijkt ankerVeldnaam (ISO-datum van faseStartdatum op moment van laatste
 * ophoging) met de HUIDIGE faseStartdatum. Mismatch (incl. ontbrekend anker,
 * bijv. bij oude plannen zonder dit veld) -> teller telt als 0. Fail-open naar
 * de rauwe (niet-gereset) waarde zonder resetvergelijking als faseStartdatum
 * zelf niet te bepalen is (zie faseStartdatum: ontbrekend kader/startdatum).
 * @param {object} plan
 * @param {string} veldnaam - bv. "fase_verlengd_count"
 * @param {string} ankerVeldnaam - bv. "fase_verlengd_count_faseAnker"
 * @returns {number}
 */
export function haalFaseGebondenTeller(plan, veldnaam, ankerVeldnaam) {
  const start = faseStartdatum(plan);
  if (!start) return plan?.[veldnaam] || 0;
  const huidigAnker = datumISO(start);
  if (plan?.[ankerVeldnaam] !== huidigAnker) return 0;
  return plan?.[veldnaam] || 0;
}

/**
 * Hoogt veldnaam met 1 op t.o.v. de fase-gebonden basiswaarde (zie
 * haalFaseGebondenTeller) en zet ankerVeldnaam op de huidige faseStartdatum.
 * Muteert plan in-place. Als faseStartdatum niet te bepalen is, wordt het
 * ankerveld bewust NIET aangeraakt (geen datumISO(null)) — de teller wordt dan
 * simpelweg +1 op de rauwe waarde, consistent met haalFaseGebondenTeller's
 * eigen fail-open pad voor datzelfde geval.
 * @param {object} plan
 * @param {string} veldnaam
 * @param {string} ankerVeldnaam
 */
export function hoogFaseGebondenTellerOp(plan, veldnaam, ankerVeldnaam) {
  const basis = haalFaseGebondenTeller(plan, veldnaam, ankerVeldnaam);
  plan[veldnaam] = basis + 1;
  const start = faseStartdatum(plan);
  if (start) plan[ankerVeldnaam] = datumISO(start);
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
