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

