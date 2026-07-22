// Lange-rit-planning: gedeelde bron van waarheid voor zowel de client-side
// beschikbaarheid-editor (waarschuwing bij te weinig aaneengesloten tijd) als
// de server-side weeksolver (daadwerkelijk reserveren/markeren van de langste
// dag). Eén tabel, geen duplicatie tussen client en server.

// Minimum aaneengesloten tijd (minuten) op de langste beschikbare dag, per
// seizoensdoel × ervaringsniveau. Basisfase gebruikt altijd de aerobe_basis-rij
// ongeacht seizoensdoel; consolidatie/test/taper hebben geen lange-rit-eis.
export const LANGE_RIT_MINIMUM = {
  uithoudingsvermogen: { recreatief: 150, getraind: 210 },
  aerobe_basis:        { recreatief: 120, getraind: 180 },
  klimmen:             { recreatief: 120, getraind: 180 },
  ftp:                 { recreatief: 90,  getraind: 150 },
  sprint:              { recreatief: 90,  getraind: 120 },
};

export function berekenLangeRitMinimumMin(seizoensdoelType, fase, ervaringsniveau) {
  if (["consolidatie", "test", "taper"].includes(fase)) return null;
  const niveau = ervaringsniveau === "getraind" ? "getraind" : "recreatief";
  if (fase === "basis") return LANGE_RIT_MINIMUM.aerobe_basis[niveau];
  const rij = LANGE_RIT_MINIMUM[seizoensdoelType] ?? LANGE_RIT_MINIMUM.aerobe_basis;
  return rij[niveau];
}

// Cadans (in weken) waarmee een lange rit ingepland wordt — 80/20 is
// grotendeels doel-onafhankelijk, dus elke week, behalve sprint (om de 2
// weken: de fysiologische stimulus van sprint-doelen leunt minder op lange
// duurritten).
export const LANGE_RIT_CADANS = {
  uithoudingsvermogen: 1,
  aerobe_basis: 1,
  klimmen: 1,
  ftp: 1,
  sprint: 2,
};

// weekVolgnummer null (onbekend weeknummer) coerced door JS' `null % n` naar
// 0, wat voor elke cadans (1 of 2) als "moet" uitkomt — bewust geen aparte
// null-guard, dit is het gewenste fail-open-gedrag.
export function moetLangeRitDezeWeek(seizoensdoelType, weektype, weekVolgnummer) {
  if (weektype === "herstel") return false;
  const cadans = LANGE_RIT_CADANS[seizoensdoelType] ?? 1;
  return weekVolgnummer % cadans === 0;
}
