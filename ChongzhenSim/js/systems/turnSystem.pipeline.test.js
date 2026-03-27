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

vi.mock("./coreGameplaySystem.js", () => ({
  applyProgressionToChoiceEffects: vi.fn((effects) => effects),
  extractCustomPoliciesFromEdict: vi.fn(() => []),
  mergeCustomPolicies: vi.fn((existing) => existing || []),
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
  deriveAppointmentEffectsFromText: vi.fn(() => null),
  normalizeAppointmentEffects: vi.fn((effects) => effects),
}));

vi.mock("./kejuSystem.js", () => ({
  getKejuStateSnapshot: vi.fn(() => ({ stage: "idle" })),
  getWujuStateSnapshot: vi.fn(() => ({ stage: "idle" })),
  advanceKejuSession: vi.fn((snapshot) => snapshot),
  advanceWujuSession: vi.fn((snapshot) => snapshot),
  resetKejuForNextCycle: vi.fn((snapshot) => snapshot),
  resetWujuForNextCycle: vi.fn((snapshot) => snapshot),
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

  it("completes one rigid-mode turn loop through shared story entry", async () => {
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
    expect(mocked.runRigidTurnMock).toHaveBeenCalled();
    expect(mocked.computeRigidSettlementDeltaMock).toHaveBeenCalled();
    expect(state.lastChoiceId).toBe("rigid_relief_refugees");
    expect(state.rigid?.lastSettlementDelta?.rigidRefuteTimes).toBe(1);
    expect(mocked.renderStoryTurnMock).toHaveBeenCalled();
  });
});
