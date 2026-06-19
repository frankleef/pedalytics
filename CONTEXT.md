# Pedalytics — Persoonlijke Fietscoach

## Doel van de app

Een AI-gestuurde fietscoach die Frank Levering helpt zijn FTP te verhogen in zijn eerste fietsseizoen (2026). De app doet drie dingen:

1. **Trainingsplan maken** — op basis van een seizoensdoel genereert Claude concrete sessies per week, aangepast aan beschikbaarheid, huidige vorm en herstel
2. **Monitoren** — dagelijkse herstelstatus, trainingsbalans (CTL/ATL/TSB), en voortgang richting het doel
3. **Bijsturen** — als data laat zien dat het plan te zwaar of te licht is, past de coach het aan

## Wat maakt deze app uniek

De meeste trainingsapps (TrainerRoad, Zwift, Join) baseren schema's op gebruikersinput of vaste algoritmes. Pedalytics heeft via intervals.icu + Garmin toegang tot dagelijkse **slaapdata, HRV en rusthartslag** naast de standaard **CTL/ATL/TSB trainingsbelasting**. Daardoor kan de coach de intensiteit aanpassen aan het werkelijke herstel van dat moment — niet aan wat het schema zegt of wat de gebruiker denkt te voelen. Als je HRV 's ochtends 20% onder basislijn zit, worden intervallen automatisch uitgesteld, ongeacht wat het plan zegt. Die combinatie van objectieve hersteldata + trainingsbelasting + AI-gestuurde besluitvorming is wat Pedalytics onderscheidt.

## Huidige staat

De app heeft een volledig nieuw design (licht thema, Nunito/Fredoka fonts) geïmplementeerd via een design handoff van Claude Design. Drie van de drie tabs zijn omgezet naar het nieuwe design. De seizoensplan-wizard is werkend. De kern-loop (doel instellen → sessies genereren → trainen → monitoren) is functioneel.

### Wat werkt

- **3-tab navigatie** (bottom-nav): Dashboard, Schema, Voortgang
- **Dashboard** (HomeTab): balansscore ring, status-headline, weekstrip beschikbaarheid, eerstvolgende sessie kaart, AI-insight kaart
- **Schema** (SchemaTab): workout-detail met dag-navigatie (chevrons), TSS-weekkaart, intervalgrafiek (Zwift-stijl), segment-overzicht, "waarom vandaag" uitleg, rust-staat voor dagen zonder sessie
- **Voortgang** (VoortgangTab): CTL/ATL/TSB hero grafiek (TSB als band, niet als lijn), FTP kaart, power curve
- **Seizoensplan wizard**: 3 stappen (doel → beschikbaarheid → samenvatting) in nieuw design
- **Beschikbaarheid aanpassen**: los scherm met dag-toggle + uren-stepper, bereikbaar vanuit Home en Schema
- **Sessie-generatie**: Claude genereert sessies op basis van beschikbare dagen, uren, CTL/ATL/TSB, HRV trend, recente ritten, RPE, supercompensatie timing
- **Persistentie**: seizoensplan + beschikbaarheid + weekSessies opgeslagen via `/api/plan`
- **Profiel**: FTP, gewicht, zones, basislijnen dynamisch opgehaald van intervals.icu
- **Strava koppeling**: solo/groep detectie via athlete_count

### Bekende bugs

- ~~**Sessies niet altijd zichtbaar na wizard**: opgelost — weekSessies worden nu gepersisteerd in het plan-JSON en bij laden hersteld~~
- ~~**Schema tab toont oude donkere elementen**: opgelost — legacy code verwijderd uit AppClient.js~~

## Architectuurbeslissingen

### Design
- **Licht thema** met warme gebroken-wit achtergrond (`oklch(0.962 0.012 84)`)
- **Nunito** (body/headlines) + **Fredoka** (grote cijfers) via `next/font/google`
- **Design tokens** in `designTokens.js` — alle kleuren, typografie, spacing als constanten
- **4 herstelstatussen**: good (groen), caution (geel), careful (oranje), rest (gedempt rood)
- **Zone-kleuren** conform design spec: Z1=#B4C6DE, Z2=#5E94CE, Z3=#3FB488, Z4=#C79A3C, Z5=#B45A44
- **Kaarten**: radius 28px, subtiele schaduw, warme randkleur
- **Bottom-nav**: 3 tabs vast onderaan (78px), verbergt bij workout-detail

### Seizoensplan
- **Rolling 2-weken horizon**: kader (fasen/TSS) lokaal berekend, sessies per week door Claude
- **Beschikbaarheid = wanneer je kúnt**: coach kiest welke dagen trainingen krijgen
- **Uren per dag**: gebruiker geeft beschikbare tijd op, sessieduur past zich aan
- **Startdatum**: eerstvolgende trainingsdag na aanmaken plan
- **Geen weeknummers**: fasen getoond in plaats van weeknummers

### Wetenschap in de sessie-generatie
Claude krijgt bij elke sessie-generatie mee:
- Huidige CTL/ATL/TSB (trainingsbalans)
- HRV vandaag + trend (5 dagen)
- Rusthartslag vs basislijn
- Vorige week: gepland vs werkelijk TSS + gemiddelde RPE
- Recente ritten met wattage/HR/TSS/RPE
- Regels: polarisatie 80/20, max dagen op basis van CTL, supercompensatie, TSS cap 150/sessie, 48u herstel

### Data
- **Geen database** — intervals.icu is de bron, seizoensplan als JSON file via `/api/plan`
- **Alle API calls server-side** — keys nooit in de browser
- **Strava athlete_count** in 1 batch call (niet per rit)
- **Profiel dynamisch** — FTP, gewicht, HR zones, HRV/HR basislijnen uit intervals.icu

## App Structuur

```
src/
├── app/
│   ├── designTokens.js           # Kleuren, typografie, status-mapping, zone-kleuren
│   ├── AppClient.js              # Orchestrator — state management, API calls, tab routing (1715 regels)
│   ├── layout.js                 # Nunito/Fredoka fonts, meta tags, PWA config
│   ├── globals.css               # Reset, font-family, scrollbar
│   ├── page.js                   # Minimale entry point, laadt AppClient met ssr:false
│   ├── components/
│   │   ├── HomeTab.js            # Dashboard tab (nieuw design)
│   │   ├── SchemaTab.js          # Schema tab — workout-detail met dag-navigatie, TSS-weekkaart, rust-staat
│   │   ├── VoortgangTab.js       # Voortgang tab (nieuw design) — CTL/ATL/TSB + power curve
│   │   ├── BottomNav.js          # 3-tab navigatie onderaan
│   │   ├── SeizoenWizard.js      # 3-stappen wizard (nieuw design)
│   │   ├── BeschikbaarheidEditor.js  # Herbruikbaar: dag-toggle + uren-stepper
│   │   ├── BeschikbaarheidScherm.js  # Los bewerkscherm voor beschikbaarheid
│   │   ├── WorkoutViz.js         # Zwift-stijl intervalgrafiek (zone-kleuren, FTP-lijn)
│   │   ├── home/
│   │   │   ├── BalanceRing.js    # SVG voortgangsring met score
│   │   │   ├── WeekStrip.js      # 7-dag beschikbaarheid cirkels
│   │   │   ├── SessionCard.js    # Vandaag-sessie kaart
│   │   │   └── InsightCard.js    # AI-inzicht kaart (slate)
│   │   ├── DagAdvies.js          # berekenDagAdvies — 4 niveaus (🟢🟡🟠🔴)
│   │   ├── HerstelStatus.js      # berekenHerstelScore — gewogen score uit HRV/HR/TSB/slaap
│   │   ├── TrainingLoad.js       # berekenTrainingLoad, tsbStatus — CTL/ATL/TSB functies
│   │   ├── WeekVergelijking.js   # Werkelijk vs gepland TSS
│   │   ├── SeizoenProgressie.js  # FTP prognose + CTL pad
│   │   ├── RpeFeedback.js        # RPE trend per type
│   │   ├── TSSWeek.js            # TSS weekvoortgang (Recharts)
│   │   ├── PowerCurve.js         # Power curve (oud, gebruikt in VoortgangTab legacy)
│   │   └── ZoneVerdeling.js      # Ongebruikt (was op voortgang tab)
│   └── api/
│       ├── intervals/
│       │   ├── activities/       # GET ritten (strava_id, icu_rpe, zones, max_hr, etc.)
│       │   ├── wellness/         # GET/PUT wellness (HRV, slaap, CTL/ATL, Garmin data)
│       │   ├── profiel/          # GET atletenprofiel (FTP, gewicht, zones, basislijnen berekend)
│       │   ├── events/           # GET/POST workouts → intervals.icu → Wahoo
│       │   └── workouts/[id]/    # GET/PUT per activiteit (RPE via icu_rpe)
│       ├── claude/               # POST proxy naar Claude API (max_tokens instelbaar)
│       ├── plan/                 # GET/PUT/DELETE seizoensplan (.seizoensplan.json)
│       ├── strava/
│       │   ├── auth/             # GET → redirect naar Strava OAuth (dynamische redirect URI)
│       │   ├── callback/         # GET → token exchange
│       │   └── activities/       # GET → athlete_count mapping (1 batch call)
│       └── test/                 # Debug endpoint
├── lib/
│   ├── intervals.js              # intervalsGet/Post/Put/ActivityGet/ActivityPut helpers
│   ├── strava.js                 # OAuth token management, auto-refresh
│   └── sessieverdeling.js        # maxTrainDagen, beperkBeschikbaarheid (niet meer actief gebruikt)
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
  "config": { "weken": 12 },
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
        "dag": "Dinsdag", "type": "duur_lang", "titel": "Z2 duurrit",
        "tss": 85, "duur_min": 90, "vermogen": "170-195W", "hartslag": "<152 bpm",
        "beschrijving": "90 min Z2, focus op cadans 85-95",
        "reden": "Aerobe basis na rustdag gisteren",
        "segmenten": [
          { "type": "warmup", "duur_min": 10, "vermogen_pct": 55, "label": "Warming-up" },
          { "type": "z2", "duur_min": 70, "vermogen_pct": 72, "label": "Z2 duur" },
          { "type": "cooldown", "duur_min": 10, "vermogen_pct": 50, "label": "Cooling-down" }
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

## Environment Variables

```
INTERVALS_API_KEY=...
INTERVALS_ATHLETE_ID=i594622
ANTHROPIC_API_KEY=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
```

## Gedaan — samenvatting van het werk

### Fase 1: Basis app (sessie 1)
- Intervals.icu API routes gebouwd (activities, wellness, workouts, events)
- Gedeelde `intervals.js` helper (was dubbele auth code in elke route)
- Claude API route server-side (key was in browser)
- Ochtendmeting → dashboard (geen handmatige invoer, data van Garmin)
- RPE opslaan gefixt (veld is `icu_rpe`)
- Strava OAuth flow voor solo/groep detectie via `athlete_count`
- Profiel dynamisch laden van intervals.icu (FTP, gewicht, zones, basislijnen)

### Fase 2: Seizoensplanning
- Seizoensplan wizard (3 stappen: doel → beschikbaarheid → samenvatting)
- Kader lokaal berekend (fasen/TSS-doelen), sessies via Claude
- Wetenschappelijke basis: polarisatie, supercompensatie, HRV-gestuurd, CTL-based max dagen
- Claude prompt bevat: recente ritten, TSB, HRV trend, vorige week vergelijking
- Beschikbaarheid = wanneer je kúnt, coach kiest de optimale dagen
- Uren per dag → sessieduur past zich aan
- Plan persistentie via `/api/plan` (JSON file)
- Beschikbaarheid + weekSessies persistentie in seizoensplan

### Fase 3: Voortgang & analyse
- Progressie per maand (EF als primaire indicator, vermogen, snelheid, HR bij Z2)
- Recharts grafieken (BarChart, AreaChart, LineChart)
- Contextzinnen bij alle statistieken (data-gedreven, niet generiek)
- Info-iconen (ⓘ) bij complexe metrics
- RPE feedback loop (trend per trainingstype, aanpassingsadviezen)
- Seizoensprogressie (FTP prognose, CTL pad, weekvergelijkingstabel)

### Fase 4: Design redesign (Claude Design handoff)
- **Design tokens** (`designTokens.js`): oklch kleuren, Nunito/Fredoka, status-mapping
- **HomeTab**: balansscore ring, status-headline, weekstrip, eerstvolgende sessiekaart, AI-insight
- **SchemaTab**: workout-detail met dag-navigatie (chevrons ma-zo), TSS-weekkaart, intervalgrafiek, segment-lijst, "waarom vandaag" kaart, rust-staat
- **VoortgangTab**: CTL/ATL/TSB hero (TSB als band), FTP kaart, power curve
- **WorkoutViz**: Zwift-stijl bars (flex-grow op minuten, hoogte=%FTP/130, FTP-lijn)
- **SeizoenWizard**: 3 stappen in nieuw design met progress-bar
- **BeschikbaarheidEditor**: herbruikbaar component (dag-toggle + uren-stepper)
- **BottomNav**: 3-tab navigatie vast onderaan
- Fonts: Nunito + Fredoka via next/font/google (self-hosted)
- **Architectuurwijziging**: SchemaTab IS nu het workout-detail (geen losse overlay meer). HomeTab sessiekliks navigeren naar Schema-tab met juiste dag-offset. WorkoutDetail.js verwijderd

## TODO

### Opruimen (hoge prioriteit)
- [x] Legacy code verwijderen uit AppClient.js — oude TAB 0/1/2/3/4 blokken, `{false && ...}`, onbereikbare tabs
- [x] AppClient.js reduceren — van 1716 naar ~570 regels, alleen state+routing+data
- [x] Ongebruikte helpers verwijderd (Chip, InfoKnop, Kaart, MiniChart, RpeInline, zoekZone, roepClaude, genereerSchema, slaRpeOp)
- [x] Ongebruikte imports verwijderd (recharts, TrainingLoadPanel, PowerCurvePanel, HerstelStatusPanel, TSSWeekPanel, etc.)
- [x] Ongebruikte state verwijderd (gevoel, bijzonder, schema, laadtSchema, rittenWekenTerug, geselecteerdeRit, beschikbaarheidOpen, rpeOpgeslagen)
- [ ] Ongebruikte component-bestanden verwijderen (ZoneVerdeling.js)
- [ ] `sessieverdeling.js` verwijderen of hergebruiken — wordt niet meer actief gebruikt

### Functionaliteit
- [ ] Sessie-generatie betrouwbaarder maken — useEffect timing issue bij kader-creatie
- [ ] Rit-sessie koppeling uitbreiden — vergelijken gepland vs werkelijk (vermogen, TSS, duur), feedback
- [ ] RPE koppelen aan sessie na voltooiing
- [ ] Zones dynamisch laden van intervals.icu
- [ ] Power curve met echte best efforts (niet geschat uit gemiddeld wattage)
- [ ] Cardiac decoupling — hartslag-drift analyseren voor aerobe fitness

### Infrastructuur
- [ ] Strava OAuth voor productie (aparte app met Vercel callback domain)
- [ ] Wahoo workout push testen (intervals.icu events endpoint)
- [ ] Push notificaties (VAPID keys, service worker)
- [ ] PWA manifest updaten voor nieuw design (kleuren, naam)
