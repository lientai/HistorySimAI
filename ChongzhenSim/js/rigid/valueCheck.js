function getByPath(target, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), target);
}

function setByPath(target, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const holder = keys.reduce((acc, key) => {
    if (!acc[key] || typeof acc[key] !== "object") acc[key] = {};
    return acc[key];
  }, target);
  holder[lastKey] = value;
}

export function applyHardFloors(rigidState, hardFloors = {}) {
  const next = rigidState;
  Object.entries(hardFloors || {}).forEach(([path, minValue]) => {
    const current = getByPath(next, path);
    if (typeof current !== "number") return;
    if (typeof minValue !== "number") return;
    if (current < minValue) {
      setByPath(next, path, minValue);
    }
  });
  return next;
}

export function clampPercent(value) {
  if (typeof value !== "number") return 0;
  return Math.max(0, Math.min(100, value));
}

export function clampNumber(value, min, max) {
  if (typeof value !== "number") return min;
  return Math.max(min, Math.min(max, value));
}

