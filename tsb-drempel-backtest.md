# Waarom -10 → -30, en welke drempel klopt over de hele periode?

Vervolg op `tsb-drempel-simulatie.md`. Geen codewijziging — `volumeCorrectie.js` staat nog exact in
de staat van `ramp-rate-fix-en-impact.md` (-20/-30). Tijdelijk testbestand voor de backtest is na
gebruik verwijderd; 580/580 tests slagen.

---

## Deel 1 — waarom is de drempel op 26 juni gewijzigd?

### Gevonden: geen expliciete reden in commit message of documentatie

Commit `161a935` ("volume correctie", 26 juni 2026 09:13) wijzigt uitsluitend
`src/lib/volumeCorrectie.js` (18 regels, alleen de drempelconstanten en hun tier-checks) en heeft
als volledige commit message: **"volume correctie"** — geen toelichting. `git log` op
`design/IMPLEMENTATIE.md` rond 24-29 juni geeft **geen enkele treffer**: dit hele volumecorrectie-
systeem (in code-comments "sectie 38" genoemd) is nooit in de designdoc beschreven, dus er is ook
geen spec-sectie die de drempel motiveert. **Er is geen expliciete reden vastgelegd — dit is geen
gok, dit is wat er wel/niet in de geschiedenis staat.**

### Wel gevonden: sterk circumstantieel bewijs via de commit-tijdlijn

`src/lib/volumeCorrectie.js` bestaat pas sinds **26 juni 08:30** (commit `73192a1`, "fix rpe" —
een misleidende titel voor wat feitelijk de aanmaak van het hele bestand is, inclusief de
oorspronkelijke drempels `tsbPositief > 3` / `tsbNegatief < -10`). De precieze tijdlijn die dag:

| Tijd | Commit | Wat |
|---|---|---|
| 08:30 | `73192a1` | `volumeCorrectie.js` aangemaakt, incl. `tsbNegatief < -10` |
| 08:50 | `2e1623d` | "sectie 38: trigger-endpoint + forceer-parameter **voor handmatige test**" |
| 08:57 | `673e67b` | test-endpoint aangepast naar GET + CRON_SECRET (remote trigger) |
| 09:01 | `dd7cd8d` | "fix rpe" — wijzigt óók `test-volumecorrectie/route.js` |
| **09:13** | **`161a935`** | **drempel -10 → -30, tier -15 → -40, `tsbPositief` 3 → 5** |
| 09:26 / 09:42 | `8b8ed63` / `206d3e1` | verdere "fixes" aan `volumeCorrectie.js` |

Het patroon is: bouw de logica (08:30) → bouw er *expliciet* een handmatig testeindpunt bovenop
("voor handmatige test", 08:50) → test/fix dat eindpunt (08:57, 09:01) → **13 minuten later** de
drempel verdriedubbelen. Dit wijst sterk op een live-test-en-bijstel-sessie, niet op een vooraf
doordachte kalibratie.

**Dit sluit ook aan bij de Deel-2-data hieronder**: op de ochtend van 26 juni was
`tsbGemiddelde14d` daadwerkelijk **-11,5** (zie tabel) — dus al net onder de toen geldende -10-
drempel. Een handmatige test met het zojuist gebouwde eindpunt zou op dat moment `tsbTeNegatief:
true` → `richting: "omlaag"` hebben getoond. Dat de drempel exact 13 minuten na het testen van dat
eindpunt drastisch werd verruimd, past bij "zag een omlaag-correctie die te snel/te makkelijk
triggerde en verruimde de drempel" — maar dit is een **interpretatie op basis van timing en
data-samenval, geen bevestigd feit**. Er is geen commit message, code-comment of designdoc-passage
die dit met zoveel woorden zegt.

---

## Deel 2 — backtest -10 / -20 / -30 over 1 mei t/m 12 juli 2026

### Methode

`tsbGemiddelde14d` per dag berekend met **exact dezelfde formule** als `haalTsbGemiddelde()` in
`volumeCorrectie.js` (`form ?? (ctl - atl)`, 14-daags venster, minimaal 10 datapunten vereist,
afgerond op 1 decimaal) — losse implementatie omdat de bronfunctie alleen "vandaag" berekent, geen
historische reeks; wel dezelfde formule, niet een andere aanpak. Data rechtstreeks van
intervals.icu opgehaald (87 dagen, 17 april t/m 12 juli, zodat het venster voor 1 mei zelf compleet
is). **Belangrijke correctie tijdens het werk**: mijn eerste versie van de datum-doorloop gebruikte
`.toISOString()`, wat door tijdzoneconversie (Europe/Amsterdam UTC+2) de datum liet "vastlopen" op
dezelfde string — een oneindige lus die het proces liet crashen op geheugengebrek. Gefixt door,
net als `src/lib/datum.js` zelf al doet, met lokale kalendervelden te rekenen i.p.v.
`toISOString()`. Genoemd voor transparantie: dit was een bug in mijn eigen diagnostiek, niet in de
productiecode.

### Volledige tabel

`tsbRuw` = daadwerkelijke TSB van die specifieke dag (`form`/`ctl-atl`, ongemiddeld).
`tsb14d` = het voortschrijdend 14-daags gemiddelde waar de drempel op wordt toegepast.
`t10`/`t20`/`t30` = zou `tsbTeNegatief` op die dag `true` zijn geweest bij drempel -10/-20/-30.

```
datum        | tsbRuw  | tsb14d  | atl    | hrv | rampRate | t10 t20 t30
2026-05-01 |  -21.6 |  -20.7 |    58 |  57 |   4.95 | J   J   n
2026-05-02 |  -14.7 |  -20.2 |    50 |  47 |   2.98 | J   J   n
2026-05-03 |   -8.9 |  -19.8 |    44 |  59 |  -1.99 | J   n   n
2026-05-04 |  -20.0 |  -19.4 |    57 |  55 |   1.52 | J   n   n
2026-05-05 |  -23.1 |  -19.7 |    62 |  58 |   3.60 | J   n   n
2026-05-06 |  -15.8 |  -19.9 |    53 |  53 |   3.51 | J   n   n
2026-05-07 |  -24.5 |  -19.9 |    64 |  60 |   6.63 | J   n   n
2026-05-08 |  -16.9 |  -19.8 |    56 |  49 |   2.66 | J   n   n
2026-05-09 |  -10.3 |  -19.0 |    48 |  51 |   2.60 | J   n   n
2026-05-10 |  -43.6 |  -19.4 |    89 |  64 |  10.87 | J   n   n
2026-05-11 |  -32.8 |  -19.7 |    77 |  43 |   7.15 | J   n   n
2026-05-12 |  -23.6 |  -19.9 |    67 |  63 |   4.87 | J   n   n
2026-05-13 |  -15.7 |  -20.0 |    58 |  65 |   4.75 | J   n   n
2026-05-14 |  -17.7 |  -20.7 |    61 |  53 |   3.32 | J   J   n
2026-05-15 |  -10.6 |  -19.9 |    53 |  57 |   3.25 | J   n   n
2026-05-16 |  -17.8 |  -20.1 |    62 |  66 |   6.02 | J   J   n
2026-05-17 |  -22.6 |  -21.1 |    68 |  64 |   0.11 | J   J   n
2026-05-18 |  -14.6 |  -20.7 |    59 |  53 |   0.11 | J   J   n
2026-05-19 |   -7.7 |  -19.6 |    51 |  57 |   0.11 | J   n   n
2026-05-20 |   -1.9 |  -18.6 |    44 |  62 |   0.10 | J   n   n
2026-05-21 |  -11.0 |  -17.6 |    55 |  64 |   1.21 | J   n   n
2026-05-22 |   -4.6 |  -16.8 |    48 |  48 |   1.18 | J   n   n
2026-05-23 |  -18.2 |  -17.3 |    65 |  53 |   2.37 | J   n   n
2026-05-24 |  -10.7 |  -15.0 |    56 |  51 |  -0.25 | J   n   n
2026-05-25 |  -17.2 |  -13.9 |    64 |  66 |   2.54 | J   n   n
2026-05-26 |  -17.8 |  -13.4 |    65 |  64 |   4.19 | J   n   n
2026-05-27 |  -20.7 |  -13.8 |    70 |  63 |   6.35 | J   n   n
2026-05-28 |  -12.6 |  -13.4 |    60 |  58 |   3.22 | J   n   n
2026-05-29 |   -5.7 |  -13.1 |    52 |  58 |   3.14 | J   n   n
2026-05-30 |    0.2 |  -11.8 |    45 |  44 |  -1.00 | J   n   n
2026-05-31 |   -8.2 |  -10.8 |    56 |  55 |   1.89 | J   n   n
2026-06-01 |   -2.0 |   -9.9 |    48 |  55 |  -0.93 | n   n   n
2026-06-02 |    3.4 |   -9.1 |    42 |  57 |  -2.63 | n   n   n
2026-06-03 |    7.8 |   -8.4 |    36 |  62 |  -4.82 | n   n   n
2026-06-04 |   -2.1 |   -7.7 |    48 |  59 |  -1.77 | n   n   n
2026-06-05 |    3.2 |   -7.2 |    42 |  44 |  -1.73 | n   n   n
2026-06-06 |    7.7 |   -5.3 |    36 |  49 |  -1.69 | n   n   n
2026-06-07 |   -7.0 |   -5.1 |    54 |  60 |  -0.54 | n   n   n
2026-06-08 |   -1.0 |   -3.9 |    47 |  60 |  -0.53 | n   n   n
2026-06-09 |    4.2 |   -2.3 |    40 |  60 |  -0.52 | n   n   n
2026-06-10 |  -14.0 |   -1.9 |    62 |  68 |   4.32 | n   n   n
2026-06-11 |   -6.8 |   -1.5 |    54 |  49 |   1.28 | n   n   n
2026-06-12 |   -0.7 |   -1.1 |    47 |  60 |   1.25 | n   n   n
2026-06-13 |  -13.9 |   -2.1 |    63 |  60 |   5.15 | n   n   n
2026-06-14 |  -26.6 |   -3.4 |    79 |  58 |   5.33 | n   n   n
2026-06-15 |  -30.2 |   -5.4 |    84 |  61 |   7.96 | n   n   n
2026-06-16 |  -25.2 |   -7.5 |    79 |  61 |   8.83 | n   n   n
2026-06-17 |  -29.4 |  -10.1 |    84 |  60 |   6.67 | J   n   n
2026-06-18 |  -19.5 |  -11.4 |    73 |  48 |   6.51 | J   n   n
2026-06-19 |  -11.0 |  -12.4 |    63 |  62 |   6.36 | J   n   n
2026-06-20 |  -14.4 |  -14.0 |    68 |  63 |   4.56 | J   n   n   ← plan-startdatum
2026-06-21 |   -6.6 |  -13.9 |    59 |  33 |   0.17 | J   n   n   ← eerste zondag v/h plan; HRV-dieptepunt periode (33)
2026-06-22 |   -0.0 |  -13.9 |    51 |  57 |  -2.58 | J   n   n   ← "deload-dag"?
2026-06-23 |    0.2 |  -14.2 |    51 |  65 |  -2.43 | J   n   n
2026-06-24 |    5.8 |  -12.8 |    44 |  55 |  -5.24 | J   n   n
2026-06-25 |    2.2 |  -12.1 |    48 |  55 |  -3.35 | J   n   n
2026-06-26 |    7.4 |  -11.5 |    42 |  44 |  -3.27 | J   n   n   ← drempelwijziging -10→-30 dit moment
2026-06-27 |   -3.0 |  -10.7 |    54 |  54 |  -2.30 | J   n   n
2026-06-28 |    3.0 |   -8.6 |    47 |  43 |  -2.25 | n   n   n
2026-06-29 |    8.1 |   -5.9 |    41 |  64 |  -2.20 | n   n   n
2026-06-30 |   -0.3 |   -4.1 |    51 |  58 |  -0.57 | n   n   n
2026-07-01 |   -0.2 |   -2.0 |    51 |  55 |   0.62 | n   n   n
2026-07-02 |   -6.1 |   -1.1 |    58 |  57 |   1.29 | n   n   n
2026-07-03 |   -2.5 |   -0.5 |    53 |  54 |   1.87 | n   n   n
2026-07-04 |  -19.0 |   -0.8 |    74 |  56 |   3.47 | n   n   n
2026-07-05 |  -10.5 |   -1.1 |    64 |  56 |   3.39 | n   n   n
2026-07-06 |   -3.2 |   -1.3 |    55 |  54 |   3.31 | n   n   n
2026-07-07 |  -13.9 |   -2.3 |    68 |  47 |   4.10 | n   n   n
2026-07-08 |   -6.1 |   -3.1 |    59 |  51 |   2.83 | n   n   n
2026-07-09 |    0.6 |   -3.3 |    51 |  62 |   0.32 | n   n   n
2026-07-10 |   -5.4 |   -4.2 |    59 |  57 |   2.19 | n   n   n
2026-07-11 |   -6.8 |   -4.4 |    60 |  45 |  -0.99 | n   n   n
2026-07-12 |  -33.2 |   -7.0 |    93 |  52 |   6.16 | n   n   n   ← vandaag; hoogste ATL v/d periode
```

### Markeringen uit stap 5

- **Deload-week rond 22 juni**: mijn data toont op 22 juni een **ruwe dagwaarde van -0,0** (vrijwel
  neutraal), oplopend naar **+5,8 (24 juni)** en **+7,4 (26 juni)** — een periode van ruwe TSB rond
  nul tot licht positief, consistent met een deload/hersteldag. Dit komt **niet exact** overeen met
  de eerder genoemde "+3,0 op 22 juni" (ik meet -0,0 die specifieke dag) — mogelijk een net iets
  ander datumpunt of een andere onderliggende bron in de eerdere analyse. Het 14-daags gemiddelde
  bleef op dat moment nog op **-13,9** staan (nog steeds boven de -10-drempel, dus zou destijds bij
  -10 hebben getriggerd) — dit illustreert precies het onderscheid tussen "ruwe dagwaarde" en
  "14-daags gemiddelde" waar deze hele analyse om draait: een goede/deload-dag verandert het
  gemiddelde nauwelijks.
- **Zware weken 29 juni/6 juli (ATL-piek, laagste HRV)**: dit **klopt niet met wat ik direct uit
  intervals.icu heb opgehaald**. In mijn reeks is `atl` op 29 juni **41** (relatief laag) en op
  6 juli **55** (gemiddeld) — geen piek. De feitelijke ATL-pieken in de hele periode liggen op
  **10-11 mei (89/77)**, **14-17 juni (79-84)**, en met afstand het hoogst op **vandaag, 12 juli
  (93)**. Het laagste HRV-punt van de hele periode is **21 juni (33)** — een duidelijke uitschieter
  t.o.v. de rest (43-68) — niet 29 juni/6 juli (hrv daar: 64 resp. 54). Ik beschrijf dit als
  constatering, geen oordeel: dit kan wijzen op een ander brondata-veld (bv. `hrvSDNN` i.p.v.
  `hrv`), een andere periode-afbakening, of gewoon een niet meer kloppende herinnering — ik kan
  vanuit deze sessie niet zien welke van de twee de oorzaak is.
- **Vandaag (12 juli) als levend voorbeeld**: ruwe TSB vandaag is **-33,2** (op één na de laagste
  losse dagwaarde van de hele periode, na -43,6 op 10 mei) en ATL is met **93** de hoogste van de
  reeks — een fors zware dag. Het 14-daags gemiddelde staat desondanks op slechts **-7,0**, ver
  boven zelfs de -10-drempel. Dit is precies het dempingseffect dat in
  `ramp-rate-fix-en-impact.md` als hypothese werd genoemd, nu met live data van vandaag zelf
  bevestigd.

### Waar geeft -10 een ander resultaat dan -20/-30?

- **1 mei – 27 juni (bijna 2 maanden)**: `-10` triggert **vrijwel elke dag** (enige uitzonderingen:
  1-9 juni, een periode van herstel/opbouw). `-20` triggert slechts op **6 losse dagen**, allemaal
  begin/half mei. `-30` triggert **geen enkele dag** in de hele 73-dagen-reeks.
- **28 juni – 12 juli (sinds de recalibratie t/m vandaag)**: geen van de drie drempels triggert nog
  ooit.
- **Operationeel relevante periode** (sinds het seizoensplan startte op 20 juni, want
  `voerWekelijkseEvaluatieUit` doet niets zonder `plan.kader`): `-10` zou getriggerd hebben op
  **20-27 juni** — inclusief **zondag 21 juni**, de eerste geplande wekelijkse evaluatie van het
  hele 16-weken-programma. `-20` en `-30` hebben in die hele periode (20 juni t/m vandaag) **geen
  van beide ooit** getriggerd.
- **Belangrijke kanttekening**: `volumeCorrectie.js` bestaat pas sinds 26 juni 08:30 — vóór die
  datum liep er geen automatische wekelijkse evaluatie, dus de "trigger op 21 juni"-uitkomst is
  een terugwerkende berekening, geen daadwerkelijk voorgevallen gebeurtenis. Op het moment dat de
  code wél live was (26 juni, tot de recalibratie om 09:13), stond `tsbGemiddelde14d` op **-11,5**
  — net onder de toen geldende -10-drempel.

### Wat dit beschrijft (geen hard oordeel, zoals gevraagd)

- Sinds de recalibratie naar -30 (en nu -20) heeft `tsbTeNegatief` **nooit** getriggerd in de
  volledige beschikbare geschiedenis, inclusief de zwaarste losse dag van de hele reeks (vandaag,
  ATL 93, ruwe TSB -33,2).
  - -10 zou wél frequent hebben getriggerd, met name gedurende bijna de volledige meimaand en de
  eerste week van het seizoensplan (20-27 juni) — een periode waarin de gebruiker net begon met
  een gestructureerd 16-weken-programma.
- Of veelvuldig triggeren in mei/eind juni "correct" zou zijn geweest is niet uit deze data af te
  leiden zonder te weten wat er in die periode daadwerkelijk fysiek gebeurde (bewuste hoge
  belasting? ziekte? slaapgebrek?) — dat viel buiten de scope van dit onderzoek.
