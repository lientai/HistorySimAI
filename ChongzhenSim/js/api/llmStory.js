import { buildStoryRequestBody } from "./requestContext.js";
import { getApiBase, postJsonAndReadText } from "./httpClient.js";
import { normalizeStoryPayload, sanitizeStoryEffects } from "./validators.js";

export async function requestStoryTurn(state, lastChoice) {
  const config = state.config || {};
  const apiBase = getApiBase(config, "requestStoryTurn");
  if (!apiBase) return null;

  const url = `${apiBase}/api/chongzhen/story`;
  const body = buildStoryRequestBody(state, lastChoice);
  const courtChatSummary = buildCourtChatSummary(state);
  if (courtChatSummary) body.courtChatSummary = courtChatSummary;

  const raw = await postJsonAndReadText(url, body, "requestStoryTurn");
  if (raw == null) {
    return null;
  }

  const parsed = parseLLMContent(raw);
  const normalized = normalizeStoryPayload(parsed, state);
  if (!normalized) {
    console.error("requestStoryTurn invalid shape", {
      rawPreview: raw?.slice?.(0, 200) + (raw?.length > 200 ? "..." : ""),
      rawLength: raw?.length,
      parsed,
      note: "期望可归一化为 { storyParagraphs: [...], choices: [...] }，且可提供至少 3 个 choices",
    });
    return null;
  }

  const ensuredChoices = ensureMilitaryExpansionChoice(normalized.choices.slice(0, 3), state);

  const phaseKey = state.currentPhase || "morning";
  const phaseLabel = phaseKey === "morning" ? "早朝" : phaseKey === "afternoon" ? "午后" : "夜间";
  const expectedTime = `崇祯${state.currentYear || 1}年${state.currentMonth || 1}月 ${phaseLabel}`;
  const expectedSeason = getSeasonByMonth(state.currentMonth || 1);
  const expectedWeather = getSeasonalWeatherByState(state, expectedSeason);
  const header = { ...(normalized.header || {}) };
  header.time = expectedTime;
  header.season = header.season || expectedSeason;
  header.weather = header.weather || expectedWeather;

  return {
    header,
    storyParagraphs: normalized.storyParagraphs,
    choices: ensuredChoices,
    lastChoiceEffects: normalizeLastChoiceEffects(parsed?.lastChoiceEffects),
    news: normalized.news,
    publicOpinion: normalized.publicOpinion,
  };
}

function getSeasonByMonth(month) {
  const m = Number(month) || 1;
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  return "冬";
}

function getSeasonalWeatherByState(state, season) {
  const weatherPool = {
    "春": ["春雨", "微风", "晴暖", "薄雾", "和风"],
    "夏": ["炎热", "骤雨", "闷热", "雷雨", "晴朗"],
    "秋": ["秋高气爽", "凉风", "阴凉", "微雨", "清朗"],
    "冬": ["寒风", "阴冷", "小雪", "霜寒", "晴冷"],
  };
  const list = weatherPool[season] || ["平稳"];
  const year = Number(state.currentYear) || 1;
  const month = Number(state.currentMonth) || 1;
  const day = Number(state.currentDay) || 1;
  const phase = String(state.currentPhase || "morning");
  const phaseSeed = phase === "morning" ? 1 : phase === "afternoon" ? 2 : 3;
  const idx = Math.abs((year * 97 + month * 31 + day * 13 + phaseSeed * 7) % list.length);
  return list[idx] || list[0];
}

function normalizeAppointmentsMap(raw) {
  if (!raw) return undefined;
  // Already a plain object dict: { positionId: characterId }
  if (!Array.isArray(raw)) {
    if (typeof raw !== "object") return undefined;
    const result = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k === "string" && typeof v === "string") result[k] = v;
    }
    return Object.keys(result).length ? result : undefined;
  }
  // Array of { positionId, characterId } objects
  const result = {};
  for (const item of raw) {
    if (item && typeof item === "object" && typeof item.positionId === "string" && typeof item.characterId === "string") {
      result[item.positionId] = item.characterId;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function normalizeLastChoiceEffects(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const effects = sanitizeStoryEffects(raw);
  if (effects.appointments != null) {
    const map = normalizeAppointmentsMap(effects.appointments);
    if (map) {
      effects.appointments = map;
    } else {
      delete effects.appointments;
    }
  }
  return effects;
}

function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch (_) {
    return null;
  }
}

function normalizeLLMJsonText(input) {
  let t = String(input || "");
  // 智能引号 / 全角标点 -> 普通 ASCII
  t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  t = t.replace(/，/g, ',').replace(/：/g, ':').replace(/；/g, ';');
  // 去掉 + 前缀数字（JSON 不允许 '+2'）
  t = t.replace(/:\s*\+([0-9]+)/g, ': $1');
  t = t.replace(/\s\+([0-9]+)([\s,}])/g, ' $1$2');
  // 去掉多余的尾随逗号
  t = t.replace(/,\s*([}\]])/g, '$1');
  return t;
}

function escapeRawNewlinesInJsonStrings(input) {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = !inString;
      continue;
    }
    if (inString && (ch === "\n" || ch === "\r")) {
      out += "\\n";
      continue;
    }
    out += ch;
  }
  return out;
}

function parseLooseJson(input) {
  if (!input || typeof input !== "string") return null;
  const normalized = escapeRawNewlinesInJsonStrings(normalizeLLMJsonText(input));
  return safeJsonParse(normalized) || safeJsonParse(input);
}

function ensureMilitaryExpansionChoice(choices, state) {
  const list = Array.isArray(choices) ? choices.slice(0, 3) : [];
  const activeHostiles = (state.hostileForces || []).filter((item) => !item.isDefeated);
  if (!activeHostiles.length || list.length < 3) return list;

  const hasMilitary = list.some((item) => /军事|开拓|征讨|围剿|剿灭|北伐|平叛/.test(item?.text || ""));
  if (hasMilitary) return list;

  const target = activeHostiles.slice().sort((a, b) => (b.power || 0) - (a.power || 0))[0];
  const fallback = {
    id: "military_expansion_auto",
    text: `调集边军开拓战线，重点围剿${target.name}`,
    hint: "以军力换取敌对势力衰减，若持续打击可至灭亡",
    effects: {
      treasury: -180000,
      militaryStrength: -2,
      borderThreat: -6,
      civilMorale: 2,
      hostileDamage: {
        [target.id]: 12,
      },
    },
  };
  list[2] = fallback;
  return list;
}

const COURT_CHAT_SUMMARY_MAX_LEN = 800;
const COURT_CHAT_TAKE_PER_MINISTER = 5;

function buildCourtChatSummary(state) {
  const courtChats = state.courtChats || {};
  const ministers = state.ministers || [];
  const nameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
  const parts = [];
  let len = 0;
  for (const [ministerId, list] of Object.entries(courtChats)) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const name = nameById[ministerId] || ministerId;
    const recent = list.slice(-COURT_CHAT_TAKE_PER_MINISTER);
    for (const m of recent) {
      const role = m.from === "player" ? "陛下" : "臣";
      const line = `「${name}」：${role}：${(m.text || "").trim()}`;
      if (len + line.length + 1 > COURT_CHAT_SUMMARY_MAX_LEN) return parts.join("\n").slice(0, COURT_CHAT_SUMMARY_MAX_LEN);
      parts.push(line);
      len += line.length + 1;
    }
  }
  return parts.join("\n");
}

function parseLLMContent(raw) {
  let str = (raw || "").trim();
  const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) str = codeBlockMatch[1].trim();

  // 1) 优先尝试完整解析
  let parsed = parseLooseJson(str);
  if (parsed) return parsed;

  // 2) 如果 LLM 包了一层字符串
  parsed = safeJsonParse(str);
  if (typeof parsed === 'string') {
    const nested = parseLooseJson(parsed);
    if (nested) return nested;
  }

  // 3) 最后：尝试从文本中提取首个完整 JSON 对象再解析（容忍说明文字、额外文本）
  const findFirstJsonObject = (text) => {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;
    let begin = -1;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') {
        if (depth === 0) begin = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && begin !== -1) {
          const substr = text.slice(begin, i + 1);
          const candidate = parseLooseJson(substr);
          if (candidate) return candidate;
        }
      }
    }
    return null;
  };

  parsed = findFirstJsonObject(str);
  if (parsed) return parsed;

  // 4) 若整体 JSON 仍不可解析，尝试按字段分段抽取并重组
  parsed = extractBySegments(str);
  if (parsed) return parsed;

  return null;
}

function extractBySegments(text) {
  const extractJsonSegment = (source, key, openChar, closeChar) => {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*`);
    const keyMatch = keyRegex.exec(source);
    if (!keyMatch) return null;

    let i = keyMatch.index + keyMatch[0].length;
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== openChar) return null;

    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;

    for (; i < source.length; i++) {
      const ch = source[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === openChar) {
        depth++;
      } else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          return source.slice(start, i + 1);
        }
      }
    }
    return null;
  };

  const headerSegment = extractJsonSegment(text, "header", "{", "}");
  const storySegment = extractJsonSegment(text, "storyParagraphs", "[", "]");
  const choicesSegment = extractJsonSegment(text, "choices", "[", "]");
  const newsSegment = extractJsonSegment(text, "news", "[", "]");
  const opinionSegment = extractJsonSegment(text, "publicOpinion", "[", "]");

  const header = parseLooseJson(headerSegment) || {};
  let storyParagraphs = parseLooseJson(storySegment);
  const choices = parseLooseJson(choicesSegment);
  const news = parseLooseJson(newsSegment);
  const publicOpinion = parseLooseJson(opinionSegment);

  if (!Array.isArray(storyParagraphs)) {
    const storyStringMatch = text.match(/"storyParagraphs"\s*:\s*"([\s\S]*?)"\s*,\s*"choices"/);
    if (storyStringMatch && storyStringMatch[1]) {
      const rawStory = storyStringMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\"/g, '"')
        .trim();
      storyParagraphs = rawStory
        .split(/\n{2,}|\r\n{2,}/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(storyParagraphs) || !Array.isArray(choices)) {
    return null;
  }

  return {
    header: header && typeof header === "object" ? header : {},
    storyParagraphs,
    choices,
    news: Array.isArray(news) ? news : [],
    publicOpinion: Array.isArray(publicOpinion) ? publicOpinion : [],
  };
}
