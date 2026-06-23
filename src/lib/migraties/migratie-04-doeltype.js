// Migratie 04: Voegt seizoensdoel-object toe aan bestaande plannen.
// Idempotent: slaat over als seizoensdoel.type al aanwezig is.

export function migratie04Doeltype(plan) {
  if (!plan) return plan;
  if (plan.seizoensdoel?.type) return plan;

  const ftp = plan.huidige_ftp || 265;

  return {
    ...plan,
    seizoensdoel: {
      type: "ftp",
      doel_ftp: Math.round(ftp * 1.1),
    },
  };
}
