import { formatTreasury, formatGrain } from "../systems/nationSystem.js";
import { buildNameById } from "./sharedConstants.js";

export const DISPLAY_STATE_METRICS = [
  { key: "treasury", label: "国库", icon: "💰", section: "nation", source: "nation", defaultValue: 0, invert: false, format: "treasury", bar: "treasury" },
  { key: "grain", label: "粮储", icon: "🌾", section: "nation", source: "nation", defaultValue: 0, invert: false, format: "grain", bar: "grain" },
  { key: "militaryStrength", label: "军力", icon: "⚔️", section: "nation", source: "nation", defaultValue: 50, invert: false, format: "score", bar: "direct" },
  { key: "civilMorale", label: "民心", icon: "👥", section: "nation", source: "nation", defaultValue: 50, invert: false, format: "score", bar: "direct" },
  { key: "borderThreat", label: "边患", icon: "🏴", section: "nation", source: "nation", defaultValue: 50, invert: true, format: "score", bar: "direct" },
  { key: "disasterLevel", label: "天灾", icon: "🌪️", section: "nation", source: "nation", defaultValue: 50, invert: true, format: "score", bar: "direct" },
  { key: "corruptionLevel", label: "贪腐", icon: "🔗", section: "nation", source: "nation", defaultValue: 50, invert: true, format: "score", bar: "direct" },
  { key: "prestige", label: "威望", icon: "👑", section: "governance", source: "root", defaultValue: 0, invert: false, format: "score", bar: "direct" },
  { key: "executionRate", label: "执行率", icon: "📘", section: "governance", source: "root", defaultValue: 0, invert: false, format: "percent", bar: "direct" },
  { key: "partyStrife", label: "党争", icon: "⚖️", section: "governance", source: "root", defaultValue: 0, invert: true, format: "score", bar: "direct" },
  { key: "unrest", label: "动乱", icon: "🔥", section: "governance", source: "root", defaultValue: 0, invert: true, format: "score", bar: "direct" },
  { key: "taxPressure", label: "税压", icon: "🧾", section: "governance", source: "root", defaultValue: 0, invert: true, format: "score", bar: "direct" },
];

export const DISPLAY_STATE_LABELS = Object.fromEntries(
  DISPLAY_STATE_METRICS.map((metric) => [metric.key, metric.label])
);

export const DISPLAY_STATE_INVERT_KEYS = DISPLAY_STATE_METRICS
  .filter((metric) => metric.invert)
  .map((metric) => metric.key);

function getMetricDefinition(key) {
  return DISPLAY_STATE_METRICS.find((metric) => metric.key === key) || null;
}

export function getDisplayMetricsBySection(section) {
  return DISPLAY_STATE_METRICS.filter((metric) => metric.section === section);
}

export function getDisplayMetricValue(state, key) {
  const metric = getMetricDefinition(key);
  if (!metric) return 0;
  if (metric.source === "nation") {
    const value = state?.nation?.[key];
    return typeof value === "number" ? value : metric.defaultValue;
  }
  const value = state?.[key];
  return typeof value === "number" ? value : metric.defaultValue;
}

export function formatDisplayMetricValue(state, key) {
  const metric = getMetricDefinition(key);
  const value = getDisplayMetricValue(state, key);
  if (!metric) return String(value);
  if (metric.format === "treasury") return formatTreasury(value);
  if (metric.format === "grain") return formatGrain(value);
  if (metric.format === "percent") return `${value}%`;
  return `${value}/100`;
}

export function getDisplayMetricBarValue(state, key) {
  const metric = getMetricDefinition(key);
  const value = getDisplayMetricValue(state, key);
  if (!metric) return 0;
  if (metric.bar === "treasury") return Math.min(100, value / 10000);
  if (metric.bar === "grain") return Math.min(100, value / 500);
  return Math.min(100, Math.max(0, value));
}

export function captureDisplayStateSnapshot(state) {
  const snapshot = {
    nation: Object.fromEntries(
      getDisplayMetricsBySection("nation").map((metric) => [metric.key, getDisplayMetricValue(state, metric.key)])
    ),
    loyalty: { ...(state?.loyalty || {}) },
    appointments: { ...(state?.appointments || {}) },
    characterStatus: { ...(state?.characterStatus || {}) },
  };

  getDisplayMetricsBySection("governance").forEach((metric) => {
    snapshot[metric.key] = getDisplayMetricValue(state, metric.key);
  });

  return snapshot;
}

export function buildDisplayStateDelta(beforeState, afterState) {
  const delta = {};
  DISPLAY_STATE_METRICS.forEach((metric) => {
    const beforeValue = getDisplayMetricValue(beforeState, metric.key);
    const afterValue = getDisplayMetricValue(afterState, metric.key);
    const diff = afterValue - beforeValue;
    if (diff !== 0) {
      delta[metric.key] = diff;
    }
  });
  return delta;
}

function buildLoyaltyDelta(beforeState, afterState) {
  const before = beforeState?.loyalty || {};
  const after = afterState?.loyalty || {};
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  const delta = {};
  ids.forEach((id) => {
    const diff = Number(after[id] || 0) - Number(before[id] || 0);
    if (diff !== 0) delta[id] = diff;
  });
  return delta;
}

function buildAppointmentDelta(beforeState, afterState) {
  const before = beforeState?.appointments || {};
  const after = afterState?.appointments || {};
  const delta = {};
  Object.entries(after).forEach(([positionId, characterId]) => {
    if (before[positionId] !== characterId) {
      delta[positionId] = characterId;
    }
  });
  return delta;
}

function buildAppointmentDismissalDelta(beforeState, afterState) {
  const before = beforeState?.appointments || {};
  const after = afterState?.appointments || {};
  const dismissals = [];

  Object.entries(before).forEach(([positionId, characterId]) => {
    if (typeof positionId !== "string" || typeof characterId !== "string") return;
    if (!after[positionId]) {
      dismissals.push(positionId);
    }
  });

  return dismissals;
}

function buildCharacterDeathDelta(beforeState, afterState) {
  const before = beforeState?.characterStatus || {};
  const after = afterState?.characterStatus || {};
  const delta = {};
  Object.entries(after).forEach(([characterId, status]) => {
    if (before[characterId]?.isAlive === false) return;
    if (status?.isAlive === false) {
      delta[characterId] = status?.deathReason || "已故";
    }
  });
  return delta;
}

export function buildOutcomeDisplayDelta(beforeState, afterState) {
  const delta = buildDisplayStateDelta(beforeState, afterState);
  const loyalty = buildLoyaltyDelta(beforeState, afterState);
  const appointments = buildAppointmentDelta(beforeState, afterState);
  const appointmentDismissals = buildAppointmentDismissalDelta(beforeState, afterState);
  const characterDeath = buildCharacterDeathDelta(beforeState, afterState);

  if (Object.keys(loyalty).length) delta.loyalty = loyalty;
  if (Object.keys(appointments).length) delta.appointments = appointments;
  if (appointmentDismissals.length) delta.appointmentDismissals = appointmentDismissals;
  if (Object.keys(characterDeath).length) delta.characterDeath = characterDeath;
  return delta;
}

export function hasOutcomeDisplayDelta(delta) {
  if (!delta || typeof delta !== "object") return false;
  if (DISPLAY_STATE_METRICS.some((metric) => typeof delta[metric.key] === "number" && delta[metric.key] !== 0)) return true;
  if (delta.loyalty && Object.keys(delta.loyalty).length > 0) return true;
  if (delta.appointments && Object.keys(delta.appointments).length > 0) return true;
  if (Array.isArray(delta.appointmentDismissals) && delta.appointmentDismissals.length > 0) return true;
  if (delta.characterDeath && Object.keys(delta.characterDeath).length > 0) return true;
  return false;
}

export function mergeOutcomeDisplayDelta(baseDelta, patchDelta) {
  const merged = { ...(baseDelta || {}) };

  DISPLAY_STATE_METRICS.forEach((metric) => {
    const baseValue = typeof merged[metric.key] === "number" ? merged[metric.key] : 0;
    const patchValue = typeof patchDelta?.[metric.key] === "number" ? patchDelta[metric.key] : 0;
    const total = baseValue + patchValue;
    if (total !== 0) merged[metric.key] = total;
    else delete merged[metric.key];
  });

  if (patchDelta?.loyalty && typeof patchDelta.loyalty === "object") {
    const loyalty = { ...(merged.loyalty || {}) };
    Object.entries(patchDelta.loyalty).forEach(([id, diff]) => {
      const total = (loyalty[id] || 0) + diff;
      if (total !== 0) loyalty[id] = total;
      else delete loyalty[id];
    });
    if (Object.keys(loyalty).length) merged.loyalty = loyalty;
    else delete merged.loyalty;
  }

  if (patchDelta?.appointments && typeof patchDelta.appointments === "object") {
    merged.appointments = { ...(merged.appointments || {}), ...patchDelta.appointments };
  }

  if (Array.isArray(patchDelta?.appointmentDismissals)) {
    const existing = Array.isArray(merged.appointmentDismissals) ? merged.appointmentDismissals : [];
    const combined = Array.from(new Set([...existing, ...patchDelta.appointmentDismissals]));
    if (combined.length) merged.appointmentDismissals = combined;
    else delete merged.appointmentDismissals;
  }

  if (patchDelta?.characterDeath && typeof patchDelta.characterDeath === "object") {
    merged.characterDeath = { ...(merged.characterDeath || {}), ...patchDelta.characterDeath };
  }

  return merged;
}

export function buildOutcomeDisplayEntries(effects, state) {
  if (!effects || typeof effects !== "object") return [];

  const entries = [];
  DISPLAY_STATE_METRICS.forEach((metric) => {
    const delta = effects[metric.key];
    if (typeof delta !== "number" || delta === 0) return;
    entries.push({
      type: "number",
      label: metric.label,
      value: delta,
      invertColor: metric.invert,
    });
  });

  const ministers = state?.ministers || [];
  const nameById = buildNameById(ministers);
  const positions = Array.isArray(state?.positionsMeta?.positions) ? state.positionsMeta.positions : [];
  const positionNameById = Object.fromEntries(
    positions
      .filter((position) => position && typeof position.id === "string")
      .map((position) => [position.id, position.name || position.id])
  );

  if (effects.loyalty && typeof effects.loyalty === "object") {
    Object.entries(effects.loyalty).forEach(([id, delta]) => {
      if (typeof delta !== "number" || delta === 0) return;
      entries.push({
        type: "number",
        label: `${nameById[id] || id} 忠诚`,
        value: delta,
        invertColor: false,
      });
    });
  }

  if (effects.appointments && typeof effects.appointments === "object" && !Array.isArray(effects.appointments)) {
    Object.entries(effects.appointments).forEach(([positionId, characterId]) => {
      const positionLabel = positionNameById[positionId] || positionId;
      entries.push({
        type: "text",
        label: `任命 ${nameById[characterId] || characterId} → ${positionLabel}`,
        value: "已生效",
      });
    });
  }

  if (Array.isArray(effects.appointmentDismissals)) {
    effects.appointmentDismissals.forEach((positionId) => {
      const positionLabel = positionNameById[positionId] || positionId;
      entries.push({
        type: "text",
        label: `免去 ${positionLabel}`,
        value: "已生效",
      });
    });
  }

  if (effects.characterDeath && typeof effects.characterDeath === "object") {
    Object.entries(effects.characterDeath).forEach(([characterId, reason]) => {
      entries.push({
        type: "text",
        label: `处置 ${nameById[characterId] || characterId}`,
        value: typeof reason === "string" && reason ? reason : "已处置",
      });
    });
  }

  return entries;
}

export function renderOutcomeDisplayCard(container, effects, state, titleText = "") {
  if (!container || !hasOutcomeDisplayDelta(effects)) return;

  const entries = buildOutcomeDisplayEntries(effects, state);
  if (!entries.length) return;

  const card = document.createElement("div");
  card.className = "story-delta-card";

  if (titleText) {
    const title = document.createElement("div");
    title.className = "story-history-label";
    title.textContent = titleText;
    card.appendChild(title);
  }

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "story-delta-row";

    const label = document.createElement("span");
    label.className = "story-delta-label";
    label.textContent = entry.label;

    const value = document.createElement("span");
    if (entry.type === "number") {
      const isPositive = entry.invertColor ? entry.value < 0 : entry.value > 0;
      value.className = "story-delta-value " + (isPositive ? "story-delta-value--positive" : "story-delta-value--negative");
      value.textContent = `${entry.value > 0 ? "+" : ""}${entry.value.toLocaleString()}`;
    } else {
      value.className = "story-delta-value story-delta-value--appointment";
      value.textContent = String(entry.value);
    }

    row.appendChild(label);
    row.appendChild(value);
    card.appendChild(row);
  });

  container.appendChild(card);
}