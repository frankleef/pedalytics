import { getKV } from "../kv";
import { getIntervalsCredentials } from "../users";
import { intervalsGet } from "../intervals";
import { datumOffset } from "../datum";
import { berekenDecoupling } from "../decoupling";

/**
 * Check 1: Herstelstatus OK?
 * - HRV-trend (7d) binnen 10% van 28d-baseline
 * - Check-in gemiddelde >= 3/5 (14 dagen)
 * - TSB > -15
 */
export async function checkHerstelStatus(userId) {
  const kv = getKV();
  const signalen = { hrv: null, checkin: null, tsb: null };

  try {
    const creds = await getIntervalsCredentials(userId);
    if (!creds) return { ok: false, signalen };

    const wellness = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0) }, creds);
    if (!wellness || wellness.length === 0) return { ok: false, signalen };

    // HRV: 28d baseline vs 7d trend
    const hrvWaarden = wellness.filter(w => w.hrv).map(w => w.hrv);
    if (hrvWaarden.length >= 7) {
      const baseline = hrvWaarden.reduce((s, v) => s + v, 0) / hrvWaarden.length;
      const recent7d = hrvWaarden.slice(-7);
      const gem7d = recent7d.reduce((s, v) => s + v, 0) / recent7d.length;
      const afwijking = Math.abs(gem7d - baseline) / baseline;
      signalen.hrv = { baseline: Math.round(baseline), gem7d: Math.round(gem7d), afwijkingPct: Math.round(afwijking * 100), ok: afwijking <= 0.10 };
    }

    // TSB
    const laatste = wellness[wellness.length - 1];
    if (laatste?.ctl != null && laatste?.atl != null) {
      const tsb = Math.round(laatste.ctl - laatste.atl);
      signalen.tsb = { waarde: tsb, ok: tsb > -15 };
    }
  } catch (e) {
    console.warn("[vo2maxDetectie] Wellness ophalen mislukt:", e.message);
  }

  // Check-in gemiddelde (14 dagen)
  try {
    let totaal = 0, aantal = 0;
    for (let i = 0; i < 14; i++) {
      const datum = datumOffset(-i);
      const checkin = await kv.get(`${userId}:checkin:${datum}`);
      if (checkin?.score) { totaal += checkin.score; aantal++; }
    }
    if (aantal > 0) {
      const gem = totaal / aantal;
      signalen.checkin = { gemiddelde: Math.round(gem * 10) / 10, aantal, ok: gem >= 3 };
    }
  } catch (e) {
    console.warn("[vo2maxDetectie] Check-in ophalen mislukt:", e.message);
  }

  const ok = (signalen.hrv?.ok ?? true) && (signalen.checkin?.ok ?? true) && (signalen.tsb?.ok ?? true);
  return { ok, signalen };
}

/**
 * Check 2: FTP-plafond bereikt?
 * - FTP-stijging < 2% t.o.v. start huidig blok
 * - Plannaleving >= 80%
 * - Cardiac decoupling mediaan < 4% (afgelopen 4 Z2-ritten)
 */
export async function checkFtpPlafond(userId) {
  const kv = getKV();
  const signalen = { ftpStijging: null, naleving: null, decoupling: null };

  const plan = await kv.get(`${userId}:seizoensplan`);
  if (!plan) return { ok: false, signalen };

  // FTP-stijging: vergelijk huidige FTP met start van huidig blok
  const ftpHistorie = plan.ftp_historie || [];
  if (ftpHistorie.length >= 2) {
    const startdatum = plan.startdatum;
    const dagenSindsStart = startdatum ? Math.max(0, (Date.now() - new Date(startdatum).getTime()) / 86400000) : 0;
    const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7));
    const blokStart = Math.floor((weekNr - 1) / 4) * 4 + 1;
    const blokStartDatum = startdatum ? new Date(new Date(startdatum).getTime() + (blokStart - 1) * 7 * 86400000).toISOString().slice(0, 10) : null;

    const ftpBijBlokStart = ftpHistorie.find(h => h.datum >= (blokStartDatum || ""))?.ftp || ftpHistorie[0]?.ftp;
    const huidigeFtp = plan.huidige_ftp || ftpHistorie[ftpHistorie.length - 1]?.ftp;

    if (ftpBijBlokStart && huidigeFtp) {
      const stijgingPct = ((huidigeFtp - ftpBijBlokStart) / ftpBijBlokStart) * 100;
      signalen.ftpStijging = { startFtp: ftpBijBlokStart, huidigFtp: huidigeFtp, stijgingPct: Math.round(stijgingPct * 10) / 10, ok: stijgingPct < 2 };
    }
  } else if (ftpHistorie.length === 0) {
    signalen.ftpStijging = null;
    return { ok: false, signalen };
  }

  // Plannaleving: ratio gematcht/gepland afgelopen 3 weken
  const sessies = plan.weekSessies?.sessies || [];
  const drieWekenGeleden = datumOffset(-21);
  const vandaag = datumOffset(0);
  const recenteSessies = sessies.filter(s => s.datum && s.datum >= drieWekenGeleden && s.datum <= vandaag);
  const geplande = recenteSessies.length;
  const voltooide = recenteSessies.filter(s => s.voltooid).length;
  if (geplande > 0) {
    const nalevingPct = (voltooide / geplande) * 100;
    signalen.naleving = { geplande, voltooide, pct: Math.round(nalevingPct), ok: nalevingPct >= 80 };
  }

  // Cardiac decoupling: mediaan van afgelopen 4 Z2-ritten
  try {
    const creds = await getIntervalsCredentials(userId);
    if (creds) {
      const activities = await intervalsGet("/activities", { oldest: datumOffset(-28), newest: datumOffset(0), limit: "20" }, creds);
      const z2Ritten = (activities || []).filter(a => {
        if (a.type !== "Ride" && a.type !== "VirtualRide") return false;
        const np = a.icu_weighted_avg_watts;
        const ftp = plan.huidige_ftp || 265;
        if (!np || !ftp) return false;
        const ifVal = np / ftp;
        return ifVal >= 0.55 && ifVal <= 0.75 && (a.moving_time || 0) >= 2700;
      }).slice(-4);

      if (z2Ritten.length >= 2) {
        const dcWaarden = [];
        for (const rit of z2Ritten) {
          const cached = await kv.get(`decoupling:${rit.id}`);
          if (cached != null) dcWaarden.push(cached);
        }
        if (dcWaarden.length >= 2) {
          const gesorteerd = [...dcWaarden].sort((a, b) => a - b);
          const mid = Math.floor(gesorteerd.length / 2);
          const mediaan = gesorteerd.length % 2 === 0 ? (gesorteerd[mid - 1] + gesorteerd[mid]) / 2 : gesorteerd[mid];
          signalen.decoupling = { mediaan: Math.round(mediaan * 10) / 10, aantal: dcWaarden.length, ok: mediaan < 4 };
        }
      }
    }
  } catch (e) {
    console.warn("[vo2maxDetectie] Decoupling check mislukt:", e.message);
  }

  const ftpOk = signalen.ftpStijging?.ok ?? false;
  const nalevingOk = signalen.naleving?.ok ?? false;
  const decouplingOk = signalen.decoupling?.ok ?? true;
  const ok = ftpOk && nalevingOk && decouplingOk;

  return { ok, signalen };
}

/**
 * Combineert beide checks en bepaalt of een VO2max-suggestie getoond moet worden.
 */
export async function evalueerVo2maxSuggestie(userId) {
  const kv = getKV();

  // Alleen voor doel=ftp
  const plan = await kv.get(`${userId}:seizoensplan`);
  const doelType = plan?.seizoensdoel?.type || plan?.doel || "ftp";
  if (doelType !== "ftp") return { suggereer: false, reden: "doel_niet_ftp" };

  // Minimaal week 5
  const dagenSindsStart = plan?.startdatum ? Math.max(0, (Date.now() - new Date(plan.startdatum).getTime()) / 86400000) : 0;
  const weekNr = Math.max(1, Math.ceil(dagenSindsStart / 7));
  if (weekNr < 5) return { suggereer: false, reden: "te_vroeg" };

  // Al geaccepteerd of afgewezen?
  const status = await kv.get(`vo2max_suggestie_status:${userId}`);
  if (status === "geaccepteerd" || status === "afgewezen") {
    return { suggereer: false, reden: `al_${status}` };
  }

  const herstel = await checkHerstelStatus(userId);
  const plafond = await checkFtpPlafond(userId);

  if (herstel.ok && plafond.ok) {
    return {
      suggereer: true,
      reden: "plafond_bereikt",
      details: { herstel: herstel.signalen, plafond: plafond.signalen },
    };
  }

  if (!herstel.ok && plafond.ok) {
    return {
      suggereer: false,
      reden: "herstel_prioriteit",
      details: { herstel: herstel.signalen, plafond: plafond.signalen },
    };
  }

  if (herstel.ok && !plafond.ok) {
    return { suggereer: false, reden: "geen_plafond", details: { herstel: herstel.signalen, plafond: plafond.signalen } };
  }

  return { suggereer: false, reden: "geen_indicatie", details: { herstel: herstel.signalen, plafond: plafond.signalen } };
}
