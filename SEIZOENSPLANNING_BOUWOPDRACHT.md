# Kesto — Seizoensplanning Feature

## Context
Kesto is een persoonlijke fietscoach PWA voor Frank Levering. De app gebruikt
intervals.icu als databron en genereert wekelijks een trainingsschema via de Claude API.
De volledige codebase staat in deze repository. Lees CONTEXT.md voor technische details.

## Wat moet er gebouwd worden

Voeg een seizoensplanning systeem toe dat bestaat uit drie lagen:

1. Een seizoensplan van 12 weken gebaseerd op een doel
2. Wekelijkse automatische aanpassing op basis van werkelijke data en RPE
3. Dagelijks advies op basis van ochtendmeting

---

## Doelstellingen — keuze voor de gebruiker

De gebruiker kan kiezen uit vijf primaire doelen:

**FTP verhogen** *(Frank's huidige doel)*
- Invoer: tijdshorizon (standaard 12 weken) — geen streef-FTP nodig
- De coach berekent zelf een realistisch streefgetal op basis van huidige progressie en trainingsbelasting
- Huidig: 265W, verwacht bereik over 12 weken: 285-310W afhankelijk van consistentie
- Focus: gestructureerde drempel- en VO2max training, sweetspot intervals
- Automatisch: FTP-test ingebouwd elke 4 weken om voortgang te meten
- Meet: W/kg progressie, drempeluithoudingsvermogen, herstelsnelheid na inspanning

**Trainen voor een evenement**
- Invoer: evenementnaam, datum, type (granfondo / wedstrijd / klimrit / sociale rit)
- Focus: alles werkt naar één datum toe met verplichte taper laatste week
- Subtypes bepalen de trainingsmix (volume vs. snelheid vs. W/kg)

**Sneller worden in Z2**
- Invoer: streef-snelheid (bijv. 34 km/u) en deadline
- Focus: aerobe efficiëntie, meer watt bij gelijke hartslag
- Meet: W/bpm efficiëntie trend, gem. snelheid solo ritten

**Algemene fitheid opbouwen**
- Invoer: tijdshorizon (bijv. 12 weken)
- Focus: opbouwend volume, geen specifieke piek
- Voor begin seizoen of na pauze

**Herstel en consolidatie**
- Invoer: duur (bijv. 3-4 weken)
- Focus: lagere belasting, HRV optimaliseren, basissnelheid vasthouden
- Na intensief trainingsblok

De gebruiker kan ook een **secundair doel** kiezen (optioneel), bijv. primair evenement +
secundair FTP verhogen. Het plan optimaliseert voor primair maar meet secundair mee.

---

## De wizard — "Nieuw seizoen starten"

Bouw een wizard met vier stappen die verschijnt als er geen actief plan is:

**Stap 1 — Primair doel kiezen**
Toon de vijf doelen als klikbare kaarten met icoon, naam en korte beschrijving.

**Stap 2 — Doel instellen**
Afhankelijk van gekozen doel:
- FTP verhogen: alleen tijdshorizon (standaard 12 weken, aanpasbaar 8-16 weken). Geen streef-FTP — de coach berekent dit zelf op basis van huidige CTL, progressiesnelheid en trainingsbelasting. Toon wel een verwachting: 'Op basis van jouw data verwacht ik 285-310W na 12 weken'
- Evenement: datepicker + evenementnaam + type dropdown
- Z2 snelheid: slider voor streefsnelheid (huidige gem. snelheid automatisch ingevuld)
- Fitheid / herstel: tijdsduur slider

**Stap 3 — Secundair doel** (optioneel, mag worden overgeslagen)

**Stap 4 — Beschikbaarheid**
- Dagen per week beschikbaar (1-6)
- CrossFit / andere sport ja/nee en hoeveel dagen
- Seizoensgebonden beperkingen (bijv. "vakantie week 3")

Na stap 4: genereer het seizoensplan via de Claude API.

---

## Het seizoensplan — structuur

Het plan bestaat uit vier fasen:

| Fase | Weken | Focus | TSS opbouw | FTP-effect |
|------|-------|-------|------------|------------|
| Basis | 1-3 | Z2 volume + sweetspot intro | +5% per week | Aerobe basis |
| Sweetspot | 4-6 | Sweetspot blokken (88-93% FTP) | +8% per week | +3-5W |
| Drempel | 7-9 | Drempel intervals (95-105% FTP) + VO2max pieken | +5% per week | +5-8W |
| Consolidatie | 10-11 | Drempel vasthouden, herstel optimaliseren | Stabiel | Adaptatie |
| Test + reset | 12 | FTP-test week 4, 8 en 12 — herstelweek + nieuwe baseline | -20% | Meting |

FTP-test protocol (elke 4 weken):
- Dag 1: herstelrit 45 min Z1
- Dag 2: 20-minuten alles-of-niets test, FTP = gemiddeld vermogen × 0.95
- Automatisch: intervals.icu berekent eFTP continu — gebruik die als tussentijdse indicatie

Sla het plan op als JSON in intervals.icu wellness notities of als Vercel KV entry.
Structuur per week:

```json
{
  "seizoensplan": {
    "doel": "ftp_verhogen",
    "streefwaarde": "285-310W (coach berekend)",
    "huidige_ftp": 265,
    "tijdshorizon_weken": 12,
    "deadline": "2026-10-01",
    "gegenereerd_op": "2026-06-18",
    "weken": [
      {
        "week": 1,
        "fase": "basis",
        "tss_doel": 280,
        "sessies": [
          {
            "type": "duur_lang",
            "tss": 90,
            "duur_min": 150,
            "vermogen": "170-195W",
            "hartslag": "<152 bpm",
            "reden": "Aerobe basis opbouwen na rustperiode"
          }
        ],
        "weekdoel": "Consistent Z2 rijden, hartslag bewust onder 152 bpm houden"
      }
    ]
  }
}
```

---

## Wekelijkse aanpassing — de logica

Elke maandag (of bij het openen van de app) vergelijkt de app de afgelopen week:

```
werkelijke_tss = som van tss van alle activiteiten afgelopen 7 dagen (van intervals.icu)
geplande_tss = seizoensplan.weken[huidige_week].tss_doel
tss_ratio = werkelijke_tss / geplande_tss

gem_rpe = gemiddelde van alle RPE scores afgelopen week
hrv_trend = dalend / stabiel / stijgend (laatste 5 dagen)
```

FTP-specifieke aanpassingsregels:
```
als eFTP_stijging_per_week < 0.5W  → sweetspot verlengen, drempel uitstellen
als eFTP_stijging_per_week > 2W    → schema is effectief, doorgaan
als FTP_test_resultaat > verwacht  → plan opschalen met +5%
als FTP_test_resultaat < verwacht  → herstelweek inlassen, basis versterken
als gem_rpe_interval > 8           → intensiteit terug naar sweetspot
```

Algemene aanpassingsregels voor volgende week:

```
als tss_ratio < 0.8 EN gem_rpe > 7  → plan was te zwaar → volgende week tss_doel * 0.9
als tss_ratio < 0.8 EN gem_rpe < 5  → externe factoren (druk, weer) → geen aanpassing
als tss_ratio > 0.95 EN gem_rpe < 5 → plan was te licht → volgende week tss_doel * 1.05
als hrv_trend = dalend (3+ dagen)   → intensiteitsblok uitstellen met 1 week
als hrv_trend = stijgend            → plan volgen of iets opschalen
```

Stuur deze data samen met het seizoensplan naar de Claude API voor het weekschema.
De API response bevat nu ook: `aanpassing_reden` (waarom is dit week anders dan gepland).

---

## Dagelijks advies op basis van ochtendmeting

Gebruik de bestaande ochtendmeting (HRV, rusthartslag, gevoel) en combineer met TSB.
Toon één van vier statussen bovenaan de ochtend-tab:

**🟢 Ga zoals gepland**
HRV >= basislijn - 5%, rusthartslag <= basislijn + 2, TSB > -15

**🟡 Pas licht aan**
HRV 10-15% onder basislijn OF rusthartslag 3-5 boven basislijn
→ Toon: "Rijd 20% korter dan gepland, houd hartslag 5 bpm lager"

**🟠 Verschuif naar morgen**
HRV > 15% onder basislijn OF rusthartslag > 5 boven basislijn
→ Toon: "Sla vandaag over. De geplande sessie verschuift naar morgen."

**🔴 Rust vandaag**
HRV > 20% onder basislijn OF rusthartslag > 8 boven basislijn OF gevoel = "slecht"
→ Toon: "Geen training vandaag. Je lichaam heeft herstel nodig."

De basislijnen zijn: HRV 58ms, rusthartslag 49 bpm (Frank's waarden, hardcoded voor nu).

---

## Progressie visualisatie — nieuw scherm

Voeg een "Seizoen" tab toe (of sectie in de Voortgang tab) met:

**CTL progressie grafiek**
- Stippellijn: verwacht CTL pad (uit seizoensplan)
- Doorgetrokken lijn: werkelijk CTL pad (uit intervals.icu wellness)
- Verticale markering: huidige week
- Annotatie: "X weken voor deadline"

**Doelvoortgang**
Afhankelijk van doel:
- Z2 snelheid: huidige gem. snelheid vs. streefsnelheid, voortgangsbalk
- FTP: huidige eFTP (intervals.icu) vs. verwacht FTP pad, met bandbreedte (optimistisch/realistisch/conservatief)
- Evenement: countdown in dagen + verwachte form op evenementdag (TSB prognose)

**Weekvergelijking**
Eenvoudige tabel: week 1 t/m huidig, kolommen: gepland TSS / werkelijk TSS / RPE gem. / status (✓ / ⚠️ / ✗)

---

## RPE feedback loop — verbetering bestaande feature

De huidige RPE invoer slaat op in intervals.icu maar wordt niet actief gebruikt.
Voeg toe:

1. **RPE trend per trainingstype** — toon in voortgang: gem. RPE bij duurritten, intervals, herstel
2. **Automatische Z2 aanpassing** — als duurritten 3+ weken gem. RPE > 7: verlaag Z2 doelvermogen met 5W in het plan
3. **Interval aanpassing** — als intervallen gem. RPE < 5: verhoog doelintensiteit bij volgende intervalblok
4. **RPE vs. prestatie annotatie** — in de rittenlijst: toon of RPE overeenkwam met verwachting

---

## Uitleg per sessie

Elke geplande sessie in het weekschema krijgt een `reden` veld:
*"Vandaag Z2 omdat je CTL deze week 8% gegroeid is en je lichaam consolidatie nodig heeft"*
*"Intervalrit vandaag — je TSB is +5, optimaal moment voor hoge intensiteit"*

Dit veld wordt door Claude gegenereerd als onderdeel van de schema-respons.

---

## Geschatte FTP progressie — berekening

De app toont een wetenschappelijk onderbouwde FTP-prognose op basis van Frank's huidige data.

### De formule

```
weekelijkse_ftp_groei = (ctl_stijging_per_week × intensiteitsfactor) - vermoeidheidskorting

intensiteitsfactor:
  Z2 alleen:          0.10  (basis aerobe aanpassing)
  Sweetspot dominant: 0.18  (optimale FTP stimulus)
  Drempel dominant:   0.22  (hoge stimulus, hoger herstelkosten)
  Gemengd (ons plan): 0.15 → 0.20 → 0.22 per fase

vermoeidheidskorting:
  ATL/CTL ratio < 1.1:  0 (goed hersteld)
  ATL/CTL ratio 1.1-1.3: 0.05 per week
  ATL/CTL ratio > 1.3:   0.10 per week (overreaching)
```

### Startwaarden Frank

```javascript
const HUIDIGE_FTP = 265;           // gemeten maart 2026
const HUIDIGE_CTL = 43;            // intervals.icu
const CTL_DOEL_WEEK_12 = 65;       // realistisch bij 3x/week trainen
const CTL_STIJGING_PER_WEEK = (65 - 43) / 12; // ~1.8 per week

// Prognose per fase
const prognose = {
  basis:        { weken: [1,2,3],    factor: 0.15, groei_per_week: 1.8 * 0.15 }, // ~0.27W/week
  sweetspot:    { weken: [4,5,6],    factor: 0.18, groei_per_week: 1.8 * 0.18 }, // ~0.32W/week
  drempel:      { weken: [7,8,9],    factor: 0.22, groei_per_week: 1.8 * 0.22 }, // ~0.40W/week
  consolidatie: { weken: [10,11],    factor: 0.15, groei_per_week: 1.8 * 0.15 }, // ~0.27W/week
  test:         { weken: [12],       factor: 0,    groei_per_week: 0 },
};

// Verwachte FTP per week (realistisch scenario)
const ftp_prognose_realistisch = [
  265, 265, 266, 267,   // basis (FTP test week 4: ~268W)
  268, 269, 270,        // sweetspot
  271, 272, 274, 275,   // drempel (FTP test week 8: ~275W)
  276, 277,             // consolidatie
  278                   // FTP test week 12: ~278-285W
];

// Bandbreedte
const conservatief = ftp_prognose_realistisch.map(w => w - 5);  // slechte slaap, inconsistent
const optimistisch = ftp_prognose_realistisch.map(w => w + 10); // perfecte uitvoering
```

### Wat de app toont

Bouw een FTP-prognose grafiek in de Seizoen tab met:

- **Drie lijnen:**
  - Stippellijn grijs: conservatief scenario (-5W)
  - Doorgetrokken blauw: realistisch scenario (berekend)
  - Stippellijn groen: optimistisch scenario (+10W)

- **Punten op de lijn:**
  - Week 4: FTP-test marker (diamant icoon)
  - Week 8: FTP-test marker
  - Week 12: FTP-test marker

- **Actuele FTP:**
  - Zodra een FTP-test is gedaan: toon het werkelijke resultaat als grote stip
  - Vergelijk met prognose: "Je zit 3W voor op schema 🔥" of "Je loopt 2W achter — herstelweek aangeraden"

- **eFTP continu:**
  - Toon intervals.icu eFTP als dunne lijn — dit is de dagelijkse schatting
  - Helpt zien of je op koers ligt zonder formele test

### Aanpassing prognose op basis van werkelijke data

Herbereken de prognose elke week op basis van:

```
als werkelijke_ctl_stijging > verwacht → verhoog optimistische bandbreedte
als werkelijke_ctl_stijging < verwacht → verlaag realistisch scenario
als FTP_test_resultaat bekend          → gebruik als nieuw startpunt voor resterende weken
```

Dit zorgt dat de prognose dynamisch wordt en steeds accurater naarmate het seizoen vordert.

## Wat er NIET verandert


- De bestaande tabs (Ochtend, Schema, Voortgang, RPE, Instellingen) blijven intact
- De intervals.icu integratie blijft hetzelfde
- De Wahoo push blijft werken
- De bestaande componenten (TrainingLoad, PowerCurve etc.) blijven ongewijzigd

---

## Volgorde van implementatie

Bouw in deze volgorde zodat elke stap testbaar is:

1. **Seizoensplan wizard** — de wizard UI en het genereren van het plan via Claude API
2. **Plan opslaan en uitlezen** — persistentie via Vercel KV (installeer `@vercel/kv`)
3. **Wekelijkse vergelijking** — werkelijk vs. gepland TSS ophalen en berekenen
4. **Dagelijks advies** — logica op basis van ochtendmeting + TSB
5. **Progressie visualisatie** — CTL pad grafiek en doelvoortgang
6. **RPE feedback loop** — RPE trend integreren in planaanpassing

---

## Technische notities

- Gebruik `@vercel/kv` voor plan opslag: `kv.set('seizoensplan_i594622', plan)`
- Claude API aanroep voor plan generatie: zelfde patroon als bestaande schema generatie
- intervals.icu wellness endpoint voor TSS per dag: `GET /athlete/{id}/wellness?fields=id,ctl,atl,tss`
- Frank's profiel constanten (FTP 265W, HRV basislijn 58ms, HR rust 49 bpm) staan in AppClient.js
- eFTP ophalen: `GET /athlete/{id}/activities?fields=icu_ftp` — intervals.icu berekent dit continu
- FTP-test herinnering: toon melding als het >28 dagen geleden is en eFTP significant afwijkt van gemeten FTP

---

## Definition of done

- Gebruiker kan een doel instellen via de wizard
- App genereert een 12-weken plan zichtbaar per week
- Wekelijks wordt het plan vergeleken met werkelijke data
- Dagelijks advies verschijnt op de ochtend tab op basis van ochtendmeting
- CTL progressie grafiek toont verwacht vs. werkelijk
- RPE beïnvloedt actief het plan de volgende week
