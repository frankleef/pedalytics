import { describe, it, expect } from "vitest";
import { berekenEF, selecteerHoofdblokken, berekenEFTrend } from "../ef";

const FTP = 200;

function constant(waarde, lengte) {
  return new Array(lengte).fill(waarde);
}

describe("selecteerHoofdblokken", () => {
  it("scenario A — Z2-sessie: selecteert alleen het Z2-hoofddeel, ongeacht ontbrekende type/isSpecifiek-info", () => {
    // 90 min: 15 min Z1 warming-up (40% FTP) + 65 min Z2 (65% FTP) + 10 min Z1 cooldown (40% FTP)
    const warmup = constant(80, 15 * 60);   // 40% van 200W
    const hoofddeel = constant(130, 65 * 60); // 65% van 200W — binnen Z2 (55-75%)
    const cooldown = constant(80, 10 * 60);
    const vermogen = [...warmup, ...hoofddeel, ...cooldown];
    const hr = constant(140, vermogen.length);

    const resultaat = selecteerHoofdblokken({ vermogenStream: vermogen, hrStream: hr }, "z2", FTP);

    expect(resultaat).not.toBeNull();
    // Alleen Z2-hoofddeel-waarden (130W) mogen geselecteerd zijn, nooit de 80W-warmup/cooldown
    expect(resultaat.vermogen.every(w => w === 130)).toBe(true);
    // Kleine edge-verliezen door de 30-sec rolling-smoothing bij de overgangen zijn ok
    expect(resultaat.vermogen.length).toBeGreaterThan(65 * 60 - 120);
    expect(resultaat.vermogen.length).toBeLessThanOrEqual(65 * 60);
  });

  it("scenario B — drempelsessie: voegt alleen de Z4-werkblokken samen, sluit Z2-herstel en warming-up/cooldown uit", () => {
    const warmup = constant(100, 10 * 60);   // 50% FTP
    const werk = constant(200, 15 * 60);     // 100% FTP — binnen drempel (95-100%)
    const herstel = constant(130, 4 * 60);   // 65% FTP — Z2-herstel tussen intervallen
    const cooldown = constant(100, 10 * 60);

    const vermogen = [
      ...warmup,
      ...werk, ...herstel,
      ...werk, ...herstel,
      ...werk,
      ...cooldown,
    ];
    const hr = constant(160, vermogen.length);

    const resultaat = selecteerHoofdblokken({ vermogenStream: vermogen, hrStream: hr }, "drempel", FTP);

    expect(resultaat).not.toBeNull();
    expect(resultaat.vermogen.every(w => w === 200)).toBe(true);
    const verwachteWerkSeconden = 3 * 15 * 60;
    expect(resultaat.vermogen.length).toBeGreaterThan(verwachteWerkSeconden - 200);
    expect(resultaat.vermogen.length).toBeLessThanOrEqual(verwachteWerkSeconden);
  });

  it("scenario C — te korte Z2-rit (30 min, onder de 45-minuten-eligibility-grens) retourneert null", () => {
    const vermogen = constant(130, 30 * 60); // 65% FTP, 30 minuten
    const hr = constant(140, vermogen.length);

    const resultaat = selecteerHoofdblokken({ vermogenStream: vermogen, hrStream: hr }, "z2", FTP);

    expect(resultaat).toBeNull();
  });

  it("retourneert null bij ontbrekende stream-data", () => {
    expect(selecteerHoofdblokken({ vermogenStream: [], hrStream: [] }, "z2", FTP)).toBeNull();
    expect(selecteerHoofdblokken(null, "sweetspot", FTP)).toBeNull();
    expect(selecteerHoofdblokken({ vermogenStream: constant(130, 3000), hrStream: constant(140, 3000) }, "z2", null)).toBeNull();
  });

  it("retourneert null als een sweetspot/drempel/vo2max-rit te weinig tijd in de doelband doorbrengt", () => {
    // Vrijwel de hele rit in Z2, slechts een paar seconden boven de drempelgrens — ruis, geen werkblok
    const vermogen = [...constant(130, 3000), ...constant(200, 5)];
    const hr = constant(140, vermogen.length);
    const resultaat = selecteerHoofdblokken({ vermogenStream: vermogen, hrStream: hr }, "drempel", FTP);
    expect(resultaat).toBeNull();
  });
});

describe("berekenEF", () => {
  it("berekent NP / gemiddelde hartslag over de geselecteerde data", () => {
    const vermogen = constant(200, 300);
    const hr = constant(160, 300);
    const ef = berekenEF(vermogen, hr);
    expect(ef).toBeCloseTo(200 / 160, 2);
  });

  it("retourneert null bij onvoldoende data", () => {
    expect(berekenEF(constant(200, 10), constant(160, 10))).toBeNull();
    expect(berekenEF([], [])).toBeNull();
  });
});

describe("berekenEFTrend", () => {
  it("scenario D — te weinig punten (2 kwalificerende sessies) levert geen trend op", () => {
    const punten = [
      { datum: "2026-06-01", ef: 1.2 },
      { datum: "2026-06-10", ef: 1.25 },
    ];
    expect(berekenEFTrend(punten)).toBeNull();
  });

  it("berekent een positieve trend bij stijgende EF over tijd", () => {
    const punten = [
      { datum: "2026-05-01", ef: 1.0 },
      { datum: "2026-05-08", ef: 1.05 },
      { datum: "2026-05-15", ef: 1.10 },
      { datum: "2026-05-22", ef: 1.15 },
    ];
    const trend = berekenEFTrend(punten);
    expect(trend).not.toBeNull();
    expect(trend).toBeGreaterThan(0);
  });

  it("retourneert null bij lege of ontbrekende input", () => {
    expect(berekenEFTrend([])).toBeNull();
    expect(berekenEFTrend(null)).toBeNull();
  });
});
