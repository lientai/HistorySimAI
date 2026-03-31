import { buildHistoryCountdown } from "./history.js";
import { computeAssassinateRisk } from "./mechanisms.js";
import { getLatestMemoryAnchor } from "./memory.js";

function riskLevel(risk) {
  if (risk >= 70) return "极高";
  if (risk >= 40) return "高";
  if (risk >= 20) return "中";
  return "低";
}

function formatNumber(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function buildTragicPulse(rigidState, triggerEvents = []) {
  const resistance = Number(rigidState?.court?.resistance) || 0;
  const anxiety = Number(rigidState?.chongZhen?.anxiety) || 0;
  const assassinateRisk = computeAssassinateRisk(rigidState?.offendScores || {});
  const hasStrike = triggerEvents.some((event) => event.type === "strike");
  const hasAssassinate = triggerEvents.some((event) => event.type === "assassinate");

  if (hasStrike) {
    return {
      opening: "百官掩门不入，空殿回声，朕知号令已难尽出紫禁城。",
      closing: "朕欲扶危，奈体制反噬如潮，步步皆陷。",
    };
  }
  if (hasAssassinate || assassinateRisk >= 50) {
    return {
      opening: "禁门夜警不绝，朕每闻风声，疑刃已近御座。",
      closing: "侥幸未死，亦不过将覆亡之期再借一旬。",
    };
  }
  if (resistance >= 75 || anxiety >= 70) {
    return {
      opening: "章奏堆案，群臣同口而异心，朕知朝局已裂。",
      closing: "求治之心愈急，离心之势愈甚，天命似在远去。",
    };
  }
  return {
    opening: "朕临朝听政，诸司奏报纷纭，尚可维持表面秩序。",
    closing: "今日得失尚可记，然积弊未解，明日未必可继。",
  };
}

function formatHistoryEventLine(event) {
  if (!event) return "暂无";
  const eraYear = Math.max(1, (Number(event.trigger?.year) || 1627) - 1626);
  const month = Number(event.trigger?.month) || 1;
  const base = `崇祯${eraYear}年${month}月 · ${event.name}`;
  if (event.description) {
    return `${base}：${event.description}`;
  }
  return base;
}

function buildInformationCocoonContradiction(rigidState) {
  const resistance = Number(rigidState?.court?.resistance) || 0;
  const rebelScale = Number(rigidState?.military?.rebelScale) || 0;
  const anxiety = Number(rigidState?.chongZhen?.anxiety) || 0;

  if (rebelScale >= 45) {
    return "【信息茧房矛盾】六部称“流民已就抚、仓廪可支三月”；厂卫密报“乡勇哗散，饥民结队南下”。";
  }
  if (resistance >= 85) {
    return "【信息茧房矛盾】六部称“百官多愿复议，朝务可复”；厂卫密报“串联已成，今日入朝者寥寥”。";
  }
  if (anxiety >= 70) {
    return "【信息茧房矛盾】六部称“廷臣意见渐趋一致”；厂卫密报“言官夜聚抄录弹章，次日将群起攻讦”。";
  }
  return "【信息茧房矛盾】六部称“漕运回稳、民情可安”；厂卫密报“河道督催受阻，沿线骚动未平”。";
}

export function composeRigidModules(rigidState, context = {}) {
  const triggerEvents = Array.isArray(context.triggerEvents) ? context.triggerEvents : [];
  const historyEvents = Array.isArray(context.historyEvents) ? context.historyEvents : [];
  const historyCountdown = buildHistoryCountdown(rigidState, context.historyConfigs || []);
  const memory = getLatestMemoryAnchor(rigidState);
  const tragicPulse = buildTragicPulse(rigidState, triggerEvents);

  const assassinateRisk = computeAssassinateRisk(rigidState.offendScores);
  const module1 = [
    `【财政】国库 ${formatNumber(rigidState.finance.treasury)} / 内帑 ${formatNumber(rigidState.finance.innerFund)} / 军饷拖欠 ${formatNumber(rigidState.finance.militaryArrears)} / 官俸拖欠 ${formatNumber(rigidState.finance.officialArrears)}`,
    `【军事】辽东兵力 ${formatNumber(rigidState.military.liaoDongTroops)} / 军心 ${formatNumber(rigidState.military.liaoDongMorale)} / 流寇规模 ${formatNumber(rigidState.military.rebelScale)} / 后金态势 ${rigidState.military.qingTrend || "未知"}`,
    `【朝廷】权威 ${formatNumber(rigidState.court.authority)} / 党争 ${formatNumber(rigidState.court.factionFight)}（下限20） / 阻力 ${formatNumber(rigidState.court.resistance)}（下限15） / 封驳次数 ${formatNumber(rigidState.court.refuteTimes)}`,
    `【圣躬】焦虑 ${formatNumber(rigidState.chongZhen.anxiety)}（下限20） / 失眠 ${formatNumber(rigidState.chongZhen.insomnia)} / 暴露风险 ${formatNumber(rigidState.chongZhen.exposureRisk)} / 疑心 ${formatNumber(rigidState.chongZhen.distrust)}`,
  ];

  const module2 = [
    `【其一·临朝】${tragicPulse.opening}`,
    `【其二·圣断】本回合所断：${context.decisionText || "未下新旨"}`,
    `【其八·自述】${tragicPulse.closing}`,
  ];

  const module3 = [
    "【六部奏章】吏部：京察争执未息。",
    "【六部奏章】户部：请缓征并核减浮费。",
    "【六部奏章】礼部：请定名分以安士林。",
    "【六部奏章】兵部：催补辽饷与边兵器械。",
    "【六部奏章】刑部：请速断积案以平怨气。",
    "【六部奏章】工部：河工与城防并请增拨。",
    "【厂卫密报】京师舆情波动，流言渐盛。",
    buildInformationCocoonContradiction(rigidState),
    `【紧急军情】边报称敌情 ${rigidState.military.qingTrend || "未知"}。`,
  ];

  const module4 = [
    "内阁：主张折中执行（立场：稳妥）",
    "司礼监：建议加强监控（立场：集权）",
    "兵部：要求优先军费（立场：军务优先）",
    "户部：强调财政承压（立场：保守）",
    "都察院：警示党争反弹（立场：清议）",
  ];

  const module5 = [
    "【海外情报】荷兰商路仍可接触火器工艺，葡线转运尚可谈判。",
    "【可研技术】红夷炮改良、火药配比校正、漕运账册法、防疫隔离法、屯田清册法。",
    "【技术进度】受财政与党争制约，推进缓慢；跨时代技术默认禁用。",
  ];

  const module6 = historyCountdown.length
    ? historyCountdown.map((item) => {
      const cfg = (context.historyConfigs || []).find((event) => event.id === item.id);
      const detail = formatHistoryEventLine(cfg);
      return `${detail}；剩余 ${item.monthsLeft} 月（可变空间：${item.variableSpace}）`;
    })
    : ["核心历史节点已进入尾段。"];

  const module7 = [
    `【风险值】${formatNumber(assassinateRisk)}%（等级：${riskLevel(assassinateRisk)}）`,
    "【计算式】士绅×0.3 + 武将×0.2 + 太监×0.2 + 宗室×0.2 + 百姓×0.1",
    "【防御建议】降低多方同时得罪，避免连续高压改革。",
    "【保密规则】系统仅返回事件，不返回主谋身份。",
  ];

  const module8 = [
    memory
      ? "记忆锚点已写入本地存档（回合上下文、风险快照、时间戳）。"
      : "记忆锚点待生成（将随回合自动入档）。",
  ];

  return [
    { id: 1, title: "核心变量数值更新", lines: module1 },
    { id: 2, title: "叙事正文", lines: module2 },
    { id: 3, title: "时局动态反馈", lines: module3 },
    { id: 4, title: "内阁/司礼监建议", lines: module4 },
    { id: 5, title: "穿越者情报与技术进展", lines: module5 },
    { id: 6, title: "历史窗口倒计时", lines: module6 },
    { id: 7, title: "暗杀风险监控", lines: module7 },
    { id: 8, title: "记忆锚点", lines: module8 },
  ];
}

export function buildRigidStoryData(state, presets = []) {
  const rigid = state.rigid;
  const modules = Array.isArray(rigid?.lastOutput?.modules) && rigid.lastOutput.modules.length
    ? rigid.lastOutput.modules
    : composeRigidModules(rigid, {
      decisionText: rigid?.lastDecision?.text || "登极初政，观望局势",
      executionSummary: "等待本回合决策",
      hadRefute: false,
      reboundSummary: "未触发",
      triggerEvents: [],
      historyEvents: [],
      historyConfigs: [],
    });

  const lineText = (line) => String(line || "").replace(/^【[^】]+】\s*/, "").trim();
  const normalizeSentence = (text) => String(text || "")
    .replace(/^[；;，,。.!?\s]+/, "")
    .replace(/[；;，,。.!?\s]+$/, "")
    .trim();
  const toTwoSentenceParagraph = (label, lead, lines) => {
    const parts = (Array.isArray(lines) ? lines : [])
      .map((item) => normalizeSentence(item))
      .filter(Boolean);
    if (!parts.length) return "";
    return `${label}${normalizeSentence(lead)}。其详如次：${parts.join("；")}。`;
  };
  const getModule = (id) => modules.find((module) => module && module.id === id) || null;

  const module2 = getModule(2);
  const module3 = getModule(3);
  const module4 = getModule(4);
  const module5 = getModule(5);
  const module6 = getModule(6);
  const module7 = getModule(7);

  const narrative = Array.isArray(module2?.lines) ? module2.lines.map(lineText) : [];
  const situational = Array.isArray(module3?.lines) ? module3.lines.map(lineText) : [];
  const advice = Array.isArray(module4?.lines) ? module4.lines.map(lineText) : [];
  const intel = Array.isArray(module5?.lines) ? module5.lines.map(lineText) : [];
  const windows = Array.isArray(module6?.lines) ? module6.lines.map(lineText) : [];
  const risks = Array.isArray(module7?.lines) ? module7.lines.map(lineText) : [];

  const storyParagraphs = [];
  if (narrative.length >= 3) {
    const opening = narrative[0] || "朕临朝听政，诸司奏报纷纭。";
    const decision = (narrative[1] || "本回合所断：未下新旨").replace(/^本回合所断：/, "");
    const closing = normalizeSentence(narrative[2] || "今日得失尚可记，然积弊未解");

    storyParagraphs.push(`${opening}本回合你拍板的核心决断是"${decision}"。`);
    storyParagraphs.push(`朕心独白：${closing}。`);
  }

  const situationalParagraph = toTwoSentenceParagraph("时局动态方面：", "诸司章奏并起，朝局脉络渐明", situational);
  if (situationalParagraph) storyParagraphs.push(situationalParagraph);
  const adviceParagraph = toTwoSentenceParagraph("中枢建议汇总：", "中枢群议未决，主张各有所偏", advice);
  if (adviceParagraph) storyParagraphs.push(adviceParagraph);
  const intelParagraph = toTwoSentenceParagraph("穿越情报与技术进展：", "机密来报与工艺进展，俱关后势", intel);
  if (intelParagraph) storyParagraphs.push(intelParagraph);
  const windowsParagraph = toTwoSentenceParagraph("历史窗口倒计时：", "时机转瞬即逝，节点逼近在前", windows);
  if (windowsParagraph) storyParagraphs.push(windowsParagraph);
  const risksParagraph = toTwoSentenceParagraph("暗杀风险监控：", "危机未可轻忽，警讯须逐条核验", risks);
  if (risksParagraph) storyParagraphs.push(risksParagraph);

  if (!storyParagraphs.length) {
    storyParagraphs.push("刚性模块正在初始化，朝局信息将于本回合决策后更新。");
  }

  const pendingBranchEvent = rigid?.pendingBranchEvent;
  const hasPendingAssassinate = !!rigid?.pendingAssassinate;
  const strikeLevel = Number(rigid?.strikeLevel) || 0;
  const strikeState = !!rigid?.court?.strikeState;
  const strikeChoices = strikeState
    ? [
      {
        id: "rigid_strike_recover",
        text: `【罢朝处置】整饬朝议并促复朝（当前${strikeLevel || 1}级）`,
        hint: "非施政命令，仅用于降低阻力并推进罢朝解除进度",
        effects: null,
      },
    ]
    : [];
  const choices = hasPendingAssassinate
    ? [
      {
        id: "rigid_assassinate_investigate",
        text: "【暗杀后续】追查主谋",
        hint: "结果可能冤错或失察，风险会继续上升",
        effects: null,
      },
      {
        id: "rigid_assassinate_suppress",
        text: "【暗杀后续】压下案情",
        hint: "短期稳局，长期隐患增加",
        effects: null,
      },
    ]
    : pendingBranchEvent && Array.isArray(pendingBranchEvent.branches) && pendingBranchEvent.branches.length
    ? pendingBranchEvent.branches.map((branch) => ({
      id: `rigid_branch_${branch.id}`,
      text: `【历史抉择】${branch.name}`,
      hint: branch.hint || `针对“${pendingBranchEvent.name}”的分支选择`,
      effects: null,
    }))
    : strikeChoices.length
      ? strikeChoices
      : presets.map((item) => ({
        id: item.id,
        text: item.text,
        hint: item.hint,
        effects: null,
      }));

  const storyLead = hasPendingAssassinate
    ? ["【暗杀后续强制处置】刺驾余波未平，须先处置调查路线。"]
    : pendingBranchEvent
      ? [`【历史节点强制触发】${pendingBranchEvent.name}`, pendingBranchEvent.description || "该节点不可跳过，请先选择分支。"]
      : [];

  const hiddenModuleIds = [1, 8];
  const rigidMeta = {
    modules,
    hiddenModuleIds,
    latestMemoryAnchor: getLatestMemoryAnchor(rigid),
    strikeState: !!rigid?.court?.strikeState,
    strikeLevel: Number(rigid?.strikeLevel) || 0,
    pendingAssassinate: hasPendingAssassinate,
    pendingBranchEvent: pendingBranchEvent || null,
    calendar: rigid?.calendar || null,
    lastDecision: rigid?.lastDecision || null,
  };

  return {
    header: {
      time: `崇祯${(rigid?.calendar?.year || 1627) - 1626}年${rigid?.calendar?.month || 8}月`,
      season: rigid?.calendar?.season || "秋",
      weather: state.weather || "阴",
      location: "紫禁城",
    },
    storyParagraphs: [...storyLead, ...storyParagraphs],
    choices,
    rigidMeta,
    news: [],
    publicOpinion: [],
  };
}

