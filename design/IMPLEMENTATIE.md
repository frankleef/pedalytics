# Pedalytics — Implementatie nieuw design

## Context

Bijgevoegd zijn 6 Claude Design DC-canvas exports + een README + support.js:
- `Pedalytics_Home_dc.html`
- `Pedalytics_Workout_dc.html`
- `Pedalytics_Progress_dc.html`
- `Pedalytics_Wizard_Beschikbaarheid_dc.html`
- `Pedalytics_Beschikbaarheid_Aanpassen_dc.html`
- `Pedalytics_Schema_dc.html`
- `README.md` — officiële design-handoff van Claude Design (tokens, per-scherm spec, grafiekformules) — **geüpdatet: Workout-detail bevat nu dag-navigatie, TSS-weekkaart, Aanpassen-knop en een rust-staat** (zie sectie 2). Leidend bij afwijking
- `support.js` — zie noot hieronder, **niet relevant voor implementatie**

**Let op:** `Pedalytics_Workout_dc.html` is inmiddels meermaals bijgewerkt — laatste versie
heeft de dag-strip (21 tiles) i.p.v. losse chevrons, plus de vier verleden-dag-staten. Gebruik
altijd de meest recente versie uit je `design/`-map, niet een eerder gedownloade kopie.
`Pedalytics_Schema_dc.html` is niet meer leidend (zie sectie 6).

Dit zijn DC-canvas bestanden met `sc-for`/`sc-if`-templating en een `renderVals()`-functie
die placeholder-databindingen bevat. **Vertaal de visuele structuur en databindingen naar
React-componenten gevoed door echte API-data — kopieer niet de placeholder-arrays/waarden
uit `renderVals()` letterlijk over.**

**Belangrijk: deze 5 bestanden zijn referentiemateriaal, geen productiecode.**
Ze zijn gegenereerd door Claude Design en gebruiken een eigen template-syntax
(`sc-for`, `sc-if`, `{{ }}`, `DCLogic`) die niet bestaat in dit Next.js/React-project.
Niets hiervan kan 1-op-1 gekopieerd of geïmporteerd worden. Gebruik ze uitsluitend voor:
- visuele structuur, layout en styling (de inline `style`-attributen zijn wel bruikbaar als
  basis voor CSS/Tailwind-vertaling)
- de vorm van databindingen (welk veld hoort bij welk element)
- bij de twee beschikbaarheid-bestanden: de interactie-logica in de `Component`-class
  (`toggle`, `bump`, `fmt`) als functioneel voorbeeld — herschrijf dit als React state/hooks,
  niet als `DCLogic`-subclass

Bouw alles opnieuw op als echte React-componenten passend bij de bestaande codebase
(functioneel, met hooks, Tailwind of de huidige stylingaanpak) — niet door de HTML/inline-styles
te knippen-en-plakken in een `.js`-bestand.

Dit zijn visuele specs, geen nieuwe functionaliteit. Koppel ze aan de bestaande databronnen
en logica in de huidige codebase; herschrijf die logica niet.

Er is ook een `README.md` van Claude Design bijgevoegd met de volledige, exacte design-spec
(tokens, per-scherm layout, grafiek-formules) — die README is leidend boven mijn eigen
eerdere samenvatting hieronder; bij twijfel of afwijking volgt de README.

**`support.js`: niet meenemen in de implementatie.** Dit is de DC-runtime van Claude Design
zelf (parser voor `x-dc`/`sc-for`/`sc-if` + React-mount) — het bestand zorgt er alleen voor
dat de `.dc.html`-bestanden los in een browser te bekijken zijn als preview. Het heeft geen
functie in de Pedalytics-app en hoeft niet gekopieerd, geïmporteerd of nagebouwd te worden.

## Design tokens (bron: README.md — exact, oklch is leidend boven hex-benadering)

**Basis/neutraal:**
- App-achtergrond: `oklch(0.962 0.012 84)` ≈ `#F5F1EA`
- Kaart-achtergrond: `oklch(0.99 0.006 84)` ≈ `#FCFAF6`
- Subtiele vulling (chips/mini-tiles): `oklch(0.965 0.012 84)`
- Kaartrand: `oklch(0.93 0.01 82)` · Scheidingslijn: `oklch(0.91 0.012 82)`
- Tekst primair: `oklch(0.27 0.02 70)` · secundair: `oklch(0.5 0.02 74)` · tertiair/labels: `oklch(0.6 0.02 75)`
- Pil-knop/nav actief (slate-zwart): `oklch(0.24 0.012 70)`

**Merk-gradient:** `linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))` — gebruikt in avatar, trainingsdag-cirkels, ring-stroke, AI-logo.

**Herstelstatus (4 niveaus, rood bewust gedempt):**
| Status | Headline-tekst | Ring-gradient | Status-dot |
|---|---|---|---|
| good | `oklch(0.5 0.13 162)` | `oklch(0.62 0.14 248)`→`oklch(0.79 0.14 168)` | `oklch(0.6 0.13 165)` |
| caution | `oklch(0.55 0.11 92)` | `oklch(0.79 0.14 168)`→`oklch(0.8 0.13 96)` | `oklch(0.74 0.13 95)` |
| careful | `oklch(0.56 0.13 55)` | `oklch(0.8 0.13 96)`→`oklch(0.67 0.14 52)` | `oklch(0.66 0.14 54)` |
| rest | `oklch(0.52 0.1 28)` | `oklch(0.67 0.14 52)`→`oklch(0.58 0.11 28)` | `oklch(0.58 0.11 28)` |

**Trainingszones (%FTP):** Z1 <56% `oklch(0.82 0.05 245)` · Z2 56–75% `oklch(0.70 0.12 240)` · Z3 76–90% `oklch(0.72 0.13 165)` · Z4 91–106% `oklch(0.74 0.13 70)` · Z5 >106% `oklch(0.62 0.14 30)`

**Slate insight-kaart:** achtergrond `oklch(0.345 0.035 245)`, mini-tile `oklch(0.4 0.03 245)`, label `oklch(0.74 0.05 200)`, body `oklch(0.95 0.012 200)`, accent-cijfer `oklch(0.86 0.06 165)`

**Typografie:** Nunito (400–900, body/headlines/labels) + Fredoka (400–700, grote cijfers).
- H1 status-headline: Nunito 800, 27–28px, line-height ~1.2, letter-spacing −0.4/−0.5px
- Sessie-titel H2: Nunito 700, 21px · Eyebrow-labels: Nunito 800, 11–12px, letter-spacing 1.2–1.6px, hoofdletters
- Ringcentrum-score: Fredoka 600, 62px · Metric-cijfers (CTL/ATL/TSB/TSS): Fredoka 600, 27–30px
- Body/detail: Nunito 600, 12–14.5px · Nav-labels: Nunito 700 (inactief) / 800 (actief), 11px

**Vorm:** kaart-radius 28px, mini-tiles 14–18px, pil-knoppen/CTA volledig rond (999px), content-padding 22px links/rechts, statusbalk 46px, bottom-nav 78px.

## Intervalgrafiek-formule (Zwift/TrainerRoad-stijl) — kern van Workout-detail

Exacte berekening uit README, **dit vervangt mijn eerdere aanname in sectie 2 hieronder**:

- **Breedte staaf** = `flex-grow: minuten`, `flex-basis: 0` → breedte verhoudt zich automatisch naar duur van het interval
- **Hoogte staaf** = `(%FTP / 130) * 100`, met `maxScale` = 130% FTP als top van de grafiek, minimum ~6% hoogte zodat lage blokken zichtbaar blijven
- **Kleur** = trainingszone volgens de zone-tabel hierboven
- **Warm-up**: 5 staafjes oplopend 45→52→58→64→70% FTP (geen vlak blok). **Cooldown**: 5 staafjes aflopend 66→60→54→48→42%
- **FTP-referentielijn**: gestreepte horizontale lijn op `bottom: (100/130)*100% ≈ 76,9%`, label "FTP 100%" op chip rechts

**Toevoeging — labels/weergave in watt, niet %FTP (correctie t.o.v. design):** de
hoogte-berekening van de staven blijft op basis van %FTP (zoals hierboven, dat is puur de
schaal/positionering van de grafiek), maar **alle zichtbare cijfers moeten in watt, niet in
procenten**.

**Correctie t.o.v. eerdere versie: géén exact watt-getal, maar een range met vaste ±5%-marge.**
Een los watt-getal (bv. "255W") suggereert een precisie die in de praktijk niet haalbaar of
zinvol is — in de praktijk trap je laag of hoog in een zone, niet exact één waarde. Gangbare
structured-training-platforms (TrainerRoad, Zwift, intervals.icu) tonen om die reden ook een
bandbreedte per blok, geen exact getal. Vaste marge: **±5% van het doelvermogen** per blok.

- **Sessiegeneratie (`/api/claude`)**: de prompt voor `segmenten`-generatie moet per blok een
  vermogens-**range** opleveren i.p.v. één percentage/getal — bv. `{ vermogenMin: 88,
  vermogenMax: 94 }` (in %FTP, zelfde eenheid als nu, alleen twee grenzen i.p.v. één waarde)
- **Data-structuur**: `segmenten`-array (seizoensplan) krijgt twee velden per blok i.p.v. één
  enkel vermogen-veld
- **Vermogensprofiel-grafiek**: FTP-referentielijn-label blijft een concreet getal ("FTP
  250W" — dat is geen range, dat blijft kloppen), maar eventuele as-labels/tooltips per staaf
  tonen voortaan de range (`%FTPMin/100 * FTP` – `%FTPMax/100 * FTP`), niet één percentage of
  één watt-getal
- **Segment-overzicht**: ~~"detail"-tekst per segment toont de omgerekende range, bv. "3× 4m @
  220-235W + 30s @ 270-290W" i.p.v. een los watt-getal~~ — **deze regel is vervangen, zie de
  nieuwe subsectie "Segment-overzicht — JOIN-stijl blokken" verderop in sectie 2.** De
  ±5%-rangeberekening zelf blijft hetzelfde, alleen de weergave verandert van compacte
  tekstregel naar grote kleurblokken
- **Warm-up/cooldown-ramps en de korte versnellingen** blijven losse, oplopende/aflopende
  stapjes zoals nu, **geen range nodig** — dat zijn al bewegende doelen, geen vlak blok om
  vast te houden
- **De grafiek-staven zelf** blijven op één hoogte per staaf (gebaseerd op het midden van de
  range, `(vermogenMin + vermogenMax) / 2`) — een visuele band om de staaf die de marge
  toont is optioneel, geen vereiste
- Geldt voor **zowel de geplande grafiek als de werkelijk-gereden grafieken** (matched/
  deviated/unplanned/buiten_planperiode) — bij werkelijk-gereden data is er uiteraard geen
  "range" (dat was al precies wat er gebeurd is), dus daar blijft het enkele watt-getal correct;
  de range-aanpassing geldt specifiek voor **geplande** segmenten/doelen
- FTP zelf blijft uit `/api/intervals/profiel` komen (niet hardcoden), dus de watt-omrekening
  is altijd actueel t.o.v. de huidige FTP, ook na een FTP-test-update

## Chart-specs (Voortgang) — vervangt mijn eerdere "Recharts, verder zelf uitzoeken"

**CTL/ATL/TSB-hero:** CTL = dikke lijn (~5px) met merk-gradient + ronde eindpunt-dot; ATL = dunnere lijn (~2px), neutraal grijs; **TSB = gevulde band tussen CTL en ATL** (géén losse derde lijn) — gesloten path langs CTL heen en ATL terug, gradient-vulling op lage opacity. Dit is functioneel identiek aan wat ik eerder voorstelde, nu met de exacte path-constructie.

**Power curve:** huidig = gradient-lijn (~4px) met zachte area-fill eronder; vorig = grijze stippellijn (`stroke-dasharray: 4 4`). README signaleert zelf dat een logaritmische tijd-as gebruikelijker is voor power curves in productie dan de vereenvoudigde lineaire as in de mockup — overweeg dat als Recharts/de gekozen library het ondersteunt.

## Design tokens (uit alle 3 schermen)

- Font: 'Nunito' (body, labels, headlines) + 'Fredoka' (grote cijfers/getallen)
- Achtergrond: `oklch(0.962 0.012 84)` (warm gebroken-wit)
- Kaarten: `oklch(0.99 0.006 84)`, border-radius 28px, subtiele border `oklch(0.93 0.01 82)`
- Donkere insight-kaart: `oklch(0.345 0.035 245)` (slate)
- Accentgradient: `oklch(0.64 0.14 248)` → `oklch(0.79 0.14 168)` (blauw → mintgroen)
- Status-pills: afgeronde pil, gevulde stip + label (bv. "● Goede balans")
- Labels: kleine kapitalen, letter-spacing ~1.2-1.6px

*(Bovenstaande korte lijst was mijn eerdere samenvatting — laten staan voor snelle scan, maar de uitgebreide README-tokens hierboven zijn leidend bij afwijking.)*

## 1. Home → `DagAdvies.js` + `TrainingLoad.js` + bovenste deel `AppClient.js`

| DC-variabele | Bron |
|---|---|
| `headline`, `headlineColor`, `statusDot`, `statusLabel` | Nu hardcoded per status (`good`/`caution`/`careful`/`rest`) in het `S`-object. Vervang door de echte 4-niveaus berekening in `DagAdvies.js` (HRV/RHR/TSB-gebaseerd) — niet de 4 vaste teksten overnemen |
| `balance`, `ctl`, `atl`, `tsb` | Koppel aan werkelijke CTL/ATL/TSB uit `/api/intervals/wellness`, niet de hardcoded waarden per status |
| `days` (array: `d`, `isTrain`, `isRest`, `today`) | **Dit is de beschikbaarheid-feature.** Zie sectie hieronder. **Let op volgorde:** README specificeert de Home-weekstrip als **Ma→Zo** (patroon: Ma/Di/Do/Vr/Za train, Wo/Zo rust, Do = vandaag), terwijl de wizard/bewerkscherm-bestanden **Di→Ma** gebruiken. Kies één consistente weekvolgorde voor de hele app (bv. ISO-weekstart Ma→Zo) en pas de wizard/bewerkscherm-volgorde daarop aan, niet andersom |
| `intervals` (mini workout-preview) + "FTP 250W" | Sessie van vandaag (`segmenten`-data van Claude) + `/api/intervals/profiel` — niet hardcoden |
| Filter-pills (`Vandaag`/`Deze week`/`Herstel`/`Belasting`) | **Nu zonder gedrag — zie subsectie hieronder.** README laat dit bewust open: "wisselt de getoonde tijdspanne, gedrag te bepalen door codebase" |

### Filter-pills gedrag (nieuw, README laat dit open)

**Aan te passen bestanden:**
- `TrainingLoad.js` — de balans-kaart/ring zelf: voeg de 4 weergave-varianten toe, gestuurd door `selectedFilter`
- `DagAdvies.js` — bron voor de "Herstel"-variant (HRV/rusthartslag/slaap, dezelfde data als de 4-niveaus statusberekening)
- Bovenste deel `AppClient.js` (of waar Home momenteel de pills + balans-kaart samenbrengt) — houdt de `selectedFilter`-state lokaal bij en geeft die door aan `TrainingLoad.js`
- Optioneel, alleen nodig als "Deze week" de Schema-daglijst hergebruikt: lichte import/hergebruik van een sub-component uit `SchemaTab.js` (sectie 6) — geen wijziging dáár nodig, alleen consumeren

In de DC-export zijn dit statische pills zonder functie. Vul concreet in: **alleen de
balans-kaart (ring + onderliggende metrics) wisselt van databron/weergave per actieve pil** —
de rest van Home (headline, weekstrip, sessie-kaart van vandaag) blijft ongewijzigd. Dit is
een kleine state-wissel binnen `TrainingLoad.js`/`DagAdvies.js`, geen herbouw van het scherm.

| Pil | Wat de balans-kaart toont |
|---|---|
| **Vandaag** (default, actief bij laden) | Huidige weergave: status-headline-afgeleide ring met TSB van vandaag, zoals nu al gebouwd in sectie 1 |
| **Deze week** | Ring/metrics op week-niveau — bv. 7-daags gemiddelde TSB i.p.v. het puntmoment van vandaag, eventueel de balans-kaart vervangen door een compacte versie van de Schema-daglijst (sectie 6) of een link daarnaartoe |
| **Herstel** | Onderliggende hersteldata i.p.v. de samengevatte balans: HRV-trend, rusthartslag, slaap — dezelfde brondata als `DagAdvies.js` gebruikt voor de 4-niveaus status, nu expliciet getoond in plaats van samengevat |
| **Belasting** | CTL/ATL/TSB expliciet uitgesplitst (drie aparte getallen/mini-trend), eventueel een verkleinde versie van de Voortgang-lijngrafiek (sectie 3) als ruimte het toelaat |

Selectie-state lokaal houden (`selectedFilter`, niet persisteren) — actieve pil = slate-zwarte
achtergrond, inactief = transparant met rand, exact zoals de README beschrijft. Geen nieuwe
databronnen nodig: alle vier varianten zijn al aanwezig elders in de app (wellness-data,
TrainingLoad-berekening), dit hergroepeert bestaande data, het haalt niets nieuws op.

### Beschikbaarheid (belangrijk)

Het `days`-array is in de DC-export statisch. Maak dit interactief:

- Bron: bestaande `beschikbaar` + `urenPerDag` state
- Voeg tap-handler toe per dag-element om `isTrain`/`isRest` te togglen
- **Sla direct op via `/api/plan`** zodat dit niet meer verdwijnt bij reload
- `today` berekenen uit de werkelijke datum, niet hardcoden

Dit lost de bekende TODO-bug op ("beschikbaarheid verdwijnt bij reload") én vervangt de
losse "beschikbaarheid aanpassen"-flow — dit component, getoond op Home, IS die flow nu.
Geen apart bewerkscherm nodig.

## 2. Workout-detail = Schema-tab (samengevoegd) → `WorkoutViz.js` wordt het hoofdscherm

**Belangrijke architectuurwijziging t.o.v. de eerdere versie van dit document:** het losse
Schema-overzicht (oorspronkelijk sectie 6, met een 7-dagenlijst) komt te vervallen. In plaats
daarvan wordt **Workout-detail het scherm achter de Schema-tab**, met dag-voor-dag-navigatie
via chevrons. `SchemaTab.js` hoeft niet meer gebouwd te worden; de Schema-tab in de bottom-nav
opent dit scherm op de huidige dag. Bron: bijgewerkte `Pedalytics_Workout_dc.html` +
`README.md` (sectie "2. Workout-detail").

| DC-element | Implementatie |
|---|---|
| `bars` (array: `grow`, `h`, `color`) + `ftpLine`, `ftpLineLabel` | Ongewijzigd t.o.v. eerdere opdracht: bereken uit `segmenten`-array van de sessie t.o.v. echte FTP uit profiel-data |
| `segments` (naam/detail/duur per blok) | Zelfde brondata, andere weergave |
| **Dag-strip** (vervangt chevron-navigatie) | **Design is nu definitief geüpdatet** (`Pedalytics_Workout_dc.html` + `README.md`, laatste versie): geen losse chevrons meer, maar een horizontaal scrollbare rij van 21 dag-tiles (10 terug → vandaag → 10 vooruit). **Dit maakt de eerdere "tijdelijke −10/+10 voor testdoeleinden"-opmerking overbodig: −10/+10 is nu gewoon de definitieve vormgeving**, geen losse test-constante meer nodig. Elke tile: dag-afkorting + datumnummer + 6px mode-stipje onderaan (kleur per `mode`, zie tabel hieronder — zelfde kleuren als de datum-pil-dot eerder, nu hergebruikt op tile-niveau). Bij openen gecentreerd op de geselecteerde dag (auto-scroll, `centerStrip()`-patroon uit het DC-bestand), tikken op een tile centreert opnieuw en selecteert die dag. Vervang `state.dayOffset` (single index) door een index in een 21-lange `modes`-array, of bouw 'm gelijkwaardig met datums — zie DC-bestand voor de exacte structuur |
| `isTraining`/`isRest` | Bepaal per offset of er een geplande sessie is in het seizoensplan voor die datum, of dat het een rustdag is (zie sectie 5: `beschikbaar`/`urenPerDag` per weekdag) of een dag buiten het plan-bereik — **alle drie behandel je als de rust-staat** (zie hieronder, eerder vastgesteld dat "geen sessie" en "rustdag" dezelfde weergave krijgen). **Geldt alleen voor toekomstige/huidige dagen** — voor verleden-dagen gebruik je voortaan `mode` (zie subsectie hieronder), niet `isTraining`/`isRest` |
| **TSS-weekkaart** (onder de dag-strip) | Compacte variant van de TSS-voortgangskaart: `huidig` = som TSS van voltooide ritten deze kalenderweek uit `/api/intervals/activities`, `doel` = `tss_doel` van de huidige week uit het seizoensplan. **Blijft staan ongeacht welke dag bekeken wordt** (ook in de rust-staat) — dit is altijd de huidige kalenderweek, niet de bekeken dag |
| **"Aanpassen"-pil — VERVALLEN** | **Herziening: de pil komt helemaal te vervallen op dit scherm.** Eerdere versies van dit document zeiden eerst "verbergen op verleden-dagen", daarna "altijd zichtbaar, definitief" — beide kloppen niet meer: 'm past visueel niet goed op deze pagina. Verwijder de pil volledig uit `WorkoutViz.js`/het Workout-detail-scherm, op alle dagen. Beschikbaarheid aanpassen blijft bereikbaar via de bestaande ingangen op Home (zie sectie 5) — geen vervangende ingang nodig op dit scherm |
| **Rust-staat** | Vervangt kerngetallen + intervalgrafiek + segmenten + onderbouwing wanneer `isRest` (alleen toekomst/huidig). Statusbalk, dag-strip, TSS-weekkaart en bottom-nav blijven staan (géén Aanpassen-pil, géén sticky CTA — zie hieronder, allebei vervallen). Dekt zowel bewuste rustdagen als dagen zonder geplande sessie (buiten plan-bereik) — géén apart "leeg"-component nodig, zoals eerder besproken |
| ~~Sticky "Start workout"-CTA~~ — **VERVALLEN** | De knop deed niets en wordt niet meer nodig: zie sectie 8 (Wahoo-synchronisatie). Sessies pushen automatisch naar intervals.icu/Wahoo zodra ze gegenereerd worden, er is geen handmatige "start"-actie meer nodig op dit scherm. Verwijder de knop volledig uit `WorkoutViz.js`, op alle dagen (niet alleen de rust-staat) |

**Mode-stip-kleuren op de dag-strip-tile (definitief, uit README):** groen `oklch(0.6 0.13 165)`
= matched · amber `oklch(0.72 0.13 70)` = deviated · blauw `oklch(0.55 0.07 215)` = unplanned ·
grijs `oklch(0.72 0.015 75)` = missed · mint `oklch(0.74 0.05 200)` = gepland (toekomst) ·
leeg/transparant = rustdag. Dit was eerder als voorstel geformuleerd ("gebruik dezelfde 4
mode-kleuren") — nu in het design zelf bevestigd, dus geen aanname meer maar vaste spec.

### Segment-overzicht — JOIN-stijl blokken (ENIGE wijziging uit deze toevoeging — rest van sectie 2 blijft ongewijzigd)

Bron: laatste `Pedalytics_Workout_dc.html` + `README.md` (punt 6 onder "2. Workout-detail").
**Scope, expliciet afgebakend:** dit vervangt **alleen** het bestaande segment-overzicht (de
compacte lijst-rijen onder de intervalgrafiek-kaart). De intervalgrafiek-kaart zelf (de
bar-chart met FTP-lijn, tijd-as, zone-legenda) **blijft volledig ongewijzigd**, evenals alle
andere onderdelen van sectie 2 (dag-strip, TSS-weekkaart, titelblok, kerngetallen-tiles, slate
"WAAROM VANDAAG"-kaart, sticky CTA *(noot: de sticky CTA zelf is inmiddels apart vervallen
verklaard, zie sectie 8 — dat is een latere, ongerelateerde wijziging, niet onderdeel van
deze segment-overzicht-toevoeging)*, alle verleden-dag-staten hieronder). Raak geen andere
bestanden/componenten aan dan wat hieronder staat.

**Wat te bouwen:**
- Eyebrow-rij boven het blokkenoverzicht: "OPBOUW" links + "FTP {waarde}W" rechts (uit
  `/api/intervals/profiel`, zoals elders al gebeurt)
- Per segment: een vol kleurvlak (zone-kleur, radius 20px, verdiepte tint t.o.v. de
  legenda-tokens voor wit-tekst-contrast — zie `blockBg`-mapping in het DC-bestand) met:
  - Titel = segment-type (bv. "Warming-up", "Tempo", "VO2max", "Herstel", "Cooldown")
  - Twee-koloms-rij: RPE-range links (bv. "6–7"), Totale tijd rechts
  - Na een dunne scheidingslijn: Vermogen als watt-range — **hergebruik de al gebouwde
    ±5%-rangeberekening** (`wattRange(pct)`-functie uit het DC-bestand is het patroon: ±5%
    rond `FTP × pct%`, afgerond op 5W) — dit is dezelfde berekening die al in de
    sessiegeneratie/data zit, alleen nu als blok-weergave i.p.v. tekstregel
- **Herhaalde sets**: een set van verschillende blokken die samen N× herhaalt (bv. Tempo →
  VO2max → Herstel, 3×) wordt ingesprongen weergegeven met een dunne haak-bracket (spine +
  boven/onder-cap) en een ronde witte badge ("3×") verticaal gecentreerd op de bracket. Losse
  blokken (Warming-up, Cooldown) blijven volle breedte zonder bracket
- **Datastructuur — correctie t.o.v. eerdere versie:** `planSets` (`{reps, blocks:
  [blockDef(...)]}`) is **niet langer een afgeleide weergave-laag, maar de bron van waarheid,
  al vastgelegd bij sessiegeneratie.** Eerder stond hier "aangepast aan hoe `segmenten` nu al
  is opgeslagen" — dat klopt niet meer: in plaats van repeats achteraf te *detecteren* uit een
  platte `segmenten`-lijst (heuristisch, foutgevoelig — zie de toelichting bij sectie 8), moet
  `/api/claude` bij generatie **zelf al expliciet aangeven welke blokken een set vormen**
  (`reps`-groepering direct in de output, niet later afgeleid). Dit voorkomt dat lichte
  variatie tussen "bijna identieke" sets de groepering laat mislukken, en geeft zowel deze
  JOIN-blokken-weergave als de Wahoo-export (sectie 8) dezelfde, betrouwbare bron — geen
  heuristiek op twee plekken nodig. Pas de `/api/claude`-promptstructuur hierop aan: laat
  Claude een geneste structuur teruggeven (sets met `reps` + onderliggende blokken, plus losse
  niet-herhaalde blokken ernaast), in plaats van één platte segmentenlijst

**Toepassingsbereik:** dit geldt voor de geplande sessie-weergave (vandaag/toekomst). Voor de
verleden-dag-staten (`matched`/`deviated`/`unplanned`/`buiten_planperiode`, zie hieronder)
blijft de eerder afgesproken weergave (werkelijke kerngetallen, "GEPLAND vs GEREDEN"-grafiek)
ongewijzigd — die gebruikten al geen segment-overzicht-lijst, dus daar verandert niets.



Bron: bijgewerkte `Pedalytics_Workout_dc.html` + `README.md` (subsectie "Verleden-dag-staten").
Voor elke dag met `dayOffset < 0` (of `dayOffset === 0` als er al een voltooide rit is — zie
sync-vereiste hieronder) wordt een `mode` bepaald i.p.v. `isTraining`/`isRest`:
`planned` (nog te doen) → niet van toepassing in het verleden → altijd één van de vijf hieronder.

| Mode | Wanneer | Weergave (zie README voor exacte tekst/kleuren) |
|---|---|---|
| `matched` | Geplande sessie + voltooide rit, **type komt overeen** (zie matchcriteria) **en** TSS/duur beide binnen ±20% van gepland | Groene statusbanner, kerngetallen werkelijk-vs-plan, grafiek "GEPLAND vs GEREDEN" (geplande staven op 40% opacity + werkelijke lijn eroverheen), slate recap-kaart |
| `deviated` | Geplande sessie + voltooide rit, type wijkt af **of** TSS/duur buiten ±20% | Amber statusbanner, gepland-vs-gereden type-tegeltjes naast elkaar, werkelijke kerngetallen (geen plan-vergelijking), grafiek "GEREDEN VERMOGENSPROFIEL" met het werkelijke profiel |
| `missed` | Geplande sessie, **geen voltooide rit gevonden de volgende ochtend** (zie sync-vereiste) | Rustige niet-bestraffende staat, "STOND GEPLAND"-kaartje, geruststellende afsluiter |
| `unplanned` | **Datum ligt binnen de planperiode** (op of na de startdatum van het huidige seizoensplan), geen geplande sessie voor die dag, wél een voltooide rit | Neutrale statusbanner, gedetecteerd rittype als titel, werkelijke kerngetallen, grafiek "GEREDEN VERMOGENSPROFIEL" |
| `buiten_planperiode` (nieuw) | **Datum ligt vóór de startdatum** van het huidige seizoensplan, wél een voltooide rit | Zelfde visuele opbouw als `unplanned` (rittype-detectie, kerngetallen, grafiek), maar **ander label**: "Rit" of "Rit buiten planperiode" i.p.v. "Ongeplande rit" — een rit vóórdat er een plan bestond is geen bewuste keuze om af te wijken van iets, dat onderscheid moet in de tekst terugkomen. Géén verwijzing naar "geen sessie ingepland", want er was simpelweg nog geen plan |

**Correctie t.o.v. eerdere versie van dit document:** alle ritten van vóór de startdatum van
het seizoensplan werden eerder als `unplanned` behandeld ("geen sessie ingepland"), ook al
bestond er op dat moment nog helemaal geen plan om van af te wijken. Dat is feitelijk onjuist
en moet gecorrigeerd worden naar `buiten_planperiode`. Bepaal de planstartdatum uit het
seizoensplan-object (zie `SEIZOENSPLANNING_BOUWOPDRACHT.md`/bestaande `/api/plan`-structuur)
en vergelijk die met de bekeken datum vóórdat je `mode` bepaalt.

**Rit-titel-consistentie (correctie):** eerder toonde alleen `unplanned` de rit-titel
(gedetecteerde rittype als H1), terwijl `matched`/`deviated` de **geplande** sessietitel
toonden zonder de werkelijke rit-titel (zoals die in intervals.icu staat, bv. door Frank zelf
benoemd of automatisch gegenereerd) te laten zien. Maak dit consistent: toon de werkelijke
rit-titel uit intervals.icu **in alle staten waar een voltooide rit bestaat** (`matched`,
`deviated`, `unplanned`, `buiten_planperiode`) — bij `matched`/`deviated` als kleine subregel
onder de bestaande titel (geplande titel blijft de hoofd-H1, werkelijke rit-titel erbij), bij
`unplanned`/`buiten_planperiode` blijft het gedetecteerde rittype de hoofd-H1 (er is geen
gepland alternatief om naast te zetten).

**Matchcriteria (AND-regel, bewust simpel i.p.v. gewogen score zodat het uitlegbaar blijft):**
1. Gedetecteerd rittype (zie hieronder) valt in dezelfde categorie als gepland (interval-sessie / duurrit / hersteltrit — zelfde "familie", geen exacte zone-match nodig)
2. TSS én duur beide binnen ±20% van gepland

Beide waar → `matched`. Eén van beide niet waar → `deviated`.

**Rit-type-detectie (Coggan/Allen IF-methode, standaard classificatie-aanpak) — status: nog
niet correct werkend, expliciet fixen.** Eerder als spec vastgelegd met VI als primaire as,
dat was te grof (alles viel op "Tempo/Z3-4") — **herzien naar Intensity Factor (IF = NP/FTP)
als primaire classificatie**, met dezelfde Coggan-zone-indeling die al in de app gebruikt
wordt, en VI als secundaire as (niet primair). Dit is de meest gebruikte aanpak in
coaching-software (TrainingPeaks, WKO5, intervals.icu zelf) en sportwetenschappelijke
literatuur — bewust gekozen boven een zelfbedachte VI-eerst-volgorde.

**Bouwstenen — let op het onderscheid tussen gevalideerd en heuristiek:**
- NP, IF en VI zelf zijn gestandaardiseerde, breed gevalideerde metrics (Coggan & Allen,
  *Training and Racing with a Power Meter*)
- De exacte IF-grenzen in de tabel hieronder zijn de gangbare, breed gerepliceerde indeling
  uit diezelfde bron — dit is de meest gebruikte classificatie, geen eigen verzinsel
- Waar nog wél een aanpasbare keuze in zit: de VI-drempel voor "stabiel vs. variabel binnen
  een IF-band" en het tijd-in-zone-aandeel voor "dominante zone" — die mogen later op basis
  van Franks eigen ritten bijgesteld worden, zie ze als tunable parameters, niet als vaste wet

**Classificatie-logica:**
1. Bereken **Normalized Power (NP)** over de rit (i.p.v. ruw gemiddelde — corrigeert voor variabiliteit). **Check eerst of intervals.icu dit al aanlevert** via het veld `icu_weighted_avg_watts` op het activity-niveau (komt neer op NP) — als dat veld al wordt opgehaald via `/api/intervals/activities`, hoeft NP niet zelf uit de ruwe stream herberekend te worden. Verifiëren, niet aannemen
2. Bereken **Intensity Factor = NP / FTP** (FTP uit `/api/intervals/profiel`)
3. Classificeer op IF volgens de standaard-tabel:

| IF-bereik | Type |
|---|---|
| <0,55 | Hersteltrit |
| 0,55–0,75 | Duurrit |
| 0,76–0,87 | Tempo rit |
| 0,88–0,94 | Sweet Spot |
| 0,95–1,05 | Drempeltraining |
| 1,06–1,20 | VO2max Intervallen |
| 1,21–1,50 | Anaerobe Intervallen |
| >1,50 | Sprint/Neuromusculair |

4. Bereken **Variability Index = NP / gemiddeld vermogen** als secundaire check binnen de gevonden IF-band: VI ≤1,05 → "stabiele" variant van het type (bv. vlakke Tempo rit), VI >1,05 → wijst op een variabele/gemixte rit op vergelijkbare gemiddelde belasting (bv. label aanvullen met "(variabel)" of, bij sterk afwijkende tijd-in-zone-verdeling zonder dominante zone, terugvallen op "Variabele/Gemixte rit" i.p.v. het IF-type)

Implementeer dit als pure functie (bv. `lib/rittype.js`) die een vermogen-tijdreeks (of
direct `icu_weighted_avg_watts` indien beschikbaar) + FTP als input neemt en een rittype +
IF/VI-waarden teruggeeft — herbruikbaar voor zowel match-logica, het label op
`unplanned`/`buiten_planperiode`, én de rit-titel-fallback als intervals.icu zelf geen
bruikbare naam heeft.

**Werkelijk-gereden vermogensprofiel — status: nog niet zichtbaar, expliciet fixen.** Eerder
als spec vastgelegd (seconde/minuut-resolutie stream ophalen via activity streams, omrekenen
naar staven), maar dit ontbreekt nog in de praktijk bij `matched`/`deviated`/`unplanned`. Dit
blijft de eis; controleer waarom de fetch/rendering nog niet gebeurt — mogelijk wordt nog het
activities-summary-endpoint gebruikt in plaats van de streams-endpoint, of de stream-data wordt
opgehaald maar niet doorgegeven aan de grafiek-component:
- Haal dit op via de **activity streams** van intervals.icu (vermogen + tijd, eventueel HR voor
  toekomstige cardiac-decoupling-berekening), niet via het activities-summary-endpoint
- Reken dit net als de geplande grafiek om naar staven t.o.v. FTP (zelfde `(%FTP/130)*100`-schaal)
  zodat geplande en werkelijke grafiek visueel vergelijkbaar zijn
- Cache dit per activiteit (de stream-data verandert niet met terugwerkende kracht) zodat je 'm
  niet bij elke dag-navigatie opnieuw ophaalt

**Sync-vereiste (randvoorwaarde, geen losse feature — dit moet werken voordat de match-logica
zinvol is):** de app moet recente ritten automatisch en tijdig ophalen, zodat een ochtend-check
de rit van gisteren al heeft. Concreet: een sync-moment bij het openen van de app (en/of een
achtergrond-poll) die `/api/intervals/activities` recent genoeg ophaalt. Een sessie wordt pas
als `missed` gemarkeerd als er **de volgende ochtend** nog geen gematchte rit gevonden is — niet
dezelfde avond al (geeft ruimte voor late sync of een avondrit die nog niet binnen is). Als de
huidige app dit nog niet automatisch doet: dit moet eerst gefixt worden, los van de UI-staten.

**Koppeling met RPE/regeneratie (bevestigd, zelfde aanpak als RPE):** zowel `deviated` als
`missed` triggeren — net als een ingevulde RPE — de bestaande 10-dagen-regeneratielogica. Een
afwijking van het plan is zelf ook een signaal dat het schema bijgesteld moet worden, niet
alleen een weergave-detail.

**Dag-strip-indicator:** zie hierboven — definitief bevestigd in het design, geen open vraag meer.

**Wat hiermee komt te vervallen uit de eerdere opdracht:** het idee van `SchemaTab.js` als
los component met een 7-dagenlijst (oorspronkelijke sectie 6) — zie de noot bij de vroegere
sectie 6 hieronder. Als sectie 6 al gebouwd is vóór deze wijziging: dat component kan
verwijderd worden, de Schema-tab-route wijst voortaan naar dit scherm.

## 3. Voortgang → `SeizoenProgressie.js` + `TrainingLoad.js` + `PowerCurve.js`

| DC-variabele | Bron |
|---|---|
| `heroChart` (CTL/ATL/TSB-lijngrafiek) | Herbouw met Recharts, gevoed door wellness-historie uit `/api/intervals/wellness` over gekozen periode. CTL als dikke lijn, TSB als gevulde band tussen CTL/ATL — niet de gesimuleerde data uit het DC-bestand |
| `powerChart` + `pcLabels` | Power curve met Recharts, zelfde lijnstijl als heroChart |

## 4. Wizard stap 2 → `SeizoenWizard.js`

Bron: `Pedalytics_Wizard_Beschikbaarheid_dc.html`

Dit DC-bestand bevat al werkende interactie-logica (`toggle()`, `bump()`, `fmt()` in de
`Component`-class) — geen placeholders. Vertaal deze 1-op-1 naar React state in
`SeizoenWizard.js`:

| DC-element | Implementatie |
|---|---|
| `state.days` (key/full/on/hours) | Vervang de hardcoded seed-data door lege/standaard staat bij het starten van de wizard (nieuwe gebruiker heeft nog geen beschikbaarheid) |
| `toggle(i)` | Direct overnemen — togglet `on` per dag |
| `bump(i, delta)` | Direct overnemen — `hours` in stappen van 0,5, geclamped 0,5–6 |
| Progress-segmenten (stap 2 van 3, blauw-mint gradient voor actieve stap) | Koppel aan bestaande wizard-stapindex |
| "Overslaan" | Sla over naar stap 3 met lege/default beschikbaarheid — bepaal samen of dit toegestaan moet zijn (een leeg seizoensplan zonder beschikbaarheid is functioneel niet bruikbaar) |
| Footer "Volgende" | Bij submit: schrijf `days`-state weg naar het seizoensplan via `/api/plan` (zelfde structuur als punt 5 hieronder) — dit is het eerste moment dat `beschikbaar`/`urenPerDag` ontstaat |

## 5. Beschikbaarheid aanpassen (los scherm) → nieuwe route, bv. `/beschikbaarheid` of modal vanuit Home

Bron: `Pedalytics_Beschikbaarheid_Aanpassen_dc.html`

Functioneel identiek aan punt 4 (zelfde `toggle`/`bump`/`fmt`-logica), met twee verschillen:

| Verschil t.o.v. wizard | Implementatie |
|---|---|
| Geen progress-stappen, geen "Overslaan" — losse header met terug-pijl | Toegankelijk vanuit Home (bv. tap op de bestaande beschikbaarheid-kaart of een instellingen-ingang), en vanuit de Schema-tab via de "Aanpassen"-achtige ingang (zie sectie 2-vervanging — bepaal exacte navigatie-ingang) |
| `state.days` start gevuld met de **bestaande** beschikbaarheid | Laad bij openen uit `/api/plan` (huidige `beschikbaar`/`urenPerDag`), niet leeg of met de seed-data uit het DC-bestand |
| "Opslaan"-knop | Schrijft direct naar `/api/plan`, zelfde payload-structuur als punt 4 |

**Eén bron van waarheid:** bouw de dag-lijst (toggle + uren-stepper) als één herbruikbaar
component (bv. `BeschikbaarheidEditor.js`) dat zowel in de wizard als in dit losse scherm
gebruikt wordt, met de databron (leeg vs. vooringevuld) en de afsluitactie (volgende stap vs.
opslaan-en-terug) als props. Voorkomt dat wizard en los scherm uit elkaar gaan lopen.

**Relatie tot het `days`-array op Home:** dit is dezelfde onderliggende data
(`beschikbaar`/`urenPerDag`) als de week-strip op Home (zie punt 1), maar dan met de volledige
edit-UI (uren-stepper, on/off-toggle, opslaan). De week-strip op Home blijft het snelle
overzicht; dit scherm/deze wizard-stap is waar de daadwerkelijke invoer gebeurt.

## 6. ~~Schema (los overzichtsscherm)~~ — VERVALLEN, zie sectie 2

Deze sectie beschreef oorspronkelijk een los `SchemaTab.js`-component met een 7-dagenlijst
(`Pedalytics_Schema_dc.html`). Dat ontwerp is **vervangen**: de Schema-tab opent nu het
Workout-detail-scherm (sectie 2) met dag-navigatie via chevrons, in plaats van een
weekoverzicht. Als `SchemaTab.js` al gebouwd was vóór deze wijziging: verwijderen en de
Schema-tab-route omleiden naar het bestaande `WorkoutViz.js`-scherm, geopend op vandaag.
`Pedalytics_Schema_dc.html` blijft als historisch referentiebestand staan maar is niet langer
leidend voor implementatie.

## 7. Sessiegeneratie-aanpassingen → `/api/claude` (geen UI-wijziging, puur prompt/generatielogica)

Twee aanpassingen aan de sessiegeneratie-prompt, op expliciet verzoek — geen designwijziging,
beide bevestigd na een korte discussie over de wetenschappelijke onderbouwing.

**1. Warm-up/cooldown eruit.** Volledige sessieduur wordt voortaan volledig ingevuld met de
hoofdinspanning, geen aparte oplopende/aflopende ramp-segmenten meer aan begin/eind. Voorbeeld:
een geplande sessie van 1,5u die voorheen 10 min warm-up + 70 min Z2 + 10 min cooldown was,
wordt voortaan gewoon 90 min Z2 (of het toepasselijke type, zie punt 2). **Geldt voor alle
sessietypes**, niet alleen Z2-duurritten. Pas de `/api/claude`-prompt aan zodat Claude geen
warm-up/cooldown-segmenten meer genereert in de `segmenten`-array.

Let op, gevolgen elders die hierdoor moeten meeveranderen:
- De **intervalgrafiek-formule** (zie eerder in dit document) beschreef expliciet
  warm-up/cooldown als "geleidelijk oplopende/aflopende trapjes" — die logica vervalt voor
  nieuw-gegenereerde sessies. Bestaande, al-opgeslagen sessies met warm-up/cooldown blijven
  gewoon correct renderen (de grafiek-component hoeft niet te breken op data die warm-up/
  cooldown-segmenten bevat), dit raakt alleen wat er nieuw gegenereerd wordt
- Het **JOIN-stijl segment-overzicht** (sectie 2, blokken-weergave) toonde "Warming-up" en
  "Cooldown" als losse, niet-ingesprongen blokken — die blokken verschijnen simpelweg niet
  meer bij nieuw-gegenereerde sessies, geen aparte code-aanpassing nodig in de blokken-render
  zelf (het is conditioneel op of de data ze bevat)

**2. Nieuw, optioneel sessietype: "Variabele duurrit" — naast, niet i.p.v. de vlakke Z2-duurrit.**
Beide types blijven beschikbaar voor Claude om te kiezen bij sessiegeneratie:
- **Vlakke Z2-duurrit** (bestaand, ongewijzigd): één doorlopend Z2-segment, geen variatie —
  blijft de basis voor het polarized-training-model (80% Z1-Z2) dat al in het seizoensplan zit
- **Variabele duurrit** (nieuw): dezelfde totale duur, maar opgebouwd uit afwisselende
  Z2-blokken en kortere tempo/sweet-spot-blokken (Z3-laag) — bv. bij 90 min: 40 min Z2, 10 min
  tempo, 10 min Z2, 10 min tempo, 20 min Z2 (vergelijkbaar met het voorbeeld dat besproken is,
  met dien verstande dat de "hogere" blokken in **Z3-gebied** blijven, niet Z4-sweet-spot —
  dat behoudt het onderscheid met een bewuste sweet-spot/drempelsessie, en voorkomt dat een
  "variabele duurrit" stilletjes een zware intensiteitsdag wordt)

**Wanneer welk type kiezen (instructie voor de `/api/claude`-prompt):** laat Claude kiezen op
basis van TSB/herstelstatus en plaats in de week — variabele duurrit bij voldoende herstel en
als er al een tijdje alleen vlakke ritten gepland stonden (afwisseling), vlakke Z2-duurrit bij
lagere TSB/na een zware sessie de dag ervoor (puur herstel, geen extra prikkel gewenst). Dit is
een keuzeregel voor de promptlogica, geen losse vraag aan de gebruiker.

**Datastructuur:** `segmenten`-array van een variabele duurrit bevat dus meerdere segmenten
(afwisselend Z2/Z3) i.p.v. één — dit volgt automatisch uit hoe `segmenten` al werkt voor
interval-sessies, geen nieuwe structuur nodig. Het JOIN-stijl segment-overzicht (sectie 2)
toont deze blokken dan vanzelf als losse, niet-bracket-omsloten blokken (geen "herhaalde set",
want elk blok is anders) — geen aparte code-aanpassing nodig daar.

## 8. Wahoo-synchronisatie → vervangt de "Start Workout"-knop, raakt sessiegeneratie + `/api/intervals/events`

**Doel:** geplande sessies automatisch beschikbaar maken op de Wahoo ELEMNT Bolt, zonder
handmatige actie. Dit vervangt de "Start Workout"-CTA volledig (zie correctie hierboven in
sectie 2) — er hoeft niets meer "gestart" te worden vanuit de app zelf.

**Hoe het werkt (geen nieuwe Wahoo-integratie nodig, intervals.icu doet het zware werk):**
intervals.icu kan zelf de komende 7 dagen van geplande events automatisch uploaden naar Wahoo
Cloud, die vervolgens naar de Bolt synchroniseert zodra die verbinding heeft (wifi/Wahoo-app).
Dit vereist twee dingen:

**A. Eenmalige koppeling (bij Frank, geen code):** in intervals.icu-instellingen de
Wahoo-sectie koppelen (OAuth) en "upload workouts" aanvinken. Dit hoeft niet gebouwd te
worden, maar is wel een randvoorwaarde — vermeld dit als check/instructie aan de gebruiker als
de functie voor het eerst gebruikt wordt (bv. een melding als er nog geen Wahoo-koppeling
gevonden wordt).

**B. Sessies moeten als intervals.icu-event bestaan, niet alleen in het eigen seizoensplan-JSON.**
Op dit moment slaat Pedalytics gegenereerde sessies alleen op via `/api/plan` (eigen JSON,
geen database-aanwezigheid in intervals.icu zelf). Alleen events die in intervals.icu als
geplande activiteit staan, worden door intervals.icu naar Wahoo gepusht. Dus:
- Bij sessiegeneratie (`/api/claude`): naast het opslaan in het seizoensplan, **ook wegschrijven
  als event naar intervals.icu** via de bestaande `/api/intervals/events`-route (`POST`)
- **Correctie t.o.v. eerdere versie van dit document — verkeerde API-laag aangenomen.** Eerder
  stond hier: "vertaal naar het structured-workout-formaat dat intervals.icu/Wahoo verwacht
  (intervallen met `targets`, `low`/`high`)" — dat beschrijft Wahoo's eigen `plan.json`-formaat,
  maar **de `/api/intervals/events`-route van intervals.icu werkt niet met die rauwe JSON.**
  intervals.icu gebruikt een **platte-tekst workout-syntax** in het `description`-veld van het
  event, en zet die intern zelf om naar Wahoo's `plan.json` (incl. de `low`/`high`-targets) op
  het moment dat het naar Wahoo Cloud pusht. Wij hoeven dus geen Wahoo-JSON te bouwen, alleen
  de juiste tekst-syntax.
- **Vertaal de `segmenten`/`planSets`-structuur naar intervals.icu's tekst-syntax:**
  - Vermogen-ranges: schrijf `vermogenMin`-`vermogenMax` als `a-b` met eenheid, bv.
    `8m 220-235w` (niet als los JSON-object, niet als percentage als watt al beschikbaar is)
  - Herhalingen: gebruik een `Nx`-headerregel boven de geneste blokken uit de `reps`-groepering
    (sectie 2-correctie), bv.:
    ```
    Main Set 3x
    - 4m 220-235w
    - 1m 270-290w
    ```
    Dit is **dezelfde bron-van-waarheid als voor de JOIN-blokken-weergave** — geen aparte
    repeat-detectie nodig, de `Nx`-regel volgt direct uit het `reps`-aantal dat al bij
    generatie wordt vastgelegd. Dit lost het tweede twijfelpunt (heuristische repeat-detectie)
    automatisch mee op, want er hoeft op deze laag niets meer gedetecteerd te worden, alleen
    een al-bekend getal in tekst gezet te worden
  - Losse blokken (geen onderdeel van een set): gewone regels zonder `Nx`-header
  - Min/max blijft dus overeind als aanpak (eerste twijfelpunt klopte) — alleen de **vorm**
    waarin het verzonden wordt verandert: tekst-syntax naar intervals.icu, niet JSON naar Wahoo
  - **Bekend Bolt-issue om rekening mee te houden bij testen:** er zijn meldingen dat het
    "Target Power"-veld op sommige Bolt v3-firmwareversies "N/A" toont, ook bij correct
    verzonden ranges — als het targetgetal niet verschijnt tijdens testen, eerst checken of
    dit een bekend firmware-issue is voordat je de eigen data-vertaling als foutbron aanwijst
- **De eerder genoemde "elk niet-repeat-interval moet een `targets`-array hebben"-valkuil
  (422-fout) gold voor de rauwe Wahoo-API, niet voor de intervals.icu-tekst-syntax** — laat
  dit punt vervallen als afzonderlijke zorg; zolang elke tekst-stap een geldig intensiteit-deel
  heeft (percentage, watt, of zone), regelt intervals.icu de Wahoo-vertaling zelf correct
- Bij het wijzigen van een sessie (regeneratie via de 10-dagen-logica, RPE-trigger, etc.): het
  bijbehorende intervals.icu-event moet meeveranderen (update, niet een dubbel event aanmaken)

**Wat er met de lege plek van de "Start Workout"-knop gebeurt:** niets hoeft die plek op te
vullen — de sticky CTA-ruimte onderaan het scherm vervalt volledig. Optioneel, niet vereist:
een kleine, niet-sticky statusregel ("Gesynchroniseerd naar Wahoo ✓") ergens in de
kerngetallen-sectie, als bevestiging dat de push gelukt is — bepaal zelf of dat meerwaarde
heeft of dat het scherm rustiger is zonder.



## Niet aanraken / expliciet behouden

- Veldnaam `icu_rpe` (niet `perceived_exertion`)
- Seizoensplan blijft JSON via `/api/plan` *(noot: er is inmiddels wél een Upstash KV-store
  bijgekomen, gebruikt voor de applicatieniveau-wachtwoordbeveiliging/sessieopslag — dat is
  via een losse opdracht buiten dit document geregeld, niet hier gedocumenteerd. Gebruik die
  KV-store niet door elkaar met het seizoensplan-JSON, het zijn aparte databronnen)*
- Beschikbaarheid-persistentie is **prioriteit 1**: lost twee bekende TODO-bugs in één keer op
  (beschikbaarheid + weekSessies verdwijnen bij reload)
