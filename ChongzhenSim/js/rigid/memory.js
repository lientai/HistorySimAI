export function createMemoryAnchor(rigidState, context = {}) {
  const calendar = rigidState.calendar || { year: 1627, month: 8, turn: 1 };
  const anchor = {
    turn: calendar.turn,
    year: calendar.year,
    month: calendar.month,
    summary: context.summary || "局势继续恶化，帝心未安。",
    risk: {
      resistance: Math.round(rigidState.court?.resistance || 0),
      anxiety: Math.round(rigidState.chongZhen?.anxiety || 0),
      assassinateRisk: Math.round(rigidState.chongZhen?.assassinateRisk || 0),
    },
    timestamp: new Date().toISOString(),
  };
  return anchor;
}

export function appendMemoryAnchor(rigidState, anchor) {
  const list = Array.isArray(rigidState.memoryAnchors) ? rigidState.memoryAnchors.slice() : [];
  list.push(anchor);
  rigidState.memoryAnchors = list.slice(-40);
  return rigidState.memoryAnchors;
}

export function getLatestMemoryAnchor(rigidState) {
  const list = Array.isArray(rigidState.memoryAnchors) ? rigidState.memoryAnchors : [];
  return list.length ? list[list.length - 1] : null;
}

export function createExecutionConstraint(rigidState, context = {}) {
  const calendar = rigidState.calendar || { year: 1627, month: 8, turn: 1 };
  const constraint = {
    turn: calendar.turn,
    year: calendar.year,
    month: calendar.month,
    executionRates: context.executionRates || {
      neige: 0,
      silijian: 0,
      libu: 0,
      local: 0,
      finalMultiplier: 0,
    },
    hadRefute: context.hadRefute || false,
    refuteTimes: Math.round(rigidState.court?.refuteTimes || 0),
    reboundType: context.reboundType || "normal",
    triggeredThresholds: Array.isArray(context.triggerEvents) ? context.triggerEvents.map((e) => ({
      type: e.type,
      title: e.title,
    })) : [],
    historyBranchEvents: Array.isArray(context.historyEvents) ? context.historyEvents.map((e) => ({
      name: e.name,
      type: e.type,
    })) : [],
    timestamp: new Date().toISOString(),
  };
  return constraint;
}

export function appendExecutionConstraint(rigidState, constraint) {
  const list = Array.isArray(rigidState.executionConstraints) ? rigidState.executionConstraints.slice() : [];
  list.push(constraint);
  rigidState.executionConstraints = list.slice(-40);
  return rigidState.executionConstraints;
}

export function getLatestExecutionConstraint(rigidState) {
  const list = Array.isArray(rigidState.executionConstraints) ? rigidState.executionConstraints : [];
  return list.length ? list[list.length - 1] : null;
}

