const PERCENT_KEYS = ["militaryStrength", "civilMorale", "borderThreat", "disasterLevel", "corruptionLevel"];

export function applyEffects(nation, effects, loyalty) {
  if (!effects) return { nation, loyalty };
  
  const newNation = { ...nation };
  const newLoyalty = { ...loyalty };
  
  Object.entries(effects).forEach(([key, value]) => {
    if (typeof value !== "number") return;
    
    if (key === "treasury" || key === "grain") {
      newNation[key] = Math.max(0, (newNation[key] || 0) + value);
    } else if (PERCENT_KEYS.includes(key)) {
      const clampedDelta = Math.max(-30, Math.min(30, value));
      newNation[key] = Math.max(0, Math.min(100, (newNation[key] || 0) + clampedDelta));
    }
  });

  if (effects.loyalty && typeof effects.loyalty === "object") {
    for (const [id, delta] of Object.entries(effects.loyalty)) {
      if (typeof delta !== "number") continue;
      const clampedDelta = Math.max(-20, Math.min(20, delta));
      newLoyalty[id] = Math.max(0, Math.min(100, (newLoyalty[id] || 0) + clampedDelta));
    }
  }
  
  return { nation: newNation, loyalty: newLoyalty };
}

export function getTreasuryStatus(treasury) {
  if (treasury >= 5000000) return "极度充裕";
  if (treasury >= 1000000) return "充裕";
  if (treasury >= 300000) return "一般";
  if (treasury >= 100000) return "紧张";
  return "极度空虚";
}

export function getGrainStatus(grain) {
  if (grain >= 100000) return "极度充裕";
  if (grain >= 50000) return "充裕";
  if (grain >= 20000) return "一般";
  if (grain >= 10000) return "紧张";
  return "极度空虚";
}

export function getMoraleStatus(civilMorale) {
  if (civilMorale >= 70) return "民心归附";
  if (civilMorale >= 50) return "民心尚可";
  if (civilMorale >= 30) return "民心不稳";
  return "民怨沸腾";
}

export function getBorderStatus(borderThreat) {
  if (borderThreat >= 70) return "边患严重";
  if (borderThreat >= 50) return "边患尚可";
  if (borderThreat >= 30) return "边境安稳";
  return "边境太平";
}

export function getCorruptionStatus(corruptionLevel) {
  if (corruptionLevel >= 70) return "贪腐横行";
  if (corruptionLevel >= 50) return "贪腐尚可";
  if (corruptionLevel >= 30) return "吏治清明";
  return "吏治严明";
}

export function getPhaseLabel(phase) {
  const labels = {
    morning: "早朝",
    afternoon: "午后",
    evening: "夜间"
  };
  return labels[phase] || phase;
}

export function getNextPhase(currentPhase) {
  const phases = {
    morning: "afternoon",
    afternoon: "evening",
    evening: "morning"
  };
  return phases[currentPhase] || "morning";
}

export function shouldIncrementDay(currentPhase) {
  return currentPhase === "evening";
}

export function formatTreasury(value) {
  return value.toLocaleString() + "两";
}

export function formatGrain(value) {
  return value.toLocaleString() + "石";
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateLoyaltyDelta(currentLoyalty, delta) {
  const clampedDelta = Math.max(-20, Math.min(20, delta));
  return Math.max(0, Math.min(100, currentLoyalty + clampedDelta));
}
