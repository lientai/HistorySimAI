import { describe, it, expect } from "vitest";
import { RIGID_MODE_ID, createDefaultRigidState, DEFAULT_RIGID_INITIAL, DEFAULT_RIGID_TRIGGERS } from "./config.js";
import { computeAssassinateRisk, enforceRigidFloors } from "./mechanisms.js";
import { runRigidTurn } from "./engine.js";

function buildState() {
  return {
    mode: RIGID_MODE_ID,
    config: {
      gameplayMode: RIGID_MODE_ID,
      rigid: {
        initialState: DEFAULT_RIGID_INITIAL,
        triggers: {
          ...DEFAULT_RIGID_TRIGGERS,
          strikeThreshold: 999,
          strikeLevels: [
            { level: 1, triggerResistance: 999, releaseResistance: 980, releaseTurns: 1 },
            { level: 2, triggerResistance: 999, releaseResistance: 970, releaseTurns: 1 },
            { level: 3, triggerResistance: 999, releaseResistance: 960, releaseTurns: 1 },
          ],
        },
        historyEvents: [],
      },
    },
    currentDay: 1,
    currentMonth: 8,
    currentYear: 1,
    currentPhase: "morning",
    systemNewsToday: [],
    weather: "晴",
    rigid: createDefaultRigidState(DEFAULT_RIGID_INITIAL),
  };
}

describe("rigid mechanisms", () => {
  it("computes assassinate risk by fixed formula", () => {
    const risk = computeAssassinateRisk({ scholar: 50, general: 20, eunuch: 10, royal: 10, people: 10 });
    expect(risk).toBeCloseTo(24, 5);
  });

  it("applies hard floors", () => {
    const rigid = createDefaultRigidState(DEFAULT_RIGID_INITIAL);
    rigid.court.resistance = 1;
    rigid.court.factionFight = 1;
    rigid.chongZhen.anxiety = 1;
    enforceRigidFloors(rigid, DEFAULT_RIGID_TRIGGERS);
    expect(rigid.court.resistance).toBe(15);
    expect(rigid.court.factionFight).toBe(20);
    expect(rigid.chongZhen.anxiety).toBe(20);
  });

  it("guarantees at least one refute increment every turn", () => {
    const state = buildState();
    const beforeRefuteTimes = state.rigid.court.refuteTimes;
    const result = runRigidTurn(state, {
      choiceId: "rigid_relief_refugees",
      choiceText: "测试封驳兜底",
    });
    expect(result.statePatch.rigid.court.refuteTimes).toBeGreaterThanOrEqual(beforeRefuteTimes + 1);
  });

  it("blocks decision when strike state is active", () => {
    const state = buildState();
    state.rigid.court.strikeState = true;
    const result = runRigidTurn(state, {
      choiceId: "rigid_relief_refugees",
      choiceText: "开仓赈济",
    });
    expect(result.rejected).toBe(true);
  });

  it("simulates 20 turns without module loss", () => {
    let state = buildState();
    for (let i = 0; i < 20; i += 1) {
      const result = runRigidTurn(state, {
        choiceId: i % 2 === 0 ? "rigid_rectify_military_pay" : "rigid_relief_refugees",
        choiceText: "测试推演",
      });
      expect(result.statePatch?.rigid?.lastOutput?.modules?.length).toBe(8);
      state = {
        ...state,
        ...result.statePatch,
      };
    }
    expect(state.rigid.memoryAnchors.length).toBe(20);
  });

  it("applies distrust decay every 3 turns", () => {
    const state = buildState();
    state.rigid.calendar.turn = 3;
    const beforeDistrust = state.rigid.chongZhen.distrust;
    const result = runRigidTurn(state, {
      choiceId: "rigid_streamline_officials",
      choiceText: "裁撤冗员",
    });
    const afterDistrust = result.statePatch.rigid.chongZhen.distrust;
    expect(afterDistrust).toBeGreaterThan(beforeDistrust);
  });

  it("forces branch selection when a due history event has branches", () => {
    const state = buildState();
    state.config.rigid.historyEvents = [
      {
        id: "branch_event",
        name: "测试分支事件",
        trigger: { year: 1627, month: 8 },
        impact: { court: { resistance: 1 } },
        branches: [
          { id: "a", name: "分支A", impact: { court: { authority: 2 } } },
          { id: "b", name: "分支B", impact: { court: { authority: -2 } } },
        ],
      },
    ];

    const first = runRigidTurn(state, {
      choiceId: "rigid_relief_refugees",
      choiceText: "触发分支",
    });
    expect(first.statePatch.rigid.pendingBranchEvent?.id).toBe("branch_event");

    const blocked = runRigidTurn(
      { ...state, ...first.statePatch },
      { choiceId: "rigid_streamline_officials", choiceText: "跳过分支" }
    );
    expect(blocked.rejected).toBe(true);

    const resolved = runRigidTurn(
      { ...state, ...first.statePatch },
      { choiceId: "rigid_branch_a", choiceText: "选择分支A" }
    );
    expect(resolved.rejected).toBe(false);
    expect(resolved.statePatch.rigid.pendingBranchEvent).toBeNull();
  });

  it("applies coupled state changes (anxiety->insomnia, food crisis->rebel scale)", () => {
    const state = buildState();
    state.rigid.chongZhen.anxiety = 60;
    state.rigid.other.foodCrisis = 70;
    const beforeInsomnia = state.rigid.chongZhen.insomnia;
    const beforeRebel = state.rigid.military.rebelScale;
    const result = runRigidTurn(state, {
      choiceId: "rigid_relief_refugees",
      choiceText: "联动校验",
    });
    expect(result.statePatch.rigid.chongZhen.insomnia).toBeGreaterThan(beforeInsomnia);
    expect(result.statePatch.rigid.military.rebelScale).toBeGreaterThanOrEqual(beforeRebel);
  });

  it("forces assassination follow-up handling when pending", () => {
    const state = buildState();
    state.rigid.pendingAssassinate = true;

    const blocked = runRigidTurn(state, {
      choiceId: "rigid_relief_refugees",
      choiceText: "先做其他决策",
    });
    expect(blocked.rejected).toBe(true);

    const resolved = runRigidTurn(state, {
      choiceId: "rigid_assassinate_suppress",
      choiceText: "压案处理",
    });
    expect(resolved.rejected).toBe(false);
    expect(resolved.statePatch.rigid.pendingAssassinate).toBe(false);
  });

  it("supports strike level progression and staged release via recovery action", () => {
    const state = buildState();
    state.config.rigid.triggers = {
      ...DEFAULT_RIGID_TRIGGERS,
      strikeLevels: [
        { level: 1, triggerResistance: 80, releaseResistance: 75, releaseTurns: 1 },
        { level: 2, triggerResistance: 90, releaseResistance: 70, releaseTurns: 1 },
        { level: 3, triggerResistance: 96, releaseResistance: 65, releaseTurns: 1 },
      ],
    };
    state.rigid.court.resistance = 97;

    const enter = runRigidTurn(state, {
      choiceId: "rigid_relief_refugees",
      choiceText: "触发罢朝",
    });
    expect(enter.statePatch.rigid.court.strikeState).toBe(true);
    expect(enter.statePatch.rigid.strikeLevel).toBe(3);

    const recover1 = runRigidTurn(
      { ...state, ...enter.statePatch },
      { choiceId: "rigid_strike_recover", choiceText: "复朝处置一" }
    );
    expect(recover1.rejected).toBe(false);
    expect(recover1.statePatch.rigid.strikeLevel).toBe(2);

    const recover2 = runRigidTurn(
      { ...state, ...recover1.statePatch },
      { choiceId: "rigid_strike_recover", choiceText: "复朝处置二" }
    );
    expect(recover2.statePatch.rigid.strikeLevel).toBe(1);

    const recover3 = runRigidTurn(
      { ...state, ...recover2.statePatch },
      { choiceId: "rigid_strike_recover", choiceText: "复朝处置三" }
    );
    expect(recover3.statePatch.rigid.court.strikeState).toBe(false);
    expect(recover3.statePatch.rigid.strikeLevel).toBe(0);
  });

  it("blocks exact forbidden tech keywords in custom edict", () => {
    const state = buildState();
    const result = runRigidTurn(state, {
      choiceId: "custom_edict",
      choiceText: "试制蒸汽机以改漕运",
    });
    expect(result.rejected).toBe(true);
    expect(result.message).toContain("蒸汽机");
  });

  it("does not block partial non-matching keywords in custom edict", () => {
    const state = buildState();
    const result = runRigidTurn(state, {
      choiceId: "custom_edict",
      choiceText: "以蒸汽之急督漕运，不涉造机",
    });
    expect(result.rejected).toBe(false);
  });

  it("accepts unknown dynamic story choice instead of hard-blocking", () => {
    const state = buildState();
    const result = runRigidTurn(state, {
      choiceId: "story_choice_dynamic_a",
      choiceText: "先稳住局势，再择机整饬吏治",
    });
    expect(result.rejected).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.message).not.toContain("未知决策");
  });
});

