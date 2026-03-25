const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:3002",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3002",
];

const REQUEST_TIMEOUT_MS = 60000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 200;

const SYSTEM_PROMPT = `你是《崇祯皇帝模拟器》游戏的剧情写手。
每回合你必须只输出一个合法 JSON 对象，且结构中包含 header、storyParagraphs、choices。
若涉及任命或处置，请写入 lastChoiceEffects.appointments / lastChoiceEffects.characterDeath。
必须严格遵循传入的朝堂快照：已故角色不得复活、任职或作为在任官员出现；未在任角色不得被称作在任。
剧情、旁白、选项文案、提示必须使用中文，不得出现英文国策ID（如 civil_tax_reform）或英文句子。`;

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
  
  const allowedOrigins = options.allowedOrigins || 
    (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : DEFAULT_ALLOWED_ORIGINS);
  
  app.use(cors({ 
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));
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

  function sanitizeMinisterReplyText(reply, deceasedList) {
    if (typeof reply !== "string" || !reply.trim()) return reply;
    const deceasedNames = (Array.isArray(deceasedList) ? deceasedList : [])
      .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (!deceasedNames.length) return reply;

    let output = reply;
    const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    deceasedNames.forEach((name) => {
      const pattern = new RegExp(escapeRegex(name), "g");
      output = output.replace(pattern, "旧臣");
    });

    return output;
  }

  function escapeRegExp(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildUnlockedPolicyLabelMap(body) {
    const ids = Array.isArray(body?.unlockedPolicies)
      ? body.unlockedPolicies.filter((id) => typeof id === "string" && id.trim())
      : [];
    const titleMap = body?.unlockedPolicyTitleMap && typeof body.unlockedPolicyTitleMap === "object"
      ? body.unlockedPolicyTitleMap
      : {};
    const titles = Array.isArray(body?.unlockedPolicyTitles)
      ? body.unlockedPolicyTitles.map((item) => String(item || "").trim())
      : [];

    const map = {};
    ids.forEach((id, index) => {
      const mapped = typeof titleMap[id] === "string" && titleMap[id].trim()
        ? titleMap[id].trim()
        : (titles[index] || "");
      map[id] = mapped || id;
    });
    return map;
  }

  function replacePolicyIdsInText(text, policyLabelMap) {
    if (typeof text !== "string" || !text) return text;
    let output = text;
    const entries = Object.entries(policyLabelMap || {})
      .filter(([id, label]) => typeof id === "string" && id && typeof label === "string" && label)
      .sort((a, b) => b[0].length - a[0].length);

    entries.forEach(([id, label]) => {
      const pattern = new RegExp(`\\b${escapeRegExp(id)}\\b`, "g");
      output = output.replace(pattern, label);
    });
    return output;
  }

  function sanitizeStoryPayloadLanguage(payload, policyLabelMap) {
    if (!payload || typeof payload !== "object") return payload;
    const next = { ...payload };

    if (Array.isArray(next.storyParagraphs)) {
      next.storyParagraphs = next.storyParagraphs.map((line) => replacePolicyIdsInText(line, policyLabelMap));
    }

    if (Array.isArray(next.choices)) {
      next.choices = next.choices.map((choice) => {
        if (!choice || typeof choice !== "object") return choice;
        const updated = { ...choice };
        ["text", "hint", "title", "description"].forEach((key) => {
          if (typeof updated[key] === "string") {
            updated[key] = replacePolicyIdsInText(updated[key], policyLabelMap);
          }
        });
        return updated;
      });
    }

    if (typeof next.news === "string") next.news = replacePolicyIdsInText(next.news, policyLabelMap);
    if (typeof next.publicOpinion === "string") next.publicOpinion = replacePolicyIdsInText(next.publicOpinion, policyLabelMap);
    return next;
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
    const positions = getPositions();
    const positionById = new Map((Array.isArray(positions) ? positions : []).map((p) => [String(p.id || ""), p]));
    const ministerById = new Map((Array.isArray(ministers) ? ministers : []).map((m) => [String(m.id || ""), m]));
    const appointments = state.appointments && typeof state.appointments === "object" ? state.appointments : {};

    if (Array.isArray(ministers) && ministers.length) {
      const positionNameByHolder = {};
      Object.entries(appointments).forEach(([positionId, characterId]) => {
        if (typeof characterId !== "string" || !characterId.trim()) return;
        const position = positionById.get(String(positionId || ""));
        if (!position?.name) return;
        if (!getAliveStatus(state, characterId)) return;
        positionNameByHolder[characterId] = position.name;
      });
      const ministerList = ministers.map((m) => {
        const dynamicRole = positionNameByHolder[m.id] || m.role || "未任官职";
        return `${m.id}（${m.name}，${dynamicRole}）`;
      }).join("、");
      base += `\n\n当前大臣 id 与名字对应：${ministerList}`;
    }

    const activeAppointments = Object.entries(appointments)
      .filter(([positionId, characterId]) => {
        if (!positionById.has(String(positionId || ""))) return false;
        if (typeof characterId !== "string" || !characterId.trim()) return false;
        return getAliveStatus(state, characterId);
      })
      .map(([positionId, characterId]) => {
        const pos = positionById.get(String(positionId || ""));
        const minister = ministerById.get(String(characterId || ""));
        return {
          positionId,
          positionName: pos?.name || positionId,
          characterId,
          characterName: minister?.name || characterId,
        };
      });

    const inOfficeIds = new Set(activeAppointments.map((item) => item.characterId));
    const aliveNotInOffice = (Array.isArray(ministers) ? ministers : [])
      .filter((m) => m && m.id && getAliveStatus(state, m.id) && !inOfficeIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name }));

    const deceasedMinisters = (Array.isArray(ministers) ? ministers : [])
      .filter((m) => m && m.id && !getAliveStatus(state, m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        reason: state?.characterStatus?.[m.id]?.deathReason || "已故",
      }));

    base += `\n\n朝堂任职快照（推理硬约束）：在任且在世=${JSON.stringify(activeAppointments)}；在世未任=${JSON.stringify(aliveNotInOffice)}；已故=${JSON.stringify(deceasedMinisters)}。请保持称谓与任职状态一致。`;

    const unlocked = Array.isArray(unlockedPolicies) ? unlockedPolicies.filter((id) => typeof id === "string" && id.trim()) : [];
    const unlockedPolicyLabelMap = buildUnlockedPolicyLabelMap(body);
    const unlockedDisplay = unlocked.map((id) => unlockedPolicyLabelMap[id] || id);
    const custom = Array.isArray(customPolicies)
      ? customPolicies
        .map((item) => (item && typeof item === "object" ? String(item.name || item.title || item.id || "").trim() : ""))
        .filter(Boolean)
      : [];
    if (unlockedDisplay.length || custom.length) {
      const unlockedText = unlockedDisplay.length ? unlockedDisplay.join("、") : "无";
      const customText = custom.length ? custom.join("、") : "无";
      base += `\n\n已实施国策（纳入全局推理）：国策树=${unlockedText}；自定义国策=${customText}。请在剧情、选项和数值推演中综合考虑其持续影响，并且所有输出文案必须为中文。`;
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      
      let response;
      try {
        response = await fetch(`${LLM_API_BASE}/chat/completions`, {
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
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: errText || "LLM request failed" });
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content == null) {
        return res.status(502).json({ error: "No content in LLM response" });
      }

      const policyLabelMap = buildUnlockedPolicyLabelMap(body);
      if (Object.keys(policyLabelMap).length) {
        try {
          const parsed = JSON.parse(content);
          const sanitized = sanitizeStoryPayloadLanguage(parsed, policyLabelMap);
          return res.json(sanitized);
        } catch (_e) {
          // If model returns non-JSON text unexpectedly, keep original passthrough behavior.
        }
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
    const clientState = body.state && typeof body.state === "object" ? body.state : {};

    if (!ministerId) {
      return res.status(400).json({ error: "ministerId is required" });
    }

    const minister = ministers.find((m) => m.id === ministerId);
    if (!minister) {
      return res.status(404).json({ error: "minister not found" });
    }

    if (!getAliveStatus(clientState, ministerId)) {
      return res.status(400).json({ error: "minister is deceased" });
    }

    const positions = getPositions();
    const positionIds = positions.map((p) => p.id).filter(Boolean);
    const ministerIds = ministers.map((m) => m.id).filter(Boolean);
    const currentAppointments = clientState.appointments && typeof clientState.appointments === "object"
      ? clientState.appointments
      : {};

    const normalizeAppointmentsMap = (raw) => {
      if (!raw) return undefined;

      const positionById = new Map(positions.map((p) => [String(p.id || ""), p]));
      const positionIdByName = new Map(positions.map((p) => [String(p.name || "").trim(), String(p.id || "")]));
      const characterById = new Map(ministers.map((m) => [String(m.id || ""), m]));
      const characterIdByName = new Map(ministers.map((m) => [String(m.name || "").trim(), String(m.id || "")]));

      const toPositionId = (value) => {
        if (typeof value !== "string") return "";
        const trimmed = value.trim();
        if (!trimmed) return "";
        if (positionById.has(trimmed)) return trimmed;
        return positionIdByName.get(trimmed) || "";
      };

      const toCharacterId = (value) => {
        if (typeof value !== "string") return "";
        const trimmed = value.trim();
        if (!trimmed) return "";
        if (characterById.has(trimmed)) return trimmed;
        return characterIdByName.get(trimmed) || "";
      };

      const mapped = {};
      const pairs = [];

      if (Array.isArray(raw)) {
        raw.forEach((item) => {
          if (!item || typeof item !== "object") return;
          pairs.push([item.positionId, item.characterId]);
        });
      } else if (typeof raw === "object") {
        Object.entries(raw).forEach(([positionRaw, characterRaw]) => {
          pairs.push([positionRaw, characterRaw]);
        });
      } else {
        return undefined;
      }

      for (const [positionRaw, characterRaw] of pairs) {
        const positionId = toPositionId(positionRaw);
        const characterId = toCharacterId(characterRaw);
        if (!positionId || !characterId) continue;
        mapped[positionId] = characterId;
      }

      return Object.keys(mapped).length ? mapped : undefined;
    };

    const characterStatus = clientState.characterStatus && typeof clientState.characterStatus === "object"
      ? clientState.characterStatus
      : {};
    const positionById = new Map(positions.map((p) => [String(p.id || ""), p]));
    const activeAppointments = Object.entries(currentAppointments)
      .filter(([positionId, characterId]) => {
        if (!positionById.has(String(positionId || ""))) return false;
        if (typeof characterId !== "string" || !characterId.trim()) return false;
        return getAliveStatus(clientState, characterId);
      })
      .map(([positionId, characterId]) => {
        const p = positionById.get(String(positionId || ""));
        const c = ministers.find((item) => item.id === characterId);
        return {
          positionId,
          positionName: p?.name || positionId,
          characterId,
          characterName: c?.name || characterId,
        };
      });

    const inOfficeAliveIds = new Set(activeAppointments.map((item) => item.characterId));
    const aliveMinisters = ministers.filter((m) => getAliveStatus(clientState, m.id));
    const retiredAliveMinisters = aliveMinisters
      .filter((m) => !inOfficeAliveIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name }));
    const deceasedMinisters = ministers
      .filter((m) => !getAliveStatus(clientState, m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        reason: characterStatus[m.id]?.deathReason || "已故",
      }));

    const currentOffice = activeAppointments.find((item) => item.characterId === ministerId);

    const systemPrompt = `你现在是 ${minister.name}。\n你必须只输出一个合法 JSON：{"reply":"...","loyaltyDelta":0,"appointments":{},"effects":{}}。\nappointments/effects 可选；只有皇帝明确下达任免或政策调整时才填写。\n不得让已故大臣重新出现、复活、任职或发言；不得将未任职者称作在任官员。\n称谓与官职必须匹配当前朝堂快照，除非本轮在 appointments 中明确变更。`;
    const contextPrompt = `可用官职ID: ${positionIds.join(", ")}\n可用大臣ID: ${ministerIds.join(", ")}\n当前说话大臣: ${minister.id}(${minister.name})，在任官职=${currentOffice?.positionName || "无"}\n在任且在世名单: ${JSON.stringify(activeAppointments)}\n在世未任名单: ${JSON.stringify(retiredAliveMinisters)}\n已故名单: ${JSON.stringify(deceasedMinisters)}\n当前任命映射: ${JSON.stringify(currentAppointments)}`;
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: contextPrompt },
      ...history.slice(-20),
    ];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      
      let response;
      try {
        response = await fetch(`${LLM_API_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LLM_API_KEY}`,
          },
          body: JSON.stringify({ model: LLM_CHAT_MODEL, messages }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

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
      let appointments;
      let effects;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.reply === "string") reply = parsed.reply.trim();
          if (typeof parsed.loyaltyDelta === "number" && Number.isFinite(parsed.loyaltyDelta)) {
            loyaltyDelta = Math.max(-2, Math.min(2, Math.round(parsed.loyaltyDelta)));
          }
          appointments = normalizeAppointmentsMap(parsed.appointments);
          if (parsed.effects && typeof parsed.effects === "object" && !Array.isArray(parsed.effects)) {
            effects = parsed.effects;
          }
        } catch (_) {
          // keep fallback reply
        }
      }

      if (appointments) {
        const filtered = {};
        for (const [positionId, characterId] of Object.entries(appointments)) {
          if (!getAliveStatus(clientState, characterId)) continue;
          filtered[positionId] = characterId;
        }
        appointments = Object.keys(filtered).length ? filtered : undefined;
      }

      reply = sanitizeMinisterReplyText(reply, deceasedMinisters);

      const payload = { reply, loyaltyDelta };
      if (appointments) payload.appointments = appointments;
      if (effects) payload.effects = effects;
      payload.ministerId = ministerId;
      return res.json(payload);
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
    sanitizeMinisterReplyText,
    buildUnlockedPolicyLabelMap,
    sanitizeStoryPayloadLanguage,
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
