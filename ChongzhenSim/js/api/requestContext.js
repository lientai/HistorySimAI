import { getPolicyCatalog } from "../systems/coreGameplaySystem.js";
import { buildStoryFactsFromState } from "../utils/storyFacts.js";
import { isRigidMode } from "../rigid/config.js";

const POLICY_TITLE_BY_ID = new Map(
  getPolicyCatalog().map((item) => [String(item.id || ""), String(item.title || item.id || "")])
);

function setOptionalArray(target, key, value, { requireNonEmpty = false } = {}) {
  if (!Array.isArray(value)) return;
  if (requireNonEmpty && value.length === 0) return;
  target[key] = value;
}

function setOptionalObject(target, key, value) {
  if (!value || typeof value !== "object") return;
  target[key] = value;
}

function resolveUnlockedPolicyTitles(unlockedPolicies) {
  if (!Array.isArray(unlockedPolicies)) return [];
  return unlockedPolicies
    .filter((id) => typeof id === "string" && id.trim())
    .map((id) => POLICY_TITLE_BY_ID.get(id) || id);
}

function resolveUnlockedPolicyTitleMap(unlockedPolicies) {
  if (!Array.isArray(unlockedPolicies)) return {};
  const out = {};
  unlockedPolicies.forEach((id) => {
    if (typeof id !== "string" || !id.trim()) return;
    out[id] = POLICY_TITLE_BY_ID.get(id) || id;
  });
  return out;
}

export function buildSharedContextFromState(state, { compact = false } = {}) {
  const ctx = {};

  if (state.currentQuarterFocus) {
    ctx.currentQuarterFocus = state.currentQuarterFocus;
  }
  setOptionalArray(ctx, "currentQuarterAgenda", state.currentQuarterAgenda, { requireNonEmpty: compact });
  setOptionalArray(ctx, "customPolicies", state.customPolicies, { requireNonEmpty: compact });
  setOptionalArray(ctx, "hostileForces", state.hostileForces, { requireNonEmpty: compact });
  setOptionalArray(ctx, "closedStorylines", state.closedStorylines, { requireNonEmpty: compact });
  setOptionalObject(ctx, "storyFacts", state.storyFacts || buildStoryFactsFromState(state));

  setOptionalObject(ctx, "playerAbilities", state.playerAbilities);
  setOptionalArray(ctx, "unlockedPolicies", state.unlockedPolicies, { requireNonEmpty: compact });
  setOptionalArray(ctx, "unlockedPolicyTitles", resolveUnlockedPolicyTitles(state.unlockedPolicies), { requireNonEmpty: compact });
  setOptionalObject(ctx, "unlockedPolicyTitleMap", resolveUnlockedPolicyTitleMap(state.unlockedPolicies));

  return ctx;
}

export function buildStoryRequestBody(state, lastChoice) {
  const rigidMode = isRigidMode(state);
  const body = {
    state: {
      currentDay: state.currentDay,
      currentPhase: state.currentPhase,
      currentMonth: state.currentMonth,
      currentYear: state.currentYear,
      nation: state.nation || {},
      appointments: state.appointments || {},
      characterStatus: state.characterStatus || {},
      prestige: state.prestige,
      executionRate: state.executionRate,
    },
    ...buildSharedContextFromState(state, { compact: true }),
  };

  if (rigidMode && state.rigid) {
    const memoryAnchors = Array.isArray(state.rigid.memoryAnchors) ? state.rigid.memoryAnchors : [];
    const executionConstraints = Array.isArray(state.rigid.executionConstraints) ? state.rigid.executionConstraints : [];
    body.rigid = {
      calendar: state.rigid.calendar || null,
      finance: state.rigid.finance || null,
      military: state.rigid.military || null,
      court: state.rigid.court || null,
      chongZhen: state.rigid.chongZhen || null,
      pendingAssassinate: !!state.rigid.pendingAssassinate,
      pendingBranchEvent: state.rigid.pendingBranchEvent || null,
      lastDecision: state.rigid.lastDecision || null,
      lastTriggerEvents: Array.isArray(state.rigid.lastTriggerEvents) ? state.rigid.lastTriggerEvents : [],
      latestMemoryAnchor: memoryAnchors.length ? memoryAnchors[memoryAnchors.length - 1] : null,
      latestExecutionConstraint: executionConstraints.length ? executionConstraints[executionConstraints.length - 1] : null,
      lastOutputModules: Array.isArray(state.rigid.lastOutput?.modules)
        ? state.rigid.lastOutput.modules.map((module) => ({
          id: module.id,
          title: module.title,
          lines: Array.isArray(module.lines) ? module.lines : [],
        }))
        : [],
    };
  }

  if (lastChoice) {
    body.lastChoiceId = lastChoice.id;
    body.lastChoiceText = lastChoice.text;
    if (lastChoice.hint) body.lastChoiceHint = lastChoice.hint;
  }

  return body;
}

export function buildMinisterChatRequestBody(state, ministerId, history) {
  return {
    ministerId,
    history,
    state: {
      appointments: state.appointments || {},
      characterStatus: state.characterStatus || {},
    },
    ...buildSharedContextFromState(state, { compact: false }),
  };
}
