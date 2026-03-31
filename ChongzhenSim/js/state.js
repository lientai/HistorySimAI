import { createDefaultRigidState, DEFAULT_RIGID_INITIAL } from "./rigid/config.js";

const initialState = {
  schemaVersion: 2,
  currentDay: 1,
  currentPhase: "morning",
  currentMonth: 4,
  currentYear: 3,
  weather: "桃花雪",

  player: {
    name: "朱由检",
    title: "崇祯帝",
    age: 20,
  },

  nation: {
    treasury: 500000,
    grain: 30000,
    militaryStrength: 60,
    civilMorale: 35,
    borderThreat: 75,
    disasterLevel: 70,
    corruptionLevel: 80,
  },

  allCharacters: [],
  ministers: [],
  factions: [],
  loyalty: {},

  appointments: {
    "neige_shoufu": "zhou_yanru",
    "libu_shangshu": "wang_yongguang",
    "hubu_shangshu": "bi_ziyan",
    "libu_li_shangshu": "li_tengfang",
    "bingbu_shangshu": "liang_tingdong",
    "xingbu_shangshu": "han_jisi",
    "gongbu_shangshu": "cao_guang",
    "dutcheng_duchayuan_zuoduyushi": "cao_yubian"
  },
  characterStatus: {},
  // 外部势力势力值（如 { "后金(清)": 100, "农民军": 80 }）
  externalPowers: {},

  // 省级经济与民生数据快照（按省名索引）
  provinceStats: {},

  lastChoiceId: null,
  lastChoiceText: null,
  lastChoiceHint: null,
  storyHistory: [],
  currentStoryTurn: null,
  storyHighlights: [],

  courtChats: {},
  ministerUnread: {},
  keju: {
    stage: "idle",
    candidatePool: [],
    publishedList: [],
    talentReserve: [],
    generatedCandidates: [],
    bureauMomentum: 52,
    reserveQuality: 0,
    note: "",
  },
  wuju: {
    stage: "idle",
    candidatePool: [],
    publishedList: [],
    talentReserve: [],
    generatedCandidates: [],
    bureauMomentum: 50,
    reserveQuality: 0,
    note: "",
  },

  newsToday: [],
  newsHistory: {},
  publicOpinion: [],
  lastQuarterSettlement: null,
  prestige: 58,
  executionRate: 72,
  partyStrife: 62,
  unrest: 18,
  taxPressure: 52,
  factionSupport: {},
  currentQuarterAgenda: [],
  currentQuarterFocus: null,
  pendingConsequences: [],
  systemNewsToday: [],
  systemPublicOpinion: [],
  abilityPoints: 0,
  policyPoints: 0,
  playerAbilities: {
    management: 0,
    military: 0,
    scholarship: 0,
    politics: 0,
  },
  unlockedPolicies: [],
  customPolicies: [],
  hostileForces: [],
  closedStorylines: [],
  storyFacts: null,

  goals: [],
  trackedGoalId: null,

  gameStarted: false,
  mode: "classic",
  rigid: createDefaultRigidState(DEFAULT_RIGID_INITIAL),
};

let state = JSON.parse(JSON.stringify(initialState));

function deriveCourtMinistersFromState(nextState) {
  const allCharacters = Array.isArray(nextState.allCharacters) && nextState.allCharacters.length
    ? nextState.allCharacters
    : Array.isArray(nextState.ministers)
      ? nextState.ministers
      : [];
  const appointments = nextState.appointments && typeof nextState.appointments === "object"
    ? nextState.appointments
    : {};
  const characterStatus = nextState.characterStatus && typeof nextState.characterStatus === "object"
    ? nextState.characterStatus
    : {};
  const byId = new Map(allCharacters.map((char) => [char?.id, char]).filter(([id]) => typeof id === "string" && id));

  return Array.from(new Set(Object.values(appointments).filter((id) => typeof id === "string" && id)))
    .map((id) => byId.get(id))
    .filter((char) => char && characterStatus[char.id]?.isAlive !== false);
}

export function getState() {
  return state;
}

export function setState(partial) {
  const nextState = { ...state, ...partial };
  if (
    Object.prototype.hasOwnProperty.call(partial, "allCharacters") ||
    Object.prototype.hasOwnProperty.call(partial, "appointments") ||
    Object.prototype.hasOwnProperty.call(partial, "characterStatus")
  ) {
    nextState.ministers = deriveCourtMinistersFromState(nextState);
  }
  state = nextState;
}

export function resetState() {
  state = JSON.parse(JSON.stringify(initialState));
}

export function getRosterCharacters() {
  return Array.isArray(state.allCharacters) && state.allCharacters.length
    ? state.allCharacters
    : state.ministers;
}

export function initializeAppointments(positions, characters) {
  const appointments = {};
  positions.forEach((pos) => {
    if (pos.defaultHolder) {
      appointments[pos.id] = pos.defaultHolder;
    }
  });
  setState({ appointments });
  return appointments;
}

export function initializeCharacterStatus(characters) {
  const characterStatus = {};
  characters.forEach((char) => {
    characterStatus[char.id] = {
      isAlive: char.isAlive,
      deathReason: char.deathReason,
      deathDay: char.deathDay,
    };
  });
  setState({ characterStatus });
  return characterStatus;
}

export function getAliveCharacters(characters) {
  const status = state.characterStatus;
  return characters.filter((char) => status[char.id]?.isAlive !== false);
}

export function getDeadCharacters(characters) {
  const status = state.characterStatus;
  return characters.filter((char) => status[char.id]?.isAlive === false);
}

export function getCharacterByPosition(positionId) {
  const characterId = state.appointments[positionId];
  if (!characterId) return null;
  return getRosterCharacters().find((m) => m.id === characterId);
}

export function appointCharacter(positionId, characterId) {
  const appointments = { ...state.appointments };
  const oldHolder = appointments[positionId];
  
  appointments[positionId] = characterId;
  setState({ appointments });
  
  return { positionId, newHolder: characterId, oldHolder };
}

export function removeCharacterFromPosition(positionId) {
  const appointments = { ...state.appointments };
  const oldHolder = appointments[positionId];
  
  delete appointments[positionId];
  setState({ appointments });
  
  return { positionId, oldHolder };
}

export function markCharacterDead(characterId, reason, day) {
  const characterStatus = { ...state.characterStatus };
  characterStatus[characterId] = {
    isAlive: false,
    deathReason: reason,
    deathDay: day,
  };
  
  const appointments = { ...state.appointments };
  for (const [posId, charId] of Object.entries(appointments)) {
    if (charId === characterId) {
      delete appointments[posId];
    }
  }
  
  setState({ characterStatus, appointments });
  
  return characterStatus[characterId];
}

export function isCharacterAlive(characterId) {
  return state.characterStatus[characterId]?.isAlive !== false;
}
