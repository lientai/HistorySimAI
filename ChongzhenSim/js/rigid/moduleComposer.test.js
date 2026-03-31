import { describe, it, expect } from "vitest";
import { buildRigidStoryData, composeRigidModules } from "./moduleComposer.js";
import { createDefaultRigidState, DEFAULT_RIGID_INITIAL } from "./config.js";

function buildRigid() {
  const rigid = createDefaultRigidState(DEFAULT_RIGID_INITIAL);
  rigid.calendar = { year: 1628, month: 2, turn: 2, season: "春" };
  return rigid;
}

describe("rigid module template", () => {
  it("keeps fixed 8-module structure and order", () => {
    const modules = composeRigidModules(buildRigid(), {});
    expect(modules.length).toBe(8);
    expect(modules.map((m) => m.title)).toEqual([
      "核心变量数值更新",
      "叙事正文",
      "时局动态反馈",
      "内阁/司礼监建议",
      "穿越者情报与技术进展",
      "历史窗口倒计时",
      "暗杀风险监控",
      "记忆锚点",
    ]);
  });

  it("contains 3 narrative subitems in module 2 (opening, decision, closing)", () => {
    const modules = composeRigidModules(buildRigid(), {});
    expect(modules[1].lines.length).toBe(3);
    expect(modules[1].lines[0]).toContain("其一");
    expect(modules[1].lines[1]).toContain("其二");
    expect(modules[1].lines[2]).toContain("其八");
  });

  it("contains six ministries + factory report + urgent military in module 3", () => {
    const modules = composeRigidModules(buildRigid(), {});
    const joined = modules[2].lines.join("\n");
    ["吏部", "户部", "礼部", "兵部", "刑部", "工部", "厂卫密报", "信息茧房矛盾", "紧急军情"].forEach((token) => {
      expect(joined).toContain(token);
    });
  });

  it("includes detailed history window line when config provides descriptions", () => {
    const rigid = buildRigid();
    const modules = composeRigidModules(rigid, {
      historyConfigs: [
        {
          id: "platform_dialogue",
          name: "平台召对",
          description: "召对迫使中枢在清议与效率间站队。",
          trigger: { year: 1628, month: 2 },
        },
      ],
    });
    expect(modules[5].lines[0]).toContain("崇祯");
    expect(modules[5].lines[0]).toContain("召对迫使中枢在清议与效率间站队");
  });

  it("hides numeric and memory modules in rigid story panel text", () => {
    const rigid = buildRigid();
    const modules = composeRigidModules(rigid, {});
    const data = buildRigidStoryData({ rigid }, []);
    const joined = data.storyParagraphs.join("\n");

    expect(modules.find((item) => item.id === 1)?.title).toBe("核心变量数值更新");
    expect(modules.find((item) => item.id === 8)?.title).toBe("记忆锚点");
    expect(joined).not.toContain("核心变量数值更新");
    expect(joined).not.toContain("记忆锚点");
  });

  it("writes rigid fallback as human-readable narration", () => {
    const rigid = buildRigid();
    const data = buildRigidStoryData({ rigid }, []);
    const joined = data.storyParagraphs.join("\n");

    expect(joined).toContain("本回合你拍板的核心决断");
    expect(joined).toContain("中枢建议汇总");
    expect(joined).not.toContain("【其一·临朝】");
  });

  it("retains structured rigid metadata while keeping hidden modules out of player text", () => {
    const rigid = buildRigid();
    rigid.memoryAnchors.push({ turn: 2, summary: "局势未定" });
    const data = buildRigidStoryData({ rigid }, []);

    expect(Array.isArray(data.rigidMeta?.modules)).toBe(true);
    expect(data.rigidMeta?.hiddenModuleIds).toEqual([1, 8]);
    expect(data.rigidMeta?.latestMemoryAnchor?.summary).toBe("局势未定");
    expect(data.storyParagraphs.join("\n")).not.toContain("记忆锚点");
  });

  it("emits strike recovery choice while strike state is active", () => {
    const rigid = buildRigid();
    rigid.court.strikeState = true;
    rigid.strikeLevel = 2;

    const data = buildRigidStoryData({ rigid }, []);
    const strikeChoice = data.choices.find((choice) => choice.id === "rigid_strike_recover");
    expect(strikeChoice).toBeTruthy();
    expect(strikeChoice.text).toContain("罢朝处置");
  });
});
