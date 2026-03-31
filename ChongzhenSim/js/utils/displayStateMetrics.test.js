import { describe, expect, it } from "vitest";
import {
  DISPLAY_STATE_LABELS,
  buildOutcomeDisplayEntries,
  buildOutcomeDisplayDelta,
  captureDisplayStateSnapshot,
  formatDisplayMetricValue,
  getDisplayMetricsBySection,
  mergeOutcomeDisplayDelta,
} from "./displayStateMetrics.js";

describe("displayStateMetrics", () => {
  it("should expose nation and governance metrics aligned with nation view", () => {
    expect(getDisplayMetricsBySection("nation").map((item) => item.key)).toEqual([
      "treasury",
      "grain",
      "militaryStrength",
      "civilMorale",
      "borderThreat",
      "disasterLevel",
      "corruptionLevel",
    ]);
    expect(getDisplayMetricsBySection("governance").map((item) => item.key)).toEqual([
      "prestige",
      "executionRate",
      "partyStrife",
      "unrest",
      "taxPressure",
    ]);
    expect(DISPLAY_STATE_LABELS.taxPressure).toBe("税压");
  });

  it("should format display metric values consistently", () => {
    const state = {
      nation: { treasury: 500000, grain: 30000 },
      executionRate: 72,
    };
    expect(formatDisplayMetricValue(state, "treasury")).toBe("500,000两");
    expect(formatDisplayMetricValue(state, "grain")).toBe("30,000石");
    expect(formatDisplayMetricValue(state, "executionRate")).toBe("72%");
  });

  it("should build outcome delta from aligned state snapshots", () => {
    const before = captureDisplayStateSnapshot({
      nation: { treasury: 500000, civilMorale: 35 },
      prestige: 58,
      loyalty: { bi_ziyan: 50 },
      appointments: { hubu_shangshu: "bi_ziyan" },
      characterStatus: {},
    });
    const after = captureDisplayStateSnapshot({
      nation: { treasury: 520000, civilMorale: 38 },
      prestige: 61,
      loyalty: { bi_ziyan: 52 },
      appointments: { libu_shangshu: "bi_ziyan" },
      characterStatus: { wen_tiren: { isAlive: false, deathReason: "处死" } },
    });

    const delta = buildOutcomeDisplayDelta(before, after);
    expect(delta.treasury).toBe(20000);
    expect(delta.civilMorale).toBe(3);
    expect(delta.prestige).toBe(3);
    expect(delta.loyalty.bi_ziyan).toBe(2);
    expect(delta.appointments).toEqual({ libu_shangshu: "bi_ziyan" });
    expect(delta.appointmentDismissals).toEqual(["hubu_shangshu"]);
    expect(delta.characterDeath).toEqual({ wen_tiren: "处死" });
  });

  it("should merge correction delta into existing display delta", () => {
    const merged = mergeOutcomeDisplayDelta(
      { treasury: 10000, prestige: 2, loyalty: { bi_ziyan: 1 } },
      { treasury: 5000, prestige: -1, loyalty: { bi_ziyan: 2 } }
    );

    expect(merged.treasury).toBe(15000);
    expect(merged.prestige).toBe(1);
    expect(merged.loyalty.bi_ziyan).toBe(3);
  });

  it("should build unified display entries for numeric and text effects", () => {
    const entries = buildOutcomeDisplayEntries(
      {
        treasury: 120000,
        borderThreat: -4,
        loyalty: { bi_ziyan: 2 },
        appointments: { libu_shangshu: "bi_ziyan" },
        appointmentDismissals: ["hubu_shangshu"],
        characterDeath: { wen_tiren: "处死" },
      },
      {
        ministers: [
          { id: "bi_ziyan", name: "毕自严" },
          { id: "wen_tiren", name: "温体仁" },
        ],
        positionsMeta: {
          positions: [
            { id: "libu_shangshu", name: "吏部尚书" },
            { id: "hubu_shangshu", name: "户部尚书" },
          ],
        },
      }
    );

    expect(entries.find((item) => item.label === "国库")?.value).toBe(120000);
    expect(entries.find((item) => item.label === "边患")?.invertColor).toBe(true);
    expect(entries.find((item) => item.label === "毕自严 忠诚")?.value).toBe(2);
    expect(entries.find((item) => item.label === "任命 毕自严 -> 吏部尚书")?.type).toBe("text");
    expect(entries.find((item) => item.label === "免去 户部尚书")?.value).toBe("已生效");
    expect(entries.find((item) => item.label === "处置 温体仁")?.value).toBe("处死");
  });
});