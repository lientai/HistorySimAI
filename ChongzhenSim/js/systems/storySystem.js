import { loadJSON } from "../dataLoader.js";
import { getState, setState } from "../state.js";
import { requestStoryTurn } from "../api/llmStory.js";
import { startDanmuForEdict, stopDanmu } from "./danmuSystem.js";
import { buildBlockText } from "../utils/storyParser.js";
import { 
  renderDeltaCard, 
  renderPseudoLines, 
  renderStoryLoading, 
  renderStoryError, 
  renderChosenChoice,
  createChoiceButton 
} from "../utils/storyRenderer.js";
import { showCustomEdictPanel } from "../utils/storyUI.js";

let storyCache = { key: null, data: null };
let lastAppliedKey = null;

export function pushCurrentTurnToHistory(state, chosenChoice, effects) {
  const key = `${state.currentDay}_${state.currentPhase}`;
  if (storyCache.key !== key || !storyCache.data) return;
  const history = state.storyHistory || [];
  
  const existingIndex = history.findIndex(entry => entry.key === key);
  if (existingIndex >= 0) {
    const updated = [...history];
    updated[existingIndex] = {
      ...updated[existingIndex],
      chosenChoice: chosenChoice ?? undefined,
      effects: effects ?? null,
    };
    setState({ storyHistory: updated });
    return;
  }
  
  setState({
    storyHistory: [
      ...history,
      {
        key,
        data: storyCache.data,
        chosenChoice: chosenChoice ?? undefined,
        effects: effects ?? null,
      },
    ],
  });
}

function applyEffects(effects) {
  if (!effects) return;
  const s = getState();
  const nation = { ...(s.nation || {}) };
  
  const PERCENT_KEYS = ["militaryStrength", "civilMorale", "borderThreat", "disasterLevel", "corruptionLevel"];
  
  Object.entries(effects).forEach(([key, value]) => {
    if (typeof value !== "number") return;
    
    if (key === "treasury" || key === "grain") {
      nation[key] = Math.max(0, (nation[key] || 0) + value);
    } else if (PERCENT_KEYS.includes(key)) {
      const clampedDelta = Math.max(-30, Math.min(30, value));
      nation[key] = Math.max(0, Math.min(100, (nation[key] || 0) + clampedDelta));
    }
  });
  setState({ nation });

  if (effects.loyalty && typeof effects.loyalty === "object") {
    const loyalty = { ...(s.loyalty || {}) };
    for (const [id, delta] of Object.entries(effects.loyalty)) {
      if (typeof delta !== "number") continue;
      const clampedDelta = Math.max(-20, Math.min(20, delta));
      loyalty[id] = Math.max(0, Math.min(100, (loyalty[id] || 0) + clampedDelta));
    }
    setState({ loyalty });
  }
}

function cleanupDanmuLayer(container) {
  if (container._edictDanmuLayer) {
    stopDanmu(container._edictDanmuLayer);
    container._edictDanmuLayer.remove();
    container._edictDanmuLayer = null;
  }
}

function setupDanmuLayer(container) {
  cleanupDanmuLayer(container);
  const danmuLayer = document.createElement("div");
  danmuLayer.className = "edict-danmu-layer";
  container.insertBefore(danmuLayer, container.firstChild);
  container._edictDanmuLayer = danmuLayer;
  return danmuLayer;
}

function startDanmu(container) {
  if (container._edictDanmuLayer) {
    startDanmuForEdict(container._edictDanmuLayer);
  }
}

function renderStoryHistory(container, history, phaseLabels, state, renderId) {
  for (const entry of history) {
    if (renderId != null && container._storyRenderId !== renderId) return false;
    
    const data = entry.data;
    const [day, phase] = entry.key.split("_");
    const phaseLabel = phaseLabels[phase] || phase;
    
    const label = document.createElement("div");
    label.className = "story-history-label";
    label.textContent = `第${day}天 · ${phaseLabel}`;
    container.appendChild(label);
    
    const block = document.createElement("div");
    block.className = "edict-block story-history-block";
    const historyText = buildBlockText(data);
    renderPseudoLines(block, historyText, state);
    container.appendChild(block);
    
    if (entry.chosenChoice && entry.chosenChoice.text) {
      renderChosenChoice(container, entry.chosenChoice);
      renderDeltaCard(container, entry.effects, state);
    }
  }
  return true;
}

async function loadStoryData(state, container, renderId, onChoice, options) {
  const phaseKey = state.currentPhase || "morning";
  const path = `data/story/day${state.currentDay}_${phaseKey}.json`;
  const cacheKey = `${state.currentDay}_${phaseKey}`;
  const config = state.config || {};

  if (storyCache.key === cacheKey && storyCache.data) {
    return storyCache.data;
  }

  const useLLM = config.storyMode === "llm" && (config.apiBase || "").trim().length > 0;
  let data = null;

  if (useLLM) {
    const loadingBlock = renderStoryLoading(container);
    const lastChoice = state.lastChoiceId != null
      ? { id: state.lastChoiceId, text: state.lastChoiceText || "", hint: state.lastChoiceHint }
      : null;
    
    data = await requestStoryTurn(state, lastChoice);
    loadingBlock.remove();
    
    if (renderId != null && container._storyRenderId !== renderId) return null;
  }

  if (data == null) {
    try {
      data = await loadJSON(path);
    } catch (e) {
      if (renderId != null && container._storyRenderId !== renderId) return null;
      
      const errorMessage = useLLM 
        ? "本回合剧情生成失败，请检查网络或后端配置。"
        : "本回合剧情尚未准备好，请稍后再试。";
      
      renderStoryError(container, errorMessage, () => {
        storyCache = { key: null, data: null };
        container.innerHTML = "";
        renderStoryTurn(getState(), container, onChoice, options);
      });
      return null;
    }
  }

  storyCache = { key: cacheKey, data };
  return data;
}

function updateStoryState(data) {
  if (data.news) {
    setState({ newsToday: data.news });
  }
  if (data.publicOpinion) {
    setState({ publicOpinion: data.publicOpinion });
  }
  if (data.header && data.header.weather) {
    setState({ weather: data.header.weather });
  }
}

function renderCurrentTurn(container, data, state, phaseLabels, onChoice) {
  const phaseKey = state.currentPhase || "morning";
  const currentPhaseLabel = phaseLabels[phaseKey] || phaseKey;
  
  const currentLabel = document.createElement("div");
  currentLabel.className = "story-history-label story-current-label";
  currentLabel.textContent = `当前 · 第${state.currentDay}天 · ${currentPhaseLabel}`;
  container.appendChild(currentLabel);
  
  const currentWrap = document.createElement("div");
  currentWrap.className = "edict-current-wrap";
  container.appendChild(currentWrap);
  
  const textBlock = document.createElement("div");
  textBlock.className = "edict-block";
  const fullText = buildBlockText(data);
  renderPseudoLines(textBlock, fullText, state);
  currentWrap.appendChild(textBlock);
  
  const actionsWrap = document.createElement("div");
  actionsWrap.className = "story-actions";
  
  (data.choices || []).forEach((choice) => {
    const btn = createChoiceButton(choice, onChoice);
    actionsWrap.appendChild(btn);
  });
  
  const customBtn = document.createElement("button");
  customBtn.type = "button";
  customBtn.className = "story-action-btn story-action-btn--custom";
  customBtn.innerHTML = `<div>自拟诏书</div><span>亲笔拟定旨意，由朝臣代为施行</span>`;
  customBtn.addEventListener("click", () => {
    showCustomEdictPanel(onChoice);
  });
  actionsWrap.appendChild(customBtn);
  
  currentWrap.appendChild(actionsWrap);
}

export async function renderStoryTurn(state, container, onChoice, options = {}) {
  const renderId = options && options.renderId;
  if (renderId != null && container._storyRenderId !== renderId) return;

  setupDanmuLayer(container);

  const config = state.config || {};
  const phaseLabels = config.phaseLabels || { morning: "早朝", afternoon: "午后", evening: "夜间" };
  const history = state.storyHistory || [];
  
  if (!renderStoryHistory(container, history, phaseLabels, state, renderId)) return;

  const data = await loadStoryData(state, container, renderId, onChoice, options);
  if (data == null) return;

  if (data.lastChoiceEffects && state.lastChoiceId === "custom_edict") {
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.chosenChoice && !lastEntry.effects) {
      lastEntry.effects = data.lastChoiceEffects;
      applyEffects(data.lastChoiceEffects);
      const updatedHistory = [...history];
      updatedHistory[updatedHistory.length - 1] = lastEntry;
      setState({ storyHistory: updatedHistory });
      
      const historyContainer = container.querySelector('.story-history-container') || container;
      renderDeltaCard(historyContainer, data.lastChoiceEffects, state);
    }
  }

  updateStoryState(data);

  if (renderId != null && container._storyRenderId !== renderId) return;

  renderCurrentTurn(container, data, state, phaseLabels, onChoice);

  startDanmu(container);
}

export { applyEffects, renderDeltaCard, showCustomEdictPanel };
