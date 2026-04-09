import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentState: null,
  setState: vi.fn(),
  registerView: vi.fn(),
}));

vi.mock("../router.js", () => ({
  router: {
    registerView: mocks.registerView,
  },
}));

vi.mock("../state.js", () => ({
  getState: () => mocks.currentState,
  setState: mocks.setState,
}));

vi.mock("../dataLoader.js", () => ({
  loadJSON: vi.fn(async () => ({})),
}));

vi.mock("../systems/nationSystem.js", () => ({
  getStatBarClass: vi.fn(() => "nation-stat-bar-inner--normal"),
}));

vi.mock("../systems/coreGameplaySystem.js", () => ({
  PLAYER_ABILITY_KEYS: ["management", "military", "scholarship", "politics"],
  getPolicyCatalog: vi.fn(() => []),
  spendAbilityPoint: vi.fn(() => null),
  unlockPolicy: vi.fn(() => null),
}));

vi.mock("../utils/displayStateMetrics.js", () => ({
  formatDisplayMetricValue: vi.fn((state, key) => {
    const nation = state.nation || {};
    const rigid = state.rigid || {};
    const sources = {
      rigidTreasury: rigid.treasury,
      rigidInnerFund: rigid.innerFund,
      rigidMilitaryArrears: rigid.militaryArrears,
      rigidOfficialArrears: rigid.officialArrears,
      rigidLiaoDongTroops: rigid.liaoDongTroops,
      rigidLiaoDongMorale: rigid.liaoDongMorale,
      rigidRebelScale: rigid.rebelScale,
      rigidAuthority: rigid.authority,
      rigidFactionFight: rigid.factionFight,
      rigidResistance: rigid.resistance,
      rigidRefuteTimes: rigid.refuteTimes,
      rigidAnxiety: rigid.anxiety,
      rigidInsomnia: rigid.insomnia,
      rigidExposureRisk: rigid.exposureRisk,
      rigidAssassinateRisk: rigid.assassinateRisk,
      rigidDistrust: rigid.distrust,
      militaryStrength: nation.militaryStrength,
      civilMorale: nation.civilMorale,
      borderThreat: nation.borderThreat,
      disasterLevel: nation.disasterLevel,
      corruptionLevel: nation.corruptionLevel,
      treasury: nation.treasury,
      grain: nation.grain,
      executionRate: state.executionRate,
      prestige: state.prestige,
      partyStrife: state.partyStrife,
      taxPressure: state.taxPressure,
    };
    return String(sources[key] ?? 0);
  }),
  getDisplayMetricBarValue: vi.fn((state, key) => {
    const nation = state.nation || {};
    const rigid = state.rigid || {};
    const sources = {
      rigidTreasury: rigid.treasury,
      rigidInnerFund: rigid.innerFund,
      rigidMilitaryArrears: rigid.militaryArrears,
      rigidOfficialArrears: rigid.officialArrears,
      rigidLiaoDongTroops: rigid.liaoDongTroops,
      rigidLiaoDongMorale: rigid.liaoDongMorale,
      rigidRebelScale: rigid.rebelScale,
      rigidAuthority: rigid.authority,
      rigidFactionFight: rigid.factionFight,
      rigidResistance: rigid.resistance,
      rigidRefuteTimes: rigid.refuteTimes,
      rigidAnxiety: rigid.anxiety,
      rigidInsomnia: rigid.insomnia,
      rigidExposureRisk: rigid.exposureRisk,
      rigidAssassinateRisk: rigid.assassinateRisk,
      rigidDistrust: rigid.distrust,
      militaryStrength: nation.militaryStrength,
      civilMorale: nation.civilMorale,
      borderThreat: nation.borderThreat,
      disasterLevel: nation.disasterLevel,
      corruptionLevel: nation.corruptionLevel,
      treasury: nation.treasury,
      grain: nation.grain,
      executionRate: state.executionRate,
      prestige: state.prestige,
      partyStrife: state.partyStrife,
      taxPressure: state.taxPressure,
    };
    return Number(sources[key] ?? 0);
  }),
  getDisplayMetricsBySection: vi.fn((section) => {
    const map = {
      rigid: [
        { key: "rigidTreasury", label: "国库存银" },
        { key: "rigidInnerFund", label: "内帑" },
        { key: "rigidMilitaryArrears", label: "军饷拖欠" },
        { key: "rigidOfficialArrears", label: "官俸拖欠" },
        { key: "rigidLiaoDongTroops", label: "辽东兵力" },
        { key: "rigidLiaoDongMorale", label: "辽东士气" },
        { key: "rigidRebelScale", label: "流寇规模" },
        { key: "rigidAuthority", label: "皇权" },
        { key: "rigidFactionFight", label: "党争" },
        { key: "rigidResistance", label: "廷臣阻力" },
        { key: "rigidRefuteTimes", label: "驳回次数" },
        { key: "rigidAnxiety", label: "焦虑" },
        { key: "rigidInsomnia", label: "失眠" },
        { key: "rigidExposureRisk", label: "暴露风险" },
        { key: "rigidAssassinateRisk", label: "刺杀风险" },
        { key: "rigidDistrust", label: "多疑" },
      ],
      nation: [
        { key: "treasury", label: "国库", icon: "💰" },
        { key: "grain", label: "粮储", icon: "🌾" },
        { key: "militaryStrength", label: "军力", icon: "🗡️" },
        { key: "civilMorale", label: "民心", icon: "👥" },
      ],
      governance: [
        { key: "executionRate", label: "执行率", icon: "📜" },
        { key: "prestige", label: "威望", icon: "👑" },
        { key: "partyStrife", label: "党争", icon: "⚖️" },
        { key: "taxPressure", label: "税压", icon: "🧾" },
        { key: "borderThreat", label: "边患", icon: "🛡️" },
        { key: "disasterLevel", label: "天灾", icon: "🌪️" },
        { key: "corruptionLevel", label: "贪腐", icon: "📉" },
      ],
    };
    return map[section] || [];
  }),
}));

import { renderNationView } from "./nationView.js";

function buildState(overrides = {}) {
  return {
    mode: "classic",
    nation: {
      treasury: 500000,
      grain: 30000,
      militaryStrength: 60,
      civilMorale: 45,
      borderThreat: 70,
      disasterLevel: 65,
      corruptionLevel: 75,
    },
    rigid: {
      treasury: 120000,
      innerFund: 30000,
      militaryArrears: 40,
      officialArrears: 35,
      liaoDongTroops: 55,
      liaoDongMorale: 48,
      rebelScale: 62,
      authority: 40,
      factionFight: 68,
      resistance: 58,
      refuteTimes: 2,
      anxiety: 72,
      insomnia: 60,
      exposureRisk: 25,
      assassinateRisk: 12,
      distrust: 66,
    },
    factions: [],
    factionSupport: {},
    currentQuarterAgenda: [{ id: "legacy", title: "旧季度议题", summary: "测试", impacts: ["财政"] }],
    currentQuarterFocus: { agendaId: "legacy", stance: "support", factionId: "scholar" },
    customPolicies: [{ id: "custom_policy_test", name: "测试新策", category: "fiscal", createdYear: 3, createdMonth: 4 }],
    abilityPoints: 0,
    policyPoints: 0,
    playerAbilities: { management: 0, military: 0, scholarship: 0, politics: 0 },
    unlockedPolicies: [],
    provinceStats: {},
    hostileForces: [],
    newsToday: [],
    publicOpinion: [],
    executionRate: 70,
    prestige: 60,
    partyStrife: 50,
    taxPressure: 45,
    ...overrides,
  };
}

describe("renderNationView", () => {
  beforeEach(() => {
    mocks.currentState = buildState();
    mocks.setState.mockReset();
    mocks.registerView.mockClear();
    document.body.innerHTML = "";
  });

  it("hides classic-only sections in rigid mode", () => {
    mocks.currentState = buildState({ mode: "rigid_v1" });

    const container = document.createElement("div");
    renderNationView(container);

    expect(container.textContent).toContain("崇祯·大明国势");
    expect(container.textContent).not.toContain("季度奏折");
    expect(container.textContent).not.toContain("皇帝能力");
    expect(container.textContent).not.toContain("国策树");
    expect(container.textContent).not.toContain("自定义国策");
    expect(container.textContent).not.toContain("季度财政加成");
  });

  it("keeps custom policy panel in classic mode", () => {
    const container = document.createElement("div");
    renderNationView(container);

    expect(container.textContent).toContain("季度奏折");
    expect(container.textContent).toContain("自定义国策");
    expect(container.textContent).toContain("季度财政加成");
    expect(container.textContent).toContain("测试新策");
  });
});