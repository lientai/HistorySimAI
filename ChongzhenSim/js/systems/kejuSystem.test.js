import { describe, expect, it } from "vitest";
import {
  advanceKejuSession,
  applyKejuAppointLoyaltyBonus,
  appendTalentReserve,
  buildKejuCandidatePool,
  buildKejuRecommendPositions,
  getKejuStateSnapshot,
} from "./kejuSystem.js";

function createBaseState() {
  return {
    loyalty: {
      a: 60,
      b: 45,
      c: 40,
    },
    appointments: {
      neige_shoufu: "holder_1",
    },
    characterStatus: {
      dead_one: { isAlive: false },
    },
  };
}

function createCharacters() {
  return [
    { id: "a", name: "甲", faction: "neutral", factionLabel: "中立", loyalty: 60 },
    { id: "b", name: "乙", faction: "neutral", factionLabel: "东林", loyalty: 45 },
    { id: "c", name: "丙", faction: "neutral", factionLabel: "中立", loyalty: 40 },
    { id: "holder_1", name: "已任官者", faction: "neutral", factionLabel: "中立", loyalty: 50 },
    { id: "dead_one", name: "已故者", faction: "neutral", factionLabel: "中立", loyalty: 50 },
    { id: "lizicheng", name: "李自成", faction: "rebel", factionLabel: "流寇", loyalty: 10 },
  ];
}

describe("getKejuStateSnapshot", () => {
  it("should provide safe defaults", () => {
    const snapshot = getKejuStateSnapshot({});
    expect(snapshot.stage).toBe("idle");
    expect(snapshot.candidatePool).toEqual([]);
    expect(snapshot.publishedList).toEqual([]);
    expect(snapshot.talentReserve).toEqual([]);
    expect(snapshot.bureauMomentum).toBe(52);
    expect(snapshot.reserveQuality).toBe(0);
    expect(snapshot.note).toBe("");
  });
});

describe("buildKejuCandidatePool", () => {
  it("should exclude appointed dead and rebel candidates", () => {
    const pool = buildKejuCandidatePool(createCharacters(), createBaseState(), {
      random: () => 0.5,
      formatName: (value) => value,
    });

    expect(pool.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(pool.every((item) => typeof item.total === "number")).toBe(true);
  });
});

describe("advanceKejuSession", () => {
  it("should progress through stages with expected candidate counts when generated candidates are disabled", () => {
    const state = createBaseState();
    const characters = createCharacters();
    const random = () => 0.5;
    const started = advanceKejuSession(
      { stage: "idle" },
      { state, characters },
      { random, formatName: (value) => value, enableGeneratedCandidates: false }
    );
    expect(started.stage).toBe("xiangshi");
    expect(started.candidatePool).toHaveLength(3);
    expect(started.bureauMomentum).toBeGreaterThan(52);

    const huishi = advanceKejuSession(started, { state, characters }, { random });
    expect(huishi.stage).toBe("huishi");
    expect(huishi.candidatePool).toHaveLength(3);

    const dianshi = advanceKejuSession(huishi, { state, characters }, { random });
    expect(dianshi.stage).toBe("dianshi");
    expect(dianshi.candidatePool).toHaveLength(3);

    const published = advanceKejuSession(dianshi, { state, characters }, { random });
    expect(published.stage).toBe("published");
    expect(published.publishedList).toHaveLength(3);
    expect(published.reserveQuality).toBeGreaterThan(0);
  });

  it("should include generated candidates by default", () => {
    const state = createBaseState();
    const characters = createCharacters();
    const random = () => 0.5;
    const started = advanceKejuSession({ stage: "idle" }, { state, characters }, { random, formatName: (value) => value });
    expect(started.stage).toBe("xiangshi");
    expect(started.generatedCandidates).toHaveLength(5);
    expect(started.candidatePool.length).toBeGreaterThanOrEqual(8);
  });
});

describe("appendTalentReserve", () => {
  it("should recommend highest importance vacancies and keep reserve deduplicated", () => {
    const kejuState = {
      stage: "published",
      publishedList: [
        { id: "a", name: "甲" },
        { id: "b", name: "乙" },
        { id: "c", name: "丙" },
      ],
      talentReserve: [{ candidateId: "legacy", candidateName: "旧人", positionId: null, positionName: "待定官缺" }],
    };
    const positionsMeta = {
      positions: [
        { id: "neige_shoufu", name: "内阁首辅", importance: 10, rank: 1 },
        { id: "libu_shangshu", name: "吏部尚书", importance: 9, rank: 3 },
        { id: "hubu_shangshu", name: "户部尚书", importance: 8, rank: 3 },
      ],
    };
    const reserve = appendTalentReserve(kejuState, positionsMeta, { neige_shoufu: "holder_1" }, 3, 4);
    expect(reserve).toHaveLength(4);
    expect(reserve.find((item) => item.candidateId === "a")?.positionId).toBe("libu_shangshu");
    expect(reserve.find((item) => item.candidateId === "b")?.positionId).toBe("hubu_shangshu");
  });

  it("should recommend positions in sorted order", () => {
    const recommends = buildKejuRecommendPositions(
      [{ id: "a", name: "甲" }, { id: "b", name: "乙" }],
      {
        positions: [
          { id: "mid", name: "中位", importance: 5, rank: 6 },
          { id: "top", name: "高位", importance: 9, rank: 2 },
        ],
      },
      {}
    );
    expect(recommends[0].positionId).toBe("top");
    expect(recommends[1].positionId).toBe("mid");
  });
});

describe("applyKejuAppointLoyaltyBonus", () => {
  it("should increase loyalty and clamp max value", () => {
    const boosted = applyKejuAppointLoyaltyBonus({ a: 98 }, "a", 6);
    expect(boosted.a).toBe(100);
  });

  it("should create target entry when absent", () => {
    const boosted = applyKejuAppointLoyaltyBonus({}, "new_id", 6);
    expect(boosted.new_id).toBe(6);
  });
});