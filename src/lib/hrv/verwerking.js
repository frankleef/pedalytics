import { getKV } from "../kv";
import { registreerHrvObservatie } from "./leerdata";
import { getAlleArchetypesRaw } from "../sessie-archetypes";
import { maakHerstelRit } from "../sessie/checkinAanpassing";
import { isZwareSessieVoorHerstel } from "../sessie/compliance";
import { probeerHerschikking } from "../sessie/herschikking";
import { zetWeekVoorzichtig } from "../sessie/weekVoorzichtig";
import { datumOffset } from "../datum";

export async function verwerkSchrappen(userId, datum, dag, seizoensplan) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const sessies = seizoensplan?.weekSessies?.sessies || [];
  const sessie = sessies.find(s => s.datum === datum);

  // Bewaard vóór de content-vervanging hieronder — registreerHrvObservatie
  // verderop moet het ORIGINELE (geschrapte) sessietype loggen, niet het
  // herstelrit-type dat ervoor in de plaats komt.
  const oorspronkelijkSessietype = sessie?.intentie?.sessietype || sessie?.type;

  if (sessie) {
    const ftp = seizoensplan?.huidige_ftp || 265;
    const herstelRit = maakHerstelRit(ftp);

    // Snapshot + vervanging dekken elk veld dat maakHerstelRit() teruggeeft —
    // niet een handmatig bijgehouden lijst, om te voorkomen dat een later
    // toegevoegd puur-weergave-veld (zoals titel/vermogen/reden, ontdekt via
    // een eerdere audit) stilzwijgend ontbreekt in snapshot óf vervanging.
    sessie.sessie_voor_hrv_schrappen = {};
    for (const veld of Object.keys(herstelRit)) {
      sessie.sessie_voor_hrv_schrappen[veld] = sessie[veld];
    }
    Object.assign(sessie, herstelRit);

    sessie.mode = "geschrapt_hrv";
    sessie.hrv_keuze_gemaakt = true;
    sessie.hrv_keuze = "schrappen";
    sessie.hrv_keuze_timestamp = new Date().toISOString();
    // B5: deze dag is nu zelf al aangepast (door B1) — beschermt 'm tegen een
    // latere, andere herschikkingspoging die deze dag als doelwit zou kiezen.
    sessie.beschermd_herschikking = true;
    await kv.set(planKey, seizoensplan);

    // Intervals.icu-sync — zelfde ZWO/workout-patroon als verwerkOrigineel's
    // sessie_voor_checkin-herstelpad (zie verderop in dit bestand): zonder dit
    // verandert er niets aan wat er daadwerkelijk op de fiets(computer) staat.
    if (sessie.intervalsEventId) {
      try {
        const { getIntervalsCredentials } = await import("../users");
        const { intervalsPut } = await import("../intervals");
        const { sessieNaarZwo } = await import("../workoutZwo");
        const creds = await getIntervalsCredentials(userId);
        if (creds) {
          const zwo = sessieNaarZwo(sessie, ftp);
          await intervalsPut(`/events/${sessie.intervalsEventId}`, {
            name: sessie.titel || sessie.type,
            moving_time: (sessie.duur_min || 30) * 60,
            ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
          }, creds);
        }
      } catch (e) {
        console.warn("[verwerkSchrappen] Intervals.icu update mislukt:", e.message);
      }
    }

    // B5: het verlies van een kernsessie (sessietype-niveau, niet een B6/B2-
    // variant-verzachting) — probeer één herschikking binnen de resterende
    // week. Fail-open: een mislukte poging mag de schrapping zelf nooit blokkeren.
    if (isZwareSessieVoorHerstel(oorspronkelijkSessietype)) {
      try {
        const herschikt = await probeerHerschikking(userId, seizoensplan, datum, oorspronkelijkSessietype);
        if (herschikt) {
          await kv.set(planKey, seizoensplan);
        } else {
          // A3: geen kandidaat óf geen passend archetype/budget (beide
          // gevallen retourneren null, zie herschikking.js) — de gemiste
          // kernsessie kon deze week nergens anders geplaatst worden.
          await zetWeekVoorzichtig(kv, userId, datumOffset(0));
        }
      } catch (e) {
        console.warn("[verwerkSchrappen] Herschikking mislukt:", e.message);
      }
    }
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
    sessietype: oorspronkelijkSessietype,
  });
}

export async function verwerkVerlichten(userId, datum, dag, seizoensplan) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const sessies = seizoensplan?.weekSessies?.sessies || [];
  const sessie = sessies.find(s => s.datum === datum);

  // Bewaard vóór de intentie-vervanging hieronder — zelfde reden als
  // verwerkSchrappen's oorspronkelijkSessietype (B5: het gemiste type moet
  // het ORIGINELE zijn, niet het verlichte alternatief).
  const oorspronkelijkSessietype = sessie?.intentie?.sessietype || sessie?.type;

  if (sessie) {
    const { bepaalNieuweIntentie } = await import("../sessie/alternatief");
    const archetypesData = await getAlleArchetypesRaw();
    // O3: daadwerkelijke hrv_zone i.p.v. een hardgecodeerde "rood" — sessie.hrv_zone
    // is al gezet door cron/morning/route.js:48 (bepaalHrvZone-uitkomst van diezelfde
    // ochtend), op dezelfde sessie die hierboven (regel 105) uit het plan gelezen is.
    const nieuweIntentie = bepaalNieuweIntentie(archetypesData, sessie.intentie, "vermoeid", dag?.fase || "basis", sessie.hrv_zone ?? null);

    if (nieuweIntentie) {
      sessie.intentie = nieuweIntentie;
      sessie.hrv_keuze_gemaakt = true;
      sessie.hrv_keuze = "verlichten";
      sessie.hrv_verlicht = true;
      // B5: zie verwerkSchrappen hierboven.
      sessie.beschermd_herschikking = true;
      await kv.set(planKey, seizoensplan);

      if (isZwareSessieVoorHerstel(oorspronkelijkSessietype)) {
        try {
          const herschikt = await probeerHerschikking(userId, seizoensplan, datum, oorspronkelijkSessietype);
          if (herschikt) {
            await kv.set(planKey, seizoensplan);
          } else {
            // A3: zie verwerkSchrappen hierboven.
            await zetWeekVoorzichtig(kv, userId, datumOffset(0));
          }
        } catch (e) {
          console.warn("[verwerkVerlichten] Herschikking mislukt:", e.message);
        }
      }
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
  const idx = sessies.findIndex(s => s.datum === datum);
  const sessie = idx >= 0 ? sessies[idx] : null;

  if (sessie) {
    if (sessie.sessie_voor_hrv_schrappen) {
      // Herstel van de content-vervanging die verwerkSchrappen toepaste — dit
      // is de meest recente HRV-mutatie, dus deze tak heeft voorrang op een
      // eventueel oudere sessie_voor_checkin-laag (die blijft, indien aanwezig,
      // ongebruikt op het herstelde object staan voor een latere "origineel"-keuze).
      // Generiek (Object.assign) i.p.v. veld-voor-veld, zodat dit automatisch
      // meeloopt met wat verwerkSchrappen daadwerkelijk snapshot.
      const snapshot = sessie.sessie_voor_hrv_schrappen;
      Object.assign(sessie, snapshot);
      sessie.sessie_voor_hrv_schrappen = undefined;
      sessie.mode = undefined;
      sessie.hrv_keuze_gemaakt = true;
      sessie.hrv_keuze = "origineel";
      sessie.hrv_override = true;

      // Omgekeerde intervals.icu-sync — zelfde ZWO/workout-patroon als
      // hieronder bij sessie_voor_checkin, nu toegepast op de herstelde
      // (oorspronkelijke) sessie-inhoud.
      if (sessie.intervalsEventId) {
        try {
          const { getIntervalsCredentials } = await import("../users");
          const { intervalsPut } = await import("../intervals");
          const { sessieNaarZwo } = await import("../workoutZwo");
          const creds = await getIntervalsCredentials(userId);
          if (creds) {
            const ftp = seizoensplan?.huidige_ftp || 265;
            const zwo = sessieNaarZwo(sessie, ftp);
            await intervalsPut(`/events/${sessie.intervalsEventId}`, {
              name: sessie.titel || sessie.type,
              moving_time: (sessie.duur_min || 90) * 60,
              ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
            }, creds);
          }
        } catch (e) {
          console.warn("[verwerkOrigineel] Intervals.icu herstel mislukt:", e.message);
        }
      }
    } else if (sessie.sessie_voor_checkin) {
      // De check-in-modulatie heeft de sessie al ingekort/vervangen vóórdat
      // deze HRV-keuze binnenkwam — herstel de sessie zoals die was vóór die aanpassing.
      const hersteld = {
        ...sessie.sessie_voor_checkin,
        intervalsEventId: sessie.intervalsEventId,
        hrv_keuze_gemaakt: true,
        hrv_keuze: "origineel",
        hrv_override: true,
      };
      delete hersteld.sessie_voor_checkin;
      sessies[idx] = hersteld;

      if (hersteld.intervalsEventId) {
        try {
          const { getIntervalsCredentials } = await import("../users");
          const { intervalsPut } = await import("../intervals");
          const { sessieNaarZwo } = await import("../workoutZwo");
          const creds = await getIntervalsCredentials(userId);
          if (creds) {
            const ftp = seizoensplan?.huidige_ftp || 265;
            const zwo = sessieNaarZwo(hersteld, ftp);
            await intervalsPut(`/events/${hersteld.intervalsEventId}`, {
              name: hersteld.titel || hersteld.type,
              moving_time: (hersteld.duur_min || 90) * 60,
              ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
            }, creds);
          }
        } catch (e) {
          console.warn("[verwerkOrigineel] Intervals.icu herstel mislukt:", e.message);
        }
      }
    } else {
      sessie.hrv_keuze_gemaakt = true;
      sessie.hrv_keuze = "origineel";
      sessie.hrv_override = true;
    }
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
