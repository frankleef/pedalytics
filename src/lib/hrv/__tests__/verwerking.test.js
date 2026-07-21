import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/hrv/leerdata', () => ({ registreerHrvObservatie: vi.fn(async () => {}) }))
vi.mock('@/lib/users', () => ({ getIntervalsCredentials: vi.fn(async () => ({ apiKey: 'k', athleteId: 'a' })) }))
vi.mock('@/lib/intervals', () => ({ intervalsPut: vi.fn(async () => ({})) }))
vi.mock('@/lib/workoutZwo', () => ({ sessieNaarZwo: vi.fn(() => '<workout_file/>') }))
vi.mock('@/lib/sessie/herschikking', () => ({ probeerHerschikking: vi.fn() }))
vi.mock('@/lib/sessie/alternatief', () => ({ bepaalNieuweIntentie: vi.fn() }))

import { getKV } from '@/lib/kv'
import { registreerHrvObservatie } from '@/lib/hrv/leerdata'
import { getIntervalsCredentials } from '@/lib/users'
import { intervalsPut } from '@/lib/intervals'
import { sessieNaarZwo } from '@/lib/workoutZwo'
import { probeerHerschikking } from '@/lib/sessie/herschikking'
import { bepaalNieuweIntentie } from '@/lib/sessie/alternatief'
import { verwerkSchrappen, verwerkOrigineel, verwerkVerlichten } from '../verwerking.js'

function maakKvMock() {
  const store = new Map()
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    incr: vi.fn(async () => {}),
    expire: vi.fn(async () => {}),
  }
}

beforeEach(() => {
  vi.mocked(registreerHrvObservatie).mockClear()
  vi.mocked(getIntervalsCredentials).mockClear()
  vi.mocked(intervalsPut).mockClear()
  vi.mocked(sessieNaarZwo).mockClear()
  vi.mocked(probeerHerschikking).mockReset().mockResolvedValue(null)
  vi.mocked(bepaalNieuweIntentie).mockReset()
})

describe('verwerkSchrappen — content-vervanging (B1)', () => {
  it('vervangt tss/duur_min/type/segmenten/intentie door de herstelrit-waarden', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)

    const sessie = {
      datum: '2026-07-13',
      titel: 'Sweetspot-intervallen', vermogen: '210-231W',
      tss: 85, duur_min: 75, type: 'intensief',
      segmenten: [{ label: 'origineel-segment' }],
      intentie: { sessietype: 'sweetspot_intervallen', toegestane_zones: ['Z3', 'Z4'] },
    }
    const plan = { huidige_ftp: 300, weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', { hrv_vandaag: 42, fase: 'basis' }, plan)

    const opgeslagenSessie = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]

    expect(opgeslagenSessie.tss).toBe(18)
    expect(opgeslagenSessie.duur_min).toBe(30)
    expect(opgeslagenSessie.type).toBe('herstel')
    expect(opgeslagenSessie.segmenten).toEqual([
      { label: 'Z1 herstel', type: 'herstel', duur_min: 30, vermogenMin: 45, vermogenMax: 55 },
    ])
    expect(opgeslagenSessie.intentie).toEqual({
      rol: 'hersteldag',
      sessietype: 'z1_herstel',
      toegestane_zones: ['Z1'],
      tss_range: { min: 12, max: 25 },
      toelichting: 'Rustdag-vervanging: alleen Z1 actief herstel',
    })
    // Puur-weergave-velden (audit-bevinding): titel/vermogen moeten ook
    // vervangen worden, anders toont de UI een mismatch met de nieuwe inhoud.
    expect(opgeslagenSessie.titel).toBe('Herstelrit')
    expect(opgeslagenSessie.vermogen).toBe('135-165W') // 300 * 0.45 / 0.55, afgerond
    expect(opgeslagenSessie.reden).toBe('Je hersteldata wijzen op onvoldoende herstel. Een korte, lage-intensiteit rit ondersteunt actief herstel.')
  })

  it('bewaart de oorspronkelijke waarden (incl. titel/vermogen/reden) in sessie_voor_hrv_schrappen', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)

    const sessie = {
      datum: '2026-07-13',
      titel: 'Sweetspot-intervallen', vermogen: '210-231W',
      tss: 85, duur_min: 75, type: 'intensief',
      segmenten: [{ label: 'origineel-segment' }],
      intentie: { sessietype: 'sweetspot_intervallen' },
    }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    const snapshot = kv.store.get('u1:seizoensplan').weekSessies.sessies[0].sessie_voor_hrv_schrappen
    expect(snapshot).toEqual({
      type: 'intensief', titel: 'Sweetspot-intervallen',
      tss: 85, duur_min: 75, vermogen: '210-231W', reden: undefined,
      segmenten: [{ label: 'origineel-segment' }],
      intentie: { sessietype: 'sweetspot_intervallen' },
    })
  })

  it('dekt automatisch elk veld dat maakHerstelRit() teruggeeft (geen handmatig bijgehouden veldenlijst)', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = { datum: '2026-07-13', titel: 'Drempeltraining', intentie: { sessietype: 'drempel_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    // maakHerstelRit() retourneert 8 velden (type, titel, tss, duur_min,
    // vermogen, reden, segmenten, intentie) — het snapshot moet er evenveel hebben.
    expect(Object.keys(s.sessie_voor_hrv_schrappen).sort()).toEqual(
      ['duur_min', 'intentie', 'reden', 'segmenten', 'titel', 'tss', 'type', 'vermogen'].sort()
    )
  })

  it('behoudt mode/hrv_keuze*-gedrag ongewijzigd', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = { datum: '2026-07-13', tss: 85, intentie: { sessietype: 'z2_duur' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.mode).toBe('geschrapt_hrv')
    expect(s.hrv_keuze_gemaakt).toBe(true)
    expect(s.hrv_keuze).toBe('schrappen')
    expect(s.hrv_keuze_timestamp).toEqual(expect.any(String))
  })

  it('gebruikt fallback-FTP 265 als huidige_ftp op het plan ontbreekt', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'drempel_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } } // geen huidige_ftp

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.tss).toBe(18) // maakHerstelRit(265) faalt niet en levert de standaard herstelrit
  })

  it('logt het OORSPRONKELIJKE sessietype bij registreerHrvObservatie, niet het herstelrit-type', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'vo2max_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', { hrv_vandaag: 38 }, plan)

    expect(registreerHrvObservatie).toHaveBeenCalledWith('u1', expect.objectContaining({
      keuze: 'schrappen',
      sessietype: 'vo2max_intervallen',
    }))
  })
})

describe('verwerkOrigineel — symmetrisch herstel na verwerkSchrappen (B1)', () => {
  it('herstelt tss/duur_min/type/segmenten/intentie uit sessie_voor_hrv_schrappen', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)

    const sessie = {
      datum: '2026-07-13',
      titel: 'Herstelrit', vermogen: '119-146W',
      tss: 18, duur_min: 30, type: 'herstel',
      segmenten: [{ label: 'Z1 herstel' }],
      intentie: { sessietype: 'z1_herstel' },
      mode: 'geschrapt_hrv',
      hrv_keuze_gemaakt: true,
      hrv_keuze: 'schrappen',
      sessie_voor_hrv_schrappen: {
        titel: 'Sweetspot-intervallen', vermogen: '210-231W',
        tss: 85, duur_min: 75, type: 'intensief',
        segmenten: [{ label: 'origineel-segment' }],
        intentie: { sessietype: 'sweetspot_intervallen' },
      },
    }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.tss).toBe(85)
    expect(s.duur_min).toBe(75)
    expect(s.type).toBe('intensief')
    expect(s.segmenten).toEqual([{ label: 'origineel-segment' }])
    expect(s.intentie).toEqual({ sessietype: 'sweetspot_intervallen' })
    // Puur-weergave-velden moeten ook terug, anders blijft de UI na "toch
    // doorzetten" de herstelrit-titel/vermogen tonen naast de echte inhoud.
    expect(s.titel).toBe('Sweetspot-intervallen')
    expect(s.vermogen).toBe('210-231W')
  })

  it('reset sessie.mode — blijft niet op "geschrapt_hrv" staan', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13', mode: 'geschrapt_hrv', hrv_keuze_gemaakt: true, hrv_keuze: 'schrappen',
      sessie_voor_hrv_schrappen: { tss: 85, duur_min: 75, type: 'intensief', segmenten: [], intentie: {} },
    }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.mode).toBeUndefined()
  })

  it('zet hrv_keuze_gemaakt/hrv_keuze/hrv_override correct na herstel', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13', mode: 'geschrapt_hrv',
      sessie_voor_hrv_schrappen: { tss: 85, duur_min: 75, type: 'intensief', segmenten: [], intentie: {} },
    }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.hrv_keuze_gemaakt).toBe(true)
    expect(s.hrv_keuze).toBe('origineel')
    expect(s.hrv_override).toBe(true)
  })

  it('verwijdert sessie_voor_hrv_schrappen na herstel (geen dubbele undo mogelijk)', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13',
      sessie_voor_hrv_schrappen: { tss: 85, duur_min: 75, type: 'intensief', segmenten: [], intentie: {} },
    }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.sessie_voor_hrv_schrappen).toBeUndefined()
  })

  it('geeft voorrang aan sessie_voor_hrv_schrappen boven een oudere sessie_voor_checkin-laag', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13',
      tss: 18, duur_min: 30, type: 'herstel', intentie: { sessietype: 'z1_herstel' },
      sessie_voor_checkin: { tss: 50, duur_min: 60, type: 'checkin-versie', intentie: { sessietype: 'z2_duur' } },
      sessie_voor_hrv_schrappen: { tss: 85, duur_min: 75, type: 'intensief', segmenten: [], intentie: { sessietype: 'sweetspot_intervallen' } },
    }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.tss).toBe(85) // uit sessie_voor_hrv_schrappen, niet uit sessie_voor_checkin (50)
    expect(s.sessie_voor_checkin).toEqual({ tss: 50, duur_min: 60, type: 'checkin-versie', intentie: { sessietype: 'z2_duur' } })
  })

  it('regressie: herstelt nog steeds via sessie_voor_checkin als er geen sessie_voor_hrv_schrappen is', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13', tss: 10, duur_min: 20,
      sessie_voor_checkin: { tss: 50, duur_min: 60, intentie: { sessietype: 'z2_duur' } },
    }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.tss).toBe(50)
    expect(s.sessie_voor_checkin).toBeUndefined()
  })

  it('regressie: zet alleen de vlaggen als er helemaal geen snapshot is', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = { datum: '2026-07-13', tss: 42, intentie: { sessietype: 'z2_duur' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.tss).toBe(42)
    expect(s.hrv_keuze).toBe('origineel')
    expect(s.hrv_override).toBe(true)
  })
})

describe('verwerkSchrappen — intervals.icu-sync (zonder dit verandert er niets op de fiets(computer))', () => {
  it('pusht de herstelrit als ZWO-workout naar intervals.icu wanneer intervalsEventId aanwezig is', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13', intervalsEventId: 'evt123',
      tss: 85, duur_min: 75, type: 'intensief', intentie: { sessietype: 'sweetspot_intervallen' },
    }
    const plan = { huidige_ftp: 280, weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    expect(getIntervalsCredentials).toHaveBeenCalledWith('u1')
    expect(sessieNaarZwo).toHaveBeenCalledWith(expect.objectContaining({ type: 'herstel', tss: 18, titel: 'Herstelrit' }), 280)
    expect(intervalsPut).toHaveBeenCalledWith('/events/evt123', {
      name: 'Herstelrit',
      moving_time: 30 * 60,
      file_contents: '<workout_file/>',
      file_type: 'zwo',
    }, { apiKey: 'k', athleteId: 'a' })
  })

  it('slaat de sync over als er geen intervalsEventId op de sessie staat', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = { datum: '2026-07-13', tss: 85, intentie: { sessietype: 'z2_duur' } } // geen intervalsEventId
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    expect(intervalsPut).not.toHaveBeenCalled()
  })

  it('laat een mislukte sync de plan-mutatie niet blokkeren (best-effort, zelfde als het bestaande sessie_voor_checkin-pad)', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsPut).mockRejectedValueOnce(new Error('intervals.icu onbereikbaar'))
    const sessie = { datum: '2026-07-13', intervalsEventId: 'evt123', tss: 85, intentie: { sessietype: 'z2_duur' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await expect(verwerkSchrappen('u1', '2026-07-13', {}, plan)).resolves.toBeUndefined()

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.tss).toBe(18) // plan-mutatie is wel degelijk doorgevoerd
  })
})

describe('verwerkOrigineel — intervals.icu-sync draait terug (B1, aanvulling)', () => {
  it('pusht de HERSTELDE (oorspronkelijke) sessie-inhoud als ZWO naar intervals.icu', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13', intervalsEventId: 'evt123',
      titel: 'Herstelrit', tss: 18, duur_min: 30, type: 'herstel', intentie: { sessietype: 'z1_herstel' },
      sessie_voor_hrv_schrappen: {
        titel: 'Sweetspot-intervallen', vermogen: '180-200W',
        tss: 85, duur_min: 75, type: 'intensief', segmenten: [], intentie: { sessietype: 'sweetspot_intervallen' },
      },
    }
    const plan = { huidige_ftp: 280, weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    expect(sessieNaarZwo).toHaveBeenCalledWith(expect.objectContaining({ tss: 85, titel: 'Sweetspot-intervallen' }), 280)
    expect(intervalsPut).toHaveBeenCalledWith('/events/evt123', {
      name: 'Sweetspot-intervallen',
      moving_time: 75 * 60,
      file_contents: '<workout_file/>',
      file_type: 'zwo',
    }, { apiKey: 'k', athleteId: 'a' })
  })

  it('slaat de sync over als er geen intervalsEventId op de sessie staat', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13',
      sessie_voor_hrv_schrappen: { tss: 85, duur_min: 75, type: 'intensief', segmenten: [], intentie: {} },
    }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    expect(intervalsPut).not.toHaveBeenCalled()
  })

  it('roept de sync niet aan voor het bestaande sessie_voor_checkin-pad wanneer het nieuwe hrv_schrappen-pad al voorrang kreeg', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = {
      datum: '2026-07-13', intervalsEventId: 'evt123',
      tss: 18, duur_min: 30, type: 'herstel', intentie: { sessietype: 'z1_herstel' },
      sessie_voor_checkin: { tss: 50, duur_min: 60, intentie: { sessietype: 'z2_duur' } },
      sessie_voor_hrv_schrappen: { tss: 85, duur_min: 75, type: 'intensief', segmenten: [], intentie: { sessietype: 'sweetspot_intervallen' } },
    }
    const plan = { huidige_ftp: 280, weekSessies: { sessies: [sessie] } }

    await verwerkOrigineel('u1', '2026-07-13', {}, plan)

    // Precies één sync-call (via het hrv_schrappen-pad), niet twee
    expect(intervalsPut).toHaveBeenCalledTimes(1)
    expect(intervalsPut).toHaveBeenCalledWith('/events/evt123', expect.objectContaining({ moving_time: 75 * 60 }), expect.anything())
  })
})

describe('verwerkSchrappen — B5: beschermd_herschikking + herschikkingspoging', () => {
  it('zet altijd beschermd_herschikking, ook als het oorspronkelijke sessietype niet zwaar is', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'z2_duur' } } // niet in ZWARE_SESSIETYPES_HERSTEL
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.beschermd_herschikking).toBe(true)
    expect(probeerHerschikking).not.toHaveBeenCalled() // niet zwaar -> geen herschikkingspoging
  })

  it('probeert een herschikking als het oorspronkelijke sessietype zwaar is (isZwareSessieVoorHerstel)', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(probeerHerschikking).mockResolvedValue({ kandidaatDatum: '2026-07-15', effectiefSessietype: 'sweetspot_intervallen' })
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'sweetspot_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    expect(probeerHerschikking).toHaveBeenCalledWith('u1', plan, '2026-07-13', 'sweetspot_intervallen')
  })

  it('slaat het plan een tweede keer op bij een succesvolle herschikking', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(probeerHerschikking).mockResolvedValue({ kandidaatDatum: '2026-07-15', effectiefSessietype: 'sweetspot_intervallen' })
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'drempel_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    expect(kv.set).toHaveBeenCalledTimes(2) // eerste (schrapping) + tweede (na geslaagde herschikking)
  })

  it('slaat het PLAN niet een tweede keer op als er geen herschikking mogelijk was (null) — schrijft in plaats daarvan het A3-signaal (week_voorzichtig)', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(probeerHerschikking).mockResolvedValue(null)
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'drempel_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    const planKeySets = kv.set.mock.calls.filter(([k]) => k === 'u1:seizoensplan')
    expect(planKeySets).toHaveLength(1) // alleen de schrapping zelf, geen tweede plan-write
    expect(kv.store.get('week_voorzichtig:u1')).toEqual({ actief: true, laatsteTriggerDatum: expect.any(String) })
  })

  it('een mislukte herschikkingspoging (exception) blokkeert de schrapping zelf niet (fail-open)', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(probeerHerschikking).mockRejectedValue(new Error('herschikking mislukt'))
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'vo2max_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await expect(verwerkSchrappen('u1', '2026-07-13', {}, plan)).resolves.toBeUndefined()

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.mode).toBe('geschrapt_hrv') // schrapping zelf is wel degelijk doorgevoerd
    // Exception (niet een null-return) -> de catch vangt 'm af vóórdat de
    // if/else-tak bereikt wordt -> geen A3-write in dit scenario.
    expect(kv.store.has('week_voorzichtig:u1')).toBe(false)
  })
})

describe('verwerkSchrappen — A3: week_voorzichtig-signaal bij een mislukte B5-herschikking', () => {
  // probeerHerschikking() retourneert null in TWEE interne scenario's
  // (herschikking.js: "geen kandidaatDatum gevonden" en "geen passend
  // archetype/budget, zelfs niet voor de z2_duur-fallback") — vanuit
  // verwerkSchrappen() gezien zijn beide ononderscheidbaar (allebei null),
  // dus beide triggeren hier hetzelfde else-pad. Dit bestand mockt
  // probeerHerschikking als geheel (niet herschikking.js se eigen interne
  // logica), dus de twee tests hieronder documenteren beide semantische
  // scenario's expliciet, ook al is de verwerking.js-kant identiek.

  it('faalpad "geen kandidaatDatum": zetWeekVoorzichtig wordt aangeroepen met vandaag als datum', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(probeerHerschikking).mockResolvedValue(null) // representeert vindHerschikkingsKandidaat() -> null
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'sweetspot_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    expect(kv.store.get('week_voorzichtig:u1')).toEqual({ actief: true, laatsteTriggerDatum: expect.any(String) })
  })

  it('faalpad "geen passend archetype/budget (ook z2_duur-fallback niet)": zetWeekVoorzichtig wordt eveneens aangeroepen', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(probeerHerschikking).mockResolvedValue(null) // representeert bouwArchetypeKeuze() -> null, ook voor z2_duur
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'drempel_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    expect(kv.store.get('week_voorzichtig:u1')).toEqual({ actief: true, laatsteTriggerDatum: expect.any(String) })
  })

  it('GEEN write bij een geslaagde herschikking (herschikt truthy)', async () => {
    const kv = maakKvMock()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(probeerHerschikking).mockResolvedValue({ kandidaatDatum: '2026-07-15', effectiefSessietype: 'sweetspot_intervallen' })
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'sweetspot_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkSchrappen('u1', '2026-07-13', {}, plan)

    expect(kv.store.has('week_voorzichtig:u1')).toBe(false)
  })
})

describe('verwerkVerlichten — B5: beschermd_herschikking + herschikkingspoging', () => {
  function maakKvMockLokaal() {
    const store = new Map()
    return {
      store,
      get: vi.fn(async (k) => store.get(k) ?? null),
      set: vi.fn(async (k, v) => { store.set(k, v) }),
    }
  }

  it('zet beschermd_herschikking en probeert een herschikking als het OORSPRONKELIJKE (niet het verlichte) sessietype zwaar is', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue({ sessietype: 'z2_duur', rol: 'aerobe_dag' })
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'drempel_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)

    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.beschermd_herschikking).toBe(true)
    expect(probeerHerschikking).toHaveBeenCalledWith('u1', plan, '2026-07-13', 'drempel_intervallen') // oorspronkelijke type, niet 'z2_duur'
  })

  it('geen herschikkingspoging als er geen nieuwe intentie bepaald kon worden', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue(null)
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'sweetspot_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)

    expect(probeerHerschikking).not.toHaveBeenCalled()
  })

  it('geen herschikkingspoging als het oorspronkelijke sessietype niet zwaar is', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue({ sessietype: 'z1_herstel', rol: 'hersteldag' })
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'z2_duur' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)

    expect(probeerHerschikking).not.toHaveBeenCalled()
  })
})

describe('verwerkVerlichten — O3: daadwerkelijke hrv_zone i.p.v. hardgecodeerde "rood"', () => {
  function maakKvMockLokaal() {
    const store = new Map()
    return {
      store,
      get: vi.fn(async (k) => store.get(k) ?? null),
      set: vi.fn(async (k, v) => { store.set(k, v) }),
    }
  }

  // bepaalNieuweIntentie zelf is hier gemockt (zie boven aan dit bestand) — deze
  // tests verifiëren dus welk hrvZone-argument verwerkVerlichten daadwerkelijk
  // doorgeeft, niet de eigen toelichtingslogica van bepaalNieuweIntentie (die
  // ongewijzigd blijft, zie de fix-instructie). Belangrijke kanttekening,
  // gerapporteerd vóór deze fix: bepaalNieuweIntentie's hrvZone-afhankelijke
  // toelichtingstekst (alternatief.js:71/90) wordt alleen gebruikt als reden=null
  // is — verwerkVerlichten geeft altijd reden="vermoeid" (nooit null) door, dus
  // de "rood"-vs-"geel"-toelichtingstekst was via dit aanroeppad al nooit
  // zichtbaar fout, ook niet vóór deze fix. De hardgecodeerde "rood" was wel
  // degelijk het verkeerde argument — vandaar de fix — maar de in de opdracht
  // beschreven concrete symptoom-tekst manifesteert zich niet via dit pad.

  it('regressie: rood-scenario roept bepaalNieuweIntentie nog steeds met "rood" aan, resultaat ongewijzigd', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue({ sessietype: 'z2_duur', rol: 'aerobe_dag' })
    const origineleIntentie = { sessietype: 'sweetspot_intervallen', rol: 'intensiteitsdag' }
    const sessie = { datum: '2026-07-13', hrv_zone: 'rood', intentie: origineleIntentie }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)

    // sessie.intentie is ná de aanroep al overschreven met de (gemockte) nieuwe
    // intentie — vandaar de apart bewaarde referentie hierboven, vóór de call.
    expect(bepaalNieuweIntentie).toHaveBeenCalledWith(
      expect.anything(), origineleIntentie, 'vermoeid', 'basis', 'rood'
    )
    const s = kv.store.get('u1:seizoensplan').weekSessies.sessies[0]
    expect(s.intentie).toEqual({ sessietype: 'z2_duur', rol: 'aerobe_dag' })
  })

  it('nieuw: geel-getriggerd scenario geeft nu "geel" door i.p.v. de vroegere hardgecodeerde "rood"', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue({ sessietype: 'z2_duur', rol: 'aerobe_dag' })
    const origineleIntentie = { sessietype: 'sweetspot_intervallen', rol: 'intensiteitsdag' }
    const sessie = { datum: '2026-07-13', hrv_zone: 'geel', intentie: origineleIntentie }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)

    expect(bepaalNieuweIntentie).toHaveBeenCalledWith(
      expect.anything(), origineleIntentie, 'vermoeid', 'basis', 'geel'
    )
  })

  it('sessie zonder hrv_zone-veld (legacy) geeft null door, geen crash', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue({ sessietype: 'z2_duur', rol: 'aerobe_dag' })
    const origineleIntentie = { sessietype: 'sweetspot_intervallen', rol: 'intensiteitsdag' }
    const sessie = { datum: '2026-07-13', intentie: origineleIntentie }
    const plan = { weekSessies: { sessies: [sessie] } }

    await expect(verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)).resolves.toBeDefined()
    expect(bepaalNieuweIntentie).toHaveBeenCalledWith(
      expect.anything(), origineleIntentie, 'vermoeid', 'basis', null
    )
  })
})

describe('verwerkVerlichten — A3: week_voorzichtig-signaal bij een mislukte B5-herschikking', () => {
  function maakKvMockLokaal() {
    const store = new Map()
    return {
      store,
      get: vi.fn(async (k) => store.get(k) ?? null),
      set: vi.fn(async (k, v) => { store.set(k, v) }),
    }
  }

  it('faalpad "geen kandidaatDatum": zetWeekVoorzichtig wordt aangeroepen', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue({ sessietype: 'z2_duur', rol: 'aerobe_dag' })
    vi.mocked(probeerHerschikking).mockResolvedValue(null)
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'drempel_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)

    expect(kv.store.get('week_voorzichtig:u1')).toEqual({ actief: true, laatsteTriggerDatum: expect.any(String) })
  })

  it('faalpad "geen passend archetype/budget": zetWeekVoorzichtig wordt eveneens aangeroepen', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue({ sessietype: 'z2_duur', rol: 'aerobe_dag' })
    vi.mocked(probeerHerschikking).mockResolvedValue(null)
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'vo2max_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)

    expect(kv.store.get('week_voorzichtig:u1')).toEqual({ actief: true, laatsteTriggerDatum: expect.any(String) })
  })

  it('GEEN write bij een geslaagde herschikking (herschikt truthy)', async () => {
    const kv = maakKvMockLokaal()
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(bepaalNieuweIntentie).mockReturnValue({ sessietype: 'z2_duur', rol: 'aerobe_dag' })
    vi.mocked(probeerHerschikking).mockResolvedValue({ kandidaatDatum: '2026-07-15', effectiefSessietype: 'sweetspot_intervallen' })
    const sessie = { datum: '2026-07-13', intentie: { sessietype: 'drempel_intervallen' } }
    const plan = { weekSessies: { sessies: [sessie] } }

    await verwerkVerlichten('u1', '2026-07-13', { fase: 'basis' }, plan)

    expect(kv.store.has('week_voorzichtig:u1')).toBe(false)
  })
})
