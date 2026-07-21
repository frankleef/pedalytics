// D4: Critical Power / W'-dataverzameling. intervals.icu berekent en
// onderhoudt zelf een CP/W'-fit (sportSettings[].mmp_model, type
// "FFT_CURVES") — Kesto leest dat model uit, het fit er zelf niets. Zie
// cron/sync/route.js (FTP-sync-blok) voor de enige plek waar dit veld
// vandaan gehaald mag worden: uitsluitend via GET /athlete/{id}, NOOIT via
// het dedicated /athlete/{id}/sport-settings/Ride-endpoint — dat laatste
// retourneert reproduceerbaar null voor mmp_model op hetzelfde record
// (bevestigd via een live API-call, twee keer herhaald).

const CAP_DATAPUNTEN = 20;

function cpWprimeTrendKey(userId) {
  return `cp_wprime_trend:${userId}`;
}

/**
 * Voegt een CP/W'-datapunt toe aan de longitudinale puntenreeks van een
 * gebruiker (criticalPower, wPrime, pMax + modelEftp, allemaal uit hetzelfde
 * mmp_model-object, één gecombineerd punt per datum).
 *
 * LET OP — `modelEftp` (mmp_model.ftp) is uitsluitend een door intervals.icu
 * berekende eFTP-schatting, bedoeld voor referentie/trendanalyse BINNEN deze
 * puntenreeks. Dit veld mag NOOIT gebruikt worden als bron voor
 * plan.huidige_ftp — die wordt uitsluitend bijgewerkt door
 * sessie/ftpUpdate.js (verwerkFtpTest), gevoed door icu_ftp/icu_eftp op
 * activiteitniveau van een daadwerkelijk gedetecteerde ramp-test. FTP is
 * altijd leidend boven deze model-eFTP.
 *
 * Skip-bij-bestaande-datum (i.p.v. hrv/basislijnTrend.js's
 * "laatste-waarde-per-dag-wint"-patroon): cron/sync draait elk uur (zie
 * admin/jobs/page.js), dus zonder deze check zou dit tot 24
 * read-modify-write-cycli per gebruiker per dag leiden voor een waarde die
 * realistisch alleen kan veranderen als er die dag een nieuwe, verwerkte rit
 * bijkomt. basislijnTrend.js se overschrijf-patroon is prima op zijn eigen
 * ~1×-per-dag-cadans (maandag-only HRV-profielherberekening), maar niet
 * geschikt voor een 24×-per-dag-aanroepmoment — dit is dus bewust een ander
 * patroon, geen inconsistentie met ef_trend/hrv_trend.
 *
 * @param {object} kv
 * @param {string} userId
 * @param {{datum: string, criticalPower: number|null, wPrime: number|null, pMax: number|null, modelEftp: number|null}} punt
 * @returns {Promise<Array>} de (eventueel ongewijzigde) puntenreeks
 */
export async function voegCpWprimeDatapuntToe(kv, userId, punt) {
  const key = cpWprimeTrendKey(userId);
  const bestaande = (await kv.get(key)) || [];

  if (bestaande.some(p => p.datum === punt.datum)) return bestaande;

  const bijgewerkt = [...bestaande, punt]
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(-CAP_DATAPUNTEN);
  await kv.set(key, bijgewerkt);
  return bijgewerkt;
}

export async function haalCpWprimeTrendOp(kv, userId) {
  return (await kv.get(cpWprimeTrendKey(userId))) || [];
}
