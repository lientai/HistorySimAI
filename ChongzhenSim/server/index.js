const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

function createApp(options = {}) {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  const configPath = options.configPath || path.join(__dirname, "config.json");
  let config = {};
  
  if (options.config) {
    config = options.config;
  } else {
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      config = JSON.parse(raw);
    } catch (e) {
      if (options.allowMissingConfig) {
        console.warn("未找到 config.json，使用空配置。");
      } else {
        console.error("未找到 server/config.json 或格式错误。请创建 config.json 并填写 LLM_API_KEY。");
        process.exit(1);
      }
    }
  }

  const LLM_API_KEY = config.LLM_API_KEY || "";
  const LLM_API_BASE = (config.LLM_API_BASE || "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
  const LLM_MODEL = config.LLM_MODEL || "glm-4-flash";
  const LLM_CHAT_MODEL = config.LLM_CHAT_MODEL || "glm-4-flash";

  const charactersPath = options.charactersPath || path.join(__dirname, "..", "data", "characters.json");
  const positionsPath = options.positionsPath || path.join(__dirname, "..", "data", "positions.json");
  
  let charactersData = null;
  let positionsData = null;
  
  if (options.charactersData) {
    charactersData = options.charactersData;
  } else {
    try {
      const rawChars = fs.readFileSync(charactersPath, "utf8");
      charactersData = JSON.parse(rawChars);
    } catch (e) {
      console.warn("读取 data/characters.json 失败，大臣聊天接口将不可用。");
    }
  }

  if (options.positionsData) {
    positionsData = options.positionsData;
  } else {
    try {
      const rawPositions = fs.readFileSync(positionsPath, "utf8");
      positionsData = JSON.parse(rawPositions);
    } catch (e) {
      console.warn("读取 data/positions.json 失败，官位系统将不可用。");
    }
  }

  function getCharacters() {
    return charactersData?.characters || charactersData?.ministers || [];
  }

  function getPositions() {
    return positionsData?.positions || [];
  }

  function getDepartments() {
    return positionsData?.departments || [];
  }

  function getAliveCharacters(characterStatus) {
    const characters = getCharacters();
    if (!characterStatus) return characters.filter(c => c.isAlive !== false);
    return characters.filter(c => characterStatus[c.id]?.isAlive !== false);
  }

  function getDeadCharacters(characterStatus) {
    const characters = getCharacters();
    if (!characterStatus) return characters.filter(c => c.isAlive === false);
    return characters.filter(c => characterStatus[c.id]?.isAlive === false);
  }

  function buildCharacterListForPrompt(characterStatus, appointments) {
    const characters = getAliveCharacters(characterStatus);
    const positions = getPositions();
    const positionMap = Object.fromEntries(positions.map(p => [p.id, p.name]));
    
    return characters.map(c => {
      const heldPositions = Object.entries(appointments || {})
        .filter(([_, charId]) => charId === c.id)
        .map(([posId, _]) => positionMap[posId] || posId);
      
      const posText = heldPositions.length > 0 ? `，现任${heldPositions.join('、')}` : '';
      return `${c.id}（${c.name}${posText}）`;
    }).join("、");
  }

  const SYSTEM_PROMPT = `你是《崇祯皇帝模拟器》游戏的剧情写手。游戏背景：崇祯三年（1630年），玩家扮演崇祯皇帝朱由检，面对内忧外患的大明王朝。外有后金皇太极虎视眈眈，内有李自成等农民军此起彼伏，天灾连绵、国库空虚、朝堂党争不断。

每回合你必须只输出一个合法的 JSON 对象，不要输出任何其他文字或 markdown 代码块包裹。JSON 结构必须严格如下：
{
  "header": { "time": "具体时间描述", "season": "季节", "weather": "天气描述", "location": "地点" },
  "storyParagraphs": ["段落1字符串", "段落2字符串", ...],
  "lastChoiceEffects": {
    "treasury": 数值变化, "grain": 数值变化, "militaryStrength": 数值变化,
    "civilMorale": 数值变化, "borderThreat": 数值变化, "disasterLevel": 数值变化,
    "corruptionLevel": 数值变化, "loyalty": { "大臣id": 数值变化 },
    "characterDeath": { "characterId": "死亡原因" },
    "appointments": { "官位id": "角色id" }
  },
  "choices": [
    { "id": "唯一id", "text": "选项文案", "hint": "可选提示",
      "effects": { "treasury": 数值变化, "grain": 数值变化, ... }
    }, ...
  ]
}
可选字段：
  "news": [ { "title": "奏折标题", "summary": "简述", "province": "涉及地区" } ],
  "publicOpinion": [ { "source": "来源（如：京城百姓/江南士绅/边军将士）", "text": "舆论内容" } ]

【重要】角色生死状态：
- 只能使用当前存活的角色，已故角色绝对不能再出现在剧情中！
- 如果玩家下旨处死某角色，必须在 lastChoiceEffects.characterDeath 中标记

【重要】官位任命：
- 玩家可以下旨任命官员，更换各部尚书、侍郎等职位
- 任命时需考虑角色的忠诚度、能力和派系平衡
- 如果自拟诏书涉及任命官员，必须在 lastChoiceEffects.appointments 中标记
- appointments 格式：{ "官位id": "角色id" }，例如 { "neige_cifu": "xu_guangqi" }
- 常用官位id：
  * 内阁：neige_shoufu（内阁首辅）、neige_cifu（内阁次辅）、neige_daxueshi（内阁大学士）
  * 六部：libu_shangshu（吏部尚书）、hubu_shangshu（户部尚书）、bingbu_shangshu（兵部尚书）、xingbu_shangshu（刑部尚书）、gongbu_shangshu（工部尚书）、libu_li_shangshu（礼部尚书）
  * 都察院：dutcheng_duchayuan_zuoduyushi（左都御史）

【重要】lastChoiceEffects 和 choices 中的 effects 必须是 JSON 字段，不能写在 storyParagraphs 里面！

【重要】数值转换必须准确！中文数字与阿拉伯数字对应关系：
- 一万两 = 10,000
- 十万两 = 100,000
- 五十万两 = 500,000
- 一百万两 = 1,000,000
- 五百万两 = 5,000,000
- 一千万两 = 10,000,000
- 七千万两 = 70,000,000

要求：
- storyParagraphs 总字数 400~800 字，不少于 4 段
- 涉及大臣对话时，使用大臣全名
- lastChoiceEffects：评估上一回合玩家选择（尤其是自拟诏书）的实际执行效果
- choices 必须恰好 3 个，每个选项的 effects 须合理反映该决策对国家数值和大臣忠诚度的影响
- effects 中的数值范围：
  * treasury（国库，单位两）：支出 -100000 到 -300000，收入可达数百万两
  * grain（粮储，单位石）：通常 -50000 到 +50000
  * militaryStrength、civilMorale、borderThreat、disasterLevel、corruptionLevel（0-100指数）：通常 -15 到 +15
  * loyalty（忠诚度0-100）：通常 -5 到 +5
- 剧情须贴合明末真实历史背景，不可出现架空、穿越、科幻元素
- id 用英文或数字，如 increase_tax`;

  function buildUserMessage(body) {
    const { state = {}, lastChoiceId, lastChoiceText, courtChatSummary } = body;
    const day = state.currentDay ?? 1;
    const phase = state.currentPhase ?? "morning";
    const phaseLabel = phase === "morning" ? "早朝" : phase === "afternoon" ? "午后" : "夜间";

    const nation = state.nation || {};
    const treasury = nation.treasury ?? 0;
    const grain = nation.grain ?? 0;
    const militaryStrength = nation.militaryStrength ?? 50;
    const civilMorale = nation.civilMorale ?? 50;
    const borderThreat = nation.borderThreat ?? 50;
    const disasterLevel = nation.disasterLevel ?? 50;
    const corruptionLevel = nation.corruptionLevel ?? 50;
    
    const treasuryStatus = treasury >= 5000000 ? "极度充裕" : treasury >= 1000000 ? "充裕" : treasury >= 300000 ? "一般" : treasury >= 100000 ? "紧张" : "极度空虚";
    const grainStatus = grain >= 100000 ? "极度充裕" : grain >= 50000 ? "充裕" : grain >= 20000 ? "一般" : grain >= 10000 ? "紧张" : "极度空虚";
    const moraleStatus = civilMorale >= 70 ? "民心归附" : civilMorale >= 50 ? "民心尚可" : civilMorale >= 30 ? "民心不稳" : "民怨沸腾";
    const borderStatus = borderThreat >= 70 ? "边患严重" : borderThreat >= 50 ? "边患尚可" : borderThreat >= 30 ? "边境安稳" : "边境太平";
    const corruptionStatus = corruptionLevel >= 70 ? "贪腐横行" : corruptionLevel >= 50 ? "贪腐尚可" : corruptionLevel >= 30 ? "吏治清明" : "吏治严明";
    
    const nationStr = `国库=${treasury.toLocaleString()}两（${treasuryStatus}）, 粮储=${grain.toLocaleString()}石（${grainStatus}）, 军力=${militaryStrength}, 民心=${civilMorale}（${moraleStatus}）, 边患=${borderThreat}（${borderStatus}）, 天灾=${disasterLevel}, 贪腐=${corruptionLevel}（${corruptionStatus}）`;

    const characterStatus = state.characterStatus || {};
    const appointments = state.appointments || {};
    const aliveCharacters = buildCharacterListForPrompt(characterStatus, appointments);
    const deadCharacters = getDeadCharacters(characterStatus).map(c => c.name).join("、");

    let base = "";
    if (lastChoiceId == null || lastChoiceText == null) {
      base = `当前是崇祯三年第 ${day} 天 ${phaseLabel}。国势：${nationStr}。这是新开档第一回合，请生成【第 ${day} 天 ${phaseLabel}】的完整剧情与 3 个选项。lastChoiceEffects 设为 null。只输出上述 JSON，不要其他内容。`;
    } else {
      const isCustomEdict = lastChoiceId === "custom_edict";
      const effectHint = isCustomEdict 
        ? `【重要】上一回合是"自拟诏书"，你必须在 lastChoiceEffects 中根据诏书内容推演实际执行效果！如果诏书涉及处死官员，必须在 characterDeath 中标记。` 
        : `上一回合是预设选项，lastChoiceEffects 根据选项内容推演效果即可。`;
      
      base = `当前是崇祯三年第 ${day} 天 ${phaseLabel}。国势：${nationStr}。上一回合陛下选择了：id=${lastChoiceId}，文案="${lastChoiceText}"。
${effectHint}
【重要】剧情必须根据当前国势合理推演！`;
    }

    if (aliveCharacters) {
      base += `\n\n【存活角色】（effects.loyalty 的 key 必须从下列 id 中选取）：\n${aliveCharacters}`;
    }
    
    if (deadCharacters) {
      base += `\n\n【已故角色】（绝对不能出现在剧情中）：\n${deadCharacters}`;
    }

    if (courtChatSummary && typeof courtChatSummary === "string" && courtChatSummary.trim()) {
      base += `\n\n（以下为陛下与大臣的私下议事记录，仅供参考、权重偏低）\n${courtChatSummary.trim()}`;
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
        body: JSON.stringify({ model: LLM_MODEL, messages }),
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
      res.send(content);
    } catch (e) {
      console.error("story proxy error", e);
      res.status(500).json({ error: e.message || "Proxy error" });
    }
  });

  app.post("/api/chongzhen/ministerChat", async (req, res) => {
    if (!LLM_API_KEY) {
      return res.status(500).json({ error: "LLM_API_KEY not configured" });
    }
    
    const characters = getCharacters();
    if (characters.length === 0) {
      return res.status(500).json({ error: "characters.json not loaded" });
    }

    const body = req.body || {};
    const ministerId = body.ministerId;
    const history = Array.isArray(body.history) ? body.history : [];
    const characterStatus = body.characterStatus || {};

    if (!ministerId) {
      return res.status(400).json({ error: "ministerId is required" });
    }

    if (characterStatus[ministerId]?.isAlive === false) {
      return res.status(400).json({ error: "该角色已故，无法对话" });
    }

    const minister = characters.find((m) => m.id === ministerId);
    if (!minister) {
      return res.status(404).json({ error: "minister not found" });
    }

    const persona = minister.summary || minister.summary || "";
    const attitude = minister.attitude || "";
    const openingLine = minister.openingLine || "";

    const systemPrompt = `你现在是明末崇祯朝的大臣，正在与崇祯皇帝（玩家）私下议事。
你扮演的大臣基本信息：
- 姓名：${minister.name}
- 官职：${minister.positions?.join('、') || minister.role || '官员'}
- 派系：${minister.factionLabel || ""}
- 人物背景与性格：${persona}
- 政治态度：${attitude}

要求：
- 你始终以"${minister.name}"本人的口吻说话，使用明代官场语气（臣、陛下、圣上等称谓）
- 不要提到自己是AI或模型
- 对话内容贴合明末真实历史背景，涉及朝政、军事、财政、民生等话题
- 回复长度适中（1~4句），保持人物设定的一致性
- 根据大臣立场和陛下的话语做出合理回应，可以有不同意见

你必须只输出一个 JSON 对象，不要输出其他文字或 markdown。格式为：
{"reply": "你作为大臣要说的话", "loyaltyDelta": 数值}
其中 loyaltyDelta 表示这次对话后你对陛下的忠诚度变化（整数），范围 -2 到 2。陛下英明决策或信任你则 +1 或 +2，中性则 0，被猜忌或决策不当则 -1 或 -2。`;

    const messages = [{ role: "system", content: systemPrompt }];

    const trimmedHistory = history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20);

    if (trimmedHistory.length === 0 && openingLine) {
      messages.push({ role: "assistant", content: openingLine });
    }

    messages.push(...trimmedHistory);

    try {
      const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({ model: LLM_CHAT_MODEL, messages }),
      });

      const text = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({ error: text || "LLM request failed" });
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(502).json({ error: "Invalid JSON from LLM" });
      }

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
        } catch (e) {
          // parse failed — use raw content as reply
        }
      }

      res.json({ reply, loyaltyDelta });
    } catch (e) {
      console.error("ministerChat proxy error", e);
      res.status(500).json({ error: e.message || "Proxy error" });
    }
  });

  app.get("/api/chongzhen/characters", (req, res) => {
    const characters = getCharacters();
    const positions = getPositions();
    const departments = getDepartments();
    
    res.json({
      total: characters.length,
      characters,
      positions,
      departments
    });
  });

  app.get("/api/chongzhen/positions", (req, res) => {
    const positions = getPositions();
    const departments = getDepartments();
    const ranks = positionsData?.ranks || [];
    
    res.json({
      total: positions.length,
      positions,
      departments,
      ranks
    });
  });

  app.post("/api/chongzhen/appoint", (req, res) => {
    const { positionId, characterId, state } = req.body || {};
    
    if (!positionId || !characterId) {
      return res.status(400).json({ error: "positionId and characterId are required" });
    }

    const positions = getPositions();
    const characters = getCharacters();
    
    const position = positions.find(p => p.id === positionId);
    if (!position) {
      return res.status(404).json({ error: "position not found" });
    }

    const character = characters.find(c => c.id === characterId);
    if (!character) {
      return res.status(404).json({ error: "character not found" });
    }

    const characterStatus = state?.characterStatus || {};
    if (characterStatus[characterId]?.isAlive === false) {
      return res.status(400).json({ error: "该角色已故，无法任命" });
    }

    const appointments = state?.appointments || {};
    const oldHolder = appointments[positionId];
    const oldPosition = Object.entries(appointments).find(([_, id]) => id === characterId)?.[0];

    const newAppointments = { ...appointments, [positionId]: characterId };
    if (oldPosition && oldPosition !== positionId) {
      delete newAppointments[oldPosition];
    }

    res.json({
      success: true,
      appointment: {
        positionId,
        positionName: position.name,
        characterId,
        characterName: character.name,
        oldHolder,
        oldPosition
      },
      appointments: newAppointments
    });
  });

  app.post("/api/chongzhen/punish", (req, res) => {
    const { characterId, action, reason, state } = req.body || {};
    
    if (!characterId || !action) {
      return res.status(400).json({ error: "characterId and action are required" });
    }

    const characters = getCharacters();
    const character = characters.find(c => c.id === characterId);
    
    if (!character) {
      return res.status(404).json({ error: "character not found" });
    }

    const characterStatus = state?.characterStatus || {};
    if (characterStatus[characterId]?.isAlive === false) {
      return res.status(400).json({ error: "该角色已故" });
    }

    const appointments = state?.appointments || {};
    const heldPosition = Object.entries(appointments).find(([_, id]) => id === characterId)?.[0];

    let newStatus = { ...characterStatus };
    let newAppointments = { ...appointments };

    switch (action) {
      case "execute":
        newStatus[characterId] = {
          isAlive: false,
          deathReason: reason || "处死",
          deathDay: state?.currentDay || 1
        };
        if (heldPosition) {
          delete newAppointments[heldPosition];
        }
        break;
      case "exile":
        newStatus[characterId] = {
          ...newStatus[characterId],
          exiled: true,
          exileReason: reason || "流放"
        };
        if (heldPosition) {
          delete newAppointments[heldPosition];
        }
        break;
      case "demote":
        if (heldPosition) {
          delete newAppointments[heldPosition];
        }
        break;
      default:
        return res.status(400).json({ error: "invalid action" });
    }

    res.json({
      success: true,
      action,
      characterId,
      characterName: character.name,
      reason,
      removedPosition: heldPosition,
      characterStatus: newStatus,
      appointments: newAppointments
    });
  });

  return { 
    app, 
    buildUserMessage, 
    config: { LLM_API_KEY, LLM_API_BASE, LLM_MODEL, LLM_CHAT_MODEL },
    getCharacters,
    getPositions,
    getAliveCharacters,
    getDeadCharacters
  };
}

module.exports = { createApp, buildUserMessage: null };

if (require.main === module) {
  const { app } = createApp();
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`ChongzhenSim proxy listening on http://localhost:${PORT}`);
    console.log(`Available routes:`);
    console.log(`  POST /api/chongzhen/story - 剧情生成`);
    console.log(`  POST /api/chongzhen/ministerChat - 大臣聊天`);
    console.log(`  GET  /api/chongzhen/characters - 获取角色库`);
    console.log(`  GET  /api/chongzhen/positions - 获取官位列表`);
    console.log(`  POST /api/chongzhen/appoint - 任命官员`);
    console.log(`  POST /api/chongzhen/punish - 处罚角色`);
  });
}
