import { getState, setState, resetState } from "./state.js";
import { updateTopbarByState, updateMinisterTabBadge } from "./layout.js";

const STORAGE_KEY_PREFIX = "chongzhen_sim_save_v1";
const STORAGE_MODE_KEY = "chongzhen_sim_gameplay_mode_v1";
const COURT_CHATS_CAP = 50;
const DEFAULT_MODE = "classic";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getSaveKeyByMode(mode) {
  const safeMode = typeof mode === "string" && mode ? mode : DEFAULT_MODE;
  return `${STORAGE_KEY_PREFIX}_${safeMode}`;
}

export function setSavedGameplayMode(mode) {
  if (!canUseStorage()) return;
  const safeMode = typeof mode === "string" && mode ? mode : DEFAULT_MODE;
  window.localStorage.setItem(STORAGE_MODE_KEY, safeMode);
}

export function getSavedGameplayMode() {
  if (!canUseStorage()) return DEFAULT_MODE;
  const mode = window.localStorage.getItem(STORAGE_MODE_KEY);
  return typeof mode === "string" && mode ? mode : DEFAULT_MODE;
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
    window.localStorage.setItem(getSaveKeyByMode(state.mode), payload);
    if (state.mode) {
      setSavedGameplayMode(state.mode);
    }
  } catch (e) {
    console.error("保存存档失败", e);
  }
}

export function loadGame(mode = null) {
  if (!canUseStorage()) return null;
  const targetMode = mode || getSavedGameplayMode();
  const raw = window.localStorage.getItem(getSaveKeyByMode(targetMode));
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
  if (data.mode) {
    setSavedGameplayMode(data.mode);
  }
  const state = getState();
  updateTopbarByState(state);
  updateMinisterTabBadge(state);
}

export function clearGame(mode = null) {
  if (!canUseStorage()) return;
  const targetMode = mode || getSavedGameplayMode();
  window.localStorage.removeItem(getSaveKeyByMode(targetMode));
}

export function autoSaveIfEnabled() {
  const state = getState();
  const config = state.config || {};
  if (config.autoSave === false) return;
  saveGame();
}
