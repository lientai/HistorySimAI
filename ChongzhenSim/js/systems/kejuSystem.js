export const KEJU_STAGE_LABELS = {
  idle: "未开科",
  xiangshi: "乡试进行中",
  huishi: "会试进行中",
  dianshi: "殿试进行中",
  published: "已放榜",
};

const KEJU_EXCLUDED_IDS = new Set([
  "chongzhendi", "zhouhuanghou", "yuanfei", "tianfei",
  "duoergun", "duoduo", "haoge", "aji", "huangtaiji", "daishan", "jierhalang", "fanwencheng",
  "lizicheng", "zhangxianzhong", "gaoyingxiang", "luorucai", "liuzongmin",
  "liyan", "niujinxing", "songxiance", "lidingguo", "sunkewang", "liuwenxiu", "ainengqi",
]);

const KEJU_EXCLUDED_FACTIONS = new Set(["rebel", "qing"]);

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

export function buildKejuCandidatePool(characters, state, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const formatName = typeof options.formatName === "function" ? options.formatName : ((value) => value || "");
  const isAliveCharacter = typeof options.isAliveCharacter === "function"
    ? options.isAliveCharacter
    : ((currentState, id) => currentState?.characterStatus?.[id]?.isAlive !== false);
  const loyalty = state?.loyalty || {};
  const appointed = new Set(Object.values(state?.appointments || {}));
  const aliveCandidates = (Array.isArray(characters) ? characters : []).filter((char) => {
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
  const isAliveCharacter = typeof options.isAliveCharacter === "function"
    ? options.isAliveCharacter
    : ((currentState, id) => currentState?.characterStatus?.[id]?.isAlive !== false);
  const characters = Array.isArray(context?.characters) ? context.characters : [];
  const state = context?.state || {};

  if (snapshot.stage === "idle") {
    const candidatePool = buildKejuCandidatePool(characters, state, { random, formatName, isAliveCharacter });
    return {
      ...snapshot,
      stage: "xiangshi",
      candidatePool,
      publishedList: [],
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
      note: "会试录取 5 人，待陛下殿试钦定。",
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
