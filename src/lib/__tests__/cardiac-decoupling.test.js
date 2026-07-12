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

import { cacheDecoupling, checkFaseOvergang } from "../decoupling.js";
import { getKV } from "../kv.js";

describe("cacheDecoupling", () => {
  const kv = getKV();
  beforeEach(() => kv._store.clear());

  it("rondt en cachet de door intervals.icu geleverde decoupling-waarde", async () => {
    const dc = await cacheDecoupling(1, 5.234);
    expect(dc).toBe(5.2);
    expect(await kv.get("decoupling:1")).toBe(5.2);
  });

  it("retourneert null zonder te cachen als intervals.icu geen waarde levert", async () => {
    const dc = await cacheDecoupling(2, null);
    expect(dc).toBeNull();
    expect(await kv.get("decoupling:2")).toBeNull();
  });

  it("hergebruikt een reeds gecachete waarde i.p.v. te overschrijven", async () => {
    await kv.set("decoupling:3", 9.9);
    const dc = await cacheDecoupling(3, 1.1);
    expect(dc).toBe(9.9);
  });
});

describe("checkFaseOvergang", () => {
  it("stelt fase-overgang uit bij mediaan > 7% en < 2 eerdere verlengingen", () => {
    const { uitstel, mediaan } = checkFaseOvergang([8, 9, 10]);
    expect(uitstel).toBe(true);
    expect(mediaan).toBe(9);
  });

  it("stelt niet uit als het verlengingsmaximum al bereikt is", () => {
    const { uitstel } = checkFaseOvergang([8, 9, 10], 2);
    expect(uitstel).toBe(false);
  });

  it("geen uitstel bij lage decoupling", () => {
    const { uitstel } = checkFaseOvergang([2, 3, 4]);
    expect(uitstel).toBe(false);
  });
});
