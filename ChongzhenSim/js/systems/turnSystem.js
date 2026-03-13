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

  if (state.currentPhase === "morning") {
    nextPhase = "afternoon";
  } else if (state.currentPhase === "afternoon") {
    nextPhase = "evening";
  } else if (state.currentPhase === "evening") {
    nextPhase = "morning";
    nextDay = state.currentDay + 1;
  }

  setState({
    currentDay: nextDay,
    currentPhase: nextPhase,
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
