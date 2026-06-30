import { getKV } from "./kv";
import { getIntervalsCredentials } from "./users";
import { intervalsGet } from "./intervals";
import { datumOffset } from "./datum";
import { ctlRampRegressie } from "./conditie";
import { weeknummerVoorDatum } from "./weekgrenzen";
import { sendPush } from "./pushNotify";
import { vulSessiesAanVoorGebruiker } from "./sessiesAanvullen";
import { bepaalTrainingsfrequentie } from "./trainingsfrequentie";

// ====== Interne hulpfuncties ======

function datumVoegDagenToe(isoDate, dagen) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + dagen);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dagNaamVanDatum(isoDate) {
  const dag = new Date(isoDate).getDay();
  return ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"][dag];
}

function berekenAankomendeMaandagISO(nu = new Date()) {
  const dag = nu.getDay(); // 0=Zon, 1=Ma, ...6=Za
  const daysUntilMonday = dag === 0 ? 1 : 8 - dag;
  return datumVoegDagenToe(
    `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`,
    daysUntilMonday
  );
}

function berekenZondagISO(maandagISO) {
  return datumVoegDagenToe(maandagISO, 6);
}

function vandaagISO(nu = new Date()) {
  return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`;
}

function berekenAankomendWeekNr(plan) {
  if (!plan?.startdatum) return 2;
  return weeknummerVoorDatum(new Date(), plan.startdatum) + 1;
}

function berekenBlokIndex(plan) {
  if (!plan?.startdatum) return 0;
  const weekNr = weeknummerVoorDatum(new Date(), plan.startdatum);
  return Math.floor((weekNr - 1) / 4);
}

function berekenWeekInBlok(plan) {
  if (!plan?.startdatum) return 1;
  const weekNr = weeknummerVoorDatum(new Date(), plan.startdatum);
  return ((weekNr - 1) % 4) + 1;
}

// ====== Chunk 1: Signaal-ophaalfuncties ======

export async function haalActueleTssDezeWeek(userId, maandagISO) {
  try {
    const creds = await getIntervalsCredentials(userId);
    if (!creds) return null;
    const vandaag = datumVoegDagenToe(maandagISO, 6);
    const activiteiten = await intervalsGet("/activities", {
      oldest: maandagISO,
      newest: vandaag,
      fields: "icu_training_load,type",
    }, creds);
    if (!activiteiten?.length) return null;
    const totaal = activiteiten
      .filter(a => a.type === "Ride" || a.type === "VirtualRide")
      .reduce((som, a) => som + (a.icu_training_load || 0), 0);
    return totaal > 0 ? Math.round(totaal) : null;
  } catch {
    return null;
  }
}

export async function haalRampRate(userId) {
  try {
    const creds = await getIntervalsCredentials(userId);
    if (!creds) return null;

    const wellData = await intervalsGet("/wellness", {
      oldest: datumOffset(-29),
      newest: datumOffset(0),
    }, creds);

    if (!wellData?.length) return null;

    const ctlWaarden = wellData
      .filter(w => w.ctl != null)
      .sort((a, b) => (a.id || "").localeCompare(b.id || ""))
      .map(w => w.ctl);

    if (ctlWaarden.length < 29) return null;

    return ctlRampRegressie(ctlWaarden);
  } catch {
    return null;
  }
}

export async function haalTsbGemiddelde(userId, aantalDagen) {
  try {
    const creds = await getIntervalsCredentials(userId);
    if (!creds) return null;

    const wellData = await intervalsGet("/wellness", {
      oldest: datumOffset(-aantalDagen),
      newest: datumOffset(0),
    }, creds);

    if (!wellData?.length) return null;

    // TSB = form in intervals.icu, fallback op ctl-atl berekening
    const tsbWaarden = wellData
      .map(w => w.form ?? (w.ctl != null && w.atl != null ? w.ctl - w.atl : null))
      .filter(v => v != null);

    if (tsbWaarden.length < 10) return null;

    const som = tsbWaarden.reduce((a, b) => a + b, 0);
    return Math.round((som / tsbWaarden.length) * 10) / 10;
  } catch {
    return null;
  }
}

export async function haalRpeDeltaTrend(userId) {
  // Sleutel geschreven door rpeTrend.js:berekenRpeTrend en workouts/[id]/route.js PUT-handler
  try {
    const kv = getKV();
    const trend = await kv.get(`rpe_trend:${userId}`);
    return trend ?? null;
  } catch {
    return null;
  }
}

export async function haalDecouplingMediaan(userId, aantalRitten) {
  try {
    const kv = getKV();
    const creds = await getIntervalsCredentials(userId);
    if (!creds) return null;

    const plan = await kv.get(`${userId}:seizoensplan`);
    const ftp = plan?.huidige_ftp || 265;

    const activiteiten = await intervalsGet("/activities", {
      oldest: datumOffset(-90),
      newest: datumOffset(0),
      limit: "50",
      fields: "id,type,start_date_local,moving_time,icu_weighted_avg_watts",
    }, creds);

    if (!activiteiten?.length) return null;

    // Filter Z2-ritten (IF 0.55-0.75, duur ≥ 45 min), nieuwste eerst
    const z2Ritten = activiteiten
      .filter(a => {
        if (a.type !== "Ride" && a.type !== "VirtualRide") return false;
        const duurMin = (a.moving_time || 0) / 60;
        if (duurMin < 45) return false;
        if (!a.icu_weighted_avg_watts) return false;
        const ifVal = a.icu_weighted_avg_watts / ftp;
        return ifVal >= 0.55 && ifVal <= 0.75;
      })
      .sort((a, b) => (b.start_date_local || "").localeCompare(a.start_date_local || ""));

    const dcWaarden = [];
    for (const rit of z2Ritten) {
      if (dcWaarden.length >= aantalRitten) break;
      const dc = await kv.get(`decoupling:${rit.id}`);
      if (dc == null) continue;
      const waarde = typeof dc === "number" ? dc : dc?.decoupling;
      const isHitte = typeof dc === "object" && (dc?.hitte_gecorrigeerd ?? false);
      if (waarde != null && !isHitte) dcWaarden.push(waarde);
    }

    if (dcWaarden.length < 3) return null;

    const gesorteerd = [...dcWaarden].sort((a, b) => a - b);
    const mid = Math.floor(gesorteerd.length / 2);
    return gesorteerd.length % 2 === 0
      ? (gesorteerd[mid - 1] + gesorteerd[mid]) / 2
      : gesorteerd[mid];
  } catch {
    return null;
  }
}

export async function haalVolumeSignalen(userId) {
  const [rampRate, tsbGemiddelde14d, rpeDeltaTrend, decouplingMediaan] = await Promise.all([
    haalRampRate(userId),
    haalTsbGemiddelde(userId, 14),
    haalRpeDeltaTrend(userId),
    haalDecouplingMediaan(userId, 3),
  ]);
  return { rampRate, tsbGemiddelde14d, rpeDeltaTrend, decouplingMediaan };
}

// ====== Chunk 2: Beslissingslogica ======

export function bepaalVolumeCorrectie({ rampRate, tsbGemiddelde14d, rpeDeltaTrend, decouplingMediaan }) {
  void decouplingMediaan; // signaal beschikbaar voor toekomstig gebruik

  const rampTeLaag      = rampRate !== null && rampRate < 2.0;
  const rampTeHoog      = rampRate !== null && rampRate > 7.0;
  // > +5 = fresh/transition: te weinig prikkel, sporter zit boven grey zone
  const tsbTePositief   = tsbGemiddelde14d !== null && tsbGemiddelde14d > 5;
  // < -30 = risk zone: onder optimal, ophoping richting overtraining
  const tsbTeNegatief   = tsbGemiddelde14d !== null && tsbGemiddelde14d < -30;
  const adaptatieSlecht = rpeDeltaTrend !== null && rpeDeltaTrend > 1.0;

  const omhoog = (rampTeLaag || tsbTePositief) && !adaptatieSlecht && !tsbTeNegatief;
  const omlaag = tsbTeNegatief || (rampTeHoog && adaptatieSlecht);

  if (omhoog) {
    if (rampTeLaag && tsbGemiddelde14d > 15) return { richting: "omhoog", pct: 0.12 };
    if (rampTeLaag || tsbGemiddelde14d > 8)  return { richting: "omhoog", pct: 0.07 };
    return { richting: "omhoog", pct: 0.05 };
  }

  if (omlaag) {
    if (tsbTeNegatief && tsbGemiddelde14d < -40) return { richting: "omlaag", pct: 0.12 };
    if (tsbTeNegatief) return { richting: "omlaag", pct: 0.08 };
    return { richting: "omlaag", pct: 0.05 };
  }

  return { richting: "geen", pct: 0 };
}

export function bepaalNieuweBlokBasis({ huidigePiekweekTss, signalen, ervaringsniveau, blokIndex }) {
  const interBlokGroei = {
    starter:    [0.08, 0.08],
    recreatief: [0.10, 0.12],
    getraind:   [0.12, 0.15],
  }[ervaringsniveau] || [0.10, 0.12];

  const gepland = interBlokGroei[Math.min(blokIndex, interBlokGroei.length - 1)];
  let nieuweBasis = huidigePiekweekTss * (1 + gepland);

  const correctie = bepaalVolumeCorrectie(signalen);
  if (correctie.richting === "omhoog") {
    nieuweBasis *= (1 + correctie.pct);
  } else if (correctie.richting === "omlaag") {
    nieuweBasis *= (1 - correctie.pct);
  }

  const max = huidigePiekweekTss * 1.20;
  const min = huidigePiekweekTss * 0.80;
  return Math.round(Math.max(min, Math.min(max, nieuweBasis)));
}

// ====== Chunk 3: Timing en deduplicatie ======

export function haalIsoWeeknummer(datum) {
  const d = new Date(datum);
  // ISO 8601: week begint op maandag, week met eerste donderdag = week 1
  const dag = d.getDay() || 7; // Zondag (0) → 7
  d.setDate(d.getDate() + 4 - dag); // Verschuif naar dichtstbijzijnde donderdag
  const startJaar = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - startJaar) / 86400000 + 1) / 7);
}

export async function isWekelijkseCheckVerschuldigd(userId, nu = new Date()) {
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  });
  const parts = formatter.formatToParts(nu);
  const weekdag = parts.find(p => p.type === "weekday").value;
  const uur     = parseInt(parts.find(p => p.type === "hour").value);
  const minuut  = parseInt(parts.find(p => p.type === "minute").value);

  if (weekdag !== "zo") return false;
  if (uur < 21 || (uur === 21 && minuut < 30)) return false;

  // Atomische claim via nx: true — voorkomt race condition bij gelijktijdige cron-runs.
  // Alleen de invocation die als eerste de vlag zet, mag de evaluatie uitvoeren.
  const weekNr = haalIsoWeeknummer(nu);
  const kv = getKV();
  const claimKey = `weekcheck_gedaan:${userId}:${weekNr}`;
  const geclaimd = await kv.set(claimKey, "1", { nx: true, ex: 8 * 86400 });
  return geclaimd != null;
}

export async function checkEnZetWeekVlag(userId, isoWeeknummer) {
  const kv = getKV();
  const vlag = await kv.get(`weekcheck_gedaan:${userId}:${isoWeeknummer}`);
  return vlag != null;
}

// ====== Chunk 4: Volume-aanpassing bepalen ======

export function bepaalVolumeAanpassing({ plan, aankomendWeek, correctie, signalen, geplandeTssDezeWeek = null }) {
  // Basis = geplande TSS van de HUIDIGE week (kader), niet de aankomende week.
  // Voorkomt dat een inflated kader-doel voor volgende week de berekening verstoort.
  const basis = (geplandeTssDezeWeek != null && geplandeTssDezeWeek > 0)
    ? geplandeTssDezeWeek
    : (aankomendWeek?.tss_doel || 300);

  let nieuwTssDoel;
  if (correctie.richting === "omhoog") {
    nieuwTssDoel = Math.round(basis * (1 + correctie.pct));
  } else if (correctie.richting === "omlaag") {
    nieuwTssDoel = Math.round(basis * (1 - correctie.pct));
  } else {
    nieuwTssDoel = basis;
  }

  // Harde grenzen obv basis
  nieuwTssDoel = Math.max(
    Math.round(basis * 0.60),
    Math.min(Math.round(basis * 1.20), nieuwTssDoel)
  );

  if (correctie.richting !== "omhoog") {
    return { nieuwTssDoel, acties: [] };
  }

  // Volume omhoog: bepaal aanpassingsvolgorde (38-D)
  const acties = [];
  const nu = new Date();
  const maandagISO = berekenAankomendeMaandagISO(nu);
  const zondagISO = berekenZondagISO(maandagISO);

  const beschikbareDagen = Object.entries(plan.beschikbaarheid || {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  const urenPerDag = plan.urenPerDag || {};
  const bestaandeSessies = plan.weekSessies?.sessies || [];

  const weekDatums = Array.from({ length: 7 }, (_, i) => datumVoegDagenToe(maandagISO, i));

  const sessiesInWeek = bestaandeSessies.filter(s =>
    s.datum >= maandagISO && s.datum <= zondagISO && !s.voltooid
  );
  const bezetteDatums = new Set(sessiesInWeek.map(s => s.datum));

  // Stap 1: beschikbare dag zonder sessie én voldoende TSS-ruimte (≥40 TSS ≈ 60 min Z2)
  const MIN_TSS_VOOR_NIEUWE_DAG = 40;
  const vrijeDagen = weekDatums.filter(datum => {
    const naam = dagNaamVanDatum(datum);
    if (!beschikbareDagen.includes(naam) || bezetteDatums.has(datum)) return false;
    const dagUren = urenPerDag[naam] || 1.5;
    const geschatteTss = dagUren * 0.65 * 0.65 * 100;
    return geschatteTss >= MIN_TSS_VOOR_NIEUWE_DAG;
  });

  if (vrijeDagen.length > 0) {
    acties.push({ type: "nieuwe_dag", datum: vrijeDagen[0] });
    return { nieuwTssDoel, acties };
  }

  // Stap 2: verleng bestaande sessies (langste eerst, 48u-regel)
  const teVerlengeSessies = sessiesInWeek
    .filter(s => {
      const naam = dagNaamVanDatum(s.datum);
      const maxUren = urenPerDag[naam] || 1.5;
      const huidigeUren = (s.duur_min || 90) / 60;
      if (huidigeUren >= maxUren) return false;

      // 48u-regel: geen sessie grenst aan intensiteitsdag
      const sDagIdx = new Date(s.datum).getDay();
      const heeftIntensieveBuur = sessiesInWeek.some(bs => {
        if (bs.datum === s.datum) return false;
        const bDagIdx = new Date(bs.datum).getDay();
        const diff = Math.abs(bDagIdx - sDagIdx);
        const aaneengrenzend = diff === 1 || diff === 6;
        return aaneengrenzend && bs.intentie?.rol === "intensiteitsdag";
      });
      return !heeftIntensieveBuur;
    })
    .sort((a, b) => (b.duur_min || 90) - (a.duur_min || 90));

  if (teVerlengeSessies.length > 0) {
    const sessie = teVerlengeSessies[0];
    const naam = dagNaamVanDatum(sessie.datum);
    const maxUren = urenPerDag[naam] || 1.5;
    const huidigeUren = (sessie.duur_min || 90) / 60;
    acties.push({
      type: "verleng_sessie",
      datum: sessie.datum,
      extraMinuten: Math.round((maxUren - huidigeUren) * 60),
      maxMinuten: Math.round(maxUren * 60),
    });
    return { nieuwTssDoel, acties };
  }

  // Stap 3: tempo-afsluiter (Z3-blok aan Z2-sessie)
  const blokIndex = berekenBlokIndex(plan);
  const weekInBlok = berekenWeekInBlok(plan);
  const eersteBlokVroeg = blokIndex === 0 && weekInBlok <= 2;

  if (
    !eersteBlokVroeg &&
    signalen.decouplingMediaan !== null && signalen.decouplingMediaan < 10 &&
    signalen.rpeDeltaTrend !== null && signalen.rpeDeltaTrend < -0.5
  ) {
    const z2Sessie = sessiesInWeek.find(s =>
      (s.intentie?.sessietype || s.type || "").startsWith("z2")
    );
    if (z2Sessie) {
      acties.push({ type: "tempo_afsluiter", datum: z2Sessie.datum });
    }
  }

  return { nieuwTssDoel, acties };
}

// ====== Chunk 5: Wekelijkse evaluatie uitvoering ======

export async function voerWekelijkseEvaluatieUit(userId, { forceer = false } = {}) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;

  // KV-deduplicatiecheck (overgeslagen bij forceer=true)
  const nu = new Date();
  const weekNrCheck = haalIsoWeeknummer(nu);
  if (!forceer) {
    const alGedaan = await kv.get(`weekcheck_gedaan:${userId}:${weekNrCheck}`);
    if (alGedaan) {
      console.log(`[volumecorrectie] ${userId}: week ${weekNrCheck} al uitgevoerd`);
      return { overgeslagen: true, reden: "al uitgevoerd deze week" };
    }
  }

  const plan = await kv.get(planKey);
  if (!plan?.kader) {
    console.log(`[volumecorrectie] ${userId}: geen plan`);
    return { overgeslagen: true, reden: "geen plan" };
  }

  const maandagISO = berekenAankomendeMaandagISO(nu);
  const zondagISO = berekenZondagISO(maandagISO);
  const aankomendWeekNr = berekenAankomendWeekNr(plan);
  const aankomendWeek = plan.kader?.find(w => w.week === aankomendWeekNr);
  const weekNr = haalIsoWeeknummer(new Date(maandagISO));

  if (!aankomendWeek) {
    console.log(`[volumecorrectie] ${userId}: week ${aankomendWeekNr} niet in kader`);
    return { overgeslagen: true, reden: `week ${aankomendWeekNr} niet in kader` };
  }

  // Geen correctie in herstelweek of taper
  if (aankomendWeek.weektype === "herstel") {
    console.log(`[volumecorrectie] ${userId}: week ${aankomendWeekNr} is herstelweek — overgeslagen`);
    return { overgeslagen: true, reden: "aankomende week is herstelweek" };
  }
  if (aankomendWeekNr >= (plan.tijdshorizon_weken || 13)) {
    console.log(`[volumecorrectie] ${userId}: week ${aankomendWeekNr} is taper/eindweek — overgeslagen`);
    return { overgeslagen: true, reden: "taper/eindweek" };
  }

  const huidigeWeekNr = aankomendWeekNr - 1;
  const huidigeWeek = plan.kader?.find(w => w.week === huidigeWeekNr);
  const geplandeTssDezeWeek = huidigeWeek?.tss_doel ?? null;

  const signalen = await haalVolumeSignalen(userId);
  const correctie = bepaalVolumeCorrectie(signalen);

  console.log(`[volumecorrectie] ${userId}: geplande TSS huidige week=${geplandeTssDezeWeek}, kader aankomend=${aankomendWeek.tss_doel}`);

  if (correctie.richting === "geen") {
    console.log(`[volumecorrectie] ${userId}: geen aanpassing nodig (week ${weekNr})`);
    await kv.set(`volumecorrectie_log:${userId}:${weekNr}`, {
      weeknummer: weekNr, uitgevoerd: new Date().toISOString(),
      richting: "geen", pct: 0, signalen, geplandeTssDezeWeek,
      oudTssDoel: aankomendWeek.tss_doel, nieuwTssDoel: aankomendWeek.tss_doel,
    }, { ex: 90 * 86400 });
    if (!forceer) await kv.set(`weekcheck_gedaan:${userId}:${weekNr}`, "1", { ex: 8 * 86400 });
    return { richting: "geen", signalen, oudTssDoel: aankomendWeek.tss_doel, nieuwTssDoel: aankomendWeek.tss_doel };
  }

  const oudTssDoel = aankomendWeek.tss_doel;
  const aanpassing = bepaalVolumeAanpassing({ plan, aankomendWeek, correctie, signalen, geplandeTssDezeWeek });

  // Pas tss_doel aan in kader
  const kaderIdx = plan.kader.findIndex(w => w.week === aankomendWeekNr);
  if (kaderIdx >= 0) {
    plan.kader[kaderIdx] = { ...plan.kader[kaderIdx], tss_doel: aanpassing.nieuwTssDoel };
  }

  // Verwijder niet-voltooide toekomstige sessies van aankomende week (worden opnieuw gegenereerd)
  const morgendatum = datumVoegDagenToe(vandaagISO(nu), 1);
  if (plan.weekSessies?.sessies) {
    plan.weekSessies.sessies = plan.weekSessies.sessies.filter(s => {
      if (!s.datum || s.voltooid) return true;
      const inAankomendWeek = s.datum >= maandagISO && s.datum <= zondagISO;
      return !(inAankomendWeek && s.datum >= morgendatum);
    });
  }

  await kv.set(planKey, plan);

  // Regenereer sessies direct na verwijdering, met volumecorrectie-context
  try {
    const aerobeDagen = aanpassing.acties
      .filter(a => a.type === "nieuwe_dag")
      .map(a => a.datum);
    const tempoAfsluiters = aanpassing.acties
      .filter(a => a.type === "tempo_afsluiter")
      .map(a => a.datum);
    const verlengingen = aanpassing.acties
      .filter(a => a.type === "verleng_sessie")
      .map(a => ({ datum: a.datum, maxMinuten: a.maxMinuten }));
    await vulSessiesAanVoorGebruiker(userId, { aerobeDagen, tempoAfsluiters, verlengingen });
  } catch (e) {
    console.error(`[volumecorrectie] Sessieregeneratie mislukt voor ${userId}:`, e.message);
    throw e;
  }

  // Push-notificatie (niet bij forceer=true — dit is een handmatige test)
  if (!forceer) {
    const notificatieTekst = correctie.richting === "omhoog"
      ? "Je sessies zijn iets uitgebreid — je lichaam kan meer aan dan je plan vroeg."
      : "Je sessies zijn iets rustiger gemaakt — je lichaam heeft wat meer herstelruimte nodig.";
    sendPush(userId, { title: "Plan bijgewerkt", body: notificatieTekst, url: "/?tab=schema" })
      .catch(e => console.warn(`[volumecorrectie] Push mislukt:`, e.message));
  }

  // Log
  await kv.set(`volumecorrectie_log:${userId}:${weekNr}`, {
    weeknummer: weekNr, uitgevoerd: new Date().toISOString(),
    richting: correctie.richting, pct: correctie.pct, signalen, geplandeTssDezeWeek,
    oudTssDoel, nieuwTssDoel: aanpassing.nieuwTssDoel,
    acties: aanpassing.acties,
  }, { ex: 90 * 86400 });

  // KV-vlag (niet bij forceer=true zodat echte evaluatie later nog kan draaien)
  if (!forceer) await kv.set(`weekcheck_gedaan:${userId}:${weekNr}`, "1", { ex: 8 * 86400 });

  console.log(`[volumecorrectie] ${userId}: week ${weekNr} ${correctie.richting} ${Math.round(correctie.pct * 100)}% — gepland ${geplandeTssDezeWeek} / kader aankomend ${oudTssDoel} → ${aanpassing.nieuwTssDoel}`);
  return {
    richting: correctie.richting, pct: correctie.pct, signalen, geplandeTssDezeWeek,
    oudTssDoel, nieuwTssDoel: aanpassing.nieuwTssDoel,
    acties: aanpassing.acties,
  };
}

// ====== Chunk 6: Herstelweek-evaluatie (blok-ijkmoment) ======

export async function voerHerstelweekEvaluatieUit(userId) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;

  const plan = await kv.get(planKey);
  if (!plan?.kader || !plan.startdatum) {
    console.log(`[blokcheck] ${userId}: geen plan of startdatum`);
    return;
  }

  const nu = new Date();
  const maandagISO = berekenAankomendeMaandagISO(nu);
  const weekNr = haalIsoWeeknummer(new Date(maandagISO));

  const huidigeWeekNr = weeknummerVoorDatum(nu, plan.startdatum);
  const blokIndex = Math.floor((huidigeWeekNr - 1) / 4); // 0-gebaseerd

  // Piekweek TSS van het zojuist afgesloten blok
  const blokStartWeek = blokIndex * 4 + 1;
  const blokOpbouwWeken = plan.kader.filter(w =>
    w.week >= blokStartWeek && w.week < blokStartWeek + 3 && w.weektype !== "herstel"
  );

  if (blokOpbouwWeken.length === 0) {
    console.log(`[blokcheck] ${userId}: geen opbouwweken in blok ${blokIndex}`);
    await kv.set(`weekcheck_gedaan:${userId}:${weekNr}`, "1", { ex: 8 * 86400 });
    return;
  }

  const huidigePiekweekTss = Math.max(...blokOpbouwWeken.map(w => w.tss_doel || 0));
  const ervaringsniveau = plan.ervaringsniveau || "recreatief";

  const signalen = await haalVolumeSignalen(userId);

  // Trainingsfrequentie bepalen voor het aankomende blok
  const beschikbareCount = Object.values(plan.beschikbaarheid || {}).filter(Boolean).length;
  // Wellness ophalen voor actuele TSB
  let tsbNu = signalen.tsbGemiddelde14d;
  try {
    const creds = await getIntervalsCredentials(userId);
    if (creds) {
      const vandaagStr = datumOffset(0);
      const wData = await intervalsGet("/wellness", { oldest: vandaagStr, newest: vandaagStr }, creds);
      if (wData?.length > 0 && wData[0].icu_form != null) tsbNu = wData[0].icu_form;
    }
  } catch {}

  const trainingsfrequentie = bepaalTrainingsfrequentie({
    ctl: plan.huidige_ctl ?? 40,
    tsb: tsbNu,
    rpeDeltaTrend: signalen.rpeDeltaTrend,
    decouplingMediaan: signalen.decouplingMediaan,
    beschikbareDagen: beschikbareCount,
  });

  const nieuweBasis = bepaalNieuweBlokBasis({ huidigePiekweekTss, signalen, ervaringsniveau, blokIndex });

  const opbouwPct = { starter: 0.05, recreatief: 0.10, getraind: 0.15 }[ervaringsniveau] || 0.10;
  const herstelweekPct = { starter: 0.40, recreatief: 0.50, getraind: 0.60 }[ervaringsniveau] || 0.50;

  // Aankomend blok weeknummers
  const volgendBlokStart = (blokIndex + 1) * 4 + 1;
  const volgendBlokOpbouwNrs = [volgendBlokStart, volgendBlokStart + 1, volgendBlokStart + 2];
  const volgendBlokHerstelNr = volgendBlokStart + 3;

  // Herbereken tss_doel voor opbouwweken van aankomend blok + sla trainingsfrequentie op
  volgendBlokOpbouwNrs.forEach((weekNrTarget, i) => {
    const idx = plan.kader.findIndex(w => w.week === weekNrTarget);
    if (idx < 0) return;
    plan.kader[idx] = {
      ...plan.kader[idx],
      tss_doel: Math.round(nieuweBasis * Math.pow(1 + opbouwPct, i)),
      trainingsfrequentie,
    };
  });

  // Herstelweek van aankomend blok
  const piekWeekTssNieuw = Math.round(nieuweBasis * Math.pow(1 + opbouwPct, 2));
  const herstelIdx = plan.kader.findIndex(w => w.week === volgendBlokHerstelNr);
  if (herstelIdx >= 0) {
    plan.kader[herstelIdx] = {
      ...plan.kader[herstelIdx],
      tss_doel: Math.round(piekWeekTssNieuw * herstelweekPct),
      trainingsfrequentie,
    };
  }

  // Verwijder niet-voltooide sessies van week 1 van aankomend blok
  const planStart = new Date(plan.startdatum);
  const week1Dag = new Date(planStart);
  week1Dag.setDate(planStart.getDate() + (volgendBlokStart - 1) * 7);
  const week1MaandagISO = `${week1Dag.getFullYear()}-${String(week1Dag.getMonth() + 1).padStart(2, "0")}-${String(week1Dag.getDate()).padStart(2, "0")}`;
  const week1ZondagISO = berekenZondagISO(week1MaandagISO);

  if (plan.weekSessies?.sessies) {
    plan.weekSessies.sessies = plan.weekSessies.sessies.filter(s => {
      if (!s.datum || s.voltooid) return true;
      return !(s.datum >= week1MaandagISO && s.datum <= week1ZondagISO);
    });
  }

  await kv.set(planKey, plan);

  // Push-notificatie
  const correctie = bepaalVolumeCorrectie(signalen);
  if (correctie.richting !== "geen") {
    const tekst = correctie.richting === "omlaag"
      ? "Nieuw blok gestart met iets minder volume — rustige opbouw is nu het juiste tempo."
      : "Nieuw blok gestart met iets meer volume — je hebt het vorige blok goed verwerkt.";
    sendPush(userId, { title: "Nieuw trainingsblok", body: tekst, url: "/?tab=schema" })
      .catch(e => console.warn(`[blokcheck] Push mislukt:`, e.message));
  }

  // Log
  await kv.set(`blokcheck_log:${userId}:${blokIndex}`, {
    blokIndex, uitgevoerd: new Date().toISOString(),
    oudeBasis: huidigePiekweekTss,
    nieuweBasis,
    richting: correctie.richting,
    pct: correctie.pct,
    signalen,
  }, { ex: 180 * 86400 });

  // KV-vlag (voorkomt dat wekelijkse evaluatie daarna alsnog draait)
  await kv.set(`weekcheck_gedaan:${userId}:${weekNr}`, "1", { ex: 8 * 86400 });

  console.log(`[blokcheck] ${userId}: blok ${blokIndex} → ${blokIndex + 1}, basis ${huidigePiekweekTss} → ${nieuweBasis} (${correctie.richting})`);
}
