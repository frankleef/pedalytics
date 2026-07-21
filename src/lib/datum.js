// Centrale datum-helpers. Alle datums in lokale tijd (machine-tijdzone),
// niet UTC — voorkomt dat 'vandaag' na middernacht lokaal nog de
// vorige dag is (Nederland is UTC+1/+2, dus toISOString() loopt
// tot 02:00 een dag achter).

export function vandaagISO() {
  return datumISO(new Date());
}

export function datumISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function datumOffset(dagen) {
  const d = new Date();
  d.setDate(d.getDate() + dagen);
  return datumISO(d);
}

/**
 * Laatste n kalenderdagen (inclusief vandaag) als ISO-datumstrings, oplopend
 * (chronologisch) gesorteerd — van datumOffset(-(n-1)) tot en met vandaag.
 */
export function laatsteNDagen(n) {
  return Array.from({ length: n }, (_, i) => datumOffset(-(n - 1) + i));
}

export const DAGNAMEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
