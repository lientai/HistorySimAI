import { getState } from "../state.js";

const PANELS_WRAP_ID = "edict-panels-wrap";

export function updateEdictPanels() {
  const wrap = document.getElementById(PANELS_WRAP_ID);
  if (!wrap) return;

  wrap.innerHTML = "";
  const state = getState();
  const news = state.newsToday || [];

  if (news.length === 0) return;

  const panel = document.createElement("div");
  panel.className = "edict-float-panel edict-float-panel--news edict-float-panel--collapsed";

  const header = document.createElement("div");
  header.className = "edict-float-panel__header";
  const titleSpan = document.createElement("span");
  titleSpan.textContent = "奏折速报";
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "edict-float-panel__toggle";
  toggleBtn.textContent = "▼";
  toggleBtn.addEventListener("click", () => {
    panel.classList.toggle("edict-float-panel--collapsed");
    toggleBtn.textContent = panel.classList.contains("edict-float-panel--collapsed") ? "▼" : "▲";
  });
  header.appendChild(titleSpan);
  header.appendChild(toggleBtn);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "edict-float-panel__body";

  news.forEach((item) => {
    const newsEl = document.createElement("div");
    newsEl.className = "news-item";
    const tag = document.createElement("span");
    tag.className = "news-tag";
    if (item.tag === "急") tag.classList.add("news-tag--urgent");
    else if (item.tag === "重") tag.classList.add("news-tag--important");
    else tag.classList.add("news-tag--normal");
    tag.textContent = item.tag || "常";
    const title = document.createElement("span");
    title.textContent = item.title || "";
    title.style.fontWeight = "600";
    const summary = document.createElement("div");
    summary.textContent = item.summary || "";
    summary.style.fontSize = "11px";
    summary.style.color = "var(--color-text-sub)";
    summary.style.marginTop = "2px";
    newsEl.appendChild(tag);
    newsEl.appendChild(title);
    newsEl.appendChild(summary);
    body.appendChild(newsEl);
  });

  panel.appendChild(body);
  wrap.appendChild(panel);

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "news-fab-toggle";
  fab.textContent = "奏";
  fab.addEventListener("click", () => {
    panel.classList.toggle("edict-float-panel--collapsed");
    toggleBtn.textContent = panel.classList.contains("edict-float-panel--collapsed") ? "▼" : "▲";
  });
  wrap.appendChild(fab);
}
