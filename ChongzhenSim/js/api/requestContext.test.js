import { describe, expect, it } from "vitest";
import { buildStoryRequestBody } from "./requestContext.js";
import { createDefaultRigidState, DEFAULT_RIGID_INITIAL, RIGID_MODE_ID } from "../rigid/config.js";

describe("buildStoryRequestBody", () => {
  it("includes rigid structured context for LLM while preserving classic shared fields", () => {
    const rigid = createDefaultRigidState(DEFAULT_RIGID_INITIAL);
    rigid.lastDecision = { id: "rigid_relief_refugees", text: "开仓赈济" };
    rigid.lastOutput = {
      modules: [
        { id: 2, title: "叙事正文", lines: ["局势危急"] },
        { id: 7, title: "暗杀风险监控", lines: ["风险上升"] },
      ],
    };
    rigid.memoryAnchors.push({ turn: 1, summary: "初登大宝" });

    const state = {
      mode: RIGID_MODE_ID,
      currentDay: 1,
      currentPhase: "morning",
      currentMonth: 8,
      currentYear: 1,
      nation: { treasury: 300000 },
      appointments: {},
      characterStatus: {},
      prestige: 50,
      executionRate: 70,
      currentQuarterAgenda: [],
      currentQuarterFocus: null,
      customPolicies: [],
      hostileForces: [],
      closedStorylines: [],
      playerAbilities: {},
      unlockedPolicies: [],
      storyFacts: { headline: "test" },
      config: { gameplayMode: RIGID_MODE_ID },
      rigid,
    };

    const body = buildStoryRequestBody(state, { id: "foo", text: "bar" });

    expect(body.storyFacts).toEqual({ headline: "test" });
    expect(body.rigid.calendar).toEqual(rigid.calendar);
    expect(body.rigid.latestMemoryAnchor?.summary).toBe("初登大宝");
    expect(body.rigid.lastOutputModules).toHaveLength(2);
    expect(body.rigid.lastOutputModules[0].title).toBe("叙事正文");
    expect(body.lastChoiceText).toBe("bar");
  });
});
