import { describe, expect, it } from "vitest";
import { resolveHostileForcesAfterChoice, scaleEffectsByExecution } from "./coreGameplaySystem.js";

function createBaseState() {
  return {
    hostileForces: [
      {
        id: "hostile_li_zicheng",
        name: "李自成",
        leader: "李自成",
        status: "活跃",
        level: "high",
        power: 70,
        isDefeated: false,
        storylineTag: "李自成_线",
      },
    ],
    nation: {
      borderThreat: 70,
      militaryStrength: 60,
    },
    unlockedPolicies: [],
    playerAbilities: { military: 0 },
    systemNewsToday: [],
    closedStorylines: [],
  };
}

describe("resolveHostileForcesAfterChoice", () => {
  it("should not infer hostile strike when non-military text only mentions hostile name", () => {
    const state = createBaseState();
    const out = resolveHostileForcesAfterChoice(
      state,
      "派使者与李自成议和并安置流民",
      {},
      3,
      5
    );

    expect(out).toBeNull();
  });

  it("should infer hostile strike when military intent is present", () => {
    const state = createBaseState();
    const out = resolveHostileForcesAfterChoice(
      state,
      "出师征讨李自成，围剿其部众",
      {},
      3,
      5
    );

    expect(out).not.toBeNull();
    expect(out.statePatch.hostileForces[0].power).toBeLessThan(70);
    expect(out.statePatch.systemNewsToday.some((item) => String(item.title || "").includes("军事开拓"))).toBe(true);
  });
});

describe("scaleEffectsByExecution", () => {
  it("should preserve appointment-related non-numeric effects", () => {
    const scaled = scaleEffectsByExecution(
      {
        appointments: { hubu_shangshu: "wen_tiren" },
        appointmentDismissals: ["neige_shoufu"],
        characterDeath: { wen_tiren: "处死" },
      },
      {
        prestige: 30,
        unlockedPolicies: [],
        playerAbilities: { politics: 0 },
      }
    );

    expect(scaled.appointments).toEqual({ hubu_shangshu: "wen_tiren" });
    expect(scaled.appointmentDismissals).toEqual(["neige_shoufu"]);
    expect(scaled.characterDeath).toEqual({ wen_tiren: "处死" });
  });

  it("should still scale numeric effects", () => {
    const scaled = scaleEffectsByExecution(
      {
        treasury: -100000,
        civilMorale: 10,
        appointments: { hubu_shangshu: "wen_tiren" },
      },
      {
        prestige: 30,
        unlockedPolicies: [],
        playerAbilities: { politics: 0 },
      }
    );

    expect(typeof scaled.treasury).toBe("number");
    expect(typeof scaled.civilMorale).toBe("number");
    expect(scaled.appointments).toEqual({ hubu_shangshu: "wen_tiren" });
  });
});
