import { getState, setState } from "../state.js";
import { renderStoryTurn, pushCurrentTurnToHistory, applyEffects, computeQuarterlyEffects, estimateEffectsFromEdict } from "./storySystem.js";
import { autoSaveIfEnabled } from "../storage.js";
import { updateTopbarByState } from "../layout.js";
import { applyProgressionToChoiceEffects, extractCustomPoliciesFromEdict, mergeCustomPolicies, processCoreGameplayTurn, refreshQuarterAgendaByState, resolveHostileForcesAfterChoice, scaleEffectsByExecution } from "./coreGameplaySystem.js";

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
  if (choiceId === "custom_edict" && !effects) {
    const est = estimateEffectsFromEdict(choiceText || "");
    if (est) {
      appliedEffects = est;
    }
  }

  const progressedEffects = appliedEffects ? applyProgressionToChoiceEffects(appliedEffects, state, choiceText || "") : appliedEffects;
  const effectiveEffects = progressedEffects ? scaleEffectsByExecution(progressedEffects, state) : progressedEffects;
  if (effectiveEffects) {
    applyEffects(effectiveEffects);
  }

  pushCurrentTurnToHistory(state, { text: choiceText || "", hint: choiceHint ?? undefined }, effectiveEffects);

  setState({
    lastChoiceId: choiceId,
    lastChoiceText: choiceText || "",
    lastChoiceHint: choiceHint || null,
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

  const coreTurn = processCoreGameplayTurn(getState(), choiceText || "", effectiveEffects, nextYear, nextMonth);
  setState(coreTurn.statePatch);
  if (coreTurn.consequenceEffects) {
    applyEffects(coreTurn.consequenceEffects);
  }

  const hostileTurn = resolveHostileForcesAfterChoice(getState(), choiceText || "", effectiveEffects || {}, nextYear, nextMonth);
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
