# Welke ritten zitten achter de decoupling-clamp van -1,0 (score 12 juli)?

Geen codewijziging — live data opgehaald via een tijdelijk (verwijderd) testbestand, exact volgens
de logica in `sync/route.js`. 580/580 tests slagen.

## 1. `normaliseerDecoupling()` — exacte formule (`src/lib/conditie.js:51-55`)

```js
export function normaliseerDecoupling(mediaan_huidig, mediaan_vorig) {
  if (mediaan_vorig == null) return 0;
  const verbetering = (mediaan_vorig - mediaan_huidig) / mediaan_vorig;
  return Math.max(-1, Math.min(1, verbetering * 4));
}
```
`verbetering = (mediaan_vorig − mediaan_huidig) / mediaan_vorig`, vervolgens **×4** en geclamped op
[-1, 1]. De clamp-vloer (-1) wordt bereikt zodra `verbetering ≤ -0,25` — dus **ja, 25% is correct**,
maar let op: dit is 25% van `mediaan_vorig`, niet een vaste absolute drempel. Bij een `mediaan_vorig`
dicht bij nul (zoals hieronder blijkt) is dat percentage-mechanisme instabiel — zie stap 5.

## 2-3. De pool en de rit-gebaseerde indeling

Kwalificerende ritten (cache-key `decoupling:{id}` bestaat → dus al gefilterd op duur ≥45 min en IF
0,55-0,75 op het moment van cachen, `sync/route.js:396-400`) uit de laatste 60 dagen, chronologisch,
exact zoals het idempotente pad in `sync/route.js` het opbouwt: **11 kwalificerende ritten** tussen
23 mei en 11 juli. De "laatste 3" en "3 daarvoor" zijn de laatste 6 in die rit-volgorde — niet de
laatste 6 kalenderdagen.

## 4. De 6 ritten

| # | Datum | Naam | Duur | IF | Decoupling | Hitte-vlag |
|---|---|---|---|---|---|---|
| **Vorige 3** | | | | | | |
| 1 | 2026-06-25 | Cycling | 107 min | 0,626 | **+0,38%** | nee |
| 2 | 2026-06-27 | Cycling | 170 min | 0,670 | **-1,98%** | nee |
| 3 | 2026-07-01 | Cycling | 60 min | 0,685 | **+19,98%** | nee |
| **Laatste 3** | | | | | | |
| 4 | 2026-07-02 | Cycling | 122 min | 0,696 | **-0,32%** | nee |
| 5 | 2026-07-07 | Cycling | 207 min | 0,667 | **+4,05%** | nee |
| 6 | 2026-07-11 | Cycling | 93 min | 0,681 | **+2,85%** | nee |

Geen van deze 6 heeft de hitte-vlag aan (bevestigt de code-comment "GEEN filter, spec 32-F" is hier
sowieso irrelevant — er wás toch geen hitte-correctie op deze 6). Ter referentie, **buiten** de
6-ritten-pool (dus niet in de berekening): de rit van 23 juni ("Afgebroken rondjes zijn ook
rondjes", 72 min, decoupling +16,7%, **wel** hitte-gecorrigeerd) — de naam suggereert een
afgebroken/onderbroken rit, letterlijk zo genoemd door de gebruiker zelf in de ritnaam; ik trek daar
verder geen conclusie uit, dat is wat er in de data staat.

## 5. Medianen en procentuele verandering

- `mediaan_vorig` (rit 1-3, gesorteerd: -1,98 / +0,38 / +19,98) = **0,38%**
- `mediaan_huidig` (rit 4-6, gesorteerd: -0,32 / +2,85 / +4,05) = **2,85%**

```
verbetering = (0,38 − 2,85) / 0,38 = -6,498  (dus -650%, niet -65% of -25%)
verbetering × 4 = -25,99
genormaliseerde score = clamp(-25,99, -1, 1) = -1,0
```

**Bevestigd: dit leidt inderdaad tot de -1,0-clamp** — maar met een enorme marge, niet "net
eroverheen". De reden is dat `mediaan_vorig` (0,38%) extreem dicht bij nul ligt: een verschil van
slechts 2,47 procentpunt decoupling (0,38% → 2,85%, op zich een relatief bescheiden en niet
ongewone schommeling voor deze metriek) wordt door de percentage-formule opgeblazen tot -650%,
simpelweg omdat je door een getal vlak bij nul deelt. Dit is geen fout in de eerdere analyse (de
clamp wordt terecht geraakt), maar wel een kwetsbaarheid in `normaliseerDecoupling()`: bij een
mediaan_vorig dicht bij 0% (wat voor deze metriek normaal is — decoupling schommelt doorgaans rond
0-10%) kan een kleine absolute verandering al tot de volle -1-clamp leiden, ongeacht of die
verandering fysiologisch betekenisvol is.
