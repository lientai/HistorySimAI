import { loadJSON } from "../dataLoader.js";
import { getState, setState } from "../state.js";
import { updateMinisterTabBadge } from "../layout.js";
import { requestStoryTurn } from "../api/llmStory.js";
import { startDanmuForEdict, stopDanmu } from "./danmuSystem.js";

let storyCache = { key: null, data: null };
let lastAppliedKey = null;

// 大臣名称高亮相关配置
const MINISTER_NAME_COLORS = [
  "#8B0000", "#2e7d32", "#1565c0", "#e65100", "#6a1b9a",
  "#00695c", "#ad1457", "#4527a0",
];

/**
 * 构建大臣名称到ID的映射
 */
function buildSpeakerMap() {
  const state = getState();
  const map = {};
  (state.ministers || []).forEach((m) => {
    if (m && m.name) map[m.name] = m.id;
  });
  return map;
}

/**
 * 构建大臣名称到信息（ID/颜色/角色）的映射
 */
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

/**
 * 按大臣名称拆分文本片段
 */
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

/**
 * 高亮渲染大臣名称
 */
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

/**
 * 将当前回合数据推入历史记录
 */
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

/**
 * 渲染数值变化卡片
 */
function renderDeltaCard(container, effects, state) {
  if (!effects) return;
  const entries = [];
  const labels = {
    treasury: "国库", grain: "粮储", militaryStrength: "军力",
    civilMorale: "民心", borderThreat: "边患", disasterLevel: "天灾",
    corruptionLevel: "贪腐",
  };

  // 国家数值处理
  for (const [key, label] of Object.entries(labels)) {
    if (typeof effects[key] === "number" && effects[key] !== 0) {
      entries.push({
        key,
        label,
        delta: effects[key],
        invertColor: ["borderThreat", "disasterLevel", "corruptionLevel"].includes(key),
        kind: "nation",
      });
    }
  }

  // 大臣忠诚度处理
  if (effects.loyalty && typeof effects.loyalty === "object") {
    const ministers = state.ministers || [];
    const nameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
    for (const [id, delta] of Object.entries(effects.loyalty)) {
      if (typeof delta === "number" && delta !== 0) {
        entries.push({
          key: id,
          label: (nameById[id] || id) + " 忠诚",
          delta,
          invertColor: false,
          kind: "loyalty",
        });
      }
    }
  }

  // 外部势力数值处理
  if (effects.external && typeof effects.external === "object") {
    const externalPowers = state.externalPowers || {};
    for (const [id, delta] of Object.entries(effects.external)) {
      if (typeof delta !== "number" || delta === 0) continue;
      const label = `${id} 势力`;
      entries.push({
        key: id,
        label,
        delta,
        invertColor: true, // 外部势力数值下降是好事
        kind: "external",
      });
    }
  }

  if (entries.length === 0) return;

  const nation = state.nation || {};
  const loyalty = state.loyalty || {};
  const externalPowers = state.externalPowers || {};

  const card = document.createElement("div");
  card.className = "story-delta-card";

  entries.forEach(({ key, label, delta, invertColor, kind }) => {
    const row = document.createElement("div");
    row.className = "story-delta-row";

    const lbl = document.createElement("span");
    lbl.className = "story-delta-label";
    lbl.textContent = label;

    const val = document.createElement("span");
    const isPositive = invertColor ? delta < 0 : delta > 0;
    val.className = "story-delta-value " + (isPositive ? "story-delta-value--positive" : "story-delta-value--negative");

    const sign = delta > 0 ? "+" : "";
    let current = null;
    if (kind === "nation") {
      const v = nation[key];
      if (typeof v === "number" && Number.isFinite(v)) current = v;
    } else if (kind === "loyalty") {
      const v = loyalty[key];
      if (typeof v === "number" && Number.isFinite(v)) current = v;
    } else if (kind === "external") {
      const v = externalPowers[key];
      if (typeof v === "number" && Number.isFinite(v)) current = v;
    }

    if (current != null) {
      const currentStr = current.toLocaleString();
      val.textContent = `${sign}${delta.toLocaleString()}→${currentStr}`;
    } else {
      val.textContent = sign + delta.toLocaleString();
    }

    row.appendChild(lbl);
    row.appendChild(val);
    card.appendChild(row);
  });

  container.appendChild(card);
}

/**
 * 渲染伪行文本（支持标题/对话/普通文本，大臣名称高亮+头像）
 */
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

/**
 * 构建剧情文本块
 */
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

/**
 * 应用数值变化（兼容旧版本的任命/角色死亡 + 新版本的外部势力）
 */
function applyEffects(effects) {
  if (!effects) return;
  const s = getState();
  const nation = { ...(s.nation || {}) };
  
  const PERCENT_KEYS = ["militaryStrength", "civilMorale", "borderThreat", "disasterLevel", "corruptionLevel"];
  
  // 国家基础数值处理
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

  // 大臣忠诚度处理
  if (effects.loyalty && typeof effects.loyalty === "object") {
    const loyalty = { ...(s.loyalty || {}) };
    for (const [id, delta] of Object.entries(effects.loyalty)) {
      if (typeof delta !== "number") continue;
      const clampedDelta = Math.max(-20, Math.min(20, delta));
      loyalty[id] = Math.max(0, Math.min(100, (loyalty[id] || 0) + clampedDelta));
    }
    setState({ loyalty });
  }

  // 新增：外部势力数值处理
  if (effects.external && typeof effects.external === "object") {
    const externalPowers = { ...(s.externalPowers || {}) };
    for (const [id, delta] of Object.entries(effects.external)) {
      if (typeof delta !== "number") continue;
      const current = externalPowers[id] || 0;
      const next = Math.max(0, Math.min(100, current + delta));
      externalPowers[id] = next;
    }
    setState({ externalPowers });
  }

  // 保留旧版本：任命处理
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

  // 保留旧版本：角色死亡处理
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

/**
 * 渲染加载中状态
 */
function renderStoryLoading(container) {
  const block = document.createElement("div");
  block.className = "edict-block story-loading";
  block.innerHTML = `<div class="story-loading-spinner"></div><div class="story-loading-text">剧情生成中……</div>`;
  container.appendChild(block);
  return block;
}

/**
 * 清理弹幕层（防止内存泄漏）
 */
function cleanupDanmuLayer(container) {
  if (container._edictDanmuLayer) {
    stopDanmu(container._edictDanmuLayer);
    container._edictDanmuLayer.remove();
    container._edictDanmuLayer = null;
  }
}

/**
 * 设置弹幕层（先清理旧层，再创建新层）
 */
function setupDanmuLayer(container) {
  cleanupDanmuLayer(container);
  const danmuLayer = document.createElement("div");
  danmuLayer.className = "edict-danmu-layer";
  container.insertBefore(danmuLayer, container.firstChild);
  container._edictDanmuLayer = danmuLayer;
  return danmuLayer;
}

/**
 * 启动弹幕
 */
function startDanmu(container) {
  if (container._edictDanmuLayer) {
    startDanmuForEdict(container._edictDanmuLayer);
  }
}

/**
 * 渲染已选择的选项
 */
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

/**
 * 渲染剧情错误提示
 */
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

/**
 * 渲染剧情历史记录
 */
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
    renderPseudoLines(block, historyText);
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

/**
 * 加载剧情数据（兼容LLM和本地JSON）
 */
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

/**
 * 更新剧情状态（新闻、舆情、天气）
 */
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

/**
 * 创建选项按钮
 */
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

/**
 * 渲染当前回合剧情
 */
function renderCurrentTurn(container, data, state, phaseLabels, onChoice) {
  const header = data.header || {};
  const phase = state.currentPhase || "morning";
  const phaseLabel = phaseLabels[phase] || phase;

  // 保留旧版本的头部信息 + 新版本的样式优化
  const headerEl = document.createElement("div");
  headerEl.className = "story-header";
  headerEl.innerHTML = `
    <span class="story-header__time">${header.time || ""}</span>
    <span class="story-header__info">${header.season || ""} · ${header.weather || ""} · ${header.location || ""}</span>
  `;
  container.appendChild(headerEl);

  const currentLabel = document.createElement("div");
  currentLabel.className = "story-history-label story-current-label";
  currentLabel.textContent = `当前 · 第${state.currentDay}天 · ${phaseLabel}`;
  container.appendChild(currentLabel);
  
  const currentWrap = document.createElement("div");
  currentWrap.className = "edict-current-wrap";
  container.appendChild(currentWrap);
  
  const block = document.createElement("div");
  block.className = "edict-block story-current-block";
  const storyText = Array.isArray(data.storyParagraphs) ? data.storyParagraphs.join("\n") : data.storyParagraphs || "";
  renderPseudoLines(block, storyText);
  currentWrap.appendChild(block);

  const actionsWrap = document.createElement("div");
  actionsWrap.className = "story-choices story-actions";

  // 保留旧版本：最多显示3个选项（可根据需求移除.slice(0,3)）
  const choices = data.choices || [];
  const validChoices = choices.slice(0, 3);

  validChoices.forEach(choice => {
    const btn = createChoiceButton(choice, onChoice);
    actionsWrap.appendChild(btn);
  });

  const customBtn = document.createElement("button");
  customBtn.type = "button";
  customBtn.className = "story-action-btn story-action-btn--custom";
  customBtn.innerHTML = `<div>✍️ 自拟诏书</div><span>亲笔拟定旨意，由朝臣代为施行</span>`;
  customBtn.addEventListener("click", () => {
    showCustomEdictPanel(onChoice);
  });
  actionsWrap.appendChild(customBtn);
  
  currentWrap.appendChild(actionsWrap);
}

/**
 * 自拟诏书面板（内置完整逻辑）
 */
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

/**
 * 核心渲染函数（整合新旧版本逻辑）
 */
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

// 导出核心函数，保持与旧版本兼容
export { applyEffects, renderDeltaCard, showCustomEdictPanel };
