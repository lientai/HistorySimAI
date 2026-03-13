import { router } from "../router.js";
import { getState, resetState } from "../state.js";
import { saveGame, clearGame } from "../storage.js";
import { updateTopbarByState, updateGoalBar } from "../layout.js";

function renderSettingsView(container) {
  const state = getState();

  const root = document.createElement("div");

  const title = document.createElement("div");
  title.style.fontSize = "16px";
  title.style.fontWeight = "700";
  title.style.color = "var(--color-text-main)";
  title.style.marginBottom = "12px";
  title.textContent = "设置";
  root.appendChild(title);

  const list = document.createElement("div");
  list.className = "settings-list";

  // 手动存档
  const saveItem = document.createElement("div");
  saveItem.className = "settings-item";
  const saveLabel = document.createElement("span");
  saveLabel.textContent = "手动存档";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "保存";
  saveBtn.addEventListener("click", () => {
    saveGame();
    saveBtn.textContent = "已保存";
    setTimeout(() => { saveBtn.textContent = "保存"; }, 1500);
  });
  saveItem.appendChild(saveLabel);
  saveItem.appendChild(saveBtn);
  list.appendChild(saveItem);

  // 清除存档
  const clearItem = document.createElement("div");
  clearItem.className = "settings-item";
  const clearLabel = document.createElement("span");
  clearLabel.textContent = "清除存档（重新开始）";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "清除";
  clearBtn.style.color = "var(--color-danger)";
  clearBtn.style.borderColor = "var(--color-danger)";
  clearBtn.addEventListener("click", () => {
    if (confirm("确定要清除存档并重新开始吗？所有进度将丢失。")) {
      clearGame();
      resetState();
      updateTopbarByState(getState());
      updateGoalBar(getState());
      window.location.reload();
    }
  });
  clearItem.appendChild(clearLabel);
  clearItem.appendChild(clearBtn);
  list.appendChild(clearItem);

  // 游戏状态信息
  const infoItem = document.createElement("div");
  infoItem.className = "settings-item";
  infoItem.style.flexDirection = "column";
  infoItem.style.alignItems = "flex-start";
  infoItem.style.gap = "4px";

  const config = state.config || {};
  const phaseLabels = config.phaseLabels || { morning: "早朝", afternoon: "午后", evening: "夜间" };
  const phaseLabel = phaseLabels[state.currentPhase] || "";

  const info1 = document.createElement("div");
  info1.style.fontSize = "12px";
  info1.style.color = "var(--color-text-sub)";
  info1.textContent = `当前进度：崇祯${state.currentYear || 3}年${state.currentMonth || 4}月 · 第${state.currentDay || 1}天 · ${phaseLabel}`;
  const info2 = document.createElement("div");
  info2.style.fontSize = "12px";
  info2.style.color = "var(--color-text-sub)";
  info2.textContent = `国库：${(state.nation?.treasury || 0).toLocaleString()}两 · 民心：${state.nation?.civilMorale || 0}`;
  infoItem.appendChild(info1);
  infoItem.appendChild(info2);
  list.appendChild(infoItem);

  // 返回按钮
  const backItem = document.createElement("div");
  backItem.className = "settings-item";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "← 返回诏书";
  backBtn.addEventListener("click", () => {
    router.setView(router.VIEW_IDS.EDICT);
  });
  backItem.appendChild(backBtn);
  list.appendChild(backItem);

  root.appendChild(list);
  container.appendChild(root);
}

export function registerSettingsView() {
  router.registerView("settings", (container) => {
    renderSettingsView(container);
  });
}

registerSettingsView();
