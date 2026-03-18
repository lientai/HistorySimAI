import { getState, setState } from "../state.js";
import { renderStoryTurn, pushCurrentTurnToHistory, applyEffects, computeQuarterlyEffects, estimateEffectsFromEdict } from "./storySystem.js";
import { autoSaveIfEnabled } from "../storage.js";
import { updateTopbarByState } from "../layout.js";
import { applyProgressionToChoiceEffects, extractCustomPoliciesFromEdict, mergeCustomPolicies, processCoreGameplayTurn, refreshQuarterAgendaByState, resolveHostileForcesAfterChoice, scaleEffectsByExecution } from "./coreGameplaySystem.js";
import { sanitizeStoryEffects } from "../api/validators.js";
import { loadJSON } from "../dataLoader.js";

let positionsMetaCache = null;

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

async function autoFillVacantCourtPositionsQuarterly() {
  const state = getState();
  const meta = await getPositionsMeta();
  const positions = Array.isArray(meta?.positions) ? meta.positions : [];
  if (!positions.length) return;

  const appointments = { ...(state.appointments || {}) };
  const occupied = new Set(Object.values(appointments).filter((id) => typeof id === "string"));
  const ministers = Array.isArray(state.ministers) ? state.ministers : [];
  const loyalty = state.loyalty || {};

  const candidates = ministers
    .filter((m) => m && m.id)
    .filter((m) => isAliveCharacter(state, m.id))
    .filter((m) => !occupied.has(m.id))
    .filter((m) => !["rebel", "qing"].includes(m.faction));

  if (!candidates.length) return;

  const vacancies = positions
    .filter((p) => p && p.id && !appointments[p.id])
    .sort((a, b) => {
      const impA = typeof a.importance === "number" ? a.importance : 0;
      const impB = typeof b.importance === "number" ? b.importance : 0;
      if (impB !== impA) return impB - impA;
      const rankA = typeof a.rank === "number" ? a.rank : 99;
      const rankB = typeof b.rank === "number" ? b.rank : 99;
      return rankA - rankB;
    });

  if (!vacancies.length) return;

  const used = new Set(occupied);
  const assignments = [];

  vacancies.forEach((pos) => {
    const available = candidates
      .filter((m) => !used.has(m.id))
      .sort((a, b) => {
        const la = typeof loyalty[a.id] === "number" ? loyalty[a.id] : 0;
        const lb = typeof loyalty[b.id] === "number" ? loyalty[b.id] : 0;
        if (lb !== la) return lb - la;
        const an = String(a.name || a.id);
        const bn = String(b.name || b.id);
        return an.localeCompare(bn, "zh-CN");
      });

    const picked = available[0];
    if (!picked) return;
    used.add(picked.id);
    appointments[pos.id] = picked.id;
    assignments.push({ positionName: pos.name || pos.id, ministerName: picked.name || picked.id, ministerId: picked.id });
  });

  if (!assignments.length) return;

  const assignmentSummary = assignments.slice(0, 5).map((a) => `${a.positionName}→${a.ministerName}`).join("，");

  setState({
    appointments,
    systemNewsToday: [
      ...(state.systemNewsToday || []),
      {
        title: "内阁核定补官",
        summary: `本季度内阁已完成空缺补官：${assignmentSummary}${assignments.length > 5 ? "等" : ""}。`,
        tag: "重",
        icon: "📝",
      },
    ],
  });
}

export function runCurrentTurn(container, options = {}) {
  const state = getState();
  return renderStoryTurn(state, container, handleChoice, options);
}

async function handleChoice(choiceId, choiceText, choiceHint, effects) {
  const state = getState();

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

  const progressedEffects = appliedEffects ? applyProgressionToChoiceEffects(appliedEffects, state, choiceText || "") : appliedEffects;
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

  if (nextMonth % 3 === 0) {
    await autoFillVacantCourtPositionsQuarterly();
  }

  // 用本回合全部结算后的最新状态重算季度议题，避免议题落后于实时局势
  const agendaPatch = refreshQuarterAgendaByState(getState());
  setState(agendaPatch);

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
