import { loadJSON } from "../dataLoader.js";
import { getState, setState } from "../state.js";
import { updateMinisterTabBadge } from "../layout.js";
import { requestStoryTurn } from "../api/llmStory.js";
import { sanitizeStoryEffects } from "../api/validators.js";
import { startDanmuForEdict, stopDanmu } from "./danmuSystem.js";
import { computeCustomPolicyQuarterBonus, getPolicyBonusSummary } from "./coreGameplaySystem.js";
import { AVAILABLE_AVATAR_NAMES, buildNameById } from "../utils/sharedConstants.js";
import { applyEffects as applyEffectsModule } from "../utils/effectsProcessor.js";
import { DISPLAY_STATE_METRICS, buildOutcomeDisplayDelta, captureDisplayStateSnapshot, hasOutcomeDisplayDelta, mergeOutcomeDisplayDelta, renderOutcomeDisplayCard } from "../utils/displayStateMetrics.js";
import { normalizeAppointmentEffects } from "../utils/appointmentEffects.js";
import { buildRigidStoryData } from "../rigid/moduleComposer.js";
import { ensureRigidState, getRigidPresets } from "../rigid/engine.js";
import { isRigidMode } from "../rigid/config.js";

let storyCache = { key: null, data: null };
let lastAppliedKey = null;
let storyHighlightPanelExpanded = false;
let cachedStoryHighlightRange = null;
let storyChoiceSubmitting = false;

const MINISTER_NAME_COLORS = [
  "#8B0000", "#2e7d32", "#1565c0", "#e65100", "#6a1b9a",
  "#00695c", "#ad1457", "#4527a0",
];

function getRosterCharacters(state) {
  const base = Array.isArray(state?.allCharacters) && state.allCharacters.length
    ? state.allCharacters
    : (state?.ministers || []);
  const generated = Array.isArray(state?.keju?.generatedCandidates) ? state.keju.generatedCandidates : [];
  if (!generated.length) return base;
  const merged = new Map();
  [...base, ...generated].forEach((item) => {
    if (!item?.id) return;
    merged.set(item.id, item);
  });
  return Array.from(merged.values());
}

function buildSpeakerMap() {
  const state = getState();
  const map = {};
  getRosterCharacters(state).forEach((m) => {
    if (m && m.name) map[m.name] = m.id;
  });
  return map;
}

function buildMinisterNameToInfo() {
  const state = getState();
  const ministers = getRosterCharacters(state);
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
  const year = state.currentYear || 1;
  const month = state.currentMonth || 1;
  const key = `${year}_${month}_${state.currentPhase}`;
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

function renderDeltaCard(container, effects, state, titleText = "") {
  renderOutcomeDisplayCard(container, effects, state, titleText);
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
          _aImg.alt = name;
          _aImg.onerror = function () {
            this.style.display = "none";
            this.parentElement.textContent = name.charAt(0);
          };
          if (AVAILABLE_AVATAR_NAMES.has(name)) {
            _aImg.src = `assets/${name}.jpg`;
          } else {
            queueMicrotask(() => _aImg.onerror());
          }
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

function getCurrentTurnKey(state) {
  const year = state.currentYear || 1;
  const month = state.currentMonth || 1;
  const phase = state.currentPhase || "morning";
  return `${year}_${month}_${phase}`;
}

function normalizeSelectionText(rawText) {
  return String(rawText || "").replace(/\s+/g, " ").trim();
}

function getValidSelectionRangeForHighlight(textBlock) {
  if (!textBlock || typeof window === "undefined") {
    return { ok: false, message: "当前环境不支持文本标注。" };
  }

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const liveRange = selection.getRangeAt(0);
    const liveText = normalizeSelectionText(selection.toString());
    if (
      !liveRange.collapsed &&
      liveText &&
      textBlock.contains(liveRange.startContainer) &&
      textBlock.contains(liveRange.endContainer)
    ) {
      cachedStoryHighlightRange = liveRange.cloneRange();
      return { ok: true, range: liveRange, selectedText: liveText, usedCached: false };
    }
  }

  if (cachedStoryHighlightRange) {
    const cachedRange = cachedStoryHighlightRange.cloneRange();
    if (
      !cachedRange.collapsed &&
      textBlock.contains(cachedRange.startContainer) &&
      textBlock.contains(cachedRange.endContainer)
    ) {
      const cachedText = normalizeSelectionText(cachedRange.toString());
      if (cachedText) {
        return { ok: true, range: cachedRange, selectedText: cachedText, usedCached: true };
      }
    }
  }

  return { ok: false, message: "请先在剧情文本中选中要标注的内容。" };
}

function updateCachedSelectionFromTextBlock(textBlock) {
  if (!textBlock || typeof window === "undefined") return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return;
  if (!textBlock.contains(range.startContainer) || !textBlock.contains(range.endContainer)) return;
  const selectedText = normalizeSelectionText(selection.toString());
  if (!selectedText) return;
  cachedStoryHighlightRange = range.cloneRange();
}

function bindStoryHighlightSelectionTracking(textBlock) {
  if (!textBlock || typeof window === "undefined") return;

  const deferredSync = () => window.setTimeout(() => updateCachedSelectionFromTextBlock(textBlock), 0);
  textBlock.addEventListener("mouseup", deferredSync);
  textBlock.addEventListener("keyup", deferredSync);
  textBlock.addEventListener("touchend", deferredSync, { passive: true });
}

function formatHighlightTimestamp(isoString) {
  if (!isoString) return "时间未知";
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "时间未知";
  return dt.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatHighlightTurnMeta(item, phaseLabels) {
  const phaseLabel = phaseLabels[item.phase] || item.phase || "未知时段";
  return `第${item.year || "?"}年 ${item.month || "?"}月 · ${phaseLabel}`;
}

function underlineFirstSnippetMatch(rootEl, snippet) {
  if (!rootEl || !snippet) return false;
  const textNodes = [];
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeValue && current.nodeValue.trim()) {
      textNodes.push(current);
    }
    current = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (parent && parent.closest(".story-user-highlight")) continue;
    const idx = textNode.nodeValue.indexOf(snippet);
    if (idx === -1) continue;

    const matched = textNode.splitText(idx);
    const remainder = matched.splitText(snippet.length);
    const wrap = document.createElement("span");
    wrap.className = "story-user-highlight";
    wrap.textContent = matched.nodeValue;
    matched.parentNode.replaceChild(wrap, matched);
    if (remainder && remainder.nodeType === Node.TEXT_NODE) {
      // keep node shape stable after replacement
    }
    return true;
  }

  return false;
}

function restoreHighlightsForTurn(textBlock, year, month, phase, state) {
  const turnKey = `${year}_${month}_${phase}`;
  const highlights = (state.storyHighlights || []).filter(
    (item) => item && item.turnKey === turnKey && typeof item.text === "string" && item.text.trim()
  );

  highlights.forEach((item) => {
    underlineFirstSnippetMatch(textBlock, item.text);
  });
}

function restoreCurrentTurnHighlights(textBlock, state) {
  const year = state.currentYear || 1;
  const month = state.currentMonth || 1;
  const phase = state.currentPhase || "morning";
  restoreHighlightsForTurn(textBlock, year, month, phase, state);
}

function addStoryHighlightFromSelection(textBlock, state) {
  const selected = getValidSelectionRangeForHighlight(textBlock);
  if (!selected.ok) {
    return selected;
  }

  const { range, selectedText, usedCached } = selected;

  const underline = document.createElement("span");
  underline.className = "story-user-highlight";

  try {
    const fragment = range.extractContents();
    underline.appendChild(fragment);
    range.insertNode(underline);
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (selection && !usedCached) {
      selection.removeAllRanges();
    }
    cachedStoryHighlightRange = null;
  } catch (_error) {
    return { ok: false, message: "当前选择范围不支持标注，请缩小选区后重试。" };
  }

  const existing = Array.isArray(state.storyHighlights) ? state.storyHighlights : [];
  const highlight = {
    id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: selectedText,
    year: state.currentYear || 1,
    month: state.currentMonth || 1,
    phase: state.currentPhase || "morning",
    turnKey: getCurrentTurnKey(state),
    createdAt: new Date().toISOString(),
  };

  const updated = [...existing, highlight].slice(-200);
  setState({ storyHighlights: updated });
  return { ok: true, message: "已加入标注合集。" };
}

function addCustomStoryHighlight(text, state) {
  const customText = normalizeSelectionText(text);
  if (!customText) {
    return { ok: false, message: "请输入要保存的自定义标注内容。" };
  }

  const existing = Array.isArray(state.storyHighlights) ? state.storyHighlights : [];
  const highlight = {
    id: `hl_custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: customText,
    year: state.currentYear || 1,
    month: state.currentMonth || 1,
    phase: state.currentPhase || "morning",
    turnKey: getCurrentTurnKey(state),
    createdAt: new Date().toISOString(),
    source: "custom",
  };

  const updated = [...existing, highlight].slice(-200);
  setState({ storyHighlights: updated });
  return { ok: true, message: "已保存自定义标注。" };
}

function showCustomHighlightInputModal(onSave) {
  const existing = document.getElementById("story-highlight-custom-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "story-highlight-custom-overlay";
  overlay.className = "story-highlight-custom-overlay";

  const panel = document.createElement("div");
  panel.className = "story-highlight-custom-panel";

  const header = document.createElement("div");
  header.className = "story-highlight-custom-panel__header";

  const title = document.createElement("div");
  title.className = "story-highlight-custom-panel__title";
  title.textContent = "新增自定义标注";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "story-highlight-custom-panel__close";
  closeBtn.textContent = "\u2715";

  const body = document.createElement("div");
  body.className = "story-highlight-custom-panel__body";

  const textarea = document.createElement("textarea");
  textarea.className = "story-highlight-custom-panel__textarea";
  textarea.placeholder = "输入你想记录的内容，例如：某臣建议与我的判断。";
  textarea.rows = 4;

  const hint = document.createElement("div");
  hint.className = "story-highlight-custom-panel__hint";
  hint.textContent = "最多保存 240 字。";

  const footer = document.createElement("div");
  footer.className = "story-highlight-custom-panel__footer";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "story-highlight-custom-panel__btn story-highlight-custom-panel__btn--cancel";
  cancelBtn.textContent = "取消";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "story-highlight-custom-panel__btn story-highlight-custom-panel__btn--save";
  saveBtn.textContent = "保存标注";
  saveBtn.disabled = true;

  const closeModal = () => {
    overlay.remove();
    document.removeEventListener("keydown", onEscape);
  };

  function onEscape(event) {
    if (event.key === "Escape") closeModal();
  }

  const syncSaveBtnState = () => {
    const value = textarea.value.slice(0, 240);
    if (textarea.value !== value) textarea.value = value;
    saveBtn.disabled = !normalizeSelectionText(value);
  };

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  textarea.addEventListener("input", syncSaveBtnState);

  saveBtn.addEventListener("click", () => {
    const value = textarea.value.slice(0, 240);
    if (!normalizeSelectionText(value)) return;
    const saved = typeof onSave === "function" ? onSave(value) : null;
    if (saved && saved.ok === false) {
      hint.textContent = saved.message || "保存失败，请重试。";
      hint.classList.add("story-highlight-custom-panel__hint--error");
      return;
    }
    closeModal();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });

  header.appendChild(title);
  header.appendChild(closeBtn);
  body.appendChild(textarea);
  body.appendChild(hint);
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);

  const app = document.getElementById("app");
  (app || document.body).appendChild(overlay);
  document.addEventListener("keydown", onEscape);
  window.setTimeout(() => textarea.focus(), 0);
}

function createStoryHighlightPanel(state, phaseLabels) {
  const panel = document.createElement("section");
  panel.className = "story-highlight-panel";
  if (storyHighlightPanelExpanded) panel.classList.add("story-highlight-panel--open");

  const header = document.createElement("button");
  header.type = "button";
  header.className = "story-highlight-panel__header";

  const title = document.createElement("span");
  title.className = "story-highlight-panel__title";

  const arrow = document.createElement("span");
  arrow.className = "story-highlight-panel__arrow";
  arrow.textContent = "▶";
  header.appendChild(title);
  header.appendChild(arrow);

  const body = document.createElement("div");
  body.className = "story-highlight-panel__body";

  const list = document.createElement("div");
  list.className = "story-highlight-list";
  body.appendChild(list);

  function removeHighlight(highlightId) {
    const latestState = getState();
    const updated = (latestState.storyHighlights || []).filter((item) => item.id !== highlightId);
    setState({ storyHighlights: updated });
    refreshPanel();
  }

  function clearAllHighlights() {
    setState({ storyHighlights: [] });
    refreshPanel();
  }

  function refreshPanel() {
    const latestState = getState();
    const highlights = Array.isArray(latestState.storyHighlights)
      ? [...latestState.storyHighlights].reverse()
      : [];
    title.textContent = `标注内容合集（${highlights.length}）`;

    list.innerHTML = "";

    const toolbar = document.createElement("div");
    toolbar.className = "story-highlight-list__toolbar";
    const customBtn = document.createElement("button");
    customBtn.type = "button";
    customBtn.className = "story-highlight-list__custom-btn";
    customBtn.textContent = "自定义标注";
    customBtn.addEventListener("click", () => {
      showCustomHighlightInputModal((customText) => {
        const result = addCustomStoryHighlight(customText, getState());
        if (result.ok) refreshPanel();
        return result;
      });
    });
    toolbar.appendChild(customBtn);
    list.appendChild(toolbar);

    if (!highlights.length) {
      const empty = document.createElement("div");
      empty.className = "story-highlight-list__empty";
      empty.textContent = "尚未记录标注。可先选中文本，再点击“下划线标注”。";
      list.appendChild(empty);
      return;
    }

    highlights.forEach((item) => {
      const row = document.createElement("article");
      row.className = "story-highlight-item";

      const text = document.createElement("div");
      text.className = "story-highlight-item__text";
      text.textContent = item.text || "（空标注）";
      row.appendChild(text);

      const meta = document.createElement("div");
      meta.className = "story-highlight-item__meta";
      meta.textContent = `${formatHighlightTurnMeta(item, phaseLabels)} · ${formatHighlightTimestamp(item.createdAt)}`;
      row.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "story-highlight-item__actions";
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "story-highlight-item__delete-btn";
      deleteBtn.textContent = "删除";
      deleteBtn.addEventListener("click", () => removeHighlight(item.id));
      actions.appendChild(deleteBtn);
      row.appendChild(actions);

      list.appendChild(row);
    });

    if (highlights.length > 0) {
      const clearAllBtn = document.createElement("button");
      clearAllBtn.type = "button";
      clearAllBtn.className = "story-highlight-list__clear-all-btn";
      clearAllBtn.textContent = "清空全部标注";
      clearAllBtn.addEventListener("click", () => clearAllHighlights());
      list.appendChild(clearAllBtn);
    }
  }

  header.addEventListener("click", () => {
    storyHighlightPanelExpanded = !storyHighlightPanelExpanded;
    panel.classList.toggle("story-highlight-panel--open", storyHighlightPanelExpanded);
  });

  refreshPanel();
  panel.appendChild(header);
  panel.appendChild(body);
  return { panel, refreshPanel };
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

function buildMinisterStorylineTag(characterId, characterName) {
  const normalizedName = String(characterName || "").replace(/\s+/g, "");
  const normalizedId = String(characterId || "").replace(/\s+/g, "");
  return `${normalizedName || normalizedId || "未知臣工"}_线`;
}

function mergeUniqueStrings(base, extra) {
  const out = Array.isArray(base) ? [...base] : [];
  (Array.isArray(extra) ? extra : []).forEach((item) => {
    if (!item || typeof item !== "string") return;
    if (!out.includes(item)) out.push(item);
  });
  return out;
}

function applyEffects(effects) {
  if (!effects) return;
  const s = getState();
  const roster = getRosterCharacters(s);
  const normalizedEffects = normalizeAppointmentEffects(effects, {
    positions: s.positionsMeta?.positions || [],
    ministers: roster,
  }) || effects;
  const ministers = Array.isArray(roster) ? roster : [];
  const ministerNameById = buildNameById(ministers);
  const storylineTagsToClose = [];
  
  const { nation: newNation, loyalty: newLoyalty } = applyEffectsModule(s.nation || {}, normalizedEffects, s.loyalty || {});
  setState({ nation: newNation, loyalty: newLoyalty });

  if (normalizedEffects.appointments && typeof normalizedEffects.appointments === "object" && !Array.isArray(normalizedEffects.appointments)) {
    const currentState = getState();
    const beforeAppointments = { ...(currentState.appointments || {}) };
    const appointments = { ...beforeAppointments };
    for (const [positionId, characterId] of Object.entries(normalizedEffects.appointments)) {
      if (typeof positionId !== "string" || typeof characterId !== "string") continue;
      if (currentState.characterStatus?.[characterId]?.isAlive === false) continue;
      for (const [posId, charId] of Object.entries(appointments)) {
        if (charId === characterId && posId !== positionId) {
          delete appointments[posId];
        }
      }
      appointments[positionId] = characterId;
    }

    const beforeHolders = new Set(Object.values(beforeAppointments).filter((id) => typeof id === "string"));
    const afterHolders = new Set(Object.values(appointments).filter((id) => typeof id === "string"));
    for (const holderId of beforeHolders) {
      if (!afterHolders.has(holderId)) {
        storylineTagsToClose.push(buildMinisterStorylineTag(holderId, ministerNameById[holderId]));
      }
    }

    setState({ appointments });
  }

  if (Array.isArray(normalizedEffects.appointmentDismissals) && normalizedEffects.appointmentDismissals.length) {
    const currentState = getState();
    const appointments = { ...(currentState.appointments || {}) };
    const dismissSet = new Set(
      normalizedEffects.appointmentDismissals
        .filter((id) => typeof id === "string" && id.trim())
        .map((id) => id.trim())
    );

    if (dismissSet.size) {
      for (const positionId of dismissSet) {
        const removedHolder = appointments[positionId];
        if (removedHolder) {
          storylineTagsToClose.push(buildMinisterStorylineTag(removedHolder, ministerNameById[removedHolder]));
          delete appointments[positionId];
        }
      }
      setState({ appointments });
    }
  }

  if (normalizedEffects.characterDeath && typeof normalizedEffects.characterDeath === "object") {
    const currentState = getState();
    const characterStatus = { ...(currentState.characterStatus || {}) };
    for (const [characterId, reason] of Object.entries(normalizedEffects.characterDeath)) {
      if (typeof characterId !== "string") continue;
      characterStatus[characterId] = {
        isAlive: false,
        deathReason: typeof reason === "string" ? reason : "处死",
        deathDay: currentState.currentMonth || 1,
      };
      storylineTagsToClose.push(buildMinisterStorylineTag(characterId, ministerNameById[characterId]));
    }
    const appointments = { ...(currentState.appointments || {}) };
    for (const characterId of Object.keys(normalizedEffects.characterDeath)) {
      for (const [posId, charId] of Object.entries(appointments)) {
        if (charId === characterId) {
          delete appointments[posId];
        }
      }
    }
    setState({ characterStatus, appointments });
    updateMinisterTabBadge(getState());
  }

  if (storylineTagsToClose.length) {
    const latest = getState();
    const mergedClosed = mergeUniqueStrings(latest.closedStorylines, storylineTagsToClose);
    if (mergedClosed.length !== (latest.closedStorylines || []).length) {
      setState({ closedStorylines: mergedClosed });
    }
  }
}

function computeQuarterlyEffects(state, currentMonth) {
  if (typeof currentMonth !== "number") return null;
  if (currentMonth % 3 !== 0) return null;

  const nation = state.nation || {};
  const policy = (state.config && state.config.economicPolicy) || {};
  const abilities = state.playerAbilities || {};
  const unlocked = state.unlockedPolicies || [];
  const policyBonus = getPolicyBonusSummary(unlocked, state.config?.balance);
  const customBonus = computeCustomPolicyQuarterBonus(state);

  const baseTreasury = policy.baseTreasury || 100000;
  const baseGrain = policy.baseGrain || 20000;

  const efficiency = Math.max(0.2, Math.min(1.5, 1 - (nation.corruptionLevel || 0) / 200));
  const moraleBonus = 1 + ((nation.civilMorale || 50) - 50) / 200;

  const managementBonus = 1 + (abilities.management || 0) * 0.08;
  const scholarshipBonus = 1 + (abilities.scholarship || 0) * 0.05;
  const treasuryPolicyBonus = policyBonus.quarterlyTreasuryRatio;
  const grainPolicyBonus = policyBonus.quarterlyGrainRatio;

  const treasuryGain = Math.round(baseTreasury * efficiency * moraleBonus * managementBonus * treasuryPolicyBonus * customBonus.treasuryRatio);
  const grainGain = Math.round(baseGrain * efficiency * moraleBonus * scholarshipBonus * grainPolicyBonus * customBonus.grainRatio);

  return {
    treasury: treasuryGain,
    grain: grainGain,
    militaryStrength: customBonus.militaryDelta + (policyBonus.quarterlyMilitaryDelta || 0),
    corruptionLevel: customBonus.corruptionDelta + (policyBonus.quarterlyCorruptionDelta || 0),
    _customPolicyBonus: customBonus,
  };
}

function mergeEffects(a = {}, b = {}) {
  const merged = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (key === "loyalty" && typeof value === "object") {
      merged.loyalty = { ...(merged.loyalty || {}) };
      for (const [id, delta] of Object.entries(value)) {
        if (typeof delta !== "number") continue;
        merged.loyalty[id] = (merged.loyalty[id] || 0) + delta;
      }
    } else if (typeof value === "number") {
      merged[key] = (merged[key] || 0) + value;
    }
  }
  return merged;
}

function estimateEffectsFromEdict(edictText) {
  if (!edictText || typeof edictText !== "string") return null;
  const text = edictText.toLowerCase();
  const effects = {};

  const add = (key, value) => {
    if (typeof value !== "number" || value === 0) return;
    effects[key] = (effects[key] || 0) + value;
  };

  const matches = (patterns) => patterns.some((p) => text.includes(p));

  const parseExplicitResourceDelta = (sourceText) => {
    const parsed = {};
    const addParsed = (key, value) => {
      if (typeof value !== "number" || value === 0) return;
      parsed[key] = (parsed[key] || 0) + value;
    };

    const incomeHints = ["抄", "抄没", "没收", "入库", "充入", "征收", "征缴", "增收", "加征", "追缴", "罚没", "获得", "获", "充盈", "补入"];
    const expenseHints = ["拨", "拨付", "发放", "发给", "赈", "赈济", "开仓", "支出", "耗费", "减免", "免除", "补发", "军饷", "采买", "修缮", "施放", "急调", "调拨", "调运", "速运"];

    const text = String(sourceText || "");

    // Sentence-level fallback: if the whole sentence clearly expresses expense or income,
    // use that as the sign for amounts whose immediate prefix doesn't match a hint word
    // (e.g. "银八万两" — "银" is not a hint, but the sentence contains "急调"/"速运").
    const sentenceIsExpense = expenseHints.some((h) => text.includes(h));
    const sentenceIsIncome = incomeHints.some((h) => text.includes(h));
    const sentenceSign = (sentenceIsExpense && !sentenceIsIncome) ? -1
      : (sentenceIsIncome && !sentenceIsExpense) ? 1 : 0;

    function getSign(prefix) {
      const p = String(prefix || "");
      const inc = incomeHints.some((h) => p.includes(h));
      const exp = expenseHints.some((h) => p.includes(h));
      if (inc && !exp) return 1;
      if (exp && !inc) return -1;
      return sentenceSign; // 0 means ambiguous → caller skips
    }

    // Pattern 1: arabic digits + 万 + unit   e.g. "30万两", "5万石"
    for (const m of text.matchAll(/([\u4e00-\u9fa5A-Za-z]{0,10})\s*(\d+(?:\.\d+)?)\s*万\s*(两|石)/g)) {
      const sign = getSign(m[1]);
      if (!sign) continue;
      const amount = Math.round(Number(m[2]) * 10000);
      if (amount <= 0) continue;
      if (m[3] === "两") addParsed("treasury", sign * amount);
      if (m[3] === "石") addParsed("grain", sign * amount);
    }

    // Pattern 2: Chinese numeral + unit   e.g. "八万两", "五千石", "三十万两"
    // Amount must start with a single Chinese digit (一-九), not a scale char (十百千万)
    // so we don't accidentally match unrelated characters.
    const cnDigitMap = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    function parseCnAmount(s) {
      let result = 0, section = 0, cur = 0;
      for (const c of String(s)) {
        if (c in cnDigitMap) { cur = cnDigitMap[c]; }
        else if (c === "十") { section += (cur === 0 ? 1 : cur) * 10; cur = 0; }
        else if (c === "百") { section += cur * 100; cur = 0; }
        else if (c === "千") { section += cur * 1000; cur = 0; }
        else if (c === "万") { section += cur; result += section * 10000; section = 0; cur = 0; }
      }
      return result + section + cur;
    }

    const cnAmountRe = /([\u4e00-\u9fa5A-Za-z、，。；]{0,10}?)([一二三四五六七八九][零一二三四五六七八九十百千万]*)\s*(两|石)/g;
    for (const m of text.matchAll(cnAmountRe)) {
      const sign = getSign(m[1]);
      if (!sign) continue;
      const amount = parseCnAmount(m[2]);
      if (amount <= 0) continue;
      if (m[3] === "两") addParsed("treasury", sign * amount);
      if (m[3] === "石") addParsed("grain", sign * amount);
    }

    return parsed;
  };

  // 常见词条推理
  if (matches(["抄家", "抄家得", "抄了", "没收", "抄" ])) {
    add("treasury", 300000);
    add("corruptionLevel", -5);
  }
  if (matches(["发军饷", "军饷", "军费"])) {
    add("treasury", -200000);
    add("militaryStrength", 8);
    add("civilMorale", 3);
  }
  if (matches(["增兵", "募兵", "扩军", "调兵"])) {
    add("treasury", -150000);
    add("militaryStrength", 10);
  }
  if (matches(["开仓", "赈灾", "赈济", "赈恤", "发粮"])) {
    add("grain", -20000);
    add("civilMorale", 6);
  }
  if (matches(["减免赋税", "减税", "免税", "免除赋税"])) {
    add("treasury", -150000);
    add("civilMorale", 8);
  }
  if (matches(["征税", "加税", "税收" ]) && !matches(["减税", "减免", "免税"])) {
    add("treasury", 200000);
    add("civilMorale", -6);
  }
  if (matches(["整顿吏治", "肃贪", "清吏", "惩治贪腐"])) {
    add("corruptionLevel", -10);
    add("civilMorale", 4);
  }
  if (matches(["招安", "招抚", "招降"])) {
    add("borderThreat", -8);
    add("civilMorale", 4);
  }
  if (matches(["祭天", "祈福", "祭祀"])) {
    add("treasury", -50000);
    add("civilMorale", 3);
  }
  if (matches(["下罪己诏", "罪己", "谢罪"])) {
    add("corruptionLevel", -5);
    add("civilMorale", 3);
  }

  const explicitDelta = parseExplicitResourceDelta(edictText);
  if (typeof explicitDelta.treasury === "number") add("treasury", explicitDelta.treasury);
  if (typeof explicitDelta.grain === "number") add("grain", explicitDelta.grain);

  // 如果没有检测到任何关键词，则不估算效果
  return Object.keys(effects).length ? sanitizeStoryEffects(effects) : null;
}

function auditCustomEdictCorrection(prevEffects, nextEffects, deltaEffects) {
  if (!prevEffects || !nextEffects || !deltaEffects) return;
  const keys = ["treasury", "grain", "militaryStrength", "civilMorale", "borderThreat", "disasterLevel", "corruptionLevel"];
  const issues = [];
  for (const key of keys) {
    const prevVal = typeof prevEffects[key] === "number" ? prevEffects[key] : 0;
    const nextVal = typeof nextEffects[key] === "number" ? nextEffects[key] : 0;
    const deltaVal = typeof deltaEffects[key] === "number" ? deltaEffects[key] : 0;
    if (!prevVal || !nextVal || !deltaVal) continue;
    if ((prevVal > 0 && nextVal < 0) || (prevVal < 0 && nextVal > 0)) {
      issues.push({ key, prevVal, nextVal, deltaVal });
    }
  }
  if (issues.length) {
    console.warn("[story-self-check] custom_edict effect sign flip detected", issues);
  }
}

function computeEffectDelta(prevEffects, nextEffects) {
  if (!nextEffects) return null;
  const delta = {};

  const addDelta = (key, value) => {
    if (typeof value !== "number" || value === 0) return;
    delta[key] = (delta[key] || 0) + value;
  };

  // Only reconcile keys explicitly provided by LLM `nextEffects`.
  // Missing keys mean "no correction", not "reset to 0".
  const nextKeys = Object.keys(nextEffects);
  for (const key of nextKeys) {
    if (key === "loyalty") continue;
    const prevVal = prevEffects && typeof prevEffects[key] === "number" ? prevEffects[key] : 0;
    const nextVal = typeof nextEffects[key] === "number" ? nextEffects[key] : 0;
    if (typeof nextEffects[key] !== "number") continue;
    const diff = nextVal - prevVal;
    if (diff !== 0) addDelta(key, diff);
  }

  if (nextEffects.loyalty && typeof nextEffects.loyalty === "object") {
    const prevLoyalty = (prevEffects && prevEffects.loyalty) || {};
    const userIds = new Set([...Object.keys(prevLoyalty), ...Object.keys(nextEffects.loyalty)]);
    const loyaltyDelta = {};
    for (const id of userIds) {
      const prevVal = typeof prevLoyalty[id] === "number" ? prevLoyalty[id] : 0;
      const nextVal = typeof nextEffects.loyalty[id] === "number" ? nextEffects.loyalty[id] : 0;
      const diff = nextVal - prevVal;
      if (diff !== 0) loyaltyDelta[id] = diff;
    }
    if (Object.keys(loyaltyDelta).length) delta.loyalty = loyaltyDelta;
  }

  return Object.keys(delta).length ? delta : null;
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

function isQuarterSettlementMonth(state) {
  return !!(
    state?.lastQuarterSettlement &&
    state.lastQuarterSettlement.year === state.currentYear &&
    state.lastQuarterSettlement.month === state.currentMonth
  );
}

function renderStoryHistory(container, history, phaseLabels, state, renderId) {
  const quarterSettlementMonth = isQuarterSettlementMonth(state);

  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    if (renderId != null && container._storyRenderId !== renderId) return false;
    
    const data = entry.data;
    const keyParts = String(entry.key || "").split("_");
    let year = String(state.currentYear || 1);
    let month = String(state.currentMonth || 1);
    let phase = state.currentPhase || "morning";
    if (keyParts.length >= 3) {
      [year, month, phase] = keyParts;
    } else if (keyParts.length === 2) {
      [month, phase] = keyParts;
    }
    const phaseLabel = phaseLabels[phase] || phase;
    
    const label = document.createElement("div");
    label.className = "story-history-label";
    label.textContent = `第${year}年 ${month}月 · ${phaseLabel}`;
    container.appendChild(label);
    
    const block = document.createElement("div");
    block.className = "edict-block story-history-block";
    const historyText = buildBlockText(data);
    renderPseudoLines(block, historyText);
    restoreHighlightsForTurn(block, parseInt(year, 10), parseInt(month, 10), phase, state);
    container.appendChild(block);
    
    if (entry.chosenChoice && entry.chosenChoice.text) {
      renderChosenChoice(container, entry.chosenChoice);
      const isLatestHistoryEntry = index === history.length - 1;
      const shouldSkipLatestDeltaInQuarter = quarterSettlementMonth && isLatestHistoryEntry;
      if (!shouldSkipLatestDeltaInQuarter) {
        renderDeltaCard(container, entry.displayEffects || entry.effects, state, "本轮推演数值变动");
      }
    }
  }
  return true;
}

function mergeQuarterDisplayEffectsDedup(baseEffects, quarterEffects) {
  const merged = { ...(baseEffects && typeof baseEffects === "object" ? baseEffects : {}) };

  DISPLAY_STATE_METRICS.forEach(({ key }) => {
    const quarterValue = quarterEffects?.[key];
    if (typeof quarterValue !== "number" || quarterValue === 0) return;
    if (typeof merged[key] !== "number") {
      merged[key] = quarterValue;
    }
  });

  return merged;
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

function mergeRigidAndLLMStoryParagraphs(rigidParagraphs, llmParagraphs) {
  const rigid = Array.isArray(rigidParagraphs) ? rigidParagraphs.filter(Boolean) : [];
  const llm = Array.isArray(llmParagraphs) ? llmParagraphs.filter(Boolean) : [];
  if (!llm.length) return rigid;

  const normalized = new Set();
  const out = [];
  const pushUnique = (text) => {
    const key = String(text).replace(/\s+/g, "").slice(0, 80);
    if (!key || normalized.has(key)) return;
    normalized.add(key);
    out.push(text);
  };

  llm.forEach(pushUnique);
  rigid.slice(0, 3).forEach(pushUnique);
  return out;
}

function buildRigidStoryFallback(state) {
  const ensured = ensureRigidState(state);
  return buildRigidStoryData(
    {
      ...state,
      rigid: ensured.rigid,
    },
    getRigidPresets(state)
  );
}

async function loadStoryData(state, container, renderId, onChoice, options) {
  const year = state.currentYear || 1;
  const month = state.currentMonth || 1;
  const phaseKey = state.currentPhase || "morning";
  const path = `data/story/year${year}_month${month}_${phaseKey}.json`;
  const cacheKey = `${year}_${month}_${phaseKey}`;
  const config = state.config || {};
  const rigidMode = isRigidMode(state);
  const isFirstTurn = (state.lastChoiceId == null) && (!Array.isArray(state.storyHistory) || state.storyHistory.length === 0);

  // For hard mode first turn, use dedicated hard_mode_day1_morning.json instead of generic day1_morning.json
  const templateFallbackPath = (rigidMode && isFirstTurn) 
    ? `data/story/hard_mode_day1_${phaseKey}.json`
    : `data/story/day1_${phaseKey}.json`;

  if (state.currentStoryTurn && state.currentStoryTurn.key === cacheKey && state.currentStoryTurn.data) {
    storyCache = { key: cacheKey, data: state.currentStoryTurn.data };
    return state.currentStoryTurn.data;
  }

  if (storyCache.key === cacheKey && storyCache.data) {
    return storyCache.data;
  }

  const useLLM = !isFirstTurn && config.storyMode === "llm" && (config.apiBase || "").trim().length > 0;
  let data = null;

  if (useLLM) {
    const loadingBlock = renderStoryLoading(container);
    const lastChoice = state.lastChoiceId != null
      ? { id: state.lastChoiceId, text: state.lastChoiceText || "", hint: state.lastChoiceHint }
      : null;

    try {
      data = await requestStoryTurn(state, lastChoice);
    } catch (_error) {
      data = null;
    } finally {
      loadingBlock.remove();
    }

    if (renderId != null && container._storyRenderId !== renderId) return null;
  }

  if (data == null) {
    try {
      // Template mode uses a curated baseline script by phase to avoid missing-file noise.
      const templatePath = (config.storyMode === "llm" && !isFirstTurn) ? path : templateFallbackPath;
      data = await loadJSON(templatePath);
    } catch (_error) {
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

  if (rigidMode) {
    const rigidFallback = buildRigidStoryFallback(state);
    const rigidGateActive = !!(state?.rigid?.pendingAssassinate || state?.rigid?.pendingBranchEvent || state?.rigid?.court?.strikeState);
    const incomingChoices = Array.isArray(data?.choices) ? data.choices : [];
    const mergedChoices = (!rigidGateActive && incomingChoices.length >= 3)
      ? incomingChoices
      : rigidFallback.choices;
    data = {
      ...rigidFallback,
      ...(data || {}),
      header: {
        ...(rigidFallback.header || {}),
        ...((data && data.header) || {}),
      },
      storyParagraphs: mergeRigidAndLLMStoryParagraphs(rigidFallback.storyParagraphs, data?.storyParagraphs),
      choices: mergedChoices,
      rigidMeta: {
        ...(rigidFallback.rigidMeta || {}),
        ...((data && data.rigidMeta) || {}),
      },
    };
  }

  const normalizedData = data && typeof data === "object" ? data : {};
  storyCache = { key: cacheKey, data: normalizedData };
  setState({ currentStoryTurn: { key: cacheKey, data: normalizedData } });
  return normalizedData;
}

function updateStoryState(data) {
  const state = getState();
  const systemNews = Array.isArray(state.systemNewsToday) ? state.systemNewsToday : [];
  const systemPublicOpinion = Array.isArray(state.systemPublicOpinion) ? state.systemPublicOpinion : [];
  if (data.news || systemNews.length) {
    setState({ newsToday: [...systemNews, ...(Array.isArray(data.news) ? data.news : [])] });
  }
  if (data.publicOpinion || systemPublicOpinion.length) {
    setState({ publicOpinion: [...systemPublicOpinion, ...(Array.isArray(data.publicOpinion) ? data.publicOpinion : [])] });
  }
  if (data.header && data.header.weather) {
    setState({ weather: data.header.weather });
  }
}

function createChoiceButton(choice, onChoice, disabled = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "story-action-btn";
  const localDisabled = disabled || storyChoiceSubmitting;
  if (localDisabled) btn.classList.add("story-action-btn--disabled");
  btn.disabled = localDisabled;
  btn.innerHTML = `<div>${choice.text}</div>${choice.hint ? `<span>${choice.hint}</span>` : ""}`;
  btn.addEventListener("click", async () => {
    if (disabled || storyChoiceSubmitting) return;
    storyChoiceSubmitting = true;
    const actionsWrap = btn.closest(".story-actions");
    if (actionsWrap) {
      actionsWrap.querySelectorAll("button").forEach((node) => {
        node.disabled = true;
        node.classList.add("story-action-btn--disabled");
      });
    }
    try {
      await onChoice(choice.id, choice.text, choice.hint, choice.effects);
    } finally {
      storyChoiceSubmitting = false;
    }
  });
  return btn;
}

function renderQuarterAgendaPanel(container, state, onChoice, options = {}) {
  const agenda = Array.isArray(state.currentQuarterAgenda) ? state.currentQuarterAgenda : [];
  if (!agenda.length) return;

  const resolveSeverity = (value) => {
    if (value === "急") return { label: "急", cls: "urgent" };
    if (value === "缓") return { label: "缓", cls: "normal" };
    return { label: "重", cls: "important" };
  };

  const focus = state.currentQuarterFocus || {};
  const rerender = () => {
    container.innerHTML = "";
    renderStoryTurn(getState(), container, onChoice, options);
  };

  const panel = document.createElement("div");
  panel.className = "quarter-agenda-panel";

  const title = document.createElement("div");
  title.className = "quarter-agenda-panel__title";
  title.textContent = `季度奏折 · 本季需先选定议题与立场`; 
  panel.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.className = "quarter-agenda-panel__subtitle";
  subtitle.textContent = `本季度必须先浏览 3-5 条时政议题，选定商议派系与观点后再颁布诏书；若存在敌对势力，将出现“军事开拓”议题。`;
  panel.appendChild(subtitle);

  const cards = document.createElement("div");
  cards.className = "quarter-agenda-grid";
  agenda.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "quarter-agenda-card" + (focus.agendaId === item.id ? " quarter-agenda-card--active" : "");
    const severity = resolveSeverity(item.severity);
    card.innerHTML = `<div class="quarter-agenda-card__title-row"><div class="quarter-agenda-card__title">${item.title}</div><span class="quarter-agenda-card__badge quarter-agenda-card__badge--${severity.cls}">${severity.label}</span></div><div class="quarter-agenda-card__summary">${item.summary}</div><div class="quarter-agenda-card__meta">关联：${(item.impacts || []).join("、")}</div>`;
    card.addEventListener("click", () => {
      setState({
        currentQuarterFocus: {
          agendaId: item.id,
          stance: focus.agendaId === item.id ? focus.stance || null : null,
          factionId: focus.agendaId === item.id ? focus.factionId || null : null,
        },
      });
      rerender();
    });
    cards.appendChild(card);
  });
  panel.appendChild(cards);

  const selectedAgenda = agenda.find((item) => item.id === focus.agendaId) || null;
  if (selectedAgenda) {
    const stanceWrap = document.createElement("div");
    stanceWrap.className = "quarter-agenda-control";
    stanceWrap.innerHTML = `<div class="quarter-agenda-control__label">选择观点</div>`;
    const stances = [
      ["support", "支持"],
      ["compromise", "折中"],
      ["oppose", "反对"],
      ["suppress", "压下党争"],
    ];
    const stanceButtons = document.createElement("div");
    stanceButtons.className = "quarter-agenda-chip-row";
    stances.forEach(([value, label]) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "quarter-agenda-chip" + (focus.stance === value ? " quarter-agenda-chip--active" : "");
      chip.textContent = label;
      chip.addEventListener("click", () => {
        setState({ currentQuarterFocus: { ...focus, agendaId: selectedAgenda.id, stance: value } });
        rerender();
      });
      stanceButtons.appendChild(chip);
    });
    stanceWrap.appendChild(stanceButtons);
    panel.appendChild(stanceWrap);

    const factionWrap = document.createElement("div");
    factionWrap.className = "quarter-agenda-control";
    factionWrap.innerHTML = `<div class="quarter-agenda-control__label">选择商议派系</div>`;
    const factionButtons = document.createElement("div");
    factionButtons.className = "quarter-agenda-chip-row";
    (state.factions || []).forEach((faction) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "quarter-agenda-chip" + (focus.factionId === faction.id ? " quarter-agenda-chip--active" : "");
      chip.textContent = faction.name;
      chip.addEventListener("click", () => {
        setState({ currentQuarterFocus: { ...focus, agendaId: selectedAgenda.id, factionId: faction.id } });
        rerender();
      });
      factionButtons.appendChild(chip);
    });
    factionWrap.appendChild(factionButtons);
    panel.appendChild(factionWrap);
  }

  const ready = !!(focus.agendaId && focus.stance && focus.factionId);
  const footer = document.createElement("div");
  footer.className = "quarter-agenda-panel__footer";
  footer.textContent = ready
    ? "季度议题已锁定，现可继续选择系统选项或撰写诏书。"
    : "需先选定议题、立场和商议派系，季度诏书流程才会解锁。";
  panel.appendChild(footer);
  return panel;
}

function renderCurrentTurn(container, data, state, phaseLabels, onChoice, options = {}) {
  const phaseKey = state.currentPhase || "morning";
  const currentPhaseLabel = phaseLabels[phaseKey] || phaseKey;
  
  const currentLabel = document.createElement("div");
  currentLabel.className = "story-history-label story-current-label";
  currentLabel.textContent = `当前 · 第${state.currentYear}年 ${state.currentMonth}月 · ${currentPhaseLabel}`;
  container.appendChild(currentLabel);
  
  const currentWrap = document.createElement("div");
  currentWrap.className = "edict-current-wrap";
  container.appendChild(currentWrap);

  const settlement = state.lastQuarterSettlement;
  if (
    settlement &&
    settlement.year === state.currentYear &&
    settlement.month === state.currentMonth
  ) {
    const quarterNote = document.createElement("div");
    quarterNote.className = "story-history-label";
    quarterNote.textContent = `季末结算 · 崇祯${settlement.year}年${settlement.month}月：国库 +${(settlement.effects?.treasury || 0).toLocaleString()} 两，粮储 +${(settlement.effects?.grain || 0).toLocaleString()} 石`;
    currentWrap.appendChild(quarterNote);

    const settlementDisplayEffects = {
      treasury: settlement.effects?.treasury || 0,
      grain: settlement.effects?.grain || 0,
      militaryStrength: settlement.effects?.militaryStrength || 0,
      corruptionLevel: settlement.effects?.corruptionLevel || 0,
    };

    const history = Array.isArray(state.storyHistory) ? state.storyHistory : [];
    const latestHistoryEntry = history.length ? history[history.length - 1] : null;
    const latestDisplayEffects = latestHistoryEntry?.displayEffects || latestHistoryEntry?.effects || null;
    const mergedQuarterDisplayEffects = mergeQuarterDisplayEffectsDedup(latestDisplayEffects, settlementDisplayEffects);

    renderDeltaCard(currentWrap, mergedQuarterDisplayEffects, state, "季度结算数值变动");
  }

  const quarterPanel = renderQuarterAgendaPanel(container, state, onChoice, options);

  if (isRigidMode(state)) {
    const rigidHistory = Array.isArray(state.storyHistory) ? state.storyHistory : [];
    const latestRigidHistory = rigidHistory.length ? rigidHistory[rigidHistory.length - 1] : null;
    const latestRigidHistoryDelta = latestRigidHistory?.displayEffects || latestRigidHistory?.effects || null;
    const rigidDelta = state?.rigid?.lastSettlementDelta;
    if (hasOutcomeDisplayDelta(rigidDelta) && !hasOutcomeDisplayDelta(latestRigidHistoryDelta)) {
      renderDeltaCard(currentWrap, rigidDelta, state, "本轮数值变化");
    }
  }

  const textBlock = document.createElement("div");
  textBlock.className = "edict-block";
  const fullText = buildBlockText(data);
  renderPseudoLines(textBlock, fullText);
  bindStoryHighlightSelectionTracking(textBlock);
  restoreCurrentTurnHighlights(textBlock, state);
  currentWrap.appendChild(textBlock);

  const highlightToolbar = document.createElement("div");
  highlightToolbar.className = "story-highlight-toolbar";

  const annotateBtn = document.createElement("button");
  annotateBtn.type = "button";
  annotateBtn.className = "story-highlight-toolbar__btn";
  annotateBtn.textContent = "下划线标注选中文本";
  highlightToolbar.appendChild(annotateBtn);

  const annotateHint = document.createElement("span");
  annotateHint.className = "story-highlight-toolbar__hint";
  annotateHint.textContent = "先在上方剧情中拖选文字，再点击按钮。";
  highlightToolbar.appendChild(annotateHint);

  currentWrap.appendChild(highlightToolbar);

  const { panel: highlightPanel, refreshPanel } = createStoryHighlightPanel(state, phaseLabels);
  currentWrap.appendChild(highlightPanel);

  annotateBtn.addEventListener("click", () => {
    const latest = getState();
    const result = addStoryHighlightFromSelection(textBlock, latest);
    annotateHint.textContent = result.message;
    annotateHint.classList.toggle("story-highlight-toolbar__hint--error", !result.ok);
    if (result.ok) {
      refreshPanel();
    }
  });
  
  const actionsWrap = document.createElement("div");
  actionsWrap.className = "story-actions";
  const requiresQuarterFocus = Array.isArray(state.currentQuarterAgenda) && state.currentQuarterAgenda.length > 0;
  const quarterReady = !!(state.currentQuarterFocus && state.currentQuarterFocus.agendaId && state.currentQuarterFocus.stance && state.currentQuarterFocus.factionId);
  
  // Check if we are in the first turn (opening scenario) - if so, don't apply strike block
  const isFirstTurn = (state.lastChoiceId == null) && (!Array.isArray(state.storyHistory) || state.storyHistory.length === 0);
  
  const rigidStrikeBlocked = !isFirstTurn && isRigidMode(state) && !!state?.rigid?.court?.strikeState;
  const hasStrikeRecoveryChoice = isRigidMode(state)
    && Array.isArray(data.choices)
    && data.choices.some((choice) => String(choice?.id || "").startsWith("rigid_strike_"));
  const disableActions = (requiresQuarterFocus && !quarterReady) || (rigidStrikeBlocked && !hasStrikeRecoveryChoice);
  if (rigidStrikeBlocked) {
    const strikeTip = document.createElement("div");
    strikeTip.className = "story-history-label";
    strikeTip.textContent = "朝政停摆，无法施政。";
    currentWrap.appendChild(strikeTip);
  }
  
  (data.choices || []).forEach((choice) => {
    const btn = createChoiceButton(choice, onChoice, disableActions);
    actionsWrap.appendChild(btn);
  });
  
  const customBtn = document.createElement("button");
  customBtn.type = "button";
  customBtn.className = "story-action-btn story-action-btn--custom";
  if (disableActions || storyChoiceSubmitting) {
    customBtn.disabled = true;
    customBtn.classList.add("story-action-btn--disabled");
  }
  customBtn.innerHTML = `<div>自拟诏书</div><span>亲笔拟定旨意，由朝臣代为施行</span>`;
  customBtn.addEventListener("click", () => {
    if (disableActions || storyChoiceSubmitting) return;
    storyChoiceSubmitting = true;
    showCustomEdictPanel(onChoice, state);
  });
  actionsWrap.appendChild(customBtn);

  // 季度奏折面板后置到剧情与标注区域之后、选项按钮之前
  if (quarterPanel) currentWrap.appendChild(quarterPanel);
  
  currentWrap.appendChild(actionsWrap);
}

export async function renderStoryTurn(state, container, onChoice, options = {}) {
  storyChoiceSubmitting = false;
  const renderId = options && options.renderId;
  if (renderId != null && container._storyRenderId !== renderId) return;

  setupDanmuLayer(container);

  const config = state.config || {};
  const phaseLabels = config.phaseLabels || { morning: "早朝", afternoon: "午后", evening: "夜间" };
  const history = state.storyHistory || [];
  
  if (!renderStoryHistory(container, history, phaseLabels, state, renderId)) return;

  const data = await loadStoryData(state, container, renderId, onChoice, options);
  if (data == null) return;

  if (data.lastChoiceEffects && state.lastChoiceId != null) {
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.chosenChoice) {
      const prevEffects = sanitizeStoryEffects(lastEntry.effects || null);
      const nextEffects = sanitizeStoryEffects(data.lastChoiceEffects);
      const deltaEffects = computeEffectDelta(prevEffects, nextEffects);
      if (state.lastChoiceId === "custom_edict") {
        auditCustomEdictCorrection(prevEffects, nextEffects, deltaEffects);
      }

      const beforeCorrectionSnapshot = captureDisplayStateSnapshot(getState());
      if (deltaEffects) {
        applyEffects(deltaEffects);
      }
      const afterCorrectionSnapshot = captureDisplayStateSnapshot(getState());
      const correctionDisplayEffects = buildOutcomeDisplayDelta(beforeCorrectionSnapshot, afterCorrectionSnapshot);

      lastEntry.effects = nextEffects;
      const mergedDisplayEffects = hasOutcomeDisplayDelta(correctionDisplayEffects)
        ? mergeOutcomeDisplayDelta(lastEntry.displayEffects || lastEntry.effects || {}, correctionDisplayEffects)
        : (lastEntry.displayEffects || nextEffects);
      lastEntry.displayEffects = mergedDisplayEffects;
      const updatedHistory = [...history];
      updatedHistory[updatedHistory.length - 1] = lastEntry;
      setState({ storyHistory: updatedHistory });

      const historyContainer = container.querySelector('.story-history-container') || container;
      const deltaCards = historyContainer.querySelectorAll('.story-delta-card');
      const lastDeltaCard = deltaCards[deltaCards.length - 1];
      if (lastDeltaCard) lastDeltaCard.remove();
      const latestState = getState();
      if (!isQuarterSettlementMonth(latestState)) {
        renderDeltaCard(historyContainer, mergedDisplayEffects, latestState, "本轮推演数值变动");
      }
    }
  }

  updateStoryState(data);

  if (renderId != null && container._storyRenderId !== renderId) return;

  renderCurrentTurn(container, data, state, phaseLabels, onChoice, options);

  startDanmu(container);
}

function showCustomEdictPanel(onChoice, state) {
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
  closeBtn.addEventListener("click", () => {
    storyChoiceSubmitting = false;
    overlay.remove();
  });
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const focus = state && state.currentQuarterFocus;
  const agenda = (state?.currentQuarterAgenda || []).find((item) => item.id === focus?.agendaId);
  const faction = (state?.factions || []).find((item) => item.id === focus?.factionId);
  if (agenda && focus && faction) {
    const info = document.createElement("div");
    info.className = "custom-edict-panel__context";
    const stanceMap = { support: "支持", compromise: "折中", oppose: "反对", suppress: "压下党争" };
    info.textContent = `本季度议题：${agenda.title} · 观点：${stanceMap[focus.stance] || focus.stance} · 商议派系：${faction.name}`;
    panel.appendChild(info);
  }

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
    let combinedText = parts.join(" ");
    if (agenda && focus && faction) {
      const stanceMap = { support: "支持", compromise: "折中", oppose: "反对", suppress: "压下党争" };
      combinedText = `【季度议题】${agenda.title}【商议派系】${faction.name}【立场】${stanceMap[focus.stance] || focus.stance} ${combinedText}`;
    }
    overlay.remove();
    onChoice("custom_edict", combinedText, "自拟诏书", null);
  });

  panel.appendChild(submitBtn);
  overlay.appendChild(panel);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      storyChoiceSubmitting = false;
      overlay.remove();
    }
  });

  const app = document.getElementById("app");
  (app || document.body).appendChild(overlay);
}

export { applyEffects, renderDeltaCard, estimateEffectsFromEdict, computeEffectDelta, computeQuarterlyEffects, mergeEffects };
