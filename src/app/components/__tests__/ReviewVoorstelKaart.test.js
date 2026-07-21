import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { haalReviewVoorstellenOp, reageerOpVoorstel } from '../reviewVoorstelActies.js'

// Dit project heeft geen jsdom/@testing-library/react (vitest.config.js draait
// environment: 'node'; geen enkel bestaand componenttest-bestand rendert JSX —
// zie archetypeAdmin.test.js). ReviewVoorstelKaart.js zelf bevat JSX en kan
// niet rechtstreeks geïmporteerd worden door Vite's esbuild-transform in deze
// omgeving ("Failed to parse source... .jsx/.tsx") — vandaar dat de fetch-/
// actielogica in een apart, JSX-vrij bestand staat (reviewVoorstelActies.js,
// zelfde opzet als archetypeAdmin.js naast ArchetypeBuilder.js) en hier direct
// getest wordt met een gemockte global.fetch, zonder rendering.

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResp(body) {
  return { json: async () => body }
}

describe('haalReviewVoorstellenOp', () => {
  it('geeft de voorstellen uit een geldige respons terug', async () => {
    const voorstellen = [
      { datum: '2026-07-20', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht naar Z2' },
    ]
    global.fetch.mockResolvedValue(jsonResp({ success: true, data: voorstellen }))

    const resultaat = await haalReviewVoorstellenOp()

    expect(global.fetch).toHaveBeenCalledWith('/api/plan/review-voorstel')
    expect(resultaat).toEqual(voorstellen)
  })

  it('geeft een lege array terug bij een lege/verlopen key (geen crash)', async () => {
    global.fetch.mockResolvedValue(jsonResp({ success: true, data: [] }))
    expect(await haalReviewVoorstellenOp()).toEqual([])
  })

  it('geeft een lege array terug bij success: false', async () => {
    global.fetch.mockResolvedValue(jsonResp({ success: false, error: 'Niet ingelogd' }))
    expect(await haalReviewVoorstellenOp()).toEqual([])
  })
})

describe('reageerOpVoorstel', () => {
  const item = { datum: '2026-07-20', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: 'z2_duur' }

  it('"toepassen" roept de route aan met datum, actie en nieuwSessietype', async () => {
    global.fetch.mockResolvedValue(jsonResp({ success: true }))

    await reageerOpVoorstel(item, 'toepassen')

    expect(global.fetch).toHaveBeenCalledWith('/api/plan/review-voorstel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: '2026-07-20', actie: 'toepassen', nieuwSessietype: 'z2_duur' }),
    })
  })

  it('"negeren" roept dezelfde route aan met actie: negeren', async () => {
    global.fetch.mockResolvedValue(jsonResp({ success: true }))

    await reageerOpVoorstel(item, 'negeren')

    const [, opties] = global.fetch.mock.calls[0]
    expect(JSON.parse(opties.body)).toEqual({ datum: '2026-07-20', actie: 'negeren', nieuwSessietype: 'z2_duur' })
  })

  it('geeft de geparsede respons terug (zodat de caller op success kan reageren)', async () => {
    global.fetch.mockResolvedValue(jsonResp({ success: false, error: 'Voorstel niet gevonden' }))
    const resultaat = await reageerOpVoorstel(item, 'toepassen')
    expect(resultaat).toEqual({ success: false, error: 'Voorstel niet gevonden' })
  })
})
