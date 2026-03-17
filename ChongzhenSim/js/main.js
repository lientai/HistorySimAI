import { initLayout, updateTopbarByState, updateMinisterTabBadge, updateGoalBar } from "./layout.js";
import { router } from "./router.js";
import "./ui/edictView.js";
import "./ui/courtView.js";
import "./ui/settingsView.js";
import "./ui/nationView.js";
import { setStartPhase } from "./ui/startView.js";
import { loadJSON } from "./dataLoader.js";
import { getState, setState } from "./state.js";
import { loadGame, applyLoadedGame } from "./storage.js";
import { initializeCoreGameplayState } from "./systems/coreGameplaySystem.js";

async function preloadBasicData() {
  const [config, characters, factionsData, goals, nationInit] = await Promise.all([
    loadJSON("data/config.json"),
    loadJSON("data/characters.json"),
    loadJSON("data/factions.json").catch(() => ({ factions: [] })),
    loadJSON("data/goals.json").catch(() => []),
    loadJSON("data/nationInit.json").catch(() => ({})),
  ]);

  const ministers = characters.ministers || [];
  const loyalty = {};
  ministers.forEach((m) => {
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

  const coreState = initializeCoreGameplayState(current, factions, config);
  const mergedFactions = Array.isArray(current.factions) && current.factions.length ? current.factions : factions;

  setState({
    config,
    ministers,
    factions: mergedFactions,
    loyalty: mergedLoyalty,
    goals: Array.isArray(goals) ? goals : [],
    nation,
    ...coreState,
  });
}

function shouldShowStartView() {
  const state = getState();
  return !state.gameStarted;
}

async function bootstrap() {
  initLayout();

  const loaded = loadGame();
  if (loaded) {
    applyLoadedGame(loaded);
  }

  await preloadBasicData();
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
