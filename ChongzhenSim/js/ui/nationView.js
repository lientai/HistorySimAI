import { router } from "../router.js";
import { getState, setState } from "../state.js";
import { loadJSON } from "../dataLoader.js";
import { getStatBarClass, formatTreasury, formatGrain } from "../systems/nationSystem.js";
import { PLAYER_ABILITY_KEYS, getPolicyCatalog, spendAbilityPoint, unlockPolicy } from "../systems/coreGameplaySystem.js";

let nationInitCache = null;

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

function renderNationView(container) {
  const state = getState();
  const nation = state.nation || {};
  const factionSupport = state.factionSupport || {};
  const quarterAgenda = state.currentQuarterAgenda || [];

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

  const stats = [
    { label: "国库", icon: "💰", value: formatTreasury(nation.treasury || 0), barValue: Math.min(100, (nation.treasury || 0) / 10000), invert: false },
    { label: "粮储", icon: "🌾", value: formatGrain(nation.grain || 0), barValue: Math.min(100, (nation.grain || 0) / 500), invert: false },
    { label: "军力", icon: "⚔️", value: (nation.militaryStrength || 0) + "/100", barValue: nation.militaryStrength || 0, invert: false },
    { label: "民心", icon: "👥", value: (nation.civilMorale || 0) + "/100", barValue: nation.civilMorale || 0, invert: false },
    { label: "边患", icon: "🏴", value: (nation.borderThreat || 0) + "/100", barValue: nation.borderThreat || 0, invert: true },
    { label: "天灾", icon: "🌪️", value: (nation.disasterLevel || 0) + "/100", barValue: nation.disasterLevel || 0, invert: true },
    { label: "贪腐", icon: "🔗", value: (nation.corruptionLevel || 0) + "/100", barValue: nation.corruptionLevel || 0, invert: true },
  ];

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
  [
    { label: "威望", icon: "👑", value: (state.prestige || 0) + "/100", barValue: state.prestige || 0, invert: false },
    { label: "执行率", icon: "📘", value: (state.executionRate || 0) + "%", barValue: state.executionRate || 0, invert: false },
    { label: "党争", icon: "⚖️", value: (state.partyStrife || 0) + "/100", barValue: state.partyStrife || 0, invert: true },
    { label: "动乱", icon: "🔥", value: (state.unrest || 0) + "/100", barValue: state.unrest || 0, invert: true },
    { label: "税压", icon: "🧾", value: (state.taxPressure || 0) + "/100", barValue: state.taxPressure || 0, invert: true },
  ].forEach((s) => {
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
      const requiresText = (policy.requires || []).length ? ` 前置：${policy.requires.join("、")}` : "";
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
        summaryEl.textContent = p.status;

        const threatTag = document.createElement("span");
        threatTag.className = "nation-card-tag";
        const threatMap = { critical: "nation-card-tag--urgent", high: "nation-card-tag--important", medium: "nation-card-tag--normal", low: "nation-card-tag--normal" };
        const threatLabelMap = { critical: "危", high: "警", medium: "稳", low: "安" };
        threatTag.classList.add(threatMap[p.threat] || "nation-card-tag--normal");
        threatTag.textContent = threatLabelMap[p.threat] || "稳";

        cardBody.appendChild(titleEl);
        cardBody.appendChild(summaryEl);
        card.appendChild(threatTag);
        card.appendChild(cardBody);
        body.appendChild(card);
      });
    });
    root.appendChild(provinceSection);
  }

  // ── 外部势力(折叠) ──
  if (nationInitCache && nationInitCache.externalThreats) {
    const threatSection = createFoldSection("外部势力", (body) => {
      nationInitCache.externalThreats.forEach((t) => {
        const card = document.createElement("div");
        card.className = "nation-card";

        const icon = document.createElement("div");
        icon.className = "nation-card-icon";
        icon.textContent = "⚔️";

        const cardBody = document.createElement("div");
        cardBody.className = "nation-card-body";
        const titleEl = document.createElement("div");
        titleEl.className = "nation-card-title";
        titleEl.textContent = `${t.name}（${t.leader}）`;
        const summaryEl = document.createElement("div");
        summaryEl.className = "nation-card-summary";
        summaryEl.textContent = t.status;
        cardBody.appendChild(titleEl);
        cardBody.appendChild(summaryEl);

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
    renderNationView(container);
  });
}

registerNationView();
