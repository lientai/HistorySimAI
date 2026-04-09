import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildStoryRequestBodyMock: vi.fn(() => ({ request: true })),
  getApiBaseMock: vi.fn(() => "http://test.local"),
  postJsonAndReadTextMock: vi.fn(),
}));

vi.mock("./requestContext.js", () => ({
  buildStoryRequestBody: mocks.buildStoryRequestBodyMock,
}));

vi.mock("./httpClient.js", () => ({
  getApiBase: mocks.getApiBaseMock,
  postJsonAndReadText: mocks.postJsonAndReadTextMock,
}));

import { requestStoryTurn } from "./llmStory.js";

describe("requestStoryTurn", () => {
  beforeEach(() => {
    mocks.buildStoryRequestBodyMock.mockClear();
    mocks.getApiBaseMock.mockClear();
    mocks.postJsonAndReadTextMock.mockReset();
  });

  it("canonicalizes name-based lastChoiceEffects appointments before returning to the caller", async () => {
    mocks.postJsonAndReadTextMock.mockResolvedValueOnce(JSON.stringify({
      storyParagraphs: ["朝议既定。"],
      choices: [
        { id: "c1", text: "准奏", effects: {} },
        { id: "c2", text: "缓议", effects: {} },
        { id: "c3", text: "驳回", effects: {} },
      ],
      lastChoiceEffects: {
        appointments: {
          "内阁首辅": "温体仁",
          "户部尚书": "毕自严",
        },
      },
    }));

    const state = {
      currentYear: 3,
      currentMonth: 4,
      currentDay: 1,
      currentPhase: "morning",
      config: {},
      nation: {},
      positionsMeta: {
        positions: [
          { id: "neige_shoufu", name: "内阁首辅" },
          { id: "hubu_shangshu", name: "户部尚书" },
        ],
      },
      ministers: [
        { id: "wen_tiren", name: "温体仁" },
        { id: "bi_ziyan", name: "毕自严" },
      ],
    };

    const result = await requestStoryTurn(state, { id: "custom_edict", text: "任免大臣" });

    expect(result.lastChoiceEffects.appointments).toEqual({
      neige_shoufu: "wen_tiren",
      hubu_shangshu: "bi_ziyan",
    });
  });
});