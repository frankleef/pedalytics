// Deterministische seizoensplan-metadata (samenvatting + streefwaarde) — vervangt de
// voormalige Claude-aanroep voor deze twee velden. Pure functies, geen I/O.

const FTP_PROGRESSIE = {
  starter: { pctLaag: 0.08, pctHoog: 0.12 },
  recreatief: { pctLaag: 0.05, pctHoog: 0.08 },
  getraind: { pctLaag: 0.03, pctHoog: 0.05 },
};

const MAANDNAMEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

function formatEenDecimaalKomma(n) {
  return n.toFixed(1).replace(".", ",");
}

function formatUren(n) {
  return Number.isInteger(n) ? String(n) : formatEenDecimaalKomma(n);
}

function formatDatumLeesbaar(isoDatum) {
  if (!isoDatum) return "";
  const [, maand, dag] = isoDatum.split("-").map(Number);
  return `${Number(dag)} ${MAANDNAMEN[maand - 1]}`;
}

function berekenLangsteRitUren(urenPerDag) {
  const waarden = urenPerDag && typeof urenPerDag === "object" ? Object.values(urenPerDag) : [];
  return waarden.length > 0 ? Math.max(...waarden) : null;
}

function berekenFtpRange(ftp, ervaringsniveau, doelFtp) {
  const { pctLaag, pctHoog } = FTP_PROGRESSIE[ervaringsniveau] || FTP_PROGRESSIE.recreatief;
  let min = Math.round(ftp * (1 + pctLaag));
  let max = Math.round(ftp * (1 + pctHoog));
  let enkelvoudig = false;

  if (typeof doelFtp === "number" && doelFtp > 0) {
    if (doelFtp >= min) {
      min = Math.min(doelFtp, min);
      max = doelFtp;
    } else {
      min = doelFtp;
      max = doelFtp;
      enkelvoudig = true;
    }
  }

  return { min, max, enkelvoudig };
}

function ftpRangeResultaat(min, max, enkelvoudig) {
  return enkelvoudig
    ? { type: "ftp_range", min, max, label: `${min}W` }
    : { type: "ftp_range", min, max, label: `${min}–${max}W` };
}

export function berekenStreefwaarde({ seizoensdoel, ervaringsniveau, ftp, gewichtKg, urenPerDag, piekVermogen }) {
  if (typeof ftp !== "number" || !(ftp > 0)) {
    throw new Error("berekenStreefwaarde: geldig ftp vereist");
  }

  const type = seizoensdoel?.type;

  if (type === "ftp") {
    const { min, max, enkelvoudig } = berekenFtpRange(ftp, ervaringsniveau, seizoensdoel?.doel_ftp);
    return ftpRangeResultaat(min, max, enkelvoudig);
  }

  if (type === "klimmen") {
    const { min, max, enkelvoudig } = berekenFtpRange(ftp, ervaringsniveau, seizoensdoel?.doel_ftp);
    if (typeof gewichtKg !== "number" || !(gewichtKg > 0)) {
      return ftpRangeResultaat(min, max, enkelvoudig);
    }
    const minWkg = Math.round((min / gewichtKg) * 10) / 10;
    const maxWkg = Math.round((max / gewichtKg) * 10) / 10;
    return enkelvoudig
      ? { type: "wkg_range", min: minWkg, max: maxWkg, label: `${formatEenDecimaalKomma(minWkg)} W/kg` }
      : { type: "wkg_range", min: minWkg, max: maxWkg, label: `${formatEenDecimaalKomma(minWkg)}–${formatEenDecimaalKomma(maxWkg)} W/kg` };
  }

  if (type === "aerobe_basis") {
    return { type: "decoupling", min: null, max: null, label: "Decoupling < 5%" };
  }

  if (type === "uithoudingsvermogen") {
    const max = berekenLangsteRitUren(urenPerDag);
    return {
      type: "langste_rit",
      min: null,
      max,
      label: max != null ? `Langste rit: ${formatUren(max)} uur` : "Lange duurritten",
    };
  }

  if (type === "sprint") {
    if (typeof piekVermogen === "number" && piekVermogen > 0) {
      const min = Math.round(piekVermogen * 1.05);
      const max = Math.round(piekVermogen * 1.10);
      return { type: "sprint_piek", min, max, label: `${min}–${max}W piek` };
    }
    return { type: "sprint_piek", min: null, max: null, label: "Piekvermogen +5–10%" };
  }

  console.warn(`berekenStreefwaarde: onbekend doeltype "${type}", val terug op ftp-gedrag`);
  const { min, max, enkelvoudig } = berekenFtpRange(ftp, ervaringsniveau, seizoensdoel?.doel_ftp);
  return ftpRangeResultaat(min, max, enkelvoudig);
}

export function bouwSamenvatting({ seizoensdoel, kader, streefwaarde, ftp, langsteRitUren, eventDatum }) {
  const weken = Array.isArray(kader) && kader.length > 0 ? kader.length : 13;
  const streefLabel = streefwaarde?.label ?? "";
  const type = seizoensdoel?.type;

  if (type === "aerobe_basis") {
    return `De komende ${weken} weken draaien om één ding: een sterkere motor op lage intensiteit. Je rijdt vooral rustige duurritten die geleidelijk langer worden — geen zware intervallen, wel consistent volume. Het resultaat merk je aan een lagere hartslag bij hetzelfde vermogen en meer reserve aan het eind van lange ritten. Doel: ${streefLabel} op je duurritten.`;
  }

  if (type === "klimmen") {
    return `Dit plan werkt in ${weken} weken naar meer vermogen per kilo. De basisweken bouwen je aerobe fundament, daarna volgen krachtblokken op lage cadans en intervallen die het klimmen simuleren. Samen met je drempelvermogen groeit zo het getal dat op de klim écht telt: ${streefLabel}.`;
  }

  if (type === "uithoudingsvermogen") {
    const langsteRitZin = langsteRitUren != null
      ? `met je langste geplande rit rond ${formatUren(langsteRitUren)} uur`
      : "met steeds langere duurritten";
    const slotzin = eventDatum
      ? `precies wat je nodig hebt op ${formatDatumLeesbaar(eventDatum)}.`
      : "precies wat je nodig hebt op de dag zelf.";
    return `De komende ${weken} weken bouw je systematisch op naar lange afstanden. De duurritten worden week op week langer, ${langsteRitZin}. Je leert je lichaam om efficiënt vet te verbranden en het vol te houden als de rit lang wordt — ${slotzin}`;
  }

  if (type === "sprint") {
    return `Dit plan traint in ${weken} weken je explosiviteit. Naast een aerobe basis voor het herstel tussen inspanningen, werk je met maximale sprints van enkele seconden — eerst puur op kracht, later vanuit vermoeidheid, zoals in een echte eindsprint. Doel: ${streefLabel} aan het eind van het seizoen.`;
  }

  return `Dit plan bouwt in ${weken} weken stap voor stap naar een hogere drempel. Je begint met een brede aerobe basis, schakelt daarna door naar sweetspot- en drempelblokken, en sluit af met een ramp-test. Elke vierde week is een herstelweek — die is net zo belangrijk als de trainingsweken. Vanaf je huidige ${ftp}W mikken we op ${streefLabel}.`;
}

export function genereerSeizoensMetadata(ctx) {
  const gewichtKg = ctx.startProfiel?.gewicht_kg ?? null;
  const langsteRitUren = berekenLangsteRitUren(ctx.urenPerDag);

  const streefwaarde = berekenStreefwaarde({
    seizoensdoel: ctx.seizoensdoel,
    ervaringsniveau: ctx.ervaringsniveau,
    ftp: ctx.ftp,
    gewichtKg,
    urenPerDag: ctx.urenPerDag,
    piekVermogen: ctx.piekVermogen,
  });

  const samenvatting = bouwSamenvatting({
    seizoensdoel: ctx.seizoensdoel,
    kader: ctx.kader,
    streefwaarde,
    ftp: ctx.ftp,
    langsteRitUren,
    eventDatum: ctx.seizoensdoel?.event_datum ?? null,
  });

  return { samenvatting, streefwaarde };
}
