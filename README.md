# 🚴 Fietscoach Frank — PWA

Persoonlijke fietscoach app met Strava-integratie, push notificaties en weekschema-generator.

## Features

- 📅 **Weekschema** — AI-coach analyseert Strava-data en maakt gepersonaliseerd schema
- 📈 **Seizoensoverzicht** — volledige progressie met trends en grafieken
- ⭐ **RPE invoer** — vul je inspanning in na elke rit, push notificatie herinnert je
- 📱 **PWA** — installeerbaar op iPhone en Android als native app
- 🔔 **Push notificaties** — automatische melding na nieuwe Strava-rit

---

## Setup in 5 stappen

### Stap 1 — Project klonen en dependencies installeren

```bash
cd fietscoach
npm install
```

### Stap 2 — VAPID keys genereren (voor push notificaties)

```bash
npx web-push generate-vapid-keys
```

Kopieer de output — je hebt straks de Public Key en Private Key nodig.

### Stap 3 — Environment variables aanmaken

Maak een bestand `.env.local` aan:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=jouw_public_key_hier
VAPID_PRIVATE_KEY=jouw_private_key_hier
STRAVA_WEBHOOK_VERIFY_TOKEN=kies_een_geheim_woord_bijv_fietscoach2026
```

### Stap 4 — Deployen op Vercel

```bash
# Vercel CLI installeren
npm install -g vercel

# Inloggen
vercel login

# Deployen
vercel --prod
```

Voeg in het Vercel dashboard (Settings → Environment Variables) dezelfde variabelen toe als in `.env.local`.

### Stap 5 — Strava webhook registreren

Na deployment, registreer de webhook bij Strava zodat je notificaties krijgt na een nieuwe rit:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=JOUW_STRAVA_CLIENT_ID \
  -F client_secret=JOUW_STRAVA_CLIENT_SECRET \
  -F callback_url=https://jouw-app.vercel.app/api/strava/webhook \
  -F verify_token=fietscoach2026
```

Je Strava Client ID en Secret vind je op: https://www.strava.com/settings/api

---

## Vercel KV toevoegen (voor permanente push subscriptions)

Standaard worden subscriptions in geheugen opgeslagen (verdwijnen bij herstart). Voor permanentie:

1. Ga naar Vercel dashboard → Storage → Create KV Database
2. Koppel aan je project
3. Vervang in `src/app/api/push/subscribe/route.js` de in-memory store met:

```javascript
import { kv } from "@vercel/kv";
await kv.set("push_subscription", subscription);
```

En in `src/app/api/strava/webhook/route.js`:

```javascript
import { kv } from "@vercel/kv";
const subscription = await kv.get("push_subscription");
```

---

## App installeren op telefoon

**iPhone (iOS 16.4+):**
1. Open Safari → ga naar jouw-app.vercel.app
2. Tik op Delen (□↑)
3. Tik "Zet op beginscherm"
4. Tik "Voeg toe"

**Android:**
1. Open Chrome → ga naar jouw-app.vercel.app
2. Tik op menu (⋮)
3. Tik "App installeren" of "Toevoegen aan startscherm"

---

## Lokaal draaien

```bash
npm run dev
# Open http://localhost:3000
```

---

## Project structuur

```
fietscoach/
├── public/
│   ├── sw.js              # Service Worker (push + offline)
│   ├── manifest.json      # PWA manifest
│   ├── icon-192.png       # App icoon (voeg zelf toe)
│   └── icon-512.png       # App icoon groot (voeg zelf toe)
├── src/app/
│   ├── layout.js          # HTML layout met PWA meta tags
│   ├── page.js            # Hoofd app
│   ├── globals.css        # Globale stijlen
│   └── api/
│       ├── push/
│       │   ├── subscribe/ # Sla push subscription op
│       │   └── send/      # Verstuur push notificatie
│       └── strava/
│           └── webhook/   # Ontvang Strava events
├── next.config.js
└── package.json
```

---

## App iconen toevoegen

Voeg twee PNG-bestanden toe aan de `/public` map:
- `icon-192.png` (192×192 pixels)
- `icon-512.png` (512×512 pixels)

Gebruik een fiets of wielrenner icoon in jouw stijl.
