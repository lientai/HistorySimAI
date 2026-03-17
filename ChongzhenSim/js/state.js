const initialState = {
  schemaVersion: 1,
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

  lastChoiceId: null,
  lastChoiceText: null,
  lastChoiceHint: null,
  storyHistory: [],

  courtChats: {},
  ministerUnread: {},

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
