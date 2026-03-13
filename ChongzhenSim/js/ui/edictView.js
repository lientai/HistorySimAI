import { router } from "../router.js";
import { runCurrentTurn } from "../systems/turnSystem.js";
import { takeEdictScrollTop } from "./scrollMemory.js";

const PANELS_WRAP_ID = "edict-panels-wrap";
let isFirstVisit = true;

function ensurePanelsWrap() {
  let wrap = document.getElementById(PANELS_WRAP_ID);
  if (wrap) return wrap;
  const app = document.getElementById("app");
  if (!app) return null;
  wrap = document.createElement("div");
  wrap.id = PANELS_WRAP_ID;
  wrap.className = "edict-panels-wrap";
  app.appendChild(wrap);
  return wrap;
}

export function registerEdictView() {
  router.registerView("edict", async (container) => {
    container.classList.add("main-view--edict");
    ensurePanelsWrap();
    container._storyRenderId = (container._storyRenderId || 0) + 1;
    const renderId = container._storyRenderId;
    await runCurrentTurn(container, { renderId });
    requestAnimationFrame(() => {
      const saved = takeEdictScrollTop();
      container.scrollTop = saved != null ? saved : container.scrollHeight;
    });
    isFirstVisit = false;
  });
}

registerEdictView();
