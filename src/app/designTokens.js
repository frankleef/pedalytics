export const T = {
  // Achtergrond
  bg: 'oklch(0.98 0.006 90)',
  cardBg: 'oklch(0.995 0.004 90)',
  subtleFill: 'oklch(0.965 0.008 84)',
  cardBorder: 'oklch(0.925 0.008 82)',
  divider: 'oklch(0.935 0.008 82)',
  cardRadius: 24,
  tileRadius: 16,
  cardShadow: '0 1px 2px rgba(30,35,55,0.04)',

  // Tekst
  text: 'oklch(0.33 0.013 66)',
  textSec: 'oklch(0.5 0.012 74)',
  textTert: 'oklch(0.6 0.012 76)',

  // Nav / knoppen
  slate: 'oklch(0.33 0.013 66)',
  pillRadius: 999,

  // Accent (groen — vervangt het oude blauw-groen gradient)
  accent: 'oklch(0.63 0.06 150)',
  accentText: 'oklch(0.52 0.062 150)',
  accentBg: 'oklch(0.96 0.02 150)',

  // Legacy gradient-token — buiten de 4 herontworpen schermen (wizards, modals,
  // profielscherm) nog in gebruik; hier als vlakke kleur gehouden zodat die
  // schermen niet breken. Binnen Vandaag/Schema/Voortgang wordt dit niet meer gebruikt.
  gradient: 'oklch(0.33 0.013 66)',
  gradientA: 'oklch(0.33 0.013 66)',
  gradientB: 'oklch(0.33 0.013 66)',

  // Spacing
  pad: 22,
  navH: 78,
  statusBarH: 46,

  // Fonts
  font: "'Public Sans', sans-serif",
  fontNum: "'Public Sans', sans-serif",

  // Zones (%FTP) — blauw (laag) -> groen (matig) -> amber/rood (hoog)
  z1: 'oklch(0.86 0.03 235)', // <56%
  z2: 'oklch(0.72 0.06 235)', // 56-75%
  z3: 'oklch(0.67 0.058 150)', // 76-90%
  z4: 'oklch(0.72 0.1 70)', // 91-106%
  z5: 'oklch(0.6 0.13 45)', // 107-120%
  z6: 'oklch(0.53 0.15 32)', // 121-150% (anaeroob)
  z7: 'oklch(0.46 0.14 25)', // >150% (neuromusculair/sprint)
};

// Herstelstatus — 4 niveaus
export const STATUS = {
  vol_gas: {
    label: 'Vol gas',
    headline: (naam, weer) => weer?.hitte ? `${naam}, je staat er goed voor — maar het is ${weer.temp}°. Pas je tempo aan.` : `${naam}, je herstel is uitstekend — tijd voor een zware training.`,
    headlineNaRit: (naam) => `${naam}, sterke sessie — je lichaam is in topvorm.`,
    color: 'oklch(0.52 0.062 150)',
    dot: 'oklch(0.63 0.06 150)',
    ringA: 'oklch(0.63 0.06 150)',
    ringB: 'oklch(0.63 0.06 150)',
  },
  goed: {
    label: 'Goed om te gaan',
    headline: (naam, weer) => weer?.hitte ? `${naam}, je staat er goed voor — maar het is ${weer.temp}°. Pas je tempo aan.` : `${naam}, je herstel is goed — tijd voor een pittige training.`,
    headlineNaRit: (naam) => `${naam}, goed gereden — je herstel ziet er prima uit.`,
    color: 'oklch(0.52 0.062 150)',
    dot: 'oklch(0.63 0.06 150)',
    ringA: 'oklch(0.63 0.06 150)',
    ringB: 'oklch(0.63 0.06 150)',
  },
  rustig: {
    label: 'Doe het rustig aan',
    headline: (naam, weer) => weer?.hitte ? `${naam}, doe het rustig aan — zeker in deze hitte van ${weer.temp}°.` : `${naam}, je vorm is prima — houd het vandaag gecontroleerd.`,
    headlineNaRit: (naam) => `${naam}, sessie erop — neem het de rest van de dag rustig aan.`,
    color: 'oklch(0.55 0.11 92)',
    dot: 'oklch(0.74 0.13 95)',
    ringA: 'oklch(0.74 0.13 95)',
    ringB: 'oklch(0.74 0.13 95)',
  },
  herstel: {
    label: 'Herstel eerst',
    headline: (naam, weer) => weer?.hitte ? `${naam}, rust vandaag en vermijd inspanning in deze ${weer.temp}°.` : `${naam}, je belasting loopt op — kies vandaag voor een rustige rit.`,
    headlineNaRit: (naam) => `${naam}, stevige dag — je lichaam heeft nu rust nodig.`,
    color: 'oklch(0.56 0.13 55)',
    dot: 'oklch(0.66 0.14 54)',
    ringA: 'oklch(0.66 0.14 54)',
    ringB: 'oklch(0.66 0.14 54)',
  },
  rust: {
    label: 'Rust vandaag',
    headline: (naam, weer) => weer?.hitte ? `${naam}, rust vandaag en vermijd inspanning in deze ${weer.temp}°.` : `${naam}, luister vandaag naar je lichaam — rust is winst.`,
    headlineNaRit: (naam) => `${naam}, je hebt gereden terwijl rust beter was — luister morgen naar je lichaam.`,
    color: 'oklch(0.52 0.1 28)',
    dot: 'oklch(0.58 0.11 28)',
    ringA: 'oklch(0.58 0.11 28)',
    ringB: 'oklch(0.58 0.11 28)',
  },
};

// Kleuren voor de conditiescore-pill (lib/conditie.js conditiePillStatus) —
// gedeeld tussen GereedheidConditieKaart (home) en AdaptatieScoreKaart (schema),
// zodat dezelfde score overal identiek oogt.
export const CONDITIE_PILL_KLEUREN = {
  groen: { bg: 'oklch(0.96 0.02 150)', tekst: 'oklch(0.52 0.062 150)', dot: 'oklch(0.63 0.06 150)' },
  geel: { bg: 'oklch(0.95 0.04 90)', tekst: 'oklch(0.45 0.1 85)', dot: 'oklch(0.65 0.12 88)' },
  oranje: { bg: 'oklch(0.95 0.04 55)', tekst: 'oklch(0.45 0.1 50)', dot: 'oklch(0.63 0.12 52)' },
  rood: { bg: 'oklch(0.95 0.04 28)', tekst: 'oklch(0.45 0.1 25)', dot: 'oklch(0.58 0.11 28)' },
  blauw: { bg: 'oklch(0.93 0.03 235)', tekst: 'oklch(0.38 0.09 245)', dot: 'oklch(0.5 0.09 248)' },
};

// Slate insight-kaart tokens (lichte "coach"-kaart — vervangt het oude donkere thema)
export const SLATE = {
  bg: 'oklch(0.995 0.004 90)',
  tile: 'oklch(0.965 0.008 84)',
  label: 'oklch(0.58 0.012 74)',
  text: 'oklch(0.36 0.012 68)',
  accent: 'oklch(0.52 0.062 150)',
  shadow: '0 1px 2px rgba(30,35,55,0.04)',
};

export function getStatus(score) {
  if (score >= 80) return 'vol_gas';
  if (score >= 60) return 'goed';
  if (score >= 40) return 'rustig';
  if (score >= 20) return 'herstel';
  return 'rust';
}

// Grenzen komen overeen met afleidZonePositie.js (migratie/ZWO-import) — één
// bron van waarheid voor waar een %FTP-waarde in welke zone valt.
export function zoneKleur(pctFtp) {
  if (pctFtp < 56) return T.z1;
  if (pctFtp <= 75) return T.z2;
  if (pctFtp <= 90) return T.z3;
  if (pctFtp <= 106) return T.z4;
  if (pctFtp <= 120) return T.z5;
  if (pctFtp <= 150) return T.z6;
  return T.z7;
}
