import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../kv.js', () => {
  const store = new Map()
  return {
    getKV: () => ({
      get: async (k) => store.get(k) ?? null,
      set: async (k, v) => { store.set(k, v) },
      _store: store,
    }),
  }
})

vi.mock('../pushNotify.js', () => ({
  sendPush: vi.fn(async () => true),
}))

import { maakMelding, haalMeldingen, markeerGelezen } from '../meldingen.js'
import { sendPush } from '../pushNotify.js'
import { getKV } from '../kv.js'

describe('meldingen.js', () => {
  beforeEach(() => { getKV()._store.clear(); vi.clearAllMocks() })

  it('maakt een niet-pushwaardige melding aan zonder sendPush aan te roepen', async () => {
    const melding = await maakMelding('u1', 'checkin_modulatie', { score: 62, richting: 'verlicht', dagLabel: 'Vandaag', datum: '2026-07-09' })
    expect(melding.categorie).toBe('sessie')
    expect(melding.titel).toBe('Sessie iets verlicht')
    expect(melding.gepusht).toBe(false)
    expect(sendPush).not.toHaveBeenCalled()

    const lijst = await haalMeldingen('u1')
    expect(lijst).toHaveLength(1)
    expect(lijst[0].id).toBe(melding.id)
  })

  it('pusht wel voor hrv_overbelastingsgate en zet gepusht=true', async () => {
    const melding = await maakMelding('u1', 'hrv_overbelastingsgate')
    expect(melding.gepusht).toBe(true)
    expect(sendPush).toHaveBeenCalledWith('u1', expect.objectContaining({ title: 'Weekbelasting bijgesteld', url: '/schema' }))
  })

  it('pusht niet voor volumecorrectie (bewuste gedragswijziging t.o.v. de oude hardcoded push)', async () => {
    const melding = await maakMelding('u1', 'volumecorrectie', { tekst: 'Test' })
    expect(melding.gepusht).toBe(false)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('haalMeldingen filtert op categorie en ongelezenAlleen', async () => {
    await maakMelding('u2', 'checkin_modulatie', { score: 60, richting: 'verlicht', dagLabel: 'Vandaag', datum: '2026-07-09' })
    await maakMelding('u2', 'ftp_gedetecteerd', { oudeFtp: 260, nieuweFtp: 270 })
    const alleenMetingen = await haalMeldingen('u2', { categorie: 'metingen' })
    expect(alleenMetingen).toHaveLength(1)
    expect(alleenMetingen[0].type).toBe('ftp_gedetecteerd')

    await markeerGelezen('u2', alleenMetingen[0].id)
    const ongelezen = await haalMeldingen('u2', { ongelezenAlleen: true })
    expect(ongelezen).toHaveLength(1)
    expect(ongelezen[0].type).toBe('checkin_modulatie')
  })

  it('markeerGelezen(id) markeert precies één melding, "alle" markeert alles', async () => {
    const m1 = await maakMelding('u3', 'checkin_modulatie', { score: 60, richting: 'verlicht', dagLabel: 'Vandaag', datum: '2026-07-09' })
    await maakMelding('u3', 'checkin_modulatie', { score: 60, richting: 'verlicht', dagLabel: 'Vandaag', datum: '2026-07-09' })
    await markeerGelezen('u3', m1.id)
    let lijst = await haalMeldingen('u3')
    expect(lijst.find(m => m.id === m1.id).gelezen).toBe(true)
    expect(lijst.filter(m => !m.gelezen)).toHaveLength(1)

    await markeerGelezen('u3', 'alle')
    lijst = await haalMeldingen('u3')
    expect(lijst.every(m => m.gelezen)).toBe(true)
  })

  it('nieuwste eerst, gecapt op 200 items', async () => {
    for (let i = 0; i < 205; i++) {
      await maakMelding('u4', 'checkin_modulatie', { score: i, richting: 'verlicht', dagLabel: 'Vandaag', datum: '2026-07-09' })
    }
    const lijst = await haalMeldingen('u4')
    expect(lijst).toHaveLength(200)
    expect(lijst[0].tekst).toContain('204')
  })

  it('gooit een fout bij een onbekend meldingtype', async () => {
    await expect(maakMelding('u5', 'onbestaand_type')).rejects.toThrow(/Onbekend meldingtype/)
  })
})
