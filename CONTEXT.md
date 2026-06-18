# Pedalytics — Persoonlijke Fietscoach App

## Wat is dit?
Een persoonlijke fietscoach PWA voor Frank Levering. De app analyseert fietsdata van intervals.icu en genereert wekelijks een gepersonaliseerd trainingsschema dat direct naar een Wahoo ELEMNT Bolt wordt gepushed.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Hosting:** Vercel
- **Data:** intervals.icu API (primaire bron)
- **Apparaat:** Wahoo ELEMNT Bolt (via intervals.icu koppeling)
- **Activiteiten sync:** Wahoo → Strava → intervals.icu (automatisch)

## Atleet Profiel — Frank Levering
- **FTP:** 265W
- **Lactaatdrempel hartslag:** 184 bpm
- **Max hartslag:** 200 bpm
- **Gewicht:** 90 kg
- **Rusthartslag:** ~49 bpm
- **HRV basislijn:** 57-60 ms
- **Doel:** 31+ km/u gemiddeld solo in Z2
- **Seizoen:** Eerste fietsseizoen (2026)
- **intervals.icu Athlete ID:** i594622

## Hartslagzones (worden dynamisch geladen van intervals.icu)
- Z1 Herstel: < 128 bpm
- Z2 Duur: 128-156 bpm (doelzone: 170-200W)
- Z3 Tempo: 156-175 bpm
- Z4 Drempel: 175-184 bpm
- Z5 VO2max: > 184 bpm

## App Structuur
```
src/app/
├── page.js              # Minimale Next.js page, laadt AppClient met ssr:false
├── AppClient.js         # Volledige app (5 tabs)
├── layout.js
├── globals.css
├── components/
│   ├── TrainingLoad.js  # CTL/ATL/TSB berekening en grafiek
│   ├── PowerCurve.js    # Power curve visualisatie
│   ├── ZoneVerdeling.js # Hartslagzone verdeling per rit
│   ├── HerstelStatus.js # Gecombineerde herstelstatus (HRV+HR+TSB+slaap)
│   ├── TSSWeek.js       # TSS weekvoortgang vs doel
│   └── DagelijkseInvoer.js # Ochtendmeting HRV/HR/slaap
└── api/intervals/
    ├── activities/      # GET activiteiten van intervals.icu
    ├── wellness/        # GET/PUT wellness data (HRV, slaap, etc.)
    ├── events/          # POST workouts naar intervals.icu → Wahoo
    ├── zones/           # GET hartslagzones van intervals.icu
    ├── workouts/[id]/   # PUT RPE per activiteit
    └── test/            # Debug endpoint voor API key check
```

## App Tabs
1. **🌅 Ochtend** — Dagelijkse HRV, rusthartslag, slaap invoer + herstelstatus + TSS week
2. **📅 Schema** — Beschikbare dagen selecteren → AI genereert weekschema → push naar Wahoo
3. **📈 Voortgang** — Seizoensoverzicht, power curve, zones, trends, CTL/ATL/TSB
4. **⭐ RPE** — RPE invullen per rit (opgeslagen in intervals.icu)
5. **⚙️ Instellingen** — Profiel, koppelingen

## Intervals.icu Authenticatie
```javascript
// CORRECT — Basic auth met API_KEY als username
"Basic " + Buffer.from("API_KEY:" + API_KEY).toString("base64")
```

## Environment Variables (Vercel + .env.local)
```
INTERVALS_API_KEY=...
INTERVALS_ATHLETE_ID=i594622
STRAVA_WEBHOOK_VERIFY_TOKEN=fietscoach2026
```

## Bekende Issues / TODO
- [ ] 403 van intervals.icu API in productie — nieuwe API key gegenereerd, auth methode geverifieerd
- [ ] Zones dynamisch laden van intervals.icu (route bestaat maar nog niet getest)
- [ ] RPE opslaan werkt mogelijk niet (perceived_exertion endpoint check nodig)
- [ ] Push notificaties nog niet geïmplementeerd (VAPID keys ontbreken)
- [ ] Wahoo workout push via intervals.icu events endpoint (nog niet getest)
- [ ] Power curve gebruikt geschatte data — best efforts van intervals.icu beter integreren

## Deployment
- **Lokaal:** `npm run dev` → http://localhost:3000
- **Productie:** GitHub → Vercel auto-deploy bij push naar `main`
- **GitHub repo:** github.com/frlevering/pedalytics (of vergelijkbaar)

## Belangrijke Design Beslissingen
- `page.js` gebruikt `dynamic(() => import('./AppClient'), { ssr: false })` — dit voorkomt Next.js pre-render errors met browser APIs
- Alle intervals.icu API calls lopen via Next.js API routes (server-side) zodat de API key nooit in de browser komt
- App is gebouwd als PWA — installeerbaar op telefoon via Chrome/Safari

## Context Vorige Ontwikkeling
De app is iteratief gebouwd via Claude.ai. Grote hoeveelheid features zijn toegevoegd waaronder:
- CTL/ATL/TSB berekening en visualisatie
- Power curve met rider type classificatie
- Hartslagzone verdeling per rit (Z1-Z5)
- Gecombineerde herstelstatus score
- Dagelijkse ochtendmeting
- Wekelijks AI-gegenereerd schema via Claude API
- TSS weekvoortgang tracker
