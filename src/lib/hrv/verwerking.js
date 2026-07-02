import { getKV } from "../kv";
import { registreerHrvObservatie } from "./leerdata";
import { getAlleArchetypesRaw } from "../sessie-archetypes";

export async function verwerkSchrappen(userId, datum, dag, seizoensplan) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const sessies = seizoensplan?.weekSessies?.sessies || [];
  const sessie = sessies.find(s => s.datum === datum);

  if (sessie) {
    sessie.mode = "geschrapt_hrv";
    sessie.hrv_keuze_gemaakt = true;
    sessie.hrv_keuze = "schrappen";
    sessie.hrv_keuze_timestamp = new Date().toISOString();
    await kv.set(planKey, seizoensplan);
  }

  // Geschrapte intensiteitsdagen teller
  const weekStart = new Date(datum);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekKey = `hrv-geschrapt:${userId}:${weekStart.toISOString().slice(0, 10)}`;
  await kv.incr(weekKey);
  await kv.expire(weekKey, 90 * 86400);

  await registreerHrvObservatie(userId, {
    datum,
    hrv: dag?.hrv_vandaag,
    keuze: "schrappen",
    sessietype: sessie?.intentie?.sessietype || sessie?.type,
  });
}

export async function verwerkVerlichten(userId, datum, dag, seizoensplan) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const sessies = seizoensplan?.weekSessies?.sessies || [];
  const sessie = sessies.find(s => s.datum === datum);

  if (sessie) {
    const { bepaalNieuweIntentie } = await import("../sessie/alternatief");
    const archetypesData = await getAlleArchetypesRaw();
    const nieuweIntentie = bepaalNieuweIntentie(archetypesData, sessie.intentie, "vermoeid", dag?.fase || "basis", "rood");

    if (nieuweIntentie) {
      sessie.intentie = nieuweIntentie;
      sessie.hrv_keuze_gemaakt = true;
      sessie.hrv_keuze = "verlichten";
      sessie.hrv_verlicht = true;
      await kv.set(planKey, seizoensplan);
    }
  }

  await registreerHrvObservatie(userId, {
    datum,
    hrv: dag?.hrv_vandaag,
    keuze: "verlichten",
    sessietype: sessie?.intentie?.sessietype || sessie?.type,
  });

  return { sessieGewijzigd: true };
}

export async function verwerkVerplaatsen(userId, datum, dag, nieuweDatum, seizoensplan) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const sessies = seizoensplan?.weekSessies?.sessies || [];
  const sessie = sessies.find(s => s.datum === datum);
  const doelSessie = sessies.find(s => s.datum === nieuweDatum);

  if (sessie) {
    sessie.mode = "geschrapt_hrv";
    sessie.hrv_keuze_gemaakt = true;
    sessie.hrv_keuze = "verplaatsen";
    sessie.hrv_verplaatst_naar = nieuweDatum;

    // Verplaats de intentie naar de nieuwe datum
    const verplaatst = {
      ...sessie,
      datum: nieuweDatum,
      mode: undefined,
      hrv_keuze_gemaakt: undefined,
      hrv_keuze: undefined,
      hrv_verplaatst_naar: undefined,
      hrv_verplaatst_van: datum,
    };

    if (doelSessie) {
      const idx = sessies.indexOf(doelSessie);
      if (idx >= 0) sessies[idx] = verplaatst;
    } else {
      sessies.push(verplaatst);
    }

    await kv.set(planKey, seizoensplan);
  }

  await registreerHrvObservatie(userId, {
    datum,
    hrv: dag?.hrv_vandaag,
    keuze: "verplaatsen",
    sessietype: sessie?.intentie?.sessietype || sessie?.type,
  });

  return { sessieGewijzigd: true };
}

export async function verwerkOrigineel(userId, datum, dag, seizoensplan) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const sessies = seizoensplan?.weekSessies?.sessies || [];
  const sessie = sessies.find(s => s.datum === datum);

  if (sessie) {
    sessie.hrv_keuze_gemaakt = true;
    sessie.hrv_keuze = "origineel";
    sessie.hrv_override = true;
    await kv.set(planKey, seizoensplan);
  }

  await registreerHrvObservatie(userId, {
    datum,
    hrv: dag?.hrv_vandaag,
    keuze: "origineel",
    sessietype: sessie?.intentie?.sessietype || sessie?.type,
    override: true,
  });
}
