import { isWarriorCharacter } from "../utils/characterArchetype.js";

export const KEJU_STAGE_LABELS = {
  idle: "未开科",
  xiangshi: "乡试进行中",
  huishi: "会试进行中",
  dianshi: "殿试进行中",
  published: "已放榜",
};

export const WUJU_STAGE_LABELS = {
  idle: "未开武举",
  huishi: "武会试进行中",
  published: "武举放榜",
};

const KEJU_EXCLUDED_IDS = new Set([
  "chongzhendi", "zhouhuanghou", "yuanfei", "tianfei",
  "duoergun", "duoduo", "haoge", "aji", "huangtaiji", "daishan", "jierhalang", "fanwencheng",
  "lizicheng", "zhangxianzhong", "gaoyingxiang", "luorucai", "liuzongmin",
  "liyan", "niujinxing", "songxiance", "lidingguo", "sunkewang", "liuwenxiu", "ainengqi",
]);

const KEJU_EXCLUDED_FACTIONS = new Set(["rebel", "qing"]);
const GENERATED_SURNAMES = ["赵", "钱", "孙", "李", "周", "吴", "郑", "王", "冯", "陈", "蒋", "沈", "韩", "杨", "朱", "许", "何", "吕", "施", "张", "孔", "曹", "严", "华", "金"];
const GENERATED_GIVEN_NAMES = ["文成", "廷献", "国维", "世忠", "承德", "鸣谦", "允恭", "景和", "伯安", "宗尧", "汝砺", "思齐", "元辅", "载道", "明谟", "如松", "天培", "懋功", "用中"];
const GENERATED_HOMETOWNS = ["南直隶苏州府", "南直隶松江府", "浙江绍兴府", "浙江嘉兴府", "湖广武昌府", "江西南昌府", "福建泉州府", "山东济南府", "河南开封府", "山西太原府"];
const GENERATED_FACTIONS = [
  { faction: "neutral", label: "中立" },
  { faction: "donglin", label: "东林" },
  { faction: "imperial", label: "帝党" },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computePublishedQuality(publishedList) {
  const list = Array.isArray(publishedList) ? publishedList : [];
  if (!list.length) return 0;
  const avg = list.reduce((sum, item) => sum + (Number(item?.total) || 0), 0) / list.length;
  return clamp(Math.round(avg), 0, 100);
}

export function getSeasonLabelByMonth(month) {
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

export function getKejuStateSnapshot(state) {
  const base = state?.keju && typeof state.keju === "object" ? state.keju : {};
  return {
    stage: typeof base.stage === "string" ? base.stage : "idle",
    candidatePool: Array.isArray(base.candidatePool) ? base.candidatePool : [],
    publishedList: Array.isArray(base.publishedList) ? base.publishedList : [],
    talentReserve: Array.isArray(base.talentReserve) ? base.talentReserve : [],
    generatedCandidates: Array.isArray(base.generatedCandidates) ? base.generatedCandidates : [],
    bureauMomentum: Number.isFinite(base.bureauMomentum) ? clamp(Math.round(base.bureauMomentum), 0, 100) : 52,
    reserveQuality: Number.isFinite(base.reserveQuality) ? clamp(Math.round(base.reserveQuality), 0, 100) : 0,
    note: typeof base.note === "string" ? base.note : "",
  };
}

export function mergeKejuState(state, partial) {
  return {
    ...getKejuStateSnapshot(state),
    ...partial,
  };
}

function getKejuSourceCharacters(characters, state) {
  const snapshot = getKejuStateSnapshot(state);
  return [...(Array.isArray(characters) ? characters : []), ...snapshot.generatedCandidates];
}

export function buildKejuCandidatePool(characters, state, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const formatName = typeof options.formatName === "function" ? options.formatName : ((value) => value || "");
  const isAliveCharacter = typeof options.isAliveCharacter === "function"
    ? options.isAliveCharacter
    : ((currentState, id) => currentState?.characterStatus?.[id]?.isAlive !== false);
  const loyalty = state?.loyalty || {};
  const appointed = new Set(Object.values(state?.appointments || {}));
  const aliveCandidates = getKejuSourceCharacters(characters, state).filter((char) => {
    if (!char || !char.id) return false;
    if (!isAliveCharacter(state, char.id)) return false;
    if (appointed.has(char.id)) return false;
    if (KEJU_EXCLUDED_IDS.has(char.id)) return false;
    if (KEJU_EXCLUDED_FACTIONS.has(char.faction)) return false;
    return true;
  });

  const scored = aliveCandidates.map((char) => {
    const loyaltyBase = Number(loyalty[char.id] ?? char.loyalty ?? 35);
    const literary = Math.max(35, Math.min(99, 45 + Math.round(random() * 28) + Math.round((loyaltyBase - 40) * 0.18)));
    const morality = Math.max(35, Math.min(99, 40 + Math.round(random() * 30) + Math.round((loyaltyBase - 40) * 0.3)));
    const potential = Math.max(30, Math.min(99, 38 + Math.round(random() * 35)));
    const total = Math.round(literary * 0.45 + morality * 0.3 + potential * 0.25);
    return {
      id: char.id,
      name: formatName(char.name || char.id),
      factionLabel: char.factionLabel || "",
      literary,
      morality,
      potential,
      total,
    };
  });

  return scored
    .sort((a, b) => b.total - a.total)
    .slice(0, 36)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export function generateRandomKejuCandidates(state, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const count = Number.isInteger(options.count) ? options.count : 5;
  const currentYear = Number(state?.currentYear) || 1;
  const currentMonth = Number(state?.currentMonth) || 1;
  const absoluteYear = 1627 + currentYear;
  const baseIndex = currentYear * 31 + currentMonth * 17;

  return Array.from({ length: count }, (_, idx) => {
    const factionInfo = GENERATED_FACTIONS[Math.floor(random() * GENERATED_FACTIONS.length)];
    const name = `${GENERATED_SURNAMES[(baseIndex + idx) % GENERATED_SURNAMES.length]}${GENERATED_GIVEN_NAMES[Math.floor(random() * GENERATED_GIVEN_NAMES.length)]}`;
    const courtesyName = GENERATED_GIVEN_NAMES[Math.floor(random() * GENERATED_GIVEN_NAMES.length)];
    const birthYear = clamp(absoluteYear - 22 - Math.floor(random() * 14), 1450, 1700);
    const deathYear = clamp(birthYear + 45 + Math.floor(random() * 20), birthYear + 35, 1700);
    return {
      id: `keju_generated_${currentYear}_${currentMonth}_${idx + 1}`,
      name,
      courtesyName,
      birthYear,
      deathYear,
      hometown: GENERATED_HOMETOWNS[Math.floor(random() * GENERATED_HOMETOWNS.length)],
      positions: [],
      faction: factionInfo.faction,
      factionLabel: factionInfo.label,
      loyalty: 32 + Math.floor(random() * 29),
      isAlive: true,
      deathReason: null,
      deathDay: null,
      tags: ["科举新秀", "待授官"],
      summary: `${name}，字${courtesyName}，少有文名，因本届科举脱颖而出，正待朝廷擢用。`,
      attitude: "重视名节与治绩，希望借由科举入朝建功立业。",
      openingLine: "臣新登科第，愿尽愚忠，以报朝廷知遇。",
    };
  });
}

export function runKejuSelection(candidates, keepCount, jitter = 10, random = Math.random) {
  return (Array.isArray(candidates) ? candidates : [])
    .map((item) => {
      const stageScore = item.total + Math.round((random() - 0.5) * jitter);
      return { ...item, stageScore };
    })
    .sort((a, b) => b.stageScore - a.stageScore)
    .slice(0, keepCount)
    .map((item, idx) => {
      const { stageScore, ...rest } = item;
      return { ...rest, rank: idx + 1 };
    });
}

export function advanceKejuSession(kejuState, context, options = {}) {
  const snapshot = getKejuStateSnapshot({ keju: kejuState });
  const random = typeof options.random === "function" ? options.random : Math.random;
  const formatName = typeof options.formatName === "function" ? options.formatName : ((value) => value || "");
  const enableGeneratedCandidates = options.enableGeneratedCandidates !== false;
  const isAliveCharacter = typeof options.isAliveCharacter === "function"
    ? options.isAliveCharacter
    : ((currentState, id) => currentState?.characterStatus?.[id]?.isAlive !== false);
  const characters = Array.isArray(context?.characters) ? context.characters : [];
  const state = context?.state || {};

  if (snapshot.stage === "idle") {
    const generatedCandidates = enableGeneratedCandidates
      ? (snapshot.generatedCandidates.length
      ? snapshot.generatedCandidates
      : generateRandomKejuCandidates(state, { random, count: 5 }))
      : [];
    const candidatePool = buildKejuCandidatePool(
      characters,
      { ...state, keju: { ...snapshot, generatedCandidates } },
      { random, formatName, isAliveCharacter }
    );
    return {
      ...snapshot,
      stage: "xiangshi",
      candidatePool,
      publishedList: [],
      generatedCandidates,
      reserveQuality: 0,
      bureauMomentum: clamp(snapshot.bureauMomentum + 2, 0, 100),
      note: "乡试已开，礼部正在阅卷。",
    };
  }

  if (snapshot.stage === "xiangshi") {
    return {
      ...snapshot,
      stage: "huishi",
      candidatePool: runKejuSelection(snapshot.candidatePool, 12, 8, random),
      bureauMomentum: clamp(snapshot.bureauMomentum + 2, 0, 100),
      note: "乡试录取 12 人，进入会试。",
    };
  }

  if (snapshot.stage === "huishi") {
    return {
      ...snapshot,
      stage: "dianshi",
      candidatePool: runKejuSelection(snapshot.candidatePool, 5, 6, random),
      bureauMomentum: clamp(snapshot.bureauMomentum + 2, 0, 100),
      note: "会试录取 5 人，待殿试钦定。",
    };
  }

  if (snapshot.stage === "dianshi") {
    const top3 = runKejuSelection(snapshot.candidatePool, 3, 3, random);
    return {
      ...snapshot,
      stage: "published",
      candidatePool: top3,
      publishedList: top3,
      reserveQuality: computePublishedQuality(top3),
      bureauMomentum: clamp(snapshot.bureauMomentum + 4, 0, 100),
      note: "金榜已张：状元、榜眼、探花已定。",
    };
  }

  return snapshot;
}

export function resetKejuForNextCycle(kejuState, note = "本届科举已毕，礼部正在筹备下一科。") {
  const snapshot = getKejuStateSnapshot({ keju: kejuState });
  return {
    ...snapshot,
    stage: "idle",
    candidatePool: [],
    publishedList: [],
    generatedCandidates: [],
    note,
  };
}

export function buildKejuRecommendPositions(topCandidates, positionsMeta, appointments) {
  const positions = Array.isArray(positionsMeta?.positions) ? positionsMeta.positions : [];
  const vacancies = positions
    .filter((pos) => pos && pos.id && !appointments?.[pos.id])
    .sort((a, b) => {
      const importanceA = typeof a.importance === "number" ? a.importance : 0;
      const importanceB = typeof b.importance === "number" ? b.importance : 0;
      if (importanceB !== importanceA) return importanceB - importanceA;
      const rankA = typeof a.rank === "number" ? a.rank : 99;
      const rankB = typeof b.rank === "number" ? b.rank : 99;
      return rankA - rankB;
    })
    .slice(0, 3);

  return (Array.isArray(topCandidates) ? topCandidates : []).map((candidate, idx) => ({
    candidateId: candidate.id,
    candidateName: candidate.name,
    positionId: vacancies[idx]?.id || null,
    positionName: vacancies[idx]?.name || "待定官缺",
  }));
}

export function appendTalentReserve(kejuState, positionsMeta, appointments, currentYear, currentMonth) {
  const snapshot = getKejuStateSnapshot({ keju: kejuState });
  const latestReserve = Array.isArray(snapshot.talentReserve) ? snapshot.talentReserve : [];
  const recommends = buildKejuRecommendPositions(snapshot.publishedList, positionsMeta, appointments);
  const reserveMap = new Map(latestReserve.map((item) => [item.candidateId, item]));
  recommends.forEach((item) => {
    reserveMap.set(item.candidateId, {
      ...item,
      year: currentYear || 1,
      month: currentMonth || 1,
    });
  });
  return Array.from(reserveMap.values()).slice(-30);
}

export function applyKejuAppointLoyaltyBonus(loyaltyMap, characterId, delta = 6) {
  const baseMap = loyaltyMap && typeof loyaltyMap === "object" ? loyaltyMap : {};
  const current = Number(baseMap[characterId]) || 0;
  return {
    ...baseMap,
    [characterId]: clamp(current + delta, 0, 100),
  };
}

export function getWujuStateSnapshot(state) {
  const base = state?.wuju && typeof state.wuju === "object" ? state.wuju : {};
  return {
    stage: typeof base.stage === "string" ? base.stage : "idle",
    candidatePool: Array.isArray(base.candidatePool) ? base.candidatePool : [],
    publishedList: Array.isArray(base.publishedList) ? base.publishedList : [],
    talentReserve: Array.isArray(base.talentReserve) ? base.talentReserve : [],
    generatedCandidates: Array.isArray(base.generatedCandidates) ? base.generatedCandidates : [],
    bureauMomentum: Number.isFinite(base.bureauMomentum) ? clamp(Math.round(base.bureauMomentum), 0, 100) : 50,
    reserveQuality: Number.isFinite(base.reserveQuality) ? clamp(Math.round(base.reserveQuality), 0, 100) : 0,
    note: typeof base.note === "string" ? base.note : "",
  };
}

export function mergeWujuState(state, partial) {
  return {
    ...getWujuStateSnapshot(state),
    ...partial,
  };
}

export function generateRandomWujuCandidates(state, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const count = Number.isInteger(options.count) ? options.count : 5;
  const currentYear = Number(state?.currentYear) || 1;
  const currentMonth = Number(state?.currentMonth) || 1;
  const absoluteYear = 1627 + currentYear;
  const baseIndex = currentYear * 41 + currentMonth * 19;

  return Array.from({ length: count }, (_, idx) => {
    const factionInfo = GENERATED_FACTIONS[Math.floor(random() * GENERATED_FACTIONS.length)];
    const name = `${GENERATED_SURNAMES[(baseIndex + idx) % GENERATED_SURNAMES.length]}${GENERATED_GIVEN_NAMES[Math.floor(random() * GENERATED_GIVEN_NAMES.length)]}`;
    const courtesyName = GENERATED_GIVEN_NAMES[Math.floor(random() * GENERATED_GIVEN_NAMES.length)];
    const birthYear = clamp(absoluteYear - 20 - Math.floor(random() * 12), 1450, 1700);
    const deathYear = clamp(birthYear + 44 + Math.floor(random() * 20), birthYear + 35, 1700);
    return {
      id: `wuju_generated_${currentYear}_${currentMonth}_${idx + 1}`,
      name,
      courtesyName,
      birthYear,
      deathYear,
      hometown: GENERATED_HOMETOWNS[Math.floor(random() * GENERATED_HOMETOWNS.length)],
      positions: [],
      faction: factionInfo.faction,
      factionLabel: factionInfo.label,
      loyalty: 35 + Math.floor(random() * 28),
      isAlive: true,
      deathReason: null,
      deathDay: null,
      tags: ["武举新秀", "待授官", "武人"],
      archetypes: ["warrior"],
      summary: `${name}，字${courtesyName}，少习骑射，勇于临阵，因武举应试获荐。`,
      attitude: "主张强军练兵，重赏军功，先安边后治内。",
      openingLine: "陛下，边患未已，愿以武职效命疆场。",
    };
  });
}

export function buildWujuCandidatePool(characters, state, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const formatName = typeof options.formatName === "function" ? options.formatName : ((value) => value || "");
  const isAliveCharacter = typeof options.isAliveCharacter === "function"
    ? options.isAliveCharacter
    : ((currentState, id) => currentState?.characterStatus?.[id]?.isAlive !== false);
  const loyalty = state?.loyalty || {};
  const appointed = new Set(Object.values(state?.appointments || {}));
  const generated = Array.isArray(state?.wuju?.generatedCandidates) ? state.wuju.generatedCandidates : [];
  const source = [...(Array.isArray(characters) ? characters : []), ...generated];
  const aliveCandidates = source.filter((char) => {
    if (!char || !char.id) return false;
    if (!isAliveCharacter(state, char.id)) return false;
    if (appointed.has(char.id)) return false;
    if (KEJU_EXCLUDED_IDS.has(char.id)) return false;
    if (KEJU_EXCLUDED_FACTIONS.has(char.faction)) return false;
    if (!isWarriorCharacter(char)) return false;
    return true;
  });

  const scored = aliveCandidates.map((char) => {
    const loyaltyBase = Number(loyalty[char.id] ?? char.loyalty ?? 35);
    const force = Math.max(35, Math.min(99, 46 + Math.round(random() * 30) + Math.round((loyaltyBase - 40) * 0.2)));
    const command = Math.max(35, Math.min(99, 42 + Math.round(random() * 30) + Math.round((loyaltyBase - 40) * 0.25)));
    const discipline = Math.max(35, Math.min(99, 40 + Math.round(random() * 28)));
    const total = Math.round(force * 0.45 + command * 0.35 + discipline * 0.2);
    return {
      id: char.id,
      name: formatName(char.name || char.id),
      factionLabel: char.factionLabel || "",
      force,
      command,
      discipline,
      total,
    };
  });

  return scored
    .sort((a, b) => b.total - a.total)
    .slice(0, 24)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export function advanceWujuSession(wujuState, context, options = {}) {
  const snapshot = getWujuStateSnapshot({ wuju: wujuState });
  const random = typeof options.random === "function" ? options.random : Math.random;
  const formatName = typeof options.formatName === "function" ? options.formatName : ((value) => value || "");
  const enableGeneratedCandidates = options.enableGeneratedCandidates !== false;
  const isAliveCharacter = typeof options.isAliveCharacter === "function"
    ? options.isAliveCharacter
    : ((currentState, id) => currentState?.characterStatus?.[id]?.isAlive !== false);
  const characters = Array.isArray(context?.characters) ? context.characters : [];
  const state = context?.state || {};

  if (snapshot.stage === "idle") {
    const generatedCandidates = enableGeneratedCandidates
      ? (snapshot.generatedCandidates.length
      ? snapshot.generatedCandidates
      : generateRandomWujuCandidates(state, { random, count: 5 }))
      : [];
    const candidatePool = buildWujuCandidatePool(
      characters,
      { ...state, wuju: { ...snapshot, generatedCandidates } },
      { random, formatName, isAliveCharacter }
    );
    return {
      ...snapshot,
      stage: "huishi",
      candidatePool,
      publishedList: [],
      generatedCandidates,
      reserveQuality: 0,
      bureauMomentum: clamp(snapshot.bureauMomentum + 2, 0, 100),
      note: "武会试已开，兵部与五军都督府正在核阅武艺与统率。",
    };
  }

  if (snapshot.stage === "huishi") {
    const top1 = runKejuSelection(snapshot.candidatePool, 1, 6, random);
    return {
      ...snapshot,
      stage: "published",
      candidatePool: top1,
      publishedList: top1,
      reserveQuality: computePublishedQuality(top1),
      bureauMomentum: clamp(snapshot.bureauMomentum + 4, 0, 100),
      note: "武举放榜：武状元已定。",
    };
  }

  return snapshot;
}

export function resetWujuForNextCycle(wujuState, note = "本届武举已毕，下一届武举待开。") {
  const snapshot = getWujuStateSnapshot({ wuju: wujuState });
  return {
    ...snapshot,
    stage: "idle",
    candidatePool: [],
    publishedList: [],
    generatedCandidates: [],
    note,
  };
}

export function buildWujuRecommendPositions(topCandidates, positionsMeta, appointments) {
  const positions = Array.isArray(positionsMeta?.positions) ? positionsMeta.positions : [];
  const departments = Array.isArray(positionsMeta?.departments) ? positionsMeta.departments : [];
  const moduleByDeptId = new Map(departments.map((item) => [item.id, item.moduleId]));
  const allowModules = new Set(["neiting", "difang", "junshi"]);

  const vacancies = positions
    .filter((pos) => {
      if (!pos || !pos.id || appointments?.[pos.id]) return false;
      const moduleId = moduleByDeptId.get(pos.department || "");
      return allowModules.has(moduleId);
    })
    .sort((a, b) => {
      const importanceA = typeof a.importance === "number" ? a.importance : 0;
      const importanceB = typeof b.importance === "number" ? b.importance : 0;
      if (importanceB !== importanceA) return importanceB - importanceA;
      const rankA = typeof a.rank === "number" ? a.rank : 99;
      const rankB = typeof b.rank === "number" ? b.rank : 99;
      return rankA - rankB;
    })
    .slice(0, 1);

  return (Array.isArray(topCandidates) ? topCandidates : []).slice(0, 1).map((candidate, idx) => ({
    candidateId: candidate.id,
    candidateName: candidate.name,
    positionId: vacancies[idx]?.id || null,
    positionName: vacancies[idx]?.name || "待定官缺",
  }));
}

export function appendWujuTalentReserve(wujuState, positionsMeta, appointments, currentYear, currentMonth) {
  const snapshot = getWujuStateSnapshot({ wuju: wujuState });
  const latestReserve = Array.isArray(snapshot.talentReserve) ? snapshot.talentReserve : [];
  const recommends = buildWujuRecommendPositions(snapshot.publishedList, positionsMeta, appointments);
  const reserveMap = new Map(latestReserve.map((item) => [item.candidateId, item]));
  recommends.forEach((item) => {
    reserveMap.set(item.candidateId, {
      ...item,
      year: currentYear || 1,
      month: currentMonth || 1,
    });
  });
  return Array.from(reserveMap.values()).slice(-30);
}
