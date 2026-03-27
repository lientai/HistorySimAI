import { applyHardFloors, clampNumber, clampPercent } from "./valueCheck.js";

function deterministic01(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function stageRate(seed, min, max) {
  const r = deterministic01(seed);
  return min + (max - min) * r;
}

export function computeAssassinateRisk(offendScores) {
  const scores = offendScores || {};
  const risk =
    (Number(scores.scholar) || 0) * 0.3 +
    (Number(scores.general) || 0) * 0.2 +
    (Number(scores.eunuch) || 0) * 0.2 +
    (Number(scores.royal) || 0) * 0.2 +
    (Number(scores.people) || 0) * 0.1;
  return clampPercent(risk);
}

export function computeMorale({ militaryArrears = 0, battleImpact = 0, generalAbility = 0, logistics = 0 } = {}) {
  const payrollImpact = clampNumber(40 - militaryArrears * 10, -40, 40);
  return clampPercent(50 + payrollImpact + clampNumber(battleImpact, -50, 50) + clampNumber(generalAbility, -30, 30) + clampNumber(logistics, -30, 30));
}

export function computeExecutionDiscount(decision, rigidState) {
  const turn = rigidState?.calendar?.turn || 1;
  const resistance = rigidState?.court?.resistance || 50;
  const pressureFactor = clampNumber(1 - resistance / 220, 0.45, 1);
  const seedBase = turn * 17 + (decision?.id || "").length * 13;

  const neige = stageRate(seedBase + 1, 0.7, 0.9) * pressureFactor;
  const silijian = stageRate(seedBase + 2, 0.8, 0.95) * pressureFactor;
  const libu = stageRate(seedBase + 3, 0.5, 0.8) * pressureFactor;
  const local = stageRate(seedBase + 4, 0.3, 0.7) * pressureFactor;

  const refuteGateChance = clampNumber((resistance - 25) / 120, 0.05, 0.65);
  const sixkePass = deterministic01(seedBase + 5) > refuteGateChance;

  return {
    sixkePass,
    rates: { neige, silijian, libu, local },
    finalMultiplier: sixkePass ? neige * silijian * libu * local : 0,
  };
}

function applyDelta(target, deltaPatch, ratio = 1) {
  if (!deltaPatch || typeof deltaPatch !== "object") return;
  Object.entries(deltaPatch).forEach(([key, value]) => {
    if (typeof value !== "number") return;
    const prev = Number(target[key]) || 0;
    target[key] = prev + value * ratio;
  });
}

export function applyDecisionIntent(rigidState, decision, multiplier) {
  const next = rigidState;
  const ratio = clampNumber(multiplier, 0, 1);

  applyDelta(next.finance, decision.intent?.finance, ratio);
  applyDelta(next.military, decision.intent?.military, ratio);
  applyDelta(next.court, decision.intent?.court, ratio);
  applyDelta(next.chongZhen, decision.intent?.chongZhen, ratio);
  applyDelta(next.other, decision.intent?.other, ratio);

  const offend = decision.offend || {};
  Object.keys(next.offendScores || {}).forEach((group) => {
    const delta = Number(offend[group]) || 0;
    next.offendScores[group] = clampPercent((next.offendScores[group] || 0) + Math.max(0, delta * Math.max(0.5, ratio)));
  });

  const morale = computeMorale({
    militaryArrears: next.finance.militaryArrears,
    battleImpact: (decision.type === "military" ? 8 : 0) - (next.military.rebelScale || 0),
    generalAbility: 6 - (next.court.resistance || 0) / 20,
    logistics: 8 - (next.other.foodCrisis || 0) / 15,
  });
  next.military.liaoDongMorale = morale;

  return next;
}

export function applyAutoRebound(rigidState, decision, options = {}) {
  const next = rigidState;
  const turn = next.calendar?.turn || 1;
  const reformLevel = decision.reformLevel || "normal";
  if (reformLevel === "major" && options.decisionPassed !== false) {
    const delta = Math.round(stageRate(turn * 29 + decision.id.length, 10, 20));
    next.court.resistance += delta;
  }

  if (options.hadRefute) {
    next.noRefuteTurns = 0;
  } else {
    next.noRefuteTurns = (next.noRefuteTurns || 0) + 1;
    if (next.noRefuteTurns >= 2) {
      next.court.refuteTimes += 3;
      next.noRefuteTurns = 0;
    }
  }

  return next;
}

export function applyPersonalityPunishment(rigidState, decision) {
  const next = rigidState;
  const rationalTypes = new Set(["finance", "politics", "security"]);
  if (!rationalTypes.has(decision.type)) return next;
  next.chongZhen.anxiety += 5;
  next.chongZhen.distrust += 4;
  next.chongZhen.insomnia += 3;
  return next;
}

// Cross-stat coupling keeps the "no perfect decision" pressure persistent.
export function applyStateCoupling(rigidState) {
  const next = rigidState;
  const anxiety = Number(next.chongZhen?.anxiety) || 0;
  const foodCrisis = Number(next.other?.foodCrisis) || 0;
  if (anxiety >= 55) {
    next.chongZhen.insomnia += 2;
  }
  if (foodCrisis >= 60) {
    next.military.rebelScale += 2;
  }
  return next;
}

export function applyPeriodicDistrustDecay(rigidState) {
  const next = rigidState;
  const turn = Number(next.calendar?.turn) || 1;
  if (turn > 0 && turn % 3 === 0) {
    next.chongZhen.distrust += 2;
    next.chongZhen.anxiety += 1;
  }
  return next;
}

export function advanceThreeMonths(rigidState) {
  const next = rigidState;
  const calendar = { ...(next.calendar || {}) };
  let year = calendar.year || 1627;
  let month = calendar.month || 8;

  month += 1;
  while (month > 12) {
    month -= 12;
    year += 1;
  }

  calendar.year = year;
  calendar.month = month;
  calendar.turn = (calendar.turn || 1) + 1;
  const seasonMap = { 12: "冬", 1: "冬", 2: "冬", 3: "春", 4: "春", 5: "夏", 6: "夏", 7: "夏", 8: "秋", 9: "秋", 10: "秋", 11: "冬" };
  calendar.season = seasonMap[month] || "秋";
  next.calendar = calendar;

  return next;
}

export function evaluateThresholdTriggers(rigidState, triggerConfig) {
  const cfg = triggerConfig || {};
  const events = [];

  const assassinateRisk = computeAssassinateRisk(rigidState.offendScores);
  rigidState.chongZhen.assassinateRisk = assassinateRisk;
  if (assassinateRisk > (cfg.assassinateThreshold || 40)) {
    events.push({ type: "assassinate", title: "暗杀事件触发", knownSource: false });
  }

  if ((rigidState.chongZhen.exposureRisk || 0) > (cfg.exposureThreshold || 30)) {
    events.push({ type: "exposure", title: "身份暴露风险升级" });
  }

  const resistance = Number(rigidState?.court?.resistance) || 0;
  const configuredLevels = Array.isArray(cfg.strikeLevels) && cfg.strikeLevels.length
    ? cfg.strikeLevels
    : [
      { level: 1, triggerResistance: Number(cfg.strikeThreshold) || 80, releaseResistance: 72, releaseTurns: 1 },
      { level: 2, triggerResistance: 90, releaseResistance: 66, releaseTurns: 2 },
      { level: 3, triggerResistance: 96, releaseResistance: 60, releaseTurns: 3 },
    ];
  const levels = configuredLevels
    .map((item) => ({
      level: Number(item.level) || 1,
      triggerResistance: Number(item.triggerResistance) || 80,
      releaseResistance: Number(item.releaseResistance) || 70,
      releaseTurns: Math.max(1, Number(item.releaseTurns) || 1),
    }))
    .sort((a, b) => a.level - b.level);

  const detectLevelByResistance = (value) => {
    let out = 0;
    levels.forEach((item) => {
      if (value >= item.triggerResistance) out = Math.max(out, item.level);
    });
    return out;
  };

  const levelInfo = (level) => levels.find((item) => item.level === level) || null;

  const previousLevel = Number(rigidState.strikeLevel) || 0;
  const targetLevel = detectLevelByResistance(resistance);
  const previousState = !!rigidState.court?.strikeState;
  const wasReleased = !previousState && previousLevel === 0;

  if (targetLevel > previousLevel) {
    rigidState.court.strikeState = true;
    rigidState.strikeLevel = targetLevel;
    rigidState.strikeRecoverProgress = 0;
    events.push({ type: "strike", title: `百官罢朝（${targetLevel}级）`, level: targetLevel, phase: "escalate" });
  } else if (previousState && previousLevel > 0) {
    const currentRule = levelInfo(previousLevel);
    if (currentRule && resistance <= currentRule.releaseResistance) {
      rigidState.strikeRecoverProgress = (Number(rigidState.strikeRecoverProgress) || 0) + 1;
      if (rigidState.strikeRecoverProgress >= currentRule.releaseTurns) {
        const downgraded = Math.max(0, previousLevel - 1);
        rigidState.strikeRecoverProgress = 0;
        rigidState.strikeLevel = downgraded;
        rigidState.court.strikeState = downgraded > 0;
        if (downgraded > 0) {
          events.push({ type: "strike", title: `罢朝缓和（降至${downgraded}级）`, level: downgraded, phase: "recover" });
        } else {
          events.push({ type: "strike", title: "百官复朝", level: 0, phase: "released" });
        }
      }
    } else {
      rigidState.strikeRecoverProgress = 0;
    }
  } else if (targetLevel > 0) {
    rigidState.court.strikeState = true;
    rigidState.strikeLevel = targetLevel;
    rigidState.strikeRecoverProgress = 0;
    events.push({ type: "strike", title: `百官罢朝（${targetLevel}级）`, level: targetLevel, phase: "enter" });
  } else if (!wasReleased) {
    rigidState.court.strikeState = false;
    rigidState.strikeLevel = 0;
    rigidState.strikeRecoverProgress = 0;
  }

  if (rigidState.court.strikeState) {
    rigidState.strikeTurns = (Number(rigidState.strikeTurns) || 0) + 1;
  } else {
    rigidState.strikeTurns = 0;
  }

  return events;
}

export function enforceRigidFloors(rigidState, triggerConfig) {
  applyHardFloors(rigidState, triggerConfig?.hardFloors || {});
  rigidState.finance.treasury = Math.max(0, Math.round(rigidState.finance.treasury));
  rigidState.finance.innerFund = Math.max(0, Math.round(rigidState.finance.innerFund));
  rigidState.finance.militaryArrears = Math.max(0, Math.round(rigidState.finance.militaryArrears));
  rigidState.finance.officialArrears = Math.max(0, Math.round(rigidState.finance.officialArrears));
  rigidState.military.liaoDongTroops = Math.max(0, Math.round(rigidState.military.liaoDongTroops));
  rigidState.military.rebelScale = clampPercent(rigidState.military.rebelScale);
  rigidState.military.liaoDongMorale = clampPercent(rigidState.military.liaoDongMorale);
  rigidState.chongZhen.exposureRisk = clampPercent(rigidState.chongZhen.exposureRisk);
  rigidState.chongZhen.assassinateRisk = clampPercent(rigidState.chongZhen.assassinateRisk);
  rigidState.chongZhen.distrust = clampPercent(rigidState.chongZhen.distrust);
  return rigidState;
}

