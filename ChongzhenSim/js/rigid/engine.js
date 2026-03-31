import {
  DEFAULT_DECISION_PRESETS,
  DEFAULT_HISTORY_EVENTS,
  DEFAULT_RIGID_INITIAL,
  DEFAULT_RIGID_TRIGGERS,
  createDefaultRigidState,
} from "./config.js";
import { validateRigidDecision } from "./decisionCheck.js";
import {
  applyAutoRebound,
  applyDecisionIntent,
  applyPersonalityPunishment,
  applyStateCoupling,
  applyPeriodicDistrustDecay,
  advanceThreeMonths,
  computeExecutionDiscount,
  enforceRigidFloors,
  evaluateThresholdTriggers,
} from "./mechanisms.js";
import {
  appendMemoryAnchor,
  createMemoryAnchor,
  appendExecutionConstraint,
  createExecutionConstraint,
} from "./memory.js";
import { composeRigidModules } from "./moduleComposer.js";
import { applyHistoryImpact, consumeDueHistoryEvents } from "./history.js";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeDefaults(base, incoming) {
  return {
    ...deepClone(base),
    ...(incoming && typeof incoming === "object" ? incoming : {}),
  };
}

export function resolveRigidConfigs(state) {
  const cfg = state?.config?.rigid || {};
  return {
    initial: mergeDefaults(DEFAULT_RIGID_INITIAL, cfg.initialState),
    triggers: mergeDefaults(DEFAULT_RIGID_TRIGGERS, cfg.triggers),
    events: Array.isArray(cfg.historyEvents) ? cfg.historyEvents : DEFAULT_HISTORY_EVENTS,
    presets: Array.isArray(cfg.decisionPresets) && cfg.decisionPresets.length ? cfg.decisionPresets : DEFAULT_DECISION_PRESETS,
  };
}

export function ensureRigidState(state) {
  const configs = resolveRigidConfigs(state);
  const rigid = state?.rigid && typeof state.rigid === "object"
    ? state.rigid
    : createDefaultRigidState(configs.initial);

  if (!Array.isArray(rigid.pendingEvents) || !rigid.pendingEvents.length) {
    rigid.pendingEvents = deepClone(configs.events);
  }
  if (!Array.isArray(rigid.eventHistory)) rigid.eventHistory = [];
  if (!Array.isArray(rigid.memoryAnchors)) rigid.memoryAnchors = [];
  if (!rigid.offendScores) rigid.offendScores = { scholar: 0, general: 0, eunuch: 0, royal: 0, people: 0 };

  const initialModules = composeRigidModules(rigid, {
    decisionText: rigid.lastDecision?.text || "登极初政，观望局势",
    executionSummary: "等待本回合决策",
    hadRefute: false,
    reboundSummary: "未触发",
    triggerEvents: [],
    historyEvents: [],
    historyConfigs: configs.events,
  });
  rigid.lastOutput = rigid.lastOutput || { modules: initialModules };

  return { rigid, configs };
}

function resolveDecision(choiceId, choiceText, presets) {
  if (choiceId === "rigid_strike_recover") {
    return {
      id: choiceId,
      text: "召集内阁与都察院紧急议和，先促百官复朝",
      hint: "只能用于罢朝期间，优先降低阻力并推进复朝进度",
      type: "politics",
      reformLevel: "normal",
      offend: { scholar: 1, general: 0, eunuch: 1, royal: 1, people: 0 },
      intent: {
        court: { resistance: -10, factionFight: -4, authority: -1 },
        chongZhen: { anxiety: 2, distrust: 2 },
      },
    };
  }
  if (choiceId === "rigid_assassinate_investigate") {
    return {
      id: choiceId,
      text: "追查暗杀主谋",
      hint: "可能冤枉忠臣，也可能放过真凶",
      type: "security",
      reformLevel: "normal",
      offend: { scholar: 1, general: 1, eunuch: 2, royal: 1, people: 0 },
      intent: {},
    };
  }
  if (choiceId === "rigid_assassinate_suppress") {
    return {
      id: choiceId,
      text: "压下案情，先稳朝局",
      hint: "短期平稳但真凶未明",
      type: "politics",
      reformLevel: "normal",
      offend: { scholar: 1, general: 1, eunuch: 1, royal: 1, people: 1 },
      intent: {},
    };
  }
  if (String(choiceId || "").startsWith("rigid_branch_")) {
    return {
      id: choiceId,
      text: choiceText || "历史分支抉择",
      hint: "历史节点分支",
      type: "politics",
      reformLevel: "normal",
      offend: { scholar: 0, general: 0, eunuch: 0, royal: 0, people: 0 },
      intent: {},
    };
  }
  if (choiceId === "custom_edict") {
    return {
      id: "custom_edict",
      text: choiceText || "自拟诏书",
      hint: "按关键词估算执行效果",
      type: "politics",
      reformLevel: "major",
      offend: { scholar: 6, general: 3, eunuch: 3, royal: 2, people: 2 },
      intent: { court: { resistance: 5, factionFight: 4 }, chongZhen: { anxiety: 3, exposureRisk: 2 } },
    };
  }
  const preset = presets.find((item) => item.id === choiceId);
  if (preset) return preset;

  const text = String(choiceText || "").trim();
  if (!text) return null;

  // Fallback for dynamic story choices: keep rigid pipeline running instead of hard-blocking.
  return {
    id: String(choiceId || `rigid_dynamic_${Date.now()}`),
    text,
    hint: "动态决策（按困难模式通用规则估算）",
    type: "politics",
    reformLevel: "normal",
    offend: { scholar: 2, general: 1, eunuch: 1, royal: 1, people: 0 },
    intent: {},
  };
}

function summarizeExecution(executionResult) {
  if (!executionResult?.sixkePass) return "六科封驳，决策无效";
  const r = executionResult.rates;
  return `内阁${(r.neige * 100).toFixed(0)}%→司礼监${(r.silijian * 100).toFixed(0)}%→六部${(r.libu * 100).toFixed(0)}%→地方${(r.local * 100).toFixed(0)}%`;
}

function enforceStrikeRecoveryProgress(rigidState, triggerConfig) {
  const strikeLevel = Number(rigidState?.strikeLevel) || 0;
  if (strikeLevel <= 0) return;

  const configuredLevels = Array.isArray(triggerConfig?.strikeLevels) ? triggerConfig.strikeLevels : [];
  const currentRule = configuredLevels
    .map((item) => ({
      level: Number(item.level) || 1,
      releaseResistance: Number(item.releaseResistance) || 70,
    }))
    .find((item) => item.level === strikeLevel);
  if (!currentRule) return;

  const targetResistance = currentRule.releaseResistance - 1;
  rigidState.court.resistance = Math.min(Number(rigidState.court?.resistance) || 0, targetResistance);
}

function tryResolvePendingBranch(nextRigid, payload) {
  // Branch events are hard gates: any normal policy is blocked until a branch is picked.
  const pendingBranchEvent = nextRigid.pendingBranchEvent;
  if (!pendingBranchEvent) {
    return { handled: false, ok: false, message: "no_pending_branch", historyEvents: [] };
  }
  const branchId = String(payload.choiceId || "").startsWith("rigid_branch_")
    ? String(payload.choiceId || "").slice("rigid_branch_".length)
    : "";
  const selected = (pendingBranchEvent.branches || []).find((item) => item.id === branchId);
  if (!selected) {
    return {
      handled: true,
      ok: false,
      message: "需先对当前历史节点进行分支选择。",
      historyEvents: [],
    };
  }

  applyHistoryImpact(nextRigid, pendingBranchEvent.impact);
  applyHistoryImpact(nextRigid, selected.impact);
  nextRigid.eventHistory.push({
    id: pendingBranchEvent.id,
    name: `${pendingBranchEvent.name}·${selected.name}`,
    year: nextRigid.calendar.year,
    month: nextRigid.calendar.month,
  });
  nextRigid.pendingBranchEvent = null;
  return {
    handled: true,
    ok: true,
    message: `历史分支已选择：${selected.name}`,
    historyEvents: [{ id: pendingBranchEvent.id, name: pendingBranchEvent.name }],
  };
}

function tryResolvePendingAssassinate(nextRigid, payload) {
  if (!nextRigid.pendingAssassinate) {
    return { handled: false, ok: false, message: "no_pending_assassinate", historyEvents: [] };
  }

  const choiceId = String(payload.choiceId || "");
  if (choiceId === "rigid_assassinate_investigate") {
    const roll = Math.abs(Math.sin((nextRigid.calendar?.turn || 1) * 31)) % 1;
    if (roll < 0.5) {
      nextRigid.chongZhen.assassinateRisk += 8;
      nextRigid.chongZhen.distrust += 6;
      nextRigid.pendingAssassinate = false;
      return {
        handled: true,
        ok: true,
        message: "调查结果：误捕清流，真凶疑云仍在。",
        historyEvents: [{ id: "assassinate_followup", name: "暗杀调查·冤错" }],
      };
    }
    nextRigid.chongZhen.assassinateRisk += 5;
    nextRigid.chongZhen.distrust += 4;
    nextRigid.pendingAssassinate = false;
    return {
      handled: true,
      ok: true,
      message: "调查结果：疑犯脱网，案情未明。",
      historyEvents: [{ id: "assassinate_followup", name: "暗杀调查·失察" }],
    };
  }

  if (choiceId === "rigid_assassinate_suppress") {
    nextRigid.chongZhen.assassinateRisk += 6;
    nextRigid.pendingAssassinate = false;
    return {
      handled: true,
      ok: true,
      message: "暂压案情：朝局稍定，但暗流未散。",
      historyEvents: [{ id: "assassinate_followup", name: "暗杀调查·压案" }],
    };
  }

  return {
    handled: true,
    ok: false,
    message: "需先处理暗杀后续处置（追查或压案）。",
    historyEvents: [],
  };
}

export function runRigidTurn(state, payload) {
  const { rigid, configs } = ensureRigidState(state);
  const refuteBeforeTurn = Number(rigid?.court?.refuteTimes) || 0;
  const decision = resolveDecision(payload.choiceId, payload.choiceText, configs.presets);
  if (!decision) {
    return {
      ok: false,
      rejected: true,
      message: "未知决策，未执行。",
      statePatch: {
        rigid: {
          ...rigid,
          lastOutput: {
            modules: composeRigidModules(rigid, {
              decisionText: payload.choiceText || "未知决策",
              executionSummary: "未执行",
              hadRefute: false,
              reboundSummary: "未触发",
              triggerEvents: [],
              historyEvents: [],
              historyConfigs: configs.events,
            }),
          },
        },
      },
    };
  }

  const strikeRecoveryAction = decision.id === "rigid_strike_recover";
  const strikeActive = !!rigid?.court?.strikeState;
  const validation = !strikeRecoveryAction
    ? validateRigidDecision(state, decision.text, configs.triggers)
    : (strikeActive
      ? { ok: true }
      : { ok: false, reason: "strike_not_active", message: "当前未进入罢朝状态，无需执行复朝处置。" });
  if (!validation.ok) {
    const rejectedOutput = composeRigidModules(rigid, {
      decisionText: decision.text,
      executionSummary: validation.message,
      hadRefute: false,
      reboundSummary: "未触发",
      triggerEvents: [],
      historyEvents: [],
      historyConfigs: configs.events,
    });
    return {
      ok: false,
      rejected: true,
      message: validation.message,
      statePatch: {
        rigid: {
          ...rigid,
          lastOutput: { modules: rejectedOutput },
          lastDecision: { id: decision.id, text: decision.text, rejected: true },
        },
      },
    };
  }

  const nextRigid = deepClone(rigid);
  const assassinateResolution = tryResolvePendingAssassinate(nextRigid, payload);
  if (assassinateResolution.handled && !assassinateResolution.ok) {
    const blockedModules = composeRigidModules(nextRigid, {
      decisionText: payload.choiceText || "待处置",
      executionSummary: assassinateResolution.message,
      hadRefute: false,
      reboundSummary: "未触发",
      triggerEvents: [],
      historyEvents: [],
      historyConfigs: configs.events,
    });
    return {
      ok: false,
      rejected: true,
      message: assassinateResolution.message,
      statePatch: {
        rigid: {
          ...nextRigid,
          lastOutput: { modules: blockedModules },
          lastDecision: { id: payload.choiceId || "pending_assassinate", text: payload.choiceText || "待处置", rejected: true },
        },
      },
    };
  }

  const branchResolution = tryResolvePendingBranch(nextRigid, payload);
  if (branchResolution.handled && !branchResolution.ok) {
    const blockedModules = composeRigidModules(nextRigid, {
      decisionText: decision.text,
      executionSummary: branchResolution.message,
      hadRefute: false,
      reboundSummary: "未触发",
      triggerEvents: [],
      historyEvents: [],
      historyConfigs: configs.events,
    });
    return {
      ok: false,
      rejected: true,
      message: branchResolution.message,
      statePatch: {
        rigid: {
          ...nextRigid,
          lastOutput: { modules: blockedModules },
          lastDecision: { id: decision.id, text: decision.text, rejected: true },
        },
      },
    };
  }

  const isAssassinateOnlyTurn = assassinateResolution.handled && assassinateResolution.ok;
  const isBranchOnlyTurn = branchResolution.handled && branchResolution.ok;
  const isStrikeRecoveryTurn = strikeRecoveryAction && strikeActive;
  const isSpecialOnlyTurn = isAssassinateOnlyTurn || isBranchOnlyTurn || isStrikeRecoveryTurn;
  const execution = isSpecialOnlyTurn
    ? { sixkePass: true, rates: { neige: 1, silijian: 1, libu: 1, local: 1 }, finalMultiplier: 1 }
    : computeExecutionDiscount(decision, nextRigid);
  let hadRefute = !execution.sixkePass;

  if (!isSpecialOnlyTurn) {
    if (execution.sixkePass) {
      applyDecisionIntent(nextRigid, decision, execution.finalMultiplier);
    } else {
      nextRigid.court.refuteTimes += 1;
    }

    applyPersonalityPunishment(nextRigid, decision);
    applyStateCoupling(nextRigid);
    applyPeriodicDistrustDecay(nextRigid);
    applyAutoRebound(nextRigid, decision, { decisionPassed: execution.sixkePass, hadRefute });
  } else if (isStrikeRecoveryTurn) {
    applyDecisionIntent(nextRigid, decision, execution.finalMultiplier);
    enforceStrikeRecoveryProgress(nextRigid, configs.triggers);
    applyPersonalityPunishment(nextRigid, decision);
  }

  const refuteAfterExecution = Number(nextRigid?.court?.refuteTimes) || 0;
  if (refuteAfterExecution <= refuteBeforeTurn) {
    nextRigid.court.refuteTimes = refuteBeforeTurn + 1;
    hadRefute = true;
  }

  enforceRigidFloors(nextRigid, configs.triggers);

  const thresholdEvents = evaluateThresholdTriggers(nextRigid, configs.triggers);
  // Due history events are consumed every turn; branchable events are paused as pending choices.
  const historyResult = consumeDueHistoryEvents(nextRigid, configs.events, { deferBranching: true });
  const historyEvents = [
    ...(assassinateResolution.historyEvents || []),
    ...(branchResolution.historyEvents || []),
    ...(historyResult.appliedEvents || []),
  ];
  if (!nextRigid.pendingBranchEvent && Array.isArray(historyResult.pendingBranchEvents) && historyResult.pendingBranchEvents.length) {
    nextRigid.pendingBranchEvent = historyResult.pendingBranchEvents[0];
  }
  enforceRigidFloors(nextRigid, configs.triggers);
  if (thresholdEvents.some((event) => event.type === "assassinate")) {
    nextRigid.pendingAssassinate = true;
  }

  const anchor = createMemoryAnchor(nextRigid, {
    summary: `诏令“${decision.text}”已入档，阻力${Math.round(nextRigid.court.resistance)}，暗杀风险${Math.round(nextRigid.chongZhen.assassinateRisk)}%。`,
  });
  appendMemoryAnchor(nextRigid, anchor);
  const executionConstraint = createExecutionConstraint(nextRigid, {
    executionRates: execution.rates,
    hadRefute,
    reboundType: decision.reformLevel === "major" ? "major_reform" : "normal",
    triggerEvents: thresholdEvents,
    historyEvents,
  });
  appendExecutionConstraint(nextRigid, executionConstraint);
  const outputModules = composeRigidModules(nextRigid, {
    decisionText: isAssassinateOnlyTurn
      ? `${decision.text}（暗杀后续）`
      : isBranchOnlyTurn
        ? `${decision.text}（历史分支）`
        : decision.text,
    executionSummary: isAssassinateOnlyTurn
      ? assassinateResolution.message
      : isBranchOnlyTurn
        ? branchResolution.message
        : summarizeExecution(execution),
    hadRefute,
    reboundSummary: decision.reformLevel === "major" ? "重大改革触发反弹" : "常规波动",
    triggerEvents: thresholdEvents,
    historyEvents,
    historyConfigs: configs.events,
  });

  advanceThreeMonths(nextRigid);
  nextRigid.lastDecision = { id: decision.id, text: decision.text, rejected: false };
  nextRigid.lastTriggerEvents = thresholdEvents;
  nextRigid.lastOutput = { modules: outputModules };

  return {
    ok: true,
    rejected: false,
    message: execution.sixkePass ? "决策执行完成" : "决策遭六科封驳",
    statePatch: {
      rigid: nextRigid,
      currentYear: Math.max(1, nextRigid.calendar.year - 1626),
      currentMonth: nextRigid.calendar.month,
      currentPhase: "morning",
      currentDay: (state.currentDay || 1) + 1,
      currentQuarterAgenda: [],
      currentQuarterFocus: null,
      lastQuarterSettlement: null,
    },
  };
}

export function getRigidPresets(state) {
  return resolveRigidConfigs(state).presets;
}

