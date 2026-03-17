import { getState, setState } from "../state.js";
import { renderStoryTurn, pushCurrentTurnToHistory, applyEffects, renderDeltaCard, computeQuarterlyEffects, estimateEffectsFromEdict, mergeEffects } from "./storySystem.js";
import { autoSaveIfEnabled } from "../storage.js";
import { updateTopbarByState } from "../layout.js";
import { applyProgressionToChoiceEffects, extractCustomPoliciesFromEdict, mergeCustomPolicies, processCoreGameplayTurn, scaleEffectsByExecution } from "./coreGameplaySystem.js";

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

    // 将季度收入效果合并到本回合历史中，便于界面展示
    const currentState = getState();
    const history = currentState.storyHistory || [];
    if (history.length > 0) {
      const lastEntry = history[history.length - 1];
      const mergedEffects = mergeEffects(lastEntry.effects, quarterEffects);
      const updatedHistory = [...history];
      updatedHistory[updatedHistory.length - 1] = {
        ...lastEntry,
        effects: mergedEffects,
      };
      setState({ storyHistory: updatedHistory });
    }
  } else {
    setState({ lastQuarterSettlement: null });
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
