import { describe, expect, it } from "vitest";
import { deriveAppointmentEffectsFromText, normalizeAppointmentEffects } from "./appointmentEffects.js";

const context = {
  positions: [
    { id: "neige_shoufu", name: "内阁首辅" },
    { id: "hubu_shangshu", name: "户部尚书" },
  ],
  ministers: [
    { id: "wen_tiren", name: "温体仁" },
    { id: "bi_ziyan", name: "毕自严" },
  ],
  currentAppointments: {
    neige_shoufu: "wen_tiren",
    hubu_shangshu: "bi_ziyan",
  },
};

describe("deriveAppointmentEffectsFromText", () => {
  it("should parse appoint and dismiss semantics from custom edict text", () => {
    const out = deriveAppointmentEffectsFromText("免去温体仁内阁首辅，任命毕自严为内阁首辅", context);
    expect(out).toEqual({
      appointments: { neige_shoufu: "bi_ziyan" },
    });
  });

  it("should dismiss current holder when text dismisses a minister without explicit position", () => {
    const out = deriveAppointmentEffectsFromText("即刻免去毕自严职务", context);
    expect(out).toEqual({
      appointmentDismissals: ["hubu_shangshu"],
    });
  });

  it("should return null for non-appointment semantic text", () => {
    const out = deriveAppointmentEffectsFromText("命工部核查仓储账册，不涉任免", context);
    expect(out).toBeNull();
  });

  it("should extract character death from '赐死' keyword", () => {
    const out = deriveAppointmentEffectsFromText("赐死温体仁，以示朝纲严明", context);
    expect(out).toEqual({
      characterDeath: { wen_tiren: "赐死" },
    });
  });

  it("should parse combined appointment, dismissal, and death in one text", () => {
    const out = deriveAppointmentEffectsFromText("免去温体仁，赐予自尽；任命毕自严为内阁首辅", context);
    expect(out).toEqual({
      characterDeath: { wen_tiren: "赐死" },
      appointments: { neige_shoufu: "bi_ziyan" },
    });
  });
});

describe("normalizeAppointmentEffects", () => {
  it("should normalize appointments from names to canonical ids", () => {
    const out = normalizeAppointmentEffects(
      {
        appointments: {
          "户部尚书": "温体仁",
          neige_shoufu: "毕自严",
        },
      },
      context
    );

    expect(out).toEqual({
      appointments: {
        hubu_shangshu: "wen_tiren",
        neige_shoufu: "bi_ziyan",
      },
    });
  });

  it("should normalize dismissal names to canonical position ids", () => {
    const out = normalizeAppointmentEffects(
      {
        appointmentDismissals: ["户部尚书", "neige_shoufu", "不存在官职"],
      },
      context
    );

    expect(out).toEqual({
      appointmentDismissals: ["hubu_shangshu", "neige_shoufu"],
    });
  });
});
