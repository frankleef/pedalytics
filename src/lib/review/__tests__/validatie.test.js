import { describe, it, expect } from 'vitest'
import { valideerReviewVoorstel, SCHRAPPING_WAARDE } from '../validatie.js'

// Vaste "nu"-datum voor alle tests: dinsdag 2026-07-07. Week onder review =
// maandag 2026-07-06 t/m zondag 2026-07-12.
const NU = new Date('2026-07-07T10:00:00')

function legeReviewContext() {
  return { korteTermijn: {}, middenTermijn: {}, langeTermijn: {} }
}

function maakPlan(overrides = {}) {
  return {
    startdatum: '2026-01-05',
    kader: [{ week: 1, tss_doel: 300, fase: 'basis', weektype: 'opbouw' }],
    urenPerDag: { Maandag: 1, Dinsdag: 1.5, Woensdag: 1.5, Donderdag: 1.5, Vrijdag: 1.5, Zaterdag: 3, Zondag: 2 },
    weekSessies: { sessies: [] },
    ...overrides,
  }
}

describe('valideerReviewVoorstel — signaalfamilie ACUUT (herstelsnelheid/segment-instorting)', () => {
  const plan = maakPlan({
    weekSessies: {
      sessies: [
        { datum: '2026-07-07', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'vo2max_intervallen' } }, // dinsdag, EERSTVOLGENDE zware sessie
        { datum: '2026-07-09', voltooid: false, duur_min: 60, tss: 85, intentie: { sessietype: 'sweetspot_intervallen' } }, // donderdag, latere zware sessie
      ],
    },
  })
  const reviewContext = {
    korteTermijn: { freezeStatus: { actief: false }, herstelsnelheid: { trigger: true, zwareSessieDatum: '2026-07-05' }, segmentInstorting: [] },
    middenTermijn: {},
    langeTermijn: {},
  }

  it('een acuut-getriggerd verzachtingsvoorstel voor de EERSTVOLGENDE zware sessie wordt geaccepteerd', () => {
    const voorstel = [{ datum: '2026-07-07', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht naar Z2', reden: 'Herstelsnelheid-trigger' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaat.geaccepteerd).toBe(true)
    expect(resultaat.redenVanAfwijzing).toBeNull()
  })

  it('hetzelfde acute signaal rechtvaardigt GEEN verzachting voor een latere, niet-eerstvolgende zware sessie', () => {
    const voorstel = [{ datum: '2026-07-09', huidigSessietype: 'sweetspot_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht naar Z2', reden: 'Herstelsnelheid-trigger' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    expect(resultaat.redenVanAfwijzing).toBe('geen_rechtvaardigend_signaal')
  })
})

describe('valideerReviewVoorstel — signaalfamilie CHRONISCH (mag over meerdere dagen gelden)', () => {
  const plan = maakPlan({
    weekSessies: {
      sessies: [
        { datum: '2026-07-07', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'vo2max_intervallen' } },
        { datum: '2026-07-09', voltooid: false, duur_min: 60, tss: 85, intentie: { sessietype: 'sweetspot_intervallen' } },
      ],
    },
  })
  const reviewContext = {
    korteTermijn: { freezeStatus: { actief: false }, monotonieStrain: { trigger: true } },
    middenTermijn: {},
    langeTermijn: {},
  }

  it('een chronisch-getriggerd verzachtingsvoorstel wordt geaccepteerd op MEERDERE komende dagen, niet alleen de eerstvolgende zware sessie', () => {
    const voorstel = [
      { datum: '2026-07-07', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht', reden: 'Monotonie hoog' },
      { datum: '2026-07-09', huidigSessietype: 'sweetspot_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht', reden: 'Monotonie hoog' },
    ]
    const resultaten = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaten.every(r => r.geaccepteerd)).toBe(true)
  })
})

describe('valideerReviewVoorstel — signaalfamilie BLOK-NIVEAU (mag nooit rechtvaardigen)', () => {
  it('een voorstel met uitsluitend blok-niveau-signalen als "trigger" wordt afgewezen — blok-niveau telt niet mee als acuut/chronisch', () => {
    const plan = maakPlan({
      weekSessies: { sessies: [{ datum: '2026-07-07', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'vo2max_intervallen' } }] },
    })
    // Alleen blok-niveau-signalen "actief" (fitnessprogressie dalend, blokBasisLogBlok
    // met een correctie) — geen enkel acuut/chronisch signaal.
    const reviewContext = {
      korteTermijn: { freezeStatus: { actief: false } },
      middenTermijn: {},
      langeTermijn: {
        fitnessprogressie: { ctl_trend: { status: 'ok', richting: 'dalend' } },
        blokBasisLogBlok: { richting: 'omlaag', complianceGate: { voldoendeCompliant: true } },
        cpWprimeTrend: [{ datum: '2026-07-01', criticalPower: 200 }],
      },
    }
    const voorstel = [{ datum: '2026-07-07', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht', reden: 'Fitnessprogressie dalend' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    expect(resultaat.redenVanAfwijzing).toBe('geen_rechtvaardigend_signaal')
  })
})

describe('valideerReviewVoorstel — INTENSIVERING wordt ALTIJD afgewezen (correctie: D3 op blokniveau is hier al leidend)', () => {
  it('freeze-actief + intensiveringsvoorstel wordt afgewezen, ONGEACHT overige (chronische) signalen — nu via de bredere intensivering-regel', () => {
    const plan = maakPlan({
      weekSessies: { sessies: [{ datum: '2026-07-08', voltooid: false, duur_min: 60, tss: 50, intentie: { sessietype: 'z2_duur' } }] },
    })
    const reviewContext = {
      korteTermijn: { freezeStatus: { actief: true, bevrorenWeekInFase: 3 }, monotonieStrain: { trigger: true } }, // chronisch signaal ook actief
      middenTermijn: {},
      langeTermijn: {},
    }
    const voorstel = [{ datum: '2026-07-08', huidigSessietype: 'z2_duur', nieuwSessietype: 'sweetspot_intervallen', voorgesteldeAanpassing: 'Verzwaar', reden: 'Voelt goed' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    // Vóór de correctie: 'freeze_actief' (specifiek). Ná de correctie: dezelfde
    // uitkomst (afgewezen), maar via de bredere, onvoorwaardelijke regel.
    expect(resultaat.redenVanAfwijzing).toBe('intensivering_niet_toegestaan')
  })

  it('een intensiveringsvoorstel ZONDER freeze en ZONDER overschrijding van duur/budget werd voorheen geaccepteerd — wordt nu ook afgewezen', () => {
    const plan = maakPlan({
      // Ruim binnen het duurplafond van sweetspot_intervallen (2.5u) en ruim
      // binnen het weekbudget — vóór de correctie zou dit zijn geaccepteerd.
      weekSessies: { sessies: [{ datum: '2026-07-08', voltooid: false, duur_min: 60, tss: 50, intentie: { sessietype: 'z2_duur' } }] },
    })
    const reviewContext = { korteTermijn: { freezeStatus: { actief: false } }, middenTermijn: {}, langeTermijn: {} }
    const voorstel = [{ datum: '2026-07-08', huidigSessietype: 'z2_duur', nieuwSessietype: 'sweetspot_intervallen', voorgesteldeAanpassing: 'Verzwaar', reden: 'Voelt goed' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    expect(resultaat.redenVanAfwijzing).toBe('intensivering_niet_toegestaan')
  })
})

describe('valideerReviewVoorstel — schrapping (naar rust) wordt NOOIT toegestaan', () => {
  it('een schrappingsvoorstel wordt afgewezen, zelfs met sterke (acute + chronische) triggers', () => {
    const plan = maakPlan({
      weekSessies: { sessies: [{ datum: '2026-07-07', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'vo2max_intervallen' } }] },
    })
    const reviewContext = {
      korteTermijn: {
        freezeStatus: { actief: false },
        herstelsnelheid: { trigger: true, zwareSessieDatum: '2026-07-05' },
        monotonieStrain: { trigger: true },
        weekVoorzichtig: true,
      },
      middenTermijn: {},
      langeTermijn: {},
    }
    const voorstel = [{ datum: '2026-07-07', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: SCHRAPPING_WAARDE, voorgesteldeAanpassing: 'Volledig rust', reden: 'Meerdere sterke signalen' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    expect(resultaat.redenVanAfwijzing).toBe('schrapping_niet_toegestaan')
  })
})

describe('valideerReviewVoorstel — overige mechanische grenzen (getoetst op VERZACHTING, intensivering is nu al altijd afgewezen)', () => {
  it('SESSIETYPE_MAX_EFFECTIEVE_UREN-overschrijding: bestaande duur past niet binnen het plafond van het (verzachtende) nieuwe sessietype', () => {
    const plan = maakPlan({
      // z6_anaeroob plafond = 0.75u (45 min); bestaande duur is 90 min.
      weekSessies: { sessies: [{ datum: '2026-07-08', voltooid: false, duur_min: 90, tss: 100, intentie: { sessietype: 'z2_duur' } }] },
    })
    // Chronisch signaal actief, rechtvaardigt de verzachting zelf.
    const reviewContext = { korteTermijn: { monotonieStrain: { trigger: true } }, middenTermijn: {}, langeTermijn: {} }
    // z6_anaeroob heeft een lager IF-midden (0.55) dan z2_duur (0.72) -> classificeert als verzachting.
    const voorstel = [{ datum: '2026-07-08', huidigSessietype: 'z2_duur', nieuwSessietype: 'z6_anaeroob', voorgesteldeAanpassing: 'Verlicht', reden: 'test' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    expect(resultaat.redenVanAfwijzing).toBe('duur_overschrijdt_plafond')
  })

  it('MIN_TSS_VOOR_NIEUWE_DAG-onderschrijding: een nieuwe (verzachtende) trainingsdag met te weinig beschikbare uren wordt afgewezen', () => {
    const plan = maakPlan({
      urenPerDag: { Vrijdag: 0.3 }, // te weinig voor 40 TSS
      weekSessies: { sessies: [] }, // GEEN bestaande sessie op 2026-07-10 -> "nieuwe dag"
    })
    const reviewContext = { korteTermijn: { monotonieStrain: { trigger: true } }, middenTermijn: {}, langeTermijn: {} }
    // sweetspot_intervallen -> z2_duur is een verzachting (lager IF-midden).
    const voorstel = [{ datum: '2026-07-10', huidigSessietype: 'sweetspot_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Nieuwe lichte dag', reden: 'test' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, reviewContext, plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    expect(resultaat.redenVanAfwijzing).toBe('nieuwe_dag_te_weinig_tss')
  })
})

describe('valideerReviewVoorstel — volledig leeg/ongetriggerd reviewContext', () => {
  it('zonder enige actieve trigger wordt elk verzachtingsvoorstel afgewezen (geen enkele rechtvaardiging aanwezig)', () => {
    const plan = maakPlan({
      weekSessies: {
        sessies: [
          { datum: '2026-07-07', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'vo2max_intervallen' } },
          { datum: '2026-07-09', voltooid: false, duur_min: 60, tss: 85, intentie: { sessietype: 'sweetspot_intervallen' } },
        ],
      },
    })
    const voorstel = [
      { datum: '2026-07-07', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht', reden: 'test' },
      { datum: '2026-07-09', huidigSessietype: 'sweetspot_intervallen', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'Verlicht', reden: 'test' },
    ]
    const resultaten = valideerReviewVoorstel(voorstel, legeReviewContext(), plan, NU)
    expect(resultaten.every(r => r.geaccepteerd === false)).toBe(true)
    expect(resultaten.every(r => r.redenVanAfwijzing === 'geen_rechtvaardigend_signaal')).toBe(true)
  })
})

describe('valideerReviewVoorstel — overige gedragingen', () => {
  it('"gelijk" (nieuwSessietype === huidigSessietype) wordt altijd geaccepteerd, ook zonder enig signaal', () => {
    const plan = maakPlan({ weekSessies: { sessies: [{ datum: '2026-07-07', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'vo2max_intervallen' } }] } })
    const voorstel = [{ datum: '2026-07-07', huidigSessietype: 'vo2max_intervallen', nieuwSessietype: 'vo2max_intervallen', voorgesteldeAanpassing: 'geen', reden: 'Alles in orde' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, legeReviewContext(), plan, NU)
    expect(resultaat.geaccepteerd).toBe(true)
  })

  it('een datum buiten de lopende week wordt afgewezen (weekgrens)', () => {
    const plan = maakPlan()
    const voorstel = [{ datum: '2026-07-20', huidigSessietype: 'z2_duur', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'geen', reden: 'test' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, legeReviewContext(), plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    expect(resultaat.redenVanAfwijzing).toBe('buiten_weekgrens')
  })

  it('een onbekend sessietype wordt fail-closed afgewezen, geen crash', () => {
    const plan = maakPlan({ weekSessies: { sessies: [{ datum: '2026-07-07', voltooid: false, duur_min: 60, tss: 90, intentie: { sessietype: 'iets_verzonnens' } }] } })
    const voorstel = [{ datum: '2026-07-07', huidigSessietype: 'iets_verzonnens', nieuwSessietype: 'z2_duur', voorgesteldeAanpassing: 'test', reden: 'test' }]
    const [resultaat] = valideerReviewVoorstel(voorstel, legeReviewContext(), plan, NU)
    expect(resultaat.geaccepteerd).toBe(false)
    expect(resultaat.redenVanAfwijzing).toBe('onbekend_sessietype')
  })

  it('crasht niet op een leeg/ontbrekend voorstel, reviewContext of plan', () => {
    expect(() => valideerReviewVoorstel([], legeReviewContext(), maakPlan(), NU)).not.toThrow()
    expect(() => valideerReviewVoorstel(null, null, null, NU)).not.toThrow()
    expect(valideerReviewVoorstel(null, null, null, NU)).toEqual([])
  })
})
