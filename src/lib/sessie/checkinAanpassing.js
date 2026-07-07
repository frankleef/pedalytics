// Check-in-gestuurde sessieaanpassing (bouwstuk 4).
// Na een check-in wordt de sessie van vandaag bijgesteld op basis van de balansscore.

import { getKV } from "../kv";
import { getIntervalsCredentials } from "../users";
import { intervalsGet, intervalsPut } from "../intervals";
import { vandaagISO } from "../datum";
import { rondSessieAf } from "./duurAfronding";

const TSB_MIN = -30;
const TSB_MAX = 15;
const HRV_AFWIJKING_MIN = -20;
const RHR_AFWIJKING_MAX = 10;

function clamp01(val) { return Math.max(0, Math.min(1, val)); }

function berekenBalansscore({ tsb, hrv, hrvBasislijn, rhr, rhrBasislijn, checkin }) {
  let gewogenSom = 0;
  let gewichtTotaal = 0;

  const componenten = [
    { aanwezig: tsb != null, gewicht: 0.40, sub: tsb != null ? clamp01((tsb - TSB_MIN) / (TSB_MAX - TSB_MIN)) : 0.5 },
    { aanwezig: !!(hrv && hrvBasislijn), gewicht: 0.25, sub: hrv && hrvBasislijn ? clamp01((((hrv - hrvBasislijn) / hrvBasislijn) * 100 - HRV_AFWIJKING_MIN) / (0 - HRV_AFWIJKING_MIN)) : 0.5 },
    { aanwezig: !!(checkin >= 1 && checkin <= 5), gewicht: 0.35, sub: checkin >= 1 ? clamp01((checkin - 1) / 4) : 0.5 },
  ];

  for (const c of componenten) {
    gewichtTotaal += c.gewicht;
    gewogenSom += (c.aanwezig ? c.sub : 0.5) * c.gewicht;
  }

  return Math.round((gewogenSom / gewichtTotaal) * 100);
}

function bepaalStatus(score) {
  if (score >= 75) return "good";
  if (score >= 55) return "caution";
  if (score >= 35) return "careful";
  return "rest";
}

function maakHerstelRit(ftp) {
  const vermogenMin = Math.round(ftp * 0.45);
  const vermogenMax = Math.round(ftp * 0.55);
  return {
    type: "herstel",
    titel: "Herstelrit",
    tss: 18,
    duur_min: 30,
    vermogen: `${vermogenMin}-${vermogenMax}W`,
    reden: "Je hersteldata wijzen op onvoldoende herstel. Een korte, lage-intensiteit rit ondersteunt actief herstel.",
    segmenten: [{ label: "Z1 herstel", type: "herstel", duur_min: 30, vermogenMin: 45, vermogenMax: 55 }],
    intentie: {
      rol: "hersteldag",
      sessietype: "z1_herstel",
      toegestane_zones: ["Z1"],
      tss_range: { min: 12, max: 25 },
      toelichting: "Rustdag-vervanging: alleen Z1 actief herstel",
    },
  };
}

/**
 * Verwerkt een check-in en past de sessie van vandaag aan indien nodig.
 * @param {string} userId
 * @param {number} checkInScore - 1-5
 * @returns {Promise<{actie: string, details?: object}>}
 */
export async function checkInSessieAanpassing(userId, checkInScore) {
  const kv = getKV();
  const vandaag = vandaagISO();

  // Laad plan
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan?.weekSessies?.sessies) {
    return { actie: "geen_plan" };
  }

  // Vind de sessie van vandaag
  const sessieIdx = plan.weekSessies.sessies.findIndex(
    (s) => s.datum === vandaag && !s.voltooid
  );
  if (sessieIdx === -1) {
    return { actie: "geen_sessie_vandaag" };
  }

  const sessie = plan.weekSessies.sessies[sessieIdx];

  // Neuraal-uitzondering: geen modulatie
  if (sessie.intentie?.neuraal === true) {
    return { actie: "neuraal_overgeslagen" };
  }

  // Laad wellness data
  let tsb = null, hrv = null, rhr = null;
  try {
    const creds = await getIntervalsCredentials(userId);
    if (creds) {
      const wellness = await intervalsGet("/wellness", { oldest: vandaag, newest: vandaag }, creds);
      if (wellness && wellness.length > 0) {
        const w = wellness[0];
        tsb = w.ctl && w.atl ? Math.round(w.ctl - w.atl) : null;
        hrv = w.hrv || null;
        rhr = w.restingHR || null;
      }
    }
  } catch (e) {
    console.warn("[checkIn] Wellness laden mislukt:", e.message);
  }

  // Profiel-basislijnen
  const hrvBasislijn = plan.profiel?.hrv_basislijn || 58;
  const rhrBasislijn = plan.profiel?.hr_basislijn || 49;
  const ftp = plan.huidige_ftp || 265;

  // Bereken balansscore
  const score = berekenBalansscore({ tsb, hrv, hrvBasislijn, rhr, rhrBasislijn, checkin: checkInScore });
  const status = bepaalStatus(score);

  console.log(`[checkIn] userId=${userId} score=${score} status=${status} checkin=${checkInScore}`);

  if (status === "caution") {
    return { actie: "geen_aanpassing", score, status };
  }

  if (status === "rest") {
    // Vervang sessie met deterministische Z1-herstelrit
    const sessieVoorCheckin = sessie.sessie_voor_checkin || { ...sessie };
    const herstelRit = maakHerstelRit(ftp);
    const bijgewerkeSessie = {
      ...sessie,
      ...herstelRit,
      datum: vandaag,
      dag: sessie.dag,
      intentie_origineel: sessie.intentie,
      rest_waarschuwing: true,
      intervalsEventId: sessie.intervalsEventId,
      sessie_voor_checkin: sessieVoorCheckin,
    };

    plan.weekSessies.sessies[sessieIdx] = bijgewerkeSessie;
    await kv.set(planKey, plan);

    // Update intervals.icu event
    if (sessie.intervalsEventId) {
      try {
        const creds = await getIntervalsCredentials(userId);
        if (creds) {
          await intervalsPut(`/events/${sessie.intervalsEventId}`, {
            name: "Herstelrit",
            description: `30m ${Math.round(ftp * 0.45)}-${Math.round(ftp * 0.55)}W`,
          }, creds);
        }
      } catch (e) {
        console.warn("[checkIn] Intervals.icu update mislukt:", e.message);
      }
    }

    return { actie: "rest_vervanging", score, status, details: { tss: 18, duur_min: 30 } };
  }

  // good of careful: modulatie-instructie meegeven
  const modulatie = status === "good"
    ? { duurAanpassing: "+10-15%", zonePositie: "bovenkant", label: "iets langer" }
    : { duurAanpassing: "-10-15%", zonePositie: "onderkant", label: "iets korter" };

  // Pas sessie aan met modulatie (zonder AI-aanroep voor snelheid)
  const sessieVoorCheckin = sessie.sessie_voor_checkin || { ...sessie };
  const duurFactor = status === "good" ? 1.12 : 0.88;
  const nieuweTss = Math.round((sessie.tss || 60) * duurFactor);

  // Segmenten schalen op blokDuurSeconden (de daadwerkelijk gebruikte
  // eenheid — sessie.segmenten heeft normaal geen duur_min-veld) en
  // vervolgens afronden op hele minuten/5-minutengrid, zodat de gerapporteerde
  // duur_min altijd overeenkomt met de som van de blokken.
  const geschaaldeSegmenten = (sessie.segmenten || []).map((seg) => ({
    ...seg,
    blokDuurSeconden: seg.blokDuurSeconden != null
      ? Math.max(1, Math.round(seg.blokDuurSeconden * duurFactor))
      : seg.blokDuurSeconden,
  }));
  const { segmenten: nieuweSegmenten, duur_min: nieuweDuur } = rondSessieAf(geschaaldeSegmenten);

  const bijgewerkeSessie = {
    ...sessie,
    duur_min: nieuweDuur,
    tss: nieuweTss,
    check_in_aangepast: true,
    check_in_modulatie: modulatie.label,
    sessie_voor_checkin: sessieVoorCheckin,
    segmenten: nieuweSegmenten,
  };

  plan.weekSessies.sessies[sessieIdx] = bijgewerkeSessie;
  await kv.set(planKey, plan);

  // Update intervals.icu event
  if (sessie.intervalsEventId) {
    try {
      const creds = await getIntervalsCredentials(userId);
      if (creds) {
        await intervalsPut(`/events/${sessie.intervalsEventId}`, {
          description: `Aangepast: ${modulatie.label} (balansscore ${score})`,
          moving_time: nieuweDuur * 60,
        }, creds);
      }
    } catch (e) {
      console.warn("[checkIn] Intervals.icu update mislukt:", e.message);
    }
  }

  return { actie: "gemoduleerd", score, status, details: { duur_min: nieuweDuur, tss: nieuweTss, modulatie: modulatie.label } };
}

/**
 * Verwerkt "Advies opvolgen" — verwijdert de sessie en markeert als rustdag.
 * @param {string} userId
 * @param {string} datum - ISO-datumstring
 */
export async function adviesOpvolgen(userId, datum) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan?.weekSessies?.sessies) return { actie: "geen_plan" };

  const sessieIdx = plan.weekSessies.sessies.findIndex(
    (s) => s.datum === datum && s.rest_waarschuwing
  );
  if (sessieIdx === -1) return { actie: "geen_rest_sessie" };

  const sessie = plan.weekSessies.sessies[sessieIdx];
  const eventId = sessie.intervalsEventId;

  // Verwijder sessie uit plan
  plan.weekSessies.sessies.splice(sessieIdx, 1);
  await kv.set(planKey, plan);

  // Verwijder intervals.icu event
  if (eventId) {
    try {
      const creds = await getIntervalsCredentials(userId);
      if (creds) {
        const { intervalsDelete } = await import("../intervals");
        await intervalsDelete(`/events/${eventId}`, creds);
      }
    } catch (e) {
      console.warn("[adviesOpvolgen] Intervals.icu delete mislukt:", e.message);
    }
  }

  return { actie: "rustdag_ingesteld" };
}
