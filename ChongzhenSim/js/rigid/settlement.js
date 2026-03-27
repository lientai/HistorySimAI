import {
  buildOutcomeDisplayDelta,
  captureDisplayStateSnapshot,
} from "../utils/displayStateMetrics.js";

function getByPath(target, path) {
  if (!target || typeof target !== "object") return 0;
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), target);
}

function toRoundedInt(value) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function addIntDelta(target, key, value) {
  const delta = toRoundedInt(value);
  if (!delta) return;
  target[key] = toRoundedInt((target[key] || 0) + delta);
}

// Rigid-mode dedicated settlement module that reuses the shared delta pipeline.
export function computeRigidSettlementDelta(beforeState, afterState) {
  const beforeSnapshot = captureDisplayStateSnapshot(beforeState);
  const afterSnapshot = captureDisplayStateSnapshot(afterState);
  const sharedDelta = buildOutcomeDisplayDelta(beforeSnapshot, afterSnapshot);

  // Classic-centered output: remove rigid-prefixed keys from the shared delta,
  // then project rigid-specific changes as plugin deltas (integer only).
  Object.keys(sharedDelta).forEach((key) => {
    if (key.startsWith("rigid")) {
      delete sharedDelta[key];
    }
  });

  const beforeRigid = beforeState?.rigid || {};
  const afterRigid = afterState?.rigid || {};

  // Core alignment with classic metrics.
  const rigidTreasuryDiff = (getByPath(afterRigid, "finance.treasury") || 0) - (getByPath(beforeRigid, "finance.treasury") || 0);
  addIntDelta(sharedDelta, "treasury", rigidTreasuryDiff * 10000);

  // Plugin metrics remain available for rigid-only channels.
  const pluginMetricPaths = {
    rigidInnerFund: "finance.innerFund",
    rigidMilitaryArrears: "finance.militaryArrears",
    rigidOfficialArrears: "finance.officialArrears",
    rigidLiaoDongTroops: "military.liaoDongTroops",
    rigidLiaoDongMorale: "military.liaoDongMorale",
    rigidRebelScale: "military.rebelScale",
    rigidAuthority: "court.authority",
    rigidFactionFight: "court.factionFight",
    rigidResistance: "court.resistance",
    rigidRefuteTimes: "court.refuteTimes",
    rigidAnxiety: "chongZhen.anxiety",
    rigidInsomnia: "chongZhen.insomnia",
    rigidExposureRisk: "chongZhen.exposureRisk",
    rigidAssassinateRisk: "chongZhen.assassinateRisk",
    rigidDistrust: "chongZhen.distrust",
  };

  Object.entries(pluginMetricPaths).forEach(([key, path]) => {
    const beforeValue = getByPath(beforeRigid, path) || 0;
    const afterValue = getByPath(afterRigid, path) || 0;
    addIntDelta(sharedDelta, key, afterValue - beforeValue);
  });

  Object.keys(sharedDelta).forEach((key) => {
    if (typeof sharedDelta[key] === "number") {
      sharedDelta[key] = toRoundedInt(sharedDelta[key]);
      if (sharedDelta[key] === 0) delete sharedDelta[key];
    }
  });

  return sharedDelta;
}
