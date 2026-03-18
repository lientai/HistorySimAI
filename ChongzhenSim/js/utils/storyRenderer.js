import { buildSpeakerMap, buildMinisterNameToInfo, highlightMinisterNames, buildBlockText } from "../utils/storyParser.js";
import { loadJSON } from "../dataLoader.js";

let positionsCache = null;

const AVAILABLE_AVATAR_NAMES = new Set([
  "黄道周", "韩继思", "陈新甲", "袁崇焕", "范景文", "祖大寿", "王永光", "温体仁", "洪承畴", "毕自严",
  "梁廷栋", "林钎", "杨嗣昌", "李邦华", "曹文诏", "曹化淳", "张凤翔", "左良玉", "孙承宗", "孙传庭",
  "周延儒", "周奎", "吴三桂", "史可法", "卢象升", "倪元璐",
]);

export async function renderDeltaCard(container, effects, state) {
  if (!effects) return;
  const entries = [];
  const labels = {
    treasury: "国库", grain: "粮储", militaryStrength: "军力",
    civilMorale: "民心", borderThreat: "边患", disasterLevel: "天灾",
    corruptionLevel: "贪腐",
  };
  for (const [key, label] of Object.entries(labels)) {
    if (typeof effects[key] === "number" && effects[key] !== 0) {
      entries.push({ label, delta: effects[key], invertColor: ["borderThreat", "disasterLevel", "corruptionLevel"].includes(key) });
    }
  }
  if (effects.loyalty && typeof effects.loyalty === "object") {
    const ministers = state.ministers || [];
    const nameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
    for (const [id, delta] of Object.entries(effects.loyalty)) {
      if (typeof delta === "number" && delta !== 0) {
        entries.push({ label: (nameById[id] || id) + " 忠诚", delta, invertColor: false });
      }
    }
  }
  if (effects.appointments && typeof effects.appointments === "object") {
    if (!positionsCache) {
      try {
        positionsCache = await loadJSON("data/positions.json");
      } catch (e) {
        positionsCache = { positions: [] };
      }
    }
    const positions = positionsCache?.positions || [];
    const positionMap = Object.fromEntries(positions.map((p) => [p.id, p.name]));
    const ministers = state.ministers || [];
    const nameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
    for (const [positionId, characterId] of Object.entries(effects.appointments)) {
      const posName = positionMap[positionId] || positionId;
      const charName = nameById[characterId] || characterId;
      entries.push({ label: `任命 ${charName} 为 ${posName}`, delta: null, isAppointment: true });
    }
  }
  if (entries.length === 0) return;

  const card = document.createElement("div");
  card.className = "story-delta-card";
  entries.forEach(({ label, delta, invertColor, isAppointment }) => {
    const row = document.createElement("div");
    row.className = "story-delta-row";
    const lbl = document.createElement("span");
    lbl.className = "story-delta-label";
    lbl.textContent = label;
    if (isAppointment) {
      const val = document.createElement("span");
      val.className = "story-delta-value story-delta-value--appointment";
      val.textContent = "✓";
      row.appendChild(lbl);
      row.appendChild(val);
    } else {
      const val = document.createElement("span");
      const isPositive = invertColor ? delta < 0 : delta > 0;
      val.className = "story-delta-value " + (isPositive ? "story-delta-value--positive" : "story-delta-value--negative");
      const sign = delta > 0 ? "+" : "";
      val.textContent = sign + delta.toLocaleString();
      row.appendChild(lbl);
      row.appendChild(val);
    }
    card.appendChild(row);
  });
  container.appendChild(card);
}

export function renderPseudoLines(blockEl, text, state) {
  if (!blockEl) return;
  blockEl.innerHTML = "";
  const lines = text.split("\n");
  const speakerMap = buildSpeakerMap(state);
  const nameToInfo = buildMinisterNameToInfo(state);

  const storyHeadingIndex = lines.findIndex((line) => line.trim().startsWith("*剧情板块"));
  const storyStartIndex = storyHeadingIndex === -1 ? lines.length : storyHeadingIndex + 1;

  function createLineEl(rawLine) {
    const wrapper = document.createElement("div");
    wrapper.className = "pseudo-line";

    const trimmed = rawLine.replace(/^\s+/, "");
    if (trimmed.startsWith("*")) {
      const label = trimmed.replace(/^\*\s*/, "");
      wrapper.classList.add("pseudo-line--heading");
      const span = document.createElement("span");
      let cls = "pseudo-heading";
      if (label.includes("时间") || label.includes("季节") || label.includes("天气") || label.includes("地点")) {
        cls += " pseudo-heading--meta";
      } else {
        cls += " pseudo-heading--story";
      }
      span.className = cls;
      span.textContent = label;
      wrapper.appendChild(span);
      return wrapper;
    }

    const names = Object.keys(speakerMap);
    const hasSpeaker = names.some((n) => rawLine.includes(n));

    if (hasSpeaker) {
      wrapper.classList.add("pseudo-line--dialog");
      const matchedNames = names.filter((n) => rawLine.includes(n));
      if (matchedNames.length > 0) {
        const avatarsWrap = document.createElement("div");
        avatarsWrap.className = "story-dialog-avatars";
        matchedNames.forEach((name) => {
          const avatarSpan = document.createElement("span");
          avatarSpan.className = "story-dialog-avatar";
          const _aImg = document.createElement("img");
          _aImg.alt = name;
          _aImg.onerror = function () {
            this.style.display = "none";
            this.parentElement.textContent = name.charAt(0);
          };
          if (AVAILABLE_AVATAR_NAMES.has(name)) {
            _aImg.src = `assets/${name}.jpg`;
          } else {
            queueMicrotask(() => _aImg.onerror());
          }
          avatarSpan.appendChild(_aImg);
          avatarsWrap.appendChild(avatarSpan);
        });
        wrapper.appendChild(avatarsWrap);
      }
      const textWrap = document.createElement("span");
      textWrap.className = "story-dialog-text";
      const span = document.createElement("span");
      span.className = "pseudo-line-text";
      span.appendChild(highlightMinisterNames(rawLine, nameToInfo));
      textWrap.appendChild(span);
      wrapper.appendChild(textWrap);
    } else {
      const span = document.createElement("span");
      span.className = "pseudo-line-text";
      span.appendChild(highlightMinisterNames(rawLine, nameToInfo));
      wrapper.appendChild(span);
    }

    return wrapper;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;
    blockEl.appendChild(createLineEl(rawLine));
  }
}

export function renderStoryLoading(container) {
  const block = document.createElement("div");
  block.className = "edict-block story-loading";
  block.innerHTML = `<div class="story-loading-spinner"></div><div class="story-loading-text">剧情生成中……</div>`;
  container.appendChild(block);
  return block;
}

export function renderStoryError(container, errorMessage, retryCallback) {
  const block = document.createElement("div");
  block.className = "edict-block";
  block.textContent = errorMessage;
  
  const retryBtn = document.createElement("button");
  retryBtn.className = "story-action-btn";
  retryBtn.textContent = "重新生成";
  retryBtn.addEventListener("click", retryCallback);
  
  block.appendChild(retryBtn);
  container.appendChild(block);
}

export function renderChosenChoice(container, chosenChoice) {
  const choiceWrap = document.createElement("div");
  choiceWrap.className = "story-choice-history";
  
  const choiceLabel = document.createElement("span");
  choiceLabel.className = "story-choice-history__label";
  choiceLabel.textContent = "圣旨：";
  choiceWrap.appendChild(choiceLabel);
  
  const choiceText = document.createElement("span");
  choiceText.textContent = chosenChoice.text || "";
  choiceWrap.appendChild(choiceText);
  
  if (chosenChoice.hint) {
    const choiceHint = document.createElement("span");
    choiceHint.className = "story-choice-history__hint";
    choiceHint.textContent = chosenChoice.hint;
    choiceWrap.appendChild(choiceHint);
  }
  
  container.appendChild(choiceWrap);
}

export function createChoiceButton(choice, onChoice) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "story-action-btn";
  btn.innerHTML = `<div>${choice.text}</div>${choice.hint ? `<span>${choice.hint}</span>` : ""}`;
  btn.addEventListener("click", () => {
    onChoice(choice.id, choice.text, choice.hint, choice.effects);
  });
  return btn;
}
