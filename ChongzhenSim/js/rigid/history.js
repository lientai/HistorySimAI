function isEventDue(event, calendar) {
  const targetYear = Number(event?.trigger?.year);
  const targetMonth = Number(event?.trigger?.month);
  const year = Number(calendar?.year);
  const month = Number(calendar?.month);
  if (!targetYear || !targetMonth || !year || !month) return false;
  return year > targetYear || (year === targetYear && month >= targetMonth);
}

function applyImpact(target, impact) {
  if (!impact || typeof impact !== "object") return;
  Object.entries(impact).forEach(([section, patch]) => {
    if (!target[section] || typeof patch !== "object") return;
    Object.entries(patch).forEach(([key, delta]) => {
      if (typeof delta !== "number") return;
      const prev = Number(target[section][key]) || 0;
      target[section][key] = prev + delta;
    });
  });
}

export function applyHistoryImpact(rigidState, impact) {
  applyImpact(rigidState, impact);
}

export function consumeDueHistoryEvents(rigidState, eventConfigs = [], options = {}) {
  const pending = Array.isArray(rigidState.pendingEvents) ? rigidState.pendingEvents : [];
  const done = new Set(Array.isArray(rigidState.eventHistory) ? rigidState.eventHistory.map((item) => item.id) : []);
  const deferBranching = options.deferBranching !== false;

  const sourceEvents = pending.length ? pending : eventConfigs;
  const dueEvents = sourceEvents.filter((item) => item && !done.has(item.id) && isEventDue(item, rigidState.calendar));
  if (!dueEvents.length) return { appliedEvents: [], pendingBranchEvents: [] };

  const appliedEvents = [];
  const pendingBranchEvents = [];

  dueEvents.forEach((event) => {
    const hasBranches = Array.isArray(event.branches) && event.branches.length > 0;
    if (deferBranching && hasBranches) {
      pendingBranchEvents.push(event);
      return;
    }

    applyImpact(rigidState, event.impact);
    rigidState.eventHistory.push({
      id: event.id,
      name: event.name,
      year: rigidState.calendar.year,
      month: rigidState.calendar.month,
    });
    appliedEvents.push(event);
  });

  return { appliedEvents, pendingBranchEvents };
}

export function buildHistoryCountdown(rigidState, eventConfigs = []) {
  const done = new Set(Array.isArray(rigidState.eventHistory) ? rigidState.eventHistory.map((item) => item.id) : []);
  const year = rigidState.calendar?.year || 1627;
  const month = rigidState.calendar?.month || 8;

  return eventConfigs
    .filter((event) => event && !done.has(event.id))
    .map((event) => {
      const targetYear = Number(event.trigger?.year) || year;
      const targetMonth = Number(event.trigger?.month) || month;
      const monthsLeft = (targetYear - year) * 12 + (targetMonth - month);
      return {
        id: event.id,
        name: event.name,
        monthsLeft,
        variableSpace: monthsLeft <= 3 ? "低" : monthsLeft <= 12 ? "中" : "高",
      };
    })
    .sort((a, b) => a.monthsLeft - b.monthsLeft)
    .slice(0, 5);
}

