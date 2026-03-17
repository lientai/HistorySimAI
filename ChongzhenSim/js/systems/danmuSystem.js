import { getState } from "../state.js";

const MAX_ACTIVE = 20;
const INTERVAL_MS = 1400;
const LANE_COUNT = 4;

function buildDanmuItemsFromPublicOpinion() {
  const state = getState();
  const list = state.publicOpinion || [];
  return list
    .filter((it) => it && typeof it.text === "string" && it.text.trim().length > 0)
    .map((it) => ({
      user: it.user || "百姓",
      text: it.text.trim(),
      type: it.type || "neutral",
    }));
}

export function startDanmuForEdict(layer) {
  if (!layer) return;

  stopDanmu(layer);

  const items = buildDanmuItemsFromPublicOpinion();
  if (!items.length) return;

  let index = 0;
  let activeCount = 0;
  let lane = 0;

  function spawnOnce() {
    if (!document.body.contains(layer)) {
      stopDanmu(layer);
      return;
    }
    if (activeCount >= MAX_ACTIVE) {
      return;
    }
    const itemData = items[index];
    index = (index + 1) % items.length;

    const el = document.createElement("div");
    el.className = "edict-danmu-item";
    const clsByType = {
      loyal: "edict-danmu-item--loyal",
      angry: "edict-danmu-item--angry",
      neutral: "edict-danmu-item--neutral",
    };
    el.classList.add(clsByType[itemData.type] || "edict-danmu-item--neutral");

    const inner = document.createElement("span");
    inner.textContent = `${itemData.user}：${itemData.text}`;
    el.appendChild(inner);

    const laneIndex = lane;
    lane = (lane + 1) % LANE_COUNT;
    const laneHeight = 22;
    el.style.top = `${laneIndex * laneHeight}px`;

    activeCount += 1;
    el.addEventListener("animationend", () => {
      activeCount -= 1;
      el.remove();
    });

    layer.appendChild(el);
  }

  const timer = setInterval(spawnOnce, INTERVAL_MS);
  layer._danmuTimer = timer;
  layer._danmuCleanup = () => {
    clearInterval(timer);
    layer._danmuTimer = null;
    layer._danmuCleanup = null;
    layer.innerHTML = "";
  };

  spawnOnce();
}

export function stopDanmu(layer) {
  if (!layer) return;
  if (typeof layer._danmuCleanup === "function") {
    layer._danmuCleanup();
  }
}

