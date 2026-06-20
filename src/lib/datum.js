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
