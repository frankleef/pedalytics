import { describe, it, expect } from 'vitest'
import { bouwReviewPrompt, bouwSysteeminstructie, bouwUserBericht } from '../prompt.js'
import { DECOUPLING_BLOKTREND_DREMPEL } from '../../decoupling.js'
import { DECOUPLING_BOOST_DREMPEL, ROLLEND_VENSTER_SECONDEN, MINIMALE_GESLAAGDE_PERIODE_SECONDEN } from '../../instorting.js'
import { BLOK_TREND_DREMPEL_PCT, MIN_TSS_VOOR_NIEUWE_DAG } from '../../volumeCorrectie.js'
import { SESSIETYPE_MAX_EFFECTIEVE_UREN, TSB_DEGRADATIE_DREMPEL } from '../../sessie/weekSolver.js'
import { BUDGET_OVERSCHRIJDING_DREMPEL } from '../../sessie/conflictResolutie.js'
import { GELDIGE_SESSIETYPES } from '../../sessie-archetypes.js'
import { SCHRAPPING_WAARDE } from '../validatie.js'

describe('bouwSysteeminstructie — alle 13 deterministische grenzen', () => {
  const tekst = bouwSysteeminstructie()

  it('1. monotonie-drempel (2.0, bare literal)', () => {
    expect(tekst).toContain('> 2 ') // "monotonie ... > 2 geldt als"
  })

  it('2. decoupling-bloktrend-drempel (DECOUPLING_BLOKTREND_DREMPEL, live geïmporteerd)', () => {
    expect(DECOUPLING_BLOKTREND_DREMPEL).toBe(7)
    expect(tekst).toContain(`> ${DECOUPLING_BLOKTREND_DREMPEL}`)
    expect(tekst).toContain('DECOUPLING_BLOKTREND_DREMPEL')
  })

  it('3. decoupling per-rit-instortingsdrempel (DECOUPLING_BOOST_DREMPEL, apart van #2)', () => {
    expect(tekst).toContain(`> ${DECOUPLING_BOOST_DREMPEL}`)
    expect(tekst).toContain('DECOUPLING_BOOST_DREMPEL')
    expect(tekst).toMatch(/APART concept van punt 2/)
  })

  it('4. E1-instortingscriteria (ROLLEND_VENSTER_SECONDEN, MINIMALE_GESLAAGDE_PERIODE_SECONDEN)', () => {
    expect(tekst).toContain(`${ROLLEND_VENSTER_SECONDEN} seconden`)
    expect(tekst).toContain(`${MINIMALE_GESLAAGDE_PERIODE_SECONDEN} seconden`)
  })

  it('5. 48u-afstandsregel', () => {
    expect(tekst).toContain('48 uur')
    expect(tekst).toContain('isBinnen48uVanAndereZwareSessie')
  })

  it('6. weekgrens-filter (kandidaat-filter, geen clamp)', () => {
    expect(tekst).toMatch(/nooit.*over de grens van de huidige ISO-week/i)
    expect(tekst).toContain('vindHerschikkingsKandidaat')
  })

  it('7. TSS-budget-clamp ±20%, expliciet per BLOK, niet per sessie', () => {
    expect(tekst).toContain('80%')
    expect(tekst).toContain('120%')
    expect(tekst).toMatch(/BLOK.*niet van een individuele sessie/)
    expect(tekst).toContain('bepaalNieuweBlokBasis')
  })

  it('8. compliance-freeze-mechanisme (bevriezing, geen harde grens)', () => {
    expect(tekst).toMatch(/geen harde absolute TSS\/duur-grens/)
    expect(tekst).toContain('progressieFactor')
  })

  it('9. BUDGET_OVERSCHRIJDING_DREMPEL (1.15 -> 15%)', () => {
    expect(BUDGET_OVERSCHRIJDING_DREMPEL).toBe(1.15)
    expect(tekst).toContain('15%')
    expect(tekst).toContain('BUDGET_OVERSCHRIJDING_DREMPEL')
  })

  it('10. SESSIETYPE_MAX_EFFECTIEVE_UREN — alle sessietypes met hun plafond', () => {
    for (const [sessietype, maxUren] of Object.entries(SESSIETYPE_MAX_EFFECTIEVE_UREN)) {
      expect(tekst).toContain(`${sessietype}: max. ${maxUren}u`)
    }
  })

  it('11. MIN_TSS_VOOR_NIEUWE_DAG (40)', () => {
    expect(MIN_TSS_VOOR_NIEUWE_DAG).toBe(40)
    expect(tekst).toContain(`${MIN_TSS_VOOR_NIEUWE_DAG} TSS`)
  })

  it('12. BLOK_TREND_DREMPEL_PCT (1.7)', () => {
    expect(BLOK_TREND_DREMPEL_PCT).toBe(1.7)
    expect(tekst).toContain(`${BLOK_TREND_DREMPEL_PCT}%`)
  })

  it('13. TSB_DEGRADATIE_DREMPEL (-20, na A3 geïmporteerd)', () => {
    expect(TSB_DEGRADATIE_DREMPEL).toBe(-20)
    expect(tekst).toContain(`TSB < ${TSB_DEGRADATIE_DREMPEL}`)
  })

  it('vermeldt expliciet dat dit een VOORSTEL is, geen automatische toepassing', () => {
    expect(tekst).toMatch(/NOOIT automatisch doorgevoerd/)
    expect(tekst).toMatch(/fase 3/)
  })

  it('instrueert dat een chronisch signaal op zichzelf al voldoende is om een verzachting voor te stellen (geen wachten op aanvullende bevestiging)', () => {
    expect(tekst).toMatch(/chronisch signaal.*voldoende basis/is)
    expect(tekst).toMatch(/wacht niet op aanvullende bevestiging/i)
  })

  it('vereist een puur-JSON-antwoord met het afgesproken schema', () => {
    expect(tekst).toMatch(/UITSLUITEND met geldig JSON/)
    expect(tekst).toContain('"datum"')
    expect(tekst).toContain('"huidigSessietype"')
    expect(tekst).toContain('"nieuwSessietype"')
    expect(tekst).toContain('"voorgesteldeAanpassing"')
    expect(tekst).toContain('"reden"')
  })

  it('nieuwSessietype-schema noemt alle GELDIGE_SESSIETYPES en de schrapping-sentinel expliciet, machineleesbaar', () => {
    for (const sessietype of GELDIGE_SESSIETYPES) {
      expect(tekst).toContain(sessietype)
    }
    expect(tekst).toContain(SCHRAPPING_WAARDE)
    expect(tekst).toMatch(/mechanisch getoetst/)
  })
})

describe('bouwUserBericht — EF-trend monitoringOnly blijft zichtbaar', () => {
  it('serialiseert reviewContext met de monitoringOnly-vlag intact, gegroepeerd per tijdschaal', () => {
    const reviewContext = {
      korteTermijn: { freezeStatus: { actief: false } },
      middenTermijn: {
        efTrend: { z2: [{ datum: '2026-07-10', ef: 1.5 }], sweetspot: [], drempel: [], vo2max: [], monitoringOnly: true },
      },
      langeTermijn: { fitnessprogressie: null },
    }
    const bericht = bouwUserBericht(reviewContext, { weekSessies: { sessies: [] } })
    const geparsed = JSON.parse(bericht)

    expect(geparsed.reviewContext.middenTermijn.efTrend.monitoringOnly).toBe(true)
    expect(geparsed.reviewContext.korteTermijn).toEqual({ freezeStatus: { actief: false } })
    expect(geparsed.reviewContext.langeTermijn).toEqual({ fitnessprogressie: null })
  })

  it('neemt alleen niet-voltooide sessies op in plan.resterendeSessies', () => {
    const plan = {
      startdatum: '2026-01-05',
      kader: [],
      weekSessies: {
        sessies: [
          { datum: '2026-07-18', voltooid: true, intentie: { sessietype: 'drempel_intervallen' } },
          { datum: '2026-07-20', voltooid: false, intentie: { sessietype: 'z2_duur' } },
        ],
      },
    }
    const bericht = bouwUserBericht({ korteTermijn: {}, middenTermijn: {}, langeTermijn: {} }, plan)
    const geparsed = JSON.parse(bericht)

    expect(geparsed.plan.resterendeSessies).toHaveLength(1)
    expect(geparsed.plan.resterendeSessies[0].datum).toBe('2026-07-20')
  })
})

describe('bouwReviewPrompt — samenstelling, geen crash bij minimale/lege input', () => {
  it('levert {systeeminstructie, userBericht} op, geen API-call', () => {
    const resultaat = bouwReviewPrompt(
      { korteTermijn: {}, middenTermijn: {}, langeTermijn: {} },
      { startdatum: '2026-01-05', kader: [], weekSessies: { sessies: [] } }
    )
    expect(typeof resultaat.systeeminstructie).toBe('string')
    expect(typeof resultaat.userBericht).toBe('string')
    expect(resultaat.systeeminstructie.length).toBeGreaterThan(100)
  })

  it('crasht niet bij reviewContext = null/undefined en plan = null/undefined', () => {
    expect(() => bouwReviewPrompt(null, null)).not.toThrow()
    expect(() => bouwReviewPrompt(undefined, undefined)).not.toThrow()

    const resultaat = bouwReviewPrompt(null, null)
    const geparsed = JSON.parse(resultaat.userBericht)
    expect(geparsed.reviewContext).toEqual({ korteTermijn: {}, middenTermijn: {}, langeTermijn: {} })
    expect(geparsed.plan.resterendeSessies).toEqual([])
  })

  it('crasht niet bij een volledig lege reviewContext ({})', () => {
    expect(() => bouwReviewPrompt({}, {})).not.toThrow()
  })
})
