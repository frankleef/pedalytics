# Decoupling-normalisatie: fix (nog niet toegepast) + backtest

Vervolg op `decoupling-clamp-verificatie.md`. **Geen enkele wijziging is momenteel actief in de
code** — alle diffs hieronder zijn tijdelijk toegepast, getest, en direct teruggedraaid (geverifieerd
met `git diff` — leeg). 580/580 tests slagen in de huidige, ongewijzigde staat.

---

## Deel A — de fix

### 1. Gevonden vindplaatsen (geciteerd, niet aangenomen)

Vier plekken, stuk voor stuk gecontroleerd:

**`src/lib/conditie.js:51-55`** — de normalisatiefunctie zelf:
```js
export function normaliseerDecoupling(mediaan_huidig, mediaan_vorig) {
  if (mediaan_vorig == null) return 0;
  const verbetering = (mediaan_vorig - mediaan_huidig) / mediaan_vorig;
  return Math.max(-1, Math.min(1, verbetering * 4));
}
```

**`src/app/api/cron/sync/route.js:223-235`** (idempotent pad):
```js
if (dcAlleWaarden.length >= 3) dcHuidigUp = dcAlleWaarden.slice(-3).sort((a,b)=>a-b)[1];
if (dcAlleWaarden.length >= 6) dcVorigUp = dcAlleWaarden.slice(-6, -3).sort((a,b)=>a-b)[1];
```

**`src/app/api/cron/sync/route.js:537-539`** (hoofdpad, nieuwe activiteit):
```js
const dcHuidig = dcAlleWaarden.length >= 3 ? dcAlleWaarden.slice(-3).sort((a,b)=>a-b)[1] : null;
const dcVorig = dcAlleWaarden.length >= 6 ? dcAlleWaarden.slice(-6, -3).sort((a,b)=>a-b)[1] : null;
```

**`src/app/api/admin/herbereken-conditiescore/route.js:39-40`**:
```js
const dcHuidig = dcWaarden.length >= 3 ? dcWaarden.slice(-3).sort((a, b) => a - b)[1] : null;
const dcVorig = dcWaarden.length >= 6 ? dcWaarden.slice(-6, -3).sort((a, b) => a - b)[1] : null;
```

`src/app/api/debug/conditiescore-historie/route.js` geeft altijd `decoupling_huidig: null,
decoupling_vorig: null` mee (al vastgesteld in `pill-label-verificatie.md`) — geen eigen
berekening, dus niets te fixen daar. De heat-fallback-melding (`laatste6`, regel 542-548 in
sync/route.js) is een **apart** mechanisme (>50%-hitte-waarschuwing, niet de mediaanvergelijking
zelf) — bewust **niet** aangepast, buiten scope van deze vraag.

### 2-3. Voorgestelde diff (getest, direct teruggedraaid — niet actief)

```diff
 export function normaliseerDecoupling(mediaan_huidig, mediaan_vorig) {
   if (mediaan_vorig == null) return 0;
-  const verbetering = (mediaan_vorig - mediaan_huidig) / mediaan_vorig;
-  return Math.max(-1, Math.min(1, verbetering * 4));
+  // Absoluut verschil in procentpunten i.p.v. relatief percentage — de relatieve formule deelt
+  // door mediaan_vorig, wat bij waarden dicht bij 0% instabiel is (decoupling-clamp-verificatie.md).
+  // TODO: 5pp voor volledige clamp is een beargumenteerde keuze (gangbare <5%-decoupling-richtlijn
+  // als absolute schaal), geen empirisch geverifieerd optimum.
+  const verbetering_pp = mediaan_vorig - mediaan_huidig;
+  return Math.max(-1, Math.min(1, verbetering_pp / 5));
 }
```

```diff
-  if (dcAlleWaarden.length >= 3) dcHuidigUp = dcAlleWaarden.slice(-3).sort((a,b)=>a-b)[1];
-  if (dcAlleWaarden.length >= 6) dcVorigUp = dcAlleWaarden.slice(-6, -3).sort((a,b)=>a-b)[1];
+  // Venster 5-vs-5 i.p.v. 3-vs-3 — minder gevoelig voor één toevallige uitschieter-rit.
+  if (dcAlleWaarden.length >= 10) {
+    dcHuidigUp = dcAlleWaarden.slice(-5).sort((a,b)=>a-b)[2];
+    dcVorigUp = dcAlleWaarden.slice(-10, -5).sort((a,b)=>a-b)[2];
+  }
```
(identiek patroon voor de twee overige vindplaatsen: `>= 3`/`>= 6` → beide `>= 10`,
`slice(-3)[1]`/`slice(-6,-3)[1]` → `slice(-5)[2]`/`slice(-10,-5)[2]`.)

### 5. Test-impact (getest op de tijdelijk toegepaste wijziging, daarna teruggedraaid)

**`npx vitest run` met alleen de formulewijziging actief: alle 580 tests slagen, inclusief
`conditiescore.test.js`.** Geen enkele test faalt. Maar — dit verdient nuance, geen kale
"geen impact"-conclusie:

`src/lib/__tests__/conditiescore.test.js` gebruikt `decoupling_huidig`/`decoupling_vorig` met
waarden als **`0.03`/`0.06`** (regels 13, 22, 31, 36, 45, 55). De daadwerkelijke productieschaal
(bevestigd in `decoupling-clamp-verificatie.md` en `berekenDecoupling()` in `decoupling.js`, die
`×100` toepast) is **niet** 0,03-0,06 maar bijvoorbeeld 2,85 / 19,98 / 8,8 — hele
procentpunt-getallen, geen fracties.

- De **oude** relatieve formule is schaal-onafhankelijk (`(vorig-huidig)/vorig` is een verhouding),
  dus de tests "werkten toevallig" ondanks de verkeerde schaal — 0,03 vs 0,06 geeft dezelfde ratio
  als 3 vs 6.
- De **nieuwe** absolute formule is dat niet: `(0,06-0,03)/5 = 0,006` (vrijwel nul) i.p.v. wat de
  test kennelijk bedoelde voor te stellen (een betekenisvolle verbetering). De tests **falen niet**,
  omdat de assertions grof zijn (`toBeGreaterThan(0.5)`, met CTL+RPE die dat sowieso al halen) — maar
  ze **testen de decoupling-bijdrage niet langer zinvol**: met de nieuwe formule draagt decoupling in
  deze tests nog maar ~0,001 bij aan de eindscore, ongeacht of het test-scenario "verbetering" of
  "verslechtering" heet.
- **Concreet**: `conditiescore.test.js` regel 13 (`decoupling_huidig: 0.03, decoupling_vorig: 0.06,
  // verbetering`) en regel 22 (`decoupling_huidig: 0.10, decoupling_vorig: 0.04, //
  verslechtering`) zouden bij de nieuwe formule herschreven moeten worden naar realistische
  procentpunt-schaal (bv. 3/6 i.p.v. 0,03/0,06) om nog daadwerkelijk te verifiëren wat de
  testnamen beweren. **Niet zelf gewijzigd**, zoals gevraagd.

Voor de route-level venstergrootte-wijziging (3-vs-3 → 5-vs-5, drempel 6 → 10) bestaat **geen
enkele testdekking** — geen testbestand roept de `slice`-logica in `sync/route.js` of
`herbereken-conditiescore/route.js` aan. Niets breekt, maar er is ook niets dat dit gedrag ooit
verifieerde.

---

## Deel B — backtest tegen de bekende geschiedenis

### Methode

Alle kwalificerende ritten (cache-key `decoupling:{id}` aanwezig) van 25 april t/m 12 juli
opgehaald, live via intervals.icu + KV (zelfde aanpak als eerdere backtests). **11 kwalificerende
ritten gevonden, 23 mei t/m 11 juli** — consistent met `decoupling-clamp-verificatie.md`. Voor elke
rit (chronologisch) is berekend wat de oude (3-vs-3, relatief) en nieuwe (5-vs-5, absoluut pp) score
op dát moment geweest zou zijn, met exact dezelfde formules als hierboven.

### Tabel

| Rit# | Datum | Decoupling deze rit | Oud: vorig/huidig | Oude score | Nieuw: vorig/huidig | Nieuwe score |
|---|---|---|---|---|---|---|
| 1 | 2026-05-23 | 8,80% | — | — (< 6 ritten) | — | — (< 10 ritten) |
| 2 | 2026-05-26 | -2,70% | — | — | — | — |
| 3 | 2026-05-27 | 3,40% | — | — | — | — |
| 4 | 2026-06-20 | -4,10% | — | — | — | — |
| 5 | 2026-06-23 | 16,70%* | — | — | — | — |
| 6 | 2026-06-25 | 0,38% | 3,40 / 0,38 | **+1,0** | — | — |
| 7 | 2026-06-27 | -1,98% | -2,70 / 0,38 | **+1,0** | — | — |
| 8 | 2026-07-01 | 19,98% | 3,40 / 0,38 | **+1,0** | — | — |
| 9 | 2026-07-02 | -0,32% | 0,38 / -0,32 | **+1,0** | — | — |
| 10 | 2026-07-07 | 4,05% | 0,38 / 4,05 | **-1,0** | 3,40 / 0,38 | **+0,604** |
| 11 | 2026-07-11 | 2,85% | 0,38 / 2,85 | **-1,0** | 0,38 / 2,85 | **-0,494** |

\* rit 5 (23 juni) is hitte-gecorrigeerd (`isHitte: true`) maar telt wél mee in deze pool — bevestigt
opnieuw de "GEEN filter, spec 32-F"-comment uit `sync/route.js`, ongewijzigd door deze fix.

Het venster van 10 ritten voor de nieuwe formule wordt pas bij **rit 10** voor het eerst gehaald —
daarvoor levert de nieuwe formule (net als de oude bij <6 ritten) domweg geen signaal
(`null` → gewicht herverdeeld naar CTL/RPE), voor de hele periode 23 mei t/m eind juni.

### Vergelijking met de bekende trend (7% eind mei → 0-4% eind juni/juli)

**Deels bevestigd, deels niet.** Wat wél klopt: de nieuwe formule voorkomt de volle -1,0-clamp op
rit 11 (dezelfde mediaanwaarden 0,38/2,85 geven oud **-1,0**, nieuw **-0,494**) — de instabiliteit
bij een mediaan_vorig dicht bij nul is aantoonbaar verminderd, exact het beoogde effect.

Wat **niet** bevestigd wordt: een "geleidelijk stijgende trend richting +1" is met deze data niet
zichtbaar, om twee redenen. Ten eerste is er door het strengere 10-ritten-minimum maar op **twee
momenten** (rit 10 en 11) überhaupt een nieuwe-formule-score beschikbaar — te weinig punten voor een
trendlijn. Ten tweede laten die twee beschikbare punten juist een **daling** zien (+0,604 → -0,494),
niet een stijging — de twee meest recente ritten (4,05% en 2,85%) liggen hoger dan de mediaan ervoor
(0,38%), dus zowel oud als nieuw registreren op dit moment een verslechtering t.o.v. eind juni,
ondanks dat beide ruim onder de ~7-8% van eind mei blijven. De ruwe 11-ritten-reeks zelf is
grillig (8,8 / -2,7 / 3,4 / -4,1 / 16,7* / 0,38 / -1,98 / 19,98 / -0,32 / 4,05 / 2,85) — geen
schone monotone daling — dus geen enkele mediaanformule op deze data zou vanzelf een gladde
stijgende lijn opleveren.

### Momenten met tegenovergesteld signaal

**Eén duidelijk moment: rit 10 (7 juli).** Oude formule: **-1,0** (volledig geclamped, "sterke
verslechtering"). Nieuwe formule: **+0,604** (duidelijk positief, "verbetering"). Dit is een
regelrechte richtingsomkering, niet alleen een verschil in sterkte — veroorzaakt doordat de oude
3-ritten-vergelijking op dat moment toevallig de twee uitschieters (19,98% op 1 juli en 4,05% op
7 juli zelf) tegen een lage mediaan_vorig (0,38%) afzet, terwijl de nieuwe 5-ritten-vergelijking een
bredere, minder uitschieter-gevoelige set gebruikt waarin de historische verbetering (mediaan_vorig
3,40% → mediaan_huidig 0,38%) nog zichtbaar is.

Op rit 11 geven beide hetzelfde teken (negatief), maar met een groot verschil in sterkte (-1,0 vs
-0,494) — geen tegenovergesteld signaal, wel een gedempt signaal, zoals bedoeld.

### Samenvattend

De fix doet wat hij belooft op het punt van stabiliteit (geen volle clamp meer bij een
mediaan_vorig dicht bij nul, en één aangetoond geval van een complete richtingsomkering tussen oud
en nieuw op rit 10). Maar met slechts 11 kwalificerende ritten sinds eind mei betekent het
strengere 10-ritten-minimum dat het signaal nu voor het grootste deel van de historie **afwezig**
is geweest (null i.p.v. een — soms misleidende — waarde), en de twee momenten waarop het wél
beschikbaar is tonen geen gladde opwaartse trend maar een eigen schommeling, gedreven door
daadwerkelijk grillige onderliggende ritdata.
