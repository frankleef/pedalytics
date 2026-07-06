// Deterministische kader-opbouw voor een seizoensplan (sectie 49-A):
// fasevolgorde, weektypes, TSS-doelen — alles vóórdat Claude iets ziet
// (seizoensgeneratie zelf is inmiddels ook volledig deterministisch, zie
// genereerSeizoensMetadata). Geëxtraheerd uit AppClient.js (was inline
// gedefinieerd, src/app/AppClient.js:388-427) zodat dit los van de
// React-component testbaar is.
import { DOELPROFIELEN, faseInstellingen } from "@/lib/seizoen/doelprofielen";
import { bouwWeekvolgorde } from "@/lib/seizoen/faseDuren";
import { tssDoelWeek1 } from "@/lib/weekgrenzen";

/**
 * Bouwt het deterministische seizoenskader: per week fase, weektype, TSS-doel
 * en toegestane sessietypes.
 *
 * Sectie 51-C: week 3 krijgt altijd `bevat_tussentijdse_ftp_test = true` —
 * eenmalig (niet herhaald op week 7/11), ongeacht seizoensdoel. Analoog aan
 * het tssDoelWeek1-patroon: een vlag die de weekSessies-generatie later
 * (sessiesAanvullen.js) leest om de laatste trainingsdag van die week te
 * forceren naar de ramp-test.
 */
export function bouwKader(doelConfig) {
  const totaalWeken = doelConfig.tijdshorizon_weken || 16;
  const ctl = doelConfig.huidige_ctl || 45;
  const baseTss = Math.round(ctl * 5);
  const doelType = doelConfig.seizoensdoel?.type || doelConfig.doel || "ftp";
  const doelProfiel = DOELPROFIELEN[doelType] || DOELPROFIELEN.ftp;
  const niveau = doelConfig.ervaringsniveau || "recreatief";
  const niveauOpbouw = { starter: 0.05, recreatief: 0.10, getraind: 0.15 }[niveau] || 0.10;
  const opbouwPct = doelProfiel.tss_opbouw_pct ?? niveauOpbouw;
  const niveauTaper = { starter: 0.40, recreatief: 0.50, getraind: 0.60 }[niveau] || 0.50;
  const taperPct = doelProfiel.taper_tss_pct ?? niveauTaper;

  const weekVolgorde = bouwWeekvolgorde(totaalWeken, doelType, niveau);

  let vorigOpbouwTss = baseTss;
  let piekTss = baseTss;

  return weekVolgorde.map((wk) => {
    const faseInfo = faseInstellingen(doelProfiel, wk.fase);
    let tss_doel;

    if (wk.weektype === "herstel") {
      tss_doel = Math.round(piekTss * taperPct);
      vorigOpbouwTss = baseTss;
      piekTss = baseTss;
    } else if (wk.fase === "consolidatie") {
      tss_doel = Math.round(piekTss * 0.58);
    } else if (wk.fase === "test") {
      tss_doel = Math.round(piekTss * 0.40);
    } else if (wk.weeknummer === 1) {
      // Week 1 is een pro-rata (verkorte) week — de progressie voor week 2+
      // moet blijven groeien vanaf de volle baseTss, niet vanaf dit verlaagde
      // eerste-weekcijfer, anders wordt elke volgende opbouwweek te laag.
      tss_doel = tssDoelWeek1(baseTss, doelConfig.startdatum);
    } else {
      tss_doel = Math.round(vorigOpbouwTss * (1 + opbouwPct));
      tss_doel = Math.min(tss_doel, Math.round(baseTss * 1.8));
      vorigOpbouwTss = tss_doel;
      piekTss = Math.max(piekTss, tss_doel);
    }

    const week = {
      week: wk.weeknummer,
      fase: wk.fase,
      weektype: wk.weektype,
      tss_doel,
      focus: faseInfo ? `${faseInfo.sessietypes.slice(0, 3).join(", ")}` : "Z2 volume",
      z1z2_doel: faseInfo?.z1z2_doel || 0.80,
      max_intensiteit: faseInfo?.max_intensiteit_per_week ?? 1,
      sessietypes: faseInfo?.sessietypes || ["z2_duur", "z1_herstel"],
    };

    if (wk.weeknummer === 3) {
      week.bevat_tussentijdse_ftp_test = true;
    }

    return week;
  });
}
