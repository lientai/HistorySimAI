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

  if (effects.appointments && typeof effects.appointments === "object") {
    const currentState = getState();
    const appointments = { ...(currentState.appointments || {}) };
    for (const [positionId, characterId] of Object.entries(effects.appointments)) {
      if (typeof positionId !== "string" || typeof characterId !== "string") continue;
      for (const [posId, charId] of Object.entries(appointments)) {
        if (charId === characterId && posId !== positionId) {
          delete appointments[posId];
        }
      }
      appointments[positionId] = characterId;
    }
    setState({ appointments });
  }

  if (effects.characterDeath && typeof effects.characterDeath === "object") {
    const currentState = getState();
    const characterStatus = { ...(currentState.characterStatus || {}) };
    for (const [characterId, reason] of Object.entries(effects.characterDeath)) {
      if (typeof characterId !== "string") continue;
      characterStatus[characterId] = {
        isAlive: false,
        deathReason: typeof reason === "string" ? reason : "处死",
        deathDay: currentState.currentDay || 1
      };
    }
    const appointments = { ...(currentState.appointments || {}) };
    for (const characterId of Object.keys(effects.characterDeath)) {
      for (const [posId, charId] of Object.entries(appointments)) {
        if (charId === characterId) {
          delete appointments[posId];
        }
      }
    }
    setState({ characterStatus, appointments });
  }
}

function setupDanmuLayer(container) {
  if (container._edictDanmuLayer) return;
  const layer = document.createElement("div");
  layer.className = "edict-danmu-layer";
  container.insertBefore(layer, container.firstChild);
  container._edictDanmuLayer = layer;
}

function startDanmu(container) {
  if (container._edictDanmuLayer) {
    startDanmuForEdict(container._edictDanmuLayer);
  }
}

async function renderStoryHistory(container, history, phaseLabels, state, renderId) {
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
      if (entry.effects) {
        applyEffects(entry.effects);
      }
      await renderDeltaCard(container, entry.effects, state);
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

  const apiBase = (config.apiBase || "").trim();
  const isCustomEdict = state.lastChoiceId === "custom_edict";
  const useLLM = (config.storyMode === "llm" || isCustomEdict) && apiBase.length > 0;
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

  if (!data) {
    try {
      data = await loadJSON(path);
    } catch (e) {
      const errorMessage = config.storyMode === "llm" && apiBase.length > 0
        ? "LLM 生成失败，已切换到本地模板。本地模板不适用于自拟诏书场景。"
        : "剧情文件加载失败";
      
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
  const header = data.header || {};
  const phase = state.currentPhase || "morning";
  const phaseLabel = phaseLabels[phase] || phase;

  const headerEl = document.createElement("div");
  headerEl.className = "story-header";
  headerEl.innerHTML = `
    <span class="story-header__time">${header.time || ""}</span>
    <span class="story-header__info">${header.season || ""} · ${header.weather || ""} · ${header.location || ""}</span>
  `;
  container.appendChild(headerEl);

  const block = document.createElement("div");
  block.className = "edict-block story-current-block";
  const storyText = Array.isArray(data.storyParagraphs) ? data.storyParagraphs.join("\n") : data.storyParagraphs || "";
  renderPseudoLines(block, storyText, state);
  container.appendChild(block);

  const actionsWrap = document.createElement("div");
  actionsWrap.className = "story-choices";

  const choices = data.choices || [];
  const validChoices = choices.slice(0, 3);

  validChoices.forEach(choice => {
    const btn = createChoiceButton(choice, onChoice);
    actionsWrap.appendChild(btn);
  });

  const customBtn = document.createElement("button");
  customBtn.type = "button";
  customBtn.className = "story-action-btn story-action-btn--custom";
  customBtn.innerHTML = `<div>✍️ 自拟诏书</div><span>自定义圣旨内容</span>`;
  customBtn.addEventListener("click", () => {
    showCustomEdictPanel(onChoice);
  });
  actionsWrap.appendChild(customBtn);
  
  container.appendChild(actionsWrap);
}

export async function renderStoryTurn(state, container, onChoice, options = {}) {
  const renderId = options && options.renderId;
  if (renderId != null && container._storyRenderId !== renderId) return;

  setupDanmuLayer(container);

  const config = state.config || {};
  const phaseLabels = config.phaseLabels || { morning: "早朝", afternoon: "午后", evening: "夜间" };
  const currentState = getState();
  const history = currentState.storyHistory || [];
  
  if (!await renderStoryHistory(container, history, phaseLabels, currentState, renderId)) return;

  const data = await loadStoryData(currentState, container, renderId, onChoice, options);
  if (data == null) return;

  if (data.lastChoiceEffects && currentState.lastChoiceId === "custom_edict") {
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.chosenChoice && !lastEntry.effects) {
      lastEntry.effects = data.lastChoiceEffects;
      applyEffects(data.lastChoiceEffects);
      const updatedHistory = [...history];
      updatedHistory[updatedHistory.length - 1] = lastEntry;
      setState({ storyHistory: updatedHistory });
      
      const historyContainer = container.querySelector('.story-history-container') || container;
      await renderDeltaCard(historyContainer, data.lastChoiceEffects, getState());
    }
  }

  updateStoryState(data);

  if (renderId != null && container._storyRenderId !== renderId) return;

  renderCurrentTurn(container, data, currentState, phaseLabels, onChoice);

  startDanmu(container);
}

export { applyEffects, renderDeltaCard, showCustomEdictPanel };
