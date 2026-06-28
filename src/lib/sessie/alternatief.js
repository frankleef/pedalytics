const HERSTELGERELATEERDE_REDENEN = ["hitte", "vermoeid"];

const SESSIETYPES_PER_ROL_EN_FASE = {
  intensiteitsdag: {
    basis: ["sweetspot_intervallen", "drempel_intervallen", "progressief"],
    sweetspot: ["sweetspot_lang", "sweetspot_intervallen", "drempel_intervallen"],
    drempel: ["drempel_intervallen", "vo2max_lang", "vo2max_kort"],
    consolidatie: ["race_simulatie", "drempel_intervallen"],
    _default: ["sweetspot_intervallen", "drempel_intervallen"],
  },
  variabele_dag: {
    _default: ["progressief", "z2_duur", "microbursts", "kracht_lage_cadans"],
  },
  aerobe_dag: {
    _default: ["z2_duur", "z2_heuvel", "z2_lang", "progressief"],
  },
  hersteldag: {
    _default: ["herstel_actief", "herstel_mobiliteit"],
  },
};

function kiesAlternatiefSessietype(origineelType, rol, fase) {
  const opties = (
    SESSIETYPES_PER_ROL_EN_FASE[rol]?.[fase] ??
    SESSIETYPES_PER_ROL_EN_FASE[rol]?._default ??
    ["z2_duur"]
  ).filter(t => t !== origineelType);

  return opties[0] ?? "z2_duur";
}

export function bepaalNieuweIntentie(origineleIntentie, reden, fase, hrvZone) {
  if (!origineleIntentie) return null;

  const effectieveReden = reden ?? (hrvZone === "rood" ? "vermoeid" : null);

  if (HERSTELGERELATEERDE_REDENEN.includes(effectieveReden) && origineleIntentie.rol === "intensiteitsdag") {
    return {
      rol: "aerobe_dag",
      sessietype: "z2_duur",
      toegestane_zones: ["Z1", "Z2"],
      tss_range: {
        min: Math.round((origineleIntentie.tss_range?.min ?? 60) * 0.6),
        max: Math.round((origineleIntentie.tss_range?.max ?? 90) * 0.7),
      },
      toelichting: reden
        ? `Alternatief vanwege ${reden}: intensiteitsdag vervangen door herstelgerichte Z2`
        : "Alternatief: HRV rood — intensiteitsdag automatisch verlaagd naar Z2",
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
    toelichting: reden
      ? `Alternatief op verzoek (${reden}): sessietype gewisseld van ${origineleIntentie.sessietype} naar ${alternatief}`
      : hrvZone === "geel"
      ? "Alternatief: HRV geel — lichtere variant gekozen"
      : `Alternatief op verzoek: sessietype gewisseld van ${origineleIntentie.sessietype} naar ${alternatief}`,
  };
}
