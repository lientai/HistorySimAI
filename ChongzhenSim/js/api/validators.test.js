import { describe, it, expect } from "vitest";
import { normalizeStoryPayload, parseMinisterReplyPayload, sanitizeStoryEffects } from "./validators.js";

const appointmentContext = {
  positions: [
    { id: "neige_shoufu", name: "内阁首辅" },
    { id: "hubu_shangshu", name: "户部尚书" },
    { id: "libu_shangshu", name: "吏部尚书" },
  ],
  ministers: [
    { id: "wen_tiren", name: "温体仁" },
    { id: "bi_ziyan", name: "毕自严" },
    { id: "wang_yongguang", name: "王永光" },
  ],
};

describe("sanitizeStoryEffects", () => {
  it("should clamp unreasonable numeric deltas", () => {
    const out = sanitizeStoryEffects({
      treasury: 9999999,
      grain: -999999,
      civilMorale: 80,
      borderThreat: -80,
      corruptionLevel: -50,
      loyalty: { a: 99, b: -99 },
      hostileDamage: { x: 100, y: -100 },
    });

    expect(out.treasury).toBe(300000);
    expect(out.grain).toBe(-30000);
    expect(out.civilMorale).toBe(12);
    expect(out.borderThreat).toBe(-12);
    expect(out.corruptionLevel).toBe(-12);
    expect(out.loyalty.a).toBe(10);
    expect(out.loyalty.b).toBe(-10);
    expect(out.hostileDamage.x).toBe(25);
    expect(out.hostileDamage.y).toBe(-25);
  });

  it("should parse numeric-like strings in effects", () => {
    const out = sanitizeStoryEffects({
      treasury: "+15,800",
      grain: "-2,400",
      civilMorale: " +5 ",
      loyalty: { a: "+3", b: "-2" },
      hostileDamage: { h1: "+9" },
    });

    expect(out.treasury).toBe(15800);
    expect(out.grain).toBe(-2400);
    expect(out.civilMorale).toBe(5);
    expect(out.loyalty.a).toBe(3);
    expect(out.loyalty.b).toBe(-2);
    expect(out.hostileDamage.h1).toBe(9);
  });

  it("should drop invalid characterDeath entries with numeric keys", () => {
    const out = sanitizeStoryEffects({
      characterDeath: {
        0: "处死",
        wen_tiren: "赐死",
      },
    });

    expect(out.characterDeath).toEqual({ wen_tiren: "赐死" });
  });

  it("should flatten nested nation fields and resource aliases into treasury and grain", () => {
    const out = sanitizeStoryEffects({
      nation: { treasury: 12000, grain: -5000 },
      silver: 3000,
      粮草: 2000,
    });

    expect(out.treasury).toBe(15000);
    expect(out.grain).toBe(-3000);
    expect(out.nation).toBeUndefined();
    expect(out.silver).toBeUndefined();
  });
});

describe("normalizeStoryPayload", () => {
  it("should sanitize choice effects from LLM payload", () => {
    const parsed = {
      storyParagraphs: ["test"],
      choices: [
        {
          id: "c1",
          text: "test choice",
          effects: {
            treasury: 9999999,
            civilMorale: -100,
          },
        },
      ],
    };

    const normalized = normalizeStoryPayload(parsed, { nation: {} });
    expect(normalized).toBeTruthy();
    expect(normalized.choices[0].effects.treasury).toBe(300000);
    expect(normalized.choices[0].effects.civilMorale).toBe(-12);
  });

  it("should strip english parenthetical suffixes after chinese names", () => {
    const parsed = {
      storyParagraphs: ["毕自严(bi_ziyan)上奏：粮储告急", "温体仁（wen_tiren）沉默不语"],
      choices: [
        {
          id: "c1",
          text: "召见孙承宗(sun_chengzong)商议边防",
          hint: "听取洪承畴(hong_chengchou)军报",
          effects: {},
        },
      ],
    };

    const normalized = normalizeStoryPayload(parsed, { nation: {} });
    expect(normalized).toBeTruthy();
    expect(normalized.storyParagraphs[0]).toBe("毕自严上奏：粮储告急");
    expect(normalized.storyParagraphs[1]).toBe("温体仁沉默不语");
    expect(normalized.choices[0].text).toBe("召见孙承宗商议边防");
    expect(normalized.choices[0].hint).toBe("听取洪承畴军报");
  });
});

describe("parseMinisterReplyPayload", () => {
  it("should parse appointments object map", () => {
    const payload = JSON.stringify({
      reply: "臣遵旨。",
      loyaltyDelta: 1,
      appointments: {
        hubu_shangshu: "bi_ziyan",
      },
    });

    const out = parseMinisterReplyPayload(payload, appointmentContext);
    expect(out.ok).toBe(true);
    expect(out.value.reply).toBe("臣遵旨。");
    expect(out.value.loyaltyDelta).toBe(1);
    expect(out.value.appointments).toEqual({ hubu_shangshu: "bi_ziyan" });
  });

  it("should parse appointments array format", () => {
    const payload = JSON.stringify({
      reply: "已调整。",
      appointments: [
        { positionId: "libu_shangshu", characterId: "wang_yongguang" },
      ],
    });

    const out = parseMinisterReplyPayload(payload, appointmentContext);
    expect(out.ok).toBe(true);
    expect(out.value.appointments).toEqual({ libu_shangshu: "wang_yongguang" });
  });

  it("should canonicalize multiple appointments from name-based object payload", () => {
    const payload = JSON.stringify({
      reply: "臣已拟定名单。",
      appointments: {
        "内阁首辅": "温体仁",
        "户部尚书": "毕自严",
        "吏部尚书": "王永光",
      },
    });

    const out = parseMinisterReplyPayload(payload, appointmentContext);
    expect(out.ok).toBe(true);
    expect(out.value.appointments).toEqual({
      neige_shoufu: "wen_tiren",
      hubu_shangshu: "bi_ziyan",
      libu_shangshu: "wang_yongguang",
    });
  });

  it("should canonicalize multiple appointments from array payload into effects as well", () => {
    const payload = JSON.stringify({
      reply: "臣遵旨。",
      effects: { civilMorale: 1 },
      appointments: [
        { positionId: "内阁首辅", characterId: "温体仁" },
        { positionId: "户部尚书", characterId: "毕自严" },
      ],
    });

    const out = parseMinisterReplyPayload(payload, appointmentContext);
    expect(out.ok).toBe(true);
    expect(out.value.appointments).toEqual({
      neige_shoufu: "wen_tiren",
      hubu_shangshu: "bi_ziyan",
    });
    expect(out.value.effects.appointments).toEqual({
      neige_shoufu: "wen_tiren",
      hubu_shangshu: "bi_ziyan",
    });
  });

  it("should parse effects and keep nation deltas", () => {
    const payload = JSON.stringify({
      reply: "已调整国库。",
      effects: {
        treasury: 12000,
        grain: -800,
      },
      ministerId: "bi_ziyan",
    });

    const out = parseMinisterReplyPayload(payload, appointmentContext);
    expect(out.ok).toBe(true);
    expect(out.value.effects.treasury).toBe(12000);
    expect(out.value.effects.grain).toBe(-800);
  });

  it("should merge loyaltyDelta into effects.loyalty when ministerId exists", () => {
    const payload = JSON.stringify({
      reply: "臣领旨。",
      loyaltyDelta: 2,
      ministerId: "wen_tiren",
      effects: {
        civilMorale: 1,
      },
    });

    const out = parseMinisterReplyPayload(payload, appointmentContext);
    expect(out.ok).toBe(true);
    expect(out.value.effects.civilMorale).toBe(1);
    expect(out.value.effects.loyalty.wen_tiren).toBe(2);
  });
});
