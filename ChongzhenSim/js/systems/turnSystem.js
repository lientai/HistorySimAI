import { getState, setState } from "../state.js";
import { renderStoryTurn, pushCurrentTurnToHistory, applyEffects, computeQuarterlyEffects, estimateEffectsFromEdict } from "./storySystem.js";
import { autoSaveIfEnabled } from "../storage.js";
import { updateTopbarByState } from "../layout.js";
import { applyProgressionToChoiceEffects, extractCustomPoliciesFromEdict, mergeCustomPolicies, processCoreGameplayTurn, refreshQuarterAgendaByState, resolveHostileForcesAfterChoice, scaleEffectsByExecution } from "./coreGameplaySystem.js";
import { sanitizeStoryEffects } from "../api/validators.js";
import { loadJSON } from "../dataLoader.js";
import { buildOutcomeDisplayDelta, captureDisplayStateSnapshot } from "../utils/displayStateMetrics.js";
import { deriveAppointmentEffectsFromText, normalizeAppointmentEffects } from "../utils/appointmentEffects.js";

let positionsMetaCache = null;
const CHONGZHEN_BASE_YEAR = 1627;

async function getPositionsMeta() {
  if (positionsMetaCache) return positionsMetaCache;
  try {
    positionsMetaCache = await loadJSON("data/positions.json");
  } catch (_e) {
    positionsMetaCache = { positions: [], departments: [] };
  }
  return positionsMetaCache;
}

function isAliveCharacter(state, id) {
  return state.characterStatus?.[id]?.isAlive !== false;
}

async function remindVacantCourtPositionsYearEnd() {
  const state = getState();
  const meta = await getPositionsMeta();
  const positions = Array.isArray(meta?.positions) ? meta.positions : [];
  if (!positions.length) return;

  const appointments = { ...(state.appointments || {}) };

  const vacancies = positions
    .filter((p) => p && p.id && !appointments[p.id])
    .sort((a, b) => {
      const rankA = typeof a.rank === "number" ? a.rank : 99;
      const rankB = typeof b.rank === "number" ? b.rank : 99;
      return rankA - rankB;
    });

  if (!vacancies.length) return;
  const summary = vacancies.slice(0, 5).map((pos) => pos.name || pos.id).join("、");

  setState({
    systemNewsToday: [
      ...(state.systemNewsToday || []),
      {
        title: "岁末吏部提醒补官",
        summary: `当前有 ${vacancies.length} 个官职空缺（如：${summary}${vacancies.length > 5 ? "等" : ""}），请于年终自行任命以稳朝局。`,
        tag: "重",
        icon: "📝",
      },
    ],
  });
}

function progressNaturalMinisterDeaths(nextYear, nextMonth) {
  const state = getState();
  const ministers = Array.isArray(state.ministers) ? state.ministers : [];
  if (!ministers.length) return;

  const absoluteYear = CHONGZHEN_BASE_YEAR + (nextYear || 1);
  const characterStatus = { ...(state.characterStatus || {}) };
  const appointments = { ...(state.appointments || {}) };
  const deathList = [];

  ministers.forEach((m) => {
    if (!m || !m.id) return;
    if (!isAliveCharacter(state, m.id)) return;
    if (typeof m.deathYear !== "number") return;

    // 延缓自然死亡：默认在史实卒年后增加 2 年缓冲，再进入缓慢概率触发。
    const delayedStartYear = m.deathYear + 2;
    if (absoluteYear < delayedStartYear) return;

    const yearsPast = absoluteYear - delayedStartYear;
    const monthlyChance = Math.min(0.03 + yearsPast * 0.02, 0.25);
    if (Math.random() >= monthlyChance) return;

    const current = characterStatus[m.id] || {};
    characterStatus[m.id] = {
      ...current,
      isAlive: false,
      deathReason: current.deathReason || "寿终病逝",
      deathDay: nextMonth || 1,
      deathYear: nextYear || 1,
    };
    for (const [posId, holderId] of Object.entries(appointments)) {
      if (holderId === m.id) {
        delete appointments[posId];
      }
    }
    deathList.push(m.name || m.id);
  });

  if (!deathList.length) return;

  const news = {
    title: "群臣讣告",
    summary: `${deathList.join("、")} 因年老病逝，相关官职已出缺。`,
    tag: "重",
    icon: "⚱️",
  };

  setState({
    characterStatus,
    appointments,
    systemNewsToday: [...(state.systemNewsToday || []), news],
  });
}

export function runCurrentTurn(container, options = {}) {
  const state = getState();
  return renderStoryTurn(state, container, handleChoice, options);
}

async function handleChoice(choiceId, choiceText, choiceHint, effects) {
  const state = getState();
  const beforeTurnSnapshot = captureDisplayStateSnapshot(state);
  const positionsMeta = await getPositionsMeta();

  if (choiceId === "custom_edict") {
    const newlyFound = extractCustomPoliciesFromEdict(choiceText || "", state.currentYear, state.currentMonth);
    console.debug("[custom-policy] extracted", newlyFound.map((item) => item.name));
    if (newlyFound.length) {
      const mergedPolicies = mergeCustomPolicies(state.customPolicies, newlyFound);
      const fresh = mergedPolicies.filter((item) => !(state.customPolicies || []).some((old) => old.id === item.id));
      const policyNews = fresh.map((item) => ({
        title: "新国策设立",
        summary: `自拟诏书已将“${item.name}”纳入国策，季度结算将同步其长期影响。`,
        tag: "重",
        icon: "🏛️",
      }));
      setState({
        customPolicies: mergedPolicies,
        systemNewsToday: [...(state.systemNewsToday || []), ...policyNews],
      });
    }
  }

  // 如果是自拟诏书，优先根据文本做一个简单的效果预估，让数值立刻能体现变化
  let appliedEffects = effects;
  const isLLMStoryMode = (state.config?.storyMode || "template") === "llm";
  if (choiceId === "custom_edict" && !effects && !isLLMStoryMode) {
    const est = estimateEffectsFromEdict(choiceText || "");
    if (est) {
      appliedEffects = est;
    }
  }

  const derivedAppointmentEffects = deriveAppointmentEffectsFromText(choiceText || "", {
    positions: positionsMeta?.positions || [],
    ministers: state.ministers || [],
    currentAppointments: state.appointments || {},
  });

  if (derivedAppointmentEffects) {
    const base = appliedEffects && typeof appliedEffects === "object" ? { ...appliedEffects } : {};
    if (derivedAppointmentEffects.appointments) {
      base.appointments = {
        ...(base.appointments && typeof base.appointments === "object" ? base.appointments : {}),
        ...derivedAppointmentEffects.appointments,
      };
    }
    if (Array.isArray(derivedAppointmentEffects.appointmentDismissals)) {
      const currentDismissals = Array.isArray(base.appointmentDismissals) ? base.appointmentDismissals : [];
      base.appointmentDismissals = Array.from(
        new Set([...currentDismissals, ...derivedAppointmentEffects.appointmentDismissals])
      );
    }
    appliedEffects = base;
  }

  const normalizedAppointmentEffects = appliedEffects
    ? normalizeAppointmentEffects(appliedEffects, {
      positions: positionsMeta?.positions || state.positionsMeta?.positions || [],
      ministers: state.ministers || [],
    })
    : appliedEffects;

  const progressedEffects = normalizedAppointmentEffects
    ? applyProgressionToChoiceEffects(normalizedAppointmentEffects, state, choiceText || "")
    : normalizedAppointmentEffects;
  const effectiveEffects = progressedEffects ? scaleEffectsByExecution(progressedEffects, state) : progressedEffects;
  const guardedEffects = effectiveEffects ? sanitizeStoryEffects(effectiveEffects) : effectiveEffects;
  if (guardedEffects) {
    applyEffects(guardedEffects);
  }

  pushCurrentTurnToHistory(state, { text: choiceText || "", hint: choiceHint ?? undefined }, guardedEffects);

  setState({
    lastChoiceId: choiceId,
    lastChoiceText: choiceText || "",
    lastChoiceHint: choiceHint || null,
    currentStoryTurn: null,
  });

  // 每一轮代表一个月（按 state.currentMonth/Year 走），并且每12个月增长一年
  let nextMonth = (state.currentMonth || 1) + 1;
  let nextYear = state.currentYear || 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  setState({
    currentDay: (state.currentDay || 1) + 1,
    currentMonth: nextMonth,
    currentYear: nextYear,
    currentPhase: "morning", // 保持单一阶段展示
  });

  const coreTurn = processCoreGameplayTurn(getState(), choiceText || "", guardedEffects, nextYear, nextMonth);
  setState(coreTurn.statePatch);
  if (coreTurn.consequenceEffects) {
    applyEffects(coreTurn.consequenceEffects);
  }

  const hostileTurn = resolveHostileForcesAfterChoice(getState(), choiceText || "", guardedEffects || {}, nextYear, nextMonth);
  if (hostileTurn) {
    setState(hostileTurn.statePatch);
    if (hostileTurn.effectsPatch) {
      applyEffects(hostileTurn.effectsPatch);
    }
    if (hostileTurn.prestigeDelta) {
      const s = getState();
      setState({ prestige: Math.max(0, Math.min(100, (s.prestige || 0) + hostileTurn.prestigeDelta)) });
    }
  }

  progressNaturalMinisterDeaths(nextYear, nextMonth);

  // 每季度（3 个月）自动加入税收/粮仓收入
  const quarterEffects = computeQuarterlyEffects(getState(), nextMonth);
  if (quarterEffects) {
    applyEffects(quarterEffects);
    const stateAfterQuarter = getState();
    const customPolicyCount = (stateAfterQuarter.customPolicies || []).length;
    const customBonus = quarterEffects._customPolicyBonus || null;
    if (customPolicyCount > 0 && customBonus) {
      const bonusNews = {
        title: "自定义国策生效",
        summary: `本季 ${customPolicyCount} 条自定义国策参与结算：财政系数 x${customBonus.treasuryRatio.toFixed(2)}，粮储系数 x${customBonus.grainRatio.toFixed(2)}，军务 +${customBonus.militaryDelta}，贪腐 ${customBonus.corruptionDelta}.`,
        tag: "重",
        icon: "🏛️",
      };
      setState({ systemNewsToday: [...(stateAfterQuarter.systemNewsToday || []), bonusNews] });
    }
    setState({
      lastQuarterSettlement: {
        year: nextYear,
        month: nextMonth,
        effects: quarterEffects,
      },
    });

  } else {
    setState({ lastQuarterSettlement: null });
  }

  if (nextMonth === 12) {
    await remindVacantCourtPositionsYearEnd();
  }

  // 用本回合全部结算后的最新状态重算季度议题，避免议题落后于实时局势
  const agendaPatch = refreshQuarterAgendaByState(getState());
  setState(agendaPatch);

  const stateAfterTurn = getState();
  const displayEffects = buildOutcomeDisplayDelta(beforeTurnSnapshot, captureDisplayStateSnapshot(stateAfterTurn));
  const historyAfterTurn = Array.isArray(stateAfterTurn.storyHistory) ? [...stateAfterTurn.storyHistory] : [];
  if (historyAfterTurn.length > 0) {
    const lastIndex = historyAfterTurn.length - 1;
    historyAfterTurn[lastIndex] = {
      ...historyAfterTurn[lastIndex],
      displayEffects,
    };
    setState({ storyHistory: historyAfterTurn });
  }

  autoSaveIfEnabled();
  updateTopbarByState(getState());

  if (typeof window !== "undefined") {
    const main = document.getElementById("main-view");
    if (main) {
      main.innerHTML = "";
      await runCurrentTurn(main);
    }
  }
}

function applyMonthlyIncome() {
  const state = getState();
  const nation = { ...(state.nation || {}) };
  const provinceStats = state.provinceStats || {};
  const provinces = Object.values(provinceStats);
  if (!provinces.length) return;

  let rawSilver = 0;
  let rawGrain = 0;
  let sumCorruption = 0;
  let count = 0;

  provinces.forEach((p) => {
    if (!p) return;
    rawSilver += p.taxSilver || 0;
    rawGrain += p.taxGrain || 0;
    sumCorruption += typeof p.corruption === "number" ? p.corruption : 0;
    count += 1;
  });

  if (!count) return;
  const avgCorruption = sumCorruption / count;
  const effectiveRate = Math.max(0, 1 - avgCorruption / 100);

  const silverIncome = Math.max(0, Math.round(rawSilver * effectiveRate));
  const grainIncome = Math.max(0, Math.round(rawGrain * effectiveRate));

  nation.treasury = Math.max(0, (nation.treasury || 0) + silverIncome);
  nation.grain = Math.max(0, (nation.grain || 0) + grainIncome);

  setState({ nation });
}
