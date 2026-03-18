import { router } from "../router.js";
import { getState } from "../state.js";
import { loadJSON } from "../dataLoader.js";
import { getStatBarClass, formatTreasury, formatGrain } from "../systems/nationSystem.js";

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
  const provinceStats = state.provinceStats || {};
  const externalPowers = state.externalPowers || {};

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

  // ── 外部势力(折叠) ──
  if (nationInitCache && nationInitCache.externalThreats) {
    const threatSection = createFoldSection("外部势力", (body) => {
      nationInitCache.externalThreats.forEach((t) => {
        const id = t.id || t.name;
        const powerValue = id ? externalPowers[id] : undefined;
        const power = typeof powerValue === "number" ? Math.max(0, Math.min(100, powerValue)) : 100;
        if (power <= 0) {
          // 势力条清零视为势力消失，不再展示
          return;
        }

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

        const barWrap = document.createElement("div");
        barWrap.className = "nation-stat-bar";
        const barInner = document.createElement("div");
        barInner.className = "nation-stat-bar-inner";
        barInner.style.width = power + "%";
        barWrap.appendChild(barInner);

        const powerText = document.createElement("div");
        powerText.className = "nation-stat-value";
        powerText.textContent = `势力：${power}/100`;

        cardBody.appendChild(powerText);
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
    renderNationView(container);
  });
}

registerNationView();
