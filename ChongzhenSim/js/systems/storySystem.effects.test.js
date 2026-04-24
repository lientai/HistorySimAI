import { describe, expect, it, vi } from "vitest";

vi.mock("../layout.js", () => ({
  updateMinisterTabBadge: vi.fn(),
}));

vi.mock("../router.js", () => ({
  router: {
    registerView: vi.fn(),
    refreshDesktopCourtAndNation: vi.fn(),
  },
}));

import { sanitizeStoryEffects } from "../api/validators.js";
import { applyEffects } from "../utils/effectsProcessor.js";
import { computeEffectDelta, estimateEffectsFromEdict } from "./storySystem.js";

describe("story numeric effect normalization", () => {
  it("normalizes structured choice resource fields into unified treasury and grain settlement", () => {
    const rawEffects = {
      nation: { treasury: 10000, grain: -2000 },
      silver: 5000,
      粮储: 3000,
    };
    const normalized = sanitizeStoryEffects(rawEffects);

    expect(normalized).toEqual(expect.objectContaining({
      treasury: 15000,
      grain: 1000,
    }));

    const result = applyEffects({ treasury: 500000, grain: 30000 }, normalized, {});
    expect(result.nation.treasury).toBe(515000);
    expect(result.nation.grain).toBe(31000);
  });

  it("normalizes extended money and grain aliases through the same global settlement path", () => {
    const rawEffects = {
      nation: { treasury: 10000, grain: -2000 },
      银两: 7000,
      现银: 3000,
      漕粮: 6000,
      存粮: -1000,
    };
    const normalized = sanitizeStoryEffects(rawEffects);

    expect(normalized).toEqual(expect.objectContaining({
      treasury: 20000,
      grain: 3000,
    }));

    const result = applyEffects({ treasury: 500000, grain: 30000 }, normalized, {});
    expect(result.nation.treasury).toBe(520000);
    expect(result.nation.grain).toBe(33000);
  });

  it("parses realistic edict text resource amounts into treasury and grain deltas", () => {
    const estimated = estimateEffectsFromEdict("即刻发帑白银八万两，起运漕粮二万石，以赈关中军民");

    expect(estimated).toEqual(expect.objectContaining({
      treasury: -80000,
      grain: -20000,
    }));
  });

  it("computes correction delta from nested and aliased resource fields consistently", () => {
    const delta = computeEffectDelta(
      { nation: { treasury: 12000, grain: -5000 }, silver: 3000 },
      { treasury: 10000, 漕粮: -2000 }
    );

    expect(delta).toEqual(expect.objectContaining({
      treasury: -5000,
      grain: 3000,
    }));
  });
});