// Check-in-gestuurde sessieaanpassing (bouwstuk 4).
// Na een check-in wordt de sessie van vandaag bijgesteld op basis van de balansscore.

import { getKV } from "../kv";
import { getIntervalsCredentials } from "../users";
import { intervalsGet, intervalsPut } from "../intervals";
import { vandaagISO } from "../datum";
import { schaalSessieMetFactor } from "./tssValidatie";
import { maakMelding } from "../meldingen";

const TSB_MIN = -30;
const TSB_MAX = 15;
const HRV_AFWIJKING_MIN = -20;
const RHR_AFWIJKING_MAX = 10;

function clamp01(val) { return Math.max(0, Math.min(1, val)); }

/**
 * B4: objectieve score uit uitsluitend tsb/hrv/rhr — GEEN checkin. Identieke
 * componenten-opbouw/normalisatie-mechaniek als de vroegere berekenBalansscore,
 * alleen zonder de checkin-entry: de bestaande gewichtTotaal-normalisatie
 * (hieronder) herweegt tsb/hrv/rhr automatisch proportioneel op hun eigen
 * onderlinge verhouding (0.40:0.25:0.15 -> genormaliseerd, geen nieuwe
 * constanten nodig) — exact hetzelfde mechanisme waarmee RHR al optioneel
 * meedeed vóór B4.
 * @returns {number} ONAFGERONDE score 0-100 — zie bepaalStatus voor waarom
 *   dit bewust geen Math.round krijgt.
 */
export function berekenObjectieveScore({ tsb, hrv, hrvBasislijn, rhr, rhrBasislijn }) {
  let gewogenSom = 0;
  let gewichtTotaal = 0;

  const componenten = [
    { aanwezig: tsb != null, gewicht: 0.40, sub: tsb != null ? clamp01((tsb - TSB_MIN) / (TSB_MAX - TSB_MIN)) : 0.5 },
    { aanwezig: !!(hrv && hrvBasislijn), gewicht: 0.25, sub: hrv && hrvBasislijn ? clamp01((((hrv - hrvBasislijn) / hrvBasislijn) * 100 - HRV_AFWIJKING_MIN) / (0 - HRV_AFWIJKING_MIN)) : 0.5 },
  ];

  // B6: RHR als derde component — omgekeerde richting t.o.v. HRV (hogere RHR
  // t.o.v. de basislijn is slechter, niet beter). Hergebruikt RHR_AFWIJKING_MAX
  // (regel 14) als dezelfde soort "%-afwijking-plafond" als HRV_AFWIJKING_MIN.
  // STRUCTUREEL alleen toegevoegd aan het array als rhrBasislijn een ECHTE,
  // wekelijks-berekende rhr_basislijn_28d is (caller geeft hier UITSLUITEND
  // die waarde door, geen bredere hr_basislijn/49-fallback — zie
  // checkInSessieAanpassing). Zonder die echte basislijn telt RHR niet mee,
  // ook niet als geraden neutrale 0.5-waarde: gewichtTotaal valt dan terug
  // naar 0.65 (tsb/hrv). Dit is bewust ANDERS dan hoe tsb/hrv hierboven met
  // "aanwezig" omgaan — die twee zijn altijd structureel onderdeel van de
  // score (met een neutrale 0.5 als hun eigen dagwaarde ontbreekt); RHR is de
  // enige component die zelf conditioneel in het array staat, omdat het hier
  // specifiek gaat om het ONTBREKEN VAN EEN BASISLIJN OM MEE TE VERGELIJKEN,
  // niet het ontbreken van een dagwaarde.
  if (rhrBasislijn != null) {
    componenten.push({
      aanwezig: rhr != null,
      gewicht: 0.15,
      sub: rhr != null ? clamp01((RHR_AFWIJKING_MAX - (((rhr - rhrBasislijn) / rhrBasislijn) * 100)) / RHR_AFWIJKING_MAX) : 0.5,
    });
  }

  for (const c of componenten) {
    gewichtTotaal += c.gewicht;
    gewogenSom += (c.aanwezig ? c.sub : 0.5) * c.gewicht;
  }

  return (gewogenSom / gewichtTotaal) * 100;
}

// B4: check-in als tie-breaker, niet als vast gewogen onderdeel. Per grens:
// "gunstig" is de status die de kale cutoff (regel verderop) zou geven bij
// een score OP/BOVEN de grens, "beschermend" die van EROnder — dezelfde
// indeling als de bestaande vier statussen, alleen hernoemd naar hun positie
// t.o.v. de grens waar de ambiguïteit optreedt.
const GRENS_STATUS = [
  { grens: 75, gunstig: "good", beschermend: "caution" },
  { grens: 55, gunstig: "caution", beschermend: "careful" },
  { grens: 35, gunstig: "careful", beschermend: "rest" },
];
const MARGE = 5;

/**
 * @param {number} objectieveScoreRuw - ONAFGERONDE berekenObjectieveScore()-uitkomst.
 *   Margetoets gebeurt bewust op deze rauwe waarde, niet op een afgeronde —
 *   afronden vóór de drempeltoets zou een randgeval het verkeerde kant op
 *   kunnen laten vallen (zelfde les als eerder in dit traject: monotonie se
 *   strikte >2.0, B6's ±5%-trenddrempels).
 * @param {number|null} checkin - 1-5
 * @returns {'good'|'caution'|'careful'|'rest'}
 */
export function bepaalStatus(objectieveScoreRuw, checkin) {
  for (const { grens, gunstig, beschermend } of GRENS_STATUS) {
    if (Math.abs(objectieveScoreRuw - grens) <= MARGE) {
      // Bijstelling: STRIKT > 0.5 vereist voor de gunstige kant — checkin=3
      // (sub=0.5, neutraal) tipt dus naar de beschermende kant, niet de
      // gunstige. Alleen checkin>=4 (sub=0.75) is overtuigend genoeg.
      const checkinSub = checkin != null && checkin >= 1 ? clamp01((checkin - 1) / 4) : 0.5;
      return checkinSub > 0.5 ? gunstig : beschermend;
    }
  }
  if (objectieveScoreRuw >= 75) return "good";
  if (objectieveScoreRuw >= 55) return "caution";
  if (objectieveScoreRuw >= 35) return "careful";
  return "rest";
}

export function maakHerstelRit(ftp) {
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
  // B6: twee RHR-basislijnen bestaan naast elkaar in deze codebase — verwar ze niet.
  // - plan.profiel.hr_basislijn: statisch, eenmalig bij profielsync berekend —
  //   blijft ongewijzigd de basis voor bestaande, andere consumenten (weergave-
  //   componenten, DagAdvies.js), die deze fallback-keten niet kennen en niet nodig
  //   hebben.
  // - hrv-profiel:${userId}.rhr_basislijn_28d: levend, wekelijks herberekend
  //   (cron/sync/route.js, zelfde cadans als de HRV-basislijn).
  // De balansscore hieronder gebruikt UITSLUITEND de tweede (geen bredere
  // fallback-keten hier): berekenBalansscore's RHR-component is een expliciete
  // voorwaarde op het BESTAAN van een echte, wekelijks-berekende basislijn om
  // tegen te vergelijken — bij ontbreken daarvan hoort de component volledig
  // over te slaan (gewichtTotaal 1.00), niet te gokken met hr_basislijn/49.
  const hrvProfielRaw = await kv.get(`hrv-profiel:${userId}`);
  const hrvProfiel = typeof hrvProfielRaw === "string" ? JSON.parse(hrvProfielRaw) : hrvProfielRaw;
  const rhrBasislijn = hrvProfiel?.rhr_basislijn_28d ?? null;
  const ftp = plan.huidige_ftp || 265;

  // B4: objectieve score (tsb/hrv/rhr) + check-in als tie-breaker binnen de
  // margetoets van bepaalStatus — zie berekenObjectieveScore/bepaalStatus
  // hierboven. score blijft afgerond voor logging/response, exact zoals vóór
  // B4 (checkInSessieAanpassing's eigen return-vorm wijzigt niet).
  const objectieveScoreRuw = berekenObjectieveScore({ tsb, hrv, hrvBasislijn, rhr, rhrBasislijn });
  const score = Math.round(objectieveScoreRuw);
  const status = bepaalStatus(objectieveScoreRuw, checkInScore);

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

    await maakMelding(userId, "kritieke_rust", { score, dagLabel: "Vandaag", datum: vandaag });

    return { actie: "rest_vervanging", score, status, details: { tss: 18, duur_min: 30 } };
  }

  // good of careful: modulatie-instructie meegeven
  const modulatie = status === "good"
    ? { duurAanpassing: "+10-15%", zonePositie: "bovenkant", label: "iets langer" }
    : { duurAanpassing: "-10-15%", zonePositie: "onderkant", label: "iets korter" };

  // Pas sessie aan met modulatie (zonder AI-aanroep voor snelheid) — zelfde
  // schaal-en-afrondmechanisme als corrigeerSessieTssTovDagbudget()
  // (tssValidatie.js), alleen met een balansscore-gestuurde factor i.p.v. een
  // dagbudget-gestuurde.
  const sessieVoorCheckin = sessie.sessie_voor_checkin || { ...sessie };
  const duurFactor = status === "good" ? 1.12 : 0.88;
  const { segmenten: nieuweSegmenten, duur_min: nieuweDuur, tss: nieuweTss } = schaalSessieMetFactor(sessie, duurFactor);

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

  await maakMelding(userId, "checkin_modulatie", {
    score,
    richting: status === "good" ? "verzwaard" : "verlicht",
    dagLabel: "Vandaag",
    datum: vandaag,
  });

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
