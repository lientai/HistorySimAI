import { loadJSON } from "../dataLoader.js";
import { getState, setState } from "../state.js";
import { updateMinisterTabBadge } from "../layout.js";
import { requestStoryTurn } from "../api/llmStory.js";
import { sanitizeStoryEffects } from "../api/validators.js";
import { startDanmuForEdict, stopDanmu } from "./danmuSystem.js";
import { computeCustomPolicyQuarterBonus, getPolicyBonusSummary } from "./coreGameplaySystem.js";

let storyCache = { key: null, data: null };
let lastAppliedKey = null;
let storyHighlightPanelExpanded = false;

const MINISTER_NAME_COLORS = [
  "#8B0000", "#2e7d32", "#1565c0", "#e65100", "#6a1b9a",
  "#00695c", "#ad1457", "#4527a0",
];

const AVAILABLE_AVATAR_NAMES = new Set([
  "黄道周", "韩继思", "陈新甲", "袁崇焕", "范景文", "祖大寿", "王永光", "温体仁", "洪承畴", "毕自严",
  "梁廷栋", "林钎", "杨嗣昌", "李邦华", "曹文诏", "曹化淳", "张凤翔", "左良玉", "孙承宗", "孙传庭",
  "周延儒", "周奎", "吴三桂", "史可法", "卢象升", "倪元璐",
]);

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
  if (effects.appointments && typeof effects.appointments === "object" && !Array.isArray(effects.appointments)) {
    const ministers = state.ministers || [];
    const nameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
    for (const [positionId, characterId] of Object.entries(effects.appointments)) {
      if (typeof positionId !== "string" || typeof characterId !== "string") continue;
      entries.push({
        label: `任命 ${nameById[characterId] || characterId} → ${positionId}`,

        delta: null,
        invertColor: false,
        isAppointment: true,
      });
    }
  }
  if (effects.characterDeath && typeof effects.characterDeath === "object") {
    const ministers = state.ministers || [];
    const nameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
    for (const [characterId, reason] of Object.entries(effects.characterDeath)) {
      entries.push({
        label: `处置 ${nameById[characterId] || characterId}`,
        delta: null,
        invertColor: false,
        isAppointment: true,
        customText: typeof reason === "string" && reason ? reason : "已处置",
      });
    }
  }
  if (entries.length === 0) return;

  const card = document.createElement("div");
  card.className = "story-delta-card";
  if (titleText) {
    const title = document.createElement("div");
    title.className = "story-history-label";
    title.textContent = titleText;
    card.appendChild(title);
  }
  entries.forEach(({ label, delta, invertColor, isAppointment, customText }) => {
    const row = document.createElement("div");
    row.className = "story-delta-row";
    const lbl = document.createElement("span");
    lbl.className = "story-delta-label";
    lbl.textContent = label;
    const val = document.createElement("span");
    if (isAppointment) {
      val.className = "story-delta-value story-delta-value--appointment";
      val.textContent = customText || "已生效";
    } else {
      const isPositive = invertColor ? delta < 0 : delta > 0;
      val.className = "story-delta-value " + (isPositive ? "story-delta-value--positive" : "story-delta-value--negative");
      const sign = delta > 0 ? "+" : "";
      val.textContent = sign + delta.toLocaleString();
    }
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
  if (!textBlock || typeof window === "undefined") {
    return { ok: false, message: "当前环境不支持文本标注。" };
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { ok: false, message: "请先选中要标注的对话文本。" };
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return { ok: false, message: "请先选中要标注的对话文本。" };
  }

  if (!textBlock.contains(range.startContainer) || !textBlock.contains(range.endContainer)) {
    return { ok: false, message: "仅可标注当前回合剧情文本。" };
  }

  const selectedText = selection.toString().replace(/\s+/g, " ").trim();
  if (!selectedText) {
    return { ok: false, message: "选中文本为空，无法标注。" };
  }

  const underline = document.createElement("span");
  underline.className = "story-user-highlight";

  try {
    const fragment = range.extractContents();
    underline.appendChild(fragment);
    range.insertNode(underline);
    selection.removeAllRanges();
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
  const nation = { ...(s.nation || {}) };
  const ministers = Array.isArray(s.ministers) ? s.ministers : [];
  const ministerNameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
  const storylineTagsToClose = [];
  
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

  if (effects.appointments && typeof effects.appointments === "object" && !Array.isArray(effects.appointments)) {
    const currentState = getState();
    const beforeAppointments = { ...(currentState.appointments || {}) };
    const appointments = { ...beforeAppointments };
    for (const [positionId, characterId] of Object.entries(effects.appointments)) {
      if (typeof positionId !== "string" || typeof characterId !== "string") continue;
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

  if (effects.characterDeath && typeof effects.characterDeath === "object") {
    const currentState = getState();
    const characterStatus = { ...(currentState.characterStatus || {}) };
    for (const [characterId, reason] of Object.entries(effects.characterDeath)) {
      if (typeof characterId !== "string") continue;
      characterStatus[characterId] = {
        isAlive: false,
        deathReason: typeof reason === "string" ? reason : "处死",
        deathDay: currentState.currentMonth || 1,
      };
      storylineTagsToClose.push(buildMinisterStorylineTag(characterId, ministerNameById[characterId]));
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

  const allKeys = new Set([...(prevEffects ? Object.keys(prevEffects) : []), ...Object.keys(nextEffects)]);
  for (const key of allKeys) {
    if (key === "loyalty") continue;
    const prevVal = prevEffects && typeof prevEffects[key] === "number" ? prevEffects[key] : 0;
    const nextVal = typeof nextEffects[key] === "number" ? nextEffects[key] : 0;
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

function renderStoryHistory(container, history, phaseLabels, state, renderId) {
  for (const entry of history) {
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
      renderDeltaCard(container, entry.effects, state, "本轮推演数值变动");
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
  const year = state.currentYear || 1;
  const month = state.currentMonth || 1;
  const phaseKey = state.currentPhase || "morning";
  const path = `data/story/year${year}_month${month}_${phaseKey}.json`;
  const templateFallbackPath = `data/story/day1_${phaseKey}.json`;
  const cacheKey = `${year}_${month}_${phaseKey}`;
  const config = state.config || {};
  const isFirstTurn = (state.lastChoiceId == null) && (!Array.isArray(state.storyHistory) || state.storyHistory.length === 0);

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
    
    data = await requestStoryTurn(state, lastChoice);
    loadingBlock.remove();
    
    if (renderId != null && container._storyRenderId !== renderId) return null;
  }

  if (useLLM && data == null) {
    if (renderId != null && container._storyRenderId !== renderId) return null;
    renderStoryError(container, "剧情返回格式异常（JSON 解析失败）。请点击重新生成，或检查后端模型配置。", () => {
      storyCache = { key: null, data: null };
      container.innerHTML = "";
      renderStoryTurn(getState(), container, onChoice, options);
    });
    return null;
  }

  if (data == null) {
    try {
      // Template mode uses a curated baseline script by phase to avoid missing-file noise.
      const templatePath = (config.storyMode === "llm" && !isFirstTurn) ? path : templateFallbackPath;
      data = await loadJSON(templatePath);
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
  setState({ currentStoryTurn: { key: cacheKey, data } });
  return data;
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
  if (disabled) btn.classList.add("story-action-btn--disabled");
  btn.disabled = disabled;
  btn.innerHTML = `<div>${choice.text}</div>${choice.hint ? `<span>${choice.hint}</span>` : ""}`;
  btn.addEventListener("click", () => {
    if (disabled) return;
    onChoice(choice.id, choice.text, choice.hint, choice.effects);
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
  subtitle.textContent = `依文档逻辑，本季度必须先浏览 3-5 条时政议题，选定商议派系与观点后再颁布诏书；若存在敌对势力，将出现“军事开拓”议题。`;
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
    renderDeltaCard(currentWrap, settlementDisplayEffects, state, "季度结算数值变动");
  }

  const quarterPanel = renderQuarterAgendaPanel(container, state, onChoice, options);
  if (quarterPanel) currentWrap.appendChild(quarterPanel);

  const textBlock = document.createElement("div");
  textBlock.className = "edict-block";
  const fullText = buildBlockText(data);
  renderPseudoLines(textBlock, fullText);
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
  const disableActions = requiresQuarterFocus && !quarterReady;
  
  (data.choices || []).forEach((choice) => {
    const btn = createChoiceButton(choice, onChoice, disableActions);
    actionsWrap.appendChild(btn);
  });
  
  const customBtn = document.createElement("button");
  customBtn.type = "button";
  customBtn.className = "story-action-btn story-action-btn--custom";
  if (disableActions) {
    customBtn.disabled = true;
    customBtn.classList.add("story-action-btn--disabled");
  }
  customBtn.innerHTML = `<div>自拟诏书</div><span>亲笔拟定旨意，由朝臣代为施行</span>`;
  customBtn.addEventListener("click", () => {
    if (disableActions) return;
    showCustomEdictPanel(onChoice, state);
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
    if (lastEntry && lastEntry.chosenChoice) {
      const prevEffects = sanitizeStoryEffects(lastEntry.effects || null);
      const nextEffects = sanitizeStoryEffects(data.lastChoiceEffects);
      const deltaEffects = computeEffectDelta(prevEffects, nextEffects);
      auditCustomEdictCorrection(prevEffects, nextEffects, deltaEffects);

      // 如果 LLM 给出了更精准的数值变化，则使用差值进行调整
      if (deltaEffects) {
        applyEffects(deltaEffects);
      }

      // 保持历史记录中的 effects 为 LLM 最终输出
      lastEntry.effects = nextEffects;
      const updatedHistory = [...history];
      updatedHistory[updatedHistory.length - 1] = lastEntry;
      setState({ storyHistory: updatedHistory });

      const historyContainer = container.querySelector('.story-history-container') || container;
      const deltaCards = historyContainer.querySelectorAll('.story-delta-card');
      const lastDeltaCard = deltaCards[deltaCards.length - 1];
      if (lastDeltaCard) lastDeltaCard.remove();
      renderDeltaCard(historyContainer, deltaEffects || data.lastChoiceEffects, state, "本轮推演数值变动");
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
  closeBtn.addEventListener("click", () => overlay.remove());
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
    if (e.target === overlay) overlay.remove();
  });

  const app = document.getElementById("app");
  (app || document.body).appendChild(overlay);
}

export { applyEffects, renderDeltaCard, estimateEffectsFromEdict, computeEffectDelta, computeQuarterlyEffects, mergeEffects };
