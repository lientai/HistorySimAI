import { router } from "../router.js";
import { getState, setState } from "../state.js";
import { updateMinisterTabBadge } from "../layout.js";
import { loadJSON } from "../dataLoader.js";
import { getLoyaltyTags, getLoyaltyStage, getLoyaltyColor, getFactionClass } from "../systems/courtSystem.js";
import { requestMinisterReply } from "../api/ministerChat.js";

let currentMinisterChatId = null;
let tagsConfigCache = null;
let factionsCache = null;
let positionsCache = null;
const sendingFlags = {};

function createAvatarImg(name, fallbackChar) {
  const img = document.createElement("img");
  img.src = `assets/${name}.jpg`;
  img.alt = name || "";
  img.onerror = function () {
    this.style.display = "none";
    this.parentElement.textContent = fallbackChar || (name ? name.charAt(0) : "臣");
  };
  return img;
}

const MINISTER_NAME_COLORS = [
  "#8B0000", "#2e7d32", "#1565c0", "#e65100", "#6a1b9a",
  "#00695c", "#ad1457", "#4527a0",
];

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
  avatar.appendChild(createAvatarImg(minister.name, minister.name ? minister.name.charAt(0) : "臣"));

  const nameEl = document.createElement("div");
  nameEl.className = "minister-detail-card__name";
  nameEl.textContent = minister.name;

  const roleEl = document.createElement("div");
  roleEl.className = "minister-detail-card__role";
  roleEl.textContent = `${minister.role} · ${minister.factionLabel || ""}`;

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
  appointBtn.textContent = "调整官职";
  appointBtn.addEventListener("click", () => {
    overlay.remove();
    showPositionSelectDialog(minister, state);
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
  title.textContent = `为 ${minister.name} 调整官职`;
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

    item.addEventListener("click", async () => {
      try {
        const s = getState();
        const currentAppointments = s.appointments || {};
        const newAppointments = { ...currentAppointments };
        
        for (const [posId, charId] of Object.entries(newAppointments)) {
          if (charId === minister.id) {
            delete newAppointments[posId];
          }
        }
        
        newAppointments[pos.id] = minister.id;
        
        const response = await fetch("/api/chongzhen/appoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionId: pos.id, characterId: minister.id })
        });
        const result = await response.json();
        
        if (result.success) {
          setState({ appointments: newAppointments });
          overlay.remove();
          const container = document.getElementById("view-container");
          if (container) {
            container.innerHTML = "";
            renderCourtView(container);
          }
        } else {
          alert(`任命失败: ${result.error || "未知错误"}`);
        }
      } catch (e) {
        alert(`任命失败: ${e.message}`);
      }
    });

    positionList.appendChild(item);
  });

  const body = document.createElement("div");
  body.className = "appointment-dialog-card__body";
  body.appendChild(positionList);

  const footer = document.createElement("div");
  footer.className = "appointment-dialog-card__footer";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "appointment-dialog-cancel";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => overlay.remove());
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

  factions.forEach((f) => {
    const section = document.createElement("div");
    section.style.padding = "8px";
    section.style.borderRadius = "6px";
    section.style.border = `1px solid ${f.color}33`;
    section.style.background = `${f.color}08`;

    const fName = document.createElement("div");
    fName.style.fontWeight = "700";
    fName.style.color = f.color;
    fName.style.fontSize = "13px";
    fName.textContent = f.name;
    section.appendChild(fName);

    const fDesc = document.createElement("div");
    fDesc.style.fontSize = "11px";
    fDesc.style.color = "var(--color-text-sub)";
    fDesc.style.marginTop = "4px";
    fDesc.textContent = f.description;
    section.appendChild(fDesc);

    const memberList = document.createElement("div");
    memberList.style.marginTop = "6px";
    memberList.style.fontSize = "12px";
    (f.members || []).forEach((mid) => {
      const m = ministers.find((mi) => mi.id === mid);
      if (!m) return;
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.padding = "2px 0";
      row.textContent = `${m.name}（${m.role}）`;
      const lval = document.createElement("span");
      lval.textContent = `忠诚: ${loyalty[mid] || 0}`;
      lval.style.color = "var(--color-text-sub)";
      row.appendChild(lval);
      memberList.appendChild(row);
    });
    section.appendChild(memberList);

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

function renderMinisterList(container, state, tagsConfig) {
  const { ministers, loyalty } = state;

  const header = document.createElement("div");
  header.className = "court-view-header";
  const title = document.createElement("div");
  title.className = "court-view-title";
  title.textContent = "朝堂群臣";
  const relBtn = document.createElement("button");
  relBtn.type = "button";
  relBtn.className = "court-relations-btn";
  relBtn.textContent = "派系";
  relBtn.addEventListener("click", () => showFactionPanel(state));
  header.appendChild(title);
  header.appendChild(relBtn);
  container.appendChild(header);

  const list = document.createElement("div");
  list.className = "minister-list";

  const ministerUnread = state.ministerUnread || {};
  (ministers || []).forEach((m, index) => {
    const item = document.createElement("div");
    item.className = "minister-item" + (ministerUnread[m.id] ? " minister-item--unread" : "");

    const avatar = document.createElement("div");
    avatar.className = "minister-avatar";
    avatar.appendChild(createAvatarImg(m.name, m.name ? m.name.charAt(0) : "臣"));
    const score = loyalty ? loyalty[m.id] || 0 : 0;
    const loyaltyBadge = document.createElement("div");
    loyaltyBadge.className = "minister-avatar-loyalty";
    loyaltyBadge.textContent = score;
    avatar.appendChild(loyaltyBadge);

    avatar.addEventListener("click", (e) => {
      e.stopPropagation();
      showMinisterDetail(m, state, tagsConfig);
    });

    const main = document.createElement("div");
    main.className = "minister-main";
    const nameLine = document.createElement("div");
    nameLine.className = "minister-name";
    nameLine.textContent = m.name;
    nameLine.style.color = MINISTER_NAME_COLORS[index % MINISTER_NAME_COLORS.length];
    const roleLine = document.createElement("div");
    roleLine.className = "minister-role";
    roleLine.textContent = m.role;

    const factionTag = document.createElement("span");
    factionTag.className = "minister-faction-tag " + getFactionClass(m.faction);
    factionTag.textContent = m.factionLabel || m.faction || "";

    const preview = document.createElement("div");
    preview.className = "minister-preview";
    const chats = state.courtChats?.[m.id];
    const lastMsg = Array.isArray(chats) && chats.length > 0 ? chats[chats.length - 1] : null;
    preview.textContent = lastMsg ? (lastMsg.text || "").slice(0, 40) : m.attitude || "";

    main.appendChild(nameLine);
    main.appendChild(roleLine);
    main.appendChild(factionTag);
    main.appendChild(preview);

    const meta = document.createElement("div");
    meta.className = "minister-meta";
    const stageLabel = getLoyaltyStage(score, tagsConfig);
    const stageColor = getLoyaltyColor(score, tagsConfig);
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
      currentMinisterChatId = m.id;
      container.innerHTML = "";
      renderCourtView(container);
    });

    list.appendChild(item);
  });

  container.appendChild(list);
}

async function renderPositionMap(container, state) {
  if (!positionsCache) {
    try {
      positionsCache = await loadJSON("data/positions.json");
    } catch (e) {
      positionsCache = { positions: [], departments: [] };
    }
  }

  const positions = positionsCache?.positions || [];
  const departments = positionsCache?.departments || [];
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

  const deptMap = new Map(departments.map(d => [d.id, d]));

  const groupedPositions = new Map();
  positions.forEach(pos => {
    const deptId = pos.department || 'other';
    if (!groupedPositions.has(deptId)) {
      groupedPositions.set(deptId, []);
    }
    groupedPositions.get(deptId).push(pos);
  });

  const deptOrder = ['neige', 'libu', 'hubu', 'libu_li', 'bingbu', 'xingbu', 'gongbu', 'dutcheng', 'dali_si', 'tongzheng_si', 'shuntian_fu', 'local', 'military', 'neiting', 'other'];

  deptOrder.forEach(deptId => {
    const posList = groupedPositions.get(deptId);
    if (!posList || posList.length === 0) return;

    const dept = deptMap.get(deptId) || { name: deptId, color: '#666' };

    const groupTitle = document.createElement("div");
    groupTitle.className = "court-position-group-title";
    groupTitle.style.borderLeftColor = dept.color || '#666';
    groupTitle.textContent = dept.name || deptId;
    card.appendChild(groupTitle);

    const grid = document.createElement("div");
    grid.className = "court-position-grid";

    posList.forEach((pos) => {
      const holderId = appointments[pos.id];
      const holder = holderId ? characterMap.get(holderId) : null;
      const isVacant = !holder;

      const item = document.createElement("div");
      item.className = "court-position-item" + (isVacant ? " court-position-item--vacant" : "");

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "court-position-avatar";
      if (holder) {
        avatarWrap.appendChild(createAvatarImg(holder.name, holder.name?.charAt(0) || "臣"));
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "court-position-avatar-placeholder";
        placeholder.textContent = "虚";
        avatarWrap.appendChild(placeholder);
      }

      const textWrap = document.createElement("div");

      const roleEl = document.createElement("div");
      roleEl.className = "court-position-item__role";
      roleEl.textContent = pos.name;

      const nameEl = document.createElement("div");
      nameEl.className = "court-position-item__name";
      if (holder) {
        nameEl.textContent = holder.name;
      } else {
        nameEl.textContent = "待任命";
        nameEl.style.color = "var(--color-text-sub)";
      }

      const gradeEl = document.createElement("div");
      gradeEl.className = "court-position-item__grade";
      gradeEl.textContent = pos.grade || "";

      textWrap.appendChild(roleEl);
      textWrap.appendChild(nameEl);
      textWrap.appendChild(gradeEl);

      if (isVacant) {
        const appointBtn = document.createElement("button");
        appointBtn.type = "button";
        appointBtn.className = "court-position-appoint-btn";
        appointBtn.textContent = "任命";
        appointBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showAppointmentDialog(pos, state);
        });
        textWrap.appendChild(appointBtn);
      }

      item.appendChild(avatarWrap);
      item.appendChild(textWrap);

      if (holder) {
        item.addEventListener("click", () => {
          showMinisterDetail({
            ...holder,
            role: pos.name,
            id: holder.id
          }, state, tagsConfigCache);
        });
      }

      grid.appendChild(item);
    });

    card.appendChild(grid);
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
  title.textContent = `${minister.name}（${minister.role}）`;
  header.appendChild(backBtn);
  header.appendChild(title);
  root.appendChild(header);

  const thread = document.createElement("div");
  thread.className = "court-chat-thread";
  root.appendChild(thread);

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
    const latest = getState().courtChats?.[ministerId] || [];
    thread.innerHTML = "";
    latest.forEach((msg) => {
      const row = document.createElement("div");
      row.className = "chat-row " + (msg.from === "player" ? "chat-row--me" : "chat-row--minister");

      const avatar = document.createElement("div");
      avatar.className = "chat-avatar-small";
      if (msg.from === "player") {
        avatar.appendChild(createAvatarImg("朱由检", "帝"));
      } else {
        avatar.appendChild(createAvatarImg(minister.name, minister.name ? minister.name.charAt(0) : "臣"));
      }

      const bubble = document.createElement("div");
      bubble.className = "chat-bubble " + (msg.from === "player" ? "chat-bubble--me" : "chat-bubble--minister");
      bubble.textContent = msg.text;

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
  };

  const handleSend = async () => {
    const content = input.value.trim();
    if (!content || sendingFlags[ministerId]) return;
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
        if (typeof result.loyaltyDelta === "number" && result.loyaltyDelta !== 0) {
          const s = getState();
          const loyalty = { ...(s.loyalty || {}) };
          loyalty[ministerId] = Math.max(0, Math.min(100, (loyalty[ministerId] || 0) + result.loyaltyDelta));
          setState({ loyalty });
        }
      } else {
        const fallback = getAutoReplies(minister, content);
        appendMessage("minister", fallback);
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
      const item = document.createElement("div");
      item.className = "appointment-character-item";
      
      const avatar = document.createElement("div");
      avatar.className = "appointment-character-avatar";
      avatar.appendChild(createAvatarImg(char.name, char.name?.charAt(0) || "?"));

      const info = document.createElement("div");
      info.className = "appointment-character-info";
      
      const nameEl = document.createElement("div");
      nameEl.className = "appointment-character-name";
      nameEl.textContent = char.name;
      
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

      item.addEventListener("click", async () => {
        try {
          const s = getState();
          const currentAppointments = s.appointments || {};
          
          const newAppointments = { ...currentAppointments };
          
          for (const [posId, charId] of Object.entries(newAppointments)) {
            if (charId === char.id) {
              delete newAppointments[posId];
            }
          }
          
          newAppointments[position.id] = char.id;
          
          const response = await fetch("/api/chongzhen/appoint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ positionId: position.id, characterId: char.id })
          });
          const result = await response.json();
          
          if (result.success) {
            setState({ appointments: newAppointments });
            overlay.remove();
            const container = document.getElementById("view-container");
            if (container) {
              container.innerHTML = "";
              renderCourtView(container);
            }
          } else {
            alert(`任命失败: ${result.error || "未知错误"}`);
          }
        } catch (e) {
          alert(`任命失败: ${e.message}`);
        }
      });

      characterList.appendChild(item);
    });
  };

  searchInput.addEventListener("input", (e) => {
    renderCharacters(e.target.value);
  });

  const body = document.createElement("div");
  body.className = "appointment-dialog-card__body";
  body.appendChild(positionInfo);
  body.appendChild(searchInput);
  body.appendChild(characterList);

  const footer = document.createElement("div");
  footer.className = "appointment-dialog-card__footer";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "appointment-dialog-cancel";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => overlay.remove());
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

  container.innerHTML = "";

  if (!currentMinisterChatId) {
    await renderPositionMap(container, state);
    const { ministers } = state;
    if (ministers && ministers.length > 0) {
      renderMinisterList(container, state, tagsConfigCache);
    }
  } else {
    const { ministers } = state;
    const minister = ministers?.find((m) => m.id === currentMinisterChatId);
    if (!minister) {
      currentMinisterChatId = null;
      await renderPositionMap(container, state);
      if (ministers && ministers.length > 0) {
        renderMinisterList(container, state, tagsConfigCache);
      }
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
