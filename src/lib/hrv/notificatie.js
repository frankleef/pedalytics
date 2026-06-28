import { getKV } from "../kv";
import { voorspelRpeEffect } from "./correlatie";

const INTENSITEITS_TYPES = [
  "drempel_intervallen", "sweetspot_intervallen", "sweetspot_lang",
  "vo2max_intervallen", "vo2max_lang",
  "vo2max_kort", "microbursts", "sprint_neuraal", "kracht_lage_cadans",
  "race_simulatie",
];

export function bepaalNotificatie(context) {
  const { hrvZone, geplandeSessie } = context;

  if (!geplandeSessie) return { sturen: false, type: null, reden: "geen_sessie" };
  if (hrvZone === "normaal" || hrvZone === "hoog") return { sturen: false, type: null, reden: "hrv_ok" };

  const sessietype = geplandeSessie.intentie?.sessietype || geplandeSessie.sessietype || geplandeSessie.type;
  const isIntensiteitsdag = INTENSITEITS_TYPES.includes(sessietype);

  if (hrvZone === "rood" && isIntensiteitsdag) return { sturen: true, type: "rood_intensiteit", reden: "hrv_rood_intensiteitsdag" };
  if (hrvZone === "rood" && !isIntensiteitsdag) return { sturen: true, type: "rood_aeroob", reden: "hrv_rood_aerobe_dag" };
  if (hrvZone === "geel" && isIntensiteitsdag) return { sturen: true, type: "geel_intensiteit", reden: "hrv_geel_intensiteitsdag" };

  return { sturen: false, type: null, reden: "geel_aeroob_geen_actie" };
}

function getWeeknummer(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export async function checkNotificatieLimiet(userId) {
  const kv = getKV();
  const weeknummer = getWeeknummer(new Date());
  const key = `hrv-notificaties:${userId}:${weeknummer}`;
  const count = parseInt(await kv.get(key) ?? "0");
  return count < 3;
}

export async function verhoogNotificatieTeller(userId) {
  const kv = getKV();
  const weeknummer = getWeeknummer(new Date());
  const key = `hrv-notificaties:${userId}:${weeknummer}`;
  await kv.incr(key);
  await kv.expire(key, 7 * 86400);
}

const SESSIETYPE_LABELS = {
  drempel_intervallen: "drempeltraining",
  sweetspot_intervallen: "sweetspot-training",
  sweetspot_lang: "lange sweetspot-sessie",
  vo2max_intervallen: "VO2max-training",
  vo2max_lang: "lange VO2max-sessie",
  vo2max_kort: "korte VO2max-intervallen",
  microbursts: "microbursts-training",
  sprint_neuraal: "sprinttraining",
  kracht_lage_cadans: "krachtsessie",
  race_simulatie: "racesimulatie",
  z2_duur: "Z2-duurrit",
  z6_anaeroob: "anaerobe training",
  gemengd: "gemengde sessie",
};

export function bouwNotificatieTekst(type, sessie, hrvProfiel, huidigHrv) {
  const rpeVoorspelling = voorspelRpeEffect(huidigHrv, hrvProfiel);
  const sessietype = sessie?.intentie?.sessietype || sessie?.sessietype || sessie?.type;
  const sessieLabel = SESSIETYPE_LABELS[sessietype] ?? sessietype;

  const TEKSTEN = {
    rood_intensiteit: {
      titel: "Je herstel is laag vandaag",
      body: `Je hebt een ${sessieLabel} gepland. ${rpeVoorspelling ?? "Je HRV is significant lager dan normaal."} Wat wil je doen?`,
    },
    rood_aeroob: {
      titel: "Je herstel is laag vandaag",
      body: `Je hebt een ${sessieLabel} gepland. Wil je de sessie verder verlichten of schrappen?`,
    },
    geel_intensiteit: {
      titel: "Je herstel is iets lager dan normaal",
      body: `Je hebt een ${sessieLabel} gepland. ${rpeVoorspelling ?? "De sessie kan zwaarder aanvoelen."} Wil je aanpassen?`,
    },
  };

  return TEKSTEN[type] ?? { titel: "HRV-check", body: "Bekijk je trainingsadvies." };
}
