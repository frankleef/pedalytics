# Fitnessprogressie (trend) + kracht_lage_cadans fase-gating

Twee losse onderzoeken. Deel A is een **voorstel + backtest, niet toegepast**. Deel B is een
**verificatie + voorgestelde diff, niet toegepast**. Alle cijfers in Deel A komen uit een live
`intervals.icu`-call en de productie-KV (`u_frank_001`), uitgevoerd op 2026-07-13. Alle code-citaten
zijn gelezen uit de huidige `main`-branch.

---

## Deel A — trend-gebaseerde fitnessprogressie

### 1. Wat er nu mis is (bevestigd met echte data, niet alleen theorie)

Ik heb de daadwerkelijke `/api/debug/conditiescore-historie`-berekening nagebouwd (zelfde functies,
zelfde 28-daags rolling venster, zelfde constante `rpe_delta_trend`) met de echte wellness-reeks
1 mei – 13 juli 2026 van dit account. Resultaat: **12 label-wissels op 46 dag-op-dag-overgangen** —
ruim een kwart van de dagen verandert het label, terwijl de onderliggende CTL gestaag steeg
(36,3 → 55,6 over de hele periode):

```
2026-05-28  ctl=47.7  Δ4w=11.3  score=0.64  → "Conditie groeit"
2026-05-30  ctl=45.5  Δ4w=10.8  score=0.64  → "Herstelweek"          ← wissel (alleen belasting-vlag, niet score)
2026-05-31  ctl=47.3  Δ4w=10    score=0.64  → "Conditie groeit"      ← terug
2026-06-01  ctl=46.2  Δ4w=7.6   score=0.5   → "Herstelweek"
2026-06-09  ctl=44.5  Δ4w=2.2   score=0.18  → "Herstelweek"
2026-06-10  ctl=48.3  Δ4w=5.1   score=0.35  → "Conditie groeit"
2026-06-12  ctl=46.1  Δ4w=2     score=0.17  → "Lichte verbetering"
2026-06-14  ctl=52.1  Δ4w=7.5   score=0.5   → "Conditie groeit"
2026-06-15  ctl=53.6  Δ4w=10.1  score=0.64  → "Pas op overbelasting" ← ramp_rate-piek, zelfde score
2026-06-17  ctl=55    Δ4w=10.5  score=0.64  → "Conditie groeit"
...
2026-07-11  ctl=53.7  Δ4w=1.6   score=0.15  → "Herstelweek"
2026-07-12  ctl=57    Δ4w=3.4   score=0.25  → "Lichte verbetering"
```

**Belangrijke nuance die niet in de oorspronkelijke opdracht stond maar wel uit deze data blijkt:**
een groot deel van de wissels komt niet van `conditieStatus(score)` zelf, maar van
`belastingsStatus(ctl_ramp_per_week, ...)` — die neemt via `conditiePillStatus()` voorrang
("Herstelweek"/"Pas op overbelasting" overschrijven het conditie-label zodra de punt-op-punt
`rampRate` van intervals.icu die dag toevallig negatief resp. >7 is). Dat is een **tweede,
onafhankelijke bron van dagelijkse ruis** naast de CTL-4-weken-delta zelf — de score bleef op
2026-05-30 bijvoorbeeld exact 0,64 terwijl het label toch omsloeg. Dit versterkt het punt uit de
opdracht: het huidige systeem mixt niet twee, maar in de praktijk **drie** tijdschalen in één
dagelijkse pil (CTL-4w-delta, RPE-trend, en de dagelijkse punt-op-punt ramp_rate).

### 2. Voorstel: twee aparte concepten

**A — Fitnessprogressie (traag, wekelijks).** Twee regressies, elk met richting + numerieke helling:

- **CTL-trend**: lineaire regressie (OLS) van CTL tegen tijd, over de laatste 8-10 weken beschikbare
  data. Geen Theil-Sen-library gevonden in `package.json` (gecontroleerd, geen `simple-statistics`,
  `ml-regression` o.i.d.) — conform de opdracht dan gewone lineaire regressie. Ik heb voor de
  backtest wél handmatig een Theil-Sen-schatter (mediaan van alle paarsgewijze hellingen)
  meegerekend als robuustheids-controle, zonder externe library (triviaal te implementeren, O(n²)
  bij deze datavolumes) — de twee methoden liggen in de praktijk dicht bij elkaar (zie tabel), dus
  dit is puur een extra check, geen vereiste toevoeging aan de architectuur.
- **Decoupling-trend**: regressie van decoupling-waarde tegen tijd, over **alle** kwalificerende
  ritten in de beschikbare periode (zelfde eligibiliteitsfilter als nu: ≥45 min, IF 0,55-0,75) —
  dus niet de huidige 5-vs-5-groepsvergelijking (`bepaalDecouplingMedianen()`,
  `src/lib/conditie.js:69-74`), maar een echte regressie over de volledige puntenwolk.
- Combinatie tot een richting/sterkte-indicatie: bv. `stijgend (+1,5 CTL/wk)` /
  `stabiel (+0,3 CTL/wk)` / `dalend (-1,2 CTL/wk)`, met decoupling als los, secundair kenmerk
  (`verbeterend`/`stabiel`/`verslechterend`) — **geen** samengevoegd enkel getal, want dat is
  precies het huidige probleem.
- Herbereken op hetzelfde ritme als `voerWekelijkseEvaluatieUit()` in `volumeCorrectie.js`
  (zondag ≥21:30 Europe/Amsterdam, atomische KV-claim via `isWekelijkseCheckVerschuldigd()`,
  `volumeCorrectie.js:275-297`) — dit is de enige plek in de codebase die al een wekelijks,
  niet-dagelijks ritme heeft. Aparte KV-key nodig (bv. `fitnessprogressie:{userId}`), niet
  hergebruiken van `conditie_score:{userId}` (dat blijft de dagelijkse gereedheids-pil, zie hieronder).

**FTP-test als hard ankerpunt — bevestigd aanwezig, drie plekken:**
- `plan.kader[week].bevat_tussentijdse_ftp_test` — een boolean, altijd gezet op week 3
  (`src/lib/seizoen/bouwKader.js:81-83`: `if (wk.weeknummer === 3) week.bevat_tussentijdse_ftp_test = true;`).
- Elke geplande sessie met `intentie.rol === "ftp_test"` (sessietype `ramp_test`) — automatisch
  ingepland op de laatste trainingsdag van een `bevat_tussentijdse_ftp_test`-week
  (`src/lib/sessiesAanvullen.js:258-263`, `weekSessiesDeterministisch.js:173-176`), én handmatig
  markeerbaar via `POST /api/sessie/markeer-als-test` voor een al gereden, niet vooraf geplande rit
  (`src/app/components/MarkeerAlsFtpTest.js`).
- Verwerking bij voltooiing: `verwerkFtpTest()` (`src/lib/sessie/ftpUpdate.js`) — update `huidige_ftp`
  en herberekent toekomstige vermogensbereiken, aangeroepen vanuit `cron/sync/route.js:360` zodra een
  activiteit met `rol === "ftp_test"` binnenkomt.
- **Gebruik voor de nieuwe metric**: elke `ftp_test`-datum kan als verticale marker op de
  CTL-trendgrafiek, en de eFTP-continue-extrapolatie (indien die al ergens bestaat — ik heb er in
  deze sessie geen aparte, losse eFTP-tracker naast `huidige_ftp` gevonden, alleen de discrete
  test-updates) kan tussen twee van deze ankerpunten in gekalibreerd worden. Ik verzin hier geen
  bestaande eFTP-tijdreeks bij — die is niet gevonden.

**B — Gereedheid vandaag (blijft dagelijks).** TSB/HRV/RPE, apart getekst van de fitnessprogressie in
de UI, zodat "ben ik fitter geworden" (traag, wekelijks) en "hoe fris ben ik vandaag" (dagelijks) niet
meer dezelfde pil delen. `belasting`/`ramp_rate`-classificatie (`belastingsStatus()`) hoort
functioneel bij dít concept, niet bij de fitnessprogressie — zie bevinding hierboven dat het juist de
menging van deze twee is die de huidige wissels veroorzaakt.

### 3. Backtest: 1 mei – 13 juli 2026, echte data

**CTL-trend, regressie over de volledige beschikbare 74-dagen-reeks:**

| Methode | Helling | Richting |
|---|---|---|
| OLS (lineaire regressie) | **+1,53 CTL-punten/week** | stijgend |
| Theil-Sen (robuust, controle) | +1,50 CTL-punten/week | stijgend |

**Wekelijkse recompute-simulatie** (zoals de nieuwe metric zou draaien, elke maandag, trailing
venster = alle beschikbare data tot dan toe, max 10 weken):

| Weekstart | Vensterlengte | Helling (CTL/wk) | Richting |
|---|---|---|---|
| 2026-06-01 | 32 dagen | +2,61 | stijgend |
| 2026-06-08 | 39 dagen | +1,79 | stijgend |
| 2026-06-15 | 46 dagen | +1,75 | stijgend |
| 2026-06-22 | 53 dagen | +1,94 | stijgend |
| 2026-06-29 | 60 dagen | +1,68 | stijgend |
| 2026-07-06 | 67 dagen | +1,56 | stijgend |
| 2026-07-13 | 71 dagen | +1,43 | stijgend |

**Bevestigd: dit laat een gestaag oplopende, richting-stabiele lijn zien.** Zeven weken op rij
"stijgend", nooit een omslag — in schril contrast met de 12 label-wissels van het huidige systeem
over hetzelfde soort venster. De helling daalt licht (2,61 → 1,43) naarmate het venster meer recente,
rustigere weken meeneemt, maar de richting verandert nooit.

**Decoupling-trend** — dit signaal is zwakker en verdient een eerlijke kanttekening: slechts 11
kwalificerende ritten met een gecachete waarde over 49 dagen (2 ritten kwalificeerden wel qua
duur/IF maar hebben geen gecachete decoupling-waarde), en het resultaat is gevoelig voor
uitschieterbehandeling:

| Reeks | n | OLS | Theil-Sen |
|---|---|---|---|
| Ruw (geen filter, zoals de huidige conditiescore dit gebruikt) | 11 | +0,29 pp/week (licht verslechterend) | +0,45 pp/week |
| Excl. hitte-vlag + `isDecouplingUitschieter()`-cap (>12%) | 9 | −0,31 pp/week (licht verbeterend) | +0,13 pp/week |

Met en zonder de twee uitschieters (23 juni, 16,7%, hitte-gevlagd; 1 juli, 20,0%, boven de 12%-cap
maar niet als hitte gemarkeerd) draait het teken van de trend om. Bij 9-11 punten over 7 weken is dit
statistisch te dun om een harde uitspraak op te baseren — **de eerlijke conclusie is "geen duidelijk
signaal", niet "verbeterend" of "verslechterend"**. Dit is inherent aan de databeschikbaarheid, niet
aan de regressiemethode; met meer kwalificerende ritten (langer venster of frequenter lange Z2-ritten)
zou dit signaal betrouwbaarder worden.

### 4. Wat ik niet heb gedaan

Geen code aangepast. Geen nieuwe KV-schrijfactie toegevoegd. De cijfers hierboven komen uit
losstaande, tijdelijke scripts (nu verwijderd) die de bestaande `intervals.icu`-credentials en de
productie-KV read-only hebben gebruikt — dezelfde toegang die ook `pill-label-verificatie.md` al
gebruikte.

**Openstaande keuzes voor u, vóór ik dit implementeer:**
- Exacte drempels voor "stijgend"/"stabiel"/"dalend" (ik heb ±1 CTL/week als illustratieve grens
  gebruikt in de backtest — geen empirisch geverifieerd optimum, net zoals de bestaande
  `belastingsStatus()`-drempels dat ook niet zijn).
- Welke KV-key en welk UI-oppervlak (nieuwe kaart, of vervanging van de huidige pil in
  `GereedheidConditieKaart.js`/`VoortgangTab.js`/`AdaptatieScoreKaart.js`).
- Of `belastingsStatus()`/`ramp_rate` volledig naar het "gereedheid vandaag"-concept verhuist, of
  gesplitst blijft tussen beide (het is nu al deels betrokken bij TSS-budgettering via
  `volumeCorrectie.js`, zie eerdere `ramp-rate-fix-en-impact.md`).

---

## Deel B — fase-gating van kracht_lage_cadans

### 1. Wat de spec zegt (letterlijk, `design/IMPLEMENTATIE.md`)

Regels 3056-3070:

```
**Bij welke doelen en wanneer:**

| Doel | Fase | Frequentie | Reden |
|---|---|---|---|
| `klimmen` | Basis + Sweetspot (week 1–7) | 1× per week, op intensiteitsdag | Klimkracht opbouwen vóór drempelwerk |
| `ftp` | Basis (week 1–3) | 1× per 2 weken | Krachtbasis als aanvulling op aerobe fundering |
| `sprint` | Basis + Sprintkracht (week 1–7) | 1× per 2 weken | Krachtontwikkeling als complement van snelkracht |
| `aerobe_basis` | Niet | n.v.t. | Activeert glycolytisch systeem, interfereert met aerobe adaptatie |
| `uithoudingsvermogen` | Niet | n.v.t. | Herstelcapaciteit nodig voor volume, niet voor kracht |

**Prioriteitsregel bovenop deze tabel (sectie 22-G, as-built):** deze frequentietabel
is een bovengrens, geen garantie. Zodra de weekplanning al 2× de actieve kernstimulus
van de fase bevat (ongeacht welke fase/doel), vervalt `kracht_lage_cadans` die week
automatisch, ook al zou de tabel hierboven het nog toestaan — implementatie in
`solveWeek()` stap 5, `src/lib/sessie/weekSolver.js`.

**Bekende, nog niet opgeloste discrepantie (niet onderdeel van sectie 22-G):** de
code (`KRACHT_FREQUENTIE` in `weekSolver.js`) implementeert alleen `klimmen` en `ftp`
uit de tabel hierboven; `sprint` is in de code hard uitgesloten
(`KRACHT_LAGE_CADANS_VERBODEN_DOELEN`), in tegenstelling tot de "1× per 2 weken"-rij
hierboven. (...) dit is niet gecorrigeerd als onderdeel van deze wijziging.
```

Voor `ftp` is de spec ondubbelzinnig: **alleen Basis, week 1-3**, nergens anders — geen sweetspot,
geen drempel. En de spec vermeldt zelf al één bekende, bewust ongecorrigeerde discrepantie
(`sprint`) — dat is een precedent dat dit document en de code al eerder uit de pas liepen.

### 2. Wat de code daadwerkelijk doet — en hier zit de mismatch

`src/lib/sessie/weekSolver.js:309-326`:

```js
const KRACHT_FREQUENTIE = {
  klimmen: {
    basis:         { toegestaan: true,  frequentie: '1x_per_week' },
    sweetspot:     { toegestaan: true,  frequentie: '1x_per_week' },
    overgangsfase: { toegestaan: false },
    drempel:       { toegestaan: true,  frequentie: '1x_per_2_weken' },
    consolidatie:  { toegestaan: false },
    test:          { toegestaan: false },
  },
  ftp: {
    basis:         { toegestaan: true,  frequentie: '1x_per_2_weken' },
    sweetspot:     { toegestaan: true,  frequentie: '1x_per_week' },   // ← wijkt af van spec
    overgangsfase: { toegestaan: false },
    drempel:       { toegestaan: true,  frequentie: '1x_per_2_weken' }, // ← wijkt af van spec
    consolidatie:  { toegestaan: false },
    test:          { toegestaan: false },
  },
};
```

`ftp.basis` (1x/2 weken) komt overeen met de spec. Maar `ftp.sweetspot` (1x/week, `toegestaan: true`)
en `ftp.drempel` (1x/2 weken, `toegestaan: true`) staan kracht_lage_cadans toe in twee fases die de
spec-tabel voor `ftp` helemaal niet noemt (de spec-tabel geeft voor `ftp` uitsluitend de Basis-rij).

**Belangrijke nuance — dit is mogelijk geen "bug" maar een niet-teruggekoppelde bewuste keuze.** De
code-comment vlak erboven (`weekSolver.js:306-308`) zegt expliciet:

```js
// Frequentietabel, opgegeven door de gebruiker (geen bestaande tabel hiervoor
// gevonden in de codebase — zie project-memory). Fases die hier ontbreken
// (overgangsfase, consolidatie, test) staan kracht_lage_cadans nooit toe.
```

Dat wijst erop dat **u** deze exacte tabel (inclusief `ftp.sweetspot` en `ftp.drempel`) in een eerdere
sessie zelf hebt opgegeven — mogelijk een bewuste uitbreiding t.o.v. de oudere `IMPLEMENTATIE.md`-tabel
die nooit is teruggeschreven naar het designdocument. Ik kan dit niet met zekerheid herleiden (geen
toegang tot eerdere sessiehistorie), dus ik neem het niet over als vaststaand feit in welke richting
dan ook — **dit is een vraag aan u, niet een aanname van mij**: was de uitbreiding naar sweetspot/drempel
voor `ftp` bewust, en is `IMPLEMENTATIE.md` dan de verouderde bron? Of is de code hier de fout, en moet
die weer terug naar "alleen Basis"?

### 3. Uw huidige fase/week (live plan, `u_frank_001`, gelezen op 2026-07-13)

- `plan.startdatum = "2026-06-20"`, `plan.doel = "ftp_verhogen"`.
- `weeknummerVoorDatum("2026-07-13", "2026-06-20") = 5` (berekend met de exacte functie uit
  `src/lib/weekgrenzen.js`).
- `plan.kader[4]` (week 5): `{ fase: "sweetspot", weektype: "opbouw", sessietypes: ["sweetspot_intervallen","z2_duur","z1_herstel"] }`.

**Bevestigd: u zit inderdaad in sweetspot-week 1**, exact zoals u zei.

Noteer: `plan.kader[week].sessietypes` (hier zonder `kracht_lage_cadans`) komt uit
`doelprofielen.js`'s `faseInstellingen()`, via `bouwKader.js:78`. Die lijst is dus op zichzelf al
correct volgens de spec voor deze fase/doel-combinatie. **Maar** — zie punt 4 — deze lijst is
metadata/weergave, geen harde grens binnen `solveWeek()` zelf.

### 4. De daadwerkelijke gate zit in `solveWeek()`, en die negeert `kader.sessietypes`

`magKrachtLageCadans()` (`weekSolver.js:345-353`) en de aanroep ervan in stap 5
(`weekSolver.js:728-734`) raadplegen **uitsluitend** `KRACHT_FREQUENTIE[seizoensdoel][generiekeFase]`
— nergens wordt `kader.sessietypes` gecheckt. Ik heb dit geverifieerd door alle plekken te doorzoeken
waar `.sessietypes` gelezen wordt (`grep -rn "\.sessietypes\b"`): het wordt gebruikt in
`weekpatroon.js`, de `/api/sessie/categorieen`-route (UI-picker) en als weergave-`focus`-string in
`bouwKader.js` — maar **niet** binnen `weekSolver.js`. Dat betekent: `bouwKader.js`/`doelprofielen.js`
bepalen correct wat er in de kader-samenvatting staat, maar `solveWeek()`'s eigen, onafhankelijke
`KRACHT_FREQUENTIE`-tabel bepaalt wat er daadwerkelijk wordt ingepland — en die twee kunnen dus uiteen
lopen, wat hier voor `ftp`+`sweetspot` ook gebeurt.

`weekSessiesDeterministisch.js:209` geeft `seizoensdoel: seizoensplan.seizoensdoel?.type ?? "ftp"` mee
aan `solveWeek()`. Dit plan heeft geen `seizoensdoel.type`-veld (alleen het losse `plan.doel =
"ftp_verhogen"`), dus de fallback `"ftp"` wordt gebruikt — wat toevallig exact de sleutel is die
`KRACHT_FREQUENTIE` verwacht. Met andere woorden: de mismatch is voor dit account **actief van
toepassing**, niet toevallig onschadelijk gemaakt door een naamgevingsverschil.

### 5. Zijn er daadwerkelijk kracht_lage_cadans-sessies gepland deze week?

**Niet zichtbaar in de huidige KV-staat** — maar met een plausibele verklaring die wél op een
manifestatie van de bug wijst. De sessies in week 5 (07-14 t/m 07-18):

| Datum | Sessietype | `gegenereerd_door` |
|---|---|---|
| 07-14 (di) | `sweetspot_intervallen` (kernstimulus) | deterministisch |
| 07-16 (do) | `z2_duur` | **deterministisch** |
| 07-18 (za) | `z2_duur` | **handmatige_keuze** (= door u overschreven) |

De z2-opvulstap in `solveWeek()` verwerkt open dagen aflopend gesorteerd op beschikbare uren
(`openDagenAflopend`, `weekSolver.js:622`) en staat `kracht_lage_cadans` maximaal **1×** per week toe
(`krachtLageCadansGebruiktDezeWeek`, regel 717/731-733) — zodra de eerste z2-dag in die volgorde de
kracht-toewijzing krijgt, vervalt de mogelijkheid voor de rest van de week. Zaterdag (07-18) heeft in
uw plan het meeste beschikbare uren (`urenPerDag.Zaterdag = 3` vs. `Donderdag = 2`), komt dus eerder
in de sorteervolgorde, en zou dus **als eerste** de kracht-toewijzing hebben gekregen als
`magKrachtLageCadans()` `true` teruggaf — wat het, gegeven `KRACHT_FREQUENTIE.ftp.sweetspot.toegestaan
= true` en geen eerdere kracht_lage_cadans-historie in dit plan (`laatsteKrachtLageCadansWeek` is
`null` → directe `true`-return op regel 351), zou hebben gedaan. Dat 07-16 vervolgens `z2_duur` kreeg
in plaats van kracht, past bij dit mechanisme: kracht was op dat moment al "verbruikt" door de
07-18-toewijzing.

**Ik kan dit niet 100% bevestigen** — er is geen snapshot bewaard van de sessie voordat u 'm op
07-18 handmatig verving (in tegenstelling tot 07-12, waar wel een `sessie_voor_checkin`-snapshot
bestaat van vóór een check-in-aanpassing). Maar de reconstructie verklaart uw waarneming precies:
u zag waarschijnlijk een kracht_lage_cadans-sessie op zaterdag verschijnen, en heeft die zelf
vervangen — wat overeenkomt met "er worden nog steeds kracht_lage_cadans-sessies gepland" in
sweetspot-week 1.

### 6. Voorgestelde diff (niet toegepast)

Optie A — de code strak op de bestaande spec-tabel zetten (`ftp` alleen Basis):

```diff
   ftp: {
     basis:         { toegestaan: true,  frequentie: '1x_per_2_weken' },
-    sweetspot:     { toegestaan: true,  frequentie: '1x_per_week' },
+    sweetspot:     { toegestaan: false },
     overgangsfase: { toegestaan: false },
-    drempel:       { toegestaan: true,  frequentie: '1x_per_2_weken' },
+    drempel:       { toegestaan: false },
     consolidatie:  { toegestaan: false },
     test:          { toegestaan: false },
   },
```

Ik pas dit **niet toe** — zie punt 2 hierboven: de comment bij deze tabel claimt dat u de huidige
waarden zelf hebt opgegeven. Voordat ik dit terugdraai, wil ik expliciete bevestiging dat dat een
eerdere, inmiddels ongewenste keuze was en niet een bewuste uitbreiding die `IMPLEMENTATIE.md` gewoon
nooit heeft bijgewerkt (optie B zou dan zijn: `IMPLEMENTATIE.md`'s tabel aanpassen i.p.v. de code).

### 7. Fallback als kracht_lage_cadans vervalt — al aanwezig, hoeft niet gebouwd

`weekSolver.js:734`:
```js
toewijzingen.push(bouwToewijzing(dag, wordtKracht ? "kracht_lage_cadans" : "z2_duur", ...));
```
Dezelfde regel die de kracht-toewijzing doet, valt bij `wordtKracht === false` automatisch terug op
`z2_duur` voor exact dezelfde dag/hetzelfde budget — er ontstaat geen gat in het weekschema. Met
diff-optie A hierboven zou 07-18 (of welke dag ook de eerste z2-slot is) dus gewoon `z2_duur` worden
in plaats van `kracht_lage_cadans`, zonder dat er een aparte vulmechanisme bij hoeft. Dit is al zo
gebouwd — geen nieuwe fallback-logica nodig.

---

## Samenvatting van wat nog een beslissing van u vraagt

1. **Deel A**: akkoord met het tweeledig concept (fitnessprogressie wekelijks / gereedheid dagelijks)?
   Zo ja, dan volgt een aparte implementatie-doorloop (KV-schema, UI-plek, exacte drempels).
2. **Deel B**: was `KRACHT_FREQUENTIE.ftp.sweetspot`/`.drempel` een bewuste, latere uitbreiding
   (dan moet `IMPLEMENTATIE.md` worden bijgewerkt, niet de code), of een ongewenste afwijking
   (dan pas ik diff-optie A hierboven toe)?
