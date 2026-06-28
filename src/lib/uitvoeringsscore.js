export function dimensieScore(werkelijk, doel) {
  if (!doel || doel === 0) return null
  const afwijking = Math.abs(werkelijk / doel - 1)
  if (afwijking <= 0.05) return 10
  return Math.max(0, 10 - (afwijking - 0.05) / 0.019)
}

function gewogenAfwijkingstijd(tijdInZones, toegestaneZones) {
  const alleZones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7']
  let afwijkingsTijd = 0
  const totaleTijd = Object.values(tijdInZones).reduce((a, b) => a + b, 0)
  if (totaleTijd === 0) return 0

  const hoogsteBeoogdIndex = Math.max(
    ...toegestaneZones.map(z => alleZones.indexOf(z))
  )

  for (const [zone, seconden] of Object.entries(tijdInZones)) {
    if (toegestaneZones.includes(zone)) continue
    const zoneIndex = alleZones.indexOf(zone)
    if (zoneIndex > hoogsteBeoogdIndex) {
      const niveausErBoven = zoneIndex - hoogsteBeoogdIndex
      afwijkingsTijd += seconden * (1.0 + (niveausErBoven - 1) * 0.5)
    } else {
      afwijkingsTijd += seconden * 0.3
    }
  }
  return afwijkingsTijd / totaleTijd
}

export function zonedistributieScore(tijdInZones, toegestaneZones) {
  if (!tijdInZones || !toegestaneZones?.length) return null
  const afwijkingsFractie = gewogenAfwijkingstijd(tijdInZones, toegestaneZones)
  const PLATEAU = 0.15
  const gecorrigeerdeAfwijking = Math.max(0, afwijkingsFractie - PLATEAU)
  return Math.max(0, Math.round((10 - gecorrigeerdeAfwijking * 20) * 10) / 10)
}

export const BEOOGDE_IF = {
  z1_herstel: 0.50,
  z2_vlak: 0.65, z2_steady: 0.65, z2_cadans: 0.65, z2_heuvel: 0.65,
  z2_duur: 0.70, z2_tempo_teugjes: 0.70,
  sweetspot_intervallen: 0.88,
  drempel_intervallen: 0.97, over_under: 0.97,
  vo2max_intervallen: 1.10,
  sprint_neuraal: 0.60,
  kracht_lage_cadans: 0.83,
  pyramide: 0.92,
  ramp_test: 0.75,
}

export function berekenUitvoeringsscore(werkelijk, gepland, dagIntentie) {
  const scores = []

  const duurScore = dimensieScore(werkelijk.moving_time, gepland.duur_seconden)
  if (duurScore !== null)
    scores.push({ score: duurScore, gewicht: 0.23 })

  const tssScore = dimensieScore(werkelijk.icu_training_load, gepland.tss_doel)
  if (tssScore !== null)
    scores.push({ score: tssScore, gewicht: 0.15 })

  const beoogdeIF = BEOOGDE_IF[dagIntentie?.sessietype] ?? null
  const ifScore = beoogdeIF
    ? dimensieScore(werkelijk.icu_intensity, beoogdeIF)
    : null
  if (ifScore !== null)
    scores.push({ score: ifScore, gewicht: 0.22 })

  const zoneScore = zonedistributieScore(
    werkelijk.icu_time_in_zone,
    dagIntentie?.toegestane_zones
  )
  if (zoneScore !== null)
    scores.push({ score: zoneScore, gewicht: 0.40 })

  if (scores.length === 0) return null

  const totaalGewicht = scores.reduce((sum, s) => sum + s.gewicht, 0)
  const totaal = scores.reduce(
    (sum, s) => sum + (s.score * s.gewicht / totaalGewicht), 0
  )
  return Math.round(totaal * 10) / 10
}

export function berekenUitvoeringsscoreMetDetails(werkelijk, gepland, dagIntentie) {
  const dimensies = {}
  const scores = []

  const duurScore = dimensieScore(werkelijk.moving_time, gepland.duur_seconden)
  dimensies.duur = { score: duurScore, werkelijk: werkelijk.moving_time, doel: gepland.duur_seconden }
  if (duurScore !== null)
    scores.push({ key: 'duur', score: duurScore, gewicht: 0.23 })

  const tssScore = dimensieScore(werkelijk.icu_training_load, gepland.tss_doel)
  dimensies.belasting = { score: tssScore, werkelijk: werkelijk.icu_training_load, doel: gepland.tss_doel }
  if (tssScore !== null)
    scores.push({ key: 'belasting', score: tssScore, gewicht: 0.15 })

  const beoogdeIF = BEOOGDE_IF[dagIntentie?.sessietype] ?? null
  const ifScore = beoogdeIF ? dimensieScore(werkelijk.icu_intensity, beoogdeIF) : null
  dimensies.intensiteit = { score: ifScore, werkelijk: werkelijk.icu_intensity, doel: beoogdeIF }
  if (ifScore !== null)
    scores.push({ key: 'intensiteit', score: ifScore, gewicht: 0.22 })

  const zoneScore = zonedistributieScore(werkelijk.icu_time_in_zone, dagIntentie?.toegestane_zones)
  dimensies.zonedistributie = { score: zoneScore, werkelijk: werkelijk.icu_time_in_zone, doel: dagIntentie?.toegestane_zones }
  if (zoneScore !== null)
    scores.push({ key: 'zonedistributie', score: zoneScore, gewicht: 0.40 })

  if (scores.length === 0) return null

  const totaalGewicht = scores.reduce((sum, s) => sum + s.gewicht, 0)
  const totaal = scores.reduce(
    (sum, s) => sum + (s.score * s.gewicht / totaalGewicht), 0
  )
  const score = Math.round(totaal * 10) / 10

  return { score, label: scoreLabel(score), dimensies }
}

export function scoreLabel(score) {
  if (score === null) return null
  if (score <= 3.0) return 'Matig'
  if (score <= 6.0) return 'Redelijk'
  if (score <= 8.0) return 'Goed'
  if (score <= 9.0) return 'Uitstekend'
  return 'Perfecte uitvoering'
}

export function zoneTimesNaarObject(arr) {
  if (!arr || !Array.isArray(arr)) return null
  const obj = {}
  for (const z of arr) {
    if (z.id && /^Z[1-7]$/.test(z.id)) obj[z.id] = z.secs || 0
  }
  return Object.keys(obj).length > 0 ? obj : null
}
