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

export function computeExecutionRate(prestige) {
  const score = typeof prestige === "number" ? prestige : 60;
  if (score >= 80) return 100;
  if (score >= 50) return clamp(70 + Math.round((score - 50) / 3), 70, 80);
  return clamp(50 - Math.round((50 - score) / 2), 35, 50);
}

export const PLAYER_ABILITY_KEYS = ["management", "military", "scholarship", "politics"];

export const POLICY_CATALOG = [
  { id: "civil_tax_relief", branch: "内政", title: "轻徭薄赋", cost: 1, requires: [], description: "降低税压并放大赈济收益。" },
  { id: "civil_reform", branch: "内政", title: "税制改革", cost: 1, requires: ["civil_tax_relief"], description: "提升季度财政稳定收益。" },
  { id: "military_border", branch: "军事", title: "守边固防", cost: 1, requires: [], description: "提升军务诏书的边防收益。" },
  { id: "military_firearms", branch: "军事", title: "火器革新", cost: 1, requires: ["military_border"], description: "进一步提高军事类决策的军力增益。" },
  { id: "politics_balance", branch: "政治", title: "派系制衡", cost: 1, requires: [], description: "降低党争蔓延速度，并提高执行率。" },
  { id: "politics_censor", branch: "政治", title: "密折监察", cost: 1, requires: ["politics_balance"], description: "降低贪腐与派系失控风险。" },
  { id: "tech_agri", branch: "科技", title: "农耕改良", cost: 1, requires: [], description: "提升季度粮储结算。" },
  { id: "tech_engineering", branch: "科技", title: "工程建设", cost: 1, requires: ["tech_agri"], description: "增强长期财政与工程效率。" },
];

export function getPolicyCatalog() {
  return POLICY_CATALOG;
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
  const unlocked = Array.isArray(state.unlockedPolicies) ? state.unlockedPolicies : [];
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
    military: /军饷|调兵|增兵|练兵|剿匪|边防|守关|火器|新军/.test(text),
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
  const unlocked = state.unlockedPolicies || [];
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
    const ratio = 1 + (abilities.military || 0) * 0.08 + (unlocked.includes("military_border") ? 0.1 : 0) + (unlocked.includes("military_firearms") ? 0.12 : 0);
    scaleField("militaryStrength", ratio, true);
    scaleField("borderThreat", ratio, false);
  }
  if (tags.relief || tags.reform) {
    const ratio = 1 + (abilities.scholarship || 0) * 0.08 + (unlocked.includes("civil_tax_relief") ? 0.08 : 0);
    scaleField("civilMorale", ratio, true);
    scaleField("disasterLevel", ratio, false);
    scaleField("corruptionLevel", unlocked.includes("politics_censor") ? ratio : 1, false);
  }
  if (tags.tax) {
    if (unlocked.includes("civil_tax_relief")) {
      scaleField("civilMorale", 0.8, false);
    }
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

  const pushAgenda = (id, title, summary, impacts) => {
    if (agenda.some((item) => item.id === id)) return;
    agenda.push({ id, title, summary, impacts });
  };

  if ((nation.treasury || 0) < 400000) {
    pushAgenda("fiscal_gap", "军饷与财政缺口", "财政已逼近红线，需尽快开源或节流。", ["财政", "军饷", "派系"]);
  }
  if ((nation.grain || 0) < 25000 || (nation.civilMorale || 0) < 50) {
    pushAgenda("relief_shaanxi", "陕西赈灾与安民", "粮储或民心偏低，应优先稳住流民与灾情。", ["民心", "粮储", "动乱"]);
  }
  if ((nation.militaryStrength || 0) < 60 || (nation.borderThreat || 0) > 65) {
    pushAgenda("frontier_defense", "关宁补饷与边防", "关外军务承压，若军饷不足将直接冲击守边。", ["军力", "边患", "财政"]);
  }
  if ((state.partyStrife || 0) > 70) {
    pushAgenda("faction_conflict", "终止党争", "党争已接近失控，需调岗与监察并用。", ["派系", "威望", "财政"]);
  }
  if ((state.unrest || 0) > 20) {
    pushAgenda("local_unrest", "地方动乱", "地方骚动蔓延，应结合剿匪与安抚同步处理。", ["动乱", "民心", "军力"]);
  }

  const stageDefaults = [
    { id: "purge_eunuch", title: "处置阉党残余", summary: "借威望整肃旧党，以稳朝纲。", impacts: ["威望", "派系"] },
    { id: "supply_army", title: "调拨军饷", summary: "优先稳住边军军心，避免关外先崩。", impacts: ["军力", "财政"] },
    { id: "balance_factions", title: "平衡派系", summary: "调和东林、阉党余部与中立派，压住党争。", impacts: ["派系", "执行"] },
  ];

  for (const item of stageDefaults) {
    if (agenda.length >= 5) break;
    pushAgenda(item.id, item.title, item.summary, item.impacts);
  }

  return agenda.slice(0, clamp(agenda.length, 3, 5));
}

export function initializeCoreGameplayState(currentState, factions, config) {
  const existingSupport = currentState.factionSupport || {};
  const factionSupport = {};
  (factions || []).forEach((faction) => {
    const value = existingSupport[faction.id];
    factionSupport[faction.id] = typeof value === "number" ? value : defaultFactionSupport(faction.id);
  });

  const prestige = typeof currentState.prestige === "number"
    ? currentState.prestige
    : ((config.coreGameplay && config.coreGameplay.initialPrestige) || 58);

  const nextState = {
    prestige,
    executionRate: computeExecutionRate(prestige),
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
    unlockedPolicies: Array.isArray(currentState.unlockedPolicies) ? currentState.unlockedPolicies : [],
    customPolicies: Array.isArray(currentState.customPolicies) ? currentState.customPolicies : [],
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

export function scaleEffectsByExecution(effects, state) {
  if (!effects) return effects;
  const politicsLevel = state.playerAbilities?.politics || 0;
  const hasBalancePolicy = (state.unlockedPolicies || []).includes("politics_balance");
  const ratio = clamp((computeExecutionRate(state.prestige) + politicsLevel * 2 + (hasBalancePolicy ? 4 : 0)) / 100, 0.35, 1);
  if (ratio >= 0.99) return effects;

  const scaled = {};
  for (const [key, value] of Object.entries(effects)) {
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

function computePartyStrife(support, currentValue) {
  const values = Object.values(support || {});
  if (!values.length) return currentValue || 60;
  const spread = Math.max(...values) - Math.min(...values);
  return clamp(Math.round((currentValue || 60) * 0.55 + spread * 0.7), 0, 100);
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
  const focus = state.currentQuarterFocus || null;
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

  const prestige = clamp((state.prestige || 58) + prestigeBase + focusPrestige, 0, 100);
  const politicsLevel = state.playerAbilities?.politics || 0;
  const executionRate = clamp(computeExecutionRate(prestige) + politicsLevel * 2 + ((state.unlockedPolicies || []).includes("politics_balance") ? 4 : 0), 35, 100);
  const factionSupport = deriveFactionSupport(state, choiceText, effectiveEffects);
  for (const [id, value] of Object.entries(focusFactionDelta)) {
    factionSupport[id] = clamp((factionSupport[id] || 50) + value, 0, 100);
  }

  let taxPressure = clamp(state.taxPressure || 50, 0, 100);
  const tags = parseChoiceTags(choiceText);
  if (tags.tax) taxPressure += 10;
  if (tags.relief) taxPressure -= 8;
  if (tags.reform) taxPressure -= 4;
  taxPressure = clamp(taxPressure, 0, 100);

  let unrest = clamp(state.unrest || 18, 0, 100);
  unrest = clamp(unrest + (taxPressure >= 65 ? 5 : 0) + ((effectiveEffects?.civilMorale || 0) < 0 ? 4 : 0) - ((effectiveEffects?.civilMorale || 0) > 0 ? 3 : 0), 0, 100);
  if ((state.nation?.disasterLevel || 0) > 70) unrest = clamp(unrest + 3, 0, 100);

  const politicsReduction = ((state.unlockedPolicies || []).includes("politics_censor") ? 6 : 0) + politicsLevel;
  const partyStrife = clamp(computePartyStrife(factionSupport, state.partyStrife) + focusStrifeDelta - politicsReduction, 0, 100);

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