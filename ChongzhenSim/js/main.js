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

async function preloadBasicData() {
  const [config, characters, goals, nationInit] = await Promise.all([
    loadJSON("data/config.json"),
    loadJSON("data/characters.json"),
    loadJSON("data/goals.json").catch(() => []),
    loadJSON("data/nationInit.json").catch(() => ({})),
  ]);

  const ministers = characters.characters || characters.ministers || [];
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
    provinces.forEach((p) => {
      if (!p || !p.name) return;
      map[p.name] = {
        taxSilver: typeof p.taxSilver === "number" ? p.taxSilver : 0,
        taxGrain: typeof p.taxGrain === "number" ? p.taxGrain : 0,
        recruits: typeof p.recruits === "number" ? p.recruits : 0,
        morale: typeof p.morale === "number" ? p.morale : 50,
        corruption: typeof p.corruption === "number" ? p.corruption : 50,
        disaster: typeof p.disaster === "number" ? p.disaster : 50,
      };
    });
    return map;
  })();

  setState({
    config,
    ministers,
    loyalty: mergedLoyalty,
    goals: Array.isArray(goals) ? goals : [],
    nation,
    appointments: current.appointments || {},
    characterStatus: current.characterStatus || {},
    storyHistory: current.storyHistory || [],
    externalPowers,
    provinceStats,
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
