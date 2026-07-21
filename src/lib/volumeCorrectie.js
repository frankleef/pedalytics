import { getKV } from "./kv";
import { getIntervalsCredentials } from "./users";
import { intervalsGet } from "./intervals";
import { datumOffset } from "./datum";
import { weeknummerVoorDatum } from "./weekgrenzen";
import { maakMelding } from "./meldingen";
import { vulSessiesAanVoorGebruiker } from "./sessiesAanvullen";
import { bepaalTrainingsfrequentie } from "./trainingsfrequentie";
import { haalComplianceVenster } from "./sessie/compliance";
import { haalEfTrendOp, berekenEFTrend } from "./ef";
import { haalHrvTrendOp, haalRhrTrendOp } from "./hrv/basislijnTrend";
import { berekenLineaireTrendPerWeek } from "./trend";
import { DECOUPLING_BLOKTREND_DREMPEL } from "./decoupling";

// ====== Interne hulpfuncties ======

function datumVoegDagenToe(isoDate, dagen) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + dagen);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Geëxporteerd (was intern) zodat src/lib/review/validatie.js (Blok F, fase 3)
// dezelfde dag-naam-afleiding gebruikt als Stap 1 hieronder (MIN_TSS_VOOR_NIEUWE_DAG-
// schatting), i.p.v. een eigen kopie van deze array te maken.
export function dagNaamVanDatum(isoDate) {
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

// Geëxporteerd (was intern) zodat src/lib/review/context.js dezelfde,
// canonieke blokIndex-afleiding kan hergebruiken voor leesBlokBasisLogBlok
// i.p.v. de weeknummer/4-logica daar te dupliceren.
export function berekenBlokIndex(plan) {
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

    // Rechtstreeks intervals.icu's eigen rampRate i.p.v. een lokale regressie — zie
    // ramp-rate-fix-en-impact.md, Deel A. Klein venster (7 dagen) volstaat, we hebben alleen
    // de meest recente dag met een rampRate-waarde nodig.
    const wellData = await intervalsGet("/wellness", {
      oldest: datumOffset(-7),
      newest: datumOffset(0),
      fields: "id,ctl,atl,rampRate",
    }, creds);

    if (!wellData?.length) return null;

    const dagen = wellData
      .filter(w => w.rampRate != null)
      .sort((a, b) => (a.id || "").localeCompare(b.id || ""));

    if (!dagen.length) return null;

    return dagen[dagen.length - 1].rampRate;
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

// STAP 3 — eigen blok-drempel voor de HRV/RHR-bloktrend, BEWUST NIET hetzelfde
// als B6's TREND_DREMPEL_PCT (hrv/basislijnTrend.js, 5%/21-dagen-geëxtrapoleerd,
// gebruikt voor de dagelijkse hrvTrendTrigger/rhrTrendTrigger). Een volume-blok
// duurt hier 4 weken, geen 21 dagen — de wekelijkse regressie-helling
// (hellingPerWeek) wordt daarom RECHTSTREEKS als percentage van de laatste
// waarde vergeleken, zonder eerst naar een geëxtrapoleerd N-dagen-venster om te
// rekenen (dat zou de bloktoets impliciet strenger/losser maken afhankelijk
// van welk venster je zou kiezen, ook al is de onderliggende ernst gelijk
// bedoeld aan B6's drempel).
export const BLOK_TREND_DREMPEL_PCT = 1.7;

// Verplaatst van functie-lokaal naar moduleniveau (was intern in
// bepaalVolumeAanpassing) en geëxporteerd zodat src/lib/review/prompt.js
// (Blok F, fase 2) deze drempel kan citeren i.p.v. een eigen kopie. Puur een
// scope-verplaatsing — waarde en gebruik in bepaalVolumeAanpassing ongewijzigd.
export const MIN_TSS_VOOR_NIEUWE_DAG = 40;

export function bepaalVolumeCorrectie({
  rampRate, tsbGemiddelde14d, rpeDeltaTrend, decouplingMediaan,
  efTrendPct = null, hrvBloktrendPct = null, rhrBloktrendPct = null,
}) {
  const rampTeLaag      = rampRate !== null && rampRate < 2.0;
  const rampTeHoog      = rampRate !== null && rampRate > 7.0;
  // > +5 = fresh/transition: te weinig prikkel, sporter zit boven grey zone
  const tsbTePositief   = tsbGemiddelde14d !== null && tsbGemiddelde14d > 5;
  // < -20 = risk zone. LET OP: dit is een 14-daags gemiddelde, geen actuele TSB — de
  // gangbare "-30 = risk zone"-vuistregel geldt voor de actuele waarde en is op een 14-daags
  // gemiddelde vrijwel onbereikbaar (vereist ~2 aaneengesloten weken zware overbelasting).
  // -30 (t/m 11 juli 2026) bleek daardoor in de praktijk niet te triggeren; -20 is een
  // tussenwaarde, geen definitief herijkte drempel — verifieer via
  // /api/debug/volumecorrectie-log zodra er weer live data is. Zie ramp-rate-fix-en-impact.md.
  const tsbTeNegatief   = tsbGemiddelde14d !== null && tsbGemiddelde14d < -20;
  const adaptatieSlecht = rpeDeltaTrend !== null && rpeDeltaTrend > 1.0;

  // STAP 1 — zelfde drempel als checkFaseOvergang (decoupling.js): DECOUPLING_BLOKTREND_DREMPEL, geïmporteerd.
  const decouplingSlecht = decouplingMediaan !== null && decouplingMediaan > DECOUPLING_BLOKTREND_DREMPEL;

  // STAP 2 — dalende EF-trend (minder watt voor dezelfde hartslag/band over
  // tijd) betekent dat het blok niet de bedoelde aerobe aanpassing oplevert.
  const efTrendSlecht = efTrendPct !== null && efTrendPct < 0;

  // STAP 3 — zie BLOK_TREND_DREMPEL_PCT hierboven voor de rationale.
  const hrvBloktrendSlecht = hrvBloktrendPct !== null && hrvBloktrendPct < -BLOK_TREND_DREMPEL_PCT;
  const rhrBloktrendSlecht = rhrBloktrendPct !== null && rhrBloktrendPct > BLOK_TREND_DREMPEL_PCT;

  // De vier nieuwe "slecht"-signalen blokkeren omhoog op dezelfde manier als
  // adaptatieSlecht dat al deed (niet alleen tsbTeNegatief) — incoherent om
  // volume te verhogen terwijl decoupling/EF/HRV-RHR net aangeven dat het
  // vorige blok niet goed verwerkt werd.
  const omhoog = (rampTeLaag || tsbTePositief) && !adaptatieSlecht && !tsbTeNegatief &&
    !decouplingSlecht && !efTrendSlecht && !hrvBloktrendSlecht && !rhrBloktrendSlecht;
  const omlaag = tsbTeNegatief || (rampTeHoog && adaptatieSlecht) ||
    decouplingSlecht || efTrendSlecht || hrvBloktrendSlecht || rhrBloktrendSlecht;

  if (omhoog) {
    if (rampTeLaag && tsbGemiddelde14d > 15) return { richting: "omhoog", pct: 0.12 };
    if (rampTeLaag || tsbGemiddelde14d > 8)  return { richting: "omhoog", pct: 0.07 };
    return { richting: "omhoog", pct: 0.05 };
  }

  if (omlaag) {
    if (tsbTeNegatief && tsbGemiddelde14d < -30) return { richting: "omlaag", pct: 0.12 };
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
      // Sectie 51-C: ramp_test is structureel onaantastbaar — vast protocol,
      // geen archetype/segmenten om te verlengen (genereerSessieDag zou falen).
      if (s.intentie?.sessietype === "ramp_test") return false;
      const naam = dagNaamVanDatum(s.datum);
      const maxUren = urenPerDag[naam] || 1.5;
      const huidigeUren = (s.duur_min || 90) / 60;
      if (huidigeUren >= maxUren) return false;

      // Kalenderlijk-direct-aangrenzende-dag-regel: geen sessie grenst aan een
      // intensiteitsdag. Echte datumverschil-berekening (in kalenderdagen),
      // NIET dag-van-de-week-index — die laatste had een bug: zondag(0) en
      // maandag(1) van DEZELFDE week hebben indexverschil 1 ("aangrenzend")
      // maar liggen in werkelijkheid 6 kalenderdagen (144u) uit elkaar.
      // Bewust nog steeds een SMALLERE check dan isBinnen48uVanAndereZwareSessie
      // (compliance.js) — alleen de exact aangrenzende kalenderdag (1 dag),
      // geen volledige 48u-tijdsberekening; geen consolidatie daarnaartoe.
      const heeftIntensieveBuur = sessiesInWeek.some(bs => {
        if (bs.datum === s.datum) return false;
        const dagVerschil = Math.abs(new Date(bs.datum) - new Date(s.datum)) / 86400000;
        return dagVerschil === 1 && bs.intentie?.rol === "intensiteitsdag";
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

  // Melding (geen push — routinematige wekelijkse bijsturing hoeft de gebruiker
  // niet buiten de app te onderbreken; niet bij forceer=true, dit is een handmatige test)
  if (!forceer) {
    const notificatieTekst = correctie.richting === "omhoog"
      ? "Je sessies zijn iets uitgebreid — je lichaam kan meer aan dan je plan vroeg."
      : "Je sessies zijn iets rustiger gemaakt — je lichaam heeft wat meer herstelruimte nodig.";
    maakMelding(userId, "volumecorrectie", { tekst: notificatieTekst })
      .catch(e => console.warn(`[volumecorrectie] Melding-aanmaak mislukt:`, e.message));
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

// STAP 2 — band-selectie voor de EF-trend: de fase van de EERSTE opbouwweek
// van het net-afgesloten blok (blokOpbouwWeken, hieronder al bepaald voor de
// piekweek-tss). "overgangsfase"/"consolidatie"/"test" hebben geen dominant
// intensiteitstype en dus geen 1-op-1 EF-band -> geen EF-signaal die cyclus
// (bestaand fail-open-patroon, geen crash/blokkade).
const FASE_NAAR_EF_BAND = { basis: "z2", sweetspot: "sweetspot", drempel: "drempel" };

function bepaalBlokEfBand(blokOpbouwWeken) {
  const fase = blokOpbouwWeken[0]?.fase;
  return FASE_NAAR_EF_BAND[fase] ?? null;
}

// STAP 3 — HRV/RHR-bloktrend RECHTSTREEKS uit hellingPerWeek (geen
// dagen-extrapolatie zoals B6's bepaalTrendTrigger in hrv/basislijnTrend.js
// doet), uitgedrukt als percentage van de meest recente waarde. Fail-open
// (null) bij <4 punten — bestaand gedrag van berekenLineaireTrendPerWeek.
function berekenBloktrendPct(punten) {
  const resultaat = berekenLineaireTrendPerWeek((punten || []).map(p => ({ datum: p.datum, waarde: p.basislijn })));
  if (resultaat == null || !resultaat.laatsteWaarde) return null;
  return (resultaat.hellingPerWeek / resultaat.laatsteWaarde) * 100;
}

// STAP 4 — compliance-poort: venster = één blok (4 weken = 28 dagen), niet
// C1/C3's vaste 10-dagenvenster en niet C4's faseStartdatum-venster (die is
// specifiek voor de fase-verlengingsbeslissing, zie D1-comment in
// sessie/compliance.js) — dit evalueert het zojuist afgesloten volume-blok.
// Drempel (>=2 niet-geleverd) is dezelfde als evalueerComplianceGate's C4-drempel.
const BLOK_COMPLIANCE_VENSTER_DAGEN = 28;
const BLOK_COMPLIANCE_ONVOLDOENDE_DREMPEL = 2;

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

  // STAP 4 — compliance-poort: bij onvoldoende geleverde kernsessies in het
  // zojuist afgesloten blok worden decoupling/EF-trend/HRV-RHR-bloktrend voor
  // deze cyclus als niet-beschikbaar (null) behandeld — exact hetzelfde
  // fail-open-patroon als bepaalVolumeCorrectie nu al hanteert voor elk
  // signaal dat null is. rampRate/tsb/rpeDeltaTrend blijven ongemoeid (die
  // vallen buiten deze poort, zie D1-beslissing in de opdracht).
  const complianceVenster = await haalComplianceVenster(userId, BLOK_COMPLIANCE_VENSTER_DAGEN);
  const voldoendeCompliant = complianceVenster.nietGeleverd < BLOK_COMPLIANCE_ONVOLDOENDE_DREMPEL;

  const efBand = bepaalBlokEfBand(blokOpbouwWeken);
  const efTrendPct = (voldoendeCompliant && efBand)
    ? berekenEFTrend(await haalEfTrendOp(kv, userId, efBand))
    : null;
  const hrvBloktrendPct = voldoendeCompliant
    ? berekenBloktrendPct(await haalHrvTrendOp(kv, userId))
    : null;
  const rhrBloktrendPct = voldoendeCompliant
    ? berekenBloktrendPct(await haalRhrTrendOp(kv, userId))
    : null;

  const blokSignalen = {
    ...signalen,
    decouplingMediaan: voldoendeCompliant ? signalen.decouplingMediaan : null,
    efTrendPct,
    hrvBloktrendPct,
    rhrBloktrendPct,
  };

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

  const nieuweBasis = bepaalNieuweBlokBasis({ huidigePiekweekTss, signalen: blokSignalen, ervaringsniveau, blokIndex });

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

  // Melding + push — dit is een echte blokgrens (zwaarder dan routinematige
  // wekelijkse volumecorrectie), verdient dus wel een eigen pushmoment.
  const correctie = bepaalVolumeCorrectie(blokSignalen);
  if (correctie.richting !== "geen") {
    const tekst = correctie.richting === "omlaag"
      ? "Nieuw blok gestart met iets minder volume — rustige opbouw is nu het juiste tempo."
      : "Nieuw blok gestart met iets meer volume — je hebt het vorige blok goed verwerkt.";
    maakMelding(userId, "trainingsblok_herijkt", { tekst })
      .catch(e => console.warn(`[blokcheck] Melding-aanmaak mislukt:`, e.message));
  }

  // Log
  await kv.set(`blokcheck_log:${userId}:${blokIndex}`, {
    blokIndex, uitgevoerd: new Date().toISOString(),
    oudeBasis: huidigePiekweekTss,
    nieuweBasis,
    richting: correctie.richting,
    pct: correctie.pct,
    signalen: blokSignalen,
    complianceGate: { voldoendeCompliant, nietGeleverd: complianceVenster.nietGeleverd },
  }, { ex: 180 * 86400 });

  // KV-vlag (voorkomt dat wekelijkse evaluatie daarna alsnog draait)
  await kv.set(`weekcheck_gedaan:${userId}:${weekNr}`, "1", { ex: 8 * 86400 });

  console.log(`[blokcheck] ${userId}: blok ${blokIndex} → ${blokIndex + 1}, basis ${huidigePiekweekTss} → ${nieuweBasis} (${correctie.richting})`);
}

// ====== Chunk 7: Blok F — review-context leesfuncties ======
// Tot nu toe werden blokcheck_log/volumecorrectie_log alleen inline gelezen
// in api/debug/volumecorrectie-log/route.js. Deze twee functies zijn de
// eerste herbruikbare leeslaag erbovenop, voor src/lib/review/context.js.

/**
 * Leest blokcheck_log:${userId}:${blokIndex} — het log-record van de
 * herstelweek-evaluatie (elke 4 weken) voor één specifiek blok.
 * @param {object} kv
 * @param {string} userId
 * @param {number} blokIndex
 * @returns {Promise<object|null>}
 */
export async function leesBlokBasisLogBlok(kv, userId, blokIndex) {
  return (await kv.get(`blokcheck_log:${userId}:${blokIndex}`)) ?? null;
}

/**
 * Leest volumecorrectie_log:${userId}:${weekNr} — het log-record van de
 * wekelijkse volume-evaluatie. Default weekNr = huidige ISO-weeknummer.
 * @param {object} kv
 * @param {string} userId
 * @param {number} [weekNr]
 * @returns {Promise<object|null>}
 */
export async function leesBlokBasisLogWeek(kv, userId, weekNr = haalIsoWeeknummer(new Date())) {
  return (await kv.get(`volumecorrectie_log:${userId}:${weekNr}`)) ?? null;
}
