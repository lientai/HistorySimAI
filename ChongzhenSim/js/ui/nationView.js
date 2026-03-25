import { router } from "../router.js";
import { getState, setState } from "../state.js";
import { loadJSON } from "../dataLoader.js";
import { getStatBarClass } from "../systems/nationSystem.js";
import { PLAYER_ABILITY_KEYS, getPolicyCatalog, spendAbilityPoint, unlockPolicy } from "../systems/coreGameplaySystem.js";
import { formatDisplayMetricValue, getDisplayMetricBarValue, getDisplayMetricsBySection } from "../utils/displayStateMetrics.js";

let nationInitCache = null;
let provinceRulesCache = null;

const DEFAULT_PROVINCE_RULES = {
  regionRules: [
    {
      namePattern: "辽东",
      default: { threat: "critical", status: "后金压力犹存，关宁防线需持续戒备。" },
      states: [
        {
          whenAny: [
            { metric: "borderThreat", op: ">=", value: 75 },
            { metric: "militaryStrength", op: "<=", value: 45 },
          ],
          threat: "critical",
          status: "关宁防线告急，敌情频仍，需尽快补饷增援。",
        },
        {
          whenAll: [
            { metric: "borderThreat", op: "<=", value: 45 },
            { metric: "militaryStrength", op: ">=", value: 65 },
          ],
          threat: "medium",
          status: "边防暂稳，但仍需持续警戒后金动向。",
        },
      ],
    },
    {
      namePattern: "陕西|河南",
      default: { threat: "high", status: "灾情与流民问题仍需持续处置。" },
      states: [
        {
          whenAny: [
            { metric: "disasterLevel", op: ">=", value: 70 },
            { metric: "civilMorale", op: "<=", value: 40 },
            { metric: "unrest", op: ">=", value: 30 },
          ],
          threat: "high",
          status: "灾情与流民压力并存，若赈济不足将迅速恶化。",
        },
        {
          whenAll: [
            { metric: "disasterLevel", op: "<=", value: 45 },
            { metric: "civilMorale", op: ">=", value: 55 },
          ],
          threat: "medium",
          status: "灾情有所缓解，地方秩序逐步恢复。",
        },
      ],
    },
    {
      namePattern: "山东",
      default: { threat: "medium", status: "军务可控，但需防局部哗变反复。" },
      states: [
        {
          whenAny: [
            { metric: "militaryStrength", op: "<=", value: 50 },
            { metric: "unrest", op: ">=", value: 28 },
          ],
          threat: "high",
          status: "军纪与饷银压力偏高，兵变隐患仍在。",
        },
      ],
    },
    {
      namePattern: "江南|湖广",
      default: { threat: "low", status: "税粮产出稳定，仍是朝廷主要财赋支撑。" },
      states: [
        {
          whenAny: [
            { metric: "treasury", op: "<=", value: 250000 },
            { metric: "corruptionLevel", op: ">=", value: 70 },
          ],
          threat: "medium",
          status: "赋税与漕运承压，财政回流效率下降。",
        },
      ],
    },
    {
      namePattern: "四川",
      default: { threat: "low", status: "整体安稳，可作为战略后方调度区域。" },
      states: [
        {
          whenAny: [{ metric: "unrest", op: ">=", value: 35 }],
          threat: "medium",
          status: "地方治安波动，需要提前防范土司与流民联动。",
        },
      ],
    },
  ],
};

function createFoldSection(title, renderBody) {
  const section = document.createElement("div");
  section.className = "fold-section";

  const header = document.createElement("div");
  header.className = "fold-header";
  const headerText = document.createElement("span");
  headerText.textContent = title;
  const arrow = document.createElement("span");
  arrow.className = "fold-arrow";
  arrow.textContent = "▶";
  header.appendChild(headerText);
  header.appendChild(arrow);

  const body = document.createElement("div");
  body.className = "fold-body";

  header.addEventListener("click", () => {
    section.classList.toggle("fold-section--open");
  });

  renderBody(body);

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

function getProvinceRuntimeMetrics(state) {
  const nation = state.nation || {};
  return {
    unrest: state.unrest || 0,
    civilMorale: nation.civilMorale || 50,
    disasterLevel: nation.disasterLevel || 50,
    borderThreat: nation.borderThreat || 50,
    militaryStrength: nation.militaryStrength || 50,
    treasury: nation.treasury || 0,
    corruptionLevel: nation.corruptionLevel || 50,
  };
}

function evaluateProvinceCondition(condition, metrics) {
  if (!condition || typeof condition !== "object") return false;
  const { metric, op, value } = condition;
  if (!metric || typeof op !== "string") return false;
  const actual = metrics[metric];
  if (typeof actual !== "number" || typeof value !== "number") return false;

  if (op === ">") return actual > value;
  if (op === ">=") return actual >= value;
  if (op === "<") return actual < value;
  if (op === "<=") return actual <= value;
  if (op === "==") return actual === value;
  if (op === "!=") return actual !== value;
  return false;
}

function evaluateProvinceStateRule(stateRule, metrics) {
  if (!stateRule || typeof stateRule !== "object") return false;
  const whenAll = Array.isArray(stateRule.whenAll) ? stateRule.whenAll : [];
  const whenAny = Array.isArray(stateRule.whenAny) ? stateRule.whenAny : [];
  if (!whenAll.length && !whenAny.length) return true;
  const allPass = whenAll.every((c) => evaluateProvinceCondition(c, metrics));
  const anyPass = whenAny.length ? whenAny.some((c) => evaluateProvinceCondition(c, metrics)) : true;
  return allPass && anyPass;
}

function matchProvinceRegionRule(provinceName, regionRule) {
  if (!regionRule || typeof regionRule !== "object") return false;
  const pattern = regionRule.namePattern;
  if (typeof pattern !== "string" || !pattern.trim()) return false;
  try {
    const regexp = new RegExp(pattern);
    return regexp.test(provinceName || "");
  } catch {
    return false;
  }
}

function deriveProvinceRuntimeState(province, state) {
  const metrics = getProvinceRuntimeMetrics(state);
  const rulesSource = provinceRulesCache && Array.isArray(provinceRulesCache.regionRules)
    ? provinceRulesCache
    : DEFAULT_PROVINCE_RULES;
  const regionRules = Array.isArray(rulesSource.regionRules) ? rulesSource.regionRules : [];

  const matchedRegionRule = regionRules.find((rule) => matchProvinceRegionRule(province.name || "", rule));
  if (!matchedRegionRule) {
    return {
      threat: province.threat || "medium",
      status: province.status || "暂无情报",
    };
  }

  const states = Array.isArray(matchedRegionRule.states) ? matchedRegionRule.states : [];
  const matchedState = states.find((rule) => evaluateProvinceStateRule(rule, metrics));
  if (matchedState) {
    return {
      threat: matchedState.threat || matchedRegionRule.default?.threat || province.threat || "medium",
      status: matchedState.status || matchedRegionRule.default?.status || province.status || "暂无情报",
    };
  }

  return {
    threat: matchedRegionRule.default?.threat || province.threat || "medium",
    status: matchedRegionRule.default?.status || province.status || "暂无情报",
  };
}

function renderNationView(container) {
  const state = getState();
  const factionSupport = state.factionSupport || {};
  const quarterAgenda = state.currentQuarterAgenda || [];
  const provinceStats = state.provinceStats || {};

  const root = document.createElement("div");
  root.className = "nation-root";

  // ── 国家概况 ──
  const overview = document.createElement("div");
  overview.className = "nation-overview";

  const overviewTitle = document.createElement("div");
  overviewTitle.className = "nation-overview-title";
  overviewTitle.textContent = "大明国势";
  overview.appendChild(overviewTitle);

  const statsGrid = document.createElement("div");
  statsGrid.className = "nation-stats-grid";

  const stats = getDisplayMetricsBySection("nation").map((metric) => ({
    label: metric.label,
    icon: metric.icon,
    value: formatDisplayMetricValue(state, metric.key),
    barValue: getDisplayMetricBarValue(state, metric.key),
    invert: metric.invert,
  }));

  stats.forEach((s) => {
    const item = document.createElement("div");
    item.className = "nation-stat-item";

    const label = document.createElement("div");
    label.className = "nation-stat-label";
    label.textContent = `${s.icon} ${s.label}`;

    const value = document.createElement("div");
    value.className = "nation-stat-value";
    value.textContent = s.value;

    const bar = document.createElement("div");
    bar.className = "nation-stat-bar";
    const barInner = document.createElement("div");
    barInner.className = "nation-stat-bar-inner " + getStatBarClass(s.barValue, s.invert);
    barInner.style.width = Math.min(100, s.barValue) + "%";
    bar.appendChild(barInner);

    item.appendChild(label);
    item.appendChild(value);
    item.appendChild(bar);
    statsGrid.appendChild(item);
  });

  overview.appendChild(statsGrid);
  root.appendChild(overview);

  const governance = document.createElement("div");
  governance.className = "nation-overview";
  const governanceTitle = document.createElement("div");
  governanceTitle.className = "nation-overview-title";
  governanceTitle.textContent = "朝局总览";
  governance.appendChild(governanceTitle);

  const governanceGrid = document.createElement("div");
  governanceGrid.className = "nation-stats-grid";
  getDisplayMetricsBySection("governance").map((metric) => ({
    label: metric.label,
    icon: metric.icon,
    value: formatDisplayMetricValue(state, metric.key),
    barValue: getDisplayMetricBarValue(state, metric.key),
    invert: metric.invert,
  })).forEach((s) => {
    const item = document.createElement("div");
    item.className = "nation-stat-item";
    const label = document.createElement("div");
    label.className = "nation-stat-label";
    label.textContent = `${s.icon} ${s.label}`;
    const value = document.createElement("div");
    value.className = "nation-stat-value";
    value.textContent = s.value;
    const bar = document.createElement("div");
    bar.className = "nation-stat-bar";
    const barInner = document.createElement("div");
    barInner.className = "nation-stat-bar-inner " + getStatBarClass(s.barValue, s.invert);
    barInner.style.width = Math.min(100, s.barValue) + "%";
    bar.appendChild(barInner);
    item.appendChild(label);
    item.appendChild(value);
    item.appendChild(bar);
    governanceGrid.appendChild(item);
  });
  governance.appendChild(governanceGrid);
  root.appendChild(governance);

  const factionSection = createFoldSection("派系支持度", (body) => {
    (state.factions || []).forEach((faction) => {
      const card = document.createElement("div");
      card.className = "nation-card";
      const icon = document.createElement("div");
      icon.className = "nation-card-icon";
      icon.textContent = "🏛️";
      const cardBody = document.createElement("div");
      cardBody.className = "nation-card-body";
      const titleEl = document.createElement("div");
      titleEl.className = "nation-card-title";
      titleEl.textContent = `${faction.name} · ${factionSupport[faction.id] || 0}/100`;
      const summaryEl = document.createElement("div");
      summaryEl.className = "nation-card-summary";
      summaryEl.textContent = faction.stance || faction.description || "";
      cardBody.appendChild(titleEl);
      cardBody.appendChild(summaryEl);
      card.appendChild(icon);
      card.appendChild(cardBody);
      body.appendChild(card);
    });
  });
  root.appendChild(factionSection);

  const agendaSection = createFoldSection("季度奏折", (body) => {
    if (!quarterAgenda.length) {
      const empty = document.createElement("div");
      empty.className = "nation-feed-empty";
      empty.textContent = "当前无季度核心议题，推进至季度月后将生成 3-5 条时政议题。";
      body.appendChild(empty);
      return;
    }
    quarterAgenda.forEach((item) => {
      const card = document.createElement("div");
      card.className = "nation-card";
      const icon = document.createElement("div");
      icon.className = "nation-card-icon";
      icon.textContent = "📜";
      const cardBody = document.createElement("div");
      cardBody.className = "nation-card-body";
      const titleEl = document.createElement("div");
      titleEl.className = "nation-card-title";
      titleEl.textContent = item.title;
      const summaryEl = document.createElement("div");
      summaryEl.className = "nation-card-summary";
      summaryEl.textContent = `${item.summary} 关联：${(item.impacts || []).join("、")}`;
      cardBody.appendChild(titleEl);
      cardBody.appendChild(summaryEl);
      card.appendChild(icon);
      card.appendChild(cardBody);
      body.appendChild(card);
    });
  });
  root.appendChild(agendaSection);

  const abilitySection = createFoldSection(`皇帝能力（可用点数 ${state.abilityPoints || 0}）`, (body) => {
    const abilityMeta = {
      management: { label: "管理", desc: "提升季度财政与粮储效率。" },
      military: { label: "军事", desc: "强化军事类诏书收益。" },
      scholarship: { label: "学识", desc: "提高改革与农政收益。" },
      politics: { label: "政治", desc: "提高执行率并缓和党争。" },
    };
    PLAYER_ABILITY_KEYS.forEach((key) => {
      const card = document.createElement("div");
      card.className = "nation-card";
      const cardBody = document.createElement("div");
      cardBody.className = "nation-card-body";
      const titleEl = document.createElement("div");
      titleEl.className = "nation-card-title";
      titleEl.textContent = `${abilityMeta[key].label} · Lv.${state.playerAbilities?.[key] || 0}`;
      const summaryEl = document.createElement("div");
      summaryEl.className = "nation-card-summary";
      summaryEl.textContent = abilityMeta[key].desc;
      cardBody.appendChild(titleEl);
      cardBody.appendChild(summaryEl);
      card.appendChild(cardBody);
      if ((state.abilityPoints || 0) > 0) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nation-mini-btn";
        btn.textContent = "加点";
        btn.addEventListener("click", () => {
          const patch = spendAbilityPoint(getState(), key);
          if (!patch) return;
          setState(patch);
          container.innerHTML = "";
          renderNationView(container);
        });
        card.appendChild(btn);
      }
      body.appendChild(card);
    });
  });
  root.appendChild(abilitySection);

  const policies = getPolicyCatalog();
  const policyTitleMap = Object.fromEntries(policies.map((item) => [item.id, item.title]));
  const policySection = createFoldSection(`国策树（可用点数 ${state.policyPoints || 0}）`, (body) => {
    policies.forEach((policy) => {
      const unlocked = (state.unlockedPolicies || []).includes(policy.id);
      const canUnlock = !unlocked && (state.policyPoints || 0) >= policy.cost && (policy.requires || []).every((id) => (state.unlockedPolicies || []).includes(id));
      const card = document.createElement("div");
      card.className = "nation-card";
      const cardBody = document.createElement("div");
      cardBody.className = "nation-card-body";
      const titleEl = document.createElement("div");
      titleEl.className = "nation-card-title";
      titleEl.textContent = `${policy.branch} · ${policy.title}${unlocked ? "（已实施）" : ""}`;
      const summaryEl = document.createElement("div");
      summaryEl.className = "nation-card-summary";
      const requiresText = (policy.requires || []).length
        ? ` 前置：${(policy.requires || []).map((id) => policyTitleMap[id] || id).join("、")}`
        : "";
      summaryEl.textContent = `${policy.description} 消耗 ${policy.cost} 点。${requiresText}`;
      cardBody.appendChild(titleEl);
      cardBody.appendChild(summaryEl);
      card.appendChild(cardBody);
      if (!unlocked) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nation-mini-btn" + (canUnlock ? "" : " nation-mini-btn--disabled");
        btn.textContent = canUnlock ? "实施" : "未满足";
        btn.disabled = !canUnlock;
        btn.addEventListener("click", () => {
          const patch = unlockPolicy(getState(), policy.id);
          if (!patch) return;
          setState(patch);
          container.innerHTML = "";
          renderNationView(container);
        });
        card.appendChild(btn);
      }
      body.appendChild(card);
    });
  });
  root.appendChild(policySection);

  const customPolicySection = createFoldSection(`自定义国策（${Array.isArray(state.customPolicies) ? state.customPolicies.length : 0}）`, (body) => {
    const customPolicies = Array.isArray(state.customPolicies) ? state.customPolicies : [];
    if (!customPolicies.length) {
      const empty = document.createElement("div");
      empty.className = "nation-feed-empty";
      empty.textContent = "尚未设立自定义国策。可在自拟诏书中写入“设立某机构定为国策”自动收录。";
      body.appendChild(empty);
      return;
    }
    const categoryText = {
      fiscal: "季度财政加成",
      agri: "季度粮储加成",
      military: "季度军务加成",
      governance: "执行与监察加成",
      general: "综合微幅加成",
    };
    customPolicies.forEach((policy) => {
      const card = document.createElement("div");
      card.className = "nation-card";
      const icon = document.createElement("div");
      icon.className = "nation-card-icon";
      icon.textContent = "🏛️";
      const cardBody = document.createElement("div");
      cardBody.className = "nation-card-body";
      const titleEl = document.createElement("div");
      titleEl.className = "nation-card-title";
      titleEl.textContent = policy.name;
      const summaryEl = document.createElement("div");
      summaryEl.className = "nation-card-summary";
      summaryEl.textContent = `${categoryText[policy.category] || categoryText.general} · 设立于崇祯${policy.createdYear || "?"}年${policy.createdMonth || "?"}月`;
      cardBody.appendChild(titleEl);
      cardBody.appendChild(summaryEl);
      card.appendChild(icon);
      card.appendChild(cardBody);
      body.appendChild(card);
    });
  });
  root.appendChild(customPolicySection);

  // ── 各省情况(折叠) ──
  if (nationInitCache && nationInitCache.provinces) {
    const provinceSection = createFoldSection("各省概况", (body) => {
      nationInitCache.provinces.forEach((p) => {
        const runtime = deriveProvinceRuntimeState(p, state);
        const card = document.createElement("div");
        card.className = "nation-card";
        card.style.padding = "8px";

        const cardBody = document.createElement("div");
        cardBody.className = "nation-card-body";
        const titleEl = document.createElement("div");
        titleEl.className = "nation-card-title";
        titleEl.textContent = p.name;
        const summaryEl = document.createElement("div");
        summaryEl.className = "nation-card-summary";
        summaryEl.textContent = runtime.status;

        const threatTag = document.createElement("span");
        threatTag.className = "nation-card-tag";
        const threatMap = { critical: "nation-card-tag--urgent", high: "nation-card-tag--important", medium: "nation-card-tag--normal", low: "nation-card-tag--normal" };
        const threatLabelMap = { critical: "危", high: "警", medium: "稳", low: "安" };
        threatTag.classList.add(threatMap[runtime.threat] || "nation-card-tag--normal");
        threatTag.textContent = threatLabelMap[runtime.threat] || "稳";

        cardBody.appendChild(titleEl);
        cardBody.appendChild(summaryEl);

        const ps = provinceStats[p.name] || {};
        const taxSilver = ps.taxSilver || 0;
        const taxGrain = ps.taxGrain || 0;
        const recruits = ps.recruits || 0;
        const morale = ps.morale != null ? ps.morale : 50;
        const corruption = ps.corruption != null ? ps.corruption : 50;
        const disaster = ps.disaster != null ? ps.disaster : 50;

        const statsRow = document.createElement("div");
        statsRow.className = "province-stats-row";

        function addTag(text, baseClass, extraClass) {
          const tag = document.createElement("span");
          tag.className = "province-tag " + baseClass + (extraClass ? " " + extraClass : "");
          tag.textContent = text;
          statsRow.appendChild(tag);
        }

        // 税收
        addTag(
          `税：${taxSilver.toLocaleString()}两 / ${taxGrain.toLocaleString()}石`,
          "province-tag--income"
        );

        // 兵源
        addTag(
          `兵：${recruits.toLocaleString()}人`,
          "province-tag--military"
        );

        // 民心（高好低差）
        let moraleLevel = "province-tag--neutral";
        if (morale >= 70) moraleLevel = "province-tag--good";
        else if (morale <= 40) moraleLevel = "province-tag--bad";
        addTag(`民心：${morale}/100`, "province-tag--morale", moraleLevel);

        // 贪腐（低好高差）
        let corrupLevel = "province-tag--neutral";
        if (corruption >= 70) corrupLevel = "province-tag--bad";
        else if (corruption <= 40) corrupLevel = "province-tag--good";
        addTag(`贪腐：${corruption}/100`, "province-tag--corruption", corrupLevel);

        // 天灾（低好高差）
        let disasterLevel = "province-tag--neutral";
        if (disaster >= 70) disasterLevel = "province-tag--bad";
        else if (disaster <= 40) disasterLevel = "province-tag--good";
        addTag(`天灾：${disaster}/100`, "province-tag--disaster", disasterLevel);

        cardBody.appendChild(statsRow);
        card.appendChild(threatTag);
        card.appendChild(cardBody);
        body.appendChild(card);
      });
    });
    root.appendChild(provinceSection);
  }

  // ── 敌对/外部势力(折叠) ──
  const hostileForces = Array.isArray(state.hostileForces) && state.hostileForces.length
    ? state.hostileForces
    : (nationInitCache && Array.isArray(nationInitCache.externalThreats) ? nationInitCache.externalThreats : []);
  if (hostileForces.length) {
    const threatSection = createFoldSection("敌对势力", (body) => {
      hostileForces.forEach((t) => {
        const power = typeof t.power === "number" ? Math.max(0, Math.min(100, t.power)) : 100;
        const card = document.createElement("div");
        card.className = "nation-card";
        if (t.isDefeated) {
          card.style.opacity = "0.82";
          card.style.borderStyle = "dashed";
        }

        const icon = document.createElement("div");
        icon.className = "nation-card-icon";
        icon.textContent = "⚔️";

        const cardBody = document.createElement("div");
        cardBody.className = "nation-card-body";
        const titleEl = document.createElement("div");
        titleEl.className = "nation-card-title";
        const defeatedText = t.isDefeated ? "（已灭亡）" : "";
        titleEl.textContent = `${t.name}（${t.leader || "未知"}）${defeatedText}`;
        const summaryEl = document.createElement("div");
        summaryEl.className = "nation-card-summary";
        const powerSummary = typeof power === "number" ? `势力值 ${power}/100` : "势力值未知";
        const closureHint = t.isDefeated ? " · 相关故事线已闭锁" : "";
        summaryEl.textContent = `${t.status || "暂无情报"} · ${powerSummary}${closureHint}`;
        cardBody.appendChild(titleEl);
        cardBody.appendChild(summaryEl);

        const barWrap = document.createElement("div");
        barWrap.className = "nation-stat-bar";
        const barInner = document.createElement("div");
        barInner.className = "nation-stat-bar-inner";
        barInner.style.width = power + "%";
        barWrap.appendChild(barInner);

        const powerValueText = document.createElement("div");
        powerValueText.className = "nation-stat-value";
        powerValueText.textContent = `势力：${power}/100`;

        cardBody.appendChild(powerValueText);
        cardBody.appendChild(barWrap);

        card.appendChild(icon);
        card.appendChild(cardBody);
        body.appendChild(card);
      });
    });
    root.appendChild(threatSection);
  }

  // ── 天下大事 Feed ──
  const feed = document.createElement("div");
  feed.className = "nation-feed";

  const feedHeader = document.createElement("div");
  feedHeader.className = "nation-feed-header";
  feedHeader.textContent = "天下大事";
  feed.appendChild(feedHeader);

  const news = state.newsToday || [];
  if (!news.length) {
    const empty = document.createElement("div");
    empty.className = "nation-feed-empty";
    empty.textContent = "暂无奏报，推进剧情后将产生新的军国大事。";
    feed.appendChild(empty);
  } else {
    news.forEach((item) => {
      const card = document.createElement("div");
      card.className = "nation-card";

      const icon = document.createElement("div");
      icon.className = "nation-card-icon";
      icon.textContent = item.icon || "📜";

      const cardBody = document.createElement("div");
      cardBody.className = "nation-card-body";

      const tagRow = document.createElement("div");
      tagRow.className = "nation-card-tag-row";
      if (item.tag) {
        const tag = document.createElement("span");
        tag.className = "nation-card-tag";
        if (item.tag === "急") tag.classList.add("nation-card-tag--urgent");
        else if (item.tag === "重") tag.classList.add("nation-card-tag--important");
        else tag.classList.add("nation-card-tag--normal");
        tag.textContent = item.tag;
        tagRow.appendChild(tag);
      }
      const titleSpan = document.createElement("span");
      titleSpan.className = "nation-card-title";
      titleSpan.textContent = item.title;
      tagRow.appendChild(titleSpan);
      cardBody.appendChild(tagRow);

      if (item.summary) {
        const summary = document.createElement("div");
        summary.className = "nation-card-summary";
        summary.textContent = item.summary;
        cardBody.appendChild(summary);
      }

      card.appendChild(icon);
      card.appendChild(cardBody);
      feed.appendChild(card);
    });
  }

  root.appendChild(feed);

  // ── 民间舆论 ──
  const opinions = document.createElement("div");
  opinions.className = "nation-opinions";

  const opinionsHeader = document.createElement("div");
  opinionsHeader.className = "nation-opinions-header";
  opinionsHeader.textContent = "民间舆论";
  opinions.appendChild(opinionsHeader);

  const publicOpinion = state.publicOpinion || [];
  if (!publicOpinion.length) {
    const empty = document.createElement("div");
    empty.className = "nation-feed-empty";
    empty.textContent = "暂无民间舆论。";
    opinions.appendChild(empty);
  } else {
    publicOpinion.forEach((c) => {
      const item = document.createElement("div");
      item.className = "nation-opinion-item";

      const user = document.createElement("span");
      const typeMap = { loyal: "nation-opinion-user--loyal", angry: "nation-opinion-user--angry", neutral: "nation-opinion-user--neutral" };
      user.className = "nation-opinion-user " + (typeMap[c.type] || "nation-opinion-user--neutral");
      user.textContent = c.user || "百姓";

      const text = document.createElement("span");
      text.className = "nation-opinion-text";
      text.textContent = c.text || "";

      item.appendChild(user);
      item.appendChild(text);
      opinions.appendChild(item);
    });
  }

  root.appendChild(opinions);
  container.appendChild(root);
}

export function registerNationView() {
  router.registerView("nation", async (container) => {
    if (!nationInitCache) {
      try {
        nationInitCache = await loadJSON("data/nationInit.json");
      } catch (e) {
        nationInitCache = {};
      }
    }
    if (!provinceRulesCache) {
      try {
        provinceRulesCache = await loadJSON("data/provinceRules.json");
      } catch (e) {
        provinceRulesCache = null;
      }
    }
    renderNationView(container);
  });
}

registerNationView();
