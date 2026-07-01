import { describe, it, expect, vi, beforeEach } from 'vitest'
import { valideerDagIntentie, bepaalDagIntentieMetRetry } from '../sessie/dagIntentie.js'

vi.mock('../claude.js', () => ({
  claudeCall: vi.fn(),
}))

import { claudeCall } from '../claude.js'

const basisCtx = {
  fase: 'basis',
  weekInFase: 2,
  aantalWekenInFase: 3,
  weektype: 'opbouw',
  kaderWeek: { fase: 'basis', weektype: 'opbouw' },
  weekTssDoel: 310,
  geplandeDagen: [
    { dag: 'Woensdag', sessietype: 'kracht_lage_cadans', tss: 65 },
    { dag: 'Zaterdag', sessietype: 'z2_duur', tss: 100 },
  ],
  datum: '2026-07-07',
  dagNaam: 'Dinsdag',
  beschikbareUren: 1.5,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('valideerDagIntentie', () => {
  it('accepteert een geldig object', () => {
    expect(valideerDagIntentie({ sessietype: 'z2_duur', tss_doel: 75, heeft_sprint_staartjes: false })).toBe(true)
  })

  it('gooit bij ongeldig sessietype', () => {
    expect(() => valideerDagIntentie({ sessietype: 'z2_vlak', tss_doel: 75, heeft_sprint_staartjes: false }))
      .toThrow(/Ongeldig sessietype/)
  })

  it('gooit bij ontbrekend/ongeldig tss_doel', () => {
    expect(() => valideerDagIntentie({ sessietype: 'z2_duur', tss_doel: 0, heeft_sprint_staartjes: false })).toThrow(/tss_doel/)
    expect(() => valideerDagIntentie({ sessietype: 'z2_duur', tss_doel: 350, heeft_sprint_staartjes: false })).toThrow(/tss_doel/)
    expect(() => valideerDagIntentie({ sessietype: 'z2_duur', heeft_sprint_staartjes: false })).toThrow(/tss_doel/)
  })

  it('gooit bij ontbrekende/foute heeft_sprint_staartjes', () => {
    expect(() => valideerDagIntentie({ sessietype: 'z2_duur', tss_doel: 75 })).toThrow(/heeft_sprint_staartjes/)
    expect(() => valideerDagIntentie({ sessietype: 'z2_duur', tss_doel: 75, heeft_sprint_staartjes: 'ja' })).toThrow(/heeft_sprint_staartjes/)
  })

  it('accepteert test- en herstelsessietypes', () => {
    expect(valideerDagIntentie({ sessietype: 'ramp_test', tss_doel: 50, heeft_sprint_staartjes: false })).toBe(true)
    expect(valideerDagIntentie({ sessietype: 'z1_herstel', tss_doel: 30, heeft_sprint_staartjes: false })).toBe(true)
  })
})

describe('bepaalDagIntentieMetRetry', () => {
  it('retourneert de intentie bij een geldige eerste respons', async () => {
    claudeCall.mockResolvedValueOnce({ sessietype: 'z2_duur', tss_doel: 75, heeft_sprint_staartjes: false })
    const intentie = await bepaalDagIntentieMetRetry(basisCtx)
    expect(intentie.sessietype).toBe('z2_duur')
    expect(claudeCall).toHaveBeenCalledTimes(1)
  })

  it('gebruikt max_tokens: 100 en stuurt geen blokken/wattages-verzoek', async () => {
    claudeCall.mockResolvedValueOnce({ sessietype: 'z2_duur', tss_doel: 75, heeft_sprint_staartjes: false })
    await bepaalDagIntentieMetRetry(basisCtx)
    const call = claudeCall.mock.calls[0][0]
    expect(call.max_tokens).toBe(100)
    expect(call.prompt).not.toMatch(/blokDuurSeconden|vermogenMin/)
  })

  it('retry: eerste poging mislukt (ongeldig), tweede slaagt', async () => {
    claudeCall
      .mockResolvedValueOnce({ sessietype: 'z2_vlak', tss_doel: 75, heeft_sprint_staartjes: false }) // ongeldig, migratie niet toegepast op dit niveau
      .mockResolvedValueOnce({ sessietype: 'z2_duur', tss_doel: 75, heeft_sprint_staartjes: false })
    const intentie = await bepaalDagIntentieMetRetry(basisCtx)
    expect(intentie.sessietype).toBe('z2_duur')
    expect(claudeCall).toHaveBeenCalledTimes(2)
  })

  it('gooit na twee mislukte pogingen (geen crash-loop, begrensd)', async () => {
    claudeCall.mockRejectedValue(new Error('Claude API 500: kapot'))
    await expect(bepaalDagIntentieMetRetry(basisCtx)).rejects.toThrow(/mislukt na 2 pogingen/)
    expect(claudeCall).toHaveBeenCalledTimes(2)
  })

  it('tss_doel blijft binnen het resterende weekdoel (prompt-instructie bevat de restwaarde)', async () => {
    claudeCall.mockResolvedValueOnce({ sessietype: 'z2_duur', tss_doel: 40, heeft_sprint_staartjes: false })
    await bepaalDagIntentieMetRetry(basisCtx)
    const prompt = claudeCall.mock.calls[0][0].prompt
    // resterend = 310 - 65 - 100 = 145
    expect(prompt).toContain('Nog beschikbaar: 145 TSS')
    expect(prompt).toContain('tss_doel moet ≤ 145 zijn')
  })

  it('herstelweek-instructie zit in de prompt', async () => {
    claudeCall.mockResolvedValueOnce({ sessietype: 'z2_duur', tss_doel: 30, heeft_sprint_staartjes: false })
    await bepaalDagIntentieMetRetry({ ...basisCtx, weektype: 'herstel', kaderWeek: { fase: 'basis', weektype: 'herstel' } })
    const prompt = claudeCall.mock.calls[0][0].prompt
    expect(prompt).toContain('Weektype: herstel')
    expect(prompt).toMatch(/Herstelweek.*nooit intensiteitssessies/)
  })
})
