import { describe, it, expect } from "vitest";
import { normalizeStoryPayload, sanitizeStoryEffects } from "./validators.js";

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
