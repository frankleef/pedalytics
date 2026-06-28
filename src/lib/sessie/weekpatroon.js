const ZWAAR_ROLLEN = ["intensiteitsdag", "variabele_dag", "kracht_dag"];
const ZWAAR_TYPES = ["kracht_lage_cadans", "sweetspot_intervallen", "drempel_intervallen", "vo2max_intervallen", "sprint_neuraal"];

const Z2_TYPES = ["z2_duur", "z2_steady", "z2_heuvel"];

export const SPRINT_STAARTJE_CONFIG = {
  aantal: 5,
  duur_seconden: 15,
  herstel_seconden: 150,
};

/**
 * Bepaalt of een dag het sprint-staartje mag krijgen.
 * @param {object} week - kader-week object met weektype en dagen (sessies voor die week)
 * @param {object} dag - de kandidaat sessie (zelfde structuur als weekSessies.sessies[])
 * @param {number|null} tsb - huidige TSB (Training Stress Balance)
 */
export function magSprintStaartje(week, dag, tsb) {
  if (week.weektype === "herstel" || week.type === "herstel") return false;

  const weekDagen = week.dagen ?? [];

  const heeftSprintSessie = weekDagen.some(
    d => d.intentie?.sessietype === "sprint_neuraal"
  );
  if (heeftSprintSessie) return false;

  const z2Dagen = weekDagen.filter(d => Z2_TYPES.includes(d.intentie?.sessietype));
  if (z2Dagen.length === 0) return false;

  const langsteZ2 = [...z2Dagen].sort(
    (a, b) => (b.intentie?.tss_range?.max ?? 0) - (a.intentie?.tss_range?.max ?? 0)
  )[0];
  if (langsteZ2.datum !== dag.datum) return false;

  const MS_PER_DAG = 24 * 60 * 60 * 1000;
  const dagMs = new Date(dag.datum).getTime();
  const naastIntensiteit = weekDagen.some(d => {
    const diff = Math.abs(new Date(d.datum).getTime() - dagMs);
    return diff > 0 && diff <= MS_PER_DAG && d.intentie?.rol === "intensiteitsdag";
  });
  if (naastIntensiteit) return false;

  if (tsb != null && tsb < -25) return false;

  return true;
}

export function valideerWeekpatroon(sessies, kaderWeek) {
  const weektype = kaderWeek?.weektype || "opbouw";
  const toekomstig = sessies.filter(s => !s.voltooid);
  if (toekomstig.length === 0) return { geldig: true, ontbrekendeRollen: [], conflicten: [] };

  const rollen = toekomstig.map(s => s.intentie?.rol).filter(Boolean);
  const sessietypes = toekomstig.map(s => s.intentie?.sessietype || s.type).filter(Boolean);

  const ontbrekendeRollen = [];
  const conflicten = [];

  if (weektype === "opbouw") {
    const heeftVarieteit = rollen.some(r => ZWAAR_ROLLEN.includes(r))
      || sessietypes.some(t => ZWAAR_TYPES.includes(t));

    const kaderTypes = kaderWeek?.sessietypes || [];
    const heeftKrachtInKader = kaderTypes.includes("kracht_lage_cadans");
    const heeftIntensiteitInKader = kaderTypes.some(t => ZWAAR_TYPES.includes(t) && t !== "kracht_lage_cadans");

    if (!heeftVarieteit && toekomstig.length >= 2) {
      if (heeftKrachtInKader) ontbrekendeRollen.push("kracht_lage_cadans");
      else if (heeftIntensiteitInKader) ontbrekendeRollen.push("intensiteitsdag");
      else ontbrekendeRollen.push("variabele_dag");
    }
  }

  if (weektype === "herstel") {
    const heeftIntensiteit = sessietypes.some(t => ZWAAR_TYPES.includes(t));
    if (heeftIntensiteit) conflicten.push("intensiteit_in_herstelweek");
  }

  return {
    geldig: ontbrekendeRollen.length === 0 && conflicten.length === 0,
    ontbrekendeRollen,
    conflicten,
  };
}

export function kiesBesteDagVoorRol(sessies, ontbrekendeRol, urenPerDag) {
  const toekomstig = sessies.filter(s => !s.voltooid);
  const zwareDatums = toekomstig
    .filter(s => ZWAAR_ROLLEN.includes(s.intentie?.rol) || ZWAAR_TYPES.includes(s.intentie?.sessietype || s.type))
    .map(s => new Date(s.datum).getTime());

  const kandidaten = toekomstig
    .filter(s => {
      const rol = s.intentie?.rol;
      if (ZWAAR_ROLLEN.includes(rol)) return false;
      const dagMs = new Date(s.datum).getTime();
      return !zwareDatums.some(iMs => Math.abs(dagMs - iMs) < 48 * 3600000);
    })
    .sort((a, b) => {
      const DAGEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
      const urenA = urenPerDag?.[a.dag || DAGEN[new Date(a.datum).getDay()]] || 1.5;
      const urenB = urenPerDag?.[b.dag || DAGEN[new Date(b.datum).getDay()]] || 1.5;
      return urenB - urenA;
    });

  return kandidaten[0] || null;
}

export function bepaalIntentieVoorRol(ontbrekendeRol, fase) {
  if (ontbrekendeRol === "kracht_lage_cadans") {
    return {
      rol: "variabele_dag",
      sessietype: "kracht_lage_cadans",
      toegestane_zones: ["Z2", "Z3", "Z4"],
      tss_range: { min: 55, max: 80 },
      toelichting: "Weekpatroon-correctie: krachtsessie ontbrak",
    };
  }

  if (ontbrekendeRol === "intensiteitsdag") {
    const typePerFase = {
      basis: "sweetspot_intervallen",
      sweetspot: "sweetspot_intervallen",
      drempel: "drempel_intervallen",
      consolidatie: "drempel_intervallen",
    };
    return {
      rol: "intensiteitsdag",
      sessietype: typePerFase[fase] || "sweetspot_intervallen",
      toegestane_zones: ["Z3", "Z4"],
      tss_range: { min: 60, max: 100 },
      toelichting: "Weekpatroon-correctie: intensiteitsdag ontbrak",
    };
  }

  return {
    rol: "variabele_dag",
    sessietype: "z2_duur",
    toegestane_zones: ["Z2", "Z3"],
    tss_range: { min: 50, max: 90 },
    toelichting: "Weekpatroon-correctie: variëteit ontbrak",
  };
}
