# Simulatie: effect van de tsbTeNegatief-drempelwijziging (-30 → -20) op echte data

Vervolg op `ramp-rate-fix-en-impact.md`. Geen permanente codewijziging — alleen een tijdelijk
testbestand dat de échte functies (`haalVolumeSignalen`, `bepaalVolumeCorrectie`) met live data
heeft aangeroepen, en een tijdelijke (direct teruggedraaide) drempelwijziging om de oude (-30/-40)
en nieuwe (-20/-30) situatie A/B te vergelijken. Testbestand is verwijderd, `volumeCorrectie.js`
staat weer exact in de staat van de vorige fix, alle 580 tests slagen.

## Wat wel/niet lokaal draaibaar bleek

- **KV-toegang (Upstash)**: werkt direct via `KV_REST_API_URL`/`KV_REST_API_TOKEN` uit
  `.env.local` — dit is echte, live productiedata (bevestigd: het opgehaalde seizoensplan is een
  reëel 16-weken kader, gestart 20 juni 2026, recreatief, FTP 273 — geen testdata).
- **`getIntervalsCredentials(userId)`** (de normale KV-gebaseerde credential-resolutie) werkt
  lokaal **niet**: `ENCRYPTION_KEY` in `.env.local` is leeg, dus decryptie van de opgeslagen
  intervals.icu-sleutel faalt. Opgelost door in de test uitsluitend de credential-resolutiestap
  te vervangen (via `vi.mock` op `getIntervalsCredentials`) door de directe env-vars
  `INTERVALS_API_KEY`/`INTERVALS_ATHLETE_ID` — alle fetch- en beslissingsfuncties zelf
  (`haalRampRate`, `haalTsbGemiddelde`, `haalRpeDeltaTrend`, `haalDecouplingMediaan`,
  `bepaalVolumeCorrectie`) zijn ongewijzigd en rechtstreeks aangeroepen, niet nagebouwd.
- **Eerste poging**: `INTERVALS_API_KEY` gaf `401 Auth failed` — een echte auth-afwijzing van
  intervals.icu, geen parseerfout (de `athleteId` uit dezelfde parsing kwam wél correct door als
  `i594622`). Na het bijwerken van de key door u werkte de call meteen.
- **Bijkomende bevinding**: dit bevestigt definitief dat intervals.icu's `rampRate`-veld
  daadwerkelijk wordt teruggegeven zodra `fields` het expliciet opvraagt — de onzekerheid die in
  `ramp-rate-fix-en-impact.md` Deel A nog openstond ("kan niet 100% bevestigen zonder live
  API-call") is hiermee opgelost.

## Live signalen (12 juli 2026, via `haalVolumeSignalen("u_frank_001")`)

```json
{"rampRate":6.164112,"tsbGemiddelde14d":-6.4,"rpeDeltaTrend":-0.39,"decouplingMediaan":2.8482582608054994}
```

Ruwe wellness-context (laatste 3 dagen, rechtstreeks van intervals.icu):
```json
[{"id":"2026-07-10","ctl":53.22,"atl":58.64,"rampRate":2.19},
 {"id":"2026-07-11","ctl":53.67,"atl":60.42,"rampRate":-0.99},
 {"id":"2026-07-12","ctl":59.53,"atl":92.71,"rampRate":6.16}]
```
CTL 59,53 op 12 juli sluit aan bij de eerder gevonden 59,5 op 6 juli (`conditie-verbetering-analyse.md`)
— consistente doorgroei. Noemenswaardig: `rampRate` springt van **-0.99 naar +6.16** in twee dagen
— dit bevestigt empirisch de aanname uit Deel A dat intervals.icu's punt-op-punt `rampRate` veel
volatieler is dan de oude 28-dagen-regressie, wat de fix inhoudelijk onderbouwt.

## Resultaat: oude drempel (-30/-40) vs. nieuwe drempel (-20/-30)

| Drempel | `tsbTeNegatief` | `richting` | `pct` |
|---|---|---|---|
| Oud (-30 / tier -40) | `false` (-6.4 is niet < -30) | `"geen"` | `0` |
| Nieuw (-20 / tier -30) | `false` (-6.4 is niet < -20) | `"geen"` | `0` |

**Identiek resultaat.** Voor de huidige, echte situatie maakt de drempelverlaging **geen enkel
verschil** — met beide drempels is `richting: "geen"`.

**Waarom**: `tsbGemiddelde14d = -6.4` ligt ruim binnen de neutrale zone. Zelfs de oorspronkelijke,
vóór-26-juni-drempel van -10 (nog strenger dan -20) zou hier niet triggeren. Ook `rampTeLaag`
(rampRate 6,16 < 2,0? nee) en `rampTeHoog` (6,16 > 7,0? nee) zijn beide `false`, en
`adaptatieSlecht` (rpeDeltaTrend -0,39 > 1,0? nee) is ook `false`. Dus `omhoog` en `omlaag` zijn
beide `false` ongeacht de drempel → `"geen"`.

## Concreet effect als de eerstvolgende wekelijkse evaluatie (aankomende zondag) nu zou draaien

Met `richting: "geen"` doet `voerWekelijkseEvaluatieUit()` het volgende (`volumeCorrectie.js:472-481`,
ongewijzigd door de drempel):
- Geen aanpassing van `tss_doel` — het geplande TSS-budget van de aankomende week blijft exact
  zoals in het kader staat.
- Geen `acties` (geen nieuwe trainingsdag, geen sessieverlenging, geen tempo-afsluiter) — die
  logica wordt alleen bereikt bij `richting === "omhoog"`.
- Wel wordt er gelogd (`volumecorrectie_log:{userId}:{week}`) en het weekvlag gezet, zoals bij
  elke uitkomst.

Dit geldt **voor beide drempels identiek** — de -20-wijziging verandert dit weekend niets aan wat
er zou gebeuren.

## Wat dit wel en niet bewijst

- **Wel bewezen**: voor de huidige TSB-situatie (12 juli 2026, gemiddeld -6,4 over 14 dagen) maakt
  -20 t.o.v. -30 geen verschil — beide zijn ver van de daadwerkelijke waarde verwijderd.
- **Niet bewezen**: of -20 een beter/correcter afkappunt is dan -30 in een scenario waarin de
  gebruiker daadwerkelijk diep in het rood zit (bv. na een zware trainingsblok-piekweek). Dat kon
  ik niet simuleren zonder gefabriceerde data, en dat was expliciet niet de bedoeling. Dit is dus
  nog steeds een **beargumenteerde tussenwaarde, geen empirisch geverifieerd optimum** voor het
  scenario waar het vangnet daadwerkelijk voor bedoeld is.
- **Aanbeveling**: check `/api/debug/volumecorrectie-log?userId=u_frank_001` over een paar weken,
  met name na de eerstvolgende piekweek/opbouwperiode in het huidige blok (kader loopt door tot
  week 16, gestart 20 juni) — dat is het moment waarop `tsbGemiddelde14d` dichter bij een van
  beide drempels kan komen en het verschil wél zichtbaar zou worden.

## Opruiming

- Tijdelijk testbestand `src/lib/__tests__/tsb-drempel-simulatie.manual.test.js` aangemaakt,
  gebruikt, en verwijderd.
- `src/lib/volumeCorrectie.js` tijdelijk teruggezet naar -30/-40 voor de vergelijking, direct
  daarna teruggezet naar -20/-30 (de staat uit `ramp-rate-fix-en-impact.md`). Geverifieerd met
  `grep` dat er geen restanten (`TIJDELIJK`-comments) zijn achtergebleven.
- `npx vitest run`: **580/580 tests slagen**.
- Geen KV-schrijfacties uitgevoerd — alle aanroepen (`haalVolumeSignalen`, `bepaalVolumeCorrectie`,
  `kv.get`) zijn puur lezend. Er is niets aan het echte seizoensplan of de sessies gewijzigd.
