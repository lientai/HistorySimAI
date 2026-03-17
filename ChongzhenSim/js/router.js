import { saveEdictScrollTop } from "./ui/scrollMemory.js";

export const router = (() => {
  const VIEW_IDS = {
    START: "start",
    EDICT: "edict",
    COURT: "court",
    NATION: "nation",
    SETTINGS: "settings",
  };

  let currentView = VIEW_IDS.EDICT;
  let viewRenderers = {};
  const DEBOUNCE_MS = 400;
  let lastSetViewAt = 0;

  function registerView(id, renderFn) {
    viewRenderers[id] = renderFn;
  }

  function setView(id) {
    const hasRenderer = !!viewRenderers[id];
    if (!hasRenderer) return;
    if (id === VIEW_IDS.EDICT) {
      const now = Date.now();
      if (currentView === VIEW_IDS.EDICT && now - lastSetViewAt < DEBOUNCE_MS) {
        highlightBottomTab(id);
        return;
      }
      lastSetViewAt = now;
    }
    const previousView = currentView;
    currentView = id;

    if (id !== VIEW_IDS.EDICT) {
      const wrap = document.getElementById("edict-panels-wrap");
      if (wrap) wrap.remove();
    }

    const main = document.getElementById("main-view");
    if (!main) return;
    if (previousView === VIEW_IDS.EDICT && id !== VIEW_IDS.EDICT) {
      saveEdictScrollTop(main.scrollTop);
    }
    main.innerHTML = "";
    viewRenderers[id](main);
    highlightBottomTab(id);
  }

  function highlightBottomTab(id) {
    const tabEls = document.querySelectorAll("[data-tab-id]");
    tabEls.forEach((el) => {
      if (el.getAttribute("data-tab-id") === id) {
        el.classList.add("bottom-tab--active");
      } else {
        el.classList.remove("bottom-tab--active");
      }
    });
  }

  function init() {
    // bootstrap logic handled by main.js
  }

  return { VIEW_IDS, registerView, setView, init };
})();
