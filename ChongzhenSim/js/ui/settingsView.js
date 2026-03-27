import { router } from "../router.js";
import { getState, resetState, setState } from "../state.js";
import { saveGame, clearGame, setSavedGameplayMode } from "../storage.js";
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

  // 手动保存
  const saveItem = document.createElement("div");
  saveItem.className = "settings-item";
  const saveLabel = document.createElement("span");
  saveLabel.textContent = "手动保存（当前模式）";
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

  // 模式切换
  const modeItem = document.createElement("div");
  modeItem.className = "settings-item";
  modeItem.style.flexDirection = "column";
  modeItem.style.alignItems = "stretch";
  modeItem.style.gap = "6px";

  const modeLabel = document.createElement("div");
  modeLabel.style.fontSize = "13px";
  modeLabel.style.fontWeight = "600";
  modeLabel.textContent = "玩法模式";

  const modeHint = document.createElement("div");
  modeHint.style.fontSize = "12px";
  modeHint.style.color = "var(--color-text-sub)";
  modeHint.textContent = `当前：${state.mode === "rigid_v1" ? "困难模式" : "经典模式"}`;

  const modeBtns = document.createElement("div");
  modeBtns.style.display = "flex";
  modeBtns.style.gap = "8px";

  const classicBtn = document.createElement("button");
  classicBtn.type = "button";
  classicBtn.textContent = "经典";

  const rigidBtn = document.createElement("button");
  rigidBtn.type = "button";
  rigidBtn.textContent = "困难";

  const switchMode = (targetMode) => {
    if (state.mode === targetMode) return;
    const targetLabel = targetMode === "rigid_v1" ? "困难模式" : "经典模式";
    if (!confirm(`切换到${targetLabel}？\n将加载该模式的独立存档。`)) return;

    setSavedGameplayMode(targetMode);
    setState({
      mode: targetMode,
      config: {
        ...(state.config || {}),
        gameplayMode: targetMode,
      },
    });
    window.location.reload();
  };

  classicBtn.addEventListener("click", () => switchMode("classic"));
  rigidBtn.addEventListener("click", () => switchMode("rigid_v1"));

  modeBtns.appendChild(classicBtn);
  modeBtns.appendChild(rigidBtn);

  modeItem.appendChild(modeLabel);
  modeItem.appendChild(modeHint);
  modeItem.appendChild(modeBtns);
  list.appendChild(modeItem);

  // 清除存档（仅当前模式）
  const clearItem = document.createElement("div");
  clearItem.className = "settings-item";
  const clearLabel = document.createElement("span");
  clearLabel.textContent = "清除当前模式存档（重新开始）";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "清除";
  clearBtn.style.color = "var(--color-danger)";
  clearBtn.style.borderColor = "var(--color-danger)";
  clearBtn.addEventListener("click", () => {
    if (confirm("确定要清除当前模式存档吗？此操作不可恢复。")) {
      clearGame(state.mode);
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
  info1.textContent = `当前进度：崇祯${state.currentYear || 3}年${state.currentMonth || 4}月 · 第${state.currentDay || 1}日 · ${phaseLabel}`;
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
  backBtn.textContent = "返回诏书";
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
