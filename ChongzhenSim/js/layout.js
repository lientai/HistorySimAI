import { router } from "./router.js";
import { showGoalPanel } from "./ui/goalPanel.js";
import { checkGoalCompleted } from "./systems/goalCheck.js";

export function initLayout() {
  const topbar = document.getElementById("topbar");
  const bottombar = document.getElementById("bottombar");

  if (topbar) {
    topbar.innerHTML = "";
    const left = document.createElement("div");
    left.className = "topbar-left";

    const status = document.createElement("div");
    status.id = "topbar-status";
    status.className = "topbar-subtitle";
    status.textContent = "";
    left.appendChild(status);

    const goalBar = document.createElement("div");
    goalBar.className = "topbar-goal-bar";
    goalBar.id = "topbar-goal-bar";
    const goalTag = document.createElement("span");
    goalTag.className = "goal-tag";
    goalTag.textContent = "目标";
    const goalText = document.createElement("span");
    goalText.className = "topbar-goal-text";
    goalText.id = "topbar-goal-text";
    goalText.textContent = "点击查看目标";
    goalBar.appendChild(goalTag);
    goalBar.appendChild(goalText);
    goalBar.addEventListener("click", () => {
      showGoalPanel();
    });
    left.appendChild(goalBar);

    const right = document.createElement("div");
    right.className = "topbar-right";

    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.className = "topbar-settings-btn";
    settingsBtn.setAttribute("aria-label", "设置");
    settingsBtn.textContent = "⚙";
    settingsBtn.addEventListener("click", () => {
      router.setView(router.VIEW_IDS.SETTINGS);
    });
    right.appendChild(settingsBtn);

    topbar.appendChild(left);
    topbar.appendChild(right);
  }

  if (bottombar) {
    bottombar.innerHTML = "";
    const tabs = [
      { id: "edict", label: "诏书", icon: "📜" },
      { id: "court", label: "朝堂", icon: "🏛️" },
      { id: "nation", label: "国家", icon: "🗺️" },
    ];

    tabs.forEach((tab) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bottom-tab";
      btn.setAttribute("data-tab-id", tab.id);
      const labelWrap = document.createElement("div");
      labelWrap.className = "bottom-tab-label-wrap";
      labelWrap.innerHTML = `
        <div class="bottom-tab-icon">${tab.icon}</div>
        <div>${tab.label}</div>
      `;
      if (tab.id === "court") {
        const badge = document.createElement("span");
        badge.className = "bottom-tab__badge";
        badge.setAttribute("aria-label", "未读消息数");
        labelWrap.appendChild(badge);
      }
      btn.appendChild(labelWrap);
      btn.addEventListener("click", () => {
        router.setView(tab.id);
      });
      bottombar.appendChild(btn);
    });
  }
}

export function updateMinisterTabBadge(state) {
  if (typeof document === "undefined") return;
  const tabBtn = document.querySelector('[data-tab-id="court"]');
  const badge = tabBtn?.querySelector(".bottom-tab__badge");
  if (!badge) return;
  const ministerUnread = state?.ministerUnread || {};
  const count = Object.keys(ministerUnread).filter((k) => ministerUnread[k]).length;
  if (count <= 0) {
    badge.textContent = "";
    badge.classList.remove("bottom-tab__badge--visible");
  } else {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.add("bottom-tab__badge--visible");
  }
}

export function updateTopbarByState(state) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("topbar-status");
  if (!el || !state) return;

  const config = state.config || {};
  const phaseLabels = config.phaseLabels || {
    morning: "早朝",
    afternoon: "午后",
    evening: "夜间",
  };
  const phaseKey = state.currentPhase || "morning";
  const phaseLabel = phaseLabels[phaseKey] || "";
  const year = state.currentYear || 3;
  const month = state.currentMonth || 4;

  el.textContent = `崇祯${year}年·${month}月·${phaseLabel}`;

  const weatherEl = state.weather;
  if (weatherEl) {
    el.textContent += ` · ${weatherEl}`;
  }
}

export function updateGoalBar(state) {
  if (typeof document === "undefined") return;
  const textEl = document.getElementById("topbar-goal-text");
  if (!textEl) return;
  const goals = state?.goals || [];
  const trackedId = state?.trackedGoalId;
  if (trackedId) {
    const tracked = goals.find((g) => g.id === trackedId);
    if (tracked && checkGoalCompleted(trackedId, state)) {
      textEl.textContent = tracked.title + "（已完成）";
    } else {
      textEl.textContent = tracked ? tracked.title : "点击查看目标";
    }
  } else {
    textEl.textContent = goals.length > 0 ? "点击查看目标" : "";
  }
}
