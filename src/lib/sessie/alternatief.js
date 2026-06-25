const HERSTELGERELATEERDE_REDENEN = ["hitte", "vermoeid"];

const SESSIETYPES_PER_ROL_EN_FASE = {
  intensiteitsdag: {
    basis: ["sweetspot_intervallen", "over_under", "pyramide"],
    sweetspot: ["sweetspot_intervallen", "over_under", "drempel_intervallen"],
    drempel: ["drempel_intervallen", "over_under", "pyramide", "sprint_neuraal"],
    consolidatie: ["drempel_intervallen", "over_under", "pyramide"],
    _default: ["sweetspot_intervallen", "over_under", "pyramide"],
  },
  variabele_dag: {
    _default: ["kracht_lage_cadans", "z2_variabel", "z2_embedded_sprint"],
  },
  aerobe_dag: {
    _default: ["z2_variabel", "z2_vlak"],
  },
};

function kiesAlternatiefSessietype(origineelType, rol, fase) {
  const opties = (
    SESSIETYPES_PER_ROL_EN_FASE[rol]?.[fase] ??
    SESSIETYPES_PER_ROL_EN_FASE[rol]?._default ??
    ["z2_variabel"]
  ).filter(t => t !== origineelType);

  return opties[0] ?? "z2_variabel";
}

export function bepaalNieuweIntentie(origineleIntentie, reden, fase) {
  if (!origineleIntentie) return null;

  if (HERSTELGERELATEERDE_REDENEN.includes(reden) && origineleIntentie.rol === "intensiteitsdag") {
    return {
      rol: "aerobe_dag",
      sessietype: "z2_variabel",
      toegestane_zones: ["Z1", "Z2"],
      tss_range: {
        min: Math.round((origineleIntentie.tss_range?.min ?? 60) * 0.6),
        max: Math.round((origineleIntentie.tss_range?.max ?? 90) * 0.7),
      },
      toelichting: `Alternatief vanwege ${reden}: intensiteitsdag vervangen door herstelgerichte Z2`,
    };
  }

  const alternatief = kiesAlternatiefSessietype(
    origineleIntentie.sessietype,
    origineleIntentie.rol,
    fase
  );

  return {
    ...origineleIntentie,
    sessietype: alternatief,
    toelichting: `Alternatief op verzoek${reden ? ` (${reden})` : ""}: sessietype gewisseld van ${origineleIntentie.sessietype} naar ${alternatief}`,
  };
}
