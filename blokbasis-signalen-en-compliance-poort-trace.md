# Trace: aansluiting decoupling/EF-trend/HRV-baseline-drift + D1-compliance-poort op `bepaalNieuweBlokBasis`

Feitelijke code-trace, geen beoordeling, geen ontwerp. Alle citaten `bestand:regelnummer`.

## Context (bevestigd, herverifieerd)

- `voerHerstelweekEvaluatieUit`/`bepaalNieuweBlokBasis` (`volumeCorrectie.js:559-687`) draait elke 4 weken, aangeroepen vanuit `cron/sync/route.js:305,394,934`.
- `decouplingMediaan` wordt al aangevoerd maar genegeerd: `volumeCorrectie.js:209`, `void decouplingMediaan; // signaal beschikbaar voor toekomstig gebruik`.
- `bepaalNieuweBlokBasis` combineert per-blok-groei-per-ervaringsniveau (regel 243-247) met `bepaalVolumeCorrectie`-aanpassing (±5-12%, regel 252-257), geclamped op ±20% (regel 259-261).
- `ef_trend:${userId}:${band}` bestaat (`ef.js`), tot nu toe uitsluitend gelezen door de GET-route `api/ef-trend/route.js` — geen decision-pad.
- `hrv_trend:${userId}`/`rhr_trend:${userId}` bestaan (`basislijnTrend.js`, B6), tot nu toe alleen gebruikt voor de dagelijkse laag-1-trigger (`bepaalHrvTrendTrigger`/`bepaalRhrTrendTrigger`), nog niet op blokniveau.
- `evalueerComplianceGate` (D1, `compliance.js`) wordt vandaag alleen aangeroepen vanuit `cron/sync/route.js`'s fase-overgangsblok (rond regel 786-915) — NIET vanuit `voerHerstelweekEvaluatieUit`.

## 1. Exacte huidige signalen in `bepaalNieuweBlokBasis`

Volledige functies, `volumeCorrectie.js:196-262`:

```js
196  export async function haalVolumeSignalen(userId) {
197    const [rampRate, tsbGemiddelde14d, rpeDeltaTrend, decouplingMediaan] = await Promise.all([
198      haalRampRate(userId),
199      haalTsbGemiddelde(userId, 14),
200      haalRpeDeltaTrend(userId),
201      haalDecouplingMediaan(userId, 3),
202    ]);
203    return { rampRate, tsbGemiddelde14d, rpeDeltaTrend, decouplingMediaan };
204  }
...
208  export function bepaalVolumeCorrectie({ rampRate, tsbGemiddelde14d, rpeDeltaTrend, decouplingMediaan }) {
209    void decouplingMediaan; // signaal beschikbaar voor toekomstig gebruik
211    const rampTeLaag      = rampRate !== null && rampRate < 2.0;
212    const rampTeHoog      = rampRate !== null && rampRate > 7.0;
214    const tsbTePositief   = tsbGemiddelde14d !== null && tsbGemiddelde14d > 5;
221    const tsbTeNegatief   = tsbGemiddelde14d !== null && tsbGemiddelde14d < -20;
222    const adaptatieSlecht = rpeDeltaTrend !== null && rpeDeltaTrend > 1.0;
224    const omhoog = (rampTeLaag || tsbTePositief) && !adaptatieSlecht && !tsbTeNegatief;
225    const omlaag = tsbTeNegatief || (rampTeHoog && adaptatieSlecht);
227-230  if (omhoog) { ... pct 0.05/0.07/0.12 ... }
233-236  if (omlaag) { ... pct 0.05/0.08/0.12 ... }
239    return { richting: "geen", pct: 0 };
242  export function bepaalNieuweBlokBasis({ huidigePiekweekTss, signalen, ervaringsniveau, blokIndex }) {
243-247  const interBlokGroei = { starter:[0.08,0.08], recreatief:[0.10,0.12], getraind:[0.12,0.15] }[ervaringsniveau] || [0.10,0.12];
249    const gepland = interBlokGroei[Math.min(blokIndex, interBlokGroei.length - 1)];
250    let nieuweBasis = huidigePiekweekTss * (1 + gepland);
252-257  const correctie = bepaalVolumeCorrectie(signalen); nieuweBasis *= (1 ± correctie.pct);
259-261  clamp op [huidigePiekweekTss*0.80, huidigePiekweekTss*1.20]
262  }
```

Drie signalen sturen daadwerkelijk het `omhoog/omlaag/geen`-besluit: **rampRate** (drempels 2.0/7.0), **tsbGemiddelde14d** (drempels +5/-20/+15/+8/-30), **rpeDeltaTrend** (drempel 1.0). **decouplingMediaan** is aangevoerd maar op regel 209 letterlijk `void`-ed — puur ontvangen, niet gebruikt. De ervaringsniveau/blokIndex-groeicurve (regel 243-250) is volledig signaalvrij (vaste percentages), de correctie zelf (±5/7/8/12%) wordt daarna vermenigvuldigd, en het geheel wordt op ±20% van `huidigePiekweekTss` geclamped.

## 2. EF-trend per band — databeschikbaarheid op het moment van draaien

`haalEfTrendOp(kv, userId, band)` (`ef.js:63-65`) is een **pure KV-read** (`kv.get(efTrendKey(userId, band))`), geen nieuwe fetch/berekening nodig. `kv`/`userId` zijn al in scope in alle drie de aanroeppunten van `voerHerstelweekEvaluatieUit` — `cron/sync/route.js:305,394,934` (het functie-eigen `getKV()` in `volumeCorrectie.js:560` maakt een eigen kv-instantie, maar dat is dezelfde onderliggende KV-store).

Voor het "nieuwe activiteit"-pad specifiek (regel 934) blijkt bovendien dat `verwerkRitVoorEf` (`cron/sync/route.js:652`, binnen dezelfde functie/tak) **vóór** regel 934 al loopt — dus de EF-trend van de nét gesynchroniseerde ritten van déze cronrun is al bijgewerkt tegen de tijd dat `voerHerstelweekEvaluatieUit` op regel 934 draait. Voor de twee andere paden (regel 305: geen nieuwe rit, regel 394: idempotent) is er sowieso geen nieuwe EF-data deze cyclus; de reeks bevat dan gewoon de historische opbouw van eerdere cronruns/backfill.

## 3. HRV/RHR-trend op blokniveau

`hellingPerWeek` (`trend.js:17-30`, `berekenLineaireTrendPerWeek`) en de boolean-trigger (`basislijnTrend.js:90-103`, `bepaalTrendTrigger`) delen **exact dezelfde databron en dezelfde minimumdrempel**: `berekenLineaireTrendPerWeek` retourneert `null` bij `< 4 punten` (`trend.js:17`), en `bepaalTrendTrigger` roept die functie rechtstreeks aan (`basislijnTrend.js:93`) — er is dus geen scenario waarin de boolean bruikbaar is maar `hellingPerWeek` niet.

Punten worden **één per week** toegevoegd tijdens de bestaande maandag-only cron-pas (`basislijnTrend.js:63-66,72-75` — comment bevestigt dit expliciet), niet per blok gereset, gecapt op de laatste 20 (`CAP_DATAPUNTEN`, regel 31). Bij een gloednieuw plan levert het **eerste** blok (4 weken, blokIndex 0) dus **precies 4 punten** op — exact op de ondergrens van de functie zelf, aannemend geen gemiste weken. Elk volgend blok heeft strikt méér accumulatie (tot de cap van ~20 weken/5 blokken). Het venster is dus niet principieel te kort voor een blok-brede trend, maar voor het allereerste blok zit de data-toereikendheid precies op de rand die de bestaande functie zelf al hanteert.

## 4. Exacte integratieplek voor D1's compliance-poort

`evalueerComplianceGate(userId, plan, complianceVerlengdCount = 0)` (`compliance.js:381`) is zelfstandig: het gebruikt intern `faseStartdatum(plan)` en zijn eigen KV-toegang via `haalComplianceVenster`. `plan` en `userId` zijn al lokale variabelen **binnen `voerHerstelweekEvaluatieUit` zelf** — `userId` is het functieparameter, `plan = await kv.get(planKey)` op `volumeCorrectie.js:563`. De aanroep kan dus **volledig binnen `volumeCorrectie.js` zelf** geplaatst worden (bijvoorbeeld vlak na regel 563-567, of vlak vóór `haalVolumeSignalen` op regel 591) — er is **geen wijziging nodig** aan de drie cron/sync/route.js-aanroeppunten (305/394/934) zelf, want die geven alleen `userId` door.

Het bestaande `compliance_verlengd_count`-veld/anker (`haalFaseGebondenTeller(plan, "compliance_verlengd_count", "compliance_verlengd_count_faseAnker")`, al gebruikt op `cron/sync/route.js:52,832`) is de bestaande, herbruikbare tellerinfrastructuur — momenteel gekoppeld aan de fase-overgang-uitstelbeslissing, niet aan een blokniveau-teller.

## 5. Gedrag bij onvoldoende compliance — bestaand precedent

Er bestaat **geen** "inconclusief"/uitstel-precedent op dít specifieke aanroeppunt: `voerHerstelweekEvaluatieUit` heeft vandaag alleen structurele early-returns (`!plan?.kader || !plan.startdatum`, regel 564; `blokOpbouwWeken.length === 0`, regel 582) — geen signaalkwaliteits-gebaseerde skip. `checkFaseOvergang`'s "uitstel" (fase-transitie een week uitstellen) is een ander mechanisme met een andere consequentie (extra week invoegen) en heeft geen equivalent binnen deze functie.

Wat wél al bestaat als precedent voor "signaal ontbreekt → gracieus negeren zonder de rest te blokkeren": `bepaalVolumeCorrectie`'s eigen `!== null`-guards per signaal (`volumeCorrectie.js:211,212,214,221,222`) — elk signaal dat `null` is, telt simpelweg niet mee in de `omhoog`/`omlaag`-voorwaarden, zonder de andere signalen of de hele functie te blokkeren. Er is geen bestaand `status: "onvoldoende_data"`-patroon (zoals in `berekenCtlTrend`/`berekenDecouplingTrend`, `fitnessprogressie.js:53,58,85`) binnen `volumeCorrectie.js` zelf.

## 6. Testdekking van het bestaande mechanisme

**Geen enkele automatische test** gevonden: `find src -iname "*volumecorrectie*"` levert alleen `src/lib/volumeCorrectie.js` zelf en drie API-routes op (`api/volumecorrectie/hereval`, `api/admin/test-volumecorrectie`, `api/debug/volumecorrectie-log`) — geen `__tests__`-bestand. `grep` op `bepaalNieuweBlokBasis`/`voerHerstelweekEvaluatieUit`/`bepaalVolumeCorrectie`/`haalVolumeSignalen`/`bepaalVolumeAanpassing` in `*.test.js` geeft nul treffers.

Ter controle: `api/admin/test-volumecorrectie/route.js` roept, ondanks de naam, niets uit `volumeCorrectie.js` aan (het roept `vulSessiesAanVoorGebruiker` uit `sessiesAanvullen.js` aan); `api/debug/volumecorrectie-log/route.js` is een pure KV-log-viewer. Geen van beide is een test. Dit betekent: `bepaalNieuweBlokBasis`/`voerHerstelweekEvaluatieUit`, al maandenlang in productie, heeft vandaag **nul regressiebescherming** — elke wijziging hier introduceert risico zonder bestaand vangnet.
