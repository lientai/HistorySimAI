import { getState, setState, resetState } from "./state.js";
import { updateTopbarByState, updateMinisterTabBadge } from "./layout.js";

const STORAGE_KEY = "chongzhen_sim_save_v1";
const COURT_CHATS_CAP = 50;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveGame() {
  if (!canUseStorage()) return;
  const state = getState();
  try {
    const toSave = { ...state };
    if (toSave.courtChats && typeof toSave.courtChats === "object") {
      toSave.courtChats = Object.fromEntries(
        Object.entries(toSave.courtChats).map(([id, list]) => [
          id,
          Array.isArray(list) ? list.slice(-COURT_CHATS_CAP) : list,
        ])
      );
    }
    const payload = JSON.stringify(toSave);
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch (e) {
    console.error("保存存档失败", e);
  }
}

export function loadGame() {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("读取存档失败", e);
    return null;
  }
}

export function applyLoadedGame(data) {
  if (!data) return;
  resetState();
  setState(data);
  const state = getState();
  updateTopbarByState(state);
  updateMinisterTabBadge(state);
}

export function clearGame() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function autoSaveIfEnabled() {
  const state = getState();
  const config = state.config || {};
  if (config.autoSave === false) return;
  saveGame();
}
