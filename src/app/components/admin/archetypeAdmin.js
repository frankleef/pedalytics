// Gedeelde constanten/helpers voor de admin sessie-archetype-UI.

export const SESSIETYPE_LABELS = {
  z2_duur: "Z2 duur",
  sweetspot_intervallen: "Sweetspot",
  kracht_lage_cadans: "Kracht (lage cadans)",
  drempel_intervallen: "Drempel",
  vo2max_intervallen: "VO2max",
  sprint_neuraal: "Sprint (neuraal)",
  z6_anaeroob: "Z6 anaeroob",
  gemengd: "Gemengd (vrijheidsdag)",
};

export const GELDIGE_SESSIETYPES_LIJST = Object.keys(SESSIETYPE_LABELS);

export const ZONES = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"];

export const ZONE_LABELS = {
  Z1: "Z1 · Herstel", Z2: "Z2 · Duur", Z3: "Z3 · Tempo", Z4: "Z4 · Drempel",
  Z5: "Z5 · VO2max", Z6: "Z6 · Anaeroob", Z7: "Z7 · Neuromusculair",
};

// Representatieve %FTP per zone — gebruikt om het Intensiteit-veld automatisch
// in te vullen bij een zonewissel (en als vaste waarde voor Z6/Z7-blokken met
// "Maximale inspanning" aangevinkt).
export const ZONE_REPRESENTATIEVE_PCT = { Z1: 45, Z2: 65, Z3: 83, Z4: 98, Z5: 113, Z6: 135, Z7: 170 };

// Blokken van Z6/Z7 zijn neuraal/anaeroob-maximaal — "% van FTP" is daar geen
// zinvolle maat om precies te bepalen. De "Maximale inspanning"-checkbox is een
// builder-UI-concept (zet het Intensiteit-veld vast op een representatieve
// waarde i.p.v. handmatig bewerkbaar). Het opgeslagen archetype krijgt gewoon
// die numerieke pct_ftp, want genereerSessieDeterministisch/berekenWattagesVanBlokken
// gebruiken altijd pct_ftp, ook voor Z6/Z7 (geen aparte "null = max"-representatie
// in de echte data).
export const MAX_EFFORT_ZONES = new Set(["Z6", "Z7"]);

// Tolerantie voor de "moet op 100% uitkomen"-check — handmatige invoer/afronding
// zal zelden exact 100,000% zijn.
export const PCT_TOTAAL_TOLERANTIE = 0.5;

export function nieuwBlokId() {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function leegBlok() {
  return { _id: nieuwBlokId(), type: "werk", zone: "Z3", pct_ftp: 83, pct: 10, reps: 1, maximaal: false, isSpecifiek: false };
}

/**
 * Groepeert opeenvolgende blokken met dezelfde reps>1 tot sets, voor de
 * ×N-bracket-weergave — zelfde herkenning als groeperenInSets() in
 * sessie-generatie.js (werk+herstel-paar met gelijke reps).
 */
export function groepeerBlokkenTotSets(blokken) {
  const sets = [];
  let i = 0;
  while (i < blokken.length) {
    const reps = blokken[i].reps ?? 1;
    if (reps > 1) {
      const groep = [];
      while (i < blokken.length && (blokken[i].reps ?? 1) === reps) {
        groep.push(blokken[i]);
        i++;
      }
      sets.push({ reps, blokken: groep });
    } else {
      sets.push({ reps: 1, blokken: [blokken[i]] });
      i++;
    }
  }
  return sets;
}

/**
 * Som van het aandeel (%) over alle blokken, elk vermenigvuldigd met zijn reps
 * — moet 100 zijn voordat een variant een geldige sessie voorstelt (zelfde
 * optelsom als schaalVariant() intern gebruikt: duur_pct * reps).
 */
export function berekenPctTotaal(blokken) {
  return (blokken || []).reduce((s, b) => s + (b.pct ?? 0) * (b.reps ?? 1), 0);
}

/** Blokken (met _id/pct/maximaal, builder-intern) -> opslagformaat (duur_pct, geen builder-only velden). */
export function blokkenNaarOpslagformaat(blokken) {
  return (blokken || []).map(({ _id, pct, reps, maximaal, isSpecifiek, ...rest }) => ({
    ...rest,
    duur_pct: (pct ?? 0) / 100,
    ...(reps && reps > 1 ? { reps } : {}),
    ...(isSpecifiek ? { isSpecifiek: true } : {}),
  }));
}

/** Opslagformaat -> builder-interne blokken (pct rechtstreeks uit duur_pct × 100). */
export function opslagformaatNaarBlokken(blokken) {
  return (blokken || []).map(b => ({
    _id: nieuwBlokId(),
    type: b.type,
    zone: b.zone,
    pct_ftp: b.pct_ftp,
    pct: Math.round((b.duur_pct ?? 0) * 1000) / 10, // 1 decimaal
    reps: b.reps ?? 1,
    maximaal: false,
    isSpecifiek: b.isSpecifiek ?? false,
    ...(b.cadans_rpm != null ? { cadans_rpm: b.cadans_rpm } : {}),
  }));
}

/** ZWO-parser-blokken (duurSec-gebaseerd, zie parseZwo.js) -> builder-interne blokken (pct). */
export function zwoBlokkenNaarBuilderBlokken(zwoBlokken) {
  const totaalSec = (zwoBlokken || []).reduce((s, b) => s + b.duurSec * (b.reps ?? 1), 0) || 1;
  return (zwoBlokken || []).map(b => ({
    _id: nieuwBlokId(),
    type: b.type,
    zone: b.zone,
    pct_ftp: b.pct_ftp,
    pct: Math.round(((b.duurSec * (b.reps ?? 1)) / totaalSec / (b.reps ?? 1)) * 1000) / 10,
    reps: b.reps ?? 1,
    maximaal: false,
    isSpecifiek: false,
  }));
}

export function formatDuur(sec) {
  if (sec < 60) return `${Math.round(sec)}s`;
  const min = sec / 60;
  return Number.isInteger(min) ? `${min}'` : `${min.toFixed(1)}'`;
}
