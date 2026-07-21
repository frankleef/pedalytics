import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../kv.js", () => {
  const store = new Map();
  return {
    getKV: () => ({
      get: async (k) => store.get(k) ?? null,
      set: async (k, v) => { store.set(k, v); },
      _store: store,
    }),
  };
});

import { berekenEFTrend, verwerkRitVoorEf } from "../ef";
import { getKV } from "../kv.js";

const FTP = 200;

describe("verwerkRitVoorEf", () => {
  const kv = getKV();
  beforeEach(() => kv._store.clear());

  it("z2-rit (45+ min, IF binnen duur_lang) pusht een datapunt met icu_efficiency_factor", async () => {
    const rit = { id: 1, start_date_local: "2026-06-01T10:00:00", moving_time: 3600, icu_weighted_avg_watts: 140, icu_efficiency_factor: 1.23 };
    const band = await verwerkRitVoorEf(kv, "u1", rit, FTP);
    expect(band).toBe("z2");
    const reeks = await kv.get("ef_trend:u1:z2");
    expect(reeks).toEqual([{ datum: "2026-06-01", ef: 1.23, activityId: 1 }]);
  });

  it("z2-rit korter dan 45 minuten wordt overgeslagen", async () => {
    const rit = { id: 2, start_date_local: "2026-06-01T10:00:00", moving_time: 1800, icu_weighted_avg_watts: 140, icu_efficiency_factor: 1.23 };
    expect(await verwerkRitVoorEf(kv, "u1", rit, FTP)).toBeNull();
  });

  it("ontbrekende icu_efficiency_factor levert geen datapunt op", async () => {
    const rit = { id: 3, start_date_local: "2026-06-01T10:00:00", moving_time: 3600, icu_weighted_avg_watts: 140, icu_efficiency_factor: null };
    expect(await verwerkRitVoorEf(kv, "u1", rit, FTP)).toBeNull();
  });

  it("dedupet op activityId — tweede aanroep voor dezelfde rit voegt niets toe", async () => {
    const rit = { id: 4, start_date_local: "2026-06-01T10:00:00", moving_time: 3600, icu_weighted_avg_watts: 140, icu_efficiency_factor: 1.23 };
    await verwerkRitVoorEf(kv, "u1", rit, FTP);
    const tweede = await verwerkRitVoorEf(kv, "u1", rit, FTP);
    expect(tweede).toBeNull();
    const reeks = await kv.get("ef_trend:u1:z2");
    expect(reeks).toHaveLength(1);
  });

  it("drempelrit (IF ~0.97) komt in de drempel-band terecht", async () => {
    const rit = { id: 5, start_date_local: "2026-06-01T10:00:00", moving_time: 1200, icu_weighted_avg_watts: 194, icu_efficiency_factor: 1.4 };
    const band = await verwerkRitVoorEf(kv, "u1", rit, FTP);
    expect(band).toBe("drempel");
  });

  describe("E1: bestaande band-bepaling blijft ongewijzigd zonder segment_instorting-record", () => {
    it("geen segment_instorting-record (default null): gedraagt zich exact als vóór E1", async () => {
      const rit = { id: 100, start_date_local: "2026-06-01T10:00:00", moving_time: 3600, icu_weighted_avg_watts: 140, icu_efficiency_factor: 1.23 };
      const band = await verwerkRitVoorEf(kv, "u1", rit, FTP);
      expect(band).toBe("z2");
      expect(await kv.get("ef_trend:u1:z2")).toEqual([{ datum: "2026-06-01", ef: 1.23, activityId: 100 }]);
    });

    it("segment_instorting-record met mogelijkIngestort:false, waarschijnlijkIngestort:false: geen wijziging", async () => {
      await kv.set("segment_instorting:u1:101", { mogelijkIngestort: false, waarschijnlijkIngestort: false });
      const rit = { id: 101, start_date_local: "2026-06-01T10:00:00", moving_time: 3600, icu_weighted_avg_watts: 140, icu_efficiency_factor: 1.23 };
      const band = await verwerkRitVoorEf(kv, "u1", rit, FTP);
      expect(band).toBe("z2");
    });
  });

  describe("E1: skip bij mogelijkIngestort/waarschijnlijkIngestort", () => {
    it("mogelijkIngestort:true skipt de EF-datapunt-toevoeging, geen wijziging aan de rest van de functie", async () => {
      await kv.set("segment_instorting:u1:200", { mogelijkIngestort: true, waarschijnlijkIngestort: false });
      const rit = { id: 200, start_date_local: "2026-06-01T10:00:00", moving_time: 3600, icu_weighted_avg_watts: 140, icu_efficiency_factor: 1.23 };
      expect(await verwerkRitVoorEf(kv, "u1", rit, FTP)).toBeNull();
      expect(await kv.get("ef_trend:u1:z2")).toBeNull();
    });

    it("waarschijnlijkIngestort:true skipt eveneens", async () => {
      await kv.set("segment_instorting:u1:201", { mogelijkIngestort: true, waarschijnlijkIngestort: true });
      const rit = { id: 201, start_date_local: "2026-06-01T10:00:00", moving_time: 3600, icu_weighted_avg_watts: 140, icu_efficiency_factor: 1.23 };
      expect(await verwerkRitVoorEf(kv, "u1", rit, FTP)).toBeNull();
      expect(await kv.get("ef_trend:u1:z2")).toBeNull();
    });
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
