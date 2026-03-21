function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundScaled(value, scale) {
  if (typeof value !== "number") return value;
  const scaled = value * scale;
  if (scaled > 0) return Math.max(1, Math.round(scaled));
  if (scaled < 0) return Math.min(-1, Math.round(scaled));
  return 0;
}

const DEFAULT_BALANCE_CONFIG = {
  executionRate: {
    highPrestigeThreshold: 80,
    highPrestigeRate: 95,
    midPrestigeThreshold: 50,
    midBase: 70,
    midSlopeDivisor: 3,
    midMin: 70,
    midMax: 80,
    lowBase: 50,
    lowSlopeDivisor: 2,
    lowMin: 35,
    lowMax: 50,
    finalCap: 95,
  },
  military: {
    baseDamageBase: 6,
    baseDamagePerLevel: 1.5,
    baseDamageMin: 4,
    baseDamageMax: 22,
  },
  partyStrife: {
    currentWeight: 0.55,
    spreadWeight: 0.5,
  },
  policyBonusCaps: {
    quarterlyTreasuryRatioMax: 2.0,
    quarterlyGrainRatioMax: 2.0,
    executionRateBonusMax: 25,
    politicsReductionMax: 18,
    militaryDamageFlatMax: 20,
    militaryActionRatioMax: 1.8,
    militaryBorderReliefRatioMax: 1.8,
    reliefRatioMax: 1.8,
    antiCorruptionRatioMax: 1.8,
    taxPressureOffsetMin: -10,
    taxPressureOffsetMax: 0,
    unrestDeltaMin: -8,
    unrestDeltaMax: 4,
  },
  politicsReductionTotalCap: 18,
  softFloor: {
    borderThreat: {
      enabled: true,
      threshold: 20,
      damping: 0.5,
    },
    corruptionLevel: {
      enabled: true,
      threshold: 15,
      damping: 0.5,
    },
  },
};

function resolveBalanceConfig(balanceConfig) {
  const source = balanceConfig && typeof balanceConfig === "object" ? balanceConfig : {};
  return {
    executionRate: {
      ...DEFAULT_BALANCE_CONFIG.executionRate,
      ...(source.executionRate || {}),
    },
    military: {
      ...DEFAULT_BALANCE_CONFIG.military,
      ...(source.military || {}),
    },
    partyStrife: {
      ...DEFAULT_BALANCE_CONFIG.partyStrife,
      ...(source.partyStrife || {}),
    },
    policyBonusCaps: {
      ...DEFAULT_BALANCE_CONFIG.policyBonusCaps,
      ...(source.policyBonusCaps || {}),
    },
    politicsReductionTotalCap: typeof source.politicsReductionTotalCap === "number"
      ? source.politicsReductionTotalCap
      : DEFAULT_BALANCE_CONFIG.politicsReductionTotalCap,
    softFloor: {
      borderThreat: {
        ...DEFAULT_BALANCE_CONFIG.softFloor.borderThreat,
        ...((source.softFloor && source.softFloor.borderThreat) || {}),
      },
      corruptionLevel: {
        ...DEFAULT_BALANCE_CONFIG.softFloor.corruptionLevel,
        ...((source.softFloor && source.softFloor.corruptionLevel) || {}),
      },
    },
  };
}

function getBalanceFromState(state) {
  return resolveBalanceConfig(state?.config?.balance);
}

function dampNegativeDeltaByFloor(delta, currentValue, floorConfig) {
  if (typeof delta !== "number" || delta >= 0) return delta;
  if (!floorConfig || !floorConfig.enabled) return delta;
  if (typeof currentValue !== "number") return delta;
  if (currentValue > floorConfig.threshold) return delta;
  return roundScaled(delta, clamp(floorConfig.damping, 0, 1));
}

export function computeExecutionRate(prestige, executionRateConfig) {
  const cfg = { ...DEFAULT_BALANCE_CONFIG.executionRate, ...(executionRateConfig || {}) };
  const score = typeof prestige === "number" ? prestige : 60;
  if (score >= cfg.highPrestigeThreshold) return cfg.highPrestigeRate;
  if (score >= cfg.midPrestigeThreshold) {
    return clamp(cfg.midBase + Math.round((score - cfg.midPrestigeThreshold) / cfg.midSlopeDivisor), cfg.midMin, cfg.midMax);
  }
  return clamp(cfg.lowBase - Math.round((cfg.midPrestigeThreshold - score) / cfg.lowSlopeDivisor), cfg.lowMin, cfg.lowMax);
}

export const PLAYER_ABILITY_KEYS = ["management", "military", "scholarship", "politics"];

export const POLICY_CATALOG = [
  { id: "civil_light_tax", branch: "内政", title: "轻徭薄赋", cost: 1, requires: [], description: "降低税压，提振民间经济。" },
  { id: "civil_tax_reform", branch: "内政", title: "税制改革", cost: 1, requires: ["civil_light_tax"], description: "稳定财政，打击偷税漏税。" },
  { id: "civil_canal", branch: "内政", title: "漕运整顿", cost: 1, requires: ["civil_tax_reform"], description: "修复京杭大运河，保障京师粮运。" },
  { id: "civil_salt_iron", branch: "内政", title: "盐铁官营优化", cost: 1, requires: ["civil_canal"], description: "平衡官私盐利，稳定盐税收入。" },
  { id: "civil_port_office", branch: "内政", title: "市舶司复开", cost: 1, requires: ["civil_salt_iron"], description: "重开广州、泉州市舶司，增加海关税收。" },
  { id: "civil_remove_mining_tax", branch: "内政", title: "矿税监裁撤", cost: 1, requires: ["civil_port_office"], description: "废除矿监税使，缓和官民矛盾。" },
  { id: "civil_royal_allowance_cut", branch: "内政", title: "宗室禄米削减", cost: 1, requires: ["civil_remove_mining_tax"], description: "限制藩王俸禄，缓解财政压力。" },
  { id: "civil_post_optimization", branch: "内政", title: "驿站裁撤优化", cost: 1, requires: ["civil_royal_allowance_cut"], description: "精简驿站，同时保障军情传递。" },
  { id: "civil_tea_horse", branch: "内政", title: "茶马互市规范化", cost: 1, requires: ["civil_post_optimization"], description: "稳定与蒙古、藏地的茶马贸易。" },
  { id: "civil_salt_ticket", branch: "内政", title: "开中法改良", cost: 1, requires: ["civil_tea_horse"], description: "优化盐引制度，鼓励商人输粮边疆。" },
  { id: "civil_reserve_granary", branch: "内政", title: "预备仓扩建", cost: 1, requires: ["civil_salt_ticket"], description: "各省建设备荒粮仓，应对灾荒。" },
  { id: "civil_paper_money", branch: "内政", title: "钞法试行", cost: 1, requires: ["civil_reserve_granary"], description: "试行纸币，缓解通货紧缩。" },

  { id: "military_border_defense", branch: "军事", title: "守边固防", cost: 1, requires: [], description: "提升边防收益。" },
  { id: "military_firearms", branch: "军事", title: "火器革新", cost: 1, requires: ["military_border_defense"], description: "强化火器部队战力。" },
  { id: "military_capital_drill", branch: "军事", title: "京营整训", cost: 1, requires: ["military_firearms"], description: "整顿京营，恢复禁军战斗力。" },
  { id: "military_recruit", branch: "军事", title: "边军募兵制", cost: 1, requires: ["military_capital_drill"], description: "提升兵员素质。" },
  { id: "military_wagon", branch: "军事", title: "车营重建", cost: 1, requires: ["military_recruit"], description: "复刻车营战术，对抗骑兵。" },
  { id: "military_navy", branch: "军事", title: "水师扩建", cost: 1, requires: ["military_wagon"], description: "打造沿海水师，抵御袭扰。" },
  { id: "military_fort", branch: "军事", title: "堡垒防线修筑", cost: 1, requires: ["military_navy"], description: "在辽东修筑棱堡防线。" },
  { id: "military_command", branch: "军事", title: "兵备道整合", cost: 1, requires: ["military_fort"], description: "统一地方军务指挥。" },
  { id: "military_tuntian", branch: "军事", title: "军屯恢复", cost: 1, requires: ["military_command"], description: "鼓励士兵屯田，自给军粮。" },
  { id: "military_workshop", branch: "军事", title: "火器工坊集中", cost: 1, requires: ["military_tuntian"], description: "建立大型火器制造局。" },

  { id: "politics_balance", branch: "政治", title: "派系制衡", cost: 1, requires: [], description: "降低党争，提升行政效率。" },
  { id: "politics_memorial", branch: "政治", title: "密折监察", cost: 1, requires: ["politics_balance"], description: "遏制贪腐与派系失控。" },
  { id: "politics_limit_cabinet", branch: "政治", title: "内阁票拟权限制", cost: 1, requires: ["politics_memorial"], description: "强化皇权，避免内阁专权。" },
  { id: "politics_censorate", branch: "政治", title: "言官整顿", cost: 1, requires: ["politics_limit_cabinet"], description: "减少风闻言事引发的党争。" },
  { id: "politics_assessment", branch: "政治", title: "考成法重启", cost: 1, requires: ["politics_censorate"], description: "严格考核官员政绩。" },
  { id: "politics_limit_eunuch", branch: "政治", title: "宦官干政限制", cost: 1, requires: ["politics_assessment"], description: "限制司礼监批红权。" },
  { id: "politics_royal_rule", branch: "政治", title: "藩王就国约束", cost: 1, requires: ["politics_limit_eunuch"], description: "削弱宗室地方干政。" },
  { id: "politics_viceroy", branch: "政治", title: "督抚制度完善", cost: 1, requires: ["politics_royal_rule"], description: "确立督抚军政统筹地位。" },
  { id: "politics_east_factory", branch: "政治", title: "东厂职能收缩", cost: 1, requires: ["politics_viceroy"], description: "防止厂卫滥权。" },
  { id: "politics_south_study", branch: "政治", title: "南书房雏形", cost: 1, requires: ["politics_east_factory"], description: "建立皇帝机要秘书班子。" },

  { id: "tech_agri", branch: "科技", title: "农耕改良", cost: 1, requires: [], description: "提升粮食储备。" },
  { id: "tech_engineering", branch: "科技", title: "工程建设", cost: 1, requires: ["tech_agri"], description: "增强长期工程效率。" },
  { id: "tech_calendar", branch: "科技", title: "历法修订", cost: 1, requires: ["tech_engineering"], description: "引入西法修历。" },
  { id: "tech_firearm_theory", branch: "科技", title: "火器理论研究", cost: 1, requires: ["tech_calendar"], description: "提升造炮理论与训练。" },
  { id: "tech_water", branch: "科技", title: "水利工程推广", cost: 1, requires: ["tech_firearm_theory"], description: "治理水患，保障农业。" },
  { id: "tech_ship", branch: "科技", title: "造船技术引进", cost: 1, requires: ["tech_water"], description: "提升海船建造能力。" },
  { id: "tech_medicine", branch: "科技", title: "医学典籍整理", cost: 1, requires: ["tech_ship"], description: "推广防疫知识。" },
  { id: "tech_math", branch: "科技", title: "算学馆设立", cost: 1, requires: ["tech_medicine"], description: "培养算学人才，服务工程与历法。" },

  { id: "diplomacy_mongol", branch: "外交", title: "联蒙制满", cost: 1, requires: [], description: "与蒙古结盟，牵制后金。" },
  { id: "diplomacy_korea", branch: "外交", title: "朝鲜羁縻", cost: 1, requires: ["diplomacy_mongol"], description: "防止朝鲜倒向后金。" },
  { id: "diplomacy_macao", branch: "外交", title: "澳门通商", cost: 1, requires: ["diplomacy_korea"], description: "获取火器与技术。" },
  { id: "diplomacy_japan", branch: "外交", title: "日本勘合贸易重启", cost: 1, requires: ["diplomacy_macao"], description: "恢复官方贸易，抑制倭患。" },
  { id: "diplomacy_rome", branch: "外交", title: "遣使罗马", cost: 1, requires: ["diplomacy_japan"], description: "争取西方军事援助。" },
  { id: "diplomacy_southwest", branch: "外交", title: "西南土司安抚", cost: 1, requires: ["diplomacy_rome"], description: "稳定云贵川边地秩序。" },

  { id: "people_epidemic", branch: "民生", title: "疫政推行", cost: 1, requires: [], description: "设立防疫机构，应对疫病。" },
  { id: "people_refugee", branch: "民生", title: "流民安置", cost: 1, requires: ["people_epidemic"], description: "设屯垦区，恢复生产。" },
  { id: "people_charity_granary", branch: "民生", title: "义仓普及", cost: 1, requires: ["people_refugee"], description: "地方义仓赈济灾民。" },

  { id: "alt_nanyang_colony", branch: "破局", title: "南洋拓殖计划", cost: 2, requires: ["diplomacy_rome", "military_workshop", "civil_port_office"], description: "外向拓殖破局，转移压力并开辟海外税源。" },
];

const BASELINE_IMPLEMENTED_POLICY_IDS = [
  "civil_light_tax",
  "civil_tax_reform",
  "military_border_defense",
  "military_firearms",
  "politics_balance",
  "politics_memorial",
  "tech_agri",
  "tech_engineering",
];

const LEGACY_POLICY_ALIAS = {
  civil_tax_relief: "civil_light_tax",
  civil_reform: "civil_tax_reform",
  military_border: "military_border_defense",
  military_firearms: "military_firearms",
  politics_balance: "politics_balance",
  politics_censor: "politics_memorial",
  tech_agri: "tech_agri",
  tech_engineering: "tech_engineering",
};

const POLICY_ID_SET = new Set(POLICY_CATALOG.map((item) => item.id));

function normalizePolicyId(policyId) {
  if (!policyId || typeof policyId !== "string") return null;
  const mapped = LEGACY_POLICY_ALIAS[policyId] || policyId;
  return POLICY_ID_SET.has(mapped) ? mapped : null;
}

export function normalizeUnlockedPolicies(unlockedPolicies) {
  const incoming = Array.isArray(unlockedPolicies) ? unlockedPolicies : [];
  const normalized = [];
  const seen = new Set();
  const add = (id) => {
    const normalizedId = normalizePolicyId(id);
    if (!normalizedId || seen.has(normalizedId)) return;
    seen.add(normalizedId);
    normalized.push(normalizedId);
  };

  BASELINE_IMPLEMENTED_POLICY_IDS.forEach(add);
  incoming.forEach(add);
  return normalized;
}

function hasPolicy(unlockedPolicies, policyId) {
  return normalizeUnlockedPolicies(unlockedPolicies).includes(policyId);
}

export function getPolicyCatalog() {
  return POLICY_CATALOG;
}

export function getPolicyBonusSummary(unlockedPolicies, balanceConfig) {
  const resolvedBalance = resolveBalanceConfig(balanceConfig);
  const caps = resolvedBalance.policyBonusCaps;
  const has = (id) => hasPolicy(unlockedPolicies, id);
  const summary = {
    quarterlyTreasuryRatio: 1,
    quarterlyGrainRatio: 1,
    quarterlyMilitaryDelta: 0,
    quarterlyCorruptionDelta: 0,
    executionRateBonus: 0,
    politicsReduction: 0,
    militaryDamageFlat: 0,
    militaryActionRatio: 1,
    militaryBorderReliefRatio: 1,
    reliefRatio: 1,
    antiCorruptionRatio: 1,
    taxPressureOffset: 0,
    unrestDelta: 0,
  };

  // 内政
  if (has("civil_light_tax")) summary.taxPressureOffset -= 2;
  if (has("civil_tax_reform")) summary.quarterlyTreasuryRatio += 0.12;
  if (has("civil_canal")) summary.quarterlyGrainRatio += 0.08;
  if (has("civil_salt_iron")) summary.quarterlyTreasuryRatio += 0.06;
  if (has("civil_port_office")) summary.quarterlyTreasuryRatio += 0.1;
  if (has("civil_remove_mining_tax")) {
    summary.unrestDelta -= 1;
    summary.reliefRatio += 0.05;
  }
  if (has("civil_royal_allowance_cut")) summary.quarterlyTreasuryRatio += 0.08;
  if (has("civil_post_optimization")) summary.executionRateBonus += 1;
  if (has("civil_tea_horse")) {
    summary.quarterlyTreasuryRatio += 0.05;
    summary.militaryBorderReliefRatio += 0.05;
  }
  if (has("civil_salt_ticket")) {
    summary.quarterlyTreasuryRatio += 0.06;
    summary.quarterlyGrainRatio += 0.05;
  }
  if (has("civil_reserve_granary")) summary.quarterlyGrainRatio += 0.12;
  if (has("civil_paper_money")) summary.quarterlyTreasuryRatio += 0.08;

  // 军事
  if (has("military_border_defense")) summary.militaryBorderReliefRatio += 0.1;
  if (has("military_firearms")) {
    summary.militaryActionRatio += 0.12;
    summary.militaryDamageFlat += 4;
  }
  if (has("military_capital_drill")) summary.militaryActionRatio += 0.05;
  if (has("military_recruit")) summary.militaryDamageFlat += 1;
  if (has("military_wagon")) summary.militaryBorderReliefRatio += 0.06;
  if (has("military_navy")) {
    summary.quarterlyTreasuryRatio += 0.03;
    summary.militaryDamageFlat += 1;
  }
  if (has("military_fort")) summary.militaryBorderReliefRatio += 0.08;
  if (has("military_command")) summary.executionRateBonus += 1;
  if (has("military_tuntian")) summary.quarterlyGrainRatio += 0.08;
  if (has("military_workshop")) {
    summary.militaryActionRatio += 0.08;
    summary.militaryDamageFlat += 2;
  }

  // 政治
  if (has("politics_balance")) summary.executionRateBonus += 4;
  if (has("politics_memorial")) {
    summary.politicsReduction += 6;
    summary.antiCorruptionRatio += 0.1;
  }
  if (has("politics_limit_cabinet")) summary.executionRateBonus += 1;
  if (has("politics_censorate")) summary.politicsReduction += 2;
  if (has("politics_assessment")) {
    summary.executionRateBonus += 2;
    summary.politicsReduction += 2;
  }
  if (has("politics_limit_eunuch")) {
    summary.politicsReduction += 2;
    summary.antiCorruptionRatio += 0.08;
  }
  if (has("politics_royal_rule")) summary.quarterlyTreasuryRatio += 0.03;
  if (has("politics_viceroy")) summary.executionRateBonus += 2;
  if (has("politics_east_factory")) summary.unrestDelta -= 1;
  if (has("politics_south_study")) {
    summary.executionRateBonus += 3;
    summary.politicsReduction += 2;
  }

  // 科技
  if (has("tech_agri")) summary.quarterlyGrainRatio += 0.15;
  if (has("tech_engineering")) summary.quarterlyTreasuryRatio += 0.1;
  if (has("tech_calendar")) summary.executionRateBonus += 1;
  if (has("tech_firearm_theory")) {
    summary.militaryActionRatio += 0.06;
    summary.militaryDamageFlat += 1;
  }
  if (has("tech_water")) {
    summary.quarterlyGrainRatio += 0.08;
    summary.reliefRatio += 0.05;
  }
  if (has("tech_ship")) summary.quarterlyTreasuryRatio += 0.04;
  if (has("tech_medicine")) summary.unrestDelta -= 1;
  if (has("tech_math")) summary.executionRateBonus += 2;

  // 外交
  if (has("diplomacy_mongol")) summary.militaryBorderReliefRatio += 0.08;
  if (has("diplomacy_korea")) summary.militaryBorderReliefRatio += 0.04;
  if (has("diplomacy_macao")) {
    summary.quarterlyTreasuryRatio += 0.05;
    summary.militaryActionRatio += 0.04;
  }
  if (has("diplomacy_japan")) summary.quarterlyTreasuryRatio += 0.05;
  if (has("diplomacy_rome")) summary.militaryDamageFlat += 1;
  if (has("diplomacy_southwest")) summary.unrestDelta -= 1;

  // 民生
  if (has("people_epidemic")) {
    summary.reliefRatio += 0.08;
    summary.unrestDelta -= 1;
  }
  if (has("people_refugee")) {
    summary.reliefRatio += 0.1;
    summary.unrestDelta -= 1;
  }
  if (has("people_charity_granary")) summary.quarterlyGrainRatio += 0.08;

  // 破局
  if (has("alt_nanyang_colony")) {
    summary.quarterlyTreasuryRatio += 0.12;
    summary.quarterlyGrainRatio += 0.06;
    summary.militaryDamageFlat += 2;
    summary.unrestDelta -= 1;
  }

  summary.quarterlyTreasuryRatio = clamp(summary.quarterlyTreasuryRatio, 1, caps.quarterlyTreasuryRatioMax);
  summary.quarterlyGrainRatio = clamp(summary.quarterlyGrainRatio, 1, caps.quarterlyGrainRatioMax);
  summary.executionRateBonus = clamp(summary.executionRateBonus, 0, caps.executionRateBonusMax);
  summary.politicsReduction = clamp(summary.politicsReduction, 0, caps.politicsReductionMax);
  summary.militaryDamageFlat = clamp(summary.militaryDamageFlat, 0, caps.militaryDamageFlatMax);
  summary.militaryActionRatio = clamp(summary.militaryActionRatio, 1, caps.militaryActionRatioMax);
  summary.militaryBorderReliefRatio = clamp(summary.militaryBorderReliefRatio, 1, caps.militaryBorderReliefRatioMax);
  summary.reliefRatio = clamp(summary.reliefRatio, 1, caps.reliefRatioMax);
  summary.antiCorruptionRatio = clamp(summary.antiCorruptionRatio, 1, caps.antiCorruptionRatioMax);
  summary.taxPressureOffset = clamp(summary.taxPressureOffset, caps.taxPressureOffsetMin, caps.taxPressureOffsetMax);
  summary.unrestDelta = clamp(summary.unrestDelta, caps.unrestDeltaMin, caps.unrestDeltaMax);
  return summary;
}

function inferCustomPolicyCategory(name) {
  const text = String(name || "");
  if (/军|兵|边|防/.test(text)) return "military";
  if (/农|粮|赈|田|仓/.test(text)) return "agri";
  if (/税|财|商|工|海/.test(text)) return "fiscal";
  if (/吏|政|法|察|廉|监/.test(text)) return "governance";
  return "general";
}

export function extractCustomPoliciesFromEdict(edictText, year, month) {
  const text = String(edictText || "");
  const result = [];
  const seen = new Set();
  const patterns = [
    /设立\s*([\u4e00-\u9fa5A-Za-z0-9]{2,32})[\s\S]{0,40}?定为国策/g,
    /将\s*([\u4e00-\u9fa5A-Za-z0-9]{2,32})[\s\S]{0,40}?定为国策/g,
    /([\u4e00-\u9fa5A-Za-z0-9]{2,32})[\s\S]{0,20}?纳入国策/g,
    /([\u4e00-\u9fa5A-Za-z0-9]{2,32})[\s\S]{0,20}?列为国策/g,
  ];
  patterns.forEach((re) => {
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = (m[1] || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({
        id: `custom_${name}`,
        name,
        category: inferCustomPolicyCategory(name),
        createdYear: year || 1,
        createdMonth: month || 1,
      });
    }
  });

  // 兜底：若出现“定为国策”但未匹配到机构名，则从前文逆向提取最近的“设立XX/将XX”片段
  if (!result.length && /定为国策|纳入国策|列为国策/.test(text)) {
    const fallback = text.match(/(?:设立|将)([\u4e00-\u9fa5A-Za-z0-9]{2,32})/);
    const name = (fallback && fallback[1] ? fallback[1] : "").trim();
    if (name) {
      result.push({
        id: `custom_${name}`,
        name,
        category: inferCustomPolicyCategory(name),
        createdYear: year || 1,
        createdMonth: month || 1,
      });
    }
  }

  return result;
}

export function mergeCustomPolicies(existingPolicies, newPolicies) {
  const current = Array.isArray(existingPolicies) ? existingPolicies : [];
  const incoming = Array.isArray(newPolicies) ? newPolicies : [];
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (!item || !item.id) return;
    if (!byId.has(item.id)) byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

export function computeCustomPolicyQuarterBonus(state) {
  const policies = Array.isArray(state.customPolicies) ? state.customPolicies : [];
  const bonus = {
    treasuryRatio: 1,
    grainRatio: 1,
    executionRateBonus: 0,
    militaryDelta: 0,
    corruptionDelta: 0,
  };
  policies.forEach((policy) => {
    switch (policy.category) {
      case "fiscal":
        bonus.treasuryRatio += 0.04;
        break;
      case "agri":
        bonus.grainRatio += 0.05;
        break;
      case "military":
        bonus.militaryDelta += 1;
        break;
      case "governance":
        bonus.executionRateBonus += 1;
        bonus.corruptionDelta -= 1;
        break;
      default:
        bonus.treasuryRatio += 0.01;
        bonus.grainRatio += 0.01;
        break;
    }
  });
  bonus.treasuryRatio = clamp(bonus.treasuryRatio, 1, 1.6);
  bonus.grainRatio = clamp(bonus.grainRatio, 1, 1.7);
  bonus.executionRateBonus = clamp(bonus.executionRateBonus, 0, 10);
  bonus.militaryDelta = clamp(bonus.militaryDelta, 0, 8);
  bonus.corruptionDelta = clamp(bonus.corruptionDelta, -8, 0);
  return bonus;
}

export function spendAbilityPoint(state, abilityKey) {
  if (!PLAYER_ABILITY_KEYS.includes(abilityKey)) return null;
  if ((state.abilityPoints || 0) <= 0) return null;
  return {
    abilityPoints: (state.abilityPoints || 0) - 1,
    playerAbilities: {
      ...(state.playerAbilities || {}),
      [abilityKey]: ((state.playerAbilities && state.playerAbilities[abilityKey]) || 0) + 1,
    },
  };
}

export function unlockPolicy(state, policyId) {
  const policy = POLICY_CATALOG.find((item) => item.id === policyId);
  if (!policy) return null;
  if ((state.policyPoints || 0) < policy.cost) return null;
  const unlocked = normalizeUnlockedPolicies(state.unlockedPolicies);
  if (unlocked.includes(policyId)) return null;
  const missing = (policy.requires || []).some((id) => !unlocked.includes(id));
  if (missing) return null;
  return {
    policyPoints: (state.policyPoints || 0) - policy.cost,
    unlockedPolicies: [...unlocked, policyId],
  };
}

export function buildQuarterFocus(agendaId, stance, factionId) {
  if (!agendaId || !stance) return null;
  return { agendaId, stance, factionId: factionId || null };
}

const HOSTILE_LEVEL_POWER = {
  critical: 88,
  high: 72,
  medium: 58,
  low: 45,
};

function toHostileId(name, index) {
  const normalized = String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[（【].*?[】）]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized ? `hostile_${normalized}` : `hostile_${index + 1}`;
}

function buildStorylineTag(name) {
  return `${String(name || "未知势力").replace(/\s+/g, "")}_线`;
}

export function initializeHostileForces(currentState, nationInit) {
  const existing = Array.isArray(currentState.hostileForces) ? currentState.hostileForces : [];
  if (existing.length) {
    return existing.map((item, idx) => ({
      id: item.id || toHostileId(item.name, idx),
      name: item.name || `敌对势力${idx + 1}`,
      leader: item.leader || "未知",
      status: item.status || "暂无情报",
      level: item.level || "high",
      power: clamp(typeof item.power === "number" ? item.power : 60, 0, 100),
      isDefeated: !!item.isDefeated,
      storylineTag: item.storylineTag || buildStorylineTag(item.name),
      defeatedYear: item.defeatedYear || null,
      defeatedMonth: item.defeatedMonth || null,
    }));
  }

  const base = Array.isArray(nationInit?.externalThreats) ? nationInit.externalThreats : [];
  return base.map((item, idx) => ({
    id: toHostileId(item.name, idx),
    name: item.name || `敌对势力${idx + 1}`,
    leader: item.leader || "未知",
    status: item.status || "暂无情报",
    level: item.level || "high",
    power: HOSTILE_LEVEL_POWER[item.level] || 66,
    isDefeated: false,
    storylineTag: buildStorylineTag(item.name),
    defeatedYear: null,
    defeatedMonth: null,
  }));
}

function applyLegacyExternalPowersCompat(currentState, hostileForces, closedStorylines) {
  const external = currentState?.externalPowers;
  if (!external || typeof external !== "object") {
    return {
      hostileForces,
      closedStorylines: Array.isArray(closedStorylines) ? closedStorylines : [],
    };
  }

  const nextHostiles = (Array.isArray(hostileForces) ? hostileForces : []).map((item) => {
    const id = item?.id;
    if (!id || typeof external[id] !== "number") {
      return { ...item };
    }
    const mappedPower = clamp(Math.round(external[id]), 0, 100);
    const defeated = mappedPower <= 0;
    return {
      ...item,
      power: mappedPower,
      isDefeated: item.isDefeated || defeated,
      status: defeated
        ? "已被朝廷彻底剿灭，余部星散。"
        : (item.status || `遭受朝廷打击，势力值降至 ${mappedPower}/100。`),
    };
  });

  const defeatedTags = nextHostiles
    .filter((item) => item.isDefeated)
    .map((item) => item.storylineTag || buildStorylineTag(item.name));

  return {
    hostileForces: nextHostiles,
    closedStorylines: mergeUniqueStrings(closedStorylines, defeatedTags),
  };
}

function defaultFactionSupport(factionId) {
  const defaults = {
    donglin: 48,
    eunuch: 52,
    neutral: 50,
    military: 46,
    imperial: 72,
  };
  return defaults[factionId] || 50;
}

function monthSerial(year, month) {
  return (year || 1) * 12 + (month || 1);
}

function parseChoiceTags(choiceText) {
  const text = String(choiceText || "");
  return {
    tax: /加税|征税|辽饷|田税|税收/.test(text),
    relief: /赈灾|赈济|赈恤|开仓|发粮|减免赋税|减税|免税/.test(text),
    military: /军饷|调兵|增兵|练兵|剿匪|边防|守关|火器|新军|征讨|北伐|平叛|出师|开拓|讨伐|灭贼|剿灭|攻城/.test(text),
    reform: /改革|税制|监察|考成|整顿|吏治|肃贪|反腐/.test(text),
    austerity: /裁撤|节流|压缩开支|裁员|俸禄/.test(text),
    emergency: /抄没|抄家|内帑|查抄/.test(text),
    antiEunuch: /阉党|魏忠贤|清洗阉党|处置阉党/.test(text),
    maritime: /开海禁|贸易|海贸/.test(text),
    postalCut: /裁驿卒|裁驿/.test(text),
    promoteYuan: /袁崇焕/.test(text),
    royalReform: /宗室改革|宗室|削宗禄/.test(text),
  };
}

export function applyProgressionToChoiceEffects(effects, state, choiceText) {
  if (!effects) return effects;
  const tags = parseChoiceTags(choiceText);
  const abilities = state.playerAbilities || {};
  const unlocked = normalizeUnlockedPolicies(state.unlockedPolicies);
  const balance = getBalanceFromState(state);
  const policyBonus = getPolicyBonusSummary(unlocked, balance);
  const next = { ...effects, loyalty: effects.loyalty ? { ...effects.loyalty } : effects.loyalty };
  const scaleField = (key, ratio, favorPositive = true) => {
    if (typeof next[key] !== "number") return;
    const value = next[key];
    const positive = value > 0;
    if ((favorPositive && positive) || (!favorPositive && !positive)) {
      next[key] = roundScaled(value, ratio);
    }
  };

  if (tags.military) {
    const ratio = (1 + (abilities.military || 0) * 0.08) * policyBonus.militaryActionRatio;
    scaleField("militaryStrength", ratio, true);
    scaleField("borderThreat", ratio * policyBonus.militaryBorderReliefRatio, false);
  }
  if (tags.relief || tags.reform) {
    const ratio = (1 + (abilities.scholarship || 0) * 0.08) * policyBonus.reliefRatio;
    scaleField("civilMorale", ratio, true);
    scaleField("disasterLevel", ratio, false);
    scaleField("corruptionLevel", ratio * policyBonus.antiCorruptionRatio, false);
  }
  if (tags.tax) {
    if (hasPolicy(unlocked, "civil_light_tax")) {
      scaleField("civilMorale", 0.8, false);
    }
  }

  if (typeof next.borderThreat === "number") {
    const currentBorderThreat = state.nation?.borderThreat;
    next.borderThreat = dampNegativeDeltaByFloor(next.borderThreat, currentBorderThreat, balance.softFloor.borderThreat);
  }
  if (typeof next.corruptionLevel === "number") {
    const currentCorruption = state.nation?.corruptionLevel;
    next.corruptionLevel = dampNegativeDeltaByFloor(next.corruptionLevel, currentCorruption, balance.softFloor.corruptionLevel);
  }

  return next;
}

function scheduleConsequences(choiceText, nextYear, nextMonth) {
  const tags = parseChoiceTags(choiceText);
  const scheduled = [];
  const add = (delayMonths, id, title, summary, effects, publicOpinion, factionSupport) => {
    scheduled.push({
      id,
      dueSerial: monthSerial(nextYear, nextMonth) + delayMonths,
      title,
      summary,
      effects,
      publicOpinion,
      factionSupport,
    });
  };

  if (tags.postalCut) {
    add(3, "postal_cut_backlash", "裁驿卒后效", "失业驿卒流入地方，流寇与治安压力同步上升。", { civilMorale: -8, borderThreat: 4 }, { source: "驿卒与流民", text: "裁驿之后，许多人失了生计，地方上已见不稳。", type: "angry" });
  }
  if (tags.maritime) {
    add(3, "maritime_trade_gain", "海贸渐开", "海贸开始见效，财政收入上升，但沿海秩序承压。", { treasury: 300000, borderThreat: 5 }, { source: "江南商贾", text: "开海后商路渐通，朝廷税课确有起色。", type: "neutral" }, { donglin: -6, neutral: 4 });
  }
  if (tags.promoteYuan) {
    add(3, "yuan_frontier_gain", "边防整肃", "关外防线因名将坐镇而稳固，但保守派议论渐起。", { militaryStrength: 12, borderThreat: -10 }, { source: "边军将士", text: "名将坐镇，边军士气大振。", type: "loyal" }, { eunuch: -5, military: 8 });
  }
  if (tags.royalReform) {
    add(6, "royal_reform_dividend", "宗室改革余波", "宗室开支被压缩，财政稍有回暖，但宗亲怨气累积。", { treasury: 200000, civilMorale: -2 }, { source: "宗室与地方士绅", text: "宗室俸禄被削，朝野私议不断。", type: "neutral" }, { imperial: -4, neutral: 2 });
  }

  return scheduled;
}

function buildQuarterAgenda(state) {
  const nation = state.nation || {};
  const agenda = [];
  const activeHostiles = (state.hostileForces || []).filter((item) => !item.isDefeated);
  const lastTags = parseChoiceTags(state.lastChoiceText || "");
  const lastTurnSummary = buildLastTurnAgendaSummary(state, lastTags);
  const currentSerial = monthSerial(state.currentYear || 1, state.currentMonth || 1);
  const upcomingConsequence = (state.pendingConsequences || [])
    .slice()
    .sort((a, b) => (a.dueSerial || 0) - (b.dueSerial || 0))
    .find((item) => (item.dueSerial || 0) <= currentSerial + 3);

  const pushAgenda = (id, title, summary, impacts, severity = "重") => {
    if (agenda.some((item) => item.id === id)) return;
    agenda.push({ id, title, summary, impacts, severity });
  };

  const effectsToImpacts = (effects) => {
    if (!effects || typeof effects !== "object") return ["国势"];
    const impacts = [];
    if (typeof effects.treasury === "number" || typeof effects.grain === "number") impacts.push("财政");
    if (typeof effects.civilMorale === "number" || typeof effects.unrest === "number") impacts.push("民心");
    if (typeof effects.militaryStrength === "number" || typeof effects.borderThreat === "number" || effects.hostileDamage) impacts.push("军事");
    if (typeof effects.corruptionLevel === "number" || typeof effects.loyalty === "object") impacts.push("吏治");
    return impacts.length ? impacts : ["国势"];
  };

  if (upcomingConsequence) {
    const consequenceSeverity = (upcomingConsequence.dueSerial || 0) <= currentSerial + 1 ? "急" : "重";
    pushAgenda(
      `followup_${upcomingConsequence.id}`,
      `承接上轮：${upcomingConsequence.title}`,
      `上轮政令余波将至（预计近期触发），需提前部署以降低副作用并放大收益。${lastTurnSummary ? ` ${lastTurnSummary}` : ""}`,
      effectsToImpacts(upcomingConsequence.effects),
      consequenceSeverity
    );
  }

  // 上轮偏向什么，本季优先给对应承接议题，保持“连续推理”的叙事感。
  if (lastTags.relief || lastTags.reform || lastTags.tax || lastTags.royalReform) {
    pushAgenda("domestic_followup", "内政承接：赋役与赈抚复盘", `上轮政令已触达地方，本季需围绕赋税、赈济与吏治做二次校准。${lastTurnSummary ? ` ${lastTurnSummary}` : ""}`, ["内政", "财政", "民心"], "重");
  }
  if (lastTags.maritime || (nation.treasury || 0) < 320000) {
    pushAgenda("diplomacy_trade", "外交议题：通商与周边协同", `在财政与海贸压力下，需通过通商与外部协同缓释内政压力。${lastTurnSummary ? ` ${lastTurnSummary}` : ""}`, ["外交", "财政", "边患"], "重");
  }
  if (lastTags.military || lastTags.promoteYuan || activeHostiles.length) {
    pushAgenda("military_followup", "军事承接：边防部署复核", `上轮军务动作已改变战场态势，本季需复核兵力、补给与目标优先级。${lastTurnSummary ? ` ${lastTurnSummary}` : ""}`, ["军事", "边患", "执行"], "重");
  }

  if ((nation.treasury || 0) < 400000) {
    pushAgenda("fiscal_gap", "军饷与财政缺口", "财政已逼近红线，需尽快开源或节流。", ["财政", "军饷", "派系"], "急");
  }
  if ((nation.grain || 0) < 25000 || (nation.civilMorale || 0) < 50) {
    pushAgenda("relief_shaanxi", "陕西赈灾与安民", "粮储或民心偏低，应优先稳住流民与灾情。", ["民心", "粮储", "动乱"], "急");
  }
  if ((nation.militaryStrength || 0) < 60 || (nation.borderThreat || 0) > 65) {
    pushAgenda("frontier_defense", "关宁补饷与边防", "关外军务承压，若军饷不足将直接冲击守边。", ["军力", "边患", "财政"], "急");
  }
  if (activeHostiles.length) {
    const topHostile = activeHostiles.slice().sort((a, b) => (b.power || 0) - (a.power || 0))[0];
    pushAgenda(
      "military_expansion",
      `军事开拓：对${topHostile.name}用兵`,
      `敌对势力“${topHostile.name}”当前势力值约 ${topHostile.power}/100，可通过军事选项持续削弱直至灭亡。`,
      ["军力", "边患", "敌对势力"],
      (topHostile.power || 0) >= 70 ? "急" : "重"
    );
  }
  if ((state.partyStrife || 0) > 70) {
    pushAgenda("faction_conflict", "终止党争", "党争已接近失控，需调岗与监察并用。", ["派系", "威望", "财政"], "急");
  }
  if ((state.unrest || 0) > 20) {
    pushAgenda("local_unrest", "地方动乱", "地方骚动蔓延，应结合剿匪与安抚同步处理。", ["动乱", "民心", "军力"], "急");
  }

  const categoryDefaults = [
    { id: "domestic_governance", title: "内政：赋役与仓储统筹", summary: "统筹税赋、仓储与赈抚节奏，稳住地方治理预期。", impacts: ["内政", "财政", "民心"], severity: "缓" },
    { id: "diplomacy_coordination", title: "外交：周边关系与通商谈判", summary: "通过边贸、使节与缓冲策略减轻前线与财政压力。", impacts: ["外交", "边患", "财政"], severity: "缓" },
    { id: "military_readiness", title: "军事：战备轮整与边军补给", summary: "围绕战备、补给与轮换训练，提升持续作战能力。", impacts: ["军事", "军力", "边患"], severity: "缓" },
  ];

  for (const item of categoryDefaults) {
    if (agenda.length >= 5) break;
    pushAgenda(item.id, item.title, item.summary, item.impacts, item.severity);
  }

  return agenda.slice(0, clamp(agenda.length, 3, 5));
}

function buildLastTurnAgendaSummary(state, tags) {
  const keywordMap = [
    ["tax", "税赋"],
    ["relief", "赈济"],
    ["military", "军务"],
    ["reform", "改革"],
    ["maritime", "海贸"],
    ["antiEunuch", "肃清旧党"],
    ["royalReform", "宗室改革"],
  ];
  const keywords = keywordMap
    .filter(([key]) => tags && tags[key])
    .map(([, label]) => label)
    .slice(0, 3);

  const history = Array.isArray(state.storyHistory) ? state.storyHistory : [];
  const lastEntry = history.length ? history[history.length - 1] : null;
  const effects = lastEntry?.effects && typeof lastEntry.effects === "object" ? lastEntry.effects : null;

  const effectItems = [];
  if (effects) {
    const deltaMap = ["treasury", "grain", "militaryStrength", "civilMorale", "borderThreat", "corruptionLevel", "unrest"];
    deltaMap.forEach((key) => {
      const value = effects[key];
      if (typeof value !== "number" || value === 0) return;
      const phrase = toSemanticDeltaText(key, value);
      if (phrase) effectItems.push(phrase);
    });
  }

  if (!keywords.length && !effectItems.length) return "";
  const keywordText = keywords.length ? `上轮关键词：${keywords.join("、")}` : "";
  const deltaText = effectItems.length ? `形势纪要：${effectItems.slice(0, 3).join("，")}` : "";
  if (keywordText && deltaText) return `${keywordText}；${deltaText}。`;
  return keywordText || `${deltaText}。`;
}

function toSemanticDeltaText(key, value) {
  const abs = Math.abs(value);
  const level = abs >= 8 ? "明显" : abs >= 4 ? "" : "轻微";
  const prefix = level ? `${level}` : "";

  if (key === "borderThreat") {
    return value < 0 ? `${prefix}边患趋缓` : `${prefix}边患承压`;
  }
  if (key === "corruptionLevel") {
    return value < 0 ? `${prefix}吏治回稳` : `${prefix}吏治承压`;
  }
  if (key === "civilMorale") {
    return value > 0 ? `${prefix}民心回升` : `${prefix}民情波动`;
  }
  if (key === "unrest") {
    return value < 0 ? `${prefix}地方趋稳` : `${prefix}地方躁动`;
  }
  if (key === "militaryStrength") {
    return value > 0 ? `${prefix}军备整饬` : `${prefix}军备消耗`;
  }
  if (key === "treasury") {
    return value > 0 ? `${prefix}国库回暖` : `${prefix}财政吃紧`;
  }
  if (key === "grain") {
    return value > 0 ? `${prefix}仓储充实` : `${prefix}粮储紧绷`;
  }
  return "";
}

function deriveAgendaImpactAdjustment(focus, agenda) {
  if (!focus || !agenda) {
    return {
      taxPressureDelta: 0,
      unrestDelta: 0,
      strifeDelta: 0,
      prestigeDelta: 0,
    };
  }
  const impacts = Array.isArray(agenda.impacts) ? agenda.impacts : [];
  const score = (tokens) => impacts.some((item) => tokens.includes(item));
  const weight = focus.stance === "support" ? 1 : focus.stance === "compromise" ? 0.5 : focus.stance === "oppose" ? -0.6 : 0;

  let taxPressureDelta = 0;
  let unrestDelta = 0;
  let strifeDelta = 0;
  let prestigeDelta = 0;

  if (score(["财政", "军饷", "粮储"])) taxPressureDelta += Math.round(-2 * weight);
  if (score(["民心", "动乱"])) unrestDelta += Math.round(-2 * weight);
  if (score(["派系", "执行", "威望"])) strifeDelta += Math.round(-2 * weight);
  if (score(["军事", "军力", "边患"])) prestigeDelta += Math.round(1 * weight);
  if (score(["外交"])) prestigeDelta += Math.round(1 * weight);

  return {
    taxPressureDelta,
    unrestDelta,
    strifeDelta,
    prestigeDelta,
  };
}

export function refreshQuarterAgendaByState(state) {
  const month = state.currentMonth || 1;
  if (month % 3 !== 0) {
    return {
      currentQuarterAgenda: [],
      currentQuarterFocus: null,
    };
  }

  const nextAgenda = buildQuarterAgenda(state);
  const focus = state.currentQuarterFocus || null;
  const validStance = focus && ["support", "compromise", "oppose", "suppress"].includes(focus.stance);
  const validAgenda = focus && nextAgenda.some((item) => item.id === focus.agendaId);
  const validFaction = focus && (state.factions || []).some((item) => item.id === focus.factionId);

  return {
    currentQuarterAgenda: nextAgenda,
    currentQuarterFocus: validStance && validAgenda && validFaction ? focus : null,
  };
}

export function initializeCoreGameplayState(currentState, factions, config, nationInit) {
  const balance = resolveBalanceConfig(config?.balance);
  const existingSupport = currentState.factionSupport || {};
  const factionSupport = {};
  (factions || []).forEach((faction) => {
    const value = existingSupport[faction.id];
    factionSupport[faction.id] = typeof value === "number" ? value : defaultFactionSupport(faction.id);
  });

  const prestige = typeof currentState.prestige === "number"
    ? currentState.prestige
    : ((config.coreGameplay && config.coreGameplay.initialPrestige) || 58);

  const initializedHostiles = initializeHostileForces(currentState, nationInit);
  const compatResult = applyLegacyExternalPowersCompat(
    currentState,
    initializedHostiles,
    Array.isArray(currentState.closedStorylines) ? currentState.closedStorylines : []
  );

  const nextState = {
    prestige,
    executionRate: computeExecutionRate(prestige, balance.executionRate),
    partyStrife: typeof currentState.partyStrife === "number" ? currentState.partyStrife : 62,
    unrest: typeof currentState.unrest === "number" ? currentState.unrest : 18,
    taxPressure: typeof currentState.taxPressure === "number" ? currentState.taxPressure : 52,
    factionSupport,
    pendingConsequences: Array.isArray(currentState.pendingConsequences) ? currentState.pendingConsequences : [],
    currentQuarterAgenda: Array.isArray(currentState.currentQuarterAgenda) ? currentState.currentQuarterAgenda : [],
    currentQuarterFocus: currentState.currentQuarterFocus || null,
    systemNewsToday: Array.isArray(currentState.systemNewsToday) ? currentState.systemNewsToday : [],
    systemPublicOpinion: Array.isArray(currentState.systemPublicOpinion) ? currentState.systemPublicOpinion : [],
    abilityPoints: typeof currentState.abilityPoints === "number" ? currentState.abilityPoints : 0,
    policyPoints: typeof currentState.policyPoints === "number" ? currentState.policyPoints : 0,
    playerAbilities: {
      management: currentState.playerAbilities?.management || 0,
      military: currentState.playerAbilities?.military || 0,
      scholarship: currentState.playerAbilities?.scholarship || 0,
      politics: currentState.playerAbilities?.politics || 0,
    },
    unlockedPolicies: normalizeUnlockedPolicies(currentState.unlockedPolicies),
    customPolicies: Array.isArray(currentState.customPolicies) ? currentState.customPolicies : [],
    hostileForces: compatResult.hostileForces,
    closedStorylines: compatResult.closedStorylines,
  };

  const isQuarterMonth = ((currentState.currentMonth || config.startMonth || 1) % 3) === 0;
  if (!isQuarterMonth) {
    nextState.currentQuarterAgenda = [];
    nextState.currentQuarterFocus = null;
  } else if (!nextState.currentQuarterAgenda.length) {
    nextState.currentQuarterAgenda = buildQuarterAgenda({ ...currentState, ...nextState });
  }
  return nextState;
}

function parseHostileDamageFromEffects(effects) {
  const map = {};
  if (!effects || typeof effects !== "object") return map;
  const raw = effects.hostileDamage;
  if (!raw || typeof raw !== "object") return map;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "number") continue;
    if (value === 0) continue;
    map[key] = (map[key] || 0) + Math.round(value);
  }
  return map;
}

function isMilitaryFailureText(choiceText, effects) {
  const text = String(choiceText || "");
  const failPattern = /失败|失利|受挫|战败|无功而返|久攻不下|折损|败退|反扑|溃退|被击退/;
  if (failPattern.test(text)) return true;
  if (effects && typeof effects === "object") {
    if (typeof effects.militaryStrength === "number" && effects.militaryStrength < -4) return true;
    if (typeof effects.borderThreat === "number" && effects.borderThreat > 2) return true;
  }
  return false;
}

function evolveProvinceStats(state) {
  const currentStats = state.provinceStats;
  if (!currentStats || typeof currentStats !== "object") return null;
  const nation = state.nation || {};
  const unrest = clamp(state.unrest || 0, 0, 100);
  const partyStrife = clamp(state.partyStrife || 0, 0, 100);

  const next = {};
  let changed = false;

  Object.entries(currentStats).forEach(([name, raw]) => {
    const p = raw && typeof raw === "object" ? raw : {};
    const morale = clamp(typeof p.morale === "number" ? p.morale : 50, 0, 100);
    const corruption = clamp(typeof p.corruption === "number" ? p.corruption : 50, 0, 100);
    const disaster = clamp(typeof p.disaster === "number" ? p.disaster : 50, 0, 100);

    const moraleTarget = clamp((nation.civilMorale || 50) - unrest * 0.12, 0, 100);
    const corruptionTarget = clamp((nation.corruptionLevel || 50) + partyStrife * 0.1, 0, 100);
    const disasterTarget = clamp((nation.disasterLevel || 50) + unrest * 0.06, 0, 100);

    const nextMorale = clamp(morale + Math.round((moraleTarget - morale) * 0.2), 0, 100);
    const nextCorruption = clamp(corruption + Math.round((corruptionTarget - corruption) * 0.2), 0, 100);
    const nextDisaster = clamp(disaster + Math.round((disasterTarget - disaster) * 0.2), 0, 100);

    const baseTaxSilver = typeof p.__baseTaxSilver === "number"
      ? p.__baseTaxSilver
      : (typeof p.taxSilver === "number" ? p.taxSilver : 0);
    const baseTaxGrain = typeof p.__baseTaxGrain === "number"
      ? p.__baseTaxGrain
      : (typeof p.taxGrain === "number" ? p.taxGrain : 0);
    const baseRecruits = typeof p.__baseRecruits === "number"
      ? p.__baseRecruits
      : (typeof p.recruits === "number" ? p.recruits : 0);

    const taxFactor = clamp(0.95 + (nextMorale - 50) / 220 - (nextCorruption - 50) / 240 - (nextDisaster - 50) / 280 - unrest / 420, 0.45, 1.45);
    const grainFactor = clamp(0.95 + (nextMorale - 50) / 240 - (nextDisaster - 50) / 210 - unrest / 480, 0.5, 1.5);
    const recruitFactor = clamp(0.9 + (nextMorale - 50) / 300 + (partyStrife / 800) - (nextDisaster - 50) / 260, 0.45, 1.35);

    const nextTaxSilver = Math.max(0, Math.round(baseTaxSilver * taxFactor));
    const nextTaxGrain = Math.max(0, Math.round(baseTaxGrain * grainFactor));
    const nextRecruits = Math.max(0, Math.round(baseRecruits * recruitFactor));

    const nextItem = {
      ...p,
      morale: nextMorale,
      corruption: nextCorruption,
      disaster: nextDisaster,
      taxSilver: nextTaxSilver,
      taxGrain: nextTaxGrain,
      recruits: nextRecruits,
      __baseTaxSilver: baseTaxSilver,
      __baseTaxGrain: baseTaxGrain,
      __baseRecruits: baseRecruits,
    };
    next[name] = nextItem;

    if (
      nextMorale !== morale ||
      nextCorruption !== corruption ||
      nextDisaster !== disaster ||
      nextTaxSilver !== p.taxSilver ||
      nextTaxGrain !== p.taxGrain ||
      nextRecruits !== p.recruits
    ) {
      changed = true;
    }
  });

  return changed ? next : null;
}

function extractHostileTargetsFromText(choiceText, hostileForces) {
  const text = String(choiceText || "");
  const active = (hostileForces || []).filter((item) => !item.isDefeated);
  const targets = [];
  active.forEach((item) => {
    const aliases = [item.name, item.leader].filter(Boolean);
    if (aliases.some((name) => text.includes(name))) {
      targets.push(item.id);
    }
  });
  if (targets.length) return targets;
  if (!/征讨|北伐|平叛|开拓|讨伐|灭|剿|出师|围剿/.test(text)) return [];
  const sorted = active.slice().sort((a, b) => (b.power || 0) - (a.power || 0));
  return sorted.slice(0, 1).map((item) => item.id);
}

function mergeUniqueStrings(a, b) {
  const set = new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
  return Array.from(set);
}

export function resolveHostileForcesAfterChoice(state, choiceText, effects, year, month) {
  const hostileForces = Array.isArray(state.hostileForces) ? state.hostileForces : [];
  if (!hostileForces.length) return null;

  const tags = parseChoiceTags(choiceText);
  const nextHostiles = hostileForces.map((item) => ({ ...item }));
  const damageMap = parseHostileDamageFromEffects(effects);
  const inferredTargets = extractHostileTargetsFromText(choiceText, nextHostiles);

  if (!Object.keys(damageMap).length && !tags.military && !inferredTargets.length) {
    return null;
  }

  const militaryLevel = state.playerAbilities?.military || 0;
  const balance = getBalanceFromState(state);
  const policyBonus = getPolicyBonusSummary(state.unlockedPolicies || [], balance);
  const baseDamage = clamp(
    balance.military.baseDamageBase + militaryLevel * balance.military.baseDamagePerLevel + policyBonus.militaryDamageFlat,
    balance.military.baseDamageMin,
    balance.military.baseDamageMax
  );
  const effectsPatch = { militaryStrength: -2 };
  let prestigeDelta = 0;
  const news = [];
  const defeatedTags = [];
  const failureByText = isMilitaryFailureText(choiceText, effects);

  nextHostiles.forEach((force) => {
    if (force.isDefeated) return;
    let damage = 0;

    for (const [key, value] of Object.entries(damageMap)) {
      if (key === force.id || key === force.name || key === force.leader) {
        damage += value;
      }
    }
    if (!damage && inferredTargets.includes(force.id)) {
      damage = baseDamage;
    }
    if (!damage) return;

    const failByDamage = damage < 0;
    const actualFail = failByDamage || failureByText;

    if (actualFail) {
      const rebound = Math.max(2, Math.round(Math.abs(damage) * 0.7));
      force.power = clamp((force.power || 0) + rebound, 0, 100);
      force.status = `朝廷攻势受挫，${force.name}趁势反扑，势力值升至 ${force.power}/100。`;
      effectsPatch.borderThreat = (effectsPatch.borderThreat || 0) + Math.max(2, Math.round(rebound / 3));
      effectsPatch.civilMorale = (effectsPatch.civilMorale || 0) - 2;
      news.push({
        title: `军事开拓受挫：${force.name}反扑`,
        summary: `本回合对${force.name}打击失利，敌势回升 ${rebound} 点，当前势力值 ${force.power}/100。`,
        tag: "急",
        icon: "⚠️",
      });
      return;
    }

    force.power = clamp((force.power || 0) - damage, 0, 100);
    force.status = force.power <= 0
      ? "已被朝廷彻底剿灭，余部星散。"
      : `遭受朝廷打击，势力值降至 ${force.power}/100。`;

    effectsPatch.borderThreat = (effectsPatch.borderThreat || 0) - Math.max(2, Math.round(damage / 4));
    news.push({
      title: `军事开拓：打击${force.name}`,
      summary: `本回合对${force.name}造成 ${damage} 点打击，当前势力值 ${force.power}/100。`,
      tag: "重",
      icon: "⚔️",
    });

    if (force.power <= 0) {
      force.isDefeated = true;
      force.defeatedYear = year || null;
      force.defeatedMonth = month || null;
      effectsPatch.civilMorale = (effectsPatch.civilMorale || 0) + 6;
      prestigeDelta += 4;
      defeatedTags.push(force.storylineTag || buildStorylineTag(force.name));
      news.push({
        title: `${force.name}灭亡`,
        summary: `敌对势力“${force.name}”已灭亡，与其相关的故事线已自动闭锁。`,
        tag: "急",
        icon: "🏴",
      });
    }
  });

  if (!news.length) return null;

  const aliveCount = nextHostiles.filter((item) => !item.isDefeated).length;
  if (aliveCount === 0) {
    news.push({
      title: "外患阶段性肃清",
      summary: "主要敌对势力已被清剿，朝廷可转向内政修复与长治。",
      tag: "重",
      icon: "🛡️",
    });
  }

  return {
    statePatch: {
      hostileForces: nextHostiles,
      closedStorylines: mergeUniqueStrings(state.closedStorylines, defeatedTags),
      systemNewsToday: [...(state.systemNewsToday || []), ...news],
    },
    effectsPatch,
    prestigeDelta,
  };
}

export function scaleEffectsByExecution(effects, state) {
  if (!effects) return effects;
  const politicsLevel = state.playerAbilities?.politics || 0;
  const balance = getBalanceFromState(state);
  const policyBonus = getPolicyBonusSummary(state.unlockedPolicies || [], balance);
  const effectiveExecution = clamp(
    computeExecutionRate(state.prestige, balance.executionRate) + politicsLevel * 2 + policyBonus.executionRateBonus,
    35,
    balance.executionRate.finalCap
  );
  const ratio = clamp(effectiveExecution / 100, 0.35, 1);
  if (ratio >= 0.99) return effects;

  const scaled = {};
  for (const [key, value] of Object.entries(effects)) {
    if (key === "hostileDamage" && value && typeof value === "object") {
      const hostileDamage = {};
      for (const [target, delta] of Object.entries(value)) {
        if (typeof delta !== "number") continue;
        hostileDamage[target] = roundScaled(delta, ratio);
      }
      scaled.hostileDamage = hostileDamage;
      continue;
    }
    if (key === "loyalty" && value && typeof value === "object") {
      const loyalty = {};
      for (const [id, delta] of Object.entries(value)) {
        if (typeof delta !== "number") continue;
        loyalty[id] = roundScaled(delta, ratio);
      }
      scaled.loyalty = loyalty;
      continue;
    }
    if (typeof value === "number") {
      scaled[key] = roundScaled(value, ratio);
    }
  }
  return scaled;
}

function derivePrestigeDelta(choiceText, effects) {
  const tags = parseChoiceTags(choiceText);
  let delta = 0;
  if (tags.relief) delta += 5;
  if (tags.reform) delta += 4;
  if (tags.military && (effects?.militaryStrength || 0) > 0) delta += 3;
  if (tags.antiEunuch) delta += 6;
  if (tags.tax) delta -= 4;
  if (tags.emergency) delta -= 8;
  if ((effects?.civilMorale || 0) > 0) delta += Math.min(4, Math.round((effects.civilMorale || 0) / 3));
  if ((effects?.civilMorale || 0) < 0) delta += Math.max(-6, Math.round((effects.civilMorale || 0) / 2));
  if ((effects?.corruptionLevel || 0) < 0) delta += 3;
  return delta;
}

function deriveFactionSupport(state, choiceText, effects) {
  const support = { ...(state.factionSupport || {}) };
  const tags = parseChoiceTags(choiceText);
  const add = (id, value) => {
    support[id] = clamp((support[id] || 50) + value, 0, 100);
  };

  if (tags.relief) {
    add("donglin", 5);
    add("neutral", 2);
  }
  if (tags.reform) {
    add("donglin", 4);
    add("neutral", 3);
    add("eunuch", -4);
  }
  if (tags.tax) {
    add("military", 4);
    add("donglin", -6);
    add("neutral", -2);
  }
  if (tags.military) {
    add("military", 6);
    add("imperial", 2);
  }
  if (tags.emergency) {
    add("eunuch", 3);
    add("donglin", -4);
    add("imperial", -2);
  }
  if (tags.antiEunuch) {
    add("eunuch", -10);
    add("donglin", 6);
    add("imperial", 2);
  }
  if ((effects?.loyalty && typeof effects.loyalty === "object")) {
    let positive = 0;
    let negative = 0;
    for (const delta of Object.values(effects.loyalty)) {
      if (typeof delta !== "number") continue;
      if (delta > 0) positive += delta;
      if (delta < 0) negative += Math.abs(delta);
    }
    if (positive > negative) add("imperial", 2);
    if (negative > positive) add("neutral", -2);
  }
  return support;
}

function computePartyStrife(support, currentValue, partyStrifeConfig) {
  const cfg = { ...DEFAULT_BALANCE_CONFIG.partyStrife, ...(partyStrifeConfig || {}) };
  const values = Object.values(support || {});
  if (!values.length) return currentValue || 60;
  const spread = Math.max(...values) - Math.min(...values);
  return clamp(Math.round((currentValue || 60) * cfg.currentWeight + spread * cfg.spreadWeight), 0, 100);
}

function buildSystemPublicOpinion(state) {
  const opinions = [];
  if ((state.prestige || 0) >= 75) {
    opinions.push({ source: "京城士民", user: "京城士民", text: "陛下威望渐振，朝令比先前更能落地。", type: "loyal" });
  } else if ((state.prestige || 0) <= 45) {
    opinions.push({ source: "地方百姓", user: "地方百姓", text: "朝廷政令多有迟滞，民间对官府愈发不信。", type: "angry" });
  }
  if ((state.partyStrife || 0) > 70) {
    opinions.push({ source: "朝野议论", user: "朝野议论", text: "党争已近白热化，朝臣互相攻讦，国事被拖累。", type: "neutral" });
  }
  if ((state.unrest || 0) > 20) {
    opinions.push({ source: "地方乡绅", user: "地方乡绅", text: "地方动乱渐起，乡里都在盼朝廷早定赈抚之策。", type: "angry" });
  }
  return opinions;
}

function buildSystemNews(state, quarterAgenda, resolvedConsequences) {
  const news = [];
  if (quarterAgenda.length) {
    news.push({
      title: "季度奏折入直",
      summary: `本季议题共 ${quarterAgenda.length} 项，重点围绕${quarterAgenda.slice(0, 3).map((item) => item.title).join("、")}展开。`,
      tag: "重",
      icon: "📜",
    });
  }
  if ((state.executionRate || 0) <= 50) {
    news.push({
      title: "政令执行受阻",
      summary: "威望偏低，多数政令只能部分落地，地方执行明显迟滞。",
      tag: "急",
      icon: "⚠️",
    });
  }
  resolvedConsequences.forEach((item) => {
    news.push({ title: item.title, summary: item.summary, tag: "重", icon: "🧭" });
  });
  return news;
}

export function processCoreGameplayTurn(state, choiceText, effectiveEffects, nextYear, nextMonth) {
  const balance = getBalanceFromState(state);
  const policyBonus = getPolicyBonusSummary(state.unlockedPolicies || [], balance);
  const focus = state.currentQuarterFocus || null;
  const selectedAgenda = focus ? (state.currentQuarterAgenda || []).find((item) => item.id === focus.agendaId) : null;
  const agendaAdjust = deriveAgendaImpactAdjustment(focus, selectedAgenda);
  const prestigeBase = derivePrestigeDelta(choiceText, effectiveEffects);
  let focusPrestige = 0;
  let focusStrifeDelta = 0;
  const focusFactionDelta = {};
  if (focus) {
    if (focus.stance === "support") focusPrestige += 2;
    if (focus.stance === "compromise") focusPrestige += 1;
    if (focus.stance === "oppose") focusPrestige -= 1;
    if (focus.stance === "suppress") {
      focusPrestige -= 2;
      focusStrifeDelta += 5;
    }
    if (focus.factionId) {
      focusFactionDelta[focus.factionId] = 4;
    }
  } else if ((state.currentQuarterAgenda || []).length && (state.currentMonth || 1) % 3 === 0) {
    focusPrestige -= 4;
    focusStrifeDelta += 6;
  }

  const prestige = clamp((state.prestige || 58) + prestigeBase + focusPrestige + agendaAdjust.prestigeDelta, 0, 100);
  const politicsLevel = state.playerAbilities?.politics || 0;
  const executionRate = clamp(
    computeExecutionRate(prestige, balance.executionRate) + politicsLevel * 2 + policyBonus.executionRateBonus,
    35,
    balance.executionRate.finalCap
  );
  const factionSupport = deriveFactionSupport(state, choiceText, effectiveEffects);
  for (const [id, value] of Object.entries(focusFactionDelta)) {
    factionSupport[id] = clamp((factionSupport[id] || 50) + value, 0, 100);
  }

  let taxPressure = clamp(state.taxPressure || 50, 0, 100);
  const tags = parseChoiceTags(choiceText);
  if (tags.tax) taxPressure += 10;
  if (tags.relief) taxPressure -= 8;
  if (tags.reform) taxPressure -= 4;
  taxPressure += agendaAdjust.taxPressureDelta;
  taxPressure = clamp(taxPressure + policyBonus.taxPressureOffset, 0, 100);

  let unrest = clamp(state.unrest || 18, 0, 100);
  unrest = clamp(unrest + (taxPressure >= 65 ? 5 : 0) + ((effectiveEffects?.civilMorale || 0) < 0 ? 4 : 0) - ((effectiveEffects?.civilMorale || 0) > 0 ? 3 : 0) + policyBonus.unrestDelta, 0, 100);
  unrest = clamp(unrest + agendaAdjust.unrestDelta, 0, 100);
  if ((state.nation?.disasterLevel || 0) > 70) unrest = clamp(unrest + 3, 0, 100);

  const politicsReduction = clamp(policyBonus.politicsReduction + politicsLevel, 0, balance.politicsReductionTotalCap);
  const partyStrife = clamp(computePartyStrife(factionSupport, state.partyStrife, balance.partyStrife) + focusStrifeDelta + agendaAdjust.strifeDelta - politicsReduction, 0, 100);

  const serial = monthSerial(nextYear, nextMonth);
  const scheduled = scheduleConsequences(choiceText, nextYear, nextMonth);
  const resolvedConsequences = [];
  const pendingConsequences = [];
  let consequenceEffects = null;
  const consequenceFactionDelta = {};
  const consequenceOpinions = [];

  const addEffect = (effects) => {
    if (!effects) return;
    if (!consequenceEffects) consequenceEffects = {};
    for (const [key, value] of Object.entries(effects)) {
      if (typeof value !== "number") continue;
      consequenceEffects[key] = (consequenceEffects[key] || 0) + value;
    }
  };

  for (const item of [...(state.pendingConsequences || []), ...scheduled]) {
    if ((item.dueSerial || 0) <= serial) {
      resolvedConsequences.push(item);
      addEffect(item.effects);
      if (item.publicOpinion) consequenceOpinions.push(item.publicOpinion);
      if (item.factionSupport) {
        for (const [id, value] of Object.entries(item.factionSupport)) {
          if (typeof value !== "number") continue;
          consequenceFactionDelta[id] = (consequenceFactionDelta[id] || 0) + value;
        }
      }
    } else {
      pendingConsequences.push(item);
    }
  }

  for (const [id, value] of Object.entries(consequenceFactionDelta)) {
    factionSupport[id] = clamp((factionSupport[id] || 50) + value, 0, 100);
  }

  const quarterAgenda = nextMonth % 3 === 0
    ? buildQuarterAgenda({ ...state, prestige, executionRate, factionSupport, partyStrife, unrest, taxPressure })
    : [];

  const quarterReward = nextMonth % 3 === 0 ? 1 : 0;

  const nextState = {
    prestige,
    executionRate,
    factionSupport,
    partyStrife,
    unrest,
    taxPressure,
    pendingConsequences,
    currentQuarterAgenda: quarterAgenda,
    currentQuarterFocus: null,
    abilityPoints: (state.abilityPoints || 0) + quarterReward,
    policyPoints: (state.policyPoints || 0) + quarterReward,
    systemPublicOpinion: [...buildSystemPublicOpinion({ ...state, prestige, partyStrife, unrest }), ...consequenceOpinions],
  };
  const nextProvinceStats = evolveProvinceStats({ ...state, unrest, partyStrife });
  if (nextProvinceStats) {
    nextState.provinceStats = nextProvinceStats;
  }
  nextState.systemNewsToday = buildSystemNews(nextState, quarterAgenda, resolvedConsequences);

  if (quarterReward > 0) {
    nextState.systemNewsToday.unshift({
      title: "皇权成长",
      summary: "季度政务结算完成，获得 1 点能力点与 1 点国策点，可前往国家面板分配。",
      tag: "重",
      icon: "⭐",
    });
  }

  return {
    statePatch: nextState,
    consequenceEffects,
  };
}