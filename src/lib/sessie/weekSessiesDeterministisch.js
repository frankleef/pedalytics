// Deterministische vervanging van bouwWeekSessiesPrompt/de Claude-gestuurde
// weekSessies-job (chunk 6.2) — dezelfde solveWeek()+genereerSessieDag()-
// aanpak als sessiesAanvullen.js's cron, maar met een ander contract: dit
// plant een rolling 7-dagenvenster VANAF vandaag (i=0..6 — sessiesAanvullen.js
// begint bij i=1, want die vult alleen toekomstige ontbrekende dagen aan) en
// regenereert bewust ELKE beschikbare, nog niet voltooide dag in dat venster,
// niet alleen dagen zonder bestaande sessie. Dat is nodig voor de twee
// aanroepers van de weekSessies-job: de initiële weekgeneratie na een nieuw
// seizoensplan (nog geen sessies) en de stille RPE-gestuurde volledige
// weekherplanning (AppClient.js handleRpeSaved) — die laatste moet een al
// volledig geplande week bewust kunnen overschrijven.
//
// Schrijft niet naar KV en synct niet met intervals.icu — dat blijft, zoals
// voorheen bij de Claude-versie, de verantwoordelijkheid van de caller
// (client-side na jobresultaat, zie AppClient.js genereerWeekSessies()).

import { vandaagISO, datumISO, DAGNAMEN } from "../datum";
import { kaderWeekVoorDatum, weekInFaseVoorKaderWeek, getMaandagVanWeek, weeknummerVoorDatum } from "../weekgrenzen";
import { frequentieVoorWeek, heeftTeLangReeks } from "../trainingsfrequentie";
import { getAlleArchetypesRaw } from "../sessie-archetypes";
import { solveWeek, pasBudgetToe, verlaagBijHogeMonotonie } from "./weekSolver";
import { genereerSessieDag, logSessieGegenereerd } from "./genereren";
import { bepaalAlGeleverd, haalWellnessVoorDatum } from "./context";
import { bouwRampTestSessie } from "../sessiesAanvullen";
import { haalAfwezigheidsperiodes, valtBinnenAfwezigheid } from "../afwezigheid";
import { haalDagelijkseTssReeks, berekenMonotonieEnStrain } from "./monotonieStrain";
import { maakMelding } from "../meldingen";
import { haalBevrorenWeekInFase } from "./compliance";
import { zetWeekVoorzichtig, leesWeekVoorzichtig } from "./weekVoorzichtig";

const DAGVOLGORDE_MAANDAG_EERST = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

// Zelfde regel als sessiesAanvullen.js: laatste (chronologisch) beschikbare
// trainingsdag van de ISO-week die op mISO begint.
function laatsteTrainingsdagVanWeek(mISO, beschikbareDagenNamen) {
  const indices = beschikbareDagenNamen
    .map((naam) => DAGVOLGORDE_MAANDAG_EERST.indexOf(naam))
    .filter((i) => i >= 0);
  if (indices.length === 0) return null;
  const d = new Date(mISO);
  d.setDate(d.getDate() + Math.max(...indices));
  return datumISO(d);
}

// datumISO() (lokale datumcomponenten), niet .toISOString() (UTC) — anders
// schuift de maandag-datum een dag op in elke omgeving waar de machine-
// tijdzone niet toevallig UTC is (zie datum.js-toplevelcomment).
function weekMaandagISO(iso) {
  return datumISO(getMaandagVanWeek(iso));
}

/**
 * @param {object} params
 * @param {object} params.kv
 * @param {string} params.userId
 * @param {object} params.profiel
 * @param {object|null} params.wellness - "huidige" wellness (voor CTL-fallback); per dag wordt wellness opnieuw opgehaald
 * @param {object} params.seizoensplan - { kader, startdatum, seizoensdoel, huidige_ctl, huidige_ftp }
 * @param {object|null} params.weekSessies - { sessies: [...] } huidige (te vervangen) weeksessies
 * @param {object} params.urenPerDag - { [dagNaam]: uren }
 * @param {string[]} params.beschikbareDagen - dagnamen (bv. ["Maandag", "Woensdag"])
 * @param {object|null} params.voortgang - { ritten: [...] } voor voltooid-detectie
 * @returns {Promise<{sessies: Array, tss_totaal: number}|null>} null als er niets te plannen valt
 */
export async function genereerWeekSessiesDeterministisch({
  kv, userId, profiel, wellness, seizoensplan, weekSessies, urenPerDag, beschikbareDagen, voortgang,
}) {
  if (!seizoensplan?.kader) return null;

  const vandaagISOStr = vandaagISO();
  const nu = new Date();
  const bestaandeSessies = weekSessies?.sessies || [];

  // Zelfde voltooid-detectie als de oude bouwWeekSessiesPrompt.
  const voltooideDatums = new Set();
  (voortgang?.ritten || []).forEach((rit) => {
    if (!rit.datum_iso) return;
    const match = bestaandeSessies.find(
      (s) => s.datum === rit.datum_iso || (!s.datum && s.dag === DAGNAMEN[new Date(rit.datum_iso).getDay()])
    );
    if (match && rit.datum_iso < vandaagISOStr) voltooideDatums.add(rit.datum_iso);
  });

  // Afwezigheidsperiodes uitsluiten van de open-dagen-pool, vóór budget-
  // verdeling — zelfde niveau als de beschikbaarheid-uit-check hieronder,
  // i.p.v. pas bij genereerSessieDag() zelf (zie sessiesAanvullen.js voor
  // dezelfde overweging).
  const afwezigheidsperiodes = await haalAfwezigheidsperiodes(userId);

  // Blok A (monotonie/strain): eenmaal per run, niet per iso-week-in-lus —
  // Foster's venster is een rollend 7-dagenvenster vanaf vandaag, los van
  // welke kalenderweek(en) dit rolling-7-dagenvenster (i=0..6 hierboven)
  // toevallig doorkruist. Fail-open naar "geen trigger" zonder credentials of
  // bij een mislukte fetch (haalDagelijkseTssReeks geeft dan null) — nooit
  // een berekening proberen op onvolledige/afwezige data.
  const dagelijkseTssReeks = userId ? await haalDagelijkseTssReeks(userId, 7) : null;
  const monotonieResultaat = dagelijkseTssReeks ? berekenMonotonieEnStrain(dagelijkseTssReeks) : { trigger: false };

  // STAP 0 (compliance-freeze) en A3 (weekVoorzichtig): eenmaal per run,
  // zelfde reden als monotonie hierboven — beide zijn per-user-vlaggen, geen
  // per-iso-week-data.
  const bevrorenWeekInFase = await haalBevrorenWeekInFase(kv, userId, seizoensplan);
  const weekVoorzichtig = userId ? await leesWeekVoorzichtig(kv, userId) : false;

  const planDagen = [];
  for (let i = 0; i <= 6; i++) {
    const d = new Date(nu);
    d.setDate(nu.getDate() + i);
    const iso = datumISO(d);
    const dagNaam = DAGNAMEN[d.getDay()];
    planDagen.push({ datum: iso, dag: dagNaam, uren: urenPerDag?.[dagNaam] || 1.5 });
  }

  const tePlannenDagen = planDagen.filter(
    (d) => beschikbareDagen.includes(d.dag) && !voltooideDatums.has(d.datum) && d.datum >= vandaagISOStr
      && !valtBinnenAfwezigheid(d.datum, afwezigheidsperiodes)
  );
  if (tePlannenDagen.length === 0) return null;

  const batchDatums = new Set(tePlannenDagen.map((d) => d.datum));
  // Sessies buiten dit venster (verleden, al voltooid, of voorbij dag 7) tellen
  // wel mee voor de frequentie-/reeks-check van de week(en) waarin dit venster valt.
  const vasteSessiesBuitenBatch = bestaandeSessies.filter((s) => s.datum && !batchDatums.has(s.datum));

  const ctl = wellness?.ctl || seizoensplan.huidige_ctl || 45;

  const dagenPerWeek = {};
  for (const dag of tePlannenDagen) {
    const mISO = weekMaandagISO(dag.datum);
    (dagenPerWeek[mISO] ??= []).push(dag);
  }

  // Stap 1: per ISO-week kiezen welke kandidaat-dagen daadwerkelijk een sessie
  // krijgen — frequentiecap + geen 4+ opeenvolgende trainingsdagen. Zelfde
  // aanpak als sessiesAanvullen.js's dagselectielus, hier toegepast op een
  // rolling 7-dagenvenster i.p.v. op "ontbrekende dagen".
  const geplandPerWeek = {};
  for (const s of vasteSessiesBuitenBatch) {
    if (!s.datum || s.voltooid) continue;
    if (s.type === "herstel_mobiliteit" || s.intentie?.sessietype === "herstel_mobiliteit") continue;
    const mISO = weekMaandagISO(s.datum);
    geplandPerWeek[mISO] = (geplandPerWeek[mISO] || 0) + 1;
  }

  const gekozenKandidaten = [];
  for (const [mISO, dagenDezeWeek] of Object.entries(dagenPerWeek)) {
    const gesorteerd = [...dagenDezeWeek].sort((a, b) => a.datum.localeCompare(b.datum));
    const kaderWeek = kaderWeekVoorDatum(gesorteerd[0].datum, seizoensplan.kader, seizoensplan.startdatum);
    const frequentie = frequentieVoorWeek({ ctl, kaderWeek, beschikbareDagenNamen: beschikbareDagen, urenPerDag });
    for (const dag of gesorteerd) {
      const reedsGepland = geplandPerWeek[mISO] || 0;
      if (reedsGepland >= frequentie) continue;
      const alleSessiesVoorReeks = [...vasteSessiesBuitenBatch, ...gekozenKandidaten];
      if (heeftTeLangReeks(alleSessiesVoorReeks, { datum: dag.datum, type: "kandidaat" })) continue;
      gekozenKandidaten.push({ datum: dag.datum, type: "kandidaat" });
      geplandPerWeek[mISO] = reedsGepland + 1;
      dag.gekozen = true;
    }
  }

  const gekozenDagen = tePlannenDagen.filter((d) => d.gekozen);
  if (gekozenDagen.length === 0) return { sessies: [], tss_totaal: 0 };

  const archetypesData = await getAlleArchetypesRaw();
  const hrvProfiel = userId ? await kv.get(`hrv-profiel:${userId}`) : null;
  const piekSprint = (userId ? await kv.get(`piek_sprint_vermogen:${userId}`) : null) || Math.round((profiel?.ftp || 265) * 1.8);

  const gekozenPerWeek = {};
  for (const dag of gekozenDagen) {
    const mISO = weekMaandagISO(dag.datum);
    (gekozenPerWeek[mISO] ??= []).push(dag);
  }

  const wellnessPerWeek = {};
  async function haalWellnessVoorWeek(mISO, referentieDatum) {
    if (mISO in wellnessPerWeek) return wellnessPerWeek[mISO];
    const w = userId ? await haalWellnessVoorDatum(userId, referentieDatum) : null;
    wellnessPerWeek[mISO] = w;
    return w;
  }

  const toewijzingPerDatum = {};
  const alGeleverdPerWeek = {};
  for (const [mISO, dagenDezeWeek] of Object.entries(gekozenPerWeek)) {
    await haalWellnessVoorWeek(mISO, dagenDezeWeek[0].datum);

    const kaderWeekVoorDeze = kaderWeekVoorDatum(dagenDezeWeek[0].datum, seizoensplan.kader, seizoensplan.startdatum);
    const huidigeFaseVoorDeze = kaderWeekVoorDeze?.fase ?? "basis";
    const weekInFaseVoorDeze = weekInFaseVoorKaderWeek(kaderWeekVoorDeze, seizoensplan.kader);
    const aantalWekenInFaseVoorDeze = (seizoensplan.kader || []).filter((w) => w.fase === huidigeFaseVoorDeze).length || undefined;

    const rampTestDatum = kaderWeekVoorDeze?.bevat_tussentijdse_ftp_test
      ? laatsteTrainingsdagVanWeek(mISO, beschikbareDagen)
      : null;
    const rampTestDagDezeRun = rampTestDatum ? dagenDezeWeek.find((d) => d.datum === rampTestDatum) : null;
    const dagenVoorSolver = rampTestDagDezeRun ? dagenDezeWeek.filter((d) => d.datum !== rampTestDatum) : dagenDezeWeek;

    const vasteDagenDezeWeek = vasteSessiesBuitenBatch
      .filter((s) => weekMaandagISO(s.datum) === mISO)
      .map((s) => ({
        datum: s.datum,
        sessietype: s.intentie?.sessietype || s.type,
        tss_doel: s.tss ?? 0,
        status: s.voltooid ? "voltooid" : (s.status || "gepland"),
      }));
    const vasteDagenTss = vasteDagenDezeWeek
      .filter((d) => d.status !== "voltooid")
      .reduce((s, d) => s + (d.tss_doel ?? 0), 0);

    let laatsteKrachtLageCadansWeek;
    for (const s of vasteSessiesBuitenBatch) {
      if ((s.intentie?.sessietype || s.type) !== "kracht_lage_cadans" || !s.datum) continue;
      const wk = weeknummerVoorDatum(s.datum, seizoensplan.startdatum);
      if (laatsteKrachtLageCadansWeek == null || wk > laatsteKrachtLageCadansWeek) laatsteKrachtLageCadansWeek = wk;
    }

    if (dagenVoorSolver.length > 0) {
      try {
        const alGeleverd = userId ? await bepaalAlGeleverd(userId, mISO) : { tss: 0 };
        alGeleverdPerWeek[mISO] = alGeleverd;
        const wellnessDezeWeek = wellnessPerWeek[mISO];
        const tsbDezeWeek = wellnessDezeWeek ? Math.round((wellnessDezeWeek.ctl ?? 0) - (wellnessDezeWeek.atl ?? 0)) : null;
        const ruweToewijzingen = solveWeek({
          archetypesData,
          fase: huidigeFaseVoorDeze,
          weekInFase: weekInFaseVoorDeze,
          weektype: kaderWeekVoorDeze?.weektype || "opbouw",
          seizoensdoel: seizoensplan.seizoensdoel?.type ?? "ftp",
          weekTssDoel: kaderWeekVoorDeze?.tss_doel ?? 0,
          aantalWekenInFase: aantalWekenInFaseVoorDeze,
          weekNummerInSeizoen: kaderWeekVoorDeze?.week ?? null,
          laatsteKrachtLageCadansWeek: laatsteKrachtLageCadansWeek ?? null,
          vasteDagen: vasteDagenDezeWeek,
          openDagen: dagenVoorSolver.map((d) => ({ datum: d.datum, beschikbareUren: d.uren })),
          alGeleverd, tsb: tsbDezeWeek,
          bevrorenWeekInFase, weekVoorzichtig,
        });

        // Blok A: vóór pasBudgetToe (regel hieronder), zodat diens eigen
        // z2-herverdeling het vrijgekomen budget van een eventuele degradatie
        // meteen correct meerekent (zie weekSolver.js, verlaagBijHogeMonotonie).
        const { gedegradeerdeDatum } = verlaagBijHogeMonotonie(ruweToewijzingen, monotonieResultaat.trigger, {
          archetypesData,
          fase: huidigeFaseVoorDeze,
          weekInFase: weekInFaseVoorDeze,
          weektype: kaderWeekVoorDeze?.weektype || "opbouw",
          seizoensdoel: seizoensplan.seizoensdoel?.type ?? "ftp",
        });
        if (gedegradeerdeDatum && userId) {
          const dagLabel = DAGNAMEN[new Date(gedegradeerdeDatum).getDay()];
          maakMelding(userId, "monotonie_degradatie", { datum: gedegradeerdeDatum, dagLabel, monotonie: monotonieResultaat.monotonie }).catch(
            (e) => console.warn(`[weekSessiesDeterministisch] Melding-aanmaak (monotonie_degradatie) mislukt voor ${userId}:`, e.message)
          );
          // A3: hier schrijven, NIET bij het latere beschermd_herschikking-
          // doorkopieerpunt (per-dag-lus verderop) — pasBudgetToe (hieronder)
          // kan deze dag alsnog tot "rust" schrappen, waarna die latere lus
          // 'm overslaat vóórdat dat punt bereikt wordt. Dit punt vuurt altijd
          // wanneer de degradatie plaatsvond, ongeacht wat er later met het
          // budget gebeurt — consistent met de melding hierboven.
          zetWeekVoorzichtig(kv, userId, gedegradeerdeDatum).catch(
            (e) => console.warn(`[weekSessiesDeterministisch] zetWeekVoorzichtig mislukt voor ${userId}:`, e.message)
          );
          // B5-correctie: monotonie-degradatie triggert bewust GEEN
          // herschikkingspoging meer (zie STAP-overleg) — B1 (HRV-rood) blijft
          // de enige trigger voor probeerHerschikking. De gedegradeerde dag
          // blijft simpelweg staan zoals hierboven gegenereerd (z2_duur); de
          // beschermd_herschikking-markering (weekSolver.js:824, doorgekopieerd
          // hieronder) blijft wél bestaan, puur om deze dag uit te sluiten als
          // doelwit van een LATERE, onafhankelijke B1-herschikking.
        }

        const toewijzingen = pasBudgetToe(ruweToewijzingen, kaderWeekVoorDeze?.tss_doel ?? 0, alGeleverd.tss, vasteDagenTss);
        for (const t of toewijzingen) toewijzingPerDatum[t.datum] = t;
      } catch (e) {
        console.error(`[weekSessiesDeterministisch] solveWeek mislukt voor week ${mISO}:`, e.message);
      }
    }

    if (rampTestDagDezeRun) {
      toewijzingPerDatum[rampTestDatum] = {
        datum: rampTestDatum, sessietype: "ramp_test", tss_doel: null,
        toegestane_zones: [], archetype_hint: null, gedegradeerd: false,
        pad: "ftp_test", beschikbareUren: rampTestDagDezeRun.uren,
      };
    }
  }

  const gegenereerd = [];
  for (const { datum, dag: dagNaam, uren } of gekozenDagen) {
    const toewijzing = toewijzingPerDatum[datum];
    if (!toewijzing) {
      console.warn(`[weekSessiesDeterministisch] Geen weeksolver-toewijzing voor ${datum} — dag overgeslagen`);
      continue;
    }
    if (toewijzing.sessietype === "rust") {
      console.log(`[weekSessiesDeterministisch] ${datum}: weeksolver-budget geschrapt naar rustdag — geen sessie aangemaakt`);
      continue;
    }

    const mISO = weekMaandagISO(datum);
    const kaderWeekVoorDag = kaderWeekVoorDatum(datum, seizoensplan.kader, seizoensplan.startdatum);
    const huidigeFase = kaderWeekVoorDag?.fase ?? "basis";
    const weekInFase = weekInFaseVoorKaderWeek(kaderWeekVoorDag, seizoensplan.kader);

    try {
      if (toewijzing.sessietype === "ramp_test") {
        const sessie = bouwRampTestSessie(datum, dagNaam);
        gegenereerd.push(sessie);
        continue;
      }

      const overigeSessies = [...vasteSessiesBuitenBatch, ...gegenereerd].filter((s) => s.datum !== datum && !s.voltooid);
      const alGeleverdVoorDag = alGeleverdPerWeek[mISO] ?? (userId ? await bepaalAlGeleverd(userId, mISO) : { tss: 0 });

      const sessie = await genereerSessieDag({
        kv, userId, datum, dagNaam, uren,
        profiel, wellness: wellnessPerWeek[mISO] ?? null, plan: seizoensplan, overigeSessies,
        oudeSessie: { intentie: { sessietype: toewijzing.sessietype, tss_doel: toewijzing.tss_doel } },
        aanleiding: "beschikbaarheid_nieuw",
        huidigeFase, weekInFase, weektype: kaderWeekVoorDag?.weektype || "opbouw", hrvProfiel, piekSprint,
        magIngebedIntensiefArchetype: toewijzing?.magIngebedIntensiefArchetype ?? true,
        weekTssDoel: kaderWeekVoorDag?.tss_doel ?? null, alGeleverdTss: alGeleverdVoorDag?.tss ?? null,
        alleSessiesVoorKrachtCheck: [...vasteSessiesBuitenBatch, ...gegenereerd],
      });

      if (sessie?._geenSessie) {
        console.log(`[weekSessiesDeterministisch] ${datum}: resterend weekbudget te klein — geen sessie aangemaakt`);
        continue;
      }

      // B5: verlaagBijHogeMonotonie (weekSolver.js) zet beschermd_herschikking
      // op de TOEWIJZING (solveWeek-tussenobject) — genereerSessieDag bouwt de
      // uiteindelijke sessie als een los object en neemt dat veld niet vanzelf
      // over, dus hier expliciet doorzetten naar de daadwerkelijk opgeslagen sessie.
      if (toewijzing.beschermd_herschikking) sessie.beschermd_herschikking = true;

      logSessieGegenereerd(sessie, { userId, huidigeFase, weekInFase });
      gegenereerd.push(sessie);
    } catch (e) {
      console.error(`[weekSessiesDeterministisch] ${userId} ${datum} mislukt:`, e.message);
    }
  }

  const tss_totaal = gegenereerd.reduce((s, x) => s + (x.tss || 0), 0);
  return { sessies: gegenereerd, tss_totaal };
}
