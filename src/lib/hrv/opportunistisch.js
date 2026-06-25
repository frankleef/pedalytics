export function bepaalOpportunistischeTraining(context) {
  const { hrvZone, geplandeSessie, beschikbaar, tssBudgetResterend, weektype } = context;

  if (hrvZone !== "hoog") return null;
  if (geplandeSessie) return null;
  if (!beschikbaar) return null;
  if (weektype === "herstel") return null;
  if (tssBudgetResterend < 40) return null;

  return {
    type: "opportunistisch",
    sessietype: "z2_variabel",
    tss_range: { min: 40, max: 60 },
    notificatie: {
      titel: "Je lichaam is goed hersteld",
      body: "Je hebt vandaag ruimte voor een extra Z2-sessie. Wil je die toevoegen?",
    },
    keuzes: ["ja_toevoegen", "nee_dank_je"],
  };
}
