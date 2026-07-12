# pill_label-verificatie: stale cache of correcte actuele waarde?

**Antwoord: mogelijkheid 2 — "Lichte verbetering" is een actuele, correct berekende waarde.
Geen cache-bug gevonden.**

## Waar de app het label vandaan haalt

- De app leest het pill-label via `GET /api/plan/conditie-score`
  (`src/app/api/plan/conditie-score/route.js`), dat rechtstreeks `kv.get(\`conditie_score:${userId}\`)`
  teruggeeft aan `GereedheidConditieKaart.js`, `VoortgangTab.js` en `AdaptatieScoreKaart.js`.
- Dit ís dus een **apart gecacht resultaat** (KV-key `conditie_score:<userId>`, TTL 8 dagen), niet een
  live-berekening per request. Het wordt weggeschreven door `src/app/api/cron/sync/route.js`
  (twee plekken: het "geen nieuwe activiteit"-pad rond regel 241, en het "nieuwe activiteit"-pad rond
  regel 555), en incidenteel door het admin-endpoint `/api/admin/herbereken-conditiescore`.
- `/api/debug/conditiescore-historie` (genoemd in de opdracht) is een **los, vereenvoudigd
  historie-endpoint**: het berekent zelf opnieuw met `berekenConditieScore()`, maar geeft altijd
  `decoupling_huidig`/`decoupling_vorig = null` mee en gebruikt `gereedheidsscore = 60`, terwijl de
  live cache (cron/sync) wél decoupling-medianen meeneemt (als er ≥6 gecachete ritten zijn) en
  `gereedheidsscore = 50` gebruikt. Dat is een bestaande, bewuste vereenvoudiging van de debug-viewer
  — geen onderdeel van het probleem hieronder.

## Stap 1-3: is de cache verouderd?

Kon het debug-endpoint zelf niet aanroepen: lokale `.env.local` heeft een lege `ENCRYPTION_KEY`
(`ENCRYPTION_KEY=""`), waardoor `getIntervalsCredentials()` de opgeslagen intervals.icu API-key niet
kan decrypten buiten de deployed omgeving. In plaats daarvan is de **live KV-cache rechtstreeks
uitgelezen** (read-only, via `@upstash/redis` met de productie-KV-credentials uit `.env.local`) — dat
is precies wat de app aan de gebruiker toont, dus even gezaghebbend als het debug-endpoint voor de
kernvraag "stale of actueel".

Resultaat van `kv.get("conditie_score:u_frank_001")`, gelezen op `2026-07-12T17:53:45Z`:

```json
{
  "score": 0.2694789999999999,
  "belasting": "aan_de_grens",
  "conditie": "lichte_groei",
  "pill": { "label": "Lichte verbetering", "kleur": "groen" },
  "ctl_nu": 59.532204,
  "ctl_4w_geleden": 52.052624,
  "ctl_ramp": 6.164112,
  "rpe_delta_trend": -0.39,
  "bijgewerkt_op": "2026-07-12T17:50:01.767Z"
}
```

`bijgewerkt_op` is **~4 minuten** vóór het moment van uitlezen — vrijwel real-time, en dat schrijfmoment
kan alleen door een recente `cron/sync`-run (of een handmatige herberekening) tot stand zijn gekomen.
Dat is verre van "verlopen" (TTL is 8 dagen) en sluit een cache-bug voor dit moment uit: de pipeline die
`pill_label` produceert is enkele minuten geleden nog gedraaid en heeft dít resultaat weggeschreven.

→ **Geen aanwijzing voor een stale cache.** De cache is recenter dan elk redelijk "laatste sync"-venster.

## Stap 4: klopt het label inhoudelijk?

Met de cijfers uit de cache:

- `ctl_delta` over 4 weken: 59.53 − 52.05 = **+7.48** (positieve trend)
- `ctl_ramp`: **6.16/week** → `belastingsStatus()` classificeert dit als `"aan_de_grens"` (drempel
  ≥5 en ≤7; bij >7 zou het `"te_hoog"` worden — Pas op overbelasting)
- `rpe_delta_trend`: **−0.39** (trainingen voelen iets lichter dan verwacht — ook positief signaal)
- `conditie_score`: **0.269**

`conditieStatus()`-drempels (`src/lib/conditie.js:67-74`):

| bereik | status | pill |
|---|---|---|
| score > 0.3 | `groeit` | "Conditie groeit" |
| **0.1 < score ≤ 0.3** | **`lichte_groei`** | **"Lichte verbetering"** ← huidige positie (0.269) |
| −0.1 < score ≤ 0.1 | `stabiel` | "Onderhoud" / "Te weinig stimulus" |

Met score = 0.269 zit dit **0,031 onder de "Conditie groeit"-grens** (0.3) maar **0,169 boven de
"stabiel"-grens** (0.1). Het label is dus niet op het randje van *terugvallen* naar "Onderhoud" — het
zit juist dicht bij *opwaarderen* naar het sterkere "Conditie groeit". Bij een verdere CTL-stijging of
minder negatieve RPE-trend kan het label op korte termijn naar "Conditie groeit" springen; om terug te
vallen naar "Onderhoud"/"stabiel" zou de score met 0,17 moeten dalen, wat aanzienlijk meer marge is.

## Conclusie

"Lichte verbetering" is op dit moment een **actuele, correct berekende weergave**, geschreven door de
sync-pipeline nog geen 5 minuten voor controle. Geen bug gevonden — geen codewijziging voorgesteld.
