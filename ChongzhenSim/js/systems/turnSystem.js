import { getState, setState } from "../state.js";
import { renderStoryTurn, pushCurrentTurnToHistory, applyEffects, renderDeltaCard } from "./storySystem.js";
import { autoSaveIfEnabled } from "../storage.js";
import { updateTopbarByState } from "../layout.js";

export function runCurrentTurn(container, options = {}) {
  const state = getState();
  return renderStoryTurn(state, container, handleChoice, options);
}

async function handleChoice(choiceId, choiceText, choiceHint, effects) {
  const state = getState();

  pushCurrentTurnToHistory(state, { text: choiceText || "", hint: choiceHint ?? undefined }, effects);

  if (effects) {
    applyEffects(effects);
  }

  setState({
    lastChoiceId: choiceId,
    lastChoiceText: choiceText || "",
    lastChoiceHint: choiceHint || null,
  });

  let nextPhase = state.currentPhase;
  let nextDay = state.currentDay;
  let nextMonth = state.currentMonth || 4;
  let nextYear = state.currentYear || 3;

  if (state.currentPhase === "morning") {
    nextPhase = "afternoon";
  } else if (state.currentPhase === "afternoon") {
    nextPhase = "evening";
  } else if (state.currentPhase === "evening") {
    nextPhase = "morning";
    nextDay = state.currentDay + 1;
  }

  // 每次做出选择后都视为过去一个月
  applyMonthlyIncome();
  nextMonth += 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  setState({
    currentDay: nextDay,
    currentPhase: nextPhase,
    currentMonth: nextMonth,
    currentYear: nextYear,
  });

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
