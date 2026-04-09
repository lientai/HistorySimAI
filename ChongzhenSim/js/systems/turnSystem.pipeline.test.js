import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  renderStoryTurnMock: vi.fn(),
  pushCurrentTurnToHistoryMock: vi.fn(),
  applyEffectsMock: vi.fn(),
  computeQuarterlyEffectsMock: vi.fn(() => null),
  estimateEffectsFromEdictMock: vi.fn(() => null),
  ensureRigidStateMock: vi.fn((state) => ({
    rigid: {
      ...(state.rigid || {}),
      calendar: { year: 1627, month: 8, turn: 1 },
      court: {
        ...(state.rigid?.court || {}),
        strikeState: false,
      },
    },
  })),
  runRigidTurnMock: vi.fn((state, payload) => ({
    rejected: false,
    message: "rigid turn ok",
    statePatch: {
      rigid: {
        ...(state.rigid || {}),
        calendar: { year: 1627, month: 11, turn: 2 },
        court: {
          ...(state.rigid?.court || {}),
          strikeState: false,
        },
      },
      currentYear: 1,
      currentMonth: 11,
      currentPhase: "morning",
    },
    payload,
  })),
  computeRigidSettlementDeltaMock: vi.fn(() => ({ rigidRefuteTimes: 1 })),
  deriveAppointmentEffectsFromTextMock: vi.fn(() => null),
  normalizeAppointmentEffectsMock: vi.fn((effects) => effects),
}));

vi.mock("./storySystem.js", () => ({
  renderStoryTurn: mocked.renderStoryTurnMock,
  pushCurrentTurnToHistory: mocked.pushCurrentTurnToHistoryMock,
  applyEffects: mocked.applyEffectsMock,
  computeQuarterlyEffects: mocked.computeQuarterlyEffectsMock,
  estimateEffectsFromEdict: mocked.estimateEffectsFromEdictMock,
}));

vi.mock("../storage.js", () => ({
  autoSaveIfEnabled: vi.fn(),
}));

vi.mock("../layout.js", () => ({
  updateTopbarByState: vi.fn(),
}));

vi.mock("../router.js", () => ({
  router: {
    refreshDesktopCourtAndNation: vi.fn(),
  },
}));

vi.mock("./coreGameplaySystem.js", () => ({
  applyProgressionToChoiceEffects: vi.fn((effects) => effects),
  extractCustomPoliciesFromEdict: vi.fn(() => []),
  mergeCustomPolicies: vi.fn((existing, newlyFound) => [...(existing || []), ...(newlyFound || [])]),
  processCoreGameplayTurn: vi.fn(() => ({ statePatch: {}, consequenceEffects: null })),
  refreshQuarterAgendaByState: vi.fn(() => ({})),
  resolveHostileForcesAfterChoice: vi.fn(() => null),
  scaleEffectsByExecution: vi.fn((effects) => effects),
}));

vi.mock("../api/validators.js", () => ({
  sanitizeStoryEffects: vi.fn((effects) => effects),
}));

vi.mock("../dataLoader.js", () => ({
  loadJSON: vi.fn(async () => ({ positions: [], departments: [] })),
}));

vi.mock("../utils/displayStateMetrics.js", () => ({
  captureDisplayStateSnapshot: vi.fn(() => ({})),
  buildOutcomeDisplayDelta: vi.fn(() => ({})),
}));

vi.mock("../utils/appointmentEffects.js", () => ({
  deriveAppointmentEffectsFromText: mocked.deriveAppointmentEffectsFromTextMock,
  normalizeAppointmentEffects: mocked.normalizeAppointmentEffectsMock,
}));

vi.mock("./kejuSystem.js", () => ({
  getKejuStateSnapshot: vi.fn((state) => ({
    stage: state?.keju?.stage || "idle",
    candidatePool: state?.keju?.candidatePool || [],
    publishedList: state?.keju?.publishedList || [],
    talentReserve: state?.keju?.talentReserve || [],
    generatedCandidates: state?.keju?.generatedCandidates || [],
    bureauMomentum: state?.keju?.bureauMomentum ?? 52,
    reserveQuality: state?.keju?.reserveQuality ?? 0,
    note: state?.keju?.note || "",
  })),
  getWujuStateSnapshot: vi.fn((state) => ({
    stage: state?.wuju?.stage || "idle",
    candidatePool: state?.wuju?.candidatePool || [],
    publishedList: state?.wuju?.publishedList || [],
    talentReserve: state?.wuju?.talentReserve || [],
    generatedCandidates: state?.wuju?.generatedCandidates || [],
    bureauMomentum: state?.wuju?.bureauMomentum ?? 50,
    reserveQuality: state?.wuju?.reserveQuality ?? 0,
    note: state?.wuju?.note || "",
  })),
  advanceKejuSession: vi.fn((snapshot) => snapshot),
  advanceWujuSession: vi.fn((snapshot) => snapshot),
  resetKejuForNextCycle: vi.fn((snapshot, note) => ({
    ...snapshot,
    stage: "idle",
    candidatePool: [],
    publishedList: [],
    generatedCandidates: [],
    reserveQuality: 0,
    note,
  })),
  resetWujuForNextCycle: vi.fn((snapshot, note) => ({
    ...snapshot,
    stage: "idle",
    candidatePool: [],
    publishedList: [],
    generatedCandidates: [],
    reserveQuality: 0,
    note,
  })),
}));

vi.mock("../utils/storyFacts.js", () => ({
  buildStoryFactsFromState: vi.fn(() => ({ phase: "test" })),
}));

vi.mock("../rigid/engine.js", () => ({
  ensureRigidState: mocked.ensureRigidStateMock,
  runRigidTurn: mocked.runRigidTurnMock,
}));

vi.mock("../rigid/settlement.js", () => ({
  computeRigidSettlementDelta: mocked.computeRigidSettlementDeltaMock,
}));

import { getState, resetState, setState } from "../state.js";
import { runCurrentTurn } from "./turnSystem.js";
import { extractCustomPoliciesFromEdict, resolveHostileForcesAfterChoice } from "./coreGameplaySystem.js";

describe("turnSystem dual-mode one-turn loop", () => {
  beforeEach(() => {
    resetState();
    mocked.renderStoryTurnMock.mockReset();
    mocked.pushCurrentTurnToHistoryMock.mockReset();
    mocked.applyEffectsMock.mockReset();
    mocked.computeQuarterlyEffectsMock.mockClear();
    mocked.ensureRigidStateMock.mockClear();
    mocked.runRigidTurnMock.mockClear();
    mocked.computeRigidSettlementDeltaMock.mockClear();
    mocked.deriveAppointmentEffectsFromTextMock.mockClear();
    mocked.normalizeAppointmentEffectsMock.mockClear();

    const main = document.createElement("div");
    main.id = "main-view";
    document.body.innerHTML = "";
    document.body.appendChild(main);
  });

  it("completes one classic-mode turn loop", async () => {
    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("classic_choice", "整饬吏治", null, { nation: { treasury: 1200 } });
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    const state = getState();
    expect(state.lastChoiceId).toBe("classic_choice");
    expect(state.currentMonth).toBe(5);
    expect(state.currentYear).toBe(3);
    expect(mocked.pushCurrentTurnToHistoryMock).toHaveBeenCalled();
    expect(mocked.renderStoryTurnMock).toHaveBeenCalled();
  });

  it("applies estimated treasury and grain effects for custom edict in classic mode", async () => {
    mocked.estimateEffectsFromEdictMock.mockReturnValueOnce({
      treasury: 200000,
      grain: 30000,
    });

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("custom_edict", "抄没入库20万两，拨粮3万石赈济", null, null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    expect(mocked.estimateEffectsFromEdictMock).toHaveBeenCalled();
    expect(mocked.applyEffectsMock).toHaveBeenCalledWith(expect.objectContaining({
      treasury: 200000,
      grain: 30000,
    }));
  });

  it("completes one shared turn loop while rigid mode flag is enabled", async () => {
    setState({
      mode: "rigid_v1",
      config: { ...(getState().config || {}), gameplayMode: "rigid_v1", storyMode: "template", apiBase: "" },
    });

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("rigid_relief_refugees", "赈济流民", null, null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    const state = getState();
    expect(state.lastChoiceId).toBe("rigid_relief_refugees");
    expect(state.currentMonth).toBe(5);
    expect(state.currentYear).toBe(3);
    expect(state.currentQuarterAgenda).toEqual([]);
    expect(state.currentQuarterFocus).toBeNull();
    expect(mocked.runRigidTurnMock).not.toHaveBeenCalled();
    expect(mocked.computeRigidSettlementDeltaMock).not.toHaveBeenCalled();
    expect(mocked.computeQuarterlyEffectsMock).not.toHaveBeenCalled();
    expect(mocked.renderStoryTurnMock).toHaveBeenCalled();
  });

  it("clears stale quarterly state instead of reusing it in rigid mode", async () => {
    setState({
      mode: "rigid_v1",
      config: { ...(getState().config || {}), gameplayMode: "rigid_v1", storyMode: "template", apiBase: "" },
      currentMonth: 6,
      currentQuarterAgenda: [{ id: "legacy", title: "旧季度议题" }],
      currentQuarterFocus: { agendaId: "legacy", stance: "support", factionId: "scholar" },
      lastQuarterSettlement: { year: 3, month: 6, effects: { treasury: 1000 } },
    });

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("rigid_choice_dynamic", "照旧处置朝务", null, null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    const state = getState();
    expect(state.currentQuarterAgenda).toEqual([]);
    expect(state.currentQuarterFocus).toBeNull();
    expect(state.lastQuarterSettlement).toBeNull();
    expect(mocked.computeQuarterlyEffectsMock).not.toHaveBeenCalled();
  });

  it("applies derived appointment effects in rigid mode", async () => {
    setState({
      mode: "rigid_v1",
      config: { ...(getState().config || {}), gameplayMode: "rigid_v1", storyMode: "template", apiBase: "" },
    });

    mocked.deriveAppointmentEffectsFromTextMock.mockReturnValueOnce({
      appointments: { libu_shangshu: "minister_a" },
      appointmentDismissals: [],
    });

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("rigid_choice_dynamic", "任命甲为吏部尚书", null, null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    expect(mocked.deriveAppointmentEffectsFromTextMock).toHaveBeenCalled();
    expect(mocked.applyEffectsMock).toHaveBeenCalledWith(expect.objectContaining({
      appointments: expect.objectContaining({ libu_shangshu: "minister_a" }),
    }));
  });

  it("adds custom policy in rigid mode when custom edict defines one", async () => {
    setState({
      mode: "rigid_v1",
      config: { ...(getState().config || {}), gameplayMode: "rigid_v1", storyMode: "template", apiBase: "" },
    });

    vi.mocked(extractCustomPoliciesFromEdict).mockReturnValueOnce([
      {
        id: "custom_policy_test",
        name: "测试新策",
        category: "general",
        createdYear: 1,
        createdMonth: 8,
      },
    ]);

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("custom_edict", "设立测试新策，定为国策", null, null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    const state = getState();
    expect(Array.isArray(state.customPolicies)).toBe(true);
    expect(state.customPolicies.some((item) => item.id === "custom_policy_test")).toBe(true);
  });

  it("applies estimated treasury and grain effects for custom edict in rigid mode", async () => {
    setState({
      mode: "rigid_v1",
      config: { ...(getState().config || {}), gameplayMode: "rigid_v1", storyMode: "template", apiBase: "" },
    });

    mocked.estimateEffectsFromEdictMock.mockReturnValueOnce({
      treasury: -300000,
      grain: -50000,
    });

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("custom_edict", "拨银30万两，开仓5万石赈济", "国库与粮仓同步调度", null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    expect(mocked.estimateEffectsFromEdictMock).toHaveBeenCalled();
    expect(mocked.applyEffectsMock).toHaveBeenCalledWith(expect.objectContaining({
      treasury: -300000,
      grain: -50000,
    }));
  });

  it("resolves hostile forces in rigid mode for military expansion choices", async () => {
    setState({
      mode: "rigid_v1",
      config: { ...(getState().config || {}), gameplayMode: "rigid_v1", storyMode: "template", apiBase: "" },
      hostileForces: [
        { id: "rebel_1", name: "流寇残部", leader: "张某", power: 62, isDefeated: false },
      ],
    });

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("rigid_choice_dynamic", "调集边军开拓战线，重点围剿流寇残部", null, null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    expect(resolveHostileForcesAfterChoice).toHaveBeenCalled();
  });

  it("resets published keju and wuju state on month advance", async () => {
    setState({
      keju: {
        stage: "published",
        candidatePool: [{ id: "keju_a" }],
        publishedList: [{ id: "keju_a" }],
        talentReserve: [{ candidateId: "legacy_keju" }],
        generatedCandidates: [{ id: "keju_g" }],
        bureauMomentum: 64,
        reserveQuality: 90,
        note: "金榜已张",
      },
      wuju: {
        stage: "published",
        candidatePool: [{ id: "wuju_a" }],
        publishedList: [{ id: "wuju_a" }],
        talentReserve: [{ candidateId: "legacy_wuju" }],
        generatedCandidates: [{ id: "wuju_g" }],
        bureauMomentum: 58,
        reserveQuality: 92,
        note: "武举放榜",
      },
    });

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("classic_choice", "整饬吏治", null, null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    const state = getState();
    expect(state.keju.stage).toBe("idle");
    expect(state.keju.candidatePool).toEqual([]);
    expect(state.keju.publishedList).toEqual([]);
    expect(state.keju.generatedCandidates).toEqual([]);
    expect(state.keju.talentReserve).toEqual([{ candidateId: "legacy_keju" }]);
    expect(state.keju.reserveQuality).toBe(0);
    expect(state.wuju.stage).toBe("idle");
    expect(state.wuju.candidatePool).toEqual([]);
    expect(state.wuju.publishedList).toEqual([]);
    expect(state.wuju.generatedCandidates).toEqual([]);
    expect(state.wuju.talentReserve).toEqual([{ candidateId: "legacy_wuju" }]);
    expect(state.wuju.reserveQuality).toBe(0);
  });

  it("applies hostile storyline closure patch in rigid mode without fabricating memory anchors", async () => {
    setState({
      mode: "rigid_v1",
      config: { ...(getState().config || {}), gameplayMode: "rigid_v1", storyMode: "template", apiBase: "" },
      hostileForces: [
        { id: "rebel_1", name: "流寇残部", leader: "张某", power: 6, isDefeated: false, storylineTag: "流寇残部_线" },
      ],
      closedStorylines: [],
    });

    vi.mocked(resolveHostileForcesAfterChoice).mockReturnValueOnce({
      statePatch: {
        hostileForces: [
          { id: "rebel_1", name: "流寇残部", leader: "张某", power: 0, isDefeated: true, storylineTag: "流寇残部_线" },
        ],
        closedStorylines: ["流寇残部_线"],
        systemNewsToday: [],
      },
      effectsPatch: null,
      prestigeDelta: 0,
    });

    let choiceTriggered = false;
    mocked.renderStoryTurnMock.mockImplementation(async (_state, _container, onChoice) => {
      if (!choiceTriggered) {
        choiceTriggered = true;
        await onChoice("rigid_choice_dynamic", "出师围剿流寇残部", null, null);
      }
      return { choices: [] };
    });

    const container = document.getElementById("main-view");
    await runCurrentTurn(container);

    const state = getState();
    expect(state.closedStorylines).toContain("流寇残部_线");
    expect(Array.isArray(state.rigid?.memoryAnchors)).toBe(true);
    expect(state.rigid.memoryAnchors).toEqual([]);
    expect(state.hostileForces[0]?.isDefeated).toBe(true);
  });
});
