import { describe, expect, it } from "vitest";
import { initializeCoreGameplayState, processCoreGameplayTurn, resolveHostileForcesAfterChoice, scaleEffectsByExecution } from "./coreGameplaySystem.js";
import { RIGID_MODE_ID } from "../rigid/config.js";

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

describe("rigid mode quarter gating", () => {
  it("clears quarter agenda during core-state initialization", () => {
    const nextState = initializeCoreGameplayState(
      {
        mode: RIGID_MODE_ID,
        config: { gameplayMode: RIGID_MODE_ID },
        currentMonth: 6,
        currentQuarterAgenda: [{ id: "legacy", title: "旧季度议题" }],
        currentQuarterFocus: { agendaId: "legacy", stance: "support", factionId: "scholar" },
      },
      [],
      { gameplayMode: RIGID_MODE_ID, startMonth: 6 },
      {}
    );

    expect(nextState.currentQuarterAgenda).toEqual([]);
    expect(nextState.currentQuarterFocus).toBeNull();
  });

  it("does not issue quarter agenda or rewards during shared turn settlement", () => {
    const result = processCoreGameplayTurn(
      {
        ...createBaseState(),
        mode: RIGID_MODE_ID,
        config: { gameplayMode: RIGID_MODE_ID },
        currentYear: 1,
        currentMonth: 5,
        currentQuarterAgenda: [{ id: "legacy", title: "旧季度议题" }],
        currentQuarterFocus: { agendaId: "legacy", stance: "support", factionId: "scholar" },
        abilityPoints: 3,
        policyPoints: 2,
        appointments: {},
        characterStatus: {},
        factions: [],
        pendingConsequences: [],
        playerAbilities: { military: 0, politics: 0 },
      },
      "正常处理朝务",
      {},
      1,
      6
    );

    expect(result.statePatch.currentQuarterAgenda).toEqual([]);
    expect(result.statePatch.currentQuarterFocus).toBeNull();
    expect(result.statePatch.abilityPoints).toBe(3);
    expect(result.statePatch.policyPoints).toBe(2);
    expect(result.statePatch.systemNewsToday.some((item) => String(item.title || "").includes("季度奏折"))).toBe(false);
    expect(result.statePatch.systemNewsToday.some((item) => String(item.title || "").includes("皇权成长"))).toBe(false);
  });
});
