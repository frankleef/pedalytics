# Analyse: verschil tussen Kesto's "Lichte verbetering" en de externe conditie-analyse

Diagnose-rapport, geen codewijziging. Alle bevindingen in stap 1 zijn geciteerd uit de daadwerkelijke
code; er is nergens een aanname gedaan over welk venster Kesto gebruikt voordat dat in de code was
teruggevonden.

## Stap 1 — Wat Kesto daadwerkelijk doet (uit de code)

### Kernbestand
`src/lib/conditie.js` — puur deterministisch, **geen AI/LLM-aanroep**. Geverifieerd door de hele repo
te doorzoeken op `ANTHROPIC_API_KEY`, `api.anthropic.com`, `@anthropic-ai/sdk`: geen treffers. De
enige "Claude"-vermelding in de codebase is een comment dat bevestigt dat sessiegeneratie *niet meer*
via Claude loopt (`src/lib/sessie-generatie.js:424`).

### Input-metrics
- **CTL** (chronic training load, uit intervals.icu `wellness`) — weegt **50%**
- **RPE-delta-trend** (afwijking tussen verwachte en ervaren zwaarte van trainingen, laatste 10
  sessies, `src/lib/sessie/rpeTrend.js`) — weegt **35%**
- **Cardiac decoupling** (Pw:Hr-drift, mediaan van Z2-ritten) — weegt **15%**
- **eFTP wordt niet gebruikt** in de conditiescore — bevestigd, komt nergens voor in
  `berekenConditieScore()`.

```js
// src/lib/conditie.js:57-65
export function berekenConditieScore({ ctl_nu, ctl_4w_geleden, rpe_delta_trend, decoupling_huidig, decoupling_vorig }) {
  const bijdragen = [];
  if (ctl_nu != null && ctl_4w_geleden != null) bijdragen.push({ score: normaliseerCtlRichting(ctl_nu, ctl_4w_geleden), gewicht: 0.50 });
  if (rpe_delta_trend != null && rpe_delta_trend !== 0) bijdragen.push({ score: normaliseerRpeDelta(rpe_delta_trend), gewicht: 0.35 });
  if (decoupling_huidig != null && decoupling_vorig != null) bijdragen.push({ score: normaliseerDecoupling(decoupling_huidig, decoupling_vorig), gewicht: 0.15 });
  if (!bijdragen.length) return null;
  const totaalGewicht = bijdragen.reduce((s, b) => s + b.gewicht, 0);
  return bijdragen.reduce((s, b) => s + b.score * b.gewicht, 0) / totaalGewicht;
}
```

Belangrijk detail: het gewicht wordt herverdeeld over de wél-beschikbare signalen (deling door
`totaalGewicht`, niet door 1.0). Als bijvoorbeeld decoupling ontbreekt, telt CTL voor 50/85 ≈ 59% en
RPE voor 35/85 ≈ 41%. Als RPE en decoupling allebei ontbreken, bepaalt CTL de score voor 100%.

### Vergelijkingsvenster — de kernvraag

**CTL: vast venster van 28 dagen, geankerd op "vandaag"** — geen 7-vs-7, geen "sinds accountaanmaak".

```js
// src/app/api/cron/sync/route.js:208 (en analoog op regel 518-519, 553)
const wellData = await intervalsGet("/wellness", { oldest: datumOffset(-28), newest: datumOffset(0) }, { apiKey, athleteId });
...
// regel 211-213
const ctlW = wellData.filter(w => w.ctl != null).sort((a,b) => (a.id||"").localeCompare(b.id||""));
ctlNu = ctlW.length > 0 ? ctlW[ctlW.length - 1].ctl : null;
ctl4wGeleden = ctlW.length > 0 ? ctlW[0].ctl : null;
```

`ctl_4w_geleden` is dus **niet gegarandeerd exact 28 dagen geleden** — het is het eerste datapunt met
een niet-lege `ctl`-waarde binnen die 28-dagen-fetch. Bij gaten in de wellness-data (bv. geen sync
vóór een bepaalde datum) kan dit venster in de praktijk korter zijn dan 28 dagen.

**Decoupling: mediaan van laatste 3 Z2-ritten vs. mediaan van de 3 daaraan voorafgaande Z2-ritten**
(niet tijd-gebaseerd, maar rit-gebaseerd — een trage periode met weinig lange ritten kan dit venster
over veel meer kalenderdagen laten uitstrekken):

```js
// src/app/api/cron/sync/route.js:230-231
if (dcAlleWaarden.length >= 3) dcHuidigUp = dcAlleWaarden.slice(-3).sort((a,b)=>a-b)[1];
if (dcAlleWaarden.length >= 6) dcVorigUp = dcAlleWaarden.slice(-6, -3).sort((a,b)=>a-b)[1];
```

Een rit komt alleen in deze pool als hij aan **Kesto's eigen eligibiliteitsfilter** voldoet, gezet bij
het cachen van de decoupling-waarde:

```js
// src/app/api/cron/sync/route.js:396-400
const duurMin = (rit.moving_time || 0) / 60;
if (duurMin < 45) continue;
const np = rit.icu_weighted_avg_watts;
const ritFtp = plan.huidige_ftp || 265;
if (!np || (np / ritFtp) < 0.55 || (np / ritFtp) > 0.75) continue;
```
Dus: **duur ≥45 min, intensiteitsfactor (IF) tussen 0,55 en 0,75** (op basis van hele-rit
`icu_weighted_avg_watts`, niet per-helft). Code-comment bevestigt expliciet dat hier géén
hitte-filter op wordt toegepast voor de conditiescore: *"Decoupling medianen voor conditiescore: GEEN
filter (ruwe waarden)"* (`sync/route.js:218`).

### Labeldrempels

```js
// src/lib/conditie.js:41-44 (CTL-normalisatie)
export function normaliseerCtlRichting(ctl_nu, ctl_4w_geleden) {
  const delta = ctl_nu - ctl_4w_geleden;
  return Math.max(-1, Math.min(1, delta / 10));   // ±10 CTL-punten = volledig verzadigd
}

// src/lib/conditie.js:67-74
export function conditieStatus(score) {
  if (score > 0.3) return "groeit";          // → label "Conditie groeit"
  if (score > 0.1) return "lichte_groei";    // → label "Lichte verbetering"
  if (score > -0.1) return "stabiel";
  if (score > -0.3) return "lichte_daling";
  return "daalt";
}
```

Er bestaat **geen apart label "significante verbetering"** in Kesto. De labelset kent maar twee
positieve tiers: "Lichte verbetering" (score 0,1–0,3) en "Conditie groeit" (score >0,3, plafond).
Een score van 0,31 en een score van 1,0 (theoretisch maximum) krijgen exact hetzelfde label. Het enige
tekstuele equivalent van "sterk"/"significant" zit niet in de score-labels zelf maar in een losse
contextzin in `VoortgangTab.js:51`:
```js
if (conditie === "groeit" && ctlDelta4w >= 8) return `Je fitheid stijgt sterk — ${ctlDelta4w} punten in 4 weken. Houd dit vast.`;
```
Dit is puur een UI-tekst, geen apart statuslabel, en gebruikt bovendien een eigen, lokaal berekende
28-dagen CTL-delta (array-index-gebaseerd, `VoortgangTab.js:144-149`) — niet noodzakelijk identiek aan
`ctl_4w_geleden` uit de KV-cache.

Bron voor dit alles: `src/lib/conditie.js` (volledig gelezen), `src/app/api/cron/sync/route.js`
(regels 195-240, 380-455, 500-570), `src/lib/decoupling.js`, `design/IMPLEMENTATIE.md` sectie 31-D
(regel ~3760-3920, komt overeen met de code) en sectie 32-F/32-G (regel ~4186-4264, hitte-uitleg).

## Stap 2 — De externe analyse (referentie, ander venster)

- **CTL:** 45,4 (18 mei) → 59,5 (6 juli) = +14,1 punten / **+31%** over **49 dagen** (7 weken).
- **Decoupling:** 5 lange duurritten (>90 min, IF <0,75), split-half NP/gem.HR. Trend ~7% (eind mei)
  → ~0-4% (eind juni/begin juli).
- eFTP bewust niet als primaire indicator gebruikt.
- 1-17 mei uitgesloten wegens ontbrekende data.
- Venster (18 mei – 6 juli) is een eigen, op datakwaliteit gebaseerde keuze — niet per se Kesto's
  venster.

## Stap 3 — Vergelijking

| | Kesto | Externe analyse |
|---|---|---|
| CTL-venster | vast, 28 dagen, geankerd op "vandaag" (rolling) | 49 dagen, geankerd op een handmatig gekozen startdatum (18 mei) |
| Decoupling-venster | laatste 3 vs. voorlaatste 3 *ritten* die voldoen aan 45min+/IF 0,55-0,75 | 5 ritten >90 min, IF <0,75, over het hele 49-dagen venster |
| Extra signaal | RPE-delta-trend, 35% gewicht | niet gebruikt |
| eFTP | niet gebruikt in de score | bewust niet als primair gebruikt (bevestigt dit als niet-discrepantie) |
| Labelvocabulaire | 2 positieve tiers, plafond bij score >0,3 ("Conditie groeit"), geen "significant"-tier | continue/statistische beoordeling van significantie |

**Is het venster hetzelfde?** Nee. Kesto's venster is bijna de helft korter (28 vs. 49 dagen) én
altijd geankerd op "vandaag", terwijl het externe venster een vaste startdatum heeft die is gekozen op
basis van datakwaliteit. Concreet: Kesto's "4 weken geleden" valt rond **~8 juni**, drie weken *na*
het startpunt van de externe analyse (18 mei). Als een relevant deel van de CTL-stijging van 45,4 →
59,5 in de eerste 3 weken van het externe venster (18 mei – ~8 juni) plaatsvond, dan ziet Kesto's
28-dagen-venster structureel een kleiner deel van diezelfde stijging — puur door venstergrootte, niet
door een fout in de metriek zelf.

**Zou Kesto op mijn venster tot een ander label komen?** Reken dit door met Kesto's eigen formule: als
CTL het enige beschikbare signaal is (RPE/decoupling onbekend of neutraal), dan is
`score = clamp(delta/10, -1, 1)`. Bij een delta van +14,1 over 49 dagen zou dat een score van
**+1,0 (verzadigd)** geven → label **"Conditie groeit"**, ruim boven de "Lichte verbetering"-drempel
(0,1-0,3). Voor "Lichte verbetering" via CTL alleen is een delta van slechts **+1 tot +3 CTL-punten**
nodig over het gehanteerde venster — een orde van grootte kleiner dan de externe +14,1 over 49 dagen.
Dat betekent: als Kesto's eigen 28-dagen-delta voor deze gebruiker inderdaad in de buurt van die 1-3
punten ligt, is dat een sterke aanwijzing dat het gros van de stijging buiten Kesto's 28-dagen-venster
viel (dus vóór ~8 juni).

**Vallen de externe cijfers over Kesto's drempels heen?** CTL +31% (of +14,1 absoluut) zou, over
Kesto's eigen venster toegepast, ruimschoots boven de 0,3-drempel voor "groeit" uitkomen. De
decoupling-daling (7% → 0-4%) zou via `normaliseerDecoupling()`
(`verbetering = (vorig-huidig)/vorig`, ×4, clamped) eveneens een sterk positieve bijdrage geven —
bijvoorbeeld 7%→2% is een relatieve verbetering van ~71%, ver boven het verzadigingspunt van 25% dat al
tot de maximale bijdrage van 1,0 leidt. Beide externe signalen zouden dus, toegepast op Kesto's eigen
formules, comfortabel in de "groeit"-band vallen — niet slechts "lichte verbetering".

**Ontbrekend signaal:** het derde en op-één-na-zwaarste signaal in Kesto's score, RPE-delta-trend
(35% gewicht), zit helemaal niet in de externe analyse. Als dit signaal voor deze gebruiker op dit
moment neutraal-tot-negatief staat (trainingen voelen zwaarder dan verwacht, bv. door een recent zwaar
blok), kan het een overigens sterk CTL-signaal verdunnen. Met CTL-only op maximale bijdrage (1,0 ×
0,50 = 0,50) zou zelfs een sterk negatieve RPE-bijdrage (−1,0 × 0,35 = −0,35) de samengestelde score nog
op (0,50 − 0,35 + 0)/0,85 ≈ **0,18** brengen — dat valt precies in de **"lichte_groei"**-band
(0,1-0,3). Dit is een plausibel, met de code onderbouwd mechanisme dat het verschil kan verklaren,
maar of dit ook daadwerkelijk gebeurt hangt af van de actuele `rpe_delta_trend`-waarde voor deze
gebruiker, die ik vanuit deze sessie niet kan inzien (geen productie/KV-toegang).

## Stap 4 — Concrete bevindingen (uitsluitend met code/spec onderbouwd)

1. **Geen bug, wel een reëel methodologisch verschil in vensterlengte en -positionering.** Kesto
   gebruikt een vast, rolling 28-dagen CTL-venster; de externe analyse een 49-dagen venster met een
   handmatig gekozen startdatum. Dit is een ontwerpkeuze in de code (`sync/route.js:208`,
   `datumOffset(-28)`), geen fout — maar het verklaart waarom eenzelfde onderliggende trend tot een
   ander label kan leiden: Kesto "ziet" per definitie minder van een geleidelijke, over 7 weken
   uitgesmeerde stijging dan een analyse die het hele venster bekijkt.
2. **RPE-delta-trend (35% gewicht) is een blinde vlek in de externe vergelijking**, niet omdat de
   externe analyse fout is, maar omdat ze een ander doel had. Zoals hierboven doorgerekend kan dit
   signaal alleen al een verzadigde CTL-score van "groeit" naar "lichte verbetering" trekken.
3. **Kesto's labelvocabulaire heeft geen "significant"-tier.** `conditieStatus()` kent een plafond:
   alles boven score 0,3 heet "Conditie groeit", ongeacht hoe ver boven 0,3 de score zit. Zelfs als
   Kesto's berekening dezelfde trend als significant zou "voelen", zou de UI dat nooit anders melden
   dan "Conditie groeit" — nooit "sterk" of "significant". Vergelijking van labels tussen de twee
   analyses is dus deels een vocabulaire-mismatch, niet alleen een datamismatch.
4. **Decoupling-eligibiliteit verschilt methodologisch**: Kesto accepteert ritten vanaf 45 minuten met
   IF tussen 0,55 en 0,75 (whole-ride NP/FTP), zonder hitte-filter voor dit specifieke gebruik
   (expliciet gecomment als "GEEN filter"). De externe analyse gebruikte >90 minuten, IF <0,75 (geen
   ondergrens) over 5 specifiek geselecteerde ritten. Beide zijn redelijke keuzes, maar niet
   uitwisselbaar — bij weinig kwalificerende ritten kan Kesto's smallere/rit-gebaseerde venster (3
   vs. 3 ritten in plaats van 5 over 7 weken) gevoeliger zijn voor een individuele uitschieter.
5. **`ctl_4w_geleden` is geen gegarandeerd exact 28-dagen-oud datapunt** maar het eerste beschikbare
   punt binnen de 28-dagen-fetch (`ctlW[0]`, `sync/route.js:213`). Bij dataverlies of een late eerste
   sync kan dit venster in de praktijk korter zijn dan 28 dagen, wat de gemeten delta verder kan
   verkleinen. Of dit voor deze gebruiker speelt is niet uit de code af te leiden — vereist de
   werkelijke wellness-reeks.

### Wat niet met zekerheid vast te stellen is vanuit deze sessie

Ik heb geen toegang tot de productie-KV-cache of intervals.icu-data van deze gebruiker, dus ik kan
niet bevestigen wat de daadwerkelijke `ctl_nu`, `ctl_4w_geleden` en `rpe_delta_trend`-waarden op 6 juli
waren die tot "Lichte verbetering" leidden. Er bestaat een admin-only debug-endpoint dat dit exact
teruggeeft per dag over de laatste ~90 dagen, inclusief het label dat Kesto voor elke dag zou hebben
gegeven:

```
GET /api/debug/conditiescore-historie?userId=<id>
```
(`src/app/api/debug/conditiescore-historie/route.js`, alleen toegankelijk als
`user.id === process.env.ADMIN_USER_ID`). Dit endpoint retourneert `ctl`, `ctl_4w_geleden`,
`ctl_delta`, `conditie_score`, `conditie` en `pill_label` per dag — hiermee is stap 3 met echte cijfers
te verifiëren in plaats van met de bovenstaande worst-case/best-case doorrekening.
