import { loadJSON } from "../dataLoader.js";

let tagsCache = null;

export async function getLoyaltyTags() {
  if (tagsCache) return tagsCache;
  try {
    tagsCache = await loadJSON("data/loyaltyTags.json");
  } catch (e) {
    tagsCache = [];
  }
  return tagsCache;
}

export function getLoyaltyStage(score, tags) {
  if (!Array.isArray(tags)) return "";
  for (const t of tags) {
    if (score >= t.min && score <= t.max) return t.label;
  }
  return "";
}

export function getLoyaltyColor(score, tags) {
  if (!Array.isArray(tags)) return "inherit";
  for (const t of tags) {
    if (score >= t.min && score <= t.max) return t.color || "inherit";
  }
  return "inherit";
}

export function getFactionClass(factionId) {
  const map = {
    donglin: "minister-faction-tag--donglin",
    eunuch: "minister-faction-tag--eunuch",
    neutral: "minister-faction-tag--neutral",
    military: "minister-faction-tag--military",
    imperial: "minister-faction-tag--imperial",
  };
  return map[factionId] || "";
}
