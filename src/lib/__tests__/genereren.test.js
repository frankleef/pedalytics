import { describe, it, expect, vi, beforeEach } from 'vitest'
import { genereerSessieDag } from '../sessie/genereren.js'

vi.mock('../claude.js', () => ({
  claudeCall: vi.fn(async () => ({
    sessie: {
      type: 'duur_variabel',
      titel: 'Claude-gegenereerd',
      tss: 60,
      duur_min: 90,
      segmenten: [{ zone: 'Z2', positie: 'midden', blokDuurSeconden: 5400, isSpecifiek: false, sessietype: 'z2_duur' }],
      intentie: { sessietype: 'z2_duur', rol: 'aerobe_dag', toegestane_zones: ['Z2'] },
    },
  })),
}))

vi.mock('../promptBuilder.js', () => ({
  bouwSessieDagPrompt: vi.fn(() => ({ prompt: 'basisprompt', system: 'systeem' })),
}))

import { claudeCall } from '../claude.js'
import { bouwSessieDagPrompt } from '../promptBuilder.js'

function maakKv(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: async (k) => store.get(k) ?? null,
    set: async (k, v) => { store.set(k, v) },
  }
}

const basisCtx = {
  userId: 'test_user',
  datum: '2026-07-10',
  dagNaam: 'Vrijdag',
  uren: 1.5,
  profiel: { ftp: 265, power_zones: null },
  wellness: { ctl: 50, atl: 45, hrv: 60 },
  plan: { seizoensdoel: { type: 'ftp' } },
  huidigeFase: 'basis',
  weekInFase: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('genereerSessieDag — deterministisch pad', () => {
  it('genereert deterministisch zonder Claude aan te roepen als archetype+variant beschikbaar zijn', async () => {
    // Forceer z2_progressief door alle andere z2_duur-archetypes als 'recent' te seeden
    const kv = maakKv({
      'sessie_archetypes:test_user:z2_duur': [
        'z2_negatief_split', 'z2_variabel_blokken', 'z2_golf', 'z2_tempo_blokken', 'z2_cadans', 'z2_heuvel', 'z2_tempo_teugjes',
      ],
    })
    const sessie = await genereerSessieDag({
      ...basisCtx,
      kv,
      effectiefSessietype: 'z2_duur',
      oudeSessie: { intentie: { sessietype: 'z2_duur' } },
    })

    expect(sessie.gegenereerd_door).toBe('deterministisch')
    expect(sessie.archetype_id).toBe('z2_progressief')
    expect(sessie.variant_id).toBeTruthy()
    expect(sessie.intentie.sessietype).toBe('z2_duur')
    expect(sessie.datum).toBe('2026-07-10')
    expect(claudeCall).not.toHaveBeenCalled()

    const opgeslagen = await kv.get('sessie_archetypes:test_user:z2_duur')
    expect(opgeslagen[0]).toBe('z2_progressief')
  })

  it('valt terug op Claude als het gekozen archetype geen variantendata heeft', async () => {
    // Forceer z2_heuvel (geen variantendata) door alle andere te seeden als recent
    const kv = maakKv({
      'sessie_archetypes:test_user:z2_duur': [
        'z2_progressief', 'z2_negatief_split', 'z2_variabel_blokken', 'z2_golf', 'z2_tempo_blokken', 'z2_cadans', 'z2_tempo_teugjes',
      ],
    })
    const sessie = await genereerSessieDag({
      ...basisCtx,
      kv,
      effectiefSessietype: 'z2_duur',
      oudeSessie: { intentie: { sessietype: 'z2_duur' } },
    })

    expect(claudeCall).toHaveBeenCalledTimes(1)
    expect(sessie.titel).toBe('Claude-gegenereerd')
    // Archetype-hint moet in de prompt zitten
    const promptGebruikt = claudeCall.mock.calls[0][0].prompt
    expect(promptGebruikt).toContain('SESSIEVARIATIE')
    expect(promptGebruikt).toContain('z2_heuvel')
  })

  it('gebruikt Claude direct als er geen sessietype vooraf bekend is (nieuwe dag)', async () => {
    const kv = maakKv()
    const sessie = await genereerSessieDag({
      ...basisCtx,
      kv,
      effectiefSessietype: null,
      oudeSessie: null,
    })
    expect(claudeCall).toHaveBeenCalledTimes(1)
    expect(bouwSessieDagPrompt).toHaveBeenCalledTimes(1)
    expect(sessie.titel).toBe('Claude-gegenereerd')
  })

  it('past capSessieDuur toe wanneer duur_min het beschikbaarheidsmaximum overschrijdt', async () => {
    claudeCall.mockResolvedValueOnce({
      sessie: {
        type: 'sweetspot', titel: 'Te lang', tss: 90, duur_min: 150,
        segmenten: [{ zone: 'Z3', positie: 'midden', blokDuurSeconden: 9000, isSpecifiek: false, sessietype: 'sweetspot_intervallen' }],
        intentie: { sessietype: 'sweetspot_intervallen' },
      },
    })
    const kv = maakKv()
    const sessie = await genereerSessieDag({ ...basisCtx, kv, uren: 1.5, effectiefSessietype: null })
    expect(sessie.duur_min).toBe(90) // 1.5 uur = 90 min max
  })
})
