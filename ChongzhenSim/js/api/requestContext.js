function setOptionalArray(target, key, value, { requireNonEmpty = false } = {}) {
  if (!Array.isArray(value)) return;
  if (requireNonEmpty && value.length === 0) return;
  target[key] = value;
}

function setOptionalObject(target, key, value) {
  if (!value || typeof value !== "object") return;
  target[key] = value;
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

  setOptionalObject(ctx, "playerAbilities", state.playerAbilities);
  setOptionalArray(ctx, "unlockedPolicies", state.unlockedPolicies, { requireNonEmpty: compact });

  return ctx;
}

export function buildStoryRequestBody(state, lastChoice) {
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
    ...buildSharedContextFromState(state, { compact: false }),
  };
}
