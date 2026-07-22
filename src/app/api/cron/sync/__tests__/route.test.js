import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Gerichte integratietest van het daadwerkelijke aanroeppunt in
// cron/sync/route.js:381-391 (bepaalComplianceRecord binnen de
// bijwerkPlanVeilig-callback). Alleen de externe-IO-randen worden gemockt
// (KV, crypto, intervals.icu-HTTP, qstash, push/posthog/cronlog/meldingen) —
// bijwerkPlanVeilig, uitvoeringsscore.js en sessie/compliance.js draaien echt,
// zodat dit de daadwerkelijke code path test, niet een herimplementatie ervan.
vi.mock('@/lib/kv', () => ({ getKV: vi.fn() }))
vi.mock('@/lib/crypto', () => ({ decrypt: vi.fn((v) => v), encrypt: vi.fn((v) => v) }))
vi.mock('@/lib/qstash', () => ({ verifyQStash: vi.fn(async () => false) }))
vi.mock('@/lib/intervals', () => ({
  intervalsGet: vi.fn(),
  intervalsDelete: vi.fn(async () => ({})),
}))
vi.mock('@/lib/pushNotify', () => ({ sendPush: vi.fn(async () => {}) }))
vi.mock('@/lib/posthog', () => ({ logEvent: vi.fn() }))
vi.mock('@/lib/cronLog', () => ({ logCronRun: vi.fn(async () => {}) }))
vi.mock('@/lib/meldingen', () => ({ maakMelding: vi.fn(async () => {}) }))

import { getKV } from '@/lib/kv'
import { intervalsGet } from '@/lib/intervals'
import { maakMelding } from '@/lib/meldingen'
import { POST } from '../route.js'

process.env.ADMIN_SECRET = 'test-secret'

function maakKvMock(seed = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    set: vi.fn(async (k, v) => { store.set(k, v) }),
    mget: vi.fn(async (...keys) => keys.map(k => store.get(k) ?? null)),
    del: vi.fn(async (k) => { store.delete(k) }),
  }
}

function req() {
  return { headers: { get: (h) => h === 'authorization' ? 'Bearer test-secret' : null } }
}

const RITDATUM = '2026-07-14'

function basisPlan(sessie) {
  return {
    huidige_ftp: 265,
    start_profiel: { gemigreerd: true }, // skip start_profiel-migratie
    // geen kader -> skip fase-overgang-check (regel 655)
    weekSessies: { sessies: [sessie] },
  }
}

function basisSeed(plan) {
  return {
    'users:active': ['u1'],
    'user:u1:intervals_key': 'enc-key',
    'user:u1:athlete_id': 'athlete-1',
    'u1:seizoensplan': plan,
    'ef_backfill_voltooid:u1': true,
    'migratie:tss-bron:u1': true,
    'decoupling_backfill_voltooid:u1': true,
    'vo2max_suggestie_status:u1': 'getoond',
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T10:00:00')) // woensdag: geen HRV-profiel-maandagpad, geen zondag-volume-evaluatie
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => '' }))) // FTP-sync-check (regel 119): geen echte netwerkcall
  vi.mocked(intervalsGet).mockReset()
  vi.mocked(maakMelding).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('POST /api/cron/sync — daadwerkelijk aanroeppunt bepaalComplianceRecord (cron/sync/route.js:381-391)', () => {
  it('continue-intensiteit kernsessie: sessie_compliance-record identiek aan de oude inline berekening', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 80,
      duur_min: 17,
      intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur', toegestane_zones: ['Z2'] },
    }
    const plan = basisPlan(sessie)
    const kv = maakKvMock(basisSeed(plan))
    vi.mocked(getKV).mockReturnValue(kv)

    const rit = {
      id: 'rit-continu-1',
      type: 'Ride',
      start_date_local: `${RITDATUM}T08:00:00`,
      moving_time: 1000, // <45 min -> slaat de decoupling-cache-lus over (route.js:454)
      icu_training_load: 78,
      icu_weighted_avg_watts: 185,
      icu_intensity: 0.70,
      icu_zone_times: [
        { id: 'Z1', secs: 50 },
        { id: 'Z2', secs: 900 }, // 900/1000 = 90% -> "volledig" (drempel 85)
        { id: 'Z3', secs: 50 },
      ],
    }
    vi.mocked(intervalsGet).mockResolvedValueOnce([rit]).mockResolvedValue([])

    const resp = await POST(req())
    expect(resp.status).toBe(200)
    const body = await resp.json()
    expect(body.results.find(r => r.userId === 'u1')).toMatchObject({ status: 'new_activity' })

    const record = kv.store.get(`sessie_compliance:u1:${RITDATUM}`)
    expect(record).toBeDefined()
    // Exact wat de oude inline logica (vóór A0) voor dezelfde input zou hebben
    // geproduceerd: berekenTijdInZonePercentage({Z1:50,Z2:900,Z3:50}, ['Z2']) = 90.0,
    // bepaalComplianceTier(90.0, 'z2_duur') = 'volledig'.
    expect(record).toMatchObject({
      tier: 'volledig',
      percentageOfScore: 90,
      sessietype: 'z2_duur',
      isKernsessie: true,
      verplaatst_van: null,
      verplaatst_naar: null,
      activiteitId: 'rit-continu-1',
      datum: RITDATUM,
    })
    expect(record.berekendOp).toEqual(expect.any(String))

    const plaOpgeslagen = kv.store.get('u1:seizoensplan')
    expect(plaOpgeslagen.weekSessies.sessies.find(s => s.datum === RITDATUM).voltooid).toBe(true)
  })

  it('discrete-effort-sessie (sprint_neuraal): sessie_compliance-record via de dimensieScore-tak, identiek aan de oude inline berekening', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 40,
      duur_min: 10,
      intentie: { rol: 'intensiteitsdag', sessietype: 'sprint_neuraal', toegestane_zones: ['Z1', 'Z6'] },
    }
    const plan = basisPlan(sessie)
    const kv = maakKvMock(basisSeed(plan))
    vi.mocked(getKV).mockReturnValue(kv)

    const rit = {
      id: 'rit-discreet-1',
      type: 'Ride',
      start_date_local: `${RITDATUM}T08:00:00`,
      moving_time: 600, // 10 min, <45 min -> slaat decoupling-cache-lus over
      icu_training_load: 40, // exacte match met tss=40 -> dimensieScore = 10
      icu_weighted_avg_watts: 400,
      icu_intensity: 1.5,
      icu_zone_times: [{ id: 'Z6', secs: 30 }], // genegeerd op de discrete-effort-tak
    }
    vi.mocked(intervalsGet).mockResolvedValueOnce([rit]).mockResolvedValue([])

    const resp = await POST(req())
    expect(resp.status).toBe(200)

    const record = kv.store.get(`sessie_compliance:u1:${RITDATUM}`)
    expect(record).toBeDefined()
    // Oude inline logica: isDiscreteEffortType('sprint_neuraal') -> dimensieScore(40,40)=10
    // -> bepaalComplianceTier(10, 'sprint_neuraal') = 'volledig' (drempel 8.5); isKernsessie=false
    // (sprint_neuraal staat niet in KERNSESSIE_TYPES, compliance.js).
    expect(record).toMatchObject({
      tier: 'volledig',
      percentageOfScore: 10,
      sessietype: 'sprint_neuraal',
      isKernsessie: false,
      verplaatst_van: null,
      verplaatst_naar: null,
      activiteitId: 'rit-discreet-1',
      datum: RITDATUM,
    })
  })
})

describe('POST /api/cron/sync — B5: verplaatst_van/verplaatst_naar-fallback (cron/sync/route.js)', () => {
  function bouwRit(overrides = {}) {
    return {
      id: 'rit-verplaatst-1',
      type: 'Ride',
      start_date_local: `${RITDATUM}T08:00:00`,
      moving_time: 1000,
      icu_training_load: 78,
      icu_weighted_avg_watts: 185,
      icu_intensity: 0.70,
      icu_zone_times: [{ id: 'Z2', secs: 1000 }],
      ...overrides,
    }
  }

  it('leest het bron-neutrale verplaatst_van/verplaatst_naar (B5-herschikking) als de HRV-specifieke velden ontbreken', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 80,
      duur_min: 17,
      intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur', toegestane_zones: ['Z2'] },
      verplaatst_van: '2026-07-12',
      verplaatst_naar: '2026-07-16',
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValueOnce([bouwRit()]).mockResolvedValue([])

    await POST(req())

    const record = kv.store.get(`sessie_compliance:u1:${RITDATUM}`)
    expect(record.verplaatst_van).toBe('2026-07-12')
    expect(record.verplaatst_naar).toBe('2026-07-16')
  })

  it('valt terug op de HRV-specifieke velden als de bron-neutrale velden ontbreken (bestaand HRV-gedrag ongewijzigd)', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 80,
      duur_min: 17,
      intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur', toegestane_zones: ['Z2'] },
      hrv_verplaatst_van: '2026-07-11',
      hrv_verplaatst_naar: '2026-07-17',
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValueOnce([bouwRit()]).mockResolvedValue([])

    await POST(req())

    const record = kv.store.get(`sessie_compliance:u1:${RITDATUM}`)
    expect(record.verplaatst_van).toBe('2026-07-11')
    expect(record.verplaatst_naar).toBe('2026-07-17')
  })

  it('geeft voorrang aan de bron-neutrale velden als beide aanwezig zijn', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 80,
      duur_min: 17,
      intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur', toegestane_zones: ['Z2'] },
      verplaatst_van: '2026-07-12',
      verplaatst_naar: '2026-07-16',
      hrv_verplaatst_van: '2026-07-11',
      hrv_verplaatst_naar: '2026-07-17',
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValueOnce([bouwRit()]).mockResolvedValue([])

    await POST(req())

    const record = kv.store.get(`sessie_compliance:u1:${RITDATUM}`)
    expect(record.verplaatst_van).toBe('2026-07-12')
    expect(record.verplaatst_naar).toBe('2026-07-16')
  })

  it('null als geen van beide veldparen aanwezig is', async () => {
    const sessie = {
      datum: RITDATUM,
      voltooid: false,
      tss: 80,
      duur_min: 17,
      intentie: { rol: 'aerobe_dag', sessietype: 'z2_duur', toegestane_zones: ['Z2'] },
    }
    const kv = maakKvMock(basisSeed(basisPlan(sessie)))
    vi.mocked(getKV).mockReturnValue(kv)
    vi.mocked(intervalsGet).mockResolvedValueOnce([bouwRit()]).mockResolvedValue([])

    await POST(req())

    const record = kv.store.get(`sessie_compliance:u1:${RITDATUM}`)
    expect(record.verplaatst_van).toBeNull()
    expect(record.verplaatst_naar).toBeNull()
  })
})

describe('POST /api/cron/sync — D1 compliance-poort samenloop met checkFaseOvergang (cron/sync/route.js:654-780)', () => {
  // startdatum 2026-07-05 (zondag -> normaliseert terug naar maandag 2026-06-28
  // via getMaandagVanWeek) geeft, met "vandaag" gepind op 2026-07-15 (zie
  // beforeEach hierboven), weekNr=3 -> weekNr % 4 === 3 -> isLaatsteOpbouwWeek.
  // Weken 1-3 = fase 'basis' (opbouw), week 4 = fase 'test' (herstel) — nodig
  // als invoegpunt voor voegExtraWeekToe().
  const STARTDATUM = '2026-07-05';
  const KADER = [
    { week: 1, fase: 'basis', weektype: 'opbouw', tss_doel: 200 },
    { week: 2, fase: 'basis', weektype: 'opbouw', tss_doel: 210 },
    { week: 3, fase: 'basis', weektype: 'opbouw', tss_doel: 220 },
    { week: 4, fase: 'test', weektype: 'herstel', tss_doel: 150 },
  ];
  const MAIN_RITDATUM = '2026-07-15';

  function basisPlanMetKader(overrides = {}) {
    return {
      huidige_ftp: 265,
      start_profiel: { gemigreerd: true },
      startdatum: STARTDATUM,
      kader: KADER.map(w => ({ ...w })), // eigen kopie per test, voegExtraWeekToe muteert in-place
      weekSessies: { sessies: [] },
      ...overrides,
    };
  }

  function mainRit() {
    return {
      id: 'main-rit-1',
      type: 'Ride',
      start_date_local: `${MAIN_RITDATUM}T08:00:00`,
      moving_time: 600, // <45 min -> slaat de decoupling-cache-lus over
      icu_training_load: 40,
      icu_zone_times: [],
    };
  }

  // Drie Z2-ritten met een hoge, onderling dicht-bij-elkaar-liggende decoupling
  // (mediaan 8.5 > 7-drempel) -> checkFaseOvergang's uitstel-conditie triggert.
  function decouplingFetchMock(intervalsGetMock, { decouplingRitten = [] } = {}) {
    intervalsGetMock.mockImplementation(async (pad, params) => {
      if (pad === '/activities' && params?.limit === '10') return [mainRit()];
      if (pad === '/activities' && params?.limit === '40') return decouplingRitten;
      return [];
    });
  }

  function seedDecouplingWaarden(seed, waarden) {
    waarden.forEach((w, i) => { seed[`decoupling:dc-rit-${i}`] = w; });
    return waarden.map((_, i) => ({ id: `dc-rit-${i}`, type: 'Ride', start_date_local: '2026-07-10T08:00:00' }));
  }

  // Voor de FIX 1-tests hieronder: cron/sync's eigen "nieuwste activiteit"-
  // idempotentie (route.js:206, `lastActivity?.id === nieuwste.id`) slaat het
  // hele fase-overgang-blok over (status "up_to_date") als de hoofdrit-id
  // ongewijzigd is t.o.v. de vorige run. Om binnen dezelfde week een TWEEDE,
  // daadwerkelijk opnieuw verwerkte cron-run te simuleren (i.p.v. een no-op),
  // moet elke opeenvolgende POST-call een NIEUWE hoofdrit-id opleveren.
  function decouplingFetchMockMetRitId(intervalsGetMock, { decouplingRitten = [], mainRitId }) {
    intervalsGetMock.mockImplementation(async (pad, params) => {
      if (pad === '/activities' && params?.limit === '10') {
        return [{ ...mainRit(), id: mainRitId }];
      }
      if (pad === '/activities' && params?.limit === '40') return decouplingRitten;
      return [];
    });
  }

  it('alleen decoupling triggert: alleen fase_verlengd_count opgehoogd, één voegExtraWeekToe, alleen opbouwweek_verlengd verstuurd', async () => {
    const seed = basisSeed(basisPlanMetKader());
    const decouplingRitten = seedDecouplingWaarden(seed, [8, 8.5, 9]); // mediaan 8.5 > 7
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMock(intervalsGet, { decouplingRitten });

    await POST(req());

    const plan = kv.store.get('u1:seizoensplan');
    expect(plan.fase_verlengd_count).toBe(1);
    expect(plan.compliance_verlengd_count).toBeUndefined();
    expect(plan.kader.length).toBe(KADER.length + 1); // precies één extra week ingevoegd
    expect(plan.opbouwweek_verlengd_count).toBe(1); // gedeelde guard (test 2, gedeelde-guard-plan): ook nu correct gezet

    expect(maakMelding).toHaveBeenCalledWith('u1', 'opbouwweek_verlengd');
    expect(maakMelding).not.toHaveBeenCalledWith('u1', 'compliance_opbouwweek_verlengd', expect.anything());
  })

  it('alleen compliance triggert (decoupling < 3 waarden): alleen compliance_verlengd_count opgehoogd, één voegExtraWeekToe, alleen compliance_opbouwweek_verlengd verstuurd', async () => {
    const seed = basisSeed(basisPlanMetKader());
    // >=2 niet_geleverd kernsessies binnen de faseperiode (fase 'basis' start
    // 2026-06-28, "vandaag" = 2026-07-15 -> beide datums vallen binnen het venster).
    seed['sessie_compliance:u1:2026-07-01'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-01' };
    seed['sessie_compliance:u1:2026-07-08'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' };
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMock(intervalsGet, { decouplingRitten: [] }); // <3 -> decoupling triggert nooit

    await POST(req());

    const plan = kv.store.get('u1:seizoensplan');
    expect(plan.compliance_verlengd_count).toBe(1);
    expect(plan.fase_verlengd_count).toBeUndefined();
    expect(plan.kader.length).toBe(KADER.length + 1);

    expect(maakMelding).toHaveBeenCalledWith('u1', 'compliance_opbouwweek_verlengd');
    expect(maakMelding).not.toHaveBeenCalledWith('u1', 'opbouwweek_verlengd');
  })

  it('beide triggeren gelijktijdig: BEIDE tellers opgehoogd, PRECIES ÉÉN voegExtraWeekToe (niet twee extra weken), BEIDE meldingen verstuurd', async () => {
    const seed = basisSeed(basisPlanMetKader());
    const decouplingRitten = seedDecouplingWaarden(seed, [8, 8.5, 9]);
    seed['sessie_compliance:u1:2026-07-01'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-01' };
    seed['sessie_compliance:u1:2026-07-08'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' };
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMock(intervalsGet, { decouplingRitten });

    await POST(req());

    const plan = kv.store.get('u1:seizoensplan');
    expect(plan.fase_verlengd_count).toBe(1);
    expect(plan.compliance_verlengd_count).toBe(1);
    // Precies één extra week, ondanks dat BEIDE signalen triggerden.
    expect(plan.kader.length).toBe(KADER.length + 1);
    // Gedeelde guard (opbouwweek_verlengd_count): precies 1, niet 2 — de guard
    // wordt éénmalig gezet binnen deze ene synchrone evaluatie, ongeacht hoeveel
    // signalen tegelijk triggerden (test 5, gedeelde-guard-plan).
    expect(plan.opbouwweek_verlengd_count).toBe(1);

    expect(maakMelding).toHaveBeenCalledWith('u1', 'opbouwweek_verlengd');
    expect(maakMelding).toHaveBeenCalledWith('u1', 'compliance_opbouwweek_verlengd');
  })

  it('geen van beide triggert: geen verlenging, geen melding', async () => {
    const seed = basisSeed(basisPlanMetKader());
    // Geen niet_geleverd-records geseed -> compliance triggert niet.
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMock(intervalsGet, { decouplingRitten: [] }); // <3 -> decoupling triggert niet

    await POST(req());

    const plan = kv.store.get('u1:seizoensplan');
    expect(plan.fase_verlengd_count).toBeUndefined();
    expect(plan.compliance_verlengd_count).toBeUndefined();
    expect(plan.kader.length).toBe(KADER.length); // geen extra week

    expect(maakMelding).not.toHaveBeenCalledWith('u1', 'opbouwweek_verlengd');
    expect(maakMelding).not.toHaveBeenCalledWith('u1', 'compliance_opbouwweek_verlengd', expect.anything());
  })

  it('test 1 (FIX 1, decoupling): evaluatie zonder trigger binnen dezelfde week wordt niet gecachet -> latere evaluatie diezelfde week met gewijzigde decouplingWaarden triggert alsnog', async () => {
    const seed = basisSeed(basisPlanMetKader());
    const decouplingRitten = seedDecouplingWaarden(seed, [1, 2, 3]); // mediaan 2, geen trigger
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten, mainRitId: 'main-rit-1' });

    await POST(req());

    expect(kv.store.get('decoupling_check:u1:3')).toBeUndefined(); // FIX 1: geen trigger -> niet gecachet
    let plan = kv.store.get('u1:seizoensplan');
    expect(plan.fase_verlengd_count).toBeUndefined();
    expect(maakMelding).not.toHaveBeenCalled();

    // Zelfde week ("vandaag" niet veranderd), maar decouplingWaarden verslechteren.
    // Nieuwe hoofdrit-id nodig: anders slaat cron/sync's eigen "nieuwste
    // activiteit al bekend"-idempotentie (route.js:206) de hele run over.
    kv.store.set('decoupling:dc-rit-0', 8);
    kv.store.set('decoupling:dc-rit-1', 8.5);
    kv.store.set('decoupling:dc-rit-2', 9);
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten, mainRitId: 'main-rit-2' });

    await POST(req());

    plan = kv.store.get('u1:seizoensplan');
    expect(plan.fase_verlengd_count).toBe(1); // dedup-gate blokkeerde de herevaluatie niet
    expect(kv.store.get('decoupling_check:u1:3')).toEqual({ mediaan: 8.5, uitstel: true }); // nu pas gecachet
    expect(maakMelding).toHaveBeenCalledTimes(1);
    expect(maakMelding).toHaveBeenCalledWith('u1', 'opbouwweek_verlengd');
  })

  it('test 2 (FIX 1, compliance): evaluatie zonder trigger binnen dezelfde week wordt niet gecachet -> latere evaluatie diezelfde week met gewijzigde compliance-records triggert alsnog', async () => {
    const seed = basisSeed(basisPlanMetKader());
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten: [], mainRitId: 'main-rit-1' }); // <3 -> decoupling triggert nooit, isoleert compliance

    await POST(req());

    expect(kv.store.get('compliance_check:u1:3')).toBeUndefined(); // FIX 1: geen trigger -> niet gecachet
    let plan = kv.store.get('u1:seizoensplan');
    expect(plan.compliance_verlengd_count).toBeUndefined();
    expect(maakMelding).not.toHaveBeenCalled();

    // Zelfde week, maar er komen alsnog niet_geleverd kernsessies bij.
    // Nieuwe hoofdrit-id nodig, zie toelichting in de decoupling-variant hierboven.
    kv.store.set('sessie_compliance:u1:2026-07-01', { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-01' });
    kv.store.set('sessie_compliance:u1:2026-07-08', { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' });
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten: [], mainRitId: 'main-rit-2' });

    await POST(req());

    plan = kv.store.get('u1:seizoensplan');
    expect(plan.compliance_verlengd_count).toBe(1); // dedup-gate blokkeerde de herevaluatie niet
    expect(kv.store.get('compliance_check:u1:3')).toEqual({ nietGeleverd: 2, uitstel: true }); // nu pas gecachet
    expect(maakMelding).toHaveBeenCalledTimes(1);
    expect(maakMelding).toHaveBeenCalledWith('u1', 'compliance_opbouwweek_verlengd');
  })

  it('test 5 (interactie/regressie op de trigger-tests hierboven): bij een daadwerkelijke trigger wordt precies één keer opgehoogd, geen dubbele of premature ophoging, ook nu FIX 1 evaluaties binnen dezelfde week kan herhalen', async () => {
    const seed = basisSeed(basisPlanMetKader());
    const decouplingRitten = seedDecouplingWaarden(seed, [8, 8.5, 9]); // triggert direct
    seed['sessie_compliance:u1:2026-07-01'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-01' };
    seed['sessie_compliance:u1:2026-07-08'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' };
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten, mainRitId: 'main-rit-1' });

    await POST(req()); // eerste run: beide triggeren, beide tellers -> 1, beide caches gezet (FIX 1)

    // Tweede run, zelfde week, ongewijzigde waarden, nieuwe hoofdrit-id (anders
    // slaat route.js:206's eigen idempotentie de run over vóórdat het
    // fase-overgang-blok wordt bereikt) — caches blokkeren nu de herevaluatie.
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten, mainRitId: 'main-rit-2' });
    await POST(req());

    const plan = kv.store.get('u1:seizoensplan');
    expect(plan.fase_verlengd_count).toBe(1); // niet 2
    expect(plan.compliance_verlengd_count).toBe(1); // niet 2
    expect(plan.kader.length).toBe(KADER.length + 1); // precies één extra week, niet twee
    expect(maakMelding).toHaveBeenCalledTimes(2); // precies één keer per melding-type, niet vier
    expect(maakMelding).toHaveBeenCalledWith('u1', 'opbouwweek_verlengd');
    expect(maakMelding).toHaveBeenCalledWith('u1', 'compliance_opbouwweek_verlengd');
  })

  it('test 1 (compliance losgekoppeld van idempotentie-gate): compliance triggert via de vroege-return-tak wanneer er geen nieuwe activiteit is', async () => {
    const seed = basisSeed(basisPlanMetKader());
    // "Geen nieuwe activiteit sinds vorige sync" -> lastActivity.id === nieuwste.id (route.js:~211-212).
    seed['user:u1:last_activity'] = { id: 'main-rit-1', datum_iso: '2026-07-12' };
    seed['sessie_compliance:u1:2026-07-01'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-01' };
    seed['sessie_compliance:u1:2026-07-08'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' };
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten: [], mainRitId: 'main-rit-1' });

    await POST(req());

    const plan = kv.store.get('u1:seizoensplan');
    expect(plan.compliance_verlengd_count).toBe(1);
    expect(plan.opbouwweek_verlengd_count).toBe(1);
    expect(plan.fase_verlengd_count).toBeUndefined(); // decoupling draait niet in het idempotente pad
    expect(plan.kader.length).toBe(KADER.length + 1);
    expect(maakMelding).toHaveBeenCalledWith('u1', 'compliance_opbouwweek_verlengd');
    expect(maakMelding).not.toHaveBeenCalledWith('u1', 'opbouwweek_verlengd');
  })

  it('test 3/4 (gedeelde guard): compliance triggert eerst via de vroege-return-tak; decoupling triggert daarna binnen dezelfde fase in het volledige pad en wordt volledig genegeerd', async () => {
    const seed = basisSeed(basisPlanMetKader());
    seed['user:u1:last_activity'] = { id: 'main-rit-1', datum_iso: '2026-07-12' };
    seed['sessie_compliance:u1:2026-07-01'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-01' };
    seed['sessie_compliance:u1:2026-07-08'] = { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' };
    const decouplingRitten = seedDecouplingWaarden(seed, [8, 8.5, 9]); // klaar voor run 2, mediaan 8.5 > 7
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);

    // Run 1: geen nieuwe activiteit -> idempotente tak, compliance triggert en zet de gedeelde guard.
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten, mainRitId: 'main-rit-1' });
    await POST(req());

    let plan = kv.store.get('u1:seizoensplan');
    expect(plan.compliance_verlengd_count).toBe(1);
    expect(plan.opbouwweek_verlengd_count).toBe(1);
    expect(plan.kader.length).toBe(KADER.length + 1);
    expect(maakMelding).toHaveBeenCalledTimes(1);

    // Run 2: nieuwe activiteit -> volledig pad, decoupling zou nu triggeren (mediaan 8.5 > 7),
    // maar de gedeelde guard (al gezet in run 1) negeert dit volledig.
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten, mainRitId: 'main-rit-2' });
    await POST(req());

    plan = kv.store.get('u1:seizoensplan');
    expect(plan.fase_verlengd_count).toBeUndefined(); // geblokkeerd door de guard
    expect(plan.compliance_verlengd_count).toBe(1); // ongewijzigd
    expect(plan.opbouwweek_verlengd_count).toBe(1); // ongewijzigd, niet nogmaals opgehoogd
    expect(plan.kader.length).toBe(KADER.length + 1); // geen tweede invoeging
    expect(maakMelding).toHaveBeenCalledTimes(1); // geen nieuwe melding
    expect(maakMelding).not.toHaveBeenCalledWith('u1', 'opbouwweek_verlengd');
  })

  it('test 3/4 symmetrisch (gedeelde guard): decoupling triggert eerst in het volledige pad; compliance triggert daarna binnen dezelfde fase via de vroege-return-tak en wordt volledig genegeerd', async () => {
    const seed = basisSeed(basisPlanMetKader());
    const decouplingRitten = seedDecouplingWaarden(seed, [8, 8.5, 9]); // mediaan 8.5 > 7
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);

    // Run 1: nieuwe activiteit -> volledig pad, decoupling triggert (geen niet_geleverd-records
    // geseed -> compliance triggert hier nog niet).
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten, mainRitId: 'main-rit-1' });
    await POST(req());

    let plan = kv.store.get('u1:seizoensplan');
    expect(plan.fase_verlengd_count).toBe(1);
    expect(plan.opbouwweek_verlengd_count).toBe(1);
    expect(plan.kader.length).toBe(KADER.length + 1);
    expect(maakMelding).toHaveBeenCalledTimes(1);

    // Run 2: zelfde hoofdrit-id als run 1 (route.js schrijft die als last_activity weg) -> geen
    // nieuwe activiteit -> idempotente tak; er komen nu alsnog niet_geleverd kernsessies bij,
    // maar de gedeelde guard (al gezet in run 1) negeert dit volledig.
    kv.store.set('sessie_compliance:u1:2026-07-01', { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-01' });
    kv.store.set('sessie_compliance:u1:2026-07-08', { tier: 'niet_geleverd', isKernsessie: true, datum: '2026-07-08' });
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten, mainRitId: 'main-rit-1' });
    await POST(req());

    plan = kv.store.get('u1:seizoensplan');
    expect(plan.compliance_verlengd_count).toBeUndefined(); // geblokkeerd door de guard
    expect(plan.fase_verlengd_count).toBe(1); // ongewijzigd
    expect(plan.opbouwweek_verlengd_count).toBe(1); // ongewijzigd
    expect(plan.kader.length).toBe(KADER.length + 1); // geen tweede invoeging
    expect(maakMelding).toHaveBeenCalledTimes(1); // geen nieuwe melding
    expect(maakMelding).not.toHaveBeenCalledWith('u1', 'compliance_opbouwweek_verlengd');
  })

  it('test 7 (regressie, vroege-return-tak): volume-evaluatie blijft werken na het invoegen van de compliance-poort-aanroep', async () => {
    const seed = basisSeed(basisPlanMetKader());
    seed['user:u1:last_activity'] = { id: 'main-rit-1', datum_iso: '2026-07-12' };
    seed['rpe_trend:u1'] = 'stabiel';
    // Geen niet_geleverd-records -> compliance-poort triggert hier niet, puur regressie op de rest.
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    decouplingFetchMockMetRitId(intervalsGet, { decouplingRitten: [], mainRitId: 'main-rit-1' });

    await POST(req());

    const plan = kv.store.get('u1:seizoensplan');
    expect(plan.compliance_verlengd_count).toBeUndefined();
    expect(plan.opbouwweek_verlengd_count).toBeUndefined();
    expect(plan.kader.length).toBe(KADER.length);
  })
})

describe('POST /api/cron/sync — B2 herstelsnelheid-personalisatie + versie-gate (maandag-tak, cron/sync/route.js)', () => {
  // Vandaag = maandag 2026-07-20 (2026-07-15 uit de andere describe-blokken
  // hierboven is een woensdag; +5 dagen = maandag), zodat de HRV-profiel-
  // maandagpas daadwerkelijk draait.
  const VANDAAG = '2026-07-20';
  const ZWARE_SESSIE_DATUM = '2026-07-17';

  function maakWellnessFixture() {
    const data = [];
    for (let d = 1; d <= 16; d++) {
      data.push({ id: `2026-07-${String(d).padStart(2, '0')}`, hrv: 60, restingHR: 50 });
    }
    data.push({ id: '2026-07-17', hrv: 60, restingHR: 50 }); // sessiedag zelf
    data.push({ id: '2026-07-18', hrv: 40, restingHR: 50 }); // dag 1 ná de sessie: nog onderdrukt
    data.push({ id: '2026-07-19', hrv: 62, restingHR: 50 }); // dag 2: hersteld
    data.push({ id: '2026-07-20', hrv: 62, restingHR: 50 }); // vandaag
    return data;
  }

  function maakPlanMetZwareSessie() {
    return {
      huidige_ftp: 265,
      start_profiel: { gemigreerd: true },
      weekSessies: { sessies: [
        { datum: ZWARE_SESSIE_DATUM, voltooid: true, intentie: { sessietype: 'sweetspot_intervallen' } },
      ] },
    };
  }

  function mockIntervalsVoorMaandagpas() {
    intervalsGet.mockImplementation(async (pad) => {
      if (pad === '/wellness') return maakWellnessFixture();
      if (pad === '/activities') return []; // geen nieuwe rit -> vroege "no_new"-continue, ná de maandagpas
      return [];
    });
  }

  beforeEach(() => {
    vi.setSystemTime(new Date(`${VANDAAG}T10:00:00`));
  });

  it('geen versie:2 op bestaande herstelsnelheid-data -> genegeerd, schone start (99/50 wordt niet hergebruikt)', async () => {
    const seed = basisSeed(maakPlanMetZwareSessie());
    seed['hrv-profiel:u1'] = { herstelsnelheid: { sweetspot_intervallen: { dagen: 99, observaties: 50 } } }; // GEEN versie:2
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    mockIntervalsVoorMaandagpas();

    await POST(req());

    const hrvProfiel = kv.store.get('hrv-profiel:u1');
    expect(hrvProfiel.herstelsnelheid.versie).toBe(2);
    expect(hrvProfiel.herstelsnelheid.sweetspot_intervallen).toEqual({ dagen: 2, observaties: 1 });
  })

  it('MET versie:2 -> bestaande observatie correct hergebruikt/uitgebreid (incrementeel gemiddelde)', async () => {
    const seed = basisSeed(maakPlanMetZwareSessie());
    seed['hrv-profiel:u1'] = { herstelsnelheid: { sweetspot_intervallen: { dagen: 4, observaties: 3 }, versie: 2 } };
    const kv = maakKvMock(seed);
    vi.mocked(getKV).mockReturnValue(kv);
    mockIntervalsVoorMaandagpas();

    await POST(req());

    const hrvProfiel = kv.store.get('hrv-profiel:u1');
    // nieuweObservaties = 3+1 = 4; nieuwGemiddelde = (4*3 + 2) / 4 = 3.5
    expect(hrvProfiel.herstelsnelheid.versie).toBe(2);
    expect(hrvProfiel.herstelsnelheid.sweetspot_intervallen).toEqual({ dagen: 3.5, observaties: 4 })
  })
})
