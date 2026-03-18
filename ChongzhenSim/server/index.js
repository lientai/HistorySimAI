const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const SYSTEM_PROMPT = `你是《崇祯皇帝模拟器》游戏的剧情写手。
每回合你必须只输出一个合法 JSON 对象，且结构中包含 header、storyParagraphs、choices。
若涉及任命或处置，请写入 lastChoiceEffects.appointments / lastChoiceEffects.characterDeath。`;

function readJsonSafely(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function createApp(options = {}) {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  const configPath = options.configPath || path.join(__dirname, "config.json");
  const charactersPath = options.charactersPath || path.join(__dirname, "..", "data", "characters.json");
  const positionsPath = options.positionsPath || path.join(__dirname, "..", "data", "positions.json");

  let config = options.config || readJsonSafely(configPath) || {};
  if (!options.config && !Object.keys(config).length && !options.allowMissingConfig) {
    console.error("未找到 server/config.json 或格式错误。请创建 config.json 并填写 LLM_API_KEY。");
    process.exit(1);
  }

  const charactersData = options.charactersData || readJsonSafely(charactersPath);
  const positionsData = options.positionsData || readJsonSafely(positionsPath);

  const LLM_API_KEY = config.LLM_API_KEY || "";
  const LLM_API_BASE = (config.LLM_API_BASE || "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
  const LLM_MODEL = config.LLM_MODEL || "glm-4-flash";
  const LLM_CHAT_MODEL = config.LLM_CHAT_MODEL || "glm-4-flash";

  function getCharacters() {
    return (charactersData && (charactersData.characters || charactersData.ministers)) || [];
  }

  function getPositions() {
    return (positionsData && positionsData.positions) || [];
  }

  function getDepartments() {
    return (positionsData && positionsData.departments) || [];
  }

  function getRanks() {
    const positions = getPositions();
    return Array.from(new Set(positions.map((p) => p.rank).filter(Boolean)));
  }

  function getAliveStatus(state, characterId) {
    return state?.characterStatus?.[characterId]?.isAlive !== false;
  }

  function getSeasonByMonth(month) {
    const m = Number(month) || 1;
    if (m >= 3 && m <= 5) return "春";
    if (m >= 6 && m <= 8) return "夏";
    if (m >= 9 && m <= 11) return "秋";
    return "冬";
  }

  function buildUserMessage(body) {
    const { state = {}, lastChoiceId, lastChoiceText, courtChatSummary, unlockedPolicies = [], customPolicies = [] } = body || {};

    const day = state.currentDay ?? 1;
    const year = state.currentYear ?? 1;
    const month = state.currentMonth ?? 1;
    const phase = state.currentPhase ?? "morning";
    const phaseLabel = phase === "morning" ? "早朝" : phase === "afternoon" ? "午后" : "夜间";
    const season = getSeasonByMonth(month);
    const weather = state.weather || "未记载";

    const nation = state.nation || {};
    const treasury = nation.treasury ?? 0;
    const grain = nation.grain ?? 0;
    const militaryStrength = nation.militaryStrength ?? 50;
    const civilMorale = nation.civilMorale ?? 50;
    const borderThreat = nation.borderThreat ?? 50;
    const disasterLevel = nation.disasterLevel ?? 50;
    const corruptionLevel = nation.corruptionLevel ?? 50;

    const treasuryStatus = treasury >= 5000000 ? "极度充裕" : treasury >= 1000000 ? "充裕" : treasury >= 300000 ? "一般" : treasury >= 100000 ? "紧张" : "极度空虚";

    const nationStr = `国库=${treasury.toLocaleString()}两（${treasuryStatus}）, 粮储=${grain.toLocaleString()}石, 军力=${militaryStrength}, 民心=${civilMorale}, 边患=${borderThreat}, 天灾=${disasterLevel}, 贪腐=${corruptionLevel}`;
    const timeContext = `当前是崇祯${year}年${month}月（第${day}回合）${phaseLabel}，季节=${season}，天气=${weather}。国势：${nationStr}。`;

    let base = "";
    if (lastChoiceId == null || lastChoiceText == null) {
      base = `${timeContext}这是新开档第一回合，请生成完整剧情与 3 个选项，并在 header 中提供 time、season、weather。`;
    } else {
      const isCustomEdict = lastChoiceId === "custom_edict";
      const hint = isCustomEdict
        ? "上一回合是自拟诏书，请在 lastChoiceEffects 中体现执行效果。"
        : "上一回合是预设选项，请推演执行效果。";
      base = `${timeContext}上一回合陛下选择了：id=${lastChoiceId}，文案="${lastChoiceText}"。${hint} 请在 header 中提供 time、season、weather。`;
    }

    const ministers = getCharacters();
    if (Array.isArray(ministers) && ministers.length) {
      const ministerList = ministers.map((m) => `${m.id}（${m.name}，${m.role || ""}）`).join("、");
      base += `\n\n当前大臣 id 与名字对应：${ministerList}`;
    }

    const unlocked = Array.isArray(unlockedPolicies) ? unlockedPolicies.filter((id) => typeof id === "string" && id.trim()) : [];
    const custom = Array.isArray(customPolicies)
      ? customPolicies
        .map((item) => (item && typeof item === "object" ? String(item.name || item.title || item.id || "").trim() : ""))
        .filter(Boolean)
      : [];
    if (unlocked.length || custom.length) {
      const unlockedText = unlocked.length ? unlocked.join("、") : "无";
      const customText = custom.length ? custom.join("、") : "无";
      base += `\n\n已实施国策（纳入全局推理）：国策树=${unlockedText}；自定义国策=${customText}。请在剧情、选项和数值推演中综合考虑其持续影响。`;
    }

    if (courtChatSummary && typeof courtChatSummary === "string" && courtChatSummary.trim()) {
      base += `\n\n（以下为陛下与大臣的私下议事记录）\n${courtChatSummary.trim()}`;
    }

    return base;
  }

  app.post("/api/chongzhen/story", async (req, res) => {
    if (!LLM_API_KEY) {
      return res.status(500).json({ error: "LLM_API_KEY not configured" });
    }

    const body = req.body || {};
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(body) },
    ];

    try {
      const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: errText || "LLM request failed" });
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content == null) {
        return res.status(502).json({ error: "No content in LLM response" });
      }

      res.set("Content-Type", "application/json; charset=utf-8");
      return res.send(content);
    } catch (e) {
      return res.status(500).json({ error: e.message || "Proxy error" });
    }
  });

  app.post("/api/chongzhen/ministerChat", async (req, res) => {
    if (!LLM_API_KEY) {
      return res.status(500).json({ error: "LLM_API_KEY not configured" });
    }

    const ministers = getCharacters();
    if (!Array.isArray(ministers) || ministers.length === 0) {
      return res.status(500).json({ error: "characters.json not loaded" });
    }

    const body = req.body || {};
    const ministerId = body.ministerId;
    const history = Array.isArray(body.history) ? body.history : [];

    if (!ministerId) {
      return res.status(400).json({ error: "ministerId is required" });
    }

    const minister = ministers.find((m) => m.id === ministerId);
    if (!minister) {
      return res.status(404).json({ error: "minister not found" });
    }

    const systemPrompt = `你现在是 ${minister.name}，只输出 JSON：{"reply":"...","loyaltyDelta":0}`;
    const messages = [{ role: "system", content: systemPrompt }, ...history.slice(-20)];

    try {
      const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({ model: LLM_CHAT_MODEL, messages }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: errText || "LLM request failed" });
      }

      const data = await response.json();
      let content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        return res.status(502).json({ error: "No content in LLM response" });
      }

      content = content.trim();
      let reply = content;
      let loyaltyDelta = 0;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.reply === "string") reply = parsed.reply.trim();
          if (typeof parsed.loyaltyDelta === "number" && Number.isFinite(parsed.loyaltyDelta)) {
            loyaltyDelta = Math.max(-2, Math.min(2, Math.round(parsed.loyaltyDelta)));
          }
        } catch (_) {
          // keep fallback reply
        }
      }

      return res.json({ reply, loyaltyDelta });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Proxy error" });
    }
  });

  app.get("/api/chongzhen/characters", (_req, res) => {
    const characters = getCharacters();
    return res.json({
      total: characters.length,
      characters,
      positions: getPositions(),
      departments: getDepartments(),
    });
  });

  app.get("/api/chongzhen/positions", (_req, res) => {
    const positions = getPositions();
    return res.json({
      total: positions.length,
      positions,
      departments: getDepartments(),
      ranks: getRanks(),
    });
  });

  app.post("/api/chongzhen/appoint", (req, res) => {
    const { positionId, characterId, state = {} } = req.body || {};

    if (!positionId || !characterId) {
      return res.status(400).json({ success: false, error: "positionId and characterId are required" });
    }

    const positions = getPositions();
    const characters = getCharacters();

    const targetPosition = positions.find((item) => item.id === positionId);
    if (!targetPosition) {
      return res.status(404).json({ success: false, error: "position not found" });
    }

    const targetCharacter = characters.find((item) => item.id === characterId);
    if (!targetCharacter) {
      return res.status(404).json({ success: false, error: "character not found" });
    }

    if (!getAliveStatus(state, characterId)) {
      return res.status(400).json({ success: false, error: "该角色已故，无法任命" });
    }

    const appointments = { ...(state.appointments || {}) };
    const oldHolder = appointments[positionId];

    let oldPosition;
    for (const [posId, holderId] of Object.entries(appointments)) {
      if (holderId === characterId && posId !== positionId) {
        oldPosition = posId;
        delete appointments[posId];
      }
    }

    appointments[positionId] = characterId;

    return res.json({
      success: true,
      appointment: {
        positionId,
        characterId,
        positionName: targetPosition.name || positionId,
        characterName: targetCharacter.name || characterId,
        oldHolder,
        oldPosition,
      },
      appointments,
    });
  });

  app.post("/api/chongzhen/punish", (req, res) => {
    const { characterId, action, reason, state = {} } = req.body || {};

    if (!characterId || !action) {
      return res.status(400).json({ error: "characterId and action are required" });
    }

    const characters = getCharacters();
    const targetCharacter = characters.find((item) => item.id === characterId);
    if (!targetCharacter) {
      return res.status(404).json({ error: "character not found" });
    }

    if (!getAliveStatus(state, characterId)) {
      return res.status(400).json({ error: "该角色已故" });
    }

    if (!["execute", "exile", "demote"].includes(action)) {
      return res.status(400).json({ error: "invalid action" });
    }

    const appointments = { ...(state.appointments || {}) };
    let removedPosition;
    for (const [posId, holderId] of Object.entries(appointments)) {
      if (holderId === characterId) {
        removedPosition = posId;
        delete appointments[posId];
      }
    }

    const characterStatus = { ...(state.characterStatus || {}) };
    const current = characterStatus[characterId] || {};

    if (action === "execute") {
      characterStatus[characterId] = {
        ...current,
        isAlive: false,
        deathReason: reason || "处死",
        deathDay: state.currentDay || 1,
      };
    } else if (action === "exile") {
      characterStatus[characterId] = {
        ...current,
        exiled: true,
        exileReason: reason || "流放",
      };
    } else {
      characterStatus[characterId] = {
        ...current,
        demoted: true,
      };
    }

    return res.json({
      success: true,
      action,
      characterId,
      removedPosition,
      characterStatus,
      appointments,
    });
  });

  return {
    app,
    buildUserMessage,
    getCharacters,
    getPositions,
  };
}

module.exports = { createApp };

if (require.main === module) {
  const { app } = createApp();
  const localConfig = readJsonSafely(path.join(__dirname, "config.json")) || {};
  const PORT = localConfig.PORT != null ? localConfig.PORT : 3002;
  app.listen(PORT, () => {
    console.log(`ChongzhenSim proxy listening on http://localhost:${PORT} (routes: /api/chongzhen/story, /api/chongzhen/ministerChat, /api/chongzhen/characters, /api/chongzhen/positions, /api/chongzhen/appoint, /api/chongzhen/punish)`);
    if (!localConfig.LLM_API_KEY) {
      console.warn("config.json 中 LLM_API_KEY 未填写; API 将返回 500。");
    }
  });
}
