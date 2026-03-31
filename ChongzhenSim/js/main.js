import { initLayout, updateTopbarByState, updateMinisterTabBadge, updateGoalBar } from "./layout.js";
import { router } from "./router.js";
import "./ui/edictView.js";
import "./ui/courtView.js";
import "./ui/settingsView.js";
import "./ui/nationView.js";
import { setStartPhase } from "./ui/startView.js";
import { loadJSON } from "./dataLoader.js";
import { getState, setState } from "./state.js";
import { loadGame, applyLoadedGame, getSavedGameplayMode } from "./storage.js";
import { initializeCoreGameplayState } from "./systems/coreGameplaySystem.js";
import { buildStoryFactsFromState } from "./utils/storyFacts.js";
import { createDefaultRigidState, DEFAULT_RIGID_INITIAL, DEFAULT_RIGID_TRIGGERS } from "./rigid/config.js";

function normalizeCharacterId(rawId, aliasToCanonical) {
  if (typeof rawId !== "string") return "";
  const id = rawId.trim();
  if (!id) return "";
  return aliasToCanonical.get(id) || aliasToCanonical.get(id.replace(/_/g, "")) || id;
}

function normalizeAppointmentsMap(appointments, aliasToCanonical) {
  const source = appointments && typeof appointments === "object" ? appointments : {};
  const out = {};
  Object.entries(source).forEach(([positionId, holderId]) => {
    if (typeof positionId !== "string" || typeof holderId !== "string") return;
    const normalizedHolder = normalizeCharacterId(holderId, aliasToCanonical);
    if (!normalizedHolder) return;
    out[positionId] = normalizedHolder;
  });
  return out;
}

async function preloadBasicData(preferredMode = null) {
  const [config, balanceConfig, characters, factionsData, goals, nationInit, positionsData, rigidInitialData, rigidTriggerData, rigidHistoryEvents] = await Promise.all([
    loadJSON("data/config.json"),
    loadJSON("data/balanceConfig.json").catch(() => ({})),
    loadJSON("data/characters.json"),
    loadJSON("data/factions.json").catch(() => ({ factions: [] })),
    loadJSON("data/goals.json").catch(() => []),
    loadJSON("data/nationInit.json").catch(() => ({})),
    loadJSON("data/positions.json").catch(() => ({ positions: [] })),
    loadJSON("data/rigidInitialState.json").catch(() => DEFAULT_RIGID_INITIAL),
    loadJSON("data/rigidTriggers.json").catch(() => DEFAULT_RIGID_TRIGGERS),
    loadJSON("data/rigidHistoryEvents.json").catch(() => []),
  ]);

  const allCharacters = characters.characters || characters.ministers || [];
  const aliasToCanonical = (() => {
    const map = new Map();
    allCharacters.forEach((m) => {
      if (!m || typeof m.id !== "string") return;
      const id = m.id.trim();
      if (!id) return;
      map.set(id, id);
      map.set(id.replace(/_/g, ""), id);
    });
    return map;
  })();
  const loyalty = {};
  allCharacters.forEach((m) => {
    loyalty[m.id] = m.loyalty || 50;
  });

  const current = getState();
  const existingLoyalty = current.loyalty || {};
  const mergedLoyalty = { ...loyalty };
  for (const [k, v] of Object.entries(existingLoyalty)) {
    if (typeof v === "number") mergedLoyalty[k] = v;
  }

  const factions = factionsData.factions || [];
  const nation = current.nation && current.nation.treasury !== undefined
    ? current.nation
    : {
        treasury: nationInit.treasury || 500000,
        grain: nationInit.grain || 30000,
        militaryStrength: nationInit.militaryStrength || 60,
        civilMorale: nationInit.civilMorale || 35,
        borderThreat: nationInit.borderThreat || 75,
        disasterLevel: nationInit.disasterLevel || 70,
        corruptionLevel: nationInit.corruptionLevel || 80,
      };

  const coreState = initializeCoreGameplayState(current, factions, config, nationInit);
  const mergedFactions = Array.isArray(current.factions) && current.factions.length ? current.factions : factions;
  const externalPowers = (() => {
    const initMap = {};
    const existing = current.externalPowers || {};
    const threats = Array.isArray(nationInit.externalThreats) ? nationInit.externalThreats : [];
    threats.forEach((t) => {
      const id = t.id || t.name;
      if (!id) return;
      if (typeof existing[id] === "number") {
        initMap[id] = existing[id];
      } else if (typeof t.power === "number") {
        initMap[id] = t.power;
      } else {
        initMap[id] = 100;
      }
    });
    return initMap;
  })();

  const provinceStats = (() => {
    const map = {};
    const provinces = Array.isArray(nationInit.provinces) ? nationInit.provinces : [];
    const existingProvinceStats = current.provinceStats && typeof current.provinceStats === "object"
      ? current.provinceStats
      : {};
    provinces.forEach((p) => {
      if (!p || !p.name) return;
      const existing = existingProvinceStats[p.name] || {};
      const baseTaxSilver = typeof existing.__baseTaxSilver === "number"
        ? existing.__baseTaxSilver
        : (typeof p.taxSilver === "number" ? p.taxSilver : 0);
      const baseTaxGrain = typeof existing.__baseTaxGrain === "number"
        ? existing.__baseTaxGrain
        : (typeof p.taxGrain === "number" ? p.taxGrain : 0);
      const baseRecruits = typeof existing.__baseRecruits === "number"
        ? existing.__baseRecruits
        : (typeof p.recruits === "number" ? p.recruits : 0);
      map[p.name] = {
        taxSilver: typeof existing.taxSilver === "number"
          ? existing.taxSilver
          : (typeof p.taxSilver === "number" ? p.taxSilver : 0),
        taxGrain: typeof existing.taxGrain === "number"
          ? existing.taxGrain
          : (typeof p.taxGrain === "number" ? p.taxGrain : 0),
        recruits: typeof existing.recruits === "number"
          ? existing.recruits
          : (typeof p.recruits === "number" ? p.recruits : 0),
        morale: typeof existing.morale === "number"
          ? existing.morale
          : (typeof p.morale === "number" ? p.morale : 50),
        corruption: typeof existing.corruption === "number"
          ? existing.corruption
          : (typeof p.corruption === "number" ? p.corruption : 50),
        disaster: typeof existing.disaster === "number"
          ? existing.disaster
          : (typeof p.disaster === "number" ? p.disaster : 50),
        __baseTaxSilver: baseTaxSilver,
        __baseTaxGrain: baseTaxGrain,
        __baseRecruits: baseRecruits,
      };
    });
    return map;
  })();

  const defaultAppointments = (() => {
    const map = {};
    const positions = Array.isArray(positionsData?.positions) ? positionsData.positions : [];
    positions.forEach((pos) => {
      if (!pos || typeof pos.id !== "string") return;
      if (typeof pos.defaultHolder === "string" && pos.defaultHolder) {
        map[pos.id] = normalizeCharacterId(pos.defaultHolder, aliasToCanonical);
      }
    });
    return map;
  })();

  const hasExistingAppointments = current.appointments && Object.keys(current.appointments).length > 0;
  const normalizedExistingAppointments = normalizeAppointmentsMap(current.appointments, aliasToCanonical);
  const normalizedDefaultAppointments = normalizeAppointmentsMap(defaultAppointments, aliasToCanonical);

  const selectedMode = current.mode || preferredMode || config?.gameplayMode || "classic";
  const resolvedRigidState = current.rigid && typeof current.rigid === "object"
    ? current.rigid
    : createDefaultRigidState(rigidInitialData || DEFAULT_RIGID_INITIAL);
  const rigidCalendar = resolvedRigidState?.calendar || { year: 1627, month: 8 };

  setState({
    config: {
      ...(config || {}),
      balance: balanceConfig || {},
      gameplayMode: selectedMode,
      rigid: {
        initialState: rigidInitialData || DEFAULT_RIGID_INITIAL,
        triggers: rigidTriggerData || DEFAULT_RIGID_TRIGGERS,
        historyEvents: Array.isArray(rigidHistoryEvents) ? rigidHistoryEvents : [],
      },
    },
    allCharacters,
    factions: mergedFactions,
    loyalty: mergedLoyalty,
    goals: Array.isArray(goals) ? goals : [],
    nation,
    appointments: hasExistingAppointments ? normalizedExistingAppointments : normalizedDefaultAppointments,
    characterStatus: current.characterStatus || {},
    storyHistory: current.storyHistory || [],
    ...coreState,
    externalPowers,
    provinceStats,
    positionsMeta: positionsData || { positions: [], departments: [] },
    mode: selectedMode,
    currentQuarterAgenda: [],
    currentQuarterFocus: null,
    rigid: resolvedRigidState,
    ...(selectedMode === "rigid_v1"
      ? {
        currentYear: Math.max(1, (Number(rigidCalendar.year) || 1627) - 1626),
        currentMonth: Number(rigidCalendar.month) || 8,
        currentPhase: "morning",
      }
      : {}),
  });

  setState({ storyFacts: buildStoryFactsFromState(getState()) });
}

function shouldShowStartView() {
  const state = getState();
  return !state.gameStarted;
}

async function bootstrap() {
  initLayout();

  const preferredMode = getSavedGameplayMode();
  const loaded = loadGame(preferredMode);
  if (loaded) {
    applyLoadedGame(loaded);
  }

  await preloadBasicData(preferredMode);
  const stateAfterLoad = getState();
  updateTopbarByState(stateAfterLoad);
  updateGoalBar(stateAfterLoad);
  updateMinisterTabBadge(stateAfterLoad);

  const showStart = shouldShowStartView();

  router.init();

  if (showStart) {
    setStartPhase("intro");
    router.setView(router.VIEW_IDS.START);
  } else {
    router.setView(router.VIEW_IDS.EDICT);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bootstrap().catch((err) => console.error(err));
  });
} else {
  bootstrap().catch((err) => console.error(err));
}
