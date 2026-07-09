import { getKV } from "@/lib/kv";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet, intervalsPost } from "@/lib/intervals";
import { vandaagISO, datumISO, DAGNAMEN } from "@/lib/datum";
import { maxTrainingsdagenPerWeek, heeftTeLangReeks } from "@/lib/trainingsfrequentie";
import { sessieNaarZwo } from "@/lib/workoutZwo";
import { normaliseerSessieSegmenten } from "@/lib/sessie/normaliseer";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";
import { voegVerwachtRpeToe } from "@/lib/sessie/rpe";
import { corrigeerSessieTss } from "@/lib/sessie/tssValidatie";
import { berekenBlok, bouwZonesUitProfiel } from "@/lib/vermogensbereik";
import { magSprintStaartje } from "@/lib/sessie/weekpatroon";
import { genereerSessieDag, logSessieGegenereerd } from "@/lib/sessie/genereren";
import { voegSprintStaartjesToe, voegTempoAfsluiterToe } from "@/lib/sessie/segmentStaart";
import { solveWeek, pasBudgetToe } from "@/lib/sessie/weekSolver";
import { bepaalAlGeleverd } from "@/lib/sessie/context";
import { getAlleArchetypesRaw } from "@/lib/sessie-archetypes";
import { genereerRampTestSessie } from "@/lib/sessie/rampTest";
import { logEvent } from "@/lib/posthog";
import { maakMelding } from "@/lib/meldingen";
import { haalAfwezigheidsperiodes, valtBinnenAfwezigheid } from "@/lib/afwezigheid";

const VERBODEN_TYPES_VOLUMECORRECTIE = ["kracht_lage_cadans", "sprint_neuraal"];

// Sectie 51-C: maandag-eerst volgorde om de laatste trainingsdag van een week
// te bepalen uit plan.beschikbaarheid (een wekelijks terugkerend dagpatroon,
// niet per-week data) — zelfde volgorde als elders (AppClient.js, SessionCard.js).
const DAGVOLGORDE_MAANDAG_EERST = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

/**
 * Laatste (chronologisch) beschikbare trainingsdag van de week die op mISO
 * (maandag, ISO-datum) begint, op basis van het wekelijkse beschikbaarheid-
 * patroon. Retourneert null als er geen enkele trainingsdag is.
 */
function laatsteTrainingsdagVanWeek(mISO, beschikbareDagenNamen) {
  const indices = beschikbareDagenNamen
    .map((naam) => DAGVOLGORDE_MAANDAG_EERST.indexOf(naam))
    .filter((i) => i >= 0);
  if (indices.length === 0) return null;
  const d = new Date(mISO);
  d.setDate(d.getDate() + Math.max(...indices));
  return datumISO(d);
}

/**
 * Sectie 51-C/51-B: bouwt de volledige sessie-vorm rond genereerRampTestSessie()'s
 * protocol-output. Geëxporteerd omdat sectie 51-D (handmatige sessie-picker,
 * PUT /api/sessie/kies) dezelfde wrapping nodig heeft voor de "tests"-categorie.
 */
export function bouwRampTestSessie(datum, dagNaam) {
  const rampTest = genereerRampTestSessie();
  return {
    ...rampTest,
    type: "ramp_test",
    titel: "Tussentijdse FTP-test (Ramp Test)",
    duur_min: rampTest.duur_min_geschat,
    datum,
    dag: dagNaam,
    intentie: {
      rol: "ftp_test",
      sessietype: "ramp_test",
      tss_doel: null,
    },
  };
}


export async function vulSessiesAanVoorGebruiker(userId, { aerobeDagen = [], tempoAfsluiters = [], verlengingen = [] } = {}) {
  const kv = getKV();
  const planKey = `${userId}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan?.kader || !plan.beschikbaarheid) return { status: "geen_plan" };

  const creds = await getIntervalsCredentials(userId);
  if (!creds) return { status: "geen_credentials" };

  // Eén keer opgehaald (cache-first, zie sessie-archetypes.js) — solveWeek()
  // wijst binnen deze run mogelijk meerdere weken/sessietypes toe.
  const archetypesData = await getAlleArchetypesRaw();

  // Afwezigheidsperiodes uitsluiten van de open-dagen-pool, vóór budget-
  // verdeling — zelfde niveau als de beschikbaarheid-uit-check hieronder,
  // i.p.v. pas bij genereerSessieDag() zelf (dan heeft solveWeek() de dag al
  // meegeteld bij de TSS-verdeling over de week).
  const afwezigheidsperiodes = await haalAfwezigheidsperiodes(userId);

  const vandaag = vandaagISO();
  const beschikbareDagen = Object.entries(plan.beschikbaarheid).filter(([, v]) => v).map(([k]) => k);
  const beschikbareDagenAantal = beschikbareDagen.length;

  const urenPerDag = plan.urenPerDag || {};
  const bestaandeSessies = plan.weekSessies?.sessies || [];
  const bestaandeDatums = new Set(bestaandeSessies.map(s => s.datum));

  // ISO-weeknummer van de aankomende week (voor volumecorrectie-metadata)
  const nu = new Date();
  const aankomendeMaandag = new Date(nu);
  aankomendeMaandag.setDate(nu.getDate() + ((8 - nu.getDay()) % 7 || 7));
  const dWeek = new Date(Date.UTC(aankomendeMaandag.getFullYear(), aankomendeMaandag.getMonth(), aankomendeMaandag.getDate()));
  dWeek.setUTCDate(dWeek.getUTCDate() + 4 - (dWeek.getUTCDay() || 7));
  const weekYearStart = new Date(Date.UTC(dWeek.getUTCFullYear(), 0, 1));
  const aankomendeWeekNr = Math.ceil((((dWeek - weekYearStart) / 86400000) + 1) / 7);

  const ctlBasis = plan.huidige_ctl ?? 40;

  // Hulp: maandag-ISO voor een datum (voor week-groepering)
  function weekMaandagISO(isoDate) {
    const d = new Date(isoDate);
    const dag = d.getDay();
    const offset = dag === 0 ? -6 : 1 - dag;
    d.setDate(d.getDate() + offset);
    return datumISO(d);
  }

  // Hulp: kaderweek voor een datum
  function kaderWeekVoorDatum(isoDate) {
    if (!plan.startdatum) return plan.kader?.[0] || null;
    const weekNr = weeknummerVoorDatum(isoDate, plan.startdatum);
    return plan.kader?.find(w => w.week === weekNr) || plan.kader?.[0] || null;
  }

  // Hulp: week-in-fase (1-based) voor een kaderweek
  function weekInFaseVoorKaderWeek(kaderWeek) {
    if (!kaderWeek || !plan.kader) return 1;
    const sorted = [...plan.kader].sort((a, b) => a.week - b.week);
    const fase = kaderWeek.fase;
    let teller = 0;
    for (const w of sorted) {
      if (w.fase === fase) teller++;
      if (w.week === kaderWeek.week) return teller;
    }
    return 1;
  }

  const ontbrekend = [];
  // Per week bijhouden hoeveel al gepland — voor frequentie-stop
  const geplandPerWeek = {};

  // Initialiseer geplandPerWeek vanuit bestaandeSessies
  for (const s of bestaandeSessies) {
    if (s.voltooid || !s.datum) continue;
    if (s.type === "herstel_mobiliteit" || s.intentie?.sessietype === "herstel_mobiliteit") continue;
    const mISO = weekMaandagISO(s.datum);
    geplandPerWeek[mISO] = (geplandPerWeek[mISO] || 0) + 1;
  }

  for (let i = 1; i <= 7; i++) {
    const d = new Date(nu);
    d.setDate(nu.getDate() + i);
    const iso = datumISO(d);
    const dagNaam = DAGNAMEN[d.getDay()];
    if (!beschikbareDagen.includes(dagNaam) || bestaandeDatums.has(iso) || iso <= vandaag) continue;
    if (valtBinnenAfwezigheid(iso, afwezigheidsperiodes)) continue;

    const mISO = weekMaandagISO(iso);
    const kaderWeek = kaderWeekVoorDatum(iso);
    const frequentie = kaderWeek?.trainingsfrequentie ?? maxTrainingsdagenPerWeek(ctlBasis);
    const reedsGepland = geplandPerWeek[mISO] || 0;

    // Stop-conditie 1: frequentie bereikt voor deze week
    if (reedsGepland >= frequentie) continue;

    // Stop-conditie 2: zou 4+ opeenvolgende trainingsdagen opleveren
    // Gebruik ALLE sessies (niet alleen dezelfde week) — reeks kan weekgrens overschrijden
    // Inclusief al toegevoegde ontbrekend-entries van deze run
    const alleSessiesVoorReeks = [
      ...bestaandeSessies.filter(s => !s.voltooid),
      ...ontbrekend,
    ];
    if (heeftTeLangReeks(alleSessiesVoorReeks, { datum: iso, type: "kandidaat" })) continue;

    ontbrekend.push({ datum: iso, dagNaam, uren: urenPerDag[dagNaam] || 1.5 });
    geplandPerWeek[mISO] = reedsGepland + 1;
  }

  if (ontbrekend.length === 0) return { status: "compleet" };

  let profiel;
  try {
    const athlete = await intervalsGet("/", {}, creds);
    const rideSport = (athlete.sportSettings || []).find(s => s.types?.includes("Ride")) || {};
    profiel = {
      ftp: rideSport.ftp || plan.huidige_ftp || 265,
      lt_hr: rideSport.lthr || 184,
      max_hr: rideSport.max_hr || 200,
      gewicht: athlete.icu_weight || 90,
      hrv_basislijn: plan.profiel?.hrv_basislijn || 58,
      hr_basislijn: plan.profiel?.hr_basislijn || 49,
      power_zones: rideSport.power_zones || null,
    };
  } catch {
    profiel = { ftp: plan.huidige_ftp || 265, lt_hr: 184, max_hr: 200, gewicht: 90, hrv_basislijn: 58, hr_basislijn: 49, power_zones: null };
  }

  const piekSprint = await kv.get(`piek_sprint_vermogen:${userId}`) || Math.round((profiel.ftp || 265) * 1.8);
  const hrvProfiel = await kv.get(`hrv-profiel:${userId}`);

  // Bug 2 uit het diagnoserapport: wellness/TSB werd één keer opgehaald voor
  // "vandaag" en vervolgens hergebruikt voor élke in te vullen dag, ook dagen
  // in een andere kalenderweek. Nu per kalenderweek opnieuw opgehaald, met de
  // eerste ontbrekende dag van die week als referentiedatum (kan een
  // toekomstige datum zijn — intervals.icu kan daarvoor een geprojecteerde
  // CTL/ATL teruggeven op basis van al geplande activiteiten).
  const wellnessPerWeek = {};
  async function haalWellnessVoorWeek(mISO, referentieDatum) {
    if (mISO in wellnessPerWeek) return wellnessPerWeek[mISO];
    let w = null;
    try {
      const wData = await intervalsGet("/wellness", { oldest: referentieDatum, newest: referentieDatum }, creds);
      if (wData?.length > 0) w = wData[0];
    } catch (e) {
      console.warn(`[sessiesAanvullen] wellness-ophalen mislukt voor week ${mISO}:`, e.message);
    }
    wellnessPerWeek[mISO] = w;
    return w;
  }
  function tsbVanWellness(w) {
    return w ? Math.round((w.ctl ?? 0) - (w.atl ?? 0)) : null;
  }

  const aangevuld = [];

  // Sectie 48: groepeer ontbrekende dagen per week, zodat solveWeek() alle open
  // dagen van een week in één keer ziet (nodig voor kernstimulus/secundair-
  // verdeling en adjacency-check — een per-dag-aanroep zou dat niet kunnen).
  // Volumecorrectie-dagen (aerobeDagen/tempoAfsluiters) blijven hier buiten:
  // die vereisen precieze structurele ingrepen (bv. een aangeplakt Z3-blok) die
  // het archetype/variant-systeem niet kan uitdrukken, dus die blijven volledig
  // via Claude (met promptExtra) lopen, zoals vóór sectie 47/48.
  const ontbrekendPerWeek = {};
  for (const dag of ontbrekend) {
    const mISO = weekMaandagISO(dag.datum);
    (ontbrekendPerWeek[mISO] ??= []).push(dag);
  }

  const toewijzingPerDatum = {};
  // Hergebruikt in de per-dag-loop verderop, zodat genereerSessieDag() daar
  // ook het resterende weekbudget kent — anders herberekent het zijn eigen
  // dagbudget puur op basis van beschikbare uren, zonder te weten dat de
  // week al (fors) over budget kan zijn.
  const alGeleverdPerWeek = {};
  for (const [mISO, dagenDezeWeek] of Object.entries(ontbrekendPerWeek)) {
    // Wellness per week ophalen vóór de volumecorrectie-filter, zodat ook
    // weken die uitsluitend volumecorrectie-dagen bevatten (zie continue
    // hieronder) een gecachte waarde hebben voor de per-dag-loop verderop.
    await haalWellnessVoorWeek(mISO, dagenDezeWeek[0].datum);

    const normaleDagen = dagenDezeWeek.filter(
      d => !aerobeDagen.includes(d.datum) && !tempoAfsluiters.includes(d.datum)
    );
    if (normaleDagen.length === 0) continue;

    const kaderWeekVoorDeze = kaderWeekVoorDatum(normaleDagen[0].datum);
    const huidigeFaseVoorDeze = kaderWeekVoorDeze?.fase ?? 'basis';
    const weekInFaseVoorDeze = weekInFaseVoorKaderWeek(kaderWeekVoorDeze);
    const aantalWekenInFaseVoorDeze = (plan.kader || []).filter(w => w.fase === huidigeFaseVoorDeze).length || undefined;

    // Sectie 51-C: week met bevat_tussentijdse_ftp_test → laatste trainingsdag
    // van die week gaat NIET door solveWeek() (dat kent geen ramp_test), maar
    // wordt direct geforceerd. Alleen als die datum ook daadwerkelijk in deze
    // run open staat (normaleDagen) — anders is 'm al eerder gepland/bestaat
    // al, of valt buiten dit 7-dagen-venster; dan komt hij in een latere run.
    const rampTestDatum = kaderWeekVoorDeze?.bevat_tussentijdse_ftp_test
      ? laatsteTrainingsdagVanWeek(mISO, beschikbareDagen)
      : null;
    const rampTestDagDezeRun = rampTestDatum
      ? normaleDagen.find(d => d.datum === rampTestDatum)
      : null;
    const dagenVoorSolver = rampTestDagDezeRun
      ? normaleDagen.filter(d => d.datum !== rampTestDatum)
      : normaleDagen;
    const vasteDagenDezeWeek = [...bestaandeSessies, ...aangevuld]
      .filter(s => weekMaandagISO(s.datum) === mISO)
      .map(s => ({
        datum: s.datum,
        sessietype: s.intentie?.sessietype || s.type,
        tss_doel: s.tss ?? 0,
        status: s.voltooid ? 'voltooid' : (s.status || 'gepland'),
      }));
    // Bug 1 uit het diagnoserapport: TSS van reeds bestaande, nog niet gereden
    // sessies deze week (bv. uit een eerdere weekSessies-job-run) telde nergens
    // mee in het budget. 'voltooid'-dagen uitgesloten — die zitten al in
    // alGeleverd.tss (via bepaalAlGeleverd's intervals.icu-activiteiten-query),
    // meetellen zou dubbeltelling zijn.
    const vasteDagenTss = vasteDagenDezeWeek
      .filter(d => d.status !== 'voltooid')
      .reduce((s, d) => s + (d.tss_doel ?? 0), 0);

    // Fix 2: kracht_lage_cadans-frequentiegate heeft het weeknummer nodig waarin
    // dat sessietype voor het laatst is toegewezen, om het interval (1x/week,
    // 1x/2 weken) te bewaken over meerdere solveWeek()-aanroepen heen.
    let laatsteKrachtLageCadansWeek;
    for (const s of [...bestaandeSessies, ...aangevuld]) {
      if ((s.intentie?.sessietype || s.type) !== 'kracht_lage_cadans' || !s.datum) continue;
      const wk = weeknummerVoorDatum(s.datum, plan.startdatum);
      if (laatsteKrachtLageCadansWeek == null || wk > laatsteKrachtLageCadansWeek) laatsteKrachtLageCadansWeek = wk;
    }

    try {
      const alGeleverd = await bepaalAlGeleverd(userId, mISO);
      alGeleverdPerWeek[mISO] = alGeleverd;
      const tsbDezeWeek = tsbVanWellness(wellnessPerWeek[mISO]);
      const ruweToewijzingen = solveWeek({
        archetypesData,
        fase: huidigeFaseVoorDeze,
        weekInFase: weekInFaseVoorDeze,
        weektype: kaderWeekVoorDeze?.weektype || 'opbouw',
        seizoensdoel: plan.seizoensdoel?.type ?? 'ftp',
        weekTssDoel: kaderWeekVoorDeze?.tss_doel ?? 0,
        aantalWekenInFase: aantalWekenInFaseVoorDeze,
        weekNummerInSeizoen: kaderWeekVoorDeze?.week ?? null,
        laatsteKrachtLageCadansWeek: laatsteKrachtLageCadansWeek ?? null,
        vasteDagen: vasteDagenDezeWeek,
        openDagen: dagenVoorSolver.map(d => ({ datum: d.datum, beschikbareUren: d.uren })),
        alGeleverd, tsb: tsbDezeWeek,
      });
      const toewijzingen = pasBudgetToe(ruweToewijzingen, kaderWeekVoorDeze?.tss_doel ?? 0, alGeleverd.tss, vasteDagenTss);
      for (const t of toewijzingen) {
        toewijzingPerDatum[t.datum] = t;
        if (t.pad === "vrijheidsessie") {
          logEvent("vrijheidsdag_getriggerd", userId, { fase: huidigeFaseVoorDeze, weekInFase: weekInFaseVoorDeze, archetype_hint: t.archetype_hint ?? null });
        }
      }
    } catch (e) {
      console.error(`[sessiesAanvullen] solveWeek mislukt voor week ${mISO}:`, e.message);
      // Geen toewijzingen voor deze week — dagen hieronder worden per stuk overgeslagen.
    }

    // Buiten de try/catch: de ramp-test-dag is structureel onaantastbaar en
    // hangt niet af van solveWeek()/pasBudgetToe() slagen — zelfde bescherming
    // als een kernstimulus-sessie (nooit sluitpost, nooit budget-gekort).
    if (rampTestDagDezeRun) {
      toewijzingPerDatum[rampTestDatum] = {
        datum: rampTestDatum,
        sessietype: 'ramp_test',
        tss_doel: null,
        toegestane_zones: [],
        archetype_hint: null,
        gedegradeerd: false,
        pad: 'ftp_test',
        beschikbareUren: rampTestDagDezeRun.uren,
      };
    }
  }

  for (const { datum, dagNaam, uren } of ontbrekend) {
    try {
      const overigeSessies = [...bestaandeSessies, ...aangevuld]
        .filter(s => s.datum !== datum && !s.voltooid);

      const kaderWeekVoorDag = kaderWeekVoorDatum(datum);
      const huidigeFase = kaderWeekVoorDag?.fase ?? 'basis';
      const weekInFase = weekInFaseVoorKaderWeek(kaderWeekVoorDag);
      const mISOVoorDag = weekMaandagISO(datum);
      const wellnessVoorDezeDag = wellnessPerWeek[mISOVoorDag] ?? null;
      const tsbVoorDezeDag = tsbVanWellness(wellnessVoorDezeDag);

      const isAerobeCompensatie = aerobeDagen.includes(datum);
      const isTempoAfsluiter = tempoAfsluiters.includes(datum);
      const isVolumeCorrectieDag = isAerobeCompensatie || isTempoAfsluiter;

      let oudeSessieVoorGeneratie = null;
      let effectiefSessietypeOverride;
      let toewijzing = null;
      if (isVolumeCorrectieDag) {
        // Volumecorrectie-dagen krijgen altijd een aerobe z2_duur-kern —
        // voorheen een Claude-promptinstructie ("gebruik uitsluitend z2_duur
        // of progressief, geen kracht/sprint"), nu een directe deterministische
        // toewijzing. De tempo-afsluiter-staart wordt hierna aangeplakt
        // (voegTempoAfsluiterToe), ook deterministisch.
        effectiefSessietypeOverride = 'z2_duur';
      } else {
        toewijzing = toewijzingPerDatum[datum];
        if (!toewijzing) {
          console.error(`[sessiesAanvullen] Geen weeksolver-toewijzing voor ${datum} — dag overgeslagen`);
          continue;
        }
        if (toewijzing.sessietype === 'rust') {
          console.log(`[sessiesAanvullen] ${datum}: weeksolver-budget geschrapt naar rustdag — geen sessie aangemaakt`);
          continue;
        }
        if (toewijzing.sessietype !== 'ramp_test') {
          oudeSessieVoorGeneratie = { intentie: { sessietype: toewijzing.sessietype, tss_doel: toewijzing.tss_doel } };
        }
      }

      // Weekbudget-clamp niet toepassen op volumecorrectie-dagen: die krijgen
      // hun sessie bewust via een aparte, al budget-bewuste correctielogica
      // (volumeCorrectie.js) — de generieke clamp hieronder is voor de
      // reguliere weeksolver-toewijzing.
      const alGeleverdVoorDag = isVolumeCorrectieDag ? null : (alGeleverdPerWeek[mISOVoorDag] ?? await bepaalAlGeleverd(userId, mISOVoorDag));

      // Sectie 51-B/C: ramp_test heeft geen archetype/variantendata (bewust
      // uitgesloten, zie TEST_SESSIETYPES) en gaat dus niet via genereerSessieDag
      // — vast protocol i.p.v. het deterministische archetype-pad.
      const sessie = toewijzing?.sessietype === 'ramp_test'
        ? bouwRampTestSessie(datum, dagNaam)
        : await genereerSessieDag({
            kv, userId, datum, dagNaam, uren,
            profiel, wellness: wellnessVoorDezeDag, plan, overigeSessies,
            oudeSessie: oudeSessieVoorGeneratie,
            effectiefSessietype: effectiefSessietypeOverride,
            aanleiding: isAerobeCompensatie ? "volumecorrectie_aerobe" : isTempoAfsluiter ? "volumecorrectie_tempo_afsluiter" : "beschikbaarheid_nieuw",
            huidigeFase, weekInFase, weektype: kaderWeekVoorDag?.weektype || 'opbouw', hrvProfiel, piekSprint,
            weekTssDoel: isVolumeCorrectieDag ? null : (kaderWeekVoorDag?.tss_doel ?? null),
            alGeleverdTss: alGeleverdVoorDag?.tss ?? null,
            alleSessiesVoorKrachtCheck: [...bestaandeSessies, ...aangevuld],
          });

      if (sessie?._geenSessie) {
        console.log(`[sessiesAanvullen] ${datum}: resterend weekbudget te klein — geen sessie aangemaakt`);
        if (userId) {
          maakMelding(userId, "overbelastingsgate_nieuwe_dag", {
            datum, dagLabel: dagNaam,
            tekst: `${dagNaam} is een rustdag gebleven: je hebt deze week al meer TSS geleverd dan het weekdoel toestaat, dus is er geen extra sessie ingepland.`,
          }).catch((e) => console.warn(`[sessiesAanvullen] melding-aanmaak (weekbudget) mislukt voor ${datum}:`, e.message));
        }
        continue;
      }

      if (isTempoAfsluiter) {
        const maxMinuten = Math.round(uren * 60);
        const afsluiterDuurMin = Math.min(20, Math.max(15, Math.round(maxMinuten * 0.25)));
        voegTempoAfsluiterToe(sessie, profiel.ftp, afsluiterDuurMin);
        normaliseerSessieSegmenten(sessie);
        voegVerwachtRpeToe(sessie);
        corrigeerSessieTss(sessie);
      }

      // Sprint-staartjes post-generatie check: z2_duur in basisfase
      if (
        huidigeFase === 'basis' &&
        kaderWeekVoorDag?.weektype !== 'herstel' &&
        (sessie.intentie?.sessietype === 'z2_duur' || sessie.intentie?.sessietype === 'z2_heuvel') &&
        !sessie.intentie?.heeft_sprint_staartjes &&
        (tsbVoorDezeDag === null || tsbVoorDezeDag >= -25)
      ) {
        const mISO = mISOVoorDag;
        const alleWeekSessies = [
          ...bestaandeSessies.filter(s => weekMaandagISO(s.datum) === mISO),
          ...aangevuld.filter(s => weekMaandagISO(s.datum) === mISO),
          { ...sessie, datum },
        ];
        // Skip als een andere sessie in deze week de vlag al heeft (bijv. via plan-opslag)
        const heeftAlSprintVlag = alleWeekSessies.some(
          s => s.datum !== datum && s.intentie?.heeft_sprint_staartjes === true
        );
        if (!heeftAlSprintVlag && magSprintStaartje({ ...kaderWeekVoorDag, dagen: alleWeekSessies }, { ...sessie, datum }, tsbVoorDezeDag)) {
          voegSprintStaartjesToe(sessie, profiel.ftp);
          normaliseerSessieSegmenten(sessie);
          voegVerwachtRpeToe(sessie);
          corrigeerSessieTss(sessie);
          console.log(`[sessiesAanvullen] Sprint-staartjes toegevoegd voor ${datum}`);
        }
      }

      // Deterministisch vangnet: verboden sessietypes bij volumecorrectie.
      // Dit vervangt segmenten NA genereerSessieDag's interne vermogensbereik-stap,
      // dus het vervangende Z2-blok moet hier zelf opnieuw door berekenBlok.
      const isVolumeCorrectie = aerobeDagen.includes(datum) || tempoAfsluiters.includes(datum);
      if (isVolumeCorrectie) {
        const sessietype = sessie.intentie?.sessietype || sessie.sessietype || "";
        if (VERBODEN_TYPES_VOLUMECORRECTIE.includes(sessietype)) {
          const reden = `${sessietype} niet toegestaan bij volumecorrectie`;
          console.warn(`[sessiesAanvullen] ${userId} ${datum}: type-fix → z2_duur (${reden})`);
          try {
            await kv.set(`volumecorrectie_type_fix:${userId}:${datum}`, { datum, vervangen: sessietype, door: "z2_duur", reden }, { ex: 30 * 86400 });
          } catch {}
          sessie.type = "duur_variabel";
          sessie.titel = "Z2 Duur — Volumecorrectie";
          if (sessie.intentie) {
            sessie.intentie.sessietype = "z2_duur";
            sessie.intentie.rol = "aerobe_dag";
            sessie.intentie.toegestane_zones = ["Z2"];
          }
          sessie.duur_min = Math.round(uren * 60);
          sessie.segmenten = [{
            zone: "Z2",
            positie: "midden",
            blokDuurSeconden: sessie.duur_min * 60,
            isSpecifiek: false,
            sessietype: "z2_duur",
          }];
          corrigeerSessieTss(sessie);
          if (profiel.power_zones && profiel.ftp) {
            try {
              const zones = bouwZonesUitProfiel(profiel.ftp, profiel.power_zones);
              sessie.segmenten = sessie.segmenten.map(seg => berekenBlok(seg, zones, profiel.ftp, piekSprint, "z2_duur"));
            } catch (e) { console.warn(`[sessiesAanvullen] Vermogensbereik mislukt voor ${datum}:`, e.message); }
          }
        }
      }

      // ramp_test heeft een per definitie variabele/onvoorspelbare einduur (protocol
      // i.p.v. segmenten, eindigt bij uitputting) — de minimumduur-eis hieronder is
      // bedoeld voor doseerbare trainingsstimuli en is hier niet van toepassing.
      if (sessie.intentie?.sessietype !== 'ramp_test') {
        const totaalMinuten = (sessie.segmenten || []).reduce((som, seg) => som + (seg.blokDuurSeconden || seg.duur_min * 60 || 0), 0) / 60;
        if (totaalMinuten < 60) {
          console.warn(`[sessiesAanvullen] ${userId} ${datum}: sessie te kort (${Math.round(totaalMinuten)} min) — overgeslagen`);
          logEvent("sessie_te_kort_overgeslagen", userId, {
            sessietype: sessie.intentie?.sessietype ?? sessie.type ?? null,
            datum, totaalMinuten: Math.round(totaalMinuten),
          });
          continue;
        }
      }

      if (aerobeDagen.includes(datum)) {
        sessie.volumecorrectie = { aanleiding: "nieuwe_dag", beschikbareDagen: beschikbareDagenAantal, weekNr: aankomendeWeekNr };
      } else if (tempoAfsluiters.includes(datum)) {
        sessie.volumecorrectie = { aanleiding: "tempo_afsluiter", beschikbareDagen: beschikbareDagenAantal, weekNr: aankomendeWeekNr };
      }

      // Z1-validatie gebeurt nu centraal binnen genereerSessieDag() zelf (zie
      // genereren.js) — elke aanroeper krijgt 'm daar al, geen losse kopie meer nodig.

      try {
        const zwo = sessieNaarZwo(sessie, profiel.ftp || 265);
        const eventBody = {
          category: "WORKOUT",
          start_date_local: `${datum}T08:00:00`,
          name: sessie.titel || sessie.type,
          type: "Ride",
          moving_time: (sessie.duur_min || 90) * 60,
          ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
        };
        const result = await intervalsPost("/events", eventBody, creds);
        if (result.id) {
          sessie.intervalsEventId = result.id;
          if (result.icu_training_load) {
            sessie.tss = result.icu_training_load;
            sessie.tss_bron = "intervals_icu";
          }
        }
      } catch (e) {
        console.warn(`[sessiesAanvullen] Intervals sync mislukt voor ${datum}:`, e.message);
      }

      if (toewijzing?.sessietype !== 'ramp_test') logSessieGegenereerd(sessie, { userId, huidigeFase, weekInFase });
      aangevuld.push(sessie);
      console.log(`[sessiesAanvullen] ${userId} ${datum}: ${sessie.type} ${sessie.duur_min}min`);
    } catch (e) {
      console.error(`[sessiesAanvullen] ${userId} ${datum} mislukt:`, e.message);
    }
  }

  if (aangevuld.length > 0) {
    const huidigPlan = await kv.get(planKey);
    const bestaandeDatumsNu = new Set((huidigPlan.weekSessies?.sessies || []).map(s => s.datum));
    const uniekAangevuld = aangevuld.filter(s => !bestaandeDatumsNu.has(s.datum));
    if (uniekAangevuld.length > 0) {
      huidigPlan.weekSessies = {
        ...huidigPlan.weekSessies,
        sessies: [...(huidigPlan.weekSessies?.sessies || []), ...uniekAangevuld],
      };
      await kv.set(planKey, huidigPlan);
    }
  }

  // Verlengingen: bestaande sessies regenereren met uitgebreide duur tot het dag-maximum
  const verlengd = [];
  for (const { datum, maxMinuten } of verlengingen) {
    try {
      const bestaandeSessie = bestaandeSessies.find(s => s.datum === datum && !s.voltooid);
      if (!bestaandeSessie) {
        console.warn(`[sessiesAanvullen] verleng_sessie: geen niet-voltooide sessie gevonden voor ${datum}`);
        continue;
      }
      if (!maxMinuten) {
        console.warn(`[sessiesAanvullen] verleng_sessie: maxMinuten ontbreekt voor ${datum}, overgeslagen`);
        continue;
      }
      const dagNaamV = bestaandeSessie.dag || DAGNAMEN[new Date(datum).getDay()];
      const urenV = maxMinuten / 60;

      const overigeSessies = [...bestaandeSessies, ...aangevuld]
        .filter(s => s.datum !== datum && !s.voltooid);

      const kaderWeekVoorDag = kaderWeekVoorDatum(datum);
      const huidigeFase = kaderWeekVoorDag?.fase ?? 'basis';
      const weekInFase = weekInFaseVoorKaderWeek(kaderWeekVoorDag);
      const wellnessVoorDezeDag = await haalWellnessVoorWeek(weekMaandagISO(datum), datum);
      const promptExtra = `\n\nVOLUMECORRECTIE — VERLENGING (harde instructie): Verleng deze sessie van ${bestaandeSessie.duur_min || "?"}min naar maximaal ${maxMinuten}min. Behoud het sessietype en de intensiteitsstructuur. Voeg Z2-volume toe aan het einde. De totale sessieduur mag ${maxMinuten}min NIET overschrijden.`;

      const sessie = await genereerSessieDag({
        kv, userId, datum, dagNaam: dagNaamV, uren: urenV,
        profiel, wellness: wellnessVoorDezeDag, plan, overigeSessies,
        oudeSessie: bestaandeSessie,
        aanleiding: "beschikbaarheid_uren",
        promptExtra, huidigeFase, weekInFase, hrvProfiel, piekSprint,
        alleSessiesVoorKrachtCheck: [...bestaandeSessies, ...aangevuld],
      });
      if (bestaandeSessie.intervalsEventId) sessie.intervalsEventId = bestaandeSessie.intervalsEventId;
      if (bestaandeSessie.intentie) sessie.intentie = { ...bestaandeSessie.intentie, ...sessie.intentie };

      sessie.volumecorrectie = { aanleiding: "verleng_sessie", weekNr: aankomendeWeekNr };

      try {
        const zwo = sessieNaarZwo(sessie, profiel.ftp || 265);
        const eventBody = {
          category: "WORKOUT",
          start_date_local: `${datum}T08:00:00`,
          name: sessie.titel || sessie.type,
          type: "Ride",
          moving_time: (sessie.duur_min || 90) * 60,
          ...(zwo ? { file_contents: zwo, file_type: "zwo" } : {}),
        };
        const result = await intervalsPost("/events", eventBody, creds);
        if (result.id) {
          sessie.intervalsEventId = result.id;
          if (result.icu_training_load) { sessie.tss = result.icu_training_load; sessie.tss_bron = "intervals_icu"; }
        }
      } catch (e) {
        console.warn(`[sessiesAanvullen] Intervals sync mislukt voor verlengd ${datum}:`, e.message);
      }

      logSessieGegenereerd(sessie, { userId, huidigeFase, weekInFase });
      verlengd.push(sessie);
      console.log(`[sessiesAanvullen] verleng_sessie ${userId} ${datum}: ${sessie.type} ${sessie.duur_min}min (max ${maxMinuten}min)`);
    } catch (e) {
      console.error(`[sessiesAanvullen] verleng_sessie ${userId} ${datum} mislukt:`, e.message);
    }
  }

  if (verlengd.length > 0) {
    const huidigPlan = await kv.get(planKey);
    const verlengdDatums = new Set(verlengd.map(s => s.datum));
    huidigPlan.weekSessies = {
      ...huidigPlan.weekSessies,
      sessies: [
        ...(huidigPlan.weekSessies?.sessies || []).filter(s => !verlengdDatums.has(s.datum)),
        ...verlengd,
      ],
    };
    await kv.set(planKey, huidigPlan);
  }

  return { status: "aangevuld", aantal: aangevuld.length, datums: aangevuld.map(s => s.datum), verlengd: verlengd.map(s => s.datum) };
}
