import { getState, setState } from "../state.js";
import { saveGame, setSavedGameplayMode } from "../storage.js";
import { router } from "../router.js";
import { loadJSON } from "../dataLoader.js";
import { showGoalPanel } from "./goalPanel.js";

let startPhase = "intro";

export function setStartPhase(phase) {
  startPhase = phase === "create" ? "create" : "intro";
}

function applyModeSelection(mode) {
  const state = getState();
  const nextMode = mode === "rigid_v1" ? "rigid_v1" : "classic";
  const rigidCalendar = state?.rigid?.calendar || { year: 1627, month: 8 };
  setState({
    mode: nextMode,
    config: {
      ...(state.config || {}),
      gameplayMode: nextMode,
    },
    ...(nextMode === "rigid_v1"
      ? {
        currentYear: Math.max(1, (Number(rigidCalendar.year) || 1627) - 1626),
        currentMonth: Number(rigidCalendar.month) || 8,
        currentPhase: "morning",
      }
      : {}),
  });
  setSavedGameplayMode(nextMode);
}

async function renderIntroView(container) {
  const root = document.createElement("div");
  root.className = "start-intro-root";

  const title = document.createElement("div");
  title.className = "start-intro-title";
  title.textContent = "崇祯皇帝模拟器";
  root.appendChild(title);

  const block = document.createElement("div");
  block.className = "edict-block start-intro-block";
  root.appendChild(block);

  const modeWrap = document.createElement("div");
  modeWrap.className = "start-intro-actions";
  modeWrap.style.marginBottom = "10px";

  const modeLabel = document.createElement("div");
  modeLabel.style.fontSize = "12px";
  modeLabel.style.color = "var(--color-text-sub)";
  modeLabel.style.marginBottom = "6px";
  modeLabel.style.textAlign = "left";
  modeLabel.textContent = "请选择玩法模式";
  modeWrap.appendChild(modeLabel);

  let selectedMode = getState().mode === "rigid_v1" ? "rigid_v1" : "classic";

  const buildModeBtn = (mode, label, desc) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "start-view-btn";
    btn.style.marginBottom = "6px";
    btn.style.textAlign = "left";
    btn.style.border = "1px solid var(--color-border-soft)";
    btn.style.background = "var(--color-block-bg)";
    btn.style.color = "var(--color-text-main)";
    btn.innerHTML = `<div style=\"font-weight:700;\">${label}</div><div style=\"font-size:12px;opacity:.8;\">${desc}</div>`;
    btn.addEventListener("click", () => {
      selectedMode = mode;
      refreshModeButtons();
    });
    return btn;
  };

  const classicBtn = buildModeBtn("classic", "经典模式", "初玩者推荐，崇祯皇帝模拟器第一代节奏与叙事系统");
  const rigidBtn = buildModeBtn("rigid_v1", "困难模式", "更严苛的节奏与叙事系统，适合追求挑战的玩家");
  modeWrap.appendChild(classicBtn);
  modeWrap.appendChild(rigidBtn);

  function refreshModeButtons() {
    const pairs = [
      [classicBtn, "classic"],
      [rigidBtn, "rigid_v1"],
    ];
    pairs.forEach(([btn, mode]) => {
      const active = selectedMode === mode;
      btn.style.borderColor = active ? "var(--color-accent)" : "var(--color-border-soft)";
      btn.style.boxShadow = active ? "0 0 0 1px var(--color-accent) inset" : "none";
    });
  }
  refreshModeButtons();
  root.appendChild(modeWrap);

  const actions = document.createElement("div");
  actions.className = "start-intro-actions";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "start-view-btn start-view-btn--primary start-intro-start-btn";
  startBtn.textContent = "临朝执政";
  startBtn.disabled = true;

  actions.appendChild(startBtn);
  root.appendChild(actions);
  container.appendChild(root);

  let data;
  try {
    data = await loadJSON("data/intro.json");
  } catch (err) {
    console.error("加载游戏介绍失败", err);
  }

  const lines = Array.isArray(data?.lines) ? data.lines : [];
  if (!lines.length) {
    startBtn.disabled = false;
  } else {
    let index = 0;
    const delay = 1200;

    const addLine = () => {
      if (index >= lines.length) {
        startBtn.disabled = false;
        return;
      }
      const lineText = lines[index++];
      const lineEl = document.createElement("div");
      lineEl.className = "pseudo-line";
      const span = document.createElement("span");
      span.className = "pseudo-line-text start-intro-line";
      const colorIndex = (index - 1) % 5;
      span.classList.add(`start-intro-line--c${colorIndex}`);
      span.textContent = lineText;
      lineEl.appendChild(span);
      block.appendChild(lineEl);
      block.scrollTop = block.scrollHeight;
      setTimeout(addLine, delay);
    };

    addLine();
  }

  startBtn.addEventListener("click", () => {
    applyModeSelection(selectedMode);
    setState({ gameStarted: true });
    saveGame();
    router.setView(router.VIEW_IDS.EDICT);
    showGoalPanel();
  });
}

export async function renderStartView(container) {
  await renderIntroView(container);
}

export function registerStartView() {
  router.registerView("start", (container) => {
    renderStartView(container);
  });
}

registerStartView();
