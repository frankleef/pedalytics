export const FASE_VERHOUDINGEN = {
  ftp:                { basis: 0.25, sweetspot: 0.40, drempel: 0.35 },
  aerobe_basis:       { basis: 0.40, sweetspot: 0.35, drempel: 0.25 },
  klimmen:            { basis: 0.25, sweetspot: 0.35, drempel: 0.40 },
  uithoudingsvermogen:{ basis: 0.30, sweetspot: 0.45, drempel: 0.25 },
  sprint:             { basis: 0.30, sweetspot: 0.35, drempel: 0.35 },
};

const VASTE_WEKEN = 5; // 2 herstel + 1 overgang + 1 consolidatie + 1 test

export function berekenFaseDuren(totaalWeken, doel, ervaringsniveau) {
  const geclamptWeken = Math.min(24, Math.max(13, totaalWeken));
  const v = FASE_VERHOUDINGEN[doel] ?? FASE_VERHOUDINGEN.ftp;

  // Overhead = overgang + consolidatie + test + herstelweken (3:1 ritme)
  // Herstelweken hangen af van faseduren → iteratief oplossen
  let overhead = VASTE_WEKEN;
  let basis, sweetspot, drempel;

  for (let iter = 0; iter < 4; iter++) {
    const trainsweken = geclamptWeken - overhead;
    basis = Math.max(3, Math.round(trainsweken * v.basis));
    sweetspot = Math.max(3, Math.round(trainsweken * v.sweetspot));
    drempel = trainsweken - basis - sweetspot;

    if (drempel < 2) {
      sweetspot = Math.max(3, sweetspot - (2 - drempel));
      drempel = 2;
    }
    if (ervaringsniveau === "starter" && drempel > 3) {
      sweetspot += drempel - 3;
      drempel = 3;
    }

    // 3 vaste (overgang+consolidatie+test) + herstelweken per fase
    const nieuwOverhead = 3 + Math.floor(basis / 3) + Math.floor(sweetspot / 3);
    if (nieuwOverhead === overhead) break;
    overhead = nieuwOverhead;
  }

  return { basis, sweetspot, drempel, totaalWeken: geclamptWeken };
}

function voegFaseBlokToe(weken, faseNaam, aantalOpbouw, weeknummerRef) {
  let rest = aantalOpbouw;
  while (rest > 0) {
    const blokLen = Math.min(3, rest);
    for (let i = 0; i < blokLen; i++) {
      weken.push({ weeknummer: weeknummerRef.nr++, fase: faseNaam, weektype: "opbouw" });
    }
    rest -= blokLen;
    if (rest > 0 || blokLen === 3) {
      weken.push({ weeknummer: weeknummerRef.nr++, fase: faseNaam, weektype: "herstel" });
    }
  }
}

export function bouwWeekvolgorde(totaalWeken, doel, ervaringsniveau) {
  const { basis, sweetspot, drempel } = berekenFaseDuren(totaalWeken, doel, ervaringsniveau);
  const weken = [];
  const ref = { nr: 1 };

  voegFaseBlokToe(weken, "basis", basis, ref);
  voegFaseBlokToe(weken, "sweetspot", sweetspot, ref);

  weken.push({ weeknummer: ref.nr++, fase: "overgangsfase", weektype: "opbouw" });

  for (let i = 0; i < drempel; i++) {
    weken.push({ weeknummer: ref.nr++, fase: "drempel", weektype: "opbouw" });
  }

  weken.push({ weeknummer: ref.nr++, fase: "consolidatie", weektype: "herstel" });
  weken.push({ weeknummer: ref.nr++, fase: "test", weektype: "herstel" });

  return weken;
}
