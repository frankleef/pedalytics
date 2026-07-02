# Diagnose: welke seizoensgeneratie-outputvelden worden daadwerkelijk gebruikt

## Belangrijkste correctie op de aannames in de opdracht

De aanname "seizoensgeneratie produceert minstens vier soorten output" klopt niet zoals
beschreven. **`kader` wordt niet door Claude gegenereerd.** Het wordt volledig
deterministisch client-side opgebouwd door `bouwKader()` in
`src/app/AppClient.js:378-427`, vóórdat de Claude-aanroep (`startJob("seizoensplan", ...)`,
`src/app/AppClient.js:462`) plaatsvindt. De job krijgt `kader` als **input**-parameter mee
(`src/lib/promptBuilder.js:25-27`, `week1 = kader[0]`), niet als iets wat Claude verzint.

De huidige Claude-aanroep (job-type `"seizoensplan"`, `src/app/api/jobs/route.js:75-76`)
produceert dus feitelijk maar drie dingen: `samenvatting`, `streefwaarde`, `detail_weken`
(zie prompt-JSON-schema in `src/lib/promptBuilder.js:85-113`). `kader` is al klaar
voordat Claude iets ziet.

---

## 1. `kader` — bevestiging van gebruik

`kader` wordt inderdaad overal gelezen, zoals verwacht, o.a.:
- `src/app/AppClient.js:213, 480, 556, 593, 825, 975, 989, 1081, 1111` — weeksessie-generatie,
  conflictdetectie, validatie, UI-navigatie
- `src/lib/promptBuilder.js:150-159` — `bouwWeekSessiesPrompt` haalt `kaderWeek`/`kaderWeek2`/
  `vorigeKaderWeek` op uit `seizoensplan.kader`
- `src/app/api/jobs/route.js:51` — `kaderWeekVoorDatum(params.datum, params.seizoensplan?.kader, ...)`
- `src/app/components/SeizoensplanOverzicht.js:24, 36` — UI-weergave fase-tijdlijn
- `src/app/api/plan/wijzig-doel/route.js:34-52` en `src/app/api/plan/wijzig-niveau/route.js:39-54`
  — herberekenen toekomstige `kader`-weken in-place

Niet twijfelachtig, zoals verwacht. Bevestigd: **in gebruik**.

---

## 2. `detail_weken` — leesplekken

Grep naar elke plek waar `detail_weken` voorkomt (schrijven én lezen):
- `src/lib/promptBuilder.js:89` — schema-definitie in de Claude-prompt (schrijfkant)
- `src/app/api/jobs/route.js:102` — `(result.detail_weken || []).forEach(w => (w.sessies || [])...)`
  → dit is **verwerking direct na generatie** (segmenten normaliseren, RPE toevoegen, TSS
  corrigeren), niet een leesplek die de data ergens anders gebruikt. Het resultaat van deze
  verwerking wordt nergens teruggelezen.
- `src/lib/seizoen/valideer.js:41-60` — structurele validatie (checkt of elke sessie een
  `intentie`-object heeft) direct na generatie. Ook dit is een eenmalige check, geen
  functioneel gebruik verderop.

**Geen enkele plek** leest `detail_weken` om het aan de gebruiker te tonen (geen component
verwijst ernaar), en geen enkele plek gebruikt het als input/context voor latere
sessiegeneratie (`bouwWeekSessiesPrompt` in `promptBuilder.js:120-` gebruikt uitsluitend
`kader`, `voortgang`, `wellness` — niet `detail_weken`).

`detail_weken` wordt na generatie wél opgeslagen: het wordt via
`{ ...doelConfig, kader, ...plan, ... }` (`AppClient.js:465`) in `volledigPlan` gemengd en
via `PUT /api/plan` (`AppClient.js:467`) naar KV weggeschreven — maar dat is opslag, geen
leesgebruik.

**Conclusie: `detail_weken` is bevestigd dode data**, structureel vergelijkbaar met
`tekst_template` eerder in dit traject: gegenereerd, genormaliseerd, gevalideerd, opgeslagen
— nooit gelezen.

---

## 3. `samenvatting` / `streefwaarde` — leesplekken

Beide velden **worden wel gebruikt**, in tegenstelling tot `detail_weken`:

- `src/app/components/SeizoensplanOverzicht.js:29` — `plan.streefwaarde` wordt geparsed
  (regex op "XXX-YYYW") om de streef-FTP te bepalen voor de doelkaart bovenaan de pagina
- `src/app/components/SeizoensplanOverzicht.js:59-60` — `plan.samenvatting` wordt direct
  als tekst getoond onder de titel "Je seizoensplan staat klaar"

Deze component wordt gerenderd op `planStap === "overzicht"`
(`src/app/AppClient.js:1189-1190`), een stap die automatisch wordt bereikt na afronding van
de initiële plangeneratie (`AppClient.js:227-231`: zodra `weekSessies` klaar zijn, springt
`planStap` van `"genereren"` naar `"overzicht"`). Dit is dus de plan-overzichtpagina die de
gebruiker direct na het genereren van een nieuw seizoen te zien krijgt.

**Kanttekening (belangrijk voor het architectuurgesprek):** `wijzig-doel/route.js` en
`wijzig-niveau/route.js` herberekenen `kader` wél, maar raken `samenvatting`/`streefwaarde`
nooit aan (zie sectie 6). Na een `wijzig-doel`-actie kan `streefwaarde` dus een doel
beschrijven dat niet meer overeenkomt met `seizoensdoel.type`. Er is echter geen bevestigde
plek waar de gebruiker deze verouderde tekst na een wijziging opnieuw te zien krijgt, omdat
`SeizoensplanOverzicht` alleen bij `planStap === "overzicht"` rendert en die stap alleen
bereikt wordt via de initiële generatie-flow.

**Conclusie: bevestigd in gebruik**, zichtbaar op de plan-overzichtpagina
(`SeizoensplanOverzicht.js`) direct na initiële generatie.

---

## 4. Evenement-driven logica — status in de huidige prompt

Er is **geen evenement-aanpassingslogica** in de huidige prompt of in `bouwKader()`.
Concreet:

- Grep op `evenementDatum`/`evenementType` levert **nul treffers** op in de hele codebase.
  Deze configvelden bestaan niet.
- Er bestaat wel een los, ongerelateerd veld `event_datum`
  (`src/app/components/SeizoenWizard.js:23, 47`, gedocumenteerd in `src/lib/types.js:167`),
  maar dit heeft precies één effect: het schuift de **startdatum** van het plan terug zodat
  het plan eindigt rond de evenementdatum (`berekenStartdatum()`,
  `SeizoenWizard.js:31-37`). Het beïnvloedt `bouwKader()` niet — die functie
  (`AppClient.js:378-427`) heeft geen enkele referentie naar `event_datum` of taper-logica
  op basis van een evenement.
- `src/lib/promptBuilder.js` (de Claude-prompt zelf) bevat geen enkele instructie over
  evenementen of taper-vóór-evenement. De prompt is uitsluitend gebaseerd op het al
  vaststaande `kader` (fase/weektype/TSS per week).
- **Beide wizard-implementaties zijn actief, voor verschillende scenario's** (opgehelderd,
  geen onzekerheid meer): `SeizoenWizard.js` rendert in `AppClient.js:1193-1194` alleen
  wanneer een gebruiker nog **helemaal geen plan** heeft (`!planStap && !seizoensplan &&
  !nietGekoppeld && tab === 1`) — dit is de allereerste onboarding. `nieuw-seizoen/page.js`
  wordt bereikt via de "Nieuw seizoen"-knop in `src/app/components/HomeTab.js:165`
  (`window.location.href = "/nieuw-seizoen"`) — dit is het pad voor een gebruiker die al
  een plan heeft en een vólgend seizoen start. Alleen de onboarding-wizard
  (`SeizoenWizard.js`) vraagt naar een evenementdatum; het "nieuw seizoen"-pad voor
  bestaande gebruikers helemaal niet. Effect blijft in beide gevallen hetzelfde: alleen
  startdatum-verschuiving, geen taper-logica.

**Conclusie:** de evenement-aanpassing zoals beschreven in de opdracht ("plan past zich aan
op een evenement, bv. taper") **bestaat niet** in de huidige code. Er is alleen een
startdatum-verschuiving, geen taper-patroon, geen Claude-instructie, geen impliciete
regelstructuur om uit te destilleren.

---

## 5. Pro-rata-berekening (eerste, niet-volle week)

Er is een kant-en-klare deterministische functie voor precies dit doel:
`tssDoelWeek1(normaalWeekdoel, startdatum)` in `src/lib/weekgrenzen.js:49-60`. Deze
berekent het pro-rata TSS-doel op basis van het aantal resterende dagen in de eerste
kalenderweek vanaf de startdatum.

**Maar:** deze functie heeft **geen enkele aanroeper** in de hele codebase (grep op
`tssDoelWeek1` levert alleen de definitie zelf op). Ze is dode code.

In de daadwerkelijk gebruikte `bouwKader()` (`AppClient.js:397-414`) krijgt week 1 gewoon
het volle `baseTss` (`AppClient.js:410`: `tss_doel = wk.weeknummer === 1 ? baseTss : ...`),
ongeacht op welke dag van de week de startdatum valt. Er is geen `pro_rata_factor`-veld in
de kader-JSON — dat veld bestaat nergens in de codebase (nul treffers op `pro_rata`).

**Conclusie:** er is op dit moment **geen actieve pro-rata-berekening**, noch
deterministisch, noch door Claude. De functionaliteit is als geïsoleerde, ongebruikte
util aanwezig (`tssDoelWeek1`), maar niet verbonden aan de generatie-flow.

---

## 6. Regeneratie-triggers buiten de initiële generatie

Twee routes herberekenen delen van een bestaand plan zonder Claude aan te roepen:

- **`src/app/api/plan/wijzig-doel/route.js:31-52`** — bij een doelwijziging wordt
  `plan.kader` herberekend voor alle toekomstige weken (fase, sessietypes, z1z2_doel,
  max_intensiteit, focus opnieuw bepaald op basis van het nieuwe doelprofiel). Reeds
  gepasseerde weken (`weekStart <= vandaag`) blijven ongewijzigd. **Geen Claude-aanroep.**
  `samenvatting`, `streefwaarde` en `detail_weken` worden niet aangeraakt — blijven
  onveranderd (en dus mogelijk inhoudelijk verouderd) staan.

- **`src/app/api/plan/wijzig-niveau/route.js:36-54`** — zelfde patroon bij
  niveauwijziging: alleen `kader`-TSS-doelen en `z1z2_doel`/`max_intensiteit` worden
  herberekend voor toekomstige weken. **Geen Claude-aanroep.** `samenvatting`,
  `streefwaarde`, `detail_weken` blijven ongewijzigd.

Er is geen andere plek gevonden die het **volledige** seizoensplan (inclusief een nieuwe
Claude-aanroep voor `samenvatting`/`streefwaarde`/`detail_weken`) opnieuw genereert buiten
de initiële `genereerSeizoensplan()`-flow in `AppClient.js:429-473`. De enige andere
Claude-aanroep die met een bestaand plan werkt is `type === "weekSessies"`
(`bouwWeekSessiesPrompt`), en die genereert concrete sessies voor de eerstvolgende week,
niet het seizoensplan zelf.

---

## Dode data — bevestigd

- **`detail_weken`**: gegenereerd door Claude, genormaliseerd/gevalideerd direct na
  generatie, opgeslagen in KV — maar nergens gelezen voor UI-weergave of als input voor
  latere generatie. Zie sectie 2.
- **`tssDoelWeek1()`** (pro-rata-functie in `weekgrenzen.js`): bestaat, is correct
  geïmplementeerd, maar heeft geen enkele aanroeper. Losstaand van de vraagstelling over
  Claude-output, maar relevant voor het architectuurgesprek omdat het suggereert dat
  pro-rata al eens overwogen is en er los bij is blijven hangen.
- **Evenement-configvelden** (`evenementDatum`/`evenementType` zoals genoemd in de
  opdracht): bestaan niet in de codebase. Niet "dood" — ze zijn nooit gebouwd.

## In gebruik — bevestigd

- **`kader`**: overal gelezen — sessiegeneratie, UI, validatie, regeneratie-routes.
  Deterministisch gegenereerd, niet door Claude. Zie sectie 1.
- **`samenvatting`**: getoond in `SeizoensplanOverzicht.js:59-60`.
- **`streefwaarde`**: getoond en geparsed in `SeizoensplanOverzicht.js:29-31`.

## Onzekerheden

1. **Zichtbaarheid van verouderde `samenvatting`/`streefwaarde` na `wijzig-doel`**: bevestigd
   is dat deze velden niet worden bijgewerkt bij een doelwijziging (sectie 6), maar niet
   hard bevestigd is of/waar de gebruiker deze verouderde tekst nog te zien krijgt na zo'n
   wijziging — `SeizoensplanOverzicht` lijkt alleen bereikbaar via de initiële
   generatie-flow (`planStap === "overzicht"`), niet via een "bekijk mijn plan"-pad na een
   latere wijziging. Er kan een ander leesscherm bestaan dat niet in deze diagnose is
   meegenomen.
3. **`demoData.js`**: bevat een `demoSeizoensplan` dat als fallback wordt gebruikt wanneer
   een gebruiker niet gekoppeld is (`AppClient.js:198`). Niet onderzocht of dit demo-object
   `detail_weken` bevat en of dat via een ander pad (demo-only) wel gelezen wordt — gezien
   de eerdere bevindingen (nul leesplekken in productiecode) is de kans klein, maar dit is
   niet expliciet uitgesloten.
