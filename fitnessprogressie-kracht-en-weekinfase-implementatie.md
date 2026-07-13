# Fitnessprogressie + kracht-fix + weekInFase-progressie: implementatierapport

Drie delen, drie behandelingen. **Deel B is toegepast** (was al besloten). **Deel A is gebouwd maar
niet gecommit** — nieuwe architectuur, hier ter beoordeling. **Deel C is grotendeels al bestaand
werk gebleken** — niets nieuws toegepast, wel geverifieerd en gesimuleerd tegen het live plan; zie
onderaan waarom. Ik commit zoals gebruikelijk niet zelf (zie eerdere afspraak) — alles hieronder staat
klaar in de working tree voor uw eigen `git add`/`git commit`.

---

## Deel B — kracht_lage_cadans strikt volgens spec (toegepast)

### Wijziging

`src/lib/sessie/weekSolver.js`, `KRACHT_FREQUENTIE.ftp`:

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

De comment erboven is bijgewerkt: verwijst nu naar de beslissing van 13 juli 2026 en naar
`design/IMPLEMENTATIE.md` regels 3056-3070, i.p.v. de vorige, niet-herleidbare "opgegeven door de
gebruiker"-comment.

### Testaanpassingen

Twee bestaande tests in `weekSolver.test.js` gingen uit van `ftp`/`sweetspot` als voorbeeld van een
fase/doel-combinatie waar kracht_lage_cadans wél mag (nodig om het onafhankelijke "vervalt bij 2x
kernstimulus"-mechanisme te testen). Die zijn omgezet naar `klimmen`/`sweetspot` — dat blijft
onveranderd toegestaan, dus het 2x-kernstimulus-mechanisme is nog steeds correct getest, los van de
`ftp`-tabelwijziging.

Nieuw toegevoegd (zoals gevraagd, punt 3):
- `ftp/sweetspot`: kracht_lage_cadans nooit toegewezen, ook niet bij slechts 1x kernstimulus.
- `ftp/drempel`: kracht_lage_cadans nooit toegewezen.
- `ftp/basis`: blijft ongewijzigd toegestaan (1x/2 weken, binnen de frequentiegrens).

### Testresultaat

```
npx vitest run
 Test Files  41 passed (41)
      Tests  606 passed (606)
```

Volledige suite groen, inclusief alle bestaande + nieuwe kracht_lage_cadans-tests.

---

## Deel A — fitnessprogressie (nieuwe architectuur, gebouwd, niet gecommit)

### Wat er is gebouwd

| Bestand | Rol |
|---|---|
| `src/lib/fitnessprogressie.js` **(nieuw)** | Pure berekening: `lineaireRegressieHelling()`, `berekenCtlTrend()`, `berekenDecouplingTrend()`, `berekenFitnessprogressie()`. Geen KV/intervals.icu-afhankelijkheid — net als `conditie.js`, zodat het zonder mocks testbaar is. |
| `src/lib/fitnessprogressieIO.js` **(nieuw)** | I/O-laag: haalt CTL-reeks (10 weken), decoupling-reeks (alle kwalificerende ritten, 10 weken) en FTP-testankerpunten op, roept de pure laag aan, schrijft naar KV. |
| `src/lib/volumeCorrectie.js` **(gewijzigd)** | `voerWekelijkseEvaluatieUit()` roept nu ook `berekenEnSlaFitnessprogressieOp(userId)` aan — vóór de herstelweek/taper-vroege-returns, dus elke week, ook als er verder geen volumecorrectie plaatsvindt. Best-effort (try/catch), breekt de bestaande volumecorrectie niet bij een fout. |
| `src/app/api/plan/fitnessprogressie/route.js` **(nieuw)** | `GET`, leest `fitnessprogressie:{userId}` uit KV — zelfde patroon als `/api/plan/conditie-score`. |
| `src/app/components/FitnessprogressieKaart.js` **(nieuw)** | Nieuwe kaart: CTL-trendrichting + helling/week, decoupling-trendrichting (of "onvoldoende data"), FTP-testdata indien bekend. |
| `src/app/components/HomeTab.js` **(gewijzigd)** | `<FitnessprogressieKaart />` toegevoegd, direct na `<GereedheidConditieKaart />` — **naast**, niet ter vervanging. |
| `src/app/components/GereedheidConditieKaart.js`, `AdaptatieScoreKaart.js` **(gewijzigd)** | Eén regel toegevoegd onder de conditie-pil: *"Combineert je huidige trainingsbelasting met de conditierichting — voor de losse trend, zie Fitnessprogressie [...]"*. Puur copy, geen berekeningswijziging — `belastingsStatus()`/`ramp_rate` blijven functioneel exact zoals ze waren. |
| `src/lib/__tests__/fitnessprogressie.test.js` **(nieuw)** | 17 tests voor de regressiefuncties. |

### KV-schema

`fitnessprogressie:{userId}` (TTL 90 dagen):
```json
{
  "berekend_op": "2026-07-13T21:30:04.123Z",
  "ctl_trend": {
    "status": "ok",
    "helling_per_week": 1.53,
    "richting": "stijgend",
    "aantal_dagen": 74,
    "venster_dagen": 73
  },
  "decoupling_trend": {
    "status": "onvoldoende_data",
    "helling_per_week": null,
    "richting": null,
    "aantal_punten": 9
  },
  "ftp_test_markers": [
    { "week": 3, "datum": "2026-07-05" }
  ]
}
```

`status: "onvoldoende_data"` is een eerste-klas veld, geen stille `null` — precies zoals gevraagd voor
het decoupling-pad bij <10 punten (`DECOUPLING_TREND_MIN_PUNTEN`), en analoog toegepast op CTL bij
<`CTL_TREND_MIN_DAGEN` (28) dagen geschiedenis (nieuwe, niet expliciet gevraagde maar logisch
consistente guard — een regressie over bv. 10 dagen zou anders een misleidend stellige richting tonen).

### Drempels als benoemde constanten (`src/lib/fitnessprogressie.js`)

```js
export const CTL_TREND_DREMPEL_PER_WEEK = 1;      // ±1 CTL-punt/week, uit de backtest
export const DECOUPLING_TREND_MIN_PUNTEN = 10;
export const CTL_TREND_MIN_DAGEN = 28;
```

Eén plek, met de backtest-motivatie in het bestand zelf als comment — niet verspreid over
call-sites.

### Ritme

Gehaakt aan `voerWekelijkseEvaluatieUit()` (`volumeCorrectie.js`), dus zondag ≥21:30
Europe/Amsterdam, via dezelfde atomische KV-claim (`isWekelijkseCheckVerschuldigd()`). Geen aparte
cron nodig.

### FTP-testankerpunten

`haalFtpTestMarkers()` combineert `plan.kader[].bevat_tussentijdse_ftp_test` (altijd aanwezig,
week 3) met de werkelijke datum zodra de bijbehorende sessie voltooid is
(`intentie.rol === "ftp_test"`, dus zowel de automatisch geplande ramp-test als een handmatig via
`/api/sessie/markeer-als-test` gemarkeerde rit).

### Wat ik bewust niet heb gedaan

- **Geen grafiek/visualisatie van de trendlijn zelf** — de kaart toont richting + numerieke helling
  in tekst, geen chart-component. Dat was niet expliciet gevraagd en is een aparte, grotere
  UI-beslissing (welke chart-library, welk tijdvenster tonen).
- **Geen wijziging aan `VoortgangTab.js`** — die heeft al een eigen, narratieve trendtekst
  (`conditieTrendContextlijn()`), gebaseerd op de dagelijkse `conditie`-waarde, geen belasting-pil met
  het risico dat ik in Deel A punt 5 probeerde te adresseren. Om scope beperkt te houden heb ik dit
  bestand niet aangeraakt — als u wilt dat de nieuwe fitnessprogressie ook daar (of i.p.v. de huidige
  contextlijn) verschijnt, is dat een aparte, kleine vervolgstap.
- **Geen test voor `fitnessprogressieIO.js`** (de I/O-laag) — die vereist KV/intervals.icu-mocks
  (patroon bestaat al voor vergelijkbare functies elders, maar geen bestaand testbestand voor
  `volumeCorrectie.js` zelf om bij aan te sluiten — zie ook de ontbrekende dekking die
  `ramp-rate-fix-en-impact.md` al eerder signaleerde). De pure laag (het risicovolle rekenwerk) is wel
  volledig getest.
- **Niet gecommit** — u overziet dit eerst, zoals gevraagd.

---

## Deel C — weekInFase-progressie: al geïmplementeerd, niet opnieuw gebouwd

### Wat ik vond bij verificatie (punt 1)

De opdracht vroeg te citeren waar `weekInFase` aan `schatTssDoel()` wordt doorgegeven en te
bevestigen dat het nergens wordt gebruikt, "zoals eerder gevonden". **Dat eerdere resultaat klopt niet
meer met de huidige code.** `weekInFase` wordt wél degelijk gebruikt:

```js
// src/lib/sessie/weekSolver.js:517-522
export function schatTssDoel(archetypesData, sessietype, fase, weekInFase, seizoensdoel, gedegradeerd, weektype, beschikbareDuurMin = null) {
  const ifMidden = SESSIETYPE_IF_MIDDEN[sessietype] ?? 0.70;
  const uren = effectieveDuurMin(sessietype, beschikbareDuurMin, weekInFase, weektype) / 60;
  const basis = Math.round(ifMidden * ifMidden * uren * 100);
  return gedegradeerd ? Math.round(basis * 0.85) : basis;
}
```

`weekInFase` stroomt door naar `effectieveDuurMin()`, die op zijn beurt `progressieFactor()` aanroept
(`weekSolver.js:498-502`): week 1 → factor 0,75, week 2 → 0,875, week 3+ → 1,00 van
`SESSIETYPE_MAX_EFFECTIEVE_UREN`. Voor `sweetspot_intervallen` (in `PROGRESSIEVE_SESSIETYPES`, samen
met `drempel_intervallen`/`vo2max_intervallen`) betekent dit precies **Route A** uit de opdracht:
groeiende duur/TSS van week 1 naar 2 naar 3, exact het "90→100→110 min"-patroon dat de opdracht als
hypothetisch voorbeeld noemde.

**Route B** (2e sweetspot-sessie vanaf week 3) bestaat ook al, onafhankelijk mechanisme:

```js
// src/lib/sessie/weekSolver.js:270-273
const KERNSTIMULUS_FREQUENTIE_OPBOUW = {
  sweetspot:     { startFrequentie: 1, maxFrequentie: 2, weekInFaseVoorMax: 3 },
  overgangsfase: { startFrequentie: 1, maxFrequentie: 2, weekInFaseVoorMax: 3 },
};
```

`bepaalKernstimulusFrequentie()` gebruikt dit om `solveWeek()`'s kernstimulus-lus (stap 2/3) 1× of 2×
te laten draaien, met een adjacency-guard tussen de twee kernstimulusdagen.

Beide mechanismen zijn al voorzien van tests (`weekSolver.test.js`, describe-blocks "sectie 22-G:
week-in-blok duur-/volumeprogressie" en "sectie 22-G: frequentie-opbouw van de kernstimulus") die vóór
deze sessie al bestonden en nog steeds slagen. Dit is dus kennelijk in een eerdere sessie gebouwd
(consistent met "de eerdere beslissing (12 juli)" die de opdracht noemt) — de "nergens gebruikt"-vinding
was op dat moment mogelijk correct, maar is inmiddels achterhaald.

### Simulatie tegen het live plan (punt 5)

Ik heb `solveWeek()` rechtstreeks aangeroepen (geen gemockte data) met:
- de echte archetypes uit productie-KV (`archetypes:{sessietype}`),
- de echte beschikbaarheid van dit plan (Dinsdag 2u, Donderdag 2u, Zaterdag 3u — `beschikbaarheid`/
  `urenPerDag` uit `u_frank_001:seizoensplan`),
- de echte `weekTssDoel` per week uit het kader (353 / 388 / 427 voor week 5/6/7),
- `seizoensdoel: "ftp"` (zelfde fallback als `weekSessiesDeterministisch.js:209` voor dit plan, dat
  geen `seizoensdoel.type`-veld heeft).

Resultaat (script na gebruik verwijderd, geen wijzigingen aan productiedata):

| | Week 5 (weekInFase 1) | Week 6 (weekInFase 2) | Week 7 (weekInFase 3) |
|---|---|---|---|
| Kernstimulusdagen | 1× `sweetspot_intervallen` | 1× `sweetspot_intervallen` | **2×** `sweetspot_intervallen` |
| Kernstimulus-TSS | 139 | 161 | 148 + 185 = 333 |
| Overige dagen | 2× `z2_duur` (107 elk) | 2× `z2_duur` (114 elk) | 1× `z2_duur` (94) |

Dit toont **beide routes tegelijk in actie** op uw eigen plan: de TSS/duur van de kernstimulus-sessie
groeit (139 → 161, vóór de frequentie-verdubbeling in week 3), en in week 3 verschijnt de tweede
sweetspot-sessie, ten koste van precies één z2-slot — zoals de opdracht voorspelde ("Route B... ten
koste van één zone 2-slot"). Met slechts 3 beschikbare dagen/week laat week 3 geen ruimte meer over
voor een derde sessie — geen probleem, want er zijn ook maar 3 dagen beschikbaar; er ontstaat geen
gat en geen overschrijding.

**Kanttekening bij de simulatie:** in productie was 07-14 (dinsdag, week 5) al een vaste, gecommitteerde
sessie vóórdat deze week gesolved werd; mijn simulatie behandelt alle drie dagen als open, waardoor
`solveWeek()` de kernstimulus toewijst aan de dag met de meeste uren (zaterdag) i.p.v. dinsdag. Dat
verandert alleen *welke dag* de kernstimulus krijgt, niet de kern van wat hier getoond wordt
(duur-/frequentieprogressie via `weekInFase`).

### Interactie met Deel B — geen conflict

Met de Deel B-fix kan `ftp`/`sweetspot` sowieso nooit meer kracht_lage_cadans krijgen. Zonder die fix
zou het bestaande "kracht vervalt bij 2× kernstimulus"-mechanisme (sectie 22-G, al besproken in het
vorige rapport) in week 3 sowieso al hebben ingegrepen zodra de 2e sweetspot-sessie werd toegewezen.
Deel B en Deel C raken elkaar dus niet — precies zoals de opdracht zelf al aangaf ("Met Deel B's fix is
er geen kracht_lage_cadans-conflict meer tijdens sweetspot").

### Tests (punt 4)

Al aanwezig en dekkend:
- `sectie 22-G: week-in-blok duur-/volumeprogressie` → `z2_duur/kracht_lage_cadans: geen enkele
  week-in-blok-invloed` bevestigt impliciet ook dat progressieve types (`sweetspot_intervallen` e.d.)
  wél verschillen (zie de test ervoor met `perWeek[2] > perWeek[1]`).
- `sectie 22-G: frequentie-opbouw van de kernstimulus` → expliciete assertie `kernstimulusWeek1` lengte
  1 vs. `kernstimulusWeek3` lengte 2, plus een niet-aangrenzendheidscheck.

**Enige gat dat ik zag:** geen bestaande test met de exacte live-configuratie (3 beschikbare
dagen/week, niet 5). De generieke tests gebruiken steeds 3-5 open dagen met ruimere marges. Dit is een
klein, additief, laag-risico voorstel — **niet toegepast, ter beoordeling**:

```diff
--- a/src/lib/sessie/__tests__/weekSolver.test.js
+++ b/src/lib/sessie/__tests__/weekSolver.test.js
@@
+  describe('sectie 22-G: week 1/2/3 met precies 3 beschikbare dagen (live-planconfiguratie)', () => {
+    it('week 3 met slechts 3 open dagen: 2x kernstimulus + 1x z2, geen gat, geen budgetoverschrijding', () => {
+      const resultaat = solveWeek({
+        archetypesData: ARCHETYPES_FIXTURE,
+        fase: 'sweetspot', weekInFase: 3, weektype: 'opbouw', seizoensdoel: 'ftp',
+        weekTssDoel: 427, aantalWekenInFase: 4, vasteDagen: [],
+        openDagen: dagen('2026-07-28:2', '2026-07-30:2', '2026-08-01:3'),
+        alGeleverd: { tss: 0 }, tsb: 13, weekNummerInSeizoen: 7, laatsteKrachtLageCadansWeek: null,
+      })
+      expect(resultaat).toHaveLength(3)
+      expect(resultaat.filter(r => r.pad === 'kernstimulus')).toHaveLength(2)
+      expect(resultaat.filter(r => r.pad === 'z2')).toHaveLength(1)
+      expect(resultaat.reduce((s, r) => s + r.tss_doel, 0)).toBeLessThanOrEqual(427)
+    })
+  })
```

Zeg het als u wilt dat ik dit toevoeg — het is puur een regressietest voor wat de simulatie hierboven
al aantoonde, geen gedragswijziging.

### Conclusie Deel C

**Geen diff toegepast, want er is geen ontbrekende functionaliteit gevonden.** Route A en Route B uit
de opdracht draaien al, correct, op uw live plan. Als er een reden was om aan te nemen dat dit nog
gebouwd moest worden, hoor ik dat graag — dan heb ik iets over het hoofd gezien dat ik hiermee niet
heb blootgelegd. Vooralsnog is mijn advies: niets aanpassen, optioneel de bovenstaande test toevoegen.

---

## Samenvatting van openstaande beslissingen

1. **Deel A**: gebouwd, niet gecommit. Beoordeel de architectuur (bestandenlijst hierboven), en laat
   weten of de UI-plek/copy-aanpassingen zo goed zijn, of dat er iets moet verschuiven vóór commit.
2. **Deel C**: geen wijziging voorgesteld — bevestig of de simulatie hierboven overeenkomt met wat u
   verwachtte, en of de optionele regressietest gewenst is.
