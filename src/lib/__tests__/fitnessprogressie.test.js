import { describe, it, expect } from "vitest";
import {
  lineaireRegressieHelling,
  berekenCtlTrend,
  berekenDecouplingTrend,
  berekenFitnessprogressie,
  fitnessprogressieContextlijn,
  CTL_TREND_DREMPEL_PER_WEEK,
  DECOUPLING_TREND_MIN_PUNTEN,
  CTL_TREND_MIN_DAGEN,
} from "../fitnessprogressie";

function ctlReeksVanaf(startDatum, dagen, ctlPerDag) {
  const t0 = new Date(startDatum);
  return Array.from({ length: dagen }, (_, i) => {
    const d = new Date(t0);
    d.setDate(d.getDate() + i);
    return { datum: d.toISOString().slice(0, 10), ctl: ctlPerDag(i) };
  });
}

describe("lineaireRegressieHelling", () => {
  it("perfecte lijn y = 2x + 5 geeft helling 2", () => {
    const punten = [0, 1, 2, 3, 4].map(x => ({ x, y: 2 * x + 5 }));
    expect(lineaireRegressieHelling(punten)).toBeCloseTo(2, 10);
  });

  it("vlakke lijn geeft helling 0", () => {
    const punten = [0, 1, 2, 3].map(x => ({ x, y: 42 }));
    expect(lineaireRegressieHelling(punten)).toBeCloseTo(0, 10);
  });

  it("null bij minder dan 2 punten", () => {
    expect(lineaireRegressieHelling([{ x: 0, y: 1 }])).toBeNull();
    expect(lineaireRegressieHelling([])).toBeNull();
    expect(lineaireRegressieHelling(null)).toBeNull();
  });

  it("null bij identieke x-waarden (verticale/gedegenereerde reeks)", () => {
    expect(lineaireRegressieHelling([{ x: 5, y: 1 }, { x: 5, y: 9 }])).toBeNull();
  });
});

describe("berekenCtlTrend", () => {
  it("stijgende CTL over 70 dagen (>drempel) -> richting stijgend", () => {
    // +2 CTL-punt/week over 70 dagen = 10 weken
    const reeks = ctlReeksVanaf("2026-05-01", 70, i => 40 + (2 / 7) * i);
    const trend = berekenCtlTrend(reeks);
    expect(trend.status).toBe("ok");
    expect(trend.richting).toBe("stijgend");
    expect(trend.helling_per_week).toBeCloseTo(2, 1);
  });

  it("dalende CTL -> richting dalend", () => {
    const reeks = ctlReeksVanaf("2026-05-01", 70, i => 60 - (1.5 / 7) * i);
    const trend = berekenCtlTrend(reeks);
    expect(trend.status).toBe("ok");
    expect(trend.richting).toBe("dalend");
  });

  it("helling binnen ±CTL_TREND_DREMPEL_PER_WEEK -> stabiel", () => {
    // 0.5 CTL/week, ruim binnen de drempel van 1
    const reeks = ctlReeksVanaf("2026-05-01", 70, i => 45 + (0.5 / 7) * i);
    const trend = berekenCtlTrend(reeks);
    expect(trend.status).toBe("ok");
    expect(trend.richting).toBe("stabiel");
  });

  it("exact op de drempel is nog stabiel (strikt >, niet >=)", () => {
    const reeks = ctlReeksVanaf("2026-05-01", 70, i => 45 + (CTL_TREND_DREMPEL_PER_WEEK / 7) * i);
    const trend = berekenCtlTrend(reeks);
    expect(trend.richting).toBe("stabiel");
  });

  it("minder dan CTL_TREND_MIN_DAGEN geschiedenis -> onvoldoende_data", () => {
    const reeks = ctlReeksVanaf("2026-05-01", CTL_TREND_MIN_DAGEN - 1, i => 45 + i * 0.5);
    const trend = berekenCtlTrend(reeks);
    expect(trend.status).toBe("onvoldoende_data");
    expect(trend.richting).toBeNull();
    expect(trend.helling_per_week).toBeNull();
  });

  it("lege of ontbrekende reeks -> onvoldoende_data, crasht niet", () => {
    expect(berekenCtlTrend([]).status).toBe("onvoldoende_data");
    expect(berekenCtlTrend(null).status).toBe("onvoldoende_data");
    expect(berekenCtlTrend(undefined).status).toBe("onvoldoende_data");
  });

  it("null-waarden in de reeks worden genegeerd, volgorde maakt niet uit (ongesorteerde input)", () => {
    const reeksGesorteerd = ctlReeksVanaf("2026-05-01", 70, i => 40 + (2 / 7) * i);
    const reeksGeschud = [...reeksGesorteerd].reverse();
    reeksGeschud.push({ datum: "2026-05-10", ctl: null });
    const trendGesorteerd = berekenCtlTrend(reeksGesorteerd);
    const trendGeschud = berekenCtlTrend(reeksGeschud);
    expect(trendGeschud.helling_per_week).toBeCloseTo(trendGesorteerd.helling_per_week, 5);
  });
});

describe("berekenDecouplingTrend", () => {
  it("minder dan DECOUPLING_TREND_MIN_PUNTEN punten -> onvoldoende_data, geen geforceerde richting", () => {
    const reeks = Array.from({ length: DECOUPLING_TREND_MIN_PUNTEN - 1 }, (_, i) => ({ datum: `2026-05-${String(i + 1).padStart(2, "0")}`, waarde: 5 }));
    const trend = berekenDecouplingTrend(reeks);
    expect(trend.status).toBe("onvoldoende_data");
    expect(trend.richting).toBeNull();
    expect(trend.aantal_punten).toBe(DECOUPLING_TREND_MIN_PUNTEN - 1);
  });

  it(">=DECOUPLING_TREND_MIN_PUNTEN dalende decoupling -> verbeterend", () => {
    const reeks = Array.from({ length: 12 }, (_, i) => {
      const d = new Date("2026-05-01");
      d.setDate(d.getDate() + i * 4);
      return { datum: d.toISOString().slice(0, 10), waarde: 10 - i * 0.5 };
    });
    const trend = berekenDecouplingTrend(reeks);
    expect(trend.status).toBe("ok");
    expect(trend.richting).toBe("verbeterend");
    expect(trend.helling_per_week).toBeLessThan(0);
  });

  it("stijgende decoupling -> verslechterend", () => {
    const reeks = Array.from({ length: 12 }, (_, i) => {
      const d = new Date("2026-05-01");
      d.setDate(d.getDate() + i * 4);
      return { datum: d.toISOString().slice(0, 10), waarde: 2 + i * 0.5 };
    });
    const trend = berekenDecouplingTrend(reeks);
    expect(trend.status).toBe("ok");
    expect(trend.richting).toBe("verslechterend");
  });

  it("lege/ontbrekende reeks -> onvoldoende_data, crasht niet", () => {
    expect(berekenDecouplingTrend([]).status).toBe("onvoldoende_data");
    expect(berekenDecouplingTrend(null).status).toBe("onvoldoende_data");
  });
});

describe("berekenFitnessprogressie", () => {
  it("combineert ctl-trend, decoupling-trend en ftp-testmarkers in één object", () => {
    const ctlReeks = ctlReeksVanaf("2026-05-01", 70, i => 40 + (2 / 7) * i);
    const decouplingReeks = Array.from({ length: 12 }, (_, i) => {
      const d = new Date("2026-05-01");
      d.setDate(d.getDate() + i * 4);
      return { datum: d.toISOString().slice(0, 10), waarde: 8 - i * 0.3 };
    });
    const ftpTestMarkers = [{ week: 3, datum: "2026-05-20" }];

    const resultaat = berekenFitnessprogressie({ ctlReeks, decouplingReeks, ftpTestMarkers, berekendOp: "2026-07-13T12:00:00.000Z" });

    expect(resultaat.berekend_op).toBe("2026-07-13T12:00:00.000Z");
    expect(resultaat.ctl_trend.status).toBe("ok");
    expect(resultaat.ctl_trend.richting).toBe("stijgend");
    expect(resultaat.decoupling_trend.status).toBe("ok");
    expect(resultaat.decoupling_trend.richting).toBe("verbeterend");
    expect(resultaat.ftp_test_markers).toEqual(ftpTestMarkers);
  });

  it("werkt ook zonder ftpTestMarkers (default lege array) en zonder data (beide onvoldoende_data)", () => {
    const resultaat = berekenFitnessprogressie({ ctlReeks: [], decouplingReeks: [] });
    expect(resultaat.ctl_trend.status).toBe("onvoldoende_data");
    expect(resultaat.decoupling_trend.status).toBe("onvoldoende_data");
    expect(resultaat.ftp_test_markers).toEqual([]);
  });
});

describe("fitnessprogressieContextlijn", () => {
  // Vervangt VoortgangTab.js' vroegere conditieTrendContextlijn() (las de
  // dagelijkse conditie_score-pil) — deze tests dekken nu de nieuwe brontekst,
  // inclusief het onvoldoende_data-pad voor zowel CTL als decoupling.

  it("CTL onvoldoende_data -> eerlijke 'nog te weinig geschiedenis'-tekst, geen richting geforceerd", () => {
    const { ctlRegel } = fitnessprogressieContextlijn({ ctlTrend: { status: "onvoldoende_data", helling_per_week: null, richting: null } });
    expect(ctlRegel).toMatch(/te weinig trainingsgeschiedenis/i);
  });

  it("ontbrekende ctlTrend (undefined) wordt behandeld als onvoldoende_data, crasht niet", () => {
    const { ctlRegel } = fitnessprogressieContextlijn({});
    expect(ctlRegel).toMatch(/te weinig trainingsgeschiedenis/i);
  });

  it("CTL stijgend, helling < 3/week -> 'gestaag' (niet 'sterk')", () => {
    const { ctlRegel } = fitnessprogressieContextlijn({ ctlTrend: { status: "ok", richting: "stijgend", helling_per_week: 1.5, venster_dagen: 70 } });
    expect(ctlRegel).toMatch(/gestaag/i);
    expect(ctlRegel).not.toMatch(/sterk/i);
    expect(ctlRegel).toContain("1.5");
  });

  it("CTL stijgend, helling >= 3/week -> 'sterk'", () => {
    const { ctlRegel } = fitnessprogressieContextlijn({ ctlTrend: { status: "ok", richting: "stijgend", helling_per_week: 3.2, venster_dagen: 70 } });
    expect(ctlRegel).toMatch(/sterk/i);
    expect(ctlRegel).toContain("70");
  });

  it("CTL stabiel -> geen richting-uitspraak, aanmoediging tot meer stimulus", () => {
    const { ctlRegel } = fitnessprogressieContextlijn({ ctlTrend: { status: "ok", richting: "stabiel", helling_per_week: 0.2 } });
    expect(ctlRegel).toMatch(/houdt stand/i);
  });

  it("CTL dalend -> waarschuwende tekst met de helling erin", () => {
    const { ctlRegel } = fitnessprogressieContextlijn({ ctlTrend: { status: "ok", richting: "dalend", helling_per_week: -1.8 } });
    expect(ctlRegel).toMatch(/daalt/i);
    expect(ctlRegel).toContain("-1.8");
  });

  it("decoupling onvoldoende_data -> expliciete tekst met puntenaantal, geen stille lege regel", () => {
    const { decouplingRegel } = fitnessprogressieContextlijn({ decouplingTrend: { status: "onvoldoende_data", aantal_punten: 6 } });
    expect(decouplingRegel).toMatch(/onvoldoende/i);
    expect(decouplingRegel).toContain(`6/${DECOUPLING_TREND_MIN_PUNTEN}`);
  });

  it("ontbrekende decouplingTrend (undefined) wordt behandeld als onvoldoende_data, crasht niet", () => {
    const { decouplingRegel } = fitnessprogressieContextlijn({});
    expect(decouplingRegel).toMatch(/onvoldoende/i);
    expect(decouplingRegel).toContain(`0/${DECOUPLING_TREND_MIN_PUNTEN}`);
  });

  it("decoupling verbeterend/stabiel/verslechterend -> onderscheiden teksten", () => {
    expect(fitnessprogressieContextlijn({ decouplingTrend: { status: "ok", richting: "verbeterend" } }).decouplingRegel).toMatch(/verbetert/i);
    expect(fitnessprogressieContextlijn({ decouplingTrend: { status: "ok", richting: "stabiel" } }).decouplingRegel).toMatch(/stabiel/i);
    expect(fitnessprogressieContextlijn({ decouplingTrend: { status: "ok", richting: "verslechterend" } }).decouplingRegel).toMatch(/verslechtert/i);
  });
});
