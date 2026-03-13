import { getState, setState } from "../state.js";
import { saveGame } from "../storage.js";
import { router } from "../router.js";
import { loadJSON } from "../dataLoader.js";
import { showGoalPanel } from "./goalPanel.js";

let startPhase = "intro";

export function setStartPhase(phase) {
  startPhase = phase === "create" ? "create" : "intro";
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
