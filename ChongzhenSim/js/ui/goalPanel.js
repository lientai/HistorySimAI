import { getState, setState } from "../state.js";
import { saveGame } from "../storage.js";
import { updateGoalBar } from "../layout.js";
import { checkGoalCompleted } from "../systems/goalCheck.js";

let overlayEl = null;

export function showGoalPanel() {
  if (overlayEl) return;

  overlayEl = document.createElement("div");
  overlayEl.className = "goal-panel-overlay";

  const panel = document.createElement("div");
  panel.className = "goal-panel";

  const header = document.createElement("div");
  header.className = "goal-panel-header";
  const title = document.createElement("span");
  title.className = "goal-panel-title";
  title.textContent = "治国目标";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "goal-panel-close";
  closeBtn.textContent = "\u00d7";
  closeBtn.addEventListener("click", hideGoalPanel);
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const list = document.createElement("div");
  list.className = "goal-panel-list";
  panel.appendChild(list);

  overlayEl.appendChild(panel);
  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) hideGoalPanel();
  });

  document.body.appendChild(overlayEl);
  renderGoalList(list);
}

function renderGoalList(list) {
  list.innerHTML = "";
  const state = getState();
  const goals = state.goals || [];

  if (!goals.length) {
    const empty = document.createElement("div");
    empty.className = "goal-panel-empty";
    empty.textContent = "当前暂无可追踪目标。";
    list.appendChild(empty);
    return;
  }

  let trackedId = state.trackedGoalId;

  if (trackedId && checkGoalCompleted(trackedId, state)) {
    setState({ trackedGoalId: null });
    trackedId = null;
    saveGame();
    updateGoalBar(getState());
  }

  const sorted = [...goals].sort((a, b) => {
    const aDone = checkGoalCompleted(a.id, state);
    const bDone = checkGoalCompleted(b.id, state);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (a.id === trackedId) return -1;
    if (b.id === trackedId) return 1;
    return 0;
  });

  sorted.forEach((goal) => {
    const isDone = checkGoalCompleted(goal.id, state);
    const isTracked = !isDone && goal.id === trackedId;
    const row = document.createElement("div");
    row.className =
      "goal-item" +
      (isDone ? " goal-item--done" : "") +
      (isTracked ? " goal-item--tracked" : "");

    const tag = document.createElement("span");
    if (isDone) {
      tag.className = "goal-track-tag goal-track-tag--done";
      tag.textContent = "已完成";
    } else {
      tag.className = "goal-track-tag" + (isTracked ? " goal-track-tag--active" : "");
      tag.textContent = isTracked ? "追踪中" : "追踪";
    }

    const text = document.createElement("span");
    text.className = "goal-item-text";
    text.textContent = goal.title;

    row.appendChild(tag);
    row.appendChild(text);

    if (!isDone) {
      row.addEventListener("click", () => {
        const s = getState();
        const newId = s.trackedGoalId === goal.id ? null : goal.id;
        setState({ trackedGoalId: newId });
        saveGame();
        updateGoalBar(getState());
        renderGoalList(list);
      });
    }

    list.appendChild(row);
  });
}

export function hideGoalPanel() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}
