// Trainingsregels — wetenschappelijke constraints voor sessieverdeling
// Bronnen: Seiler (2010) polarised model, Banister impulse-response model

// Max trainbare dagen op basis van CTL
// Hogere CTL = meer trainingstoleratie, maar altijd een plafond
export function maxTrainDagen(ctl) {
  if (ctl < 30) return 2;
  if (ctl < 40) return 3;
  if (ctl < 60) return 4;
  if (ctl < 80) return 5;
  return 6;
}

// Beperk beschikbare dagen tot wat het lichaam aankan
export function beperkBeschikbaarheid(beschikbareDagen, ctl) {
  const max = maxTrainDagen(ctl || 45);
  const dagVolgorde = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
  const gesorteerd = [...beschikbareDagen].sort((a, b) => dagVolgorde.indexOf(a) - dagVolgorde.indexOf(b));
  const beperkt = gesorteerd.slice(0, max);
  return {
    trainDagen: beperkt,
    maxBereikt: beschikbareDagen.length > max,
    maxDagen: max,
    waarschuwing: beschikbareDagen.length > max
      ? `Bij je huidige fitheid (CTL ${Math.round(ctl || 45)}) is ${max} trainingsdagen het maximum. Extra dagen verhogen het blessurerisico.`
      : null,
  };
}
