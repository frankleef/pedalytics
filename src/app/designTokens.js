export const T = {
  // Achtergrond
  bg: 'oklch(0.962 0.012 84)',
  cardBg: 'oklch(0.99 0.006 84)',
  subtleFill: 'oklch(0.965 0.012 84)',
  cardBorder: 'oklch(0.93 0.01 82)',
  divider: 'oklch(0.91 0.012 82)',
  cardRadius: 28,
  tileRadius: 16,
  cardShadow: '0 2px 14px rgba(60,45,20,0.05)',

  // Tekst
  text: 'oklch(0.27 0.02 70)',
  textSec: 'oklch(0.5 0.02 74)',
  textTert: 'oklch(0.6 0.02 75)',

  // Nav / knoppen
  slate: 'oklch(0.24 0.012 70)',
  pillRadius: 999,

  // Brand gradient
  gradient: 'linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))',
  gradientA: 'oklch(0.64 0.14 248)',
  gradientB: 'oklch(0.79 0.14 168)',

  // Spacing
  pad: 22,
  navH: 78,
  statusBarH: 46,

  // Fonts
  font: "'Nunito', sans-serif",
  fontNum: "'Fredoka', sans-serif",

  // Zones (%FTP)
  z1: '#B4C6DE', // <56%
  z2: '#5E94CE', // 56-75%
  z3: '#3FB488', // 76-90%
  z4: '#C79A3C', // 91-106%
  z5: '#B45A44', // >106%
};

// Herstelstatus — 4 niveaus
export const STATUS = {
  good: {
    label: 'Goede balans',
    headline: (naam) => `${naam}, je herstel is goed — tijd voor een pittige training.`,
    color: 'oklch(0.5 0.13 162)',
    dot: 'oklch(0.6 0.13 165)',
    ringA: 'oklch(0.62 0.14 248)',
    ringB: 'oklch(0.79 0.14 168)',
  },
  caution: {
    label: 'Let op',
    headline: (naam) => `${naam}, je vorm is prima — houd het vandaag gecontroleerd.`,
    color: 'oklch(0.55 0.11 92)',
    dot: 'oklch(0.74 0.13 95)',
    ringA: 'oklch(0.79 0.14 168)',
    ringB: 'oklch(0.8 0.13 96)',
  },
  careful: {
    label: 'Voorzichtig',
    headline: (naam) => `${naam}, je belasting loopt op — kies vandaag voor een rustige rit.`,
    color: 'oklch(0.56 0.13 55)',
    dot: 'oklch(0.66 0.14 54)',
    ringA: 'oklch(0.8 0.13 96)',
    ringB: 'oklch(0.67 0.14 52)',
  },
  rest: {
    label: 'Rust nodig',
    headline: (naam) => `${naam}, luister vandaag naar je lichaam — rust is winst.`,
    color: 'oklch(0.52 0.1 28)',
    dot: 'oklch(0.58 0.11 28)',
    ringA: 'oklch(0.67 0.14 52)',
    ringB: 'oklch(0.58 0.11 28)',
  },
};

// Slate insight-kaart tokens
export const SLATE = {
  bg: 'oklch(0.345 0.035 245)',
  tile: 'oklch(0.4 0.03 245)',
  label: 'oklch(0.74 0.05 200)',
  text: 'oklch(0.95 0.012 200)',
  accent: 'oklch(0.86 0.06 165)',
  shadow: '0 10px 26px rgba(30,40,70,0.25)',
};

export function getStatus(score) {
  if (score >= 80) return 'good';
  if (score >= 60) return 'caution';
  if (score >= 40) return 'careful';
  return 'rest';
}

export function zoneKleur(pctFtp) {
  if (pctFtp < 56) return T.z1;
  if (pctFtp <= 75) return T.z2;
  if (pctFtp <= 90) return T.z3;
  if (pctFtp <= 106) return T.z4;
  return T.z5;
}
