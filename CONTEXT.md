# Pedalytics — Persoonlijke Fietscoach

## Doel van de app

Een AI-gestuurde fietscoach die Frank Levering helpt zijn FTP te verhogen in zijn eerste fietsseizoen (2026). De app doet drie dingen:

1. **Trainingsplan maken** — op basis van een seizoensdoel genereert Claude concrete sessies per 10-dagenvenster, aangepast aan beschikbaarheid, huidige vorm en herstel
2. **Monitoren** — dagelijkse herstelstatus, trainingsbalans (CTL/ATL/TSB), en voortgang richting het doel
3. **Bijsturen** — als data laat zien dat het plan te zwaar of te licht is (via RPE-analyse, HRV-trends), past de coach het schema automatisch aan

## Wat maakt deze app uniek

De meeste trainingsapps (TrainerRoad, Zwift, Join) baseren schema's op gebruikersinput of vaste algoritmes. Pedalytics heeft via intervals.icu + Garmin toegang tot dagelijkse **slaapdata, HRV en rusthartslag** naast de standaard **CTL/ATL/TSB trainingsbelasting**. Daardoor kan de coach de intensiteit aanpassen aan het werkelijke herstel van dat moment — niet aan wat het schema zegt of wat de gebruiker denkt te voelen. Die combinatie van objectieve hersteldata + trainingsbelasting + RPE-feedback + AI-gestuurde besluitvorming is wat Pedalytics onderscheidt.

## Huidige staat

De app is productie-klaar met een volledig nieuw design (licht thema, Nunito/Fredoka fonts), wachtwoordbeveiliging, en Upstash Redis voor persistentie. De kern-loop (doel instellen → sessies genereren → trainen → monitoren → bijsturen) is functioneel.

### Wat werkt

- **3-tab navigatie** (bottom-nav): Dashboard, Schema, Voortgang
- **Dashboard** (HomeTab): balansscore ring, status-headline, weekstrip beschikbaarheid, eerstvolgende sessie kaart (niet alleen vandaag), AI-insight kaart
- **Schema** (SchemaTab): 21-daagse dag-strip navigatie (10 terug, vandaag, 10 vooruit) met mode-stippen per dag. Zes dag-staten:
  - **planned** (mint) — toekomstige sessie met intervalgrafiek, JOIN-stijl segmentblokken, "waarom vandaag" kaart, sticky Start CTA
  - **matched** (groen) — rit matcht gepland type (Coggan IF-classificatie), werkelijk vs gepland metrics, gereden vermogenslijn overlay
  - **deviated** (amber) — ander rittype dan gepland, gepland→gereden vergelijking, werkelijk vermogensprofiel
  - **unplanned** (blauw) — rit zonder plan, gedetecteerd type + metrics
  - **missed** (grijs) — sessie gepland maar geen rit gevonden
  - **buiten_planperiode** — rit van vóór startdatum seizoensplan
  - **rest** (leeg) — geen sessie, geen rit
- **RPE-invoer** bij alle voltooide ritten (matched/deviated/unplanned/buiten_planperiode), opgeslagen via `icu_rpe` in intervals.icu
- **Voortgang** (VoortgangTab): CTL/ATL/TSB hero grafiek (TSB als band), FTP kaart, power curve
- **Seizoensplan wizard**: 3 stappen (doel → beschikbaarheid → samenvatting), blijft op schema-tab tijdens generatie
- **Beschikbaarheid aanpassen**: los overlay-scherm (fixed position), bereikbaar vanuit Home
- **10-dagen sessie-generatie**: Claude genereert datum-gebaseerde sessies voor vandaag+10 dagen, beschermt voltooide ritten
- **RPE als regeneratie-trigger**: gem RPE ≥8 of ≤3 over 7 dagen triggert automatisch schema-herberekening
- **RPE-analyse in prompt**: structureel te zwaar/te licht detectie + RPE per trainingstype → vermogensaanpassingen
- **Rit-type detectie**: Coggan IF-classificatie (NP/FTP) met 8 categorieën, flexibele match-logica
- **Activity streams**: werkelijk gereden vermogensprofiel opgehaald van intervals.icu, getoond als bars of lijn-overlay
- **Persistentie**: seizoensplan + Strava tokens via Upstash Redis (KV)
- **Wachtwoordbeveiliging**: middleware + login pagina + server-side sessies in KV (30 dagen TTL)
- **Profiel**: FTP, gewicht, zones, basislijnen dynamisch opgehaald van intervals.icu
- **Strava koppeling**: solo/groep detectie via athlete_count

## Architectuurbeslissingen

### Design
- **Licht thema** met warme gebroken-wit achtergrond (`oklch(0.962 0.012 84)`)
- **Nunito** (body/headlines) + **Fredoka** (grote cijfers) via `next/font/google`
- **Design tokens** in `designTokens.js` — alle kleuren, typografie, spacing als constanten
- **4 herstelstatussen**: good (groen), caution (geel), careful (oranje), rest (gedempt rood)
- **Kaarten**: radius 28px, subtiele schaduw, warme randkleur
- **Bottom-nav**: 3 tabs vast onderaan (78px)
- **JOIN-stijl segmentblokken**: volle-breedte kleurblokken per segment met RPE-range, tijd, watt-range. Herhaalde sets met bracket + ronde badge (bijv. "3×")

### Schema-tab architectuur
- **SchemaTab IS het workout-detail** — geen losse overlay meer
- **21-daagse dag-strip**: horizontaal scrollbaar, auto-centering op selectie
- **Mode-bepaling per dag**: op basis van sessie + rit + Coggan IF-classificatie + planstartdatum
- **HomeTab sessiekliks** → navigeren naar Schema-tab met juiste dag-offset (datum-gebaseerd)

### Sessie-generatie
- **10-dagenvenster**: genereert sessies per datum (niet per dagnaam), kan 2 kaderweken overspannen
- **Voltooide sessies beschermd**: ritten met gematchte datum worden niet overschreven bij regeneratie
- **Sessietypes**: duur_lang (vlak Z2), duur_variabel (afwisselend Z2/Z3), sweetspot, interval, herstel
- **Geen warmup/cooldown**: hoofdinspanning vult de hele sessieduur
- **Vermogen als range**: segmenten hebben vermogenMin/vermogenMax (%FTP), getoond als watt-range (bijv. "220–235 W")
- **Labels**: Coggan-classificatie (Duurrit, Tempo, Sweet spot, etc.), geen zone-nummers in UI

### Rit-type detectie (lib/rittype.js)
- **Coggan IF-classificatie**: IF = NP/FTP, 8 categorieën (Herstelrit ≤0.55 → Sprint >1.30)
- **Z2/Tempo grens**: IF 0.76 (getuned op Franks data — NP 199W bij FTP 265 = Z2)
- **Flexibele matching**: `ritMatchesSessie()` met tolerantie (bijv. tempo-rit matcht duurrit-plan)
- **NP apart opgeslagen**: `np` en `avgWatts` als aparte velden naast `wattage`

### RPE-systeem
- **Invoer**: slider (1-10) bij voltooide ritten in SchemaTab, opgeslagen via `PUT /api/intervals/workouts/{id}` → `icu_rpe`
- **Analyse in prompt**: gem RPE + TSS-ratio (structureel te zwaar/te licht), RPE per trainingstype
- **Trigger**: gem RPE ≥8 of ≤3 over 7 dagen → automatische schema-herberekening

### Data & infrastructuur
- **Upstash Redis** (pedalytics-kv) voor seizoensplan, Strava tokens, en login-sessies
- **Alle API calls server-side** — keys nooit in de browser
- **Activity streams** via `/api/intervals/activities/[id]/streams` — watts time-series voor vermogensprofiel
- **Wachtwoordbeveiliging**: middleware.ts checkt session_id cookie → KV lookup. Login via APP_PASSWORD env var

## App Structuur

```
src/
├── middleware.ts                     # Auth check op elke request, redirect naar /login
├── app/
│   ├── designTokens.js              # Kleuren, typografie, status-mapping, zone-kleuren
│   ├── AppClient.js                 # Orchestrator — state, API calls, tab routing (~560 regels)
│   ├── layout.js                    # Nunito/Fredoka fonts, meta tags, PWA config
│   ├── globals.css                  # Reset, font-family, scrollbar
│   ├── page.js                      # Entry point, laadt AppClient met ssr:false
│   ├── login/page.js                # Wachtwoord login pagina
│   ├── components/
│   │   ├── HomeTab.js               # Dashboard tab — ring, weekstrip, eerstvolgende sessie, AI-insight
│   │   ├── SchemaTab.js             # Schema tab — 21-dag strip, 6 dag-staten, RPE-invoer, segmentblokken
│   │   ├── VoortgangTab.js          # Voortgang tab — CTL/ATL/TSB + power curve
│   │   ├── BottomNav.js             # 3-tab navigatie onderaan
│   │   ├── SeizoenWizard.js         # 3-stappen wizard
│   │   ├── BeschikbaarheidEditor.js # Herbruikbaar: dag-toggle + uren-stepper
│   │   ├── BeschikbaarheidScherm.js # Fixed overlay voor beschikbaarheid aanpassen
│   │   ├── WorkoutViz.js            # Intervalgrafiek (bars + FTP-lijn + optionele gereden-lijn overlay)
│   │   │                            # + WerkelijkViz export (bars uit activity streams watts)
│   │   ├── home/
│   │   │   ├── BalanceRing.js       # SVG voortgangsring met score
│   │   │   ├── WeekStrip.js         # 7-dag beschikbaarheid cirkels (datum-aware sessie lookup)
│   │   │   ├── SessionCard.js       # Eerstvolgende sessie kaart (dag-label: "Vandaag" of dagnaam)
│   │   │   └── InsightCard.js       # AI-inzicht kaart (slate)
│   │   ├── DagAdvies.js             # berekenDagAdvies — 4 niveaus
│   │   ├── HerstelStatus.js         # berekenHerstelScore — gewogen score uit HRV/HR/TSB/slaap
│   │   ├── TrainingLoad.js          # berekenTrainingLoad, tsbStatus — CTL/ATL/TSB functies
│   │   └── ...                      # Overige componenten (WeekVergelijking, SeizoenProgressie, etc.)
│   └── api/
│       ├── login/                   # POST — wachtwoord check, sessie aanmaken in KV
│       ├── logout-all/              # POST — alle sessies in KV verwijderen
│       ├── intervals/
│       │   ├── activities/          # GET ritten (incl. np, avgWatts, strava_id, icu_rpe)
│       │   ├── activities/[id]/streams/ # GET activity watts time-series
│       │   ├── wellness/            # GET/PUT wellness (HRV, slaap, CTL/ATL, Garmin data)
│       │   ├── profiel/             # GET atletenprofiel (FTP, gewicht, zones, basislijnen)
│       │   ├── events/              # GET/POST workouts → intervals.icu
│       │   └── workouts/[id]/       # GET/PUT per activiteit (RPE via icu_rpe)
│       ├── claude/                  # POST proxy naar Claude API
│       ├── plan/                    # GET/PUT/DELETE seizoensplan (Upstash KV)
│       ├── strava/
│       │   ├── auth/                # GET → redirect naar Strava OAuth
│       │   ├── callback/            # GET → token exchange, opslag in KV
│       │   └── activities/          # GET → athlete_count mapping
│       └── test/                    # Debug endpoint
├── lib/
│   ├── kv.js                        # Upstash Redis client (singleton)
│   ├── intervals.js                 # intervalsGet/Post/Put/ActivityGet/ActivityPut helpers
│   ├── strava.js                    # OAuth token management via KV, auto-refresh
│   └── rittype.js                   # Coggan IF-classificatie, ritMatchesSessie
```

## Seizoensplan — structuur

```json
{
  "doel": "ftp_verhogen",
  "doel_label": "FTP verhogen",
  "doel_icon": "⚡",
  "tijdshorizon_weken": 12,
  "huidige_ftp": 265,
  "huidige_ctl": 55,
  "startdatum": "2026-06-19",
  "beschikbaarheid": { "Dinsdag": true, "Donderdag": true, "Zaterdag": true },
  "urenPerDag": { "Dinsdag": 1.5, "Donderdag": 1.5, "Zaterdag": 3 },
  "kader": [
    { "week": 1, "fase": "basis", "tss_doel": 275, "focus": "Z2 volume + sweetspot intro" }
  ],
  "streefwaarde": "280-290W",
  "samenvatting": "...",
  "weekSessies": {
    "weekdoel": "...",
    "fase": "basis",
    "tss_totaal": 260,
    "sessies": [
      {
        "datum": "2026-06-24",
        "dag": "Dinsdag",
        "type": "duur_lang",
        "titel": "Z2 duurrit",
        "tss": 85, "duur_min": 90,
        "vermogen": "180-200W",
        "reden": "Aerobe basis na rustdag gisteren",
        "segmenten": [
          { "type": "z2", "duur_min": 90, "vermogenMin": 68, "vermogenMax": 76, "label": "Z2 duur" }
        ]
      }
    ]
  }
}
```

## Intervals.icu API details

- Auth: `Basic ` + base64(`API_KEY:` + key)
- RPE veld: `icu_rpe` (NIET `perceived_exertion`)
- `group` veld: interne hash, NIET groepsrit-indicator
- `strava_id`: beschikbaar als field parameter op activities endpoint
- Profiel: `sportSettings[0]` bevat FTP, LTHR, max_hr, zones
- Wellness: HRV/HR basislijn berekend uit 30 dagen gemiddelde
- Activity streams: `GET /api/v1/activity/{id}/streams?types=watts` → array `[{type: "watts", data: [...]}]`

## Environment Variables

```
INTERVALS_API_KEY=...
INTERVALS_ATHLETE_ID=i594622
ANTHROPIC_API_KEY=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
KV_REST_API_URL=...          # Upstash Redis (pedalytics-kv)
KV_REST_API_TOKEN=...        # Upstash Redis
APP_PASSWORD=...             # Login wachtwoord
```

## Gedaan — samenvatting van het werk

### Fase 1–3: Basis app, seizoensplanning, voortgang
- Intervals.icu API routes, Claude API proxy, Strava OAuth, profiel laden
- Seizoensplan wizard, kader berekening, sessie-generatie via Claude
- Voortgangsanalyse (EF, vermogen, CTL/ATL/TSB)

### Fase 4: Design redesign (Claude Design handoff)
- Design tokens, HomeTab, SchemaTab, VoortgangTab, WorkoutViz, SeizoenWizard, BeschikbaarheidEditor, BottomNav
- Fonts: Nunito + Fredoka via next/font/google

### Fase 5: Grote opruiming + architectuurwijzigingen (deze sessie)
- **AppClient.js opgeruimd**: 1716 → ~560 regels. Legacy tabs, ongebruikte helpers/state/imports verwijderd
- **SchemaTab = workout-detail**: chevrons vervangen door 21-daagse dag-strip, WorkoutDetail.js verwijderd
- **Zes dag-staten**: planned, matched, deviated, unplanned, missed, buiten_planperiode, rest
- **JOIN-stijl segmentblokken**: volle-breedte kleurblokken met bracket+badge voor herhaalde sets
- **10-dagen sessie-generatie**: datum-gebaseerd, voltooide sessies beschermd, multi-week kader
- **RPE-systeem**: invoer bij voltooide ritten, analyse in prompt, automatische regeneratie-trigger
- **Coggan IF-classificatie**: `lib/rittype.js`, 8 categorieën, getuned op Franks data
- **Activity streams**: API route + WerkelijkViz component + lijn-overlay bij matched state
- **Watt i.p.v. %FTP**: alle zichtbare labels in watt, ranges met ±5%-marge
- **Geen warmup/cooldown**: nieuwe sessies vullen hele duur met hoofdinspanning
- **Nieuw sessietype duur_variabel**: afwisselend Z2/Z3, keuzelogica in prompt
- **BeschikbaarheidScherm als fixed overlay**: voorheen scrollbaar voorbij de app
- **Beschikbaarheid sync gefixt**: weekSessies gewist bij wijziging, laadstatus doorgegeven
- **Eerstvolgende sessie op Home**: niet alleen vandaag, maar eerste toekomstige sessie
- **Upstash Redis**: seizoensplan + Strava tokens van filesystem naar KV (pedalytics-kv)
- **Wachtwoordbeveiliging**: middleware.ts, login pagina, server-side sessies in KV, logout-all route
- **Wizard flow**: blijft op schema-tab tijdens generatie (geen tab-switch meer)

## TODO

### Opruimen
- [ ] Ongebruikte component-bestanden verwijderen (ZoneVerdeling.js)
- [ ] `sessieverdeling.js` verwijderen — wordt niet meer gebruikt

### Functionaliteit
- [ ] Zones dynamisch laden van intervals.icu (nu hardcoded in designTokens)
- [ ] Power curve met echte best efforts (niet geschat uit gemiddeld wattage)
- [ ] Cardiac decoupling — hartslag-drift analyseren voor aerobe fitness
- [ ] Filter-pills op Home (Vandaag/Deze week/Herstel/Belasting) — UI staat er, geen gedrag
- [ ] Slaapdata meesturen in sessie-generatie prompt (wordt opgehaald maar niet gebruikt)

### Infrastructuur
- [ ] Strava OAuth voor productie (callback domain configureren)
- [ ] Wahoo workout push testen (intervals.icu events endpoint)
- [ ] Push notificaties (VAPID keys, service worker)
- [ ] PWA manifest updaten voor nieuw design (kleuren, naam)
