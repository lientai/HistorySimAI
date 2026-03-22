import { router } from "../router.js";
import { getState, setState } from "../state.js";
import { updateMinisterTabBadge, updateTopbarByState } from "../layout.js";
import { loadJSON } from "../dataLoader.js";
import { getLoyaltyTags, getLoyaltyStage, getLoyaltyColor, getFactionClass } from "../systems/courtSystem.js";
import { requestMinisterReply } from "../api/ministerChat.js";
import { getApiBase } from "../api/httpClient.js";
import { AVAILABLE_AVATAR_NAMES, NATION_LABELS, INVERT_COLOR_KEYS, buildNameById } from "../utils/sharedConstants.js";
import { showError, showSuccess } from "../utils/toast.js";
import { applyEffects as applyEffectsModule } from "../utils/effectsProcessor.js";

let currentMinisterChatId = null;
let tagsConfigCache = null;
let factionsCache = null;
let positionsCache = null;
const sendingFlags = {};
let appointUIState = {
  mode: null,
  positionId: null,
  ministerId: null,
  keyword: "",
  selectedId: null,
};

const courtDeptUIState = {
  expandedDeptId: null,
  touchStartX: 0,
  touchStartY: 0,
  swipeHintVisible: false,
  swipeHintDismissed: false,
  swipeHintTimer: null,
};

const courtModuleUIState = {
  expandedModuleId: 'neige',
  expandedDeptId: null
};

const COURT_SWIPE_HINT_STORAGE_KEY = "courtSwipeHintSeenV1";

function isAliveCharacter(state, characterId) {
  return state?.characterStatus?.[characterId]?.isAlive !== false;
}

function createAvatarFallback(parent, fallbackChar) {
  if (!parent) return;
  let fallbackNode = parent.querySelector(".avatar-fallback-text");
  if (!fallbackNode) {
    fallbackNode = document.createElement("span");
    fallbackNode.className = "avatar-fallback-text";
    fallbackNode.textContent = fallbackChar || "臣";
    parent.appendChild(fallbackNode);
  }
}

function resolveApiUrl(pathname) {
  const apiBase = getApiBase(getState().config || {}, "courtView");
  if (!apiBase) return pathname;
  return `${apiBase}${pathname}`;
}

async function requestAppoint(positionId, characterId) {
  const state = getState();
  const response = await fetch(resolveApiUrl("/api/chongzhen/appoint"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      positionId,
      characterId,
      state: {
        appointments: state.appointments || {},
        characterStatus: state.characterStatus || {},
      },
    }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_e) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || text || `HTTP ${response.status}`);
  }
  return data || { success: true };
}

function rerenderCourtMainView() {
  const container = document.getElementById("main-view") || document.getElementById("view-container");
  if (!container) return;
  container.innerHTML = "";
  renderCourtView(container);
}

function closeInlineAppointPanel() {
  appointUIState = {
    mode: null,
    positionId: null,
    ministerId: null,
    keyword: "",
    selectedId: null,
  };
}

function openInlineAppointByPosition(positionId) {
  showAppointmentDialogByPosition(positionId);
}

function openInlineAppointByMinister(ministerId) {
  showAppointmentDialogByMinister(ministerId);
}

async function showAppointmentDialogByPosition(positionId) {
  const app = document.getElementById("app");
  if (!app) return;

  const state = getState();
  const charactersData = await loadJSON("data/characters.json");
  const allCharacters = charactersData?.characters || [];
  const positionsData = await loadJSON("data/positions.json");
  const positions = positionsData?.positions || [];
  const position = positions.find(p => p.id === positionId);
  
  if (!position) return;

  const excludedIds = new Set([
    'chongzhendi', 'zhouhuanghou', 'yuanfei', 'tianfei',
    'duoergun', 'duoduo', 'haoge', 'aji', 'huangtaiji', 'daishan', 'jierhalang', 'fanwencheng',
    'lizicheng', 'zhangxianzhong', 'gaoyingxiang', 'luorucai', 'liuzongmin',
    'liyan', 'niujinxing', 'songxiance',
    'lidingguo', 'sunkewang', 'liuwenxiu', 'ainengqi'
  ]);
  const excludedFactions = new Set(['rebel', 'qing']);
  
  const aliveCharacters = allCharacters.filter(c => 
    isAliveCharacter(state, c.id) &&
    !excludedIds.has(c.id) && 
    !excludedFactions.has(c.faction)
  );
  const appointedIds = new Set(Object.values(state.appointments || {}));
  const currentHolder = (state.appointments || {})[positionId];
  if (currentHolder) appointedIds.delete(currentHolder);
  const availableCharacters = aliveCharacters.filter(c => !appointedIds.has(c.id));

  let overlay = document.getElementById("appointment-dialog-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "appointment-dialog-overlay";
  overlay.className = "appointment-dialog-overlay";

  const card = document.createElement("div");
  card.className = "appointment-dialog-card";

  const header = document.createElement("div");
  header.className = "appointment-dialog-card__header";
  const title = document.createElement("div");
  title.className = "appointment-dialog-card__title";
  title.textContent = `任命 ${position.name}`;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "appointment-dialog-card__close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const positionInfo = document.createElement("div");
  positionInfo.className = "appointment-dialog-position-info";
  positionInfo.innerHTML = `
    <div class="position-info-item"><span>品级:</span> ${position.grade || '未设置'}</div>
    <div class="position-info-item"><span>职责:</span> ${position.description || '无'}</div>
  `;

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "appointment-search-input";
  searchInput.placeholder = "搜索角色姓名或字号...";

  const characterList = document.createElement("div");
  characterList.className = "appointment-character-list";

  const selectedHint = document.createElement("div");
  selectedHint.className = "appointment-selected-hint";
  selectedHint.textContent = "请先选择一位角色，再点击「确认任命」。";

  let selectedCharacter = null;
  let appointing = false;

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "appointment-dialog-confirm";
  confirmBtn.textContent = "确认任命";
  confirmBtn.disabled = true;

  const updateConfirmState = () => {
    confirmBtn.disabled = !selectedCharacter || appointing;
    selectedHint.textContent = selectedCharacter
      ? `已选择：${getDisplayName(selectedCharacter.name)}`
      : "请先选择一位角色，再点击「确认任命」。";
  };

  const selectCharacter = (item, char) => {
    characterList.querySelectorAll(".appointment-character-item--selected").forEach((el) => {
      el.classList.remove("appointment-character-item--selected");
    });
    item.classList.add("appointment-character-item--selected");
    selectedCharacter = char;
    updateConfirmState();
  };

  const renderCharacters = (filter = "") => {
    characterList.innerHTML = "";
    const filtered = filter 
      ? availableCharacters.filter(c => c.name.includes(filter) || (c.courtesyName && c.courtesyName.includes(filter)))
      : availableCharacters;

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "appointment-empty";
      empty.textContent = filter ? "未找到匹配的角色" : "暂无可用角色";
      characterList.appendChild(empty);
      return;
    }

    filtered.slice(0, 50).forEach(char => {
      const displayName = getDisplayName(char.name);
      const item = document.createElement("div");
      item.className = "appointment-character-item";
      
      const avatar = document.createElement("div");
      avatar.className = "appointment-character-avatar";
      avatar.appendChild(createAvatarImg(displayName, displayName?.charAt(0) || "?"));

      const info = document.createElement("div");
      info.className = "appointment-character-info";
      
      const nameEl = document.createElement("div");
      nameEl.className = "appointment-character-name";
      nameEl.textContent = displayName;
      
      const metaEl = document.createElement("div");
      metaEl.className = "appointment-character-meta";
      const metaParts = [];
      if (char.courtesyName) metaParts.push(`字${char.courtesyName}`);
      if (char.factionLabel) metaParts.push(char.factionLabel);
      metaEl.textContent = metaParts.join(" · ");

      const loyaltyEl = document.createElement("div");
      loyaltyEl.className = "appointment-character-loyalty";
      const stateLoyalty = state.loyalty || {};
      const loyaltyValue = stateLoyalty[char.id] !== undefined ? stateLoyalty[char.id] : (char.loyalty || 30);
      loyaltyEl.textContent = `忠诚: ${loyaltyValue}`;

      info.appendChild(nameEl);
      info.appendChild(metaEl);
      info.appendChild(loyaltyEl);

      item.appendChild(avatar);
      item.appendChild(info);

      item.addEventListener("click", () => selectCharacter(item, char));

      characterList.appendChild(item);
    });
  };

  searchInput.addEventListener("input", (e) => {
    renderCharacters(e.target.value);
  });

  confirmBtn.addEventListener("click", async () => {
    if (!selectedCharacter || appointing) return;

    appointing = true;
    confirmBtn.textContent = "任命中...";
    updateConfirmState();

    try {
      const result = await requestAppoint(positionId, selectedCharacter.id);
      if (result?.success === false) {
        showError(`任命失败: ${result.error || "未知错误"}`);
        return;
      }

      const s = getState();
      const currentAppointments = s.appointments || {};
      const newAppointments = { ...currentAppointments };
      for (const [posId, charId] of Object.entries(newAppointments)) {
        if (charId === selectedCharacter.id) {
          delete newAppointments[posId];
        }
      }
      newAppointments[positionId] = selectedCharacter.id;

      setState({ appointments: newAppointments });
      overlay.remove();
      const container = document.getElementById("main-view") || document.getElementById("view-container");
      if (container) {
        container.innerHTML = "";
        renderCourtView(container);
      }
    } catch (e) {
      showError(`任命失败: ${e.message}`);
    } finally {
      appointing = false;
      confirmBtn.textContent = "确认任命";
      updateConfirmState();
    }
  });

  const body = document.createElement("div");
  body.className = "appointment-dialog-card__body";
  body.appendChild(positionInfo);
  body.appendChild(selectedHint);
  body.appendChild(searchInput);
  body.appendChild(characterList);

  const footer = document.createElement("div");
  footer.className = "appointment-dialog-card__footer";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "appointment-dialog-cancel";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => overlay.remove());
  footer.appendChild(confirmBtn);
  footer.appendChild(cancelBtn);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  app.appendChild(overlay);
  renderCharacters();
  searchInput.focus();
}

async function showAppointmentDialogByMinister(ministerId) {
  const app = document.getElementById("app");
  if (!app) return;

  const state = getState();
  const ministers = state.ministers || [];
  const minister = ministers.find(m => m.id === ministerId);
  if (!minister) return;
  if (!isAliveCharacter(state, ministerId)) {
    showError("该人物已故，无法授予官职。");
    return;
  }

  const positionsData = await loadJSON("data/positions.json");
  const positions = positionsData?.positions || [];
  const appointments = state.appointments || {};

  let overlay = document.getElementById("appointment-dialog-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "appointment-dialog-overlay";
  overlay.className = "appointment-dialog-overlay";

  const card = document.createElement("div");
  card.className = "appointment-dialog-card";

  const header = document.createElement("div");
  header.className = "appointment-dialog-card__header";
  const title = document.createElement("div");
  title.className = "appointment-dialog-card__title";
  title.textContent = `调整官职：${getDisplayName(minister.name)}`;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "appointment-dialog-card__close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "appointment-search-input";
  searchInput.placeholder = "搜索官职名称...";

  const positionList = document.createElement("div");
  positionList.className = "appointment-character-list";

  const selectedHint = document.createElement("div");
  selectedHint.className = "appointment-selected-hint";
  selectedHint.textContent = "请先选择一个官职，再点击「确认调整」。";

  let selectedPosition = null;
  let appointing = false;

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "appointment-dialog-confirm";
  confirmBtn.textContent = "确认调整";
  confirmBtn.disabled = true;

  const charactersData = await loadJSON("data/characters.json");
  const characters = charactersData?.characters || [];
  const characterMap = new Map(characters.map(c => [c.id, c]));

  const updateConfirmState = () => {
    confirmBtn.disabled = !selectedPosition || appointing;
    selectedHint.textContent = selectedPosition
      ? `已选择：${selectedPosition.name}`
      : "请先选择一个官职，再点击「确认调整」。";
  };

  const selectPosition = (item, pos) => {
    positionList.querySelectorAll(".appointment-character-item--selected").forEach((el) => {
      el.classList.remove("appointment-character-item--selected");
    });
    item.classList.add("appointment-character-item--selected");
    selectedPosition = pos;
    updateConfirmState();
  };

  const renderPositions = (filter = "") => {
    positionList.innerHTML = "";
    const filtered = filter 
      ? positions.filter(p => p.name.includes(filter) || (p.description && p.description.includes(filter)))
      : positions;

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "appointment-empty";
      empty.textContent = filter ? "未找到匹配的官职" : "暂无可用官职";
      positionList.appendChild(empty);
      return;
    }

    filtered.slice(0, 50).forEach(pos => {
      const item = document.createElement("div");
      item.className = "appointment-character-item";
      
      const info = document.createElement("div");
      info.className = "appointment-character-info";
      info.style.flex = "1";
      
      const nameEl = document.createElement("div");
      nameEl.className = "appointment-character-name";
      nameEl.textContent = pos.name;
      
      const metaEl = document.createElement("div");
      metaEl.className = "appointment-character-meta";
      const holderId = appointments[pos.id];
      const holderName = holderId ? getDisplayName(characterMap.get(holderId)?.name || holderId) : "空缺";
      metaEl.textContent = `${pos.grade || ''} · 当前：${holderName}`;

      info.appendChild(nameEl);
      info.appendChild(metaEl);
      item.appendChild(info);

      item.addEventListener("click", () => selectPosition(item, pos));

      positionList.appendChild(item);
    });
  };

  searchInput.addEventListener("input", (e) => {
    renderPositions(e.target.value);
  });

  confirmBtn.addEventListener("click", async () => {
    if (!selectedPosition || appointing) return;

    appointing = true;
    confirmBtn.textContent = "调整中...";
    updateConfirmState();

    try {
      const result = await requestAppoint(selectedPosition.id, ministerId);
      if (result?.success === false) {
        showError(`调整失败: ${result.error || "未知错误"}`);
        return;
      }

      const s = getState();
      const currentAppointments = s.appointments || {};
      const newAppointments = { ...currentAppointments };
      for (const [posId, charId] of Object.entries(newAppointments)) {
        if (charId === ministerId) {
          delete newAppointments[posId];
        }
      }
      newAppointments[selectedPosition.id] = ministerId;

      setState({ appointments: newAppointments });
      overlay.remove();
      const container = document.getElementById("main-view") || document.getElementById("view-container");
      if (container) {
        container.innerHTML = "";
        renderCourtView(container);
      }
    } catch (e) {
      showError(`调整失败: ${e.message}`);
    } finally {
      appointing = false;
      confirmBtn.textContent = "确认调整";
      updateConfirmState();
    }
  });

  const body = document.createElement("div");
  body.className = "appointment-dialog-card__body";
  body.appendChild(selectedHint);
  body.appendChild(searchInput);
  body.appendChild(positionList);

  const footer = document.createElement("div");
  footer.className = "appointment-dialog-card__footer";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "appointment-dialog-cancel";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => overlay.remove());
  footer.appendChild(confirmBtn);
  footer.appendChild(cancelBtn);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  app.appendChild(overlay);
  renderPositions();
  searchInput.focus();
}

function applyLocalAppointmentState(positionId, characterId) {
  const state = getState();
  const currentAppointments = state.appointments || {};
  const nextAppointments = { ...currentAppointments };
  for (const [posId, charId] of Object.entries(nextAppointments)) {
    if (charId === characterId) {
      delete nextAppointments[posId];
    }
  }
  nextAppointments[positionId] = characterId;
  setState({ appointments: nextAppointments });
}

function applyLocalAppointmentEffects(appointmentsMap) {
  if (!appointmentsMap || typeof appointmentsMap !== "object" || Array.isArray(appointmentsMap)) return false;
  const state = getState();
  const currentAppointments = state.appointments || {};
  const nextAppointments = { ...currentAppointments };
  let changed = false;

  for (const [positionId, characterId] of Object.entries(appointmentsMap)) {
    if (typeof positionId !== "string" || typeof characterId !== "string") continue;

    for (const [posId, holderId] of Object.entries(nextAppointments)) {
      if (holderId === characterId && posId !== positionId) {
        delete nextAppointments[posId];
        changed = true;
      }
    }

    if (nextAppointments[positionId] !== characterId) {
      nextAppointments[positionId] = characterId;
      changed = true;
    }
  }

  if (changed) {
    setState({ appointments: nextAppointments });
  }
  return changed;
}

function isValueChanged(key, delta) {
  if (typeof delta !== "number" || delta === 0) return false;
  return true;
}

function buildDialogueDeltaFromState(beforeState, afterState, effects, ministerId) {
  const delta = {};
  const beforeNation = beforeState?.nation || {};
  const afterNation = afterState?.nation || {};

  Object.keys(NATION_LABELS).forEach((key) => {
    const beforeVal = Number(beforeNation[key] || 0);
    const afterVal = Number(afterNation[key] || 0);
    const diff = afterVal - beforeVal;
    if (isValueChanged(key, diff)) {
      delta[key] = diff;
    }
  });

  const loyaltyDelta = {};
  const beforeLoyalty = beforeState?.loyalty || {};
  const afterLoyalty = afterState?.loyalty || {};

  if (ministerId) {
    const diff = Number(afterLoyalty[ministerId] || 0) - Number(beforeLoyalty[ministerId] || 0);
    if (diff !== 0) loyaltyDelta[ministerId] = diff;
  }

  if (effects?.loyalty && typeof effects.loyalty === "object") {
    Object.keys(effects.loyalty).forEach((id) => {
      if (id === ministerId) return;
      const diff = Number(afterLoyalty[id] || 0) - Number(beforeLoyalty[id] || 0);
      if (diff !== 0) loyaltyDelta[id] = diff;
    });
  }

  if (Object.keys(loyaltyDelta).length) {
    delta.loyalty = loyaltyDelta;
  }

  if (effects?.appointments && typeof effects.appointments === "object" && !Array.isArray(effects.appointments)) {
    delta.appointments = { ...effects.appointments };
  }

  if (effects?.characterDeath && typeof effects.characterDeath === "object" && !Array.isArray(effects.characterDeath)) {
    delta.characterDeath = { ...effects.characterDeath };
  }

  return delta;
}

function hasDialogueDelta(delta) {
  if (!delta || typeof delta !== "object") return false;
  if (Object.keys(NATION_LABELS).some((key) => typeof delta[key] === "number" && delta[key] !== 0)) return true;
  if (delta.loyalty && Object.keys(delta.loyalty).length > 0) return true;
  if (delta.appointments && Object.keys(delta.appointments).length > 0) return true;
  if (delta.characterDeath && Object.keys(delta.characterDeath).length > 0) return true;
  return false;
}

function renderDialogueDeltaCard(container, delta, state) {
  if (!container) return;
  container.innerHTML = "";
  if (!hasDialogueDelta(delta)) return;

  const entries = [];
  for (const [key, label] of Object.entries(NATION_LABELS)) {
    if (typeof delta[key] === "number" && delta[key] !== 0) {
      entries.push({ label, value: delta[key], invertColor: INVERT_COLOR_KEYS.includes(key), type: "number" });
    }
  }

  if (delta.loyalty && typeof delta.loyalty === "object") {
    const nameById = buildNameById(state.ministers || []);
    for (const [id, diff] of Object.entries(delta.loyalty)) {
      if (typeof diff !== "number" || diff === 0) continue;
      entries.push({ label: `${nameById[id] || id} 忠诚`, value: diff, invertColor: false, type: "number" });
    }
  }

  if (delta.appointments && typeof delta.appointments === "object") {
    const nameById = buildNameById(state.ministers || []);
    for (const [positionId, characterId] of Object.entries(delta.appointments)) {
      entries.push({
        label: `任命 ${nameById[characterId] || characterId} → ${positionId}`,
        value: "已生效",
        type: "text",
      });
    }
  }

  if (delta.characterDeath && typeof delta.characterDeath === "object") {
    const nameById = buildNameById(state.ministers || []);
    for (const [characterId, reason] of Object.entries(delta.characterDeath)) {
      entries.push({
        label: `处置 ${nameById[characterId] || characterId}`,
        value: typeof reason === "string" && reason ? reason : "已处置",
        type: "text",
      });
    }
  }

  if (!entries.length) return;

  const card = document.createElement("div");
  card.className = "story-delta-card";
  const title = document.createElement("div");
  title.className = "story-history-label";
  title.textContent = "本轮对话数值变化";
  card.appendChild(title);

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "story-delta-row";
    const label = document.createElement("span");
    label.className = "story-delta-label";
    label.textContent = entry.label;
    const value = document.createElement("span");

    if (entry.type === "number") {
      const isPositive = entry.invertColor ? entry.value < 0 : entry.value > 0;
      value.className = "story-delta-value " + (isPositive ? "story-delta-value--positive" : "story-delta-value--negative");
      value.textContent = `${entry.value > 0 ? "+" : ""}${entry.value}`;
    } else {
      value.className = "story-delta-value story-delta-value--appointment";
      value.textContent = String(entry.value);
    }

    row.appendChild(label);
    row.appendChild(value);
    card.appendChild(row);
  });

  container.appendChild(card);
}

function triggerTapFeedback() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(10);
}

function buildMinisterRoleMap(state) {
  const roleMap = new Map();
  const positions = positionsCache?.positions || [];
  const appointments = state?.appointments || {};
  if (!positions.length) return roleMap;

  const positionById = new Map(positions.map((p) => [p.id, p]));
  for (const [positionId, ministerId] of Object.entries(appointments)) {
    if (!ministerId) continue;
    const position = positionById.get(positionId);
    if (!position?.name) continue;
    roleMap.set(ministerId, position.name);
  }
  return roleMap;
}

function resolveMinisterRoleLabel(minister, roleMap) {
  const dynamicRole = roleMap?.get(minister?.id);
  if (dynamicRole) return dynamicRole;
  const fallbackRole = (minister?.role && String(minister.role).trim()) || "";
  return fallbackRole || "未任官职";
}

function createAvatarImg(name, fallbackChar) {
  const img = document.createElement("img");
  const displayName = getDisplayName(name);
  img.alt = displayName || "";
  img.onerror = function () {
    this.style.display = "none";
    createAvatarFallback(this.parentElement, fallbackChar || (displayName ? displayName.charAt(0) : "臣"));
  };

  if (displayName && AVAILABLE_AVATAR_NAMES.has(displayName)) {
    img.src = `assets/${displayName}.jpg`;
  } else {
    queueMicrotask(() => img.onerror());
  }

  return img;
}

const MINISTER_NAME_COLORS = [
  "#8B0000", "#2e7d32", "#1565c0", "#e65100", "#6a1b9a",
  "#00695c", "#ad1457", "#4527a0",
];

function stripEnglishParenAfterChinese(text) {
  if (typeof text !== "string") return "";
  return text.replace(/([\u4e00-\u9fa5]{2,})\s*[（(]\s*([^（）()]+)\s*[）)]/g, (full, cnName, inner) => {
    const hasAscii = /[A-Za-z0-9_\-./:@]/.test(inner);
    const hasChinese = /[\u4e00-\u9fa5]/.test(inner);
    return hasAscii && !hasChinese ? cnName : full;
  }).trim();
}

function getDisplayName(name) {
  return stripEnglishParenAfterChinese(name || "");
}

function showMinisterDetail(minister, state, tagsConfig) {
  const app = document.getElementById("app");
  if (!app || !minister) return;
  const loyalty = state.loyalty || {};
  const score = loyalty[minister.id] || 0;
  const max = (state.config && state.config.loyaltyMax) || 100;
  const label = getLoyaltyStage(score, tagsConfig);
  const color = getLoyaltyColor(score, tagsConfig);

  let overlay = document.getElementById("minister-detail-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "minister-detail-overlay";
  overlay.className = "minister-detail-overlay";

  const card = document.createElement("div");
  card.className = "minister-detail-card";
  const displayName = getDisplayName(minister.name);

  const header = document.createElement("div");
  header.className = "minister-detail-card__header";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "minister-detail-card__close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(closeBtn);

  const avatar = document.createElement("div");
  avatar.className = "minister-detail-avatar";
  avatar.appendChild(createAvatarImg(displayName, displayName ? displayName.charAt(0) : "臣"));

  const nameEl = document.createElement("div");
  nameEl.className = "minister-detail-card__name";
  nameEl.textContent = displayName;

  const roleEl = document.createElement("div");
  roleEl.className = "minister-detail-card__role";
  const roleMap = buildMinisterRoleMap(state);
  roleEl.textContent = `${resolveMinisterRoleLabel(minister, roleMap)} · ${minister.factionLabel || ""}`;

  const body = document.createElement("div");
  body.className = "minister-detail-card__body";

  const summary = document.createElement("p");
  summary.className = "minister-detail-card__summary";
  summary.textContent = minister.summary || "";

  const loyaltyBlock = document.createElement("div");
  loyaltyBlock.className = "minister-detail-card__loyalty";
  loyaltyBlock.textContent = `忠诚度 ${score} / ${max}`;
  loyaltyBlock.style.color = color;

  const attitudeBlock = document.createElement("div");
  attitudeBlock.className = "minister-detail-card__attitude";
  attitudeBlock.textContent = minister.attitude || "";

  body.appendChild(summary);
  body.appendChild(loyaltyBlock);
  body.appendChild(attitudeBlock);

  const actionButtons = document.createElement("div");
  actionButtons.className = "minister-detail-actions";
  
  const appointBtn = document.createElement("button");
  appointBtn.type = "button";
  appointBtn.className = "minister-detail-appoint-btn";
  appointBtn.textContent = "转到官职调整";
  appointBtn.addEventListener("click", () => {
    overlay.remove();
    openInlineAppointByMinister(minister.id);
  });
  actionButtons.appendChild(appointBtn);
  
  body.appendChild(actionButtons);

  card.appendChild(header);
  card.appendChild(avatar);
  card.appendChild(nameEl);
  card.appendChild(roleEl);
  card.appendChild(body);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  app.appendChild(overlay);
}

async function showPositionSelectDialog(minister, state) {
  const app = document.getElementById("app");
  if (!app) return;

  if (!positionsCache) {
    try {
      positionsCache = await loadJSON("data/positions.json");
    } catch (e) {
      positionsCache = { positions: [], departments: [] };
    }
  }

  const positions = positionsCache?.positions || [];
  
  let overlay = document.getElementById("position-select-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "position-select-overlay";
  overlay.className = "appointment-dialog-overlay";

  const card = document.createElement("div");
  card.className = "appointment-dialog-card";

  const header = document.createElement("div");
  header.className = "appointment-dialog-card__header";
  const title = document.createElement("div");
  title.className = "appointment-dialog-card__title";
  title.textContent = `为 ${getDisplayName(minister.name)} 调整官职`;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "appointment-dialog-card__close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const positionList = document.createElement("div");
  positionList.className = "appointment-character-list";
  positionList.style.maxHeight = "300px";

  const selectedHint = document.createElement("div");
  selectedHint.className = "appointment-selected-hint";
  selectedHint.textContent = "请选择一个官职后点击“确认调整”。";

  let selectedPosition = null;
  let appointing = false;

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "appointment-dialog-confirm";
  confirmBtn.textContent = "确认调整";
  confirmBtn.disabled = true;

  const updateConfirmState = () => {
    confirmBtn.disabled = !selectedPosition || appointing;
    selectedHint.textContent = selectedPosition
      ? `已选择：${selectedPosition.name}`
      : "请选择一个官职后点击“确认调整”。";
  };

  const selectPosition = (item, pos) => {
    positionList.querySelectorAll(".appointment-character-item--selected").forEach((el) => {
      el.classList.remove("appointment-character-item--selected");
    });
    item.classList.add("appointment-character-item--selected");
    selectedPosition = pos;
    updateConfirmState();
  };

  positions.forEach(pos => {
    const item = document.createElement("div");
    item.className = "appointment-character-item";
    
    const info = document.createElement("div");
    info.className = "appointment-character-info";
    
    const nameEl = document.createElement("div");
    nameEl.className = "appointment-character-name";
    nameEl.textContent = pos.name;
    
    const metaEl = document.createElement("div");
    metaEl.className = "appointment-character-meta";
    metaEl.textContent = `${pos.grade || ''} · ${pos.description || ''}`;

    info.appendChild(nameEl);
    info.appendChild(metaEl);
    item.appendChild(info);

    item.addEventListener("click", () => selectPosition(item, pos));

    positionList.appendChild(item);
  });

  confirmBtn.addEventListener("click", async () => {
    if (!selectedPosition || appointing) return;

    appointing = true;
    confirmBtn.textContent = "调整中...";
    updateConfirmState();

    try {
      const result = await requestAppoint(selectedPosition.id, minister.id);
      if (result?.success === false) {
        showError(`任命失败: ${result.error || "未知错误"}`);
        return;
      }

      const s = getState();
      const currentAppointments = s.appointments || {};
      const newAppointments = { ...currentAppointments };
      for (const [posId, charId] of Object.entries(newAppointments)) {
        if (charId === minister.id) {
          delete newAppointments[posId];
        }
      }
      newAppointments[selectedPosition.id] = minister.id;

      setState({ appointments: newAppointments });
      overlay.remove();
      const container = document.getElementById("view-container");
      if (container) {
        container.innerHTML = "";
        renderCourtView(container);
      }
    } catch (e) {
      showError(`任命失败: ${e.message}`);
    } finally {
      appointing = false;
      confirmBtn.textContent = "确认调整";
      updateConfirmState();
    }
  });

  const body = document.createElement("div");
  body.className = "appointment-dialog-card__body";
  body.appendChild(selectedHint);
  body.appendChild(positionList);

  const footer = document.createElement("div");
  footer.className = "appointment-dialog-card__footer";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "appointment-dialog-cancel";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => overlay.remove());
  footer.appendChild(confirmBtn);
  footer.appendChild(cancelBtn);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  app.appendChild(overlay);
}

function showFactionPanel(state) {
  const app = document.getElementById("app");
  if (!app) return;

  let overlay = document.getElementById("relationship-panel-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "relationship-panel-overlay";
  overlay.className = "relationship-panel-overlay";

  const card = document.createElement("div");
  card.className = "relationship-panel-card";

  const header = document.createElement("div");
  header.className = "relationship-panel-card__header";
  const title = document.createElement("div");
  title.className = "relationship-panel-card__title";
  title.textContent = "朝堂派系";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "relationship-panel-card__close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "relationship-panel-card__body";
  body.style.flexDirection = "column";
  body.style.alignItems = "stretch";
  body.style.gap = "8px";

  const factions = factionsCache?.factions || [];
  const ministers = state.ministers || [];
  const loyalty = state.loyalty || {};
  const roleMap = buildMinisterRoleMap(state);

  factions.forEach((f) => {
    const section = document.createElement("div");
    section.className = "faction-panel-section";
    section.style.borderColor = `${f.color}33`;
    section.style.background = `${f.color}08`;

    const fName = document.createElement("div");
    fName.className = "faction-panel-section__name";
    fName.style.color = f.color;
    fName.textContent = f.name;
    section.appendChild(fName);

    const fDesc = document.createElement("div");
    fDesc.className = "faction-panel-section__desc";
    fDesc.textContent = f.description;
    section.appendChild(fDesc);

    body.appendChild(section);
  });

  const footer = document.createElement("div");
  footer.className = "relationship-panel-card__footer";
  const closeBtnBottom = document.createElement("button");
  closeBtnBottom.type = "button";
  closeBtnBottom.className = "relationship-panel-card__footer-close";
  closeBtnBottom.textContent = "关闭";
  closeBtnBottom.addEventListener("click", () => overlay.remove());
  footer.appendChild(closeBtnBottom);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  app.appendChild(overlay);
}

function createMinisterListElement(state, tagsConfig, onSelectMinister) {
  const { ministers, loyalty } = state;
  const roleMap = buildMinisterRoleMap(state);
  const list = document.createElement("div");
  list.className = "minister-list";

  const ministerUnread = state.ministerUnread || {};
  const preferredFaction = state.currentQuarterFocus?.factionId || null;
  const orderedMinisters = [...(ministers || [])].sort((a, b) => {
    if (!preferredFaction) return 0;
    const aScore = a.faction === preferredFaction ? 1 : 0;
    const bScore = b.faction === preferredFaction ? 1 : 0;
    return bScore - aScore;
  });
  orderedMinisters.forEach((m, index) => {
    const item = document.createElement("div");
    item.className = "minister-item" + (ministerUnread[m.id] ? " minister-item--unread" : "");
    const alive = isAliveCharacter(state, m.id);
    if (!alive) item.className += " minister-item--deceased";

    const displayName = getDisplayName(m.name);
    const avatar = document.createElement("div");
    avatar.className = "minister-avatar";
    avatar.appendChild(createAvatarImg(displayName, displayName ? displayName.charAt(0) : "臣"));
    const score = loyalty ? loyalty[m.id] || 0 : 0;

    avatar.addEventListener("click", (e) => {
      e.stopPropagation();
      showMinisterDetail({ ...m, role: resolveMinisterRoleLabel(m, roleMap) }, state, tagsConfig);
    });

    const main = document.createElement("div");
    main.className = "minister-main";
    
    const nameRow = document.createElement("div");
    nameRow.className = "minister-name-row";
    
    const nameLine = document.createElement("span");
    nameLine.className = "minister-name";
    nameLine.textContent = displayName;
    nameLine.style.color = MINISTER_NAME_COLORS[index % MINISTER_NAME_COLORS.length];

    if (!alive) {
      const deceasedTag = document.createElement("span");
      deceasedTag.className = "minister-status-tag minister-status-tag--deceased";
      deceasedTag.textContent = "已故";
      nameRow.appendChild(nameLine);
      nameRow.appendChild(deceasedTag);
    } else {
      nameRow.appendChild(nameLine);
    }
    
    const factionTag = document.createElement("span");
    factionTag.className = "minister-faction-tag " + getFactionClass(m.faction);
    factionTag.textContent = m.factionLabel || m.faction || "";
    
    nameRow.appendChild(factionTag);
    
    const roleLine = document.createElement("div");
    roleLine.className = "minister-role";
    const roleLabel = resolveMinisterRoleLabel(m, roleMap);
    roleLine.textContent = alive
      ? roleLabel
      : `${roleLabel || "群臣"} · ${state.characterStatus?.[m.id]?.deathReason || "病逝"}`;

    const preview = document.createElement("div");
    preview.className = "minister-preview";
    const chats = state.courtChats?.[m.id];
    const lastMsg = Array.isArray(chats) && chats.length > 0 ? chats[chats.length - 1] : null;
    preview.textContent = lastMsg ? (lastMsg.text || "").slice(0, 40) : m.attitude || "";

    main.appendChild(nameRow);
    main.appendChild(roleLine);
    main.appendChild(preview);

    const meta = document.createElement("div");
    meta.className = "minister-meta";
    const stageLabel = getLoyaltyStage(score, tagsConfig);
    const stageColor = getLoyaltyColor(score, tagsConfig);
    const scoreEl = document.createElement("div");
    scoreEl.className = "minister-loyalty-score";
    scoreEl.textContent = score;
    scoreEl.style.color = stageColor;
    meta.appendChild(scoreEl);
    const stageEl = document.createElement("div");
    stageEl.className = "minister-loyalty-label";
    stageEl.textContent = stageLabel;
    stageEl.style.color = stageColor;
    meta.appendChild(stageEl);

    if (ministerUnread[m.id]) {
      const badge = document.createElement("span");
      badge.className = "minister-item__badge";
      meta.appendChild(badge);
    }

    item.appendChild(avatar);
    item.appendChild(main);
    item.appendChild(meta);

    item.addEventListener("click", () => {
      onSelectMinister(m.id);
    });

    list.appendChild(item);
  });

  return list;
}

function showMinisterPanel(state, tagsConfig) {
  const app = document.getElementById("app");
  if (!app) return;

  let overlay = document.getElementById("minister-panel-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "minister-panel-overlay";
  overlay.className = "relationship-panel-overlay";

  const card = document.createElement("div");
  card.className = "relationship-panel-card minister-panel-card";

  const header = document.createElement("div");
  header.className = "relationship-panel-card__header";
  const title = document.createElement("div");
  title.className = "relationship-panel-card__title";
  title.textContent = "朝堂群臣";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "relationship-panel-card__close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "relationship-panel-card__body minister-panel-body";
  body.appendChild(createMinisterListElement(state, tagsConfig, (ministerId) => {
    overlay.remove();
    currentMinisterChatId = ministerId;
    rerenderCourtMainView();
  }));

  const footer = document.createElement("div");
  footer.className = "relationship-panel-card__footer";
  const closeBtnBottom = document.createElement("button");
  closeBtnBottom.type = "button";
  closeBtnBottom.className = "relationship-panel-card__footer-close";
  closeBtnBottom.textContent = "关闭";
  closeBtnBottom.addEventListener("click", () => overlay.remove());
  footer.appendChild(closeBtnBottom);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  app.appendChild(overlay);
}

function renderMinisterList(container, state, tagsConfig) {
  const { ministers } = state;

  const card = document.createElement("div");
  card.className = "edict-block court-minister-card";

  const header = document.createElement("div");
  header.className = "court-view-header";
  const title = document.createElement("div");
  title.className = "court-view-title";
  title.textContent = `朝堂群臣 ${ministers?.length || 0} 人`;

  const actions = document.createElement("div");
  actions.className = "court-view-header__actions";

  const ministerBtn = document.createElement("button");
  ministerBtn.type = "button";
  ministerBtn.className = "court-relations-btn";
  ministerBtn.textContent = "群臣列表";
  ministerBtn.addEventListener("click", () => showMinisterPanel(state, tagsConfig));

  const relBtn = document.createElement("button");
  relBtn.type = "button";
  relBtn.className = "court-relations-btn";
  relBtn.textContent = "派系";
  relBtn.addEventListener("click", () => showFactionPanel(state));

  actions.appendChild(ministerBtn);
  actions.appendChild(relBtn);
  header.appendChild(title);
  header.appendChild(actions);
  card.appendChild(header);

  container.appendChild(card);
}

async function renderPositionMap(container, state) {
  if (!positionsCache) {
    try {
      positionsCache = await loadJSON("data/positions.json");
    } catch (e) {
      positionsCache = { positions: [], departments: [], modules: [] };
    }
  }

  const positions = positionsCache?.positions || [];
  const departments = positionsCache?.departments || [];
  const modules = positionsCache?.modules || [];
  const currentAppointments = getState().appointments || {};
  const appointments = currentAppointments;
  const charactersData = await loadJSON("data/characters.json");
  const characters = charactersData?.characters || [];
  const characterMap = new Map(characters.map(c => [c.id, c]));

  const card = document.createElement("div");
  card.className = "edict-block court-position-card";

  const header = document.createElement("div");
  header.className = "court-position-header";
  header.innerHTML = `
    <span>朝廷官职</span>
    <span class="court-position-count">已任命 ${Object.keys(appointments).length} / ${positions.length}</span>
  `;
  card.appendChild(header);

  const swipeHint = document.createElement("div");
  swipeHint.className = "court-swipe-hint";
  swipeHint.setAttribute("aria-hidden", "true");
  swipeHint.textContent = "左右滑动可切换部门";
  card.appendChild(swipeHint);

  const deptMap = new Map(departments.map(d => [d.id, d]));
  const moduleMap = new Map(modules.map(m => [m.id, m]));

  const groupedPositions = new Map();
  positions.forEach(pos => {
    const deptId = pos.department || 'other';
    if (!groupedPositions.has(deptId)) {
      groupedPositions.set(deptId, []);
    }
    groupedPositions.get(deptId).push(pos);
  });

  const moduleOrder = ['neige', 'liubu', 'fasisi', 'neiting', 'difang', 'junshi'];
  const orderedModuleIds = moduleOrder.filter((moduleId) => {
    const mod = moduleMap.get(moduleId);
    if (!mod || !mod.departments) return false;
    return mod.departments.some(deptId => (groupedPositions.get(deptId) || []).length > 0);
  });

  const getModuleDepartments = (moduleId) => {
    const mod = moduleMap.get(moduleId);
    if (!mod || !mod.departments) return [];
    return mod.departments.filter(deptId => (groupedPositions.get(deptId) || []).length > 0);
  };

  const orderedDeptIds = orderedModuleIds.flatMap(mId => getModuleDepartments(mId));

  if (courtDeptUIState.swipeHintTimer) {
    clearTimeout(courtDeptUIState.swipeHintTimer);
    courtDeptUIState.swipeHintTimer = null;
  }

  const unmountSwipeHint = () => {
    swipeHint.classList.remove("is-mounted");
  };

  const hideSwipeHint = ({ markDismissed = false } = {}) => {
    courtDeptUIState.swipeHintVisible = false;
    swipeHint.classList.remove("is-visible");
    const finalizeUnmount = () => {
      unmountSwipeHint();
    };
    swipeHint.addEventListener("transitionend", finalizeUnmount, { once: true });
    setTimeout(finalizeUnmount, 320);

    if (markDismissed) {
      courtDeptUIState.swipeHintDismissed = true;
      try {
        localStorage.setItem(COURT_SWIPE_HINT_STORAGE_KEY, "1");
      } catch (_error) {
        // ignore storage failure
      }
    }
  };

  const showSwipeHint = () => {
    swipeHint.classList.add("is-mounted");
    requestAnimationFrame(() => {
      swipeHint.classList.add("is-visible");
    });
    courtDeptUIState.swipeHintVisible = true;
  };

  if (!courtDeptUIState.swipeHintDismissed) {
    let seenBefore = false;
    try {
      seenBefore = localStorage.getItem(COURT_SWIPE_HINT_STORAGE_KEY) === "1";
    } catch (_error) {
      seenBefore = false;
    }
    courtDeptUIState.swipeHintDismissed = seenBefore;
  }

  const shouldShowSwipeHint = orderedDeptIds.length > 1 && !courtDeptUIState.swipeHintDismissed;
  if (shouldShowSwipeHint) {
    showSwipeHint();
    courtDeptUIState.swipeHintTimer = setTimeout(() => {
      hideSwipeHint({ markDismissed: true });
      courtDeptUIState.swipeHintTimer = null;
    }, 2600);
  } else {
    unmountSwipeHint();
  }

  const fallbackDeptId = orderedDeptIds.includes("neige") ? "neige" : (orderedDeptIds[0] || null);
  const preferredDeptId = courtDeptUIState.expandedDeptId || fallbackDeptId;
  courtDeptUIState.expandedDeptId = orderedDeptIds.includes(preferredDeptId) ? preferredDeptId : fallbackDeptId;

  const switchExpandedDept = (delta) => {
    if (!orderedDeptIds.length) return;
    const currentIndex = orderedDeptIds.indexOf(courtDeptUIState.expandedDeptId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + delta + orderedDeptIds.length) % orderedDeptIds.length;
    courtDeptUIState.expandedDeptId = orderedDeptIds[nextIndex];
    rerenderCourtMainView();
  };

  card.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    courtDeptUIState.touchStartX = touch.clientX;
    courtDeptUIState.touchStartY = touch.clientY;
  }, { passive: true });

  card.addEventListener("touchend", (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - courtDeptUIState.touchStartX;
    const deltaY = touch.clientY - courtDeptUIState.touchStartY;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) {
      switchExpandedDept(1);
    } else {
      switchExpandedDept(-1);
    }

    if (!courtDeptUIState.swipeHintDismissed) {
      hideSwipeHint({ markDismissed: true });
      if (courtDeptUIState.swipeHintTimer) {
        clearTimeout(courtDeptUIState.swipeHintTimer);
        courtDeptUIState.swipeHintTimer = null;
      }
    }
  }, { passive: true });

  orderedModuleIds.forEach(moduleId => {
    const mod = moduleMap.get(moduleId);
    const moduleDepts = getModuleDepartments(moduleId);
    if (!moduleDepts.length) return;

    const isSingleDept = moduleDepts.length === 1;
    const isModuleExpanded = courtModuleUIState.expandedModuleId === moduleId;

    const moduleSection = document.createElement("div");
    moduleSection.className = "court-module-section" + (isModuleExpanded ? " is-open" : "");
    
    const moduleHeader = document.createElement("button");
    moduleHeader.type = "button";
    moduleHeader.className = "court-module-header";
    
    const totalVacant = moduleDepts.reduce((sum, deptId) => {
      const posList = groupedPositions.get(deptId) || [];
      return sum + posList.filter((p) => !appointments[p.id]).length;
    }, 0);
    
    moduleHeader.innerHTML = `
      <span class="court-module-header__name">${mod?.name || moduleId}</span>
      <span class="court-module-header__badge">${totalVacant}</span>
      <span class="court-module-header__desc">${mod?.description || ''}</span>
      <span class="court-module-header__arrow">▸</span>
    `;
    
    moduleHeader.addEventListener("click", () => {
      triggerTapFeedback();
      if (courtModuleUIState.expandedModuleId === moduleId) {
        courtModuleUIState.expandedModuleId = null;
        courtModuleUIState.expandedDeptId = null;
      } else {
        courtModuleUIState.expandedModuleId = moduleId;
        if (!isSingleDept) {
          courtModuleUIState.expandedDeptId = moduleDepts[0];
        }
      }
      rerenderCourtMainView();
    });
    
    moduleSection.appendChild(moduleHeader);

    if (isModuleExpanded) {
      if (isSingleDept) {
        const deptId = moduleDepts[0];
        const posList = groupedPositions.get(deptId) || [];
        if (posList.length > 0) {
          const grid = document.createElement("div");
          grid.className = "court-position-grid court-position-grid--direct";
          
          const sortedPosList = [...posList].sort((a, b) => (b.importance || 0) - (a.importance || 0));
          
          sortedPosList.forEach((pos) => {
            const holderId = appointments[pos.id];
            const holder = holderId ? characterMap.get(holderId) : null;
            const isVacant = !holder;

            const item = document.createElement("div");
            item.className = "court-position-item" + (isVacant ? " court-position-item--vacant" : "");

            const avatarWrap = document.createElement("div");
            avatarWrap.className = "court-position-avatar";
            if (holder) {
              const displayName = getDisplayName(holder.name);
              avatarWrap.appendChild(createAvatarImg(displayName, displayName?.charAt(0) || "臣"));
            } else {
              const placeholder = document.createElement("div");
              placeholder.className = "court-position-avatar-placeholder";
              placeholder.textContent = "+";
              avatarWrap.appendChild(placeholder);
            }

            const textWrap = document.createElement("div");
            textWrap.className = "court-position-text";

            const roleEl = document.createElement("div");
            roleEl.className = "court-position-item__role";
            roleEl.textContent = pos.name;

            const metaLine = document.createElement("div");
            metaLine.className = "court-position-item__meta";

            const nameEl = document.createElement("div");
            nameEl.className = "court-position-item__name";
            nameEl.textContent = holder ? getDisplayName(holder.name) : "+ 点击任命";
            if (!holder) nameEl.classList.add("court-position-item__name--vacant");

            const gradeEl = document.createElement("div");
            gradeEl.className = "court-position-item__grade";
            gradeEl.textContent = pos.grade || "";

            textWrap.appendChild(roleEl);
            metaLine.appendChild(nameEl);
            metaLine.appendChild(gradeEl);
            textWrap.appendChild(metaLine);

            const actionWrap = document.createElement("div");
            actionWrap.className = "court-position-item__actions";

            const appointBtn = document.createElement("button");
            appointBtn.type = "button";
            appointBtn.className = "court-position-appoint-btn" + (isVacant ? " court-position-appoint-btn--appoint" : " court-position-appoint-btn--adjust");
            appointBtn.textContent = isVacant ? "任命" : "调整";
            appointBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              triggerTapFeedback();
              openInlineAppointByPosition(pos.id);
            });
            actionWrap.appendChild(appointBtn);
            textWrap.appendChild(actionWrap);

            item.appendChild(avatarWrap);
            item.appendChild(textWrap);

            item.addEventListener("click", () => {
              triggerTapFeedback();
              if (holder) {
                showMinisterDetail({ ...holder, role: pos.name, id: holder.id }, state, tagsConfigCache);
              } else {
                openInlineAppointByPosition(pos.id);
              }
            });

            grid.appendChild(item);
          });

          moduleSection.appendChild(grid);
        }
      } else {
        moduleDepts.forEach(deptId => {
          const posList = groupedPositions.get(deptId);
          if (!posList || posList.length === 0) return;

          const dept = deptMap.get(deptId) || { name: deptId, color: '#666' };
          const vacantCount = posList.filter((p) => !appointments[p.id]).length;

          const section = document.createElement("section");
          const sectionIsOpen = courtModuleUIState.expandedDeptId === deptId;
          section.className = "court-dept-section" + (sectionIsOpen ? " is-open" : "");
          section.style.setProperty("--court-dept-accent", dept.color || "#666");

          const groupTitle = document.createElement("div");
          groupTitle.className = "court-position-group-title";
          groupTitle.innerHTML = `
            <span class="court-position-group-title__name">${dept.name || deptId}</span>
            <span class="court-position-group-title__badge" aria-label="空缺职位数">${vacantCount}</span>
            <span class="court-position-group-title__arrow">▸</span>
          `;
          groupTitle.addEventListener("click", () => {
            triggerTapFeedback();
            courtModuleUIState.expandedDeptId = courtModuleUIState.expandedDeptId === deptId ? null : deptId;
            rerenderCourtMainView();
          });
          section.appendChild(groupTitle);

          if (sectionIsOpen) {
            const grid = document.createElement("div");
            grid.className = "court-position-grid";

            const sortedPosList = [...posList].sort((a, b) => {
              if (deptId === "neige") {
                const neiGeOrder = new Map([
                  ["neige_shoufu", 1],
                  ["neige_cifu", 2],
                  ["neige_daxueshi", 3],
                ]);
                const aOrder = neiGeOrder.get(a.id) || 99;
                const bOrder = neiGeOrder.get(b.id) || 99;
                if (aOrder !== bOrder) return aOrder - bOrder;
              }
              return (b.importance || 0) - (a.importance || 0);
            });

            sortedPosList.forEach((pos) => {
              const holderId = appointments[pos.id];
              const holder = holderId ? characterMap.get(holderId) : null;
              const isVacant = !holder;

              const item = document.createElement("div");
              item.className = "court-position-item" + (isVacant ? " court-position-item--vacant" : "");

              const avatarWrap = document.createElement("div");
              avatarWrap.className = "court-position-avatar";
              if (holder) {
                const displayName = getDisplayName(holder.name);
                avatarWrap.appendChild(createAvatarImg(displayName, displayName?.charAt(0) || "臣"));
              } else {
                const placeholder = document.createElement("div");
                placeholder.className = "court-position-avatar-placeholder";
                placeholder.textContent = "+";
                avatarWrap.appendChild(placeholder);
              }

              const textWrap = document.createElement("div");
              textWrap.className = "court-position-text";

              const roleEl = document.createElement("div");
              roleEl.className = "court-position-item__role";
              roleEl.textContent = pos.name;

              const metaLine = document.createElement("div");
              metaLine.className = "court-position-item__meta";

              const nameEl = document.createElement("div");
              nameEl.className = "court-position-item__name";
              nameEl.textContent = holder ? getDisplayName(holder.name) : "+ 点击任命";
              if (!holder) nameEl.classList.add("court-position-item__name--vacant");

              const gradeEl = document.createElement("div");
              gradeEl.className = "court-position-item__grade";
              gradeEl.textContent = pos.grade || "";

              textWrap.appendChild(roleEl);
              metaLine.appendChild(nameEl);
              metaLine.appendChild(gradeEl);
              textWrap.appendChild(metaLine);

              const actionWrap = document.createElement("div");
              actionWrap.className = "court-position-item__actions";

              const appointBtn = document.createElement("button");
              appointBtn.type = "button";
              appointBtn.className = "court-position-appoint-btn" + (isVacant ? " court-position-appoint-btn--appoint" : " court-position-appoint-btn--adjust");
              appointBtn.textContent = isVacant ? "任命" : "调整";
              appointBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                triggerTapFeedback();
                openInlineAppointByPosition(pos.id);
              });
              actionWrap.appendChild(appointBtn);
              textWrap.appendChild(actionWrap);

              item.appendChild(avatarWrap);
              item.appendChild(textWrap);

              item.addEventListener("click", () => {
                triggerTapFeedback();
                if (holder) {
                  showMinisterDetail({ ...holder, role: pos.name, id: holder.id }, state, tagsConfigCache);
                } else {
                  openInlineAppointByPosition(pos.id);
                }
              });

              grid.appendChild(item);
            });

            section.appendChild(grid);
          }

          moduleSection.appendChild(section);
        });
      }
    }

    card.appendChild(moduleSection);
  });

  container.appendChild(card);
}

function ensureConversation(minister) {
  if (!minister) return;
  const state = getState();
  const list = state.courtChats?.[minister.id];
  const opening = (minister.openingLine || "").trim();
  if (!opening) return;
  if (Array.isArray(list) && list.length > 0) return;
  setState({
    courtChats: { ...(state.courtChats || {}), [minister.id]: [{ from: "minister", text: opening }] },
  });
}

function renderMinisterChat(container, state, tagsConfig, minister) {
  const ministerId = minister.id;
  setState({ ministerUnread: { ...(state.ministerUnread || {}), [ministerId]: false } });
  updateMinisterTabBadge(getState());

  const root = document.createElement("div");
  root.className = "court-chat-root";

  const header = document.createElement("div");
  header.className = "court-chat-header";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "court-chat-back";
  backBtn.textContent = "← 朝堂";
  backBtn.addEventListener("click", () => {
    currentMinisterChatId = null;
    root.remove();
    renderCourtView(container);
  });
  const title = document.createElement("div");
  title.className = "court-chat-title";
  const displayName = getDisplayName(minister.name);
  const updateTitle = () => {
    const latestRoleMap = buildMinisterRoleMap(getState());
    title.textContent = `${displayName}（${resolveMinisterRoleLabel(minister, latestRoleMap)}）`;
  };
  updateTitle();
  header.appendChild(backBtn);
  header.appendChild(title);
  root.appendChild(header);

  const thread = document.createElement("div");
  thread.className = "court-chat-thread";
  root.appendChild(thread);

  const deltaPanel = document.createElement("div");
  deltaPanel.className = "court-chat-delta-panel";
  root.appendChild(deltaPanel);

  const inputBar = document.createElement("div");
  inputBar.className = "court-chat-input-bar";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "court-chat-input";
  input.placeholder = "与臣子议事…";
  const sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.className = "court-chat-send";
  sendBtn.textContent = "谕旨";

  const appendMessage = (from, text) => {
    const s = getState();
    const list = [...(s.courtChats?.[ministerId] || []), { from, text }];
    setState({ courtChats: { ...(s.courtChats || {}), [ministerId]: list } });
  };

  const rerenderThread = () => {
    const latestState = getState();
    const latest = latestState.courtChats?.[ministerId] || [];
    const latestRoleMap = buildMinisterRoleMap(latestState);
    thread.innerHTML = "";
    latest.forEach((msg) => {
      const row = document.createElement("div");
      row.className = "chat-row " + (msg.from === "player" ? "chat-row--me" : "chat-row--minister");

      const avatar = document.createElement("div");
      avatar.className = "chat-avatar-small";
      if (msg.from === "player") {
        avatar.appendChild(createAvatarImg("朱由检", "帝"));
      } else {
        avatar.appendChild(createAvatarImg(displayName, displayName ? displayName.charAt(0) : "臣"));
      }

      const bubble = document.createElement("div");
      bubble.className = "chat-bubble " + (msg.from === "player" ? "chat-bubble--me" : "chat-bubble--minister");
      const speakerLabel = msg.from === "player"
        ? "皇帝·朱由检"
        : `${resolveMinisterRoleLabel(minister, latestRoleMap)}·${displayName}`;
      bubble.textContent = `${speakerLabel}：${msg.text || ""}`;

      if (msg.from === "player") {
        row.appendChild(bubble);
        row.appendChild(avatar);
      } else {
        row.appendChild(avatar);
        row.appendChild(bubble);
      }
      thread.appendChild(row);
    });
    thread.scrollTop = thread.scrollHeight;
    updateTitle();
  };

  const applyDialogueEffects = (result) => {
    const before = getState();
    const sourceEffects = result?.effects && typeof result.effects === "object" ? { ...result.effects } : {};

    if (typeof result?.loyaltyDelta === "number" && result.loyaltyDelta !== 0) {
      const nextLoyalty = sourceEffects.loyalty && typeof sourceEffects.loyalty === "object" ? { ...sourceEffects.loyalty } : {};
      nextLoyalty[ministerId] = (nextLoyalty[ministerId] || 0) + result.loyaltyDelta;
      sourceEffects.loyalty = nextLoyalty;
    }

    if (result?.appointments && typeof result.appointments === "object" && !Array.isArray(result.appointments)) {
      sourceEffects.appointments = { ...result.appointments };
    }

    const hasEffects = hasDialogueDelta(sourceEffects) || Object.keys(sourceEffects).length > 0;
    if (!hasEffects) {
      renderDialogueDeltaCard(deltaPanel, null, getState());
      return;
    }

    const { nation: nextNation, loyalty: nextLoyalty } = applyEffectsModule(before.nation || {}, sourceEffects, before.loyalty || {});
    setState({ nation: nextNation, loyalty: nextLoyalty });

    const appointmentsChanged = applyLocalAppointmentEffects(sourceEffects.appointments);
    const after = getState();
    const delta = buildDialogueDeltaFromState(before, after, sourceEffects, ministerId);
    renderDialogueDeltaCard(deltaPanel, delta, after);

    updateTopbarByState(after);
    if (appointmentsChanged) {
      showSuccess("官职任免已生效");
    }
  };

  const handleSend = async () => {
    const content = input.value.trim();
    if (!content || sendingFlags[ministerId]) return;
    if (!isAliveCharacter(getState(), ministerId)) {
      showError("该人物已故，无法继续议事。请返回朝堂。");
      return;
    }
    appendMessage("player", content);
    input.value = "";
    rerenderThread();

    const config = getState().config || {};
    const useLLM = config.storyMode === "llm" && (config.apiBase || "").trim().length > 0;

    sendingFlags[ministerId] = true;
    sendBtn.disabled = true;

    if (useLLM) {
      const chats = getState().courtChats?.[ministerId] || [];
      const history = chats.map((m) => ({
        role: m.from === "player" ? "user" : "assistant",
        content: m.text || "",
      }));
      const result = await requestMinisterReply(ministerId, history);
      sendingFlags[ministerId] = false;
      sendBtn.disabled = false;

      if (result && result.reply) {
        appendMessage("minister", result.reply);
        applyDialogueEffects(result);
      } else {
        const fallback = getAutoReplies(minister, content);
        appendMessage("minister", fallback);
        renderDialogueDeltaCard(deltaPanel, null, getState());
      }
      rerenderThread();
    } else {
      setTimeout(() => {
        sendingFlags[ministerId] = false;
        sendBtn.disabled = false;
        const replies = getAutoReplies(minister, content);
        if (replies) {
          appendMessage("minister", replies);
          rerenderThread();
        }
      }, 500);
    }
  };

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleSend(); }
  });

  inputBar.appendChild(input);
  inputBar.appendChild(sendBtn);
  root.appendChild(inputBar);
  container.appendChild(root);

  rerenderThread();
}

function getAutoReplies(minister, playerText) {
  const responses = {
    bi_ziyan: "陛下圣明。臣定当竭力筹措，只是巧妇难为无米之炊，还望陛下体谅。",
    liang_tingdong: "陛下所虑极是。臣以为唯有加征田赋、充实军费，方可练兵备战、剿灭流寇。",
    wen_tiren: "陛下英明，臣唯命是从。只是朝堂之上，人心叵测，陛下不可不防。",
    sun_chengzong: "老臣领旨。辽东之事，关乎社稷存亡，老臣虽老，仍愿为陛下分忧。",
    cao_huachun: "奴婢遵旨。奴婢这就去办，定不负万岁爷所托。",
    hong_chengchou: "臣领旨谢恩。有陛下支持，臣定当全力以赴，剿灭流贼。",
  };
  return responses[minister.id] || "臣领旨，定当尽心竭力。";
}

function showAppointmentDialog(position, state) {
  showAppointmentDialogAsync(position, state);
}

async function showAppointmentDialogAsync(position, state) {
  const app = document.getElementById("app");
  if (!app) return;

  const charactersData = await loadJSON("data/characters.json");
  const allCharacters = charactersData?.characters || [];
  
  const excludedIds = new Set([
    'chongzhendi', 'zhouhuanghou', 'yuanfei', 'tianfei',
    'duoergun', 'duoduo', 'haoge', 'aji', 'huangtaiji', 'daishan', 'jierhalang', 'fanwencheng',
    'lizicheng', 'zhangxianzhong', 'gaoyingxiang', 'luorucai', 'liuzongmin',
    'liyan', 'niujinxing', 'songxiance',
    'lidingguo', 'sunkewang', 'liuwenxiu', 'ainengqi'
  ]);
  
  const excludedFactions = new Set(['rebel', 'qing']);
  
  const aliveCharacters = allCharacters.filter(c => 
    c.isAlive !== false && 
    !excludedIds.has(c.id) && 
    !excludedFactions.has(c.faction)
  );
  const appointedIds = new Set(Object.values(state.appointments || {}));
  const availableCharacters = aliveCharacters.filter(c => !appointedIds.has(c.id));

  let overlay = document.getElementById("appointment-dialog-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "appointment-dialog-overlay";
  overlay.className = "appointment-dialog-overlay";

  const card = document.createElement("div");
  card.className = "appointment-dialog-card";

  const header = document.createElement("div");
  header.className = "appointment-dialog-card__header";
  const title = document.createElement("div");
  title.className = "appointment-dialog-card__title";
  title.textContent = `任命 ${position.name}`;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "appointment-dialog-card__close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const positionInfo = document.createElement("div");
  positionInfo.className = "appointment-dialog-position-info";
  positionInfo.innerHTML = `
    <div class="position-info-item"><span>品级:</span> ${position.grade || '未设置'}</div>
    <div class="position-info-item"><span>职责:</span> ${position.description || '无'}</div>
  `;

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "appointment-search-input";
  searchInput.placeholder = "搜索角色姓名或字号...";

  const characterList = document.createElement("div");
  characterList.className = "appointment-character-list";

  const selectedHint = document.createElement("div");
  selectedHint.className = "appointment-selected-hint";
  selectedHint.textContent = "请先选择一位角色，再点击“确认任命”。";

  let selectedCharacter = null;
  let appointing = false;

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "appointment-dialog-confirm";
  confirmBtn.textContent = "确认任命";
  confirmBtn.disabled = true;

  const updateConfirmState = () => {
    confirmBtn.disabled = !selectedCharacter || appointing;
    selectedHint.textContent = selectedCharacter
      ? `已选择：${getDisplayName(selectedCharacter.name)}`
      : "请先选择一位角色，再点击“确认任命”。";
  };

  const selectCharacter = (item, char) => {
    characterList.querySelectorAll(".appointment-character-item--selected").forEach((el) => {
      el.classList.remove("appointment-character-item--selected");
    });
    item.classList.add("appointment-character-item--selected");
    selectedCharacter = char;
    updateConfirmState();
  };

  const renderCharacters = (filter = "") => {
    characterList.innerHTML = "";
    const filtered = filter 
      ? availableCharacters.filter(c => c.name.includes(filter) || (c.courtesyName && c.courtesyName.includes(filter)))
      : availableCharacters;

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "appointment-empty";
      empty.textContent = filter ? "未找到匹配的角色" : "暂无可用角色";
      characterList.appendChild(empty);
      return;
    }

    filtered.slice(0, 30).forEach(char => {
      const displayName = getDisplayName(char.name);
      const item = document.createElement("div");
      item.className = "appointment-character-item";
      
      const avatar = document.createElement("div");
      avatar.className = "appointment-character-avatar";
      avatar.appendChild(createAvatarImg(displayName, displayName?.charAt(0) || "?"));

      const info = document.createElement("div");
      info.className = "appointment-character-info";
      
      const nameEl = document.createElement("div");
      nameEl.className = "appointment-character-name";
      nameEl.textContent = displayName;
      
      const metaEl = document.createElement("div");
      metaEl.className = "appointment-character-meta";
      const metaParts = [];
      if (char.courtesyName) metaParts.push(`字${char.courtesyName}`);
      if (char.factionLabel) metaParts.push(char.factionLabel);
      if (char.birthYear) metaParts.push(`${char.birthYear}年生`);
      metaEl.textContent = metaParts.join(" · ");

      const loyaltyEl = document.createElement("div");
      loyaltyEl.className = "appointment-character-loyalty";
      const stateLoyalty = state.loyalty || {};
      const loyaltyValue = stateLoyalty[char.id] !== undefined ? stateLoyalty[char.id] : (char.loyalty || 30);
      loyaltyEl.textContent = `忠诚: ${loyaltyValue}`;

      info.appendChild(nameEl);
      info.appendChild(metaEl);
      info.appendChild(loyaltyEl);

      item.appendChild(avatar);
      item.appendChild(info);

      item.addEventListener("click", () => selectCharacter(item, char));

      characterList.appendChild(item);
    });
  };

  searchInput.addEventListener("input", (e) => {
    renderCharacters(e.target.value);
  });

  confirmBtn.addEventListener("click", async () => {
    if (!selectedCharacter || appointing) return;

    appointing = true;
    confirmBtn.textContent = "任命中...";
    updateConfirmState();

    try {
      const result = await requestAppoint(position.id, selectedCharacter.id);
      if (result?.success === false) {
        showError(`任命失败: ${result.error || "未知错误"}`);
        return;
      }

      const s = getState();
      const currentAppointments = s.appointments || {};
      const newAppointments = { ...currentAppointments };
      for (const [posId, charId] of Object.entries(newAppointments)) {
        if (charId === selectedCharacter.id) {
          delete newAppointments[posId];
        }
      }
      newAppointments[position.id] = selectedCharacter.id;

      setState({ appointments: newAppointments });
      overlay.remove();
      const container = document.getElementById("view-container");
      if (container) {
        container.innerHTML = "";
        renderCourtView(container);
      }
    } catch (e) {
      showError(`任命失败: ${e.message}`);
    } finally {
      appointing = false;
      confirmBtn.textContent = "确认任命";
      updateConfirmState();
    }
  });

  const body = document.createElement("div");
  body.className = "appointment-dialog-card__body";
  body.appendChild(positionInfo);
  body.appendChild(selectedHint);
  body.appendChild(searchInput);
  body.appendChild(characterList);

  const footer = document.createElement("div");
  footer.className = "appointment-dialog-card__footer";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "appointment-dialog-cancel";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => overlay.remove());
  footer.appendChild(confirmBtn);
  footer.appendChild(cancelBtn);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  app.appendChild(overlay);
  renderCharacters();
  searchInput.focus();
}

async function renderCourtView(container) {
  const state = getState();
  if (!tagsConfigCache) {
    tagsConfigCache = await getLoyaltyTags();
  }
  if (!factionsCache) {
    try {
      factionsCache = await loadJSON("data/factions.json");
    } catch (e) {
      factionsCache = { factions: [] };
    }
  }
  if (!positionsCache) {
    try {
      positionsCache = await loadJSON("data/positions.json");
    } catch (e) {
      positionsCache = { positions: [], departments: [] };
    }
  }

  container.innerHTML = "";

  if (!currentMinisterChatId) {
    const { ministers } = state;
    if (ministers && ministers.length > 0) {
      renderMinisterList(container, state, tagsConfigCache);
    }
    await renderPositionMap(container, state);
  } else {
    const { ministers } = state;
    const minister = ministers?.find((m) => m.id === currentMinisterChatId);
    if (!minister) {
      currentMinisterChatId = null;
      if (ministers && ministers.length > 0) {
        renderMinisterList(container, state, tagsConfigCache);
      }
      await renderPositionMap(container, state);
      return;
    }
    ensureConversation(minister);
    renderMinisterChat(container, state, tagsConfigCache, minister);
  }
}

export function registerCourtView() {
  router.registerView("court", (container) => {
    renderCourtView(container);
  });
}

registerCourtView();
