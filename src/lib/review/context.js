// Blok F, fase 1: contextverzameling voor de periodieke AI-review (2x/dag).
// Bundelt alle bestaande signalen achter één samenstellende functie,
// gegroepeerd per tijdschaal — geen promptstructuur, geen validatie-laag,
// geen cron-endpoint, geen UI (die komen in latere fases). Fase 2 (nog te
// bouwen) leest deze structuur om een voorstel te formuleren, nooit
// automatisch toegepast.
//
// conditiescore (conditie_score:${userId}) is BEWUST uitgesloten: dat signaal
// wordt uitgefaseerd, niet uitgebreid (zie project-memory blok F fase 1).

import { haalComplianceVenster, haalBevrorenWeekInFase, haalLaatsteZwareSessieDatum } from "../sessie/compliance";
import { haalDagelijkseTssReeks, berekenMonotonieEnStrain } from "../sessie/monotonieStrain";
import { leesWeekVoorzichtig } from "../sessie/weekVoorzichtig";
import { haalHrvTrendOp, haalRhrTrendOp, bepaalHrvTrendTrigger, bepaalRhrTrendTrigger } from "../hrv/basislijnTrend";
import { berekenSchoneReferentie, bepaalHerstelsnelheidTrigger, HERSTEL_PLAFOND_DAGEN } from "../hrv/herstelsnelheid";
import { haalEfTrendOp } from "../ef";
import { haalCpWprimeTrendOp } from "../cpWprime";
import { haalRpeDeltaTrend, leesBlokBasisLogBlok, leesBlokBasisLogWeek, berekenBlokIndex } from "../volumeCorrectie";
import { leesDecouplingBaseline } from "../decoupling";
import { leesFitnessprogressie } from "../fitnessprogressieIO";
import { leesRecenteInstortingen } from "../instorting";
import { getIntervalsCredentials } from "../users";
import { intervalsGet } from "../intervals";
import { datumISO, datumOffset } from "../datum";

const EF_BANDEN = ["z2", "sweetspot", "drempel", "vo2max"];

// Venster voor "recente activiteiten" bij segment-instorting — korteTermijn-
// signaal, zelfde orde van grootte als herstelsnelheid se 14-dagen-
// wellnessvenster (geen apart, nieuw getal verzonnen).
const INSTORTING_VENSTER_DAGEN = 14;

/**
 * Signaal 6 (herstelsnelheid): bepaalHerstelsnelheidTrigger is een PURE
 * functie zonder persistentie — vereist verse /wellness-data. Deze wrapper
 * haalt die data live op en berekent de trigger, met dezelfde databron/
 * -vensterkeuzes als het bestaande inline pad in sessie/genereren.js
 * (haalLaatsteZwareSessieDatum -> 14 dagen /wellness vóór die datum ->
 * berekenSchoneReferentie -> bepaalHerstelsnelheidTrigger).
 *
 * FAIL-OPEN VERPLICHT: elke stap (geen credentials, wellness-fetch faalt,
 * geen hrv-profiel) resulteert in { trigger: false, ... } — nooit een
 * geworpen fout, zodat een falende externe fetch verzamelReviewContext niet
 * kan laten crashen.
 *
 * @param {object} kv
 * @param {string} userId
 * @param {object} plan - seizoensplan met .weekSessies.sessies
 * @returns {Promise<{trigger: boolean, zwareSessieDatum: string|null}>}
 */
export async function haalHerstelsnelheidSignaal(kv, userId, plan) {
  try {
    const zwareSessieDatum = haalLaatsteZwareSessieDatum(plan);
    if (!zwareSessieDatum) return { trigger: false, zwareSessieDatum: null };

    const dagenGeleden = Math.floor((new Date() - new Date(zwareSessieDatum)) / 86400000);
    if (dagenGeleden > HERSTEL_PLAFOND_DAGEN) return { trigger: false, zwareSessieDatum };

    const creds = await getIntervalsCredentials(userId);
    if (!creds) return { trigger: false, zwareSessieDatum };

    const veertienDagenVoorSessie = new Date(zwareSessieDatum);
    veertienDagenVoorSessie.setDate(veertienDagenVoorSessie.getDate() - 14);
    const wellnessData = await intervalsGet("/wellness", {
      oldest: datumISO(veertienDagenVoorSessie), newest: datumOffset(0),
    }, creds);

    const genormaliseerd = (wellnessData || [])
      .map(w => ({ ...w, datum: w.id || w.datum }))
      .sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));

    const schoneReferentie = berekenSchoneReferentie(genormaliseerd, zwareSessieDatum);
    const huidigeHrv = genormaliseerd.length > 0 ? genormaliseerd[genormaliseerd.length - 1].hrv ?? null : null;

    const hrvProfielRaw = await kv.get(`hrv-profiel:${userId}`);
    const hrvProfiel = typeof hrvProfielRaw === "string" ? JSON.parse(hrvProfielRaw) : hrvProfielRaw;

    const zwareSessie = (plan?.weekSessies?.sessies || []).find(s => s.datum === zwareSessieDatum);

    const trigger = bepaalHerstelsnelheidTrigger({
      zwareSessieDatum,
      huidigeHrv,
      schoneReferentie,
      sessietype: zwareSessie?.intentie?.sessietype,
      hrvProfiel,
    });

    return { trigger, zwareSessieDatum };
  } catch (e) {
    console.warn(`[review] herstelsnelheid-signaal ophalen mislukt (fail-open):`, e.message);
    return { trigger: false, zwareSessieDatum: null };
  }
}

/** Fail-open-backstop rond één signaal-promise — voorkomt dat een falende kv/fetch de hele Promise.all doet rejecten. */
function veilig(promise, fallback, naam) {
  return promise.catch(e => {
    console.warn(`[review] signaal '${naam}' lezen mislukt (fail-open):`, e?.message);
    return fallback;
  });
}

/**
 * Blok F, fase 1: verzamelt alle review-signalen in één gebatchte
 * Promise.all (zelfde precedent als haalVolumeSignalen, volumeCorrectie.js)
 * en groepeert het resultaat per tijdschaal. conditiescore is uitgesloten
 * (wordt uitgefaseerd). EF-trend is gemarkeerd als monitoring-only: het
 * signaal is zichtbaar maar mag in fase 2 nog niet als basis voor een
 * voorstel dienen (wordt vandaag alleen op blokniveau, elke 4 weken,
 * daadwerkelijk gebruikt — zie bepaalNieuweBlokBasis).
 *
 * Elk individueel signaal is fail-open: een falende of ontbrekende lezing
 * geeft null/[]/false terug en blokkeert de overige signalen of de hele
 * functie niet.
 *
 * @param {object} kv
 * @param {string} userId
 * @param {object} plan - seizoensplan
 * @returns {Promise<{korteTermijn: object, middenTermijn: object, langeTermijn: object}>}
 */
export async function verzamelReviewContext(kv, userId, plan) {
  const blokIndex = berekenBlokIndex(plan);

  const recenteActiviteitIds = (plan?.weekSessies?.sessies || [])
    .filter(s => s.voltooid && s.intervalsEventId && s.datum && s.datum >= datumOffset(-INSTORTING_VENSTER_DAGEN))
    .map(s => s.intervalsEventId);

  const [
    complianceVenster,
    freezeWeekInFase,
    monotonieStrain,
    herstelsnelheid,
    instortingen,
    weekVoorzichtig,
    hrvTrendPunten,
    rhrTrendPunten,
    rpeTrend,
    blokBasisLogWeek,
    decouplingBaseline,
    efZ2, efSweetspot, efDrempel, efVo2max,
    blokBasisLogBlok,
    cpWprimeTrend,
    fitnessprogressie,
  ] = await Promise.all([
    veilig(haalComplianceVenster(userId), null, "compliance-venster"),
    veilig(haalBevrorenWeekInFase(kv, userId, plan), null, "freeze-status"),
    veilig(
      haalDagelijkseTssReeks(userId).then(reeks => (reeks ? berekenMonotonieEnStrain(reeks) : null)),
      null,
      "monotonie/strain"
    ),
    veilig(haalHerstelsnelheidSignaal(kv, userId, plan), { trigger: false, zwareSessieDatum: null }, "herstelsnelheid"),
    veilig(leesRecenteInstortingen(kv, userId, recenteActiviteitIds), [], "segment-instorting"),
    veilig(leesWeekVoorzichtig(kv, userId), false, "week_voorzichtig"),
    veilig(haalHrvTrendOp(kv, userId), [], "hrv-trend"),
    veilig(haalRhrTrendOp(kv, userId), [], "rhr-trend"),
    veilig(haalRpeDeltaTrend(userId), null, "rpe-trend"),
    veilig(leesBlokBasisLogWeek(kv, userId), null, "blok-basis-log-week"),
    veilig(leesDecouplingBaseline(kv, userId), null, "decoupling-baseline"),
    veilig(haalEfTrendOp(kv, userId, "z2"), [], "ef-trend-z2"),
    veilig(haalEfTrendOp(kv, userId, "sweetspot"), [], "ef-trend-sweetspot"),
    veilig(haalEfTrendOp(kv, userId, "drempel"), [], "ef-trend-drempel"),
    veilig(haalEfTrendOp(kv, userId, "vo2max"), [], "ef-trend-vo2max"),
    veilig(leesBlokBasisLogBlok(kv, userId, blokIndex), null, "blok-basis-log-blok"),
    veilig(haalCpWprimeTrendOp(kv, userId), [], "cp-wprime-trend"),
    veilig(leesFitnessprogressie(kv, userId), null, "fitnessprogressie"),
  ]);

  return {
    korteTermijn: {
      freezeStatus: freezeWeekInFase != null ? { actief: true, bevrorenWeekInFase: freezeWeekInFase } : { actief: false },
      weekVoorzichtig,
      monotonieStrain,
      herstelsnelheid,
      segmentInstorting: instortingen,
    },
    middenTermijn: {
      complianceVenster,
      hrvTrend: { punten: hrvTrendPunten, trigger: bepaalHrvTrendTrigger(hrvTrendPunten) },
      rhrTrend: { punten: rhrTrendPunten, trigger: bepaalRhrTrendTrigger(rhrTrendPunten) },
      rpeTrend,
      blokBasisLogWeek,
      decouplingBaseline,
      efTrend: {
        z2: efZ2, sweetspot: efSweetspot, drempel: efDrempel, vo2max: efVo2max,
        // Wekelijks bijgewerkt, maar vandaag alleen op blokniveau gebruikt
        // (D2/D3, elke 4 weken) — fase 2 mag hier nog geen voorstel op baseren.
        monitoringOnly: true,
      },
    },
    langeTermijn: {
      blokBasisLogBlok,
      cpWprimeTrend,
      fitnessprogressie,
    },
  };
}
