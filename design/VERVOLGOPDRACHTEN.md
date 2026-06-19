# Vervolgopdrachten Claude Code — secties 2 t/m 5

Geef deze opdrachten pas ná goedkeuring van de vorige sectie. Elke opdracht ervan uitgaand
dat Claude Code `design/README.md` en `design/IMPLEMENTATIE.md` al gelezen heeft uit sectie 1
— hoeft niet herhaald te worden, wel kort herbevestigd.

---

## Sectie 2 (update) — Workout-detail wordt de Schema-tab

**Dit is een wijziging op reeds gebouwde code, geen eerste implementatie** — sectie 2 en
sectie 6 zijn al eerder gebouwd. `design/IMPLEMENTATIE.md` is bijgewerkt: het losse
Schema-overzicht vervalt, Workout-detail (`WorkoutViz.js`) wordt voortaan het scherm achter
de Schema-tab, met dag-navigatie.

*"In `design/IMPLEMENTATIE.md` is sectie 2 herschreven en sectie 6 vervallen verklaard — lees
beide voordat je begint. Kern van de wijziging: `WorkoutViz.js` wordt het scherm achter de
Schema-tab in de bottom-nav, met dag-navigatie via chevrons (gebaseerd op de bijgewerkte
`design/Pedalytics_Workout_dc.html` en `design/README.md` sectie '2. Workout-detail').*

*Voeg toe aan `WorkoutViz.js`: (1) dag-navigatie met vorige/volgende-chevrons, contextafhankelijk
label (Gisteren/Vandaag·tijd/Morgen/datum); (2) een compacte TSS-weekkaart onder de
dag-navigatie die altijd de huidige kalenderweek toont, ongeacht welke dag bekeken wordt; (3)
een 'Aanpassen'-pil naast de sessietitel (navigatie-doel nog te bepalen — laat zien wat je
voorstelt); (4) een rust-staat die kerngetallen/grafiek/segmenten/onderbouwing vervangt zowel
bij bewuste rustdagen als bij dagen zonder geplande sessie — één staat voor beide gevallen,
geen onderscheid nodig.*

*Verwijder of redirect het bestaande `SchemaTab.js`-component (sectie 6, oud
weekoverzicht-ontwerp): de Schema-tab-route moet voortaan `WorkoutViz.js` openen op vandaag,
in plaats van naar het weekoverzicht te gaan. Check of er elders nog losse verwijzingen naar
het oude Schema-weekoverzicht zijn (bv. vanuit Home) die nu naar dit scherm moeten wijzen.*

*Laat eerst zien hoe je de dag-naar-sessie-koppeling aanpakt (welke sessie hoort bij welke
datum, inclusief rustdagen/dagen buiten het plan-bereik) voordat je verdergaat — dat is de
kernlogica van deze wijziging."*

---

## Sectie 3 — Voortgang

*"Ga door met sectie 3 uit `design/IMPLEMENTATIE.md`: Voortgang → `SeizoenProgressie.js`,
`TrainingLoad.js`, `PowerCurve.js`. Gebruik de chart-specs uit `design/README.md`
('Power curve & trendgrafiek-spec'): CTL als dikke gradient-lijn, ATL dunner grijs, TSB als
gevulde band tussen beide paden — geen losse derde lijn. Voed met wellness-historie uit
`/api/intervals/wellness` over de gekozen periode, niet de voorbeelddata. Laat je aanpak zien
voordat je verdergaat."*

---

## Sectie 4 + 5 — Volledige wizard (3 stappen) én Beschikbaarheid aanpassen (samen, één sessie)

**Belangrijk: dit is breder dan alleen de beschikbaarheid-stap.** `SeizoenWizard.js` is de
volledige 3-staps flow voor het instellen van een seizoensdoel (zie project-context: doel
instellen → beschikbaarheid → vermoedelijk bevestiging/overzicht als stap 3). We hebben maar
van **één** stap (stap 2, beschikbaarheid) een Claude Design-referentie
(`Pedalytics_Wizard_Beschikbaarheid_dc.html`). De opdracht is nu: **de hele wizard** omzetten
naar het nieuwe design, niet alleen die ene stap.

*"Ga door met sectie 4 en 5 uit `design/IMPLEMENTATIE.md`, met deze verbreding: dit betreft
niet alleen de beschikbaarheid-stap, maar de volledige bestaande 3-staps `SeizoenWizard.js`
(doel instellen, beschikbaarheid, en de overige stap(pen) zoals die nu al werken — behoud de
bestaande functionaliteit en stap-inhoud van die andere stappen, verander alleen de visuele
laag).*

*Voor de beschikbaarheid-stap heb je een exacte design-referentie
(`Pedalytics_Wizard_Beschikbaarheid_dc.html`) — volg die letterlijk qua opbouw (zie
IMPLEMENTATIE.md sectie 4).*

*Voor de overige wizard-stap(pen), waarvoor geen losse Claude Design-referentie bestaat: pas
dezelfde design tokens en componentstijl toe (kaarten radius 28px, pil-knoppen, Nunito/Fredoka
typografie, progress-segmenten bovenaan zoals in de beschikbaarheid-stap, zelfde
Terug/Volgende-footer-stijl) zodat de hele wizard er als één geheel uitziet. Gebruik de
beschikbaarheid-stap als stijl-anker voor de rest.*

*Bouw daarnaast het gedeelde `BeschikbaarheidEditor.js`-component (dag-toggle + uren-stepper,
logica gebaseerd op `toggle()`/`bump()`/`fmt()` uit de referentie-bestanden, herschreven als
React state/hooks), en gebruik dat zowel in wizard-stap 2 als in het losse bewerkscherm
'Beschikbaarheid aanpassen' met als verschil: databron (leeg bij wizard, vooringevuld vanuit
`/api/plan` bij het bewerkscherm) en afsluitactie (volgende wizard-stap vs. opslaan-en-terug).*

*Los hierbij ook de geconstateerde inconsistentie op: kies één weekvolgorde voor de hele app
(Ma→Zo, zoals de Home-weekstrip) en pas de dagvolgorde in deze schermen daarop aan.*

*Laat eerst zien welke stappen de huidige wizard precies heeft en hoe je de niet-ontworpen
stap(pen) qua layout invult, voordat je dat bouwt — dat is het deel zonder directe
design-referentie, dus daar wil ik kunnen meekijken.*

*Test na afronding expliciet: het volledige wizard-flow doorlopen (doel + beschikbaarheid
instellen), reload, en controleer dat alles zowel op Home als in het bewerkscherm correct
getoond wordt — dit dekt de twee bekende TODO-bugs in één keer."*

---

## Sectie 6 — VERVALLEN, zie sectie 2 (update)

Het losse Schema-weekoverzicht is vervangen door de dag-navigatie in Workout-detail. Geen
aparte opdracht meer nodig; sectie 2 (update) dekt deze wijziging volledig, inclusief het
opruimen/verwijderen van het oude `SchemaTab.js`.

---

## Tot slot — opruimen

Pas als alle 5 secties goedgekeurd zijn:

*"Controleer of er nu dubbele of verouderde UI-elementen overblijven uit de oude
implementatie (bv. CTL/ATL/TSB die op meerdere plekken stond, het oude weekschema-generator
blok) en stel voor wat opgeruimd kan worden, conform de TODO in de project-context."*
