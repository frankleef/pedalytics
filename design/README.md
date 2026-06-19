# Handoff: Pedalytics — 6 mobiele schermen

## Overview
Pedalytics is een persoonlijke AI-fietscoach app. Dit pakket bevat zes mobiele schermen (390×844, iPhone-formaat):
1. **Home / Dashboard** — samenvatting van herstel- en trainingsbalans, weekbeschikbaarheid, sessie van vandaag.
2. **Workout-detail** — vermogensprofiel van één sessie met intervalgrafiek en onderbouwing; horizontaal scrollbare dag-strip, vaste TSS-weekkaart, rust-staat, en vier verleden-dag-staten (gematcht / afgeweken / gemist / ongeplande rit).
3. **Voortgang** — CTL/ATL/TSB-trendgrafiek over 8 weken, huidige FTP, en power curve.
4. **Wizard stap 2 — Beschikbaarheid** — stap in de seizoensdoel-setup: trainingsdagen + uren per dag instellen.
5. **Beschikbaarheid aanpassen** — standalone bewerkscherm met dezelfde dag-toggles, bereikbaar vanuit Home.
6. **Schema** — de actieve Schema-tab: weekoverzicht met TSS-voortgang en 7 dagkaarten (sessies + rustdagen).

De toon is geruststellend en mensgericht; de coach "praat" in mensentaal, niet in ruwe data.

## About the Design Files
De bestanden in dit pakket (`Pedalytics Home.dc.html`, `Pedalytics Workout.dc.html`, `Pedalytics Progress.dc.html`) zijn **ontwerp-referenties gemaakt in HTML** — prototypes die de bedoelde look & behavior tonen, géén productiecode om letterlijk over te nemen. De opdracht is om deze ontwerpen **na te bouwen in de bestaande omgeving van de doel-codebase** (React Native, Flutter, SwiftUI, native, …) met de daar gangbare patronen, componenten en libraries. Bestaat er nog geen omgeving, kies dan het meest geschikte framework en implementeer de ontwerpen daar.

> Technisch detail: de `.dc.html`-bestanden zijn "Design Components". De markup staat tussen `<x-dc>`-tags; de getallen/grafiek-data worden berekend in een `class Component`-blok onderaan (de `renderVals()`-methode). Lees die methode om de exacte data en de kleur-logica te zien.

## Fidelity
**High-fidelity (hifi).** Definitieve kleuren, typografie, spacing en layout. Bouw de UI pixel-nauwkeurig na met de libraries/patronen van de codebase. Alle kleuren zijn in **oklch** gedefinieerd; hieronder staan hex-benaderingen voor gemak — neem bij twijfel de oklch-waarde als bron van waarheid.

---

## Design Tokens

### Kleuren — basis / neutraal (warm gebroken-wit thema, géén puur wit/zwart)
| Rol | oklch | hex ≈ |
|---|---|---|
| App-achtergrond (canvas) | `oklch(0.962 0.012 84)` | `#F5F1EA` |
| Kaart-achtergrond | `oklch(0.99 0.006 84)` | `#FCFAF6` |
| Subtiele vulling (chips, mini-tiles) | `oklch(0.965 0.012 84)` | `#F6F2EB` |
| Kaartrand | `oklch(0.93 0.01 82)` | `#E8E3D9` |
| Scheidingslijn | `oklch(0.91 0.012 82)` | `#E2DCD0` |
| Tekst primair (bijna-zwart, warm) | `oklch(0.27 0.02 70)` | `#2E2A24` |
| Tekst secundair | `oklch(0.5 0.02 74)` | `#736E63` |
| Tekst tertiair / labels | `oklch(0.6 0.02 75)` | `#8B8579` |
| Pil-knop / nav actief (slate-zwart) | `oklch(0.24 0.012 70)` | `#211F1B` |

### Kleuren — merk-gradient (blauw → mintgroen)
- Gradient: `linear-gradient(140deg, oklch(0.64 0.14 248), oklch(0.79 0.14 168))` ≈ `#4B8FE0 → #5FD3A8`
- Gebruikt in: avatar, trainingsdag-cirkels (weekstrip), ring-stroke, AI-logo blokje.

### Kleuren — herstelstatus (4 niveaus; rood bewust gedempt, niet alarmerend)
| Status | Headline-tekst | Ring-gradient A→B | Status-dot |
|---|---|---|---|
| `good` (groen) | `oklch(0.5 0.13 162)` `#2F9468` | `oklch(0.62 0.14 248)` → `oklch(0.79 0.14 168)` | `oklch(0.6 0.13 165)` `#3FA877` |
| `caution` (geel) | `oklch(0.55 0.11 92)` `#8A7A24` | `oklch(0.79 0.14 168)` → `oklch(0.8 0.13 96)` | `oklch(0.74 0.13 95)` `#C2A53A` |
| `careful` (oranje) | `oklch(0.56 0.13 55)` `#A86A38` | `oklch(0.8 0.13 96)` → `oklch(0.67 0.14 52)` | `oklch(0.66 0.14 54)` `#C07A45` |
| `rest` (gedempt rood) | `oklch(0.52 0.1 28)` `#9C5848` | `oklch(0.67 0.14 52)` → `oklch(0.58 0.11 28)` | `oklch(0.58 0.11 28)` `#A55842` |

### Kleuren — trainingszones (intervalgrafiek, oplopend in intensiteit)
| Zone | % FTP grens | oklch | hex ≈ |
|---|---|---|---|
| Z1 (herstel) | < 56% | `oklch(0.82 0.05 245)` | `#B4C6DE` |
| Z2 (duur) | 56–75% | `oklch(0.70 0.12 240)` | `#5E94CE` |
| Z3 (tempo/sweetspot) | 76–90% | `oklch(0.72 0.13 165)` | `#3FB488` |
| Z4 (drempel) | 91–106% | `oklch(0.74 0.13 70)` | `#C79A3C` |
| Z5 (VO2/boven) | > 106% | `oklch(0.62 0.14 30)` | `#B45A44` |

### Slate insight-kaart (donker contrast-element)
- Achtergrond: `oklch(0.345 0.035 245)` ≈ `#2A3550`
- Binnenste mini-tile: `oklch(0.4 0.03 245)` ≈ `#36405C`
- Label (eyebrow): `oklch(0.74 0.05 200)` ≈ `#7FB0C0`
- Bodytekst: `oklch(0.95 0.012 200)` ≈ `#E9EFF1`
- Accent-cijfer (mint): `oklch(0.86 0.06 165)` ≈ `#A8E3C6`
- Schaduw: `0 10px 26px rgba(30,40,70,0.25)`

### Typografie
- **Headlines & cijfer-labels:** `Nunito` (Google Fonts), gewichten 400–900. Rond, vriendelijk.
- **Grote cijfers (scores, metrics):** `Fredoka` (Google Fonts), gewichten 400–700. Zwaar, rond.
- Schalen:
  - Status-headline (H1): Nunito **800**, 27–28px, line-height ~1.2, letter-spacing −0.4 à −0.5px, `text-wrap: pretty`.
  - Sessie-titel (H2): Nunito 700, 21px.
  - Eyebrow-labels: Nunito 800, 11–12px, letter-spacing 1.2–1.6px, hoofdletters.
  - Grote score (ringcentrum): Fredoka 600, 62px.
  - Metric-cijfers (CTL/ATL/TSB, TSS, etc.): Fredoka 600, 27–30px.
  - Body / detailtekst: Nunito 600, 12–14.5px.
  - Nav-labels: Nunito 700 (inactief) / 800 (actief), 11px.

### Vorm & spacing
- Kaart-radius: **28px**. Mini-tiles/segmenten: 14–18px. Chart-binnenvlak: 16px.
- Pil-knoppen & CTA: volledig rond (`border-radius: 999px`).
- Schermbreedte content-padding: 22px links/rechts.
- Kaart-schaduw (licht): `0 2px 14px rgba(60,45,20,0.05)`, soms `0 2px 10px rgba(60,45,20,0.04)`.
- CTA-knop schaduw: geen; full-width, padding 15–16px.
- Statusbalk-hoogte: 46px. Bottom-nav-hoogte: 78px.

---

## Screens / Views

### 1. Home / Dashboard
**Doel:** in één oogopslag laten zien hoe het herstel ervoor staat en wat vandaag de sessie is.

**Layout (top → bottom), scrollbaar tussen statusbalk en bottom-nav:**
1. **Statusbalk** (46px) — tijd links, signaal/batterij-iconen rechts. (Mockup-chrome; in een echte app vervangt het OS dit.)
2. **Header-rij** — links datum-eyebrow ("DONDERDAG 19 JUNI") + groet ("Goedemorgen 👋"); rechts ronde avatar 46px met gradient + eerste letter van de naam.
3. **Status-headline (H1)** — persoonlijke samenvatting in mensentaal; **tekstkleur volgt de status** (zie token-tabel). Tekst per status:
   - good: `"{naam}, je herstel is goed — tijd voor een pittige training."`
   - caution: `"{naam}, je vorm is prima — houd het vandaag gecontroleerd."`
   - careful: `"{naam}, je belasting loopt op — kies vandaag voor een rustige rit."`
   - rest: `"{naam}, luister vandaag naar je lichaam — rust is winst."`
4. **Filter-pills** — horizontaal scrollbare rij: "Vandaag" (actief = slate-zwart pil, witte tekst), "Deze week", "Herstel", "Belasting" (inactief = transparant, 1.5px rand `#E8E3D9`, tekst secundair). Pil-padding 9×17px, radius 999px.
5. **Balans-kaart** (radius 28px):
   - Eyebrow "TRAININGSBALANS" links; rechts status-badge (dot in statuskleur + label, bv. "Goede balans") op lichte chip.
   - **Centrale voortgangsring** 210×210px SVG: spoor `#E8E3D9` (16px), voortgang in status-gradient, `stroke-linecap: round`, gestart op −90° (bovenaan). Vulgraad = balansscore (good 78, caution 64, careful 46, rest 30).
   - Ringcentrum: label "Balansscore" + grote score (Fredoka 62px) + "Vorm {tsb}" in statuskleur.
   - **CTL/ATL/TSB-triplet** eronder: 3 gelijke tiles. Fitheid (CTL), Vermoeidheid (ATL), Vorm (TSB). TSB-cijfer in statuskleur. Waarden per status: good 62/54/+8 · caution 62/61/+1 · careful 63/70/−7 · rest 61/82/−21.
6. **Weekstrip-kaart** — eyebrow "BESCHIKBAARHEID" + "5 sessies · 2 rust". 7 dagen **Ma → Zo**, gelijk verdeeld. Per dag: daglabel boven, daaronder een 36px cirkel:
   - Trainingsdag → gevulde gradient-cirkel (blauw→mint).
   - Rustdag → lichte cirkel met rand + een klein horizontaal "rust"-streepje (13×3px, `#A8A296`).
   - Vandaag → extra 2px ring (`#2E2A24`) eromheen (offset −5px).
   - Patroon: Ma train, Di train, Wo rust, **Do = vandaag (train)**, Vr train, Za train, Zo rust.
7. **Sessie-van-vandaag-kaart** — eyebrow "VANDAAG · SESSIE" + "FTP 250W". Bij intervalsessie: titel "Sweet Spot Intervallen", metrics (Duur 1u 02m · TSS 78 · Blokken 4×6m), mini-intervalgrafiek (zie grafiek-spec) met zone-legenda Z1–Z5. CTA "Start sessie" (full-width, slate-zwart pil). Bij niet-interval: titel "Rustige Duurrit · Zone 2", metrics 2u 00m / TSS 95 / 68% van FTP, en een effen gradient-balk met korte uitleg i.p.v. blokjes.
8. **Slate AI-insight-kaart** — donker contrast-element. Logo-blokje "P" (gradient) + eyebrow "AI-INZICHT", body in mensentaal, twee mini-tiles (+6% HRV, 48 bpm rustpols).

**Bottom-nav** (78px, vast): 3 tabs **Dashboard · Schema · Voortgang**, elk icoon + label. Actieve tab = tekstkleur primair `#2E2A24` (label 800), inactief = `#9E988C` (label 700). Op Home is **Dashboard** actief.

### 2. Workout-detail
**Doel:** het vermogensprofiel van één geplande sessie tonen en uitleggen waarom hij nu gepland is.

**Layout (top → bottom):**
1. **Statusbalk** (zelfde als Home).
2. **Dag-strip (dag-navigatie)** — een **horizontaal scrollbare rij dag-tiles** (elk 52px breed, radius 18px) i.p.v. losse chevrons. Vast venster van **21 dagen**: 10 terug → vandaag → 10 vooruit (niet verder scrollbaar). Bij openen **gecentreerd op de geselecteerde dag**, met gisteren/morgen direct links/rechts ernaast; tikken op een tile centreert die dag opnieuw (smooth). Elke tile: dag-afkorting (Nunito 800, 10px) boven, datumnummer (Fredoka 20px) eronder, en onderaan een **6px mode-stipje** dat in één oogopslag toont wat er die dag is gebeurd of gepland staat:
   - groen `oklch(0.6 0.13 165)` = gematcht · amber `oklch(0.72 0.13 70)` = afgeweken · blauw `oklch(0.55 0.07 215)` = ongeplande rit · grijs `oklch(0.72 0.015 75)` = gemist · mint `oklch(0.74 0.05 200)` = gepland (toekomst) · leeg/transparant = rustdag.
   - **Geselecteerde tile**: slate-zwarte vulling `oklch(0.24 0.012 70)` met lichte tekst (zelfde nadruk als de oude Vandaag-pill). **Vandaag-zonder-selectie**: 1.5px blauwe rand `oklch(0.78 0.07 220)`. Overige tiles: neutraal/transparant. Tikken selecteert de dag en **update de hele weergave eronder** naar de bijbehorende staat (planned / rest / matched / deviated / unplanned / missed).
   - *Implementatie:* aangestuurd door de `modes`-array (21 entries) + `select(idx)` in het `class Component`-blok; auto-centreren via `centerStrip()` in `componentDidMount`/`componentDidUpdate`.
3. **TSS-weekkaart** (radius 24px, compact — direct onder de dag-strip) — eyebrow "TSS DEZE WEEK" links + "**210** / 420" rechts (huidig in Fredoka 19px), daaronder een dunne 8px gradient-voortgangsbalk (`width:50%`, blauw→mint). **Blijft ongewijzigd zichtbaar ongeacht welke dag je bekijkt** (ook in de rust-staat). Bewust géén ring — dat is het signature-element van Home.
4. **Titelblok** — een eyebrow-rij met links "SWEET SPOT · ZONE 3–4" en **rechts uitgelijnd een outline-pil "✎ Aanpassen"** (transparant, 1.5px rand `#E8E3D9`, potlood-icoon — zelfde secundaire-actie-pil-stijl als elders). Daaronder H1 "2 sets sweetspot met versnelling" (Nunito 800, 28px).
4. **Kerngetallen** — 3 tiles naast elkaar (radius 18px, witte kaart, rand): **Duur 1u 08m · TSS 82 · Gem. vermogen 214w** (de "w" kleiner, secundair). Cijfers in Fredoka 27px — zelfde behandeling als Home-metrics.
5. **Intervalgrafiek-kaart** (radius 28px) — kern van het scherm. Zie grafiek-spec hieronder. Bevat: eyebrow "VERMOGENSPROFIEL" + "FTP 250W"; de grafiek (170px hoog); tijd-as (0:00 / 0:17 / 0:34 / 0:51 / 1:08); zone-legenda Z1–Z5.
6. **Segment-overzicht** — eyebrow "OPBOUW" (links) + "FTP 250W" (rechts), daaronder **verticaal gestapelde, volle-breedte kleurblokken** (radius 20px) i.p.v. de oude compacte lijst-rijen. Elk blok is een vol zone-kleurvlak (Z1–Z5, verdiept t.o.v. de legenda-tokens zodat witte tekst contrast houdt) met witte tekst:
   - **Titel** = segment-type (Fredoka 19px) — bv. "Warming-up", "Tempo", "VO2max", "Herstel", "Cooldown".
   - **Twee-koloms-rij** eronder: links **RPE** als range (bv. "6–7"), rechts **Totale tijd** (Fredoka 20px, label Nunito 800/9.5px in wit op 74% opacity).
   - **Dunne scheidingslijn** (1px, wit 24%) → daaronder **Vermogen** als watt-range, afgeleid uit de bestaande ±5%-rangeberekening (`wattRange(pct)` → ±5% rond `FTP·pct%`, afgerond op 5W).
   - **Herhaalde sets visueel gegroepeerd:** een set is een opeenvolging van **verschillende** blokken die samen N× herhaalt (bv. Tempo → VO2max → Herstel, 3×). De blokken van zo'n set worden ingesprongen en omsloten door een **dunne haak-bracket** (spine + boven/onder-cap, charcoal 20%), met een ronde witte **badge ("3×")** verticaal gecentreerd op de bracket. Losse blokken (Warming-up, Cooldown) blijven volle breedte zonder bracket.
   - *Implementatie:* aangestuurd door de `planSets`-array (`{reps, blocks:[blockDef(...)]}`) → `blockGroups` in het `class Component`-blok; `blockBg` mapt zone → verdiepte vulkleur.
   - Voorbeeld-opbouw: Warming-up (Z2, 16:00) · **3× [Tempo Z4 6:00 · VO2max Z5 3:00 · Herstel Z1 4:00]** · Cooldown (Z1, 9:00).
7. **Slate "WAAROM VANDAAG"-kaart** — zelfde stijl als de insight-kaart op Home, maar inhoudelijk de onderbouwing in geruststellende toon, gekoppeld aan herstel: body legt uit dat TSB +8 in de "zoete zone" zit; twee mini-tiles ("+8 TSB · vorm vandaag", "Goed · Herstelstatus"). Sluit af met een geruststellende opt-out ("Voelt het zwaar? Laat de laatste versnelling gerust vallen.").
8. **Sticky CTA** — boven de nav, met fade-gradient erachter: "▶ Start workout" (full-width pil) in de **groene merk-statuskleur** (`oklch(0.55 0.13 163)`, mintgroen) i.p.v. slate-zwart, met lichte tekst en een groene schaduw-glow. **Verborgen in de rust-staat.**
9. **Bottom-nav** — identiek aan Home; hier is **Schema** de actieve tab.

#### Rust- / geen-sessie-staat (Workout-detail)
Wanneer de bekeken dag geen training heeft (bewuste rustdag óf dag zonder geplande sessie) vervangt deze staat de **kerngetallen + intervalgrafiek + segmenten + onderbouwing**. Statusbalk, dag-navigatie, TSS-weekkaart en bottom-nav blijven staan; de sticky Start-knop verdwijnt.
- **Gecentreerde, ruime lay-out** (min-hoogte ~440px, verticaal en horizontaal gecentreerd) zodat het ontbreken van data niet leeg aanvoelt.
- **Rust-icoon** — hergebruik van het Home-patroon, vergroot: 90px lichte cirkel (`oklch(0.97 0.012 84)`) met 1.5px rand + horizontaal streepje (32×5px, `oklch(0.68 0.015 75)`).
- **Titel** "Rustdag" (Nunito 800, 26px) + subtitel "Herstel · geen sessie gepland".
- **Ondersteunend kaartje** (witte kaart, radius 24px, max-breedte 306px) met een geruststellende zin in merk-toon over waarom rust de bedoeling is.

#### Verleden-dag-staten (Workout-detail)
Wanneer de bekeken dag in het verleden ligt en/of er een voltooide rit bestaat, vervangen onderstaande staten de standaard geplande-sessie-weergave. Statusbalk, dag-strip, TSS-weekkaart en bottom-nav blijven staan; de sticky Start-knop verdwijnt. Het mode-stipje van de bijbehorende tile in de dag-strip toont de staat al (groen / amber / blauw / grijs). Aangestuurd door de `modes`-array (`matched` / `deviated` / `unplanned` / `missed`, naast `planned` / `rest`).

**a. Gematcht — "Uitgevoerd zoals gepland"** (uitgevoerd zoals bedoeld):
- **Groene statusbanner** (bg `oklch(0.955 0.04 162)`, rand `oklch(0.84 0.07 162)`): groen vinkje-cirkeltje + "Uitgevoerd zoals gepland" + subtekst "Goede match met je geplande sessie".
- Titelblok als de geplande sessie (géén Aanpassen-pil op verleden dagen).
- **Kerngetallen werkelijk vs. plan**: 3 tiles, elk met het **werkelijke** cijfer groot (Fredoka 23px) + label + een kleine regel "plan …" eronder (Duur 1u 10m / plan 1u 08m · TSS 85 / plan 82 · 218w / plan 214w).
- **Grafiek "GEPLAND vs GEREDEN"**: de bestaande geplande staven op `opacity:0.4` + een **werkelijk-gereden lijn eroverheen** (SVG-polyline, charcoal `oklch(0.3 0.02 70)`, non-scaling-stroke, lichte fade richting einde = vermoeidheid). Legenda onderaan: gedempt staafje "Gepland" + lijn-swatch "Gereden".
- **Slate recap-kaart "ZO GING HET"** (zelfde stijl als de WAAROM VANDAAG-kaart) met een korte terugblik in merk-toon.

**b. Afgeweken — "Andere rit gereden dan gepland"** (rit gedaan, ander type/intensiteit):
- **Amber statusbanner** (bg `oklch(0.96 0.05 82)`, rand `oklch(0.85 0.08 78)`): waarschuwings-driehoek-icoon + "Andere rit gereden dan gepland" + subtekst "Telt gewoon mee voor je belasting" (géén rood/alarm).
- **Gepland-vs-gereden type naast elkaar**: links een gestreept "GEPLAND"-tegeltje (Sweet spot · Zone 3–4, gedempt), een pijl ertussen, rechts een amber "GEREDEN"-tegeltje (Duurrit · Zone 2).
- **Werkelijke kerngetallen** (3 tiles, géén plan-vergelijking want ander type): 1u 32m · 96 TSS · 178w.
- **Grafiek "GEREDEN VERMOGENSPROFIEL"**: het **werkelijke** profiel als staven (rustige Z2-duurrit) i.p.v. het geplande, met eigen tijd-as en zone-legenda Z1–Z5.

**c. Gemist — "Geen rit gevonden voor deze sessie"** (geplande sessie zonder gematchte rit):
- **Rustige, niet-bestraffende staat** in dezelfde toon als de rustdag-staat — gecentreerd, ruim, géén rood. Gedempt rust-icoon (90px cirkel met **gestreepte** rand + horizontaal streepje).
- Titel "Geen rit gevonden voor deze sessie" + subtekst "Geen probleem — een gemiste sessie hoort erbij".
- **"STOND GEPLAND"-kaartje** dat toont wát er gepland stond (Sweet spot · Zone 3–4 · 1u 08m · 82 TSS, gedempt), + een geruststellende afsluiter dat het plan zich automatisch aanpast.

**d. Ongeplande rit — "Ongeplande rit"** (dag zonder geplande sessie, wél een voltooide rit):
- **Neutrale statusbanner** (lichte kaart, rand) met fiets-icoon + "Ongeplande rit" + subtekst "Geen sessie ingepland · rit toegevoegd" — neutraal, niet groen/amber.
- Eyebrow "GEDETECTEERD · ZONE 3" + H1 met het **gedetecteerde rittype** ("Tempo rit").
- **Werkelijke kerngetallen** (3 tiles): 58m · 71 TSS · 205w — **géén plan-vergelijking**.
- **Grafiek "GEREDEN VERMOGENSPROFIEL"**: het werkelijke profiel als staven (tempo, Z3) met zone-legenda.

### 3. Voortgang
**Doel:** laten zien hoe vorm, fitheid en vermogen zich over de afgelopen weken ontwikkelen. **Volledig licht thema — géén donkere insight-kaart op dit scherm.**

**Layout (top → bottom):**
1. **Statusbalk** (zelfde als de andere schermen).
2. **Header** — eyebrow "JOUW ONTWIKKELING" + H1 "Voortgang" (Nunito 800, 24px); rechts een periode-selector-pil "8 weken ▾" (witte kaart-pil met rand).
3. **Hero — CTL/ATL/TSB-lijngrafiek** (kaart, radius 28px). Zie grafiek-spec hieronder. Kop: eyebrow "FITHEID & VERMOEIDHEID", grote CTL-waarde (Fredoka 38px) + trend-tekst "CTL ↑ +9 / 8wk" in groen, en rechts een status-badge "● Opbouwend". Onder de grafiek een legenda met drie items: CTL (dik gradient-staafje), ATL (dun grijs streepje), TSB (klein gevuld mint-blokje = band).
4. **FTP-kaart** (radius 28px, rij-layout). Links: eyebrow "HUIDIGE FTP" + groot getal **250 W** (Fredoka 56px — zelfde zware behandeling als de Home-metrics) + trend-indicator-pil: groene chip met omhoog-pijl en "+8W", gevolgd door "deze maand". Rechts (rechts-uitgelijnd): twee secundaire stats — "3.6 W/KG" en "14 mei · LAATSTE TEST".
5. **Power curve — secundaire sectie** (kaart, radius 28px). Eyebrow "POWER CURVE" + subtitel "Beste vermogen per duur · 90 dagen"; rechts mini-legenda "Nu" (gradient) vs "Vorig" (grijze stippellijn). Daaronder de power-curve-grafiek (zie spec), een x-as met duur-labels (5s, 30s, 1m, 3m, 5m, 10m, 20m, 60m) en drie highlight-tiles (5s piek 1180w · 1 min 412w · 5 min 288w).
6. **Bottom-nav** — identiek aan de andere schermen; hier is **Voortgang** de actieve tab.

### 4. Wizard stap 2 — Beschikbaarheid
**Doel:** in de seizoensdoel-setup vastleggen op welke dagen de gebruiker traint en hoeveel tijd er per dag is. Eén stap in een 3-staps flow (géén bottom-nav — dit is een wizard).

**Layout (top → bottom):**
1. **Statusbalk.**
2. **Header-rij** — links terug-chevron (ronde knop); midden "Stap 2 van 3"; rechts "Overslaan" (teal tekstlink).
3. **Voortgangsbalk** — 3 gelijke segmenten met 6px hoogte: segment 1 = slate-zwart (voltooid), segment 2 = blauw→mint gradient (actief), segment 3 = licht (`#E5E0D6`).
4. **Titelblok** — eyebrow "SEIZOENSDOEL · BESCHIKBAARHEID", H1 "Wanneer kun je trainen?" (Nunito 800, 27px), subtitel in geruststellende toon ("… Je kunt dit later altijd aanpassen.").
5. **Dag-lijst** (scrollbaar) — 7 dagkaarten **Di t/m Ma** (Di, Wo, Do, Vr, Za, Zo, Ma). Zie dag-kaart-spec hieronder.
6. **Footer** (vast, witte kaartrand-bovenlijn) — links "{n} trainingsdagen", rechts "{totaal} uur / week" (live afgeleid). Daaronder twee knoppen: **Terug** (outline-pil) en **Volgende** (slate-zwarte pil, full-width-rest, met pijl-icoon).

### 6. Schema (weekoverzicht)
**Doel:** het trainingsschema van de huidige week tonen — fase, weekbelasting (TSS) en een dag-voor-dag lijst — als de actieve **Schema**-tab in de bottom-nav.

**Layout (top → bottom), scrollbaar tussen statusbalk en bottom-nav:**
1. **Statusbalk** (zelfde als de andere schermen).
2. **Header** — eyebrow met huidige fase "OPBOUW · WEEK 6 VAN 12"; daaronder H1 "Deze week" (Nunito 800, 28px) links + datumbereik "15 – 21 jun" rechts.
3. **TSS-voortgangskaart** (radius 28px) — eyebrow "TSS DEZE WEEK" links, "**210** / 420" rechts (huidig in Fredoka 22px). Daaronder een **dunne voortgangsbalk** (9px hoog, radius 999px): spoor `#E8E3D9`, vulling = blauw→mint merk-gradient op `width: 50%`. Bewust **géén ring** — de ring is het signature-element van Home. Onder de balk: "50% van je weekdoel" links + "210 TSS te gaan" rechts (in groen `#2F9468`).
4. **Secundaire-actie-rij** — eyebrow "5 SESSIES · 2 RUST" links; rechts een **outline-pil** "✎ Beschikbaarheid aanpassen" (transparant, 1.5px rand `#E8E3D9`, edit-icoon) → navigeert naar scherm 5 (Beschikbaarheid aanpassen). Zelfde pil-stijl als secundaire acties elders.
5. **Daglijst** — 7 dagen **Ma → Zo** als verticale lijst (gap 10px). Zie dag-kaart-spec hieronder. Patroon: Ma sessie (done), Di sessie (done), Wo rust, **Do = vandaag (sessie)**, Vr sessie, Za sessie, Zo rust.
6. **Bottom-nav** — identiek aan de andere schermen; hier is **Schema** de actieve tab.

#### Dag-kaart-spec (Schema)
Twee varianten, beide radius 24px:

**Sessie-dag** (tapbare witte kaart, `cursor:pointer`; **tikken navigeert naar Workout-detail**):
- **Dag/datum-kolom** (links, 38px breed): dag-afkorting in hoofdletters (Nunito 800, 10.5px) boven het datumnummer (Fredoka 22px). Bij vandaag krijgt de afkorting een blauwe tint (`oklch(0.5 0.13 230)`).
- **Zone-staafje** (4px breed, 40px hoog, radius 3px) in de zone-kleur van de sessie (zelfde Z1–Z5-palet als de intervalgrafiek).
- **Hoofdtekst:** sessietitel (Nunito 700, 15px, ellipsis bij overflow); daarnaast bij vandaag een slate-pil-tag "VANDAAG". Eronder een metrics-rij: klein zone-blokje + zone-label (bv. "Z3") + "{duur} · {tss} TSS".
- **Status (rechts):** voltooide dag = groen cirkeltje (24px, `#3FA877`) met wit vinkje; geplande/vandaag = grijze chevron-rechts.
- **Vandaag-accent (subtiel, géén felle highlight):** lichte blauwe tint-achtergrond `oklch(0.975 0.02 215)` + 1.5px rand `oklch(0.78 0.07 220)`. Overige sessie-dagen: kaart-achtergrond `#FCFAF6` + 1px rand `#E8E3D9`.

**Rustdag** (niet-tapbaar): transparante achtergrond, 1.5px **gestreepte** rand `#E2DCD0`. Dag/datum-kolom in gedempte kleuren; in plaats van het zone-staafje het **rust-icoon van Home** (36px lichte cirkel met rand + 13×3px horizontaal streepje `#A8A296`); label "Rustdag" + subtekst "Herstel · geen sessie gepland".

**Voorbeelddata (week):**
- Ma 15 — Tempo Duurrit — Z3 — 1u 15m · 90 TSS — *voltooid*
- Di 16 — VO2max Intervallen — Z5 — 1u 05m · 120 TSS — *voltooid*
- Wo 17 — Rustdag
- Do 18 — Sweet Spot Intervallen — Z4 — 1u 02m · 78 TSS — *vandaag*
- Vr 19 — Herstelrit — Z1 — 45m · 32 TSS — *gepland*
- Za 20 — Lange Duurrit — Z2 — 2u 15m · 100 TSS — *gepland*
- Zo 21 — Rustdag

(De TSS-voortgang 210/420 = som van de twee voltooide dagen t.o.v. het weekdoel.)

### 5. Beschikbaarheid aanpassen (standalone)
**Doel:** dezelfde dag/uren-instelling kunnen wijzigen buiten de wizard om, bereikbaar vanuit het Home-scherm (bv. via de weekstrip of een instelling).

**Layout:** identiek aan de wizard, maar:
- **Header** — terug-chevron links, gecentreerde titel "Beschikbaarheid", géén stap-teller/overslaan, géén voortgangsbalk.
- **Titelblok** — eyebrow "JOUW TRAININGSWEEK", H1 "Beschikbaarheid aanpassen".
- Dezelfde 7-dagen dag-lijst (Di t/m Ma).
- **Footer** — zelfde samenvattingsregel, met één full-width **Opslaan**-knop (slate-zwarte pil) i.p.v. Terug/Volgende.
- **Geen bottom-nav** (sub-/modaal scherm).

#### Dag-kaart-spec (gedeeld door scherm 4 & 5)
Elke dag is een tapbare witte kaart (radius 20px, kaartrand). **Tikken op de kaart zet de dag aan/uit.**
- **Indicator (links, 42px cirkel):** aan = gevulde blauw→mint gradient-cirkel met de 2-letter dag-afkorting in wit (zelfde vocabulaire als de Home-weekstrip); uit = lichte cirkel met rand + klein horizontaal "rust"-streepje.
- **Label:** volledige dagnaam (Nunito 700, 16px) + status eronder — aan = "Trainingsdag" (groen), uit = "Rustdag" (grijs).
- **Toggle (rechts):** pil-switch 48×28px — aan = slate-zwarte track, knop rechts; uit = grijze track, knop links.
- **Uren-stepper (alleen bij actieve dag):** verschijnt als sub-rij onder een scheidingslijn. Label "Beschikbare tijd" + stepper: ronde −-knop (licht), waarde in Fredoka 22px ("1,5 uur", Nederlandse komma-notatie) en ronde +-knop (slate-zwart). Stap = 0,5 uur, bereik 0,5–6 uur. De +/−-knoppen gebruiken `stopPropagation` zodat ze niet de dag-toggle triggeren.

**State:** elke dag = `{ key, full, on: boolean, hours: number }`. Afgeleid: aantal actieve dagen en som van uren (live in de footer). In de echte app: persisteer dit als de beschikbaarheids-instelling van de atleet; het schema-algoritme gebruikt het om sessies over de week te verdelen.

---

## Intervalgrafiek-spec (Zwift/TrainerRoad-stijl) — belangrijkste component

Een rij staven, bodem-uitgelijnd (`align-items: flex-end`), 1.5–2px tussenruimte.

- **Breedte van een staaf = duur** van dat interval. Implementatie: elke staaf krijgt `flex-grow = minuten`, `flex-basis: 0` → breedtes verhouden zich automatisch naar duur. (In een native/flex-omgeving: gebruik gewogen flex of bereken px-breedte uit totale duur.)
- **Hoogte van een staaf = vermogen t.o.v. FTP.** Schaal: top van de grafiek = **130% FTP** (`maxScale`). Hoogte% = `(%FTP / 130) * 100`, met een minimum van ~6% zodat lage blokken zichtbaar blijven.
- **Kleur = trainingszone**, bepaald door %FTP volgens de grenzen in de zone-tabel (Z1 <56, Z2 56–75, Z3 76–90, Z4 91–106, Z5 >106).
- **Warm-up en cooldown zijn geleidelijk oplopende/aflopende trapjes**, géén vlakke blokken. Warm-up: 5 staafjes 45→52→58→64→70% (elk ~1.6 min). Cooldown: 5 staafjes 66→60→54→48→42% (elk ~1.4 min).
- **FTP-referentielijn** op 100%: horizontale **gestreepte** lijn (`1.5px dashed #8B8579`) over de volle breedte, op `bottom: (100/130)*100% ≈ 76.9%` van de grafiekhoogte. Label "FTP 100%" rechts, op een klein chip-vlakje in kaartkleur zodat het leesbaar over de lijn valt.

**Profiel-data van de detailsessie (raw, in volgorde):**
- Warm-up: 5× ~1.6m → 45, 52, 58, 64, 70%
- Set 1 (3×): 3.5m @ 90% → 0.5m @ 112% → (tussen herhalingen) 1m @ 55%
- Mid-recovery: 4m @ 50%
- Set 2 (3×): 3.5m @ 91% → 0.5m @ 114% → (tussen herhalingen) 1m @ 55%
- Cooldown: 5× ~1.4m → 66, 60, 54, 48, 42%

De korte versnellingen (112–114%) zijn de enige staven boven de FTP-lijn (Z5-kleur) en pieken zichtbaar uit.

---

## Interactions & Behavior
- **Filter-pills (Home):** selecteerbaar; actieve pil = slate-zwart, rest transparant. Wisselt de getoonde tijdspanne (gedrag te bepalen door codebase; in mockup statisch).
- **Sessie-kaart / "Start sessie" / "Start workout":** navigeert naar de actieve-workout-flow (buiten scope van deze twee schermen).
- **Terug-knop (detail):** terug naar Home/Schema.
- **Bottom-nav:** wisselt tussen Dashboard / Schema / Voortgang.
- **Status-afhankelijke weergave (Home):** de hele bovenkant (headline-tekst + kleur, ringkleur + vulgraad, badge-label, alle CTL/ATL/TSB-getallen) wordt afgeleid van één `status`-waarde (`good | caution | careful | rest`). Implementeer dit als één bron van waarheid die de afgeleide waarden levert.
- Geen complexe animaties vereist; een ring-vul-animatie bij binnenkomst is een mooie-maar-optionele toevoeging (ease-out, ~600ms).

## State Management
- `status: 'good' | 'caution' | 'careful' | 'rest'` → drijft headline, ring, badge en metrics op Home.
- `athleteName: string` (default "Frank") → voornaam in headline + avatar-initiaal.
- `isIntervalSession: boolean` → bepaalt of de Home-sessiekaart de blokjesgrafiek of de effen Zone-2-variant toont.
- `selectedFilter` (Home pills), `period` (Voortgang-selector, bv. 6/8 weken) en `activeTab` (bottom-nav) → lokale UI-state.
- In de echte app komen CTL/ATL/TSB, HRV, rustpols, FTP-historie, power curve en het workout-profiel uit de trainingsdata-backend; in de mockup zijn ze hardcoded.

## Assets
- **Fonts:** Nunito en Fredoka via Google Fonts. Vervang door de equivalente fonts/links in de codebase, of bundel ze lokaal.
- **Iconen:** alle iconen zijn inline-SVG in de bestanden (dashboard-grid, kalender, staafdiagram voor nav; chevron, 3-puntjes, play). Vervang door de icon-library van de codebase (bv. Lucide/SF Symbols) met dezelfde betekenis.
- **Geen rasterafbeeldingen of logo-bestanden** — het "P"-logo is een gradient-vierkant met letter.

## Power curve & trendgrafiek-spec (Voortgang)

Beide grafieken zijn inline-SVG, opgebouwd in `renderVals()` (functie `linePath()` bouwt de paden). Neem die berekeningen over of herbouw ze met de chart-library van de codebase.

### CTL/ATL/TSB-hero (8 weekpunten)
- **CTL** = dikke lijn (~5px), gevuld met de blauw→mint merk-gradient (links→rechts), `stroke-linecap/linejoin: round`, met een ronde eindpunt-dot (witte vulling, mint-rand) op het laatste punt.
- **ATL** = dunnere lijn (~2px), neutraal grijs (`oklch(0.58 0.02 75)`).
- **TSB** = **gevulde band tussen CTL en ATL** (géén derde losse lijn): een gesloten `path` langs CTL heen en ATL terug, gevuld met een verticale mint→blauw gradient op lage opacity (~0.4 → 0.15). Dit visualiseert vorm = fitheid − vermoeidheid.
- Lichte horizontale gridlijnen (`oklch(0.92 0.012 82)`), week-labels onderaan (w1…w7, "nu" benadrukt). Y-schaal automatisch: min/max van alle CTL+ATL-waarden met ~6 marge.
- Voorbeelddata: CTL `[53,55,54,57,59,58,61,62]`, ATL `[58,64,50,66,71,55,68,57]`.

### Power curve (secundair, zelfde lijnstijl)
- **Huidig** = gradient-lijn (~4px, zelfde blauw→mint) met een zachte area-fill eronder (zelfde gradient, opacity ~0.22 → 0.02).
- **Vorig** = grijze stippellijn (`stroke-dasharray: 4 4`).
- 8 duur-buckets op de x-as (5s…60m). Y-schaal van ~150W tot piek+marge. Voorbeelddata huidig `[1180,720,412,330,288,250,232,210]`, vorig `[1120,690,392,312,272,238,222,202]`.
- Let op: dit is een vereenvoudigde lineaire x-as. In productie is een logaritmische tijd-as gebruikelijker voor power curves — overweeg dat als de chart-library het ondersteunt.

## Files
- `Pedalytics Home.dc.html` — Home/Dashboard-scherm (referentie).
- `Pedalytics Workout.dc.html` — Workout-detailscherm (referentie, interactief: dag-chevrons wisselen label + training/rust-staat). De dagen-array + zone-/grafiek-logica staan in het `class Component`-blok onderaan.
- `Pedalytics Progress.dc.html` — Voortgang-scherm (referentie).
- `Pedalytics Wizard Beschikbaarheid.dc.html` — Wizard stap 2 (referentie, interactief).
- `Pedalytics Beschikbaarheid Aanpassen.dc.html` — Standalone bewerkscherm (referentie, interactief).
- `Pedalytics Schema.dc.html` — Schema-weekoverzicht (referentie). De week-/TSS-/zone-data + navigatie staan in het `class Component`-blok onderaan.
- `screenshots/` — PNG per scherm.

> Alle bestanden zijn zelfstandig in een browser te openen om de live-look en interacties te bekijken. De grafiek-, status- en toggle-logica (kleurfuncties, profiel-data, SVG-paden, state) staat in het `class Component`-blok onderaan elk bestand — dat is de beste plek om de exacte berekeningen over te nemen.
