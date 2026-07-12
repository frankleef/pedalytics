# Ramp rate: fix + downstream-impactanalyse

Vervolg op `conditie-verbetering-analyse.md`. Status: **toegepast** (Deel A + `volumeCorrectie.js`,
inclusief de `tsbTeNegatief`-drempelaanpassing — zie addendum onderaan). Dit rapport bevat de
gevonden berekeningslocaties (Deel A), de doorgevoerde diff, en de volledige impactanalyse van waar
`belasting`/`ramp_rate`/`conditie` buiten de UI wordt gebruikt (Deel B). Alle 580 tests slagen na
toepassing.

---

## Deel A — ramp rate rechtstreeks uit intervals.icu

### 1. Waar `ramp_rate` nu wordt berekend

Alle vier plekken roepen dezelfde lokale lineaire-regressiefunctie aan:

```js
// src/lib/conditie.js:21-30
export function ctlRampRegressie(ctlWaarden) {
  if (!ctlWaarden?.length || ctlWaarden.length < 7) return null;
  const n = ctlWaarden.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += ctlWaarden[i]; sumXY += i * ctlWaarden[i]; sumX2 += i * i;
  }
  const helling = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return Math.round(helling * 7 * 100) / 100;
}
```

Dit is een regressie-*slope* over het hele venster (28-29 dagen), geschaald naar "per week". Dat
is fundamenteel iets anders dan intervals.icu's eigen `rampRate`, wat een punt-op-punt CTL-verschil
is (recentste dag t.o.v. 7 dagen eerder). Een regressie over 4 weken middelt een bewuste
deload-week uit als de 3 weken ervoor sterk stegen — precies het scenario dat u signaleerde (Kesto
`+2.06` vs. intervals.icu `-2.25` op 28 juni).

**Vier aanroeplocaties:**

| # | Bestand | Regel | Context |
|---|---|---|---|
| 1 | `src/app/api/cron/sync/route.js` | 214 | Idempotent pad (geen nieuwe activiteit), voedt `conditie_score:{userId}` |
| 2 | `src/app/api/cron/sync/route.js` | 514 | Hoofdpad (nieuwe activiteit binnen), voedt `conditie_score:{userId}` |
| 3 | `src/app/api/debug/conditiescore-historie/route.js` | 34 | Admin-only debug-historie, eigen berekening per dag |
| 4 | `src/app/api/admin/herbereken-conditiescore/route.js` | 24 | Admin-only handmatige herberekening |

Een **vijfde**, volledig aparte plek — `src/lib/volumeCorrectie.js:haalRampRate()` (regel 80-103) —
roept dezelfde `ctlRampRegressie()` aan met een eigen 29-dagen-fetch, maar voedt **niet** de
`belasting`-classificatie/pill. Dit is geen onderdeel van de hier gevraagde fix (zie expliciet Deel
B hieronder) — het heeft een eigen, reële downstream-impact en verdient een eigen, bewuste
beslissing.

### 2. Is intervals.icu's eigen `rampRate`-veld al beschikbaar?

**Ja, bevestigd** — het wordt al elders in deze codebase expliciet opgevraagd:

```js
// src/app/api/intervals/wellness/route.js:13-21
const fields = [
  "id", "ctl", "atl", "rampRate",
  "restingHR", "hrv", "hrvSDNN",
  ...
].join(",");
const data = await intervalsGet("/wellness.json", { oldest, newest, fields }, creds);
```

Belangrijke nuance: dit bevestigt dat het veld **bestaat** in intervals.icu's wellness-API, maar
niet dat het automatisch terugkomt als `fields` wordt weggelaten (zoals nu gebeurt in alle vier
de aanroepen uit stap 1 — geen daarvan specificeert `fields`). Naast `rampRate` bevat deze lijst
ook duidelijk niet-standaard velden (`bodyBattery`, `spO2`, `hydration` — Garmin-extensies), wat
erop wijst dat intervals.icu een curated default-set teruggeeft tenzij `fields` expliciet wordt
opgegeven. **Ik kan dit niet met 100% zekerheid bevestigen zonder een live API-call** (geen
productie-/intervals.icu-toegang vanuit deze sessie) — vandaar dat de voorgestelde diff hieronder
`fields` altijd expliciet meegeeft, in lijn met het bestaande patroon in
`intervals/wellness/route.js`, in plaats van aan te nemen dat het veld "gratis" meekomt.

**Aanbeveling om dit te verifiëren vóór toepassen**: na de fix, één keer
`/api/debug/conditiescore-historie` aanroepen en controleren of `ramp_rate` in de output
niet-null is voor recente dagen. Als intervals.icu voor sommige dagen `null` teruggeeft (bv. bij
onvoldoende historie), valt dit terug op `null` → `belastingsStatus(ctlRamp ?? 0, ...)` (bestaande
`?? 0`-fallback, ongewijzigd), dus geen crash-risico.

### 3. Doorgevoerde diff

#### `src/app/api/cron/sync/route.js` — locatie 1 (idempotent pad, rond regel 208-215)

```diff
-              const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0) }, { apiKey, athleteId });
+              const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0), fields: "id,ctl,atl,rampRate" }, { apiKey, athleteId });
               let ctlNu = null, ctl4wGeleden = null, ctlRamp = null;
               if (wellData?.length >= 7) {
                 const ctlW = wellData.filter(w => w.ctl != null).sort((a,b) => (a.id||"").localeCompare(b.id||""));
                 ctlNu = ctlW.length > 0 ? ctlW[ctlW.length - 1].ctl : null;
                 ctl4wGeleden = ctlW.length > 0 ? ctlW[0].ctl : null;
-                ctlRamp = ctlRampRegressie(ctlW.map(w => w.ctl));
+                // Rechtstreeks intervals.icu's eigen rampRate van de ctl_nu-dag, i.p.v. een lokale
+                // regressie over het venster — zie ramp-rate-fix-en-impact.md, Deel A.
+                // TODO: belastingsStatus()-drempels (1.5-5.0/week, conditie.js:32-38) zijn
+                // gekalibreerd op de oude regressie-berekening en moeten apart herijkt worden op
+                // intervals.icu's rampRate-schaal — niet als bijvangst van deze fix.
+                ctlRamp = ctlW[ctlW.length - 1].rampRate ?? null;
               }
```

#### `src/app/api/cron/sync/route.js` — locatie 2 (hoofdpad, rond regel 508-548)

Dit blok doet momenteel **twee aparte `/wellness`-fetches met identieke `oldest`/`newest`**
(regel 511 voor `ctlRamp`, regel 545 voor `ctlNu`/`ctl4wGeleden`) — een overbodige dubbele
netwerkcall die toevallig ook meteen verdwijnt zodra beide uit dezelfde respons komen:

```diff
-            let ctlRamp = null;
-            try {
-              const wellOldest = datumOffset(-28);
-              const wellData = await intervalsGet("/wellness", { oldest: wellOldest, newest: datumOffset(0) }, { apiKey, athleteId });
-              if (wellData?.length >= 7) {
-                const ctlWaarden = wellData.filter(w => w.ctl != null).sort((a, b) => (a.id || "").localeCompare(b.id || ""));
-                ctlRamp = ctlRampRegressie(ctlWaarden.map(w => w.ctl));
-              }
-            } catch (e) {
-              console.warn(`[sync] Wellness voor conditiescore mislukt:`, e.message);
-            }
+            let ctlRamp = null, ctlNu = null, ctl4wGeleden = null;
+            try {
+              const wellAll = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0), fields: "id,ctl,atl,rampRate" }, { apiKey, athleteId });
+              const ctlAll = (wellAll || []).filter(w => w.ctl != null).sort((a,b) => (a.id||"").localeCompare(b.id||""));
+              if (ctlAll.length > 0) {
+                ctlNu = ctlAll[ctlAll.length - 1].ctl;
+                ctl4wGeleden = ctlAll[0].ctl;
+                // Rechtstreeks intervals.icu's eigen rampRate van de ctl_nu-dag — zie
+                // ramp-rate-fix-en-impact.md, Deel A. TODO: belastingsStatus()-drempels apart
+                // herijken, niet als bijvangst van deze fix.
+                ctlRamp = ctlAll[ctlAll.length - 1].rampRate ?? null;
+              }
+            } catch (e) {
+              console.warn(`[sync] Wellness voor conditiescore mislukt:`, e.message);
+            }

             // Decoupling medianen voor conditiescore: GEEN filter (ruwe waarden, spec 32-F)
             const dcAlleEntries = [];
             for (const rit of ritten) {
               const dc = await kv.get(`decoupling:${rit.id}`);
               if (dc == null) continue;
               const waarde = typeof dc === "number" ? dc : dc?.decoupling;
               const isHitte = typeof dc === "object" && (dc?.hitte_gecorrigeerd ?? false);
               if (waarde != null) dcAlleEntries.push({ waarde, isHitte });
             }
             const dcAlleWaarden = dcAlleEntries.map(e => e.waarde);
             const dcHuidig = dcAlleWaarden.length >= 3 ? dcAlleWaarden.slice(-3).sort((a,b)=>a-b)[1] : null;
             const dcVorig = dcAlleWaarden.length >= 6 ? dcAlleWaarden.slice(-6, -3).sort((a,b)=>a-b)[1] : null;

             // >50% hitte-fallback (spec 32-F): informatiemelding als decoupling-trend onbetrouwbaar
             const laatste6 = dcAlleEntries.slice(-6);
             const hitteAandeel = laatste6.length > 0 ? laatste6.filter(e => e.isHitte).length / laatste6.length : 0;
             if (laatste6.length >= 6 && hitteAandeel > 0.5) {
               await kv.set(`conditie-hitte-melding:${userId}`, true, { ex: 14 * 86400 });
             } else {
               await kv.del(`conditie-hitte-melding:${userId}`).catch(() => {});
             }

-            // CTL 4 weken geleden
-            let ctlNu = null, ctl4wGeleden = null;
-            try {
-              const wellAll = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0) }, { apiKey, athleteId });
-              const ctlAll = (wellAll || []).filter(w => w.ctl != null).sort((a,b) => (a.id||"").localeCompare(b.id||""));
-              if (ctlAll.length > 0) { ctlNu = ctlAll[ctlAll.length - 1].ctl; ctl4wGeleden = ctlAll[0].ctl; }
-            } catch {}
-
             const gereedheidsscore = 50; // TODO: lezen uit KV als beschikbaar
```

#### `src/app/api/debug/conditiescore-historie/route.js`

```diff
-import { berekenConditieScore, belastingsStatus, conditieStatus, conditiePillStatus, ctlRampRegressie } from "@/lib/conditie";
+import { berekenConditieScore, belastingsStatus, conditieStatus, conditiePillStatus } from "@/lib/conditie";
```
```diff
-    const wellness = await intervalsGet("/wellness", { oldest, newest }, creds);
+    const wellness = await intervalsGet("/wellness", { oldest, newest, fields: "id,ctl,atl,rampRate" }, creds);
```
```diff
       const ctlNu = dag.ctl;
       const ctl4w = ctlPerDag[i - 27]?.ctl;
-      const window28 = ctlPerDag.slice(Math.max(0, i - 27), i + 1).map(w => w.ctl);
-      const ramp = ctlRampRegressie(window28);
+      // Rechtstreeks intervals.icu's eigen rampRate i.p.v. lokale regressie — zie
+      // ramp-rate-fix-en-impact.md, Deel A. TODO: "ramp_optimaal": "1.5-5.0/week" (verderop in dit
+      // bestand) is gekalibreerd op de oude berekening, apart herijken.
+      const ramp = dag.rampRate ?? null;
```

#### `src/app/api/admin/herbereken-conditiescore/route.js` — *niet expliciet gevraagd, wel dezelfde bug*

Dit is dezelfde KV-schrijfpad (`conditie_score:{userId}`) als sync-route locatie 1/2, alleen
handmatig getriggerd. Zonder deze mee te nemen zou een handmatige herberekening de oude,
inconsistente waarde terugzetten. Ik stel voor 'm mee te nemen, maar meld het apart omdat de
oorspronkelijke opdracht alleen sync-route + debug-endpoint noemde:

```diff
-import { berekenConditieScore, belastingsStatus, conditieStatus, conditiePillStatus, ctlRampRegressie } from "@/lib/conditie";
+import { berekenConditieScore, belastingsStatus, conditieStatus, conditiePillStatus } from "@/lib/conditie";
```
```diff
-  const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0) }, creds);
+  const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0), fields: "id,ctl,atl,rampRate" }, creds);
   const ctlAll = (wellData || []).filter(w => w.ctl != null).sort((a, b) => (a.id || "").localeCompare(b.id || ""));

   const ctlNu = ctlAll.length > 0 ? ctlAll[ctlAll.length - 1].ctl : null;
   const ctl4wGeleden = ctlAll.length > 0 ? ctlAll[0].ctl : null;
-  const ctlRamp = ctlRampRegressie(ctlAll.map(w => w.ctl));
+  // Rechtstreeks intervals.icu's eigen rampRate — zie ramp-rate-fix-en-impact.md, Deel A.
+  const ctlRamp = ctlAll.length > 0 ? (ctlAll[ctlAll.length - 1].rampRate ?? null) : null;
```

`ctlRampRegressie` blijft gewoon bestaan in `src/lib/conditie.js` (niet verwijderen) — hij wordt nog
gebruikt door `src/lib/volumeCorrectie.js:haalRampRate()`, wat buiten deze fix valt (zie Deel B).

### 4. Wat bewust ongewijzigd blijft

- **Drempelwaarden**: `belastingsStatus()` (`conditie.js:32-38`, `>7`/`≥5`/`≥1.5`/`≥0.5`) en de
  informatieve `"ramp_optimaal": "1.5-5.0/week"`-string in het debug-endpoint blijven staan zoals
  ze zijn, met een `// TODO`-comment erbij in elke diff hierboven. Deze drempels zijn gekalibreerd
  op de oude regressie-schaal; of ze 1-op-1 toepasbaar zijn op intervals.icu's punt-op-punt
  `rampRate` (die doorgaans volatieler is dan een 4-weeks regressie-slope) moet apart en bewust
  bepaald worden — mogelijk met een aparte drempeltabel, niet als bijvangst van deze fix.
- **`volumeCorrectie.js:haalRampRate()`** — zie Deel B: dit voedt een ander systeem met een eigen,
  reeds andere drempelset (2.0/7.0 i.p.v. 1.5/5.0/7.0), en heeft echte planningsimpact. Aanpassen
  hiervan is een grotere, aparte beslissing.

---

## Deel B — waar wordt `belasting`/`ramp_rate`/`conditie`/`pill` nog gebruikt?

### Kernconclusie

De KV-waarde `conditie_score:{userId}` — met `belasting`, `conditie`, `pill`/`pill_label`,
`ctl_ramp` — wordt **buiten UI-weergave nergens gelezen als beslissingsinput** voor
sessiegeneratie of TSS-budgettering. De Deel-A-fix hierboven is dus, voor dít pad, **puur
cosmetisch/informatief** — hij verandert alleen wat de gebruiker op het scherm ziet, niet wat er
wordt ingepland.

**Maar**: de onderliggende bug (regressie i.p.v. intervals.icu's punt-op-punt `rampRate`) zit óók
in een **volledig aparte, parallelle berekening** — `volumeCorrectie.js:haalRampRate()` — die wél
rechtstreeks TSS-budgetten en sessieplanning aanstuurt. Dat pad wordt door de Deel-A-diff hierboven
niet aangeraakt.

### 1. Enige niet-UI-lezer van `conditie_score:{userId}`

```js
// src/app/api/plan/conditie-score/route.js:9
const data = await kv.get(`conditie_score:${user?.id}`);
```
Pure passthrough naar JSON — geen conditionele logica op `belasting`/`conditie`/`pill`. Wordt
alleen aangeroepen door `GereedheidConditieKaart.js`, `VoortgangTab.js`, `AdaptatieScoreKaart.js` —
dezelfde drie UI-componenten als al bekend. Geen nieuwe niet-UI-consument.

### 2. De `belasting`-strings zelf (`"optimaal"`, `"te_hoog"`, `"inactief"`, ...)

```js
// src/lib/conditie.js:32-38
export function belastingsStatus(ctl_ramp_per_week, gereedheidsscore) {
  if (ctl_ramp_per_week < 0 && gereedheidsscore >= 60) return "herstelblok";
  if (ctl_ramp_per_week > 7) return "te_hoog";
  if (ctl_ramp_per_week >= 5) return "aan_de_grens";
  if (ctl_ramp_per_week >= 1.5) return "optimaal";
  if (ctl_ramp_per_week >= 0.5) return "te_laag";
  return "inactief";
}
```
Uitsluitend aangeroepen vanuit de drie schrijf-/debugroutes uit Deel A, en uitsluitend gebruikt om
een pill-label/kleur te kiezen (`conditiePillStatus()`). Geen sessiegeneratie- of
TSS-budgetcode leest deze strings of vergelijkt ertegen. (Een gelijknamig maar ongerelateerd veld
`belasting` bestaat in `src/lib/uitvoeringsscore.js:95` — dat is een post-hoc
uitvoeringsscore-dimensie, geen conditie-classificatie, geen relatie met `conditie_score`.)

### 3. `schatTssDoel()` — geen koppeling

```js
// src/lib/sessie/weekSolver.js:517
export function schatTssDoel(archetypesData, sessietype, fase, weekInFase, seizoensdoel, gedegradeerd, weektype, beschikbareDuurMin = null) {
  const ifMidden = SESSIETYPE_IF_MIDDEN[sessietype] ?? 0.70;
  const uren = effectieveDuurMin(sessietype, beschikbareDuurMin, weekInFase, weektype) / 60;
  const basis = Math.round(ifMidden * ifMidden * uren * 100);
  return gedegradeerd ? Math.round(basis * 0.85) : basis;
}
```
Puur `IF² × uren × 100`, met een 15%-korting bij `gedegradeerd` (uit een aparte TSB-check
elders). Geen van de parameters is `belasting`, `ramp_rate`, `conditie` of `conditie_score`.

### 4. Het systeem dat wél echte impact heeft: `volumeCorrectie.js`

Twee orchestratiefuncties, beide getriggerd vanuit `src/app/api/cron/sync/route.js`:

**`voerWekelijkseEvaluatieUit(userId)`** (`volumeCorrectie.js:421-548`) — elke zondag ≥21:30
Europe/Amsterdam (via `isWekelijkseCheckVerschuldigd()`, atomische KV-claim):
```js
// regel 467-468
const signalen = await haalVolumeSignalen(userId);   // → haalRampRate() erin
const correctie = bepaalVolumeCorrectie(signalen);
```
Resultaat past `plan.kader[...].tss_doel` aan en roept `vulSessiesAanVoorGebruiker()` aan om de
week opnieuw te genereren — dus een direct effect op wat er wordt ingepland.

**`voerHerstelweekEvaluatieUit(userId)`** (`volumeCorrectie.js:552-680`) — bij elke herstelweek
(blok-ijkmoment, ~1x/4 weken): herbereken van de piekweek-TSS-basis (`bepaalNieuweBlokBasis()`) en
trainingsfrequentie (`bepaalTrainingsfrequentie()`) voor het volgende blok, beide gevoed door
dezelfde `haalVolumeSignalen()`.

**De signalen komen uit een eigen, parallelle berekening** (`volumeCorrectie.js:80-103`):
```js
export async function haalRampRate(userId) {
  ...
  const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-29), newest: datumOffset(0) }, creds);
  ...
  const ctlWaarden = wellData.filter(w => w.ctl != null).sort(...).map(w => w.ctl);
  if (ctlWaarden.length < 29) return null;
  return ctlRampRegressie(ctlWaarden);   // ← dezelfde regressiefunctie als Deel A's bug
}
```
Dit importeert **uitsluitend** `ctlRampRegressie` uit `conditie.js` — niet `belastingsStatus` of de
`conditie_score`-KV-waarde. Functioneel gelijkaardig, technisch volledig gescheiden pad.

### 5. "Compenseer voor gemiste stimulus" — bevestigd, en het is dít pad

```js
// volumeCorrectie.js:209-223
const rampTeLaag = rampRate !== null && rampRate < 2.0;
const tsbTePositief = tsbGemiddelde14d !== null && tsbGemiddelde14d > 5;
...
const omhoog = (rampTeLaag || tsbTePositief) && !adaptatieSlecht && !tsbTeNegatief;
if (omhoog) {
  if (rampTeLaag && tsbGemiddelde14d > 15) return { richting: "omhoog", pct: 0.12 };
  ...
}
```
Bij `richting: "omhoog"` voegt `bepaalVolumeAanpassing()` (regel 300-417) in volgorde van
voorkeur een **nieuwe trainingsdag** toe, **verlengt** een bestaande sessie, of voegt een
**tempo-afsluiter** toe — een letterlijke "extra/zwaardere sessie"-actie, direct getriggerd door
een te lage `rampRate`. Dit gebruikt **niet** de `belasting`-classificatie uit `conditie.js`, maar
wel dezelfde onderliggende, mogelijk foutieve `ctlRampRegressie()`-berekening.

### 6. `vo2maxDetectie.js` en `sessie/genereren.js`

Geen treffers voor `belasting`/`ramp_rate`/`conditie`. `genereren.js:140` leest wel `rpe_trend:
{userId}` rechtstreeks uit KV (los van `conditie_score`) — geen relatie met dit onderzoek.

### Conclusie Deel B

- **`belasting`/`conditie`/`pill` (KV `conditie_score`) → geen downstream effect.** Puur UI. De
  Deel-A-fix corrigeert hier alleen het getoonde label, niet het gedrag van de app.
- **`ramp_rate`-berekening (dezelfde `ctlRampRegressie`-bug) → wél downstream effect**, via het
  volledig aparte `volumeCorrectie.js:haalRampRate()`. Dat pad bepaalt wekelijks (en bij elke
  blokgrens) TSS-budgetaanpassingen van 5-12%, extra trainingsdagen, sessieverlengingen en de
  piekweek-basis van het volgende blok.
- Dit betekent: de misclassificatie die u signaleerde in de UI ("optimaal" i.p.v. een terechte
  deload-herkenning) is inderdaad grotendeels cosmetisch. Maar de **rekenkundige bug erachter**
  (regressie-slope i.p.v. punt-op-punt `rampRate`) is dat niet — die zit ook in het pad dat
  daadwerkelijk TSS-budgetten en sessies aanpast, alleen via een andere ingang dan de UI-pill.
  Of `volumeCorrectie.js:haalRampRate()` dezelfde fix moet krijgen is een aparte, grotere
  beslissing (eigen drempelset 2.0/7.0, eigen 29-dagen-venster) — bewust buiten de hier
  voorgestelde diff gehouden, maar wel expliciet gemeld zoals gevraagd.

---

## Addendum — daadwerkelijk toegepast, inclusief `volumeCorrectie.js` en `tsbTeNegatief`

Na overleg is besloten om, naast Deel A, ook `volumeCorrectie.js:haalRampRate()` mee te nemen
(ramp rate moet overal rechtstreeks van intervals.icu komen) én de `tsbTeNegatief`-drempel te
verlagen. Vóór het wijzigen is eerst uitgezocht of `tsbTeNegatief` momenteel actief blokkeert.

### Onderzoek: blokkeert `tsbTeNegatief` momenteel?

- **Logica correct**: `!tsbTeNegatief` sluit `omhoog` uit en `tsbTeNegatief` forceert `omlaag` —
  als de vlag ooit `true` wordt, werkt de blokkade zoals bedoeld.
- **Maar de drempel is recent bewust verdriedubbeld.** Git-historie (`git log -p`, commit
  `161a935`, "volume correctie", 26 juni 2026) toont de wijziging van `tsbGemiddelde14d < -10`
  naar `< -30`, zonder toelichting in de commit-message buiten het code-comment "risk zone".
- **`tsbGemiddelde14d` is een 14-daags voortschrijdend gemiddelde**, geen actuele TSB
  (`haalTsbGemiddelde()`, `volumeCorrectie.js`). De gangbare "-30 = risk zone"-vuistregel wordt
  normaliter op de actuele dagwaarde toegepast; op een 14-daags gemiddelde toegepast vereist dit
  bijna twee aaneengesloten weken zware overbelasting — voor een recreatieve fietser (CTL 30-60,
  vergelijkbaar met de eerder gevonden ramp-rate-herijking) een onwaarschijnlijk scenario.
- **Geen tests, geen live verificatie mogelijk vanuit deze sessie** (geen productie-/KV-toegang).
  Er bestaat wel een endpoint waarmee dit met echte cijfers te bevestigen is:
  `GET /api/debug/volumecorrectie-log?userId=...` (tot 13 weken `weekLogs` met de werkelijke
  `signalen.tsbGemiddelde14d` en resulterende `richting`).

**Conclusie**: niet met zekerheid vast te stellen of `tsbTeNegatief` ooit `true` wordt onder
realistische omstandigheden, maar de combinatie van (a) een recent verdriedubbelde drempel en
(b) toepassing op een gedempt 14-daags gemiddelde maakt aannemelijk dat het vangnet zelden of
nooit triggert. Dit is relevant omdat de `haalRampRate()`-fix `rampTeLaag` gevoeliger/anders
maakt — een zwak vangnet betekent dat "omhoog" (meer volume) vaker kan triggeren precies wanneer
iemand er niet tegen kan.

**Gekozen aanpak** (in overleg): combineer de `ramp_rate`-fix mét een verlaagde
`tsbTeNegatief`-drempel, in plaats van te wachten op live verificatie.

### Wijziging `volumeCorrectie.js:haalRampRate()`

```diff
 export async function haalRampRate(userId) {
   try {
     const creds = await getIntervalsCredentials(userId);
     if (!creds) return null;

-    const wellData = await intervalsGet("/wellness", {
-      oldest: datumOffset(-29),
-      newest: datumOffset(0),
-    }, creds);
-
-    if (!wellData?.length) return null;
-
-    const ctlWaarden = wellData
-      .filter(w => w.ctl != null)
-      .sort((a, b) => (a.id || "").localeCompare(b.id || ""))
-      .map(w => w.ctl);
-
-    if (ctlWaarden.length < 29) return null;
-
-    return ctlRampRegressie(ctlWaarden);
+    // Rechtstreeks intervals.icu's eigen rampRate i.p.v. een lokale regressie. Klein venster
+    // (7 dagen) volstaat, we hebben alleen de meest recente dag met een rampRate nodig.
+    const wellData = await intervalsGet("/wellness", {
+      oldest: datumOffset(-7),
+      newest: datumOffset(0),
+      fields: "id,ctl,atl,rampRate",
+    }, creds);
+
+    if (!wellData?.length) return null;
+
+    const dagen = wellData
+      .filter(w => w.rampRate != null)
+      .sort((a, b) => (a.id || "").localeCompare(b.id || ""));
+
+    if (!dagen.length) return null;
+
+    return dagen[dagen.length - 1].rampRate;
   } catch {
     return null;
   }
 }
```
Import van `ctlRampRegressie` verwijderd uit `volumeCorrectie.js` (niet meer gebruikt in dit
bestand).

### Wijziging `tsbTeNegatief`-drempel

```diff
   // > +5 = fresh/transition: te weinig prikkel, sporter zit boven grey zone
   const tsbTePositief   = tsbGemiddelde14d !== null && tsbGemiddelde14d > 5;
-  // < -30 = risk zone: onder optimal, ophoping richting overtraining
-  const tsbTeNegatief   = tsbGemiddelde14d !== null && tsbGemiddelde14d < -30;
+  // < -20 = risk zone. LET OP: 14-daags gemiddelde, geen actuele TSB — de gangbare "-30"-regel
+  // geldt voor de actuele waarde en is op een gemiddelde vrijwel onbereikbaar. -30 bleek daardoor
+  // in de praktijk niet te triggeren; -20 is een tussenwaarde, geen definitief herijkte drempel —
+  // verifieer via /api/debug/volumecorrectie-log zodra er weer live data is.
+  const tsbTeNegatief   = tsbGemiddelde14d !== null && tsbGemiddelde14d < -20;
   ...
   if (omlaag) {
-    if (tsbTeNegatief && tsbGemiddelde14d < -40) return { richting: "omlaag", pct: 0.12 };
+    if (tsbTeNegatief && tsbGemiddelde14d < -30) return { richting: "omlaag", pct: 0.12 };
     if (tsbTeNegatief) return { richting: "omlaag", pct: 0.08 };
```
**-20/-30 is een beargumenteerde tussenwaarde** (tussen de oorspronkelijke -10 van vóór 26 juni en
de huidige -30/-40), geen empirisch geverifieerd optimum — er was geen live data beschikbaar om
dit te toetsen. Aanbevolen: na een paar weken `/api/debug/volumecorrectie-log` checken of
`tsbTeNegatief` nu wél triggert wanneer verwacht, en zo nodig verder bijstellen.

### Wat bewust ongewijzigd bleef

- `ctlRampRegressie()` zelf blijft bestaan in `src/lib/conditie.js` — na deze wijzigingen heeft
  hij geen enkele aanroeper meer in productiecode (alleen een prosaïsche vermelding in een
  `ef.js`-comment, geen functionele afhankelijkheid). Bewust niet verwijderd om de diff gericht
  te houden op de gevraagde fix; kandidaat voor een aparte opschoning later.
- `belastingsStatus()`-drempels (1.5-5.0/week) en `tsbTePositief`/`rampTeHoog`/`rampTeLaag` in
  `volumeCorrectie.js` blijven ongewijzigd — alleen `tsbTeNegatief` is aangepast, zoals gevraagd.

### Verificatie

`npx vitest run` → **580/580 tests slagen**. Geen testdekking bestaat specifiek voor
`bepaalVolumeCorrectie`/`haalRampRate` (geen test brak, maar er was ook niets dat dit gedrag al
verifieerde) — de enige harde verificatie van het `rampRate`-veld zelf en van het effect van de
nieuwe `tsbTeNegatief`-drempel moet nog gebeuren met live intervals.icu-data.
