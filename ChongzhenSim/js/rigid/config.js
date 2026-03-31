export const RIGID_MODE_ID = "rigid_v1";

export const DEFAULT_RIGID_INITIAL = {
  finance: { treasury: 30, innerFund: 200, militaryArrears: 3, officialArrears: 0 },
  military: { liaoDongTroops: 8, liaoDongMorale: 60, rebelScale: 5, qingTrend: "蛰伏" },
  court: { authority: 50, factionFight: 80, resistance: 50, refuteTimes: 8, strikeState: false },
  chongZhen: { anxiety: 40, insomnia: 60, exposureRisk: 5, assassinateRisk: 0, distrust: 0 },
  other: { offendGroups: [], plague: 0, foodCrisis: 0 },
};

export const DEFAULT_RIGID_TRIGGERS = {
  assassinateThreshold: 40,
  exposureThreshold: 30,
  strikeThreshold: 80,
  strikeLevels: [
    { level: 1, triggerResistance: 80, releaseResistance: 72, releaseTurns: 1 },
    { level: 2, triggerResistance: 90, releaseResistance: 66, releaseTurns: 2 },
    { level: 3, triggerResistance: 96, releaseResistance: 60, releaseTurns: 3 },
  ],
  hardFloors: {
    "court.resistance": 15,
    "court.factionFight": 20,
    "chongZhen.anxiety": 20,
  },
  forbiddenTechKeywords: [
    "蒸汽机",
    "后装枪",
    "电报",
    "内燃机",
    "铁路快枪",
    "马克沁机枪",
    "坦克",
    "飞机",
    "无线电台",
    "现代化工炸药",
  ],
};

export const DEFAULT_DECISION_PRESETS = [
  {
    id: "rigid_rectify_military_pay",
    text: "整饬辽饷，优先补发军饷",
    hint: "稳军心但得罪文官与地方",
    type: "finance",
    reformLevel: "major",
    offend: { scholar: 8, general: 2, eunuch: 2, royal: 1, people: 1 },
    intent: { finance: { treasury: -6, militaryArrears: -1 }, military: { liaoDongMorale: 8 }, court: { resistance: 4 } },
  },
  {
    id: "rigid_streamline_officials",
    text: "裁撤冗员，压缩京官开支",
    hint: "缓解财政但党争反扑",
    type: "politics",
    reformLevel: "major",
    offend: { scholar: 10, general: 1, eunuch: 4, royal: 3, people: 0 },
    intent: { finance: { treasury: 5, officialArrears: -1 }, court: { resistance: 6, factionFight: 5 }, chongZhen: { anxiety: 3 } },
  },
  {
    id: "rigid_relief_refugees",
    text: "开仓赈济，安抚流民",
    hint: "降低民变但国库受压",
    type: "social",
    reformLevel: "normal",
    offend: { scholar: 2, general: 1, eunuch: 1, royal: 1, people: -5 },
    intent: { finance: { treasury: -5 }, military: { rebelScale: -2 }, other: { foodCrisis: -8 }, court: { resistance: 2 } },
  },
  {
    id: "rigid_strengthen_factory",
    text: "整顿厂卫，强化缉事",
    hint: "可压制短期阻力但提高暴露风险",
    type: "security",
    reformLevel: "normal",
    offend: { scholar: 5, general: 3, eunuch: -3, royal: 2, people: 2 },
    intent: { court: { resistance: -4, refuteTimes: 1 }, chongZhen: { exposureRisk: 6, distrust: 3 } },
  },
];

export const DEFAULT_HISTORY_EVENTS = [];

export function isRigidMode(state) {
  if (!state || typeof state !== "object") return false;
  if (state.mode === RIGID_MODE_ID) return true;
  return state.config?.gameplayMode === RIGID_MODE_ID;
}

export function createDefaultRigidState(initial = DEFAULT_RIGID_INITIAL) {
  return {
    ...JSON.parse(JSON.stringify(initial)),
    calendar: { year: 1627, month: 8, turn: 1, season: "秋" },
    memoryAnchors: [],
    executionConstraints: [],
    pendingEvents: [],
    eventHistory: [],
    noRefuteTurns: 0,
    offendScores: { scholar: 0, general: 0, eunuch: 0, royal: 0, people: 0 },
    strikeLevel: 0,
    strikeRecoverProgress: 0,
    strikeTurns: 0,
    lastDecision: null,
    lastOutput: null,
    lastTriggerEvents: [],
    loadedFromAnchor: false,
  };
}

