import { describe, expect, it } from "vitest";
import { deriveAppointmentEffectsFromText, normalizeAppointmentEffects } from "./appointmentEffects.js";

const context = {
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
  currentAppointments: {
    neige_shoufu: "wen_tiren",
    hubu_shangshu: "bi_ziyan",
    libu_shangshu: "wang_yongguang",
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

  it("should parse multiple appointment pairs in one edict without cross-matching", () => {
    const out = deriveAppointmentEffectsFromText(
      "任命温体仁为内阁首辅，毕自严为户部尚书，王永光为吏部尚书",
      context
    );
    expect(out).toEqual({
      appointments: {
        neige_shoufu: "wen_tiren",
        hubu_shangshu: "bi_ziyan",
        libu_shangshu: "wang_yongguang",
      },
    });
  });

  it("should parse multiple dismissals and appointments in the same edict by clause", () => {
    const out = deriveAppointmentEffectsFromText(
      "免去温体仁内阁首辅、毕自严户部尚书；任命王永光为内阁首辅，任命温体仁为户部尚书",
      context
    );
    expect(out).toEqual({
      appointments: {
        neige_shoufu: "wang_yongguang",
        hubu_shangshu: "wen_tiren",
      },
    });
  });

  it("should dismiss multiple current holders when one edict names multiple ministers", () => {
    const out = deriveAppointmentEffectsFromText("即刻免去温体仁、毕自严职务", context);
    expect(out).toEqual({
      appointmentDismissals: ["neige_shoufu", "hubu_shangshu"],
    });
  });

  it("should parse a realistic mixed edict with multiple promotions and dismissals", () => {
    const out = deriveAppointmentEffectsFromText(
      "朕命王永光出任内阁首辅，毕自严仍掌户部尚书，免去温体仁原任。",
      context
    );
    expect(out).toEqual({
      appointments: {
        neige_shoufu: "wang_yongguang",
        hubu_shangshu: "bi_ziyan",
      },
    });
  });

  it("should parse a realistic serial edict with continued clauses", () => {
    const out = deriveAppointmentEffectsFromText(
      "着温体仁署理内阁首辅，毕自严转任户部尚书，王永光兼任吏部尚书，毋得迟延。",
      context
    );
    expect(out).toEqual({
      appointments: {
        neige_shoufu: "wen_tiren",
        hubu_shangshu: "bi_ziyan",
        libu_shangshu: "wang_yongguang",
      },
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
