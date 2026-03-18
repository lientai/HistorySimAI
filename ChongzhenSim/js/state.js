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

  ministers: [],
  factions: [],
  loyalty: {},

  appointments: {
    "neige_shoufu": "zhou_yanru",
    "libu_shangshu": "wang_yongguang",
    "hubu_shangshu": "bi_ziyan",
    "libu_li_shangshu": "litengfang",
    "bingbu_shangshu": "liang_tingdong",
    "xingbu_shangshu": "han_jisi",
    "gongbu_shangshu": "caoguang",
    "dutcheng_duchayuan_zuoduyushi": "caoyubian"
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

  courtChats: {},
  ministerUnread: {},

  newsToday: [],
  newsHistory: {},
  publicOpinion: [],

  goals: [],
  trackedGoalId: null,

  gameStarted: false,
};

let state = JSON.parse(JSON.stringify(initialState));

export function getState() {
  return state;
}

export function setState(partial) {
  state = { ...state, ...partial };
}

export function resetState() {
  state = JSON.parse(JSON.stringify(initialState));
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
  return state.ministers.find((m) => m.id === characterId);
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
