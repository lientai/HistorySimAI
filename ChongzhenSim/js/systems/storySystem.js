import { loadJSON } from "../dataLoader.js";
import { getState, setState } from "../state.js";
import { updateMinisterTabBadge } from "../layout.js";
import { requestStoryTurn } from "../api/llmStory.js";
import { startDanmuForEdict, stopDanmu } from "./danmuSystem.js";

let storyCache = { key: null, data: null };
let lastAppliedKey = null;

const MINISTER_NAME_COLORS = [
  "#8B0000", "#2e7d32", "#1565c0", "#e65100", "#6a1b9a",
  "#00695c", "#ad1457", "#4527a0",
];

function buildSpeakerMap() {
  const state = getState();
  const map = {};
  (state.ministers || []).forEach((m) => {
    if (m && m.name) map[m.name] = m.id;
  });
  return map;
}

function buildMinisterNameToInfo() {
  const state = getState();
  const ministers = state.ministers || [];
  const map = {};
  ministers.forEach((m, i) => {
    if (m && m.name) {
      map[m.name] = {
        id: m.id || "",
        color: MINISTER_NAME_COLORS[i % MINISTER_NAME_COLORS.length],
        role: m.role || "",
      };
    }
  });
  return map;
}

function splitTextByNames(text, nameToInfo) {
  const names = Object.keys(nameToInfo || {}).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return [{ type: "text", value: text }];
  const segments = [];
  let i = 0;
  while (i < text.length) {
    let matched = null;
    for (const name of names) {
      if (text.substring(i, i + name.length) === name) {
        matched = name;
        break;
      }
    }
    if (matched) {
      const info = nameToInfo[matched];
      segments.push({ type: "minister", value: matched, color: info?.color });
      i += matched.length;
    } else {
      let next = text.length;
      for (const name of names) {
        const idx = text.indexOf(name, i);
        if (idx !== -1 && idx < next) next = idx;
      }
      segments.push({ type: "text", value: text.slice(i, next) });
      i = next;
    }
  }
  return segments;
}

function highlightMinisterNames(text, nameToInfo) {
  const segments = splitTextByNames(text, nameToInfo || {});
  const frag = document.createDocumentFragment();
  for (const seg of segments) {
    if (seg.type === "text") {
      frag.appendChild(document.createTextNode(seg.value));
    } else {
      const span = document.createElement("span");
      span.className = "story-minister-name";
      span.style.color = seg.color || "inherit";
      span.textContent = seg.value;
      frag.appendChild(span);
    }
  }
  return frag;
}

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

function renderDeltaCard(container, effects, state) {
  if (!effects) return;
  const entries = [];
  const labels = {
    treasury: "国库", grain: "粮储", militaryStrength: "军力",
    civilMorale: "民心", borderThreat: "边患", disasterLevel: "天灾",
    corruptionLevel: "贪腐",
  };
  for (const [key, label] of Object.entries(labels)) {
    if (typeof effects[key] === "number" && effects[key] !== 0) {
      entries.push({ label, delta: effects[key], invertColor: ["borderThreat", "disasterLevel", "corruptionLevel"].includes(key) });
    }
  }
  if (effects.loyalty && typeof effects.loyalty === "object") {
    const ministers = state.ministers || [];
    const nameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
    for (const [id, delta] of Object.entries(effects.loyalty)) {
      if (typeof delta === "number" && delta !== 0) {
        entries.push({ label: (nameById[id] || id) + " 忠诚", delta, invertColor: false });
      }
    }
  }
  if (entries.length === 0) return;

  const card = document.createElement("div");
  card.className = "story-delta-card";
  entries.forEach(({ label, delta, invertColor }) => {
    const row = document.createElement("div");
    row.className = "story-delta-row";
    const lbl = document.createElement("span");
    lbl.className = "story-delta-label";
    lbl.textContent = label;
    const val = document.createElement("span");
    const isPositive = invertColor ? delta < 0 : delta > 0;
    val.className = "story-delta-value " + (isPositive ? "story-delta-value--positive" : "story-delta-value--negative");
    const sign = delta > 0 ? "+" : "";
    val.textContent = sign + delta.toLocaleString();
    row.appendChild(lbl);
    row.appendChild(val);
    card.appendChild(row);
  });
  container.appendChild(card);
}

function renderPseudoLines(blockEl, text) {
  if (!blockEl) return;
  blockEl.innerHTML = "";
  const lines = text.split("\n");
  const speakerMap = buildSpeakerMap();
  const nameToInfo = buildMinisterNameToInfo();

  const storyHeadingIndex = lines.findIndex((line) => line.trim().startsWith("*剧情板块"));
  const storyStartIndex = storyHeadingIndex === -1 ? lines.length : storyHeadingIndex + 1;

  function createLineEl(rawLine) {
    const wrapper = document.createElement("div");
    wrapper.className = "pseudo-line";

    const trimmed = rawLine.replace(/^\s+/, "");
    if (trimmed.startsWith("*")) {
      const label = trimmed.replace(/^\*\s*/, "");
      wrapper.classList.add("pseudo-line--heading");
      const span = document.createElement("span");
      let cls = "pseudo-heading";
      if (label.includes("时间") || label.includes("季节") || label.includes("天气") || label.includes("地点")) {
        cls += " pseudo-heading--meta";
      } else {
        cls += " pseudo-heading--story";
      }
      span.className = cls;
      span.textContent = label;
      wrapper.appendChild(span);
      return wrapper;
    }

    const names = Object.keys(speakerMap);
    const hasSpeaker = names.some((n) => rawLine.includes(n));

    if (hasSpeaker) {
      wrapper.classList.add("pseudo-line--dialog");
      const matchedNames = names.filter((n) => rawLine.includes(n));
      if (matchedNames.length > 0) {
        const avatarsWrap = document.createElement("div");
        avatarsWrap.className = "story-dialog-avatars";
        matchedNames.forEach((name) => {
          const avatarSpan = document.createElement("span");
          avatarSpan.className = "story-dialog-avatar";
          const _aImg = document.createElement("img");
          _aImg.src = `assets/${name}.jpg`;
          _aImg.alt = name;
          _aImg.onerror = function () {
            this.style.display = "none";
            this.parentElement.textContent = name.charAt(0);
          };
          avatarSpan.appendChild(_aImg);
          avatarsWrap.appendChild(avatarSpan);
        });
        wrapper.appendChild(avatarsWrap);
      }
      const textWrap = document.createElement("span");
      textWrap.className = "story-dialog-text";
      const span = document.createElement("span");
      span.className = "pseudo-line-text";
      span.appendChild(highlightMinisterNames(rawLine, nameToInfo));
      textWrap.appendChild(span);
      wrapper.appendChild(textWrap);
    } else {
      const span = document.createElement("span");
      span.className = "pseudo-line-text";
      span.appendChild(highlightMinisterNames(rawLine, nameToInfo));
      wrapper.appendChild(span);
    }

    return wrapper;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;
    blockEl.appendChild(createLineEl(rawLine));
  }
}

function buildBlockText(data) {
  const header = data.header || {};
  const storyParagraphs = data.storyParagraphs || [];

  let text = "";
  text += `*时间：${header.time || ""}\n`;
  text += `*季节：${header.season || ""}\n`;
  text += `*天气：${header.weather || ""}\n`;
  if (header.location) text += `*地点：${header.location}\n`;
  text += `\n*剧情板块\n`;
  storyParagraphs.forEach((p) => {
    text += p + "\n\n";
  });

  return text.trimEnd();
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

function renderStoryLoading(container) {
  const block = document.createElement("div");
  block.className = "edict-block story-loading";
  block.innerHTML = `<div class="story-loading-spinner"></div><div class="story-loading-text">剧情生成中……</div>`;
  container.appendChild(block);
  return block;
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

function renderChosenChoice(container, chosenChoice) {
  const choiceWrap = document.createElement("div");
  choiceWrap.className = "story-choice-history";
  
  const choiceLabel = document.createElement("span");
  choiceLabel.className = "story-choice-history__label";
  choiceLabel.textContent = "圣旨：";
  choiceWrap.appendChild(choiceLabel);
  
  const choiceText = document.createElement("span");
  choiceText.textContent = chosenChoice.text || "";
  choiceWrap.appendChild(choiceText);
  
  if (chosenChoice.hint) {
    const choiceHint = document.createElement("span");
    choiceHint.className = "story-choice-history__hint";
    choiceHint.textContent = chosenChoice.hint;
    choiceWrap.appendChild(choiceHint);
  }
  
  container.appendChild(choiceWrap);
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
    renderPseudoLines(block, historyText);
    container.appendChild(block);
    
    if (entry.chosenChoice && entry.chosenChoice.text) {
      renderChosenChoice(container, entry.chosenChoice);
      renderDeltaCard(container, entry.effects, state);
    }
  }
  return true;
}

function renderStoryError(container, errorMessage, retryCallback) {
  const block = document.createElement("div");
  block.className = "edict-block";
  block.textContent = errorMessage;
  
  const retryBtn = document.createElement("button");
  retryBtn.className = "story-action-btn";
  retryBtn.textContent = "重新生成";
  retryBtn.addEventListener("click", retryCallback);
  
  block.appendChild(retryBtn);
  container.appendChild(block);
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

function createChoiceButton(choice, onChoice) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "story-action-btn";
  btn.innerHTML = `<div>${choice.text}</div>${choice.hint ? `<span>${choice.hint}</span>` : ""}`;
  btn.addEventListener("click", () => {
    onChoice(choice.id, choice.text, choice.hint, choice.effects);
  });
  return btn;
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
  renderPseudoLines(textBlock, fullText);
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

function showCustomEdictPanel(onChoice) {
  const existing = document.getElementById("custom-edict-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "custom-edict-overlay";
  overlay.className = "custom-edict-overlay";

  const panel = document.createElement("div");
  panel.className = "custom-edict-panel";

  const header = document.createElement("div");
  header.className = "custom-edict-panel__header";
  const title = document.createElement("div");
  title.className = "custom-edict-panel__title";
  title.textContent = "自拟诏书";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "custom-edict-panel__close";
  closeBtn.textContent = "\u2715";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const fields = [
    { id: "ce-neizhi", label: "内政", placeholder: "如：减免赋税、整顿吏治..." },
    { id: "ce-junshi", label: "军事", placeholder: "如：增兵辽东、加强城防..." },
    { id: "ce-waijiao", label: "外交", placeholder: "如：遣使议和、联络蒙古..." },
    { id: "ce-qita", label: "其他", placeholder: "如：祭天祈福、下罪己诏..." },
  ];

  const textareas = [];

  fields.forEach((f) => {
    const field = document.createElement("div");
    field.className = "custom-edict-field";
    const label = document.createElement("label");
    label.textContent = f.label;
    label.setAttribute("for", f.id);
    const textarea = document.createElement("textarea");
    textarea.id = f.id;
    textarea.placeholder = f.placeholder;
    textarea.rows = 2;
    textarea.addEventListener("input", updateSubmitState);
    field.appendChild(label);
    field.appendChild(textarea);
    panel.appendChild(field);
    textareas.push({ key: f.label, el: textarea });
  });

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "custom-edict-submit";
  submitBtn.textContent = "颁布诏书";
  submitBtn.disabled = true;

  function updateSubmitState() {
    const hasContent = textareas.some((t) => t.el.value.trim().length > 0);
    submitBtn.disabled = !hasContent;
  }

  submitBtn.addEventListener("click", () => {
    const parts = [];
    textareas.forEach((t) => {
      const val = t.el.value.trim();
      if (val) parts.push(`【${t.key}】${val}`);
    });
    if (parts.length === 0) return;
    const combinedText = parts.join(" ");
    overlay.remove();
    onChoice("custom_edict", combinedText, "自拟诏书", null);
  });

  panel.appendChild(submitBtn);
  overlay.appendChild(panel);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const app = document.getElementById("app");
  (app || document.body).appendChild(overlay);
}

export { applyEffects, renderDeltaCard };
